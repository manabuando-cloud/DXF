<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Services\DrawingConverter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ConversionApiTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<array{input: string, target: string, output: string, options: array}> */
    private array $calls = [];

    private array $nextResult = ['ok' => true, 'warnings' => [], 'pages' => 1, 'paper' => 'A3 landscape', 'elapsed_ms' => 12];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->app->instance(DrawingConverter::class, new class($this) extends DrawingConverter
        {
            public function __construct(private ConversionApiTest $test) {}

            public function convert(string $input, string $target, string $output, array $options = []): array
            {
                return $this->test->fakeConvert($input, $target, $output, $options);
            }
        });
    }

    public function fakeConvert(string $input, string $target, string $output, array $options): array
    {
        $this->calls[] = compact('input', 'target', 'output', 'options');
        if ($this->nextResult['ok']) {
            file_put_contents($output, "%PDF-fake {$target}");
        }

        return $this->nextResult;
    }

    public function test_uploading_drawings_converts_them(): void
    {
        $response = $this->postJson('/api/batches', [
            'target' => 'pdf',
            'paper' => 'A3',
            'files' => [
                UploadedFile::fake()->create('206（A）.jww', 12),
                UploadedFile::fake()->create('plan.DWG', 20),
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.target', 'pdf')
            ->assertJsonPath('data.counts.total', 2)
            ->assertJsonPath('data.counts.done', 2)
            ->assertJsonPath('data.finished', true)
            ->assertJsonPath('data.conversions.0.name', '206（A）.jww')
            ->assertJsonPath('data.conversions.0.output_name', '206（A）.pdf')
            ->assertJsonPath('data.conversions.0.paper', 'A3 landscape')
            ->assertJsonPath('data.conversions.1.format', 'dwg');

        $this->assertCount(2, $this->calls);
        $this->assertSame('A3', $this->calls[0]['options']['paper']);

        // Uploads are removed once converted.
        $batch = Batch::first();
        $this->assertSame([], Storage::disk('local')->files($batch->directory().'/in'));

        $download = $this->get($response->json('data.conversions.0.download_url'));
        $download->assertOk();
        $this->assertStringContainsString("filename*=utf-8''206%EF%BC%88A%EF%BC%89.pdf", $download->headers->get('content-disposition'));

        $this->get($response->json('data.zip_url'))->assertOk()->assertDownload();
    }

    public function test_dxf_target_ignores_pdf_options(): void
    {
        $this->postJson('/api/batches', [
            'target' => 'dxf',
            'paper' => 'A0',
            'files' => [UploadedFile::fake()->create('a.jww', 1)],
        ])->assertCreated()->assertJsonPath('data.conversions.0.output_name', 'a.dxf');

        $this->assertSame([], $this->calls[0]['options']);
        $this->assertSame('dxf', $this->calls[0]['target']);
    }

    public function test_failed_conversion_is_reported(): void
    {
        $this->nextResult = ['ok' => false, 'error' => 'DWGファイルを読み込めませんでした。'];

        $this->postJson('/api/batches', [
            'target' => 'pdf',
            'files' => [UploadedFile::fake()->create('broken.dwg', 1)],
        ])
            ->assertCreated()
            ->assertJsonPath('data.counts.failed', 1)
            ->assertJsonPath('data.zip_url', null)
            ->assertJsonPath('data.conversions.0.error', 'DWGファイルを読み込めませんでした。')
            ->assertJsonPath('data.conversions.0.download_url', null);
    }

    public function test_rejects_unsupported_files_and_options(): void
    {
        $this->postJson('/api/batches', [
            'target' => 'pdf',
            'files' => [UploadedFile::fake()->create('virus.exe', 1)],
        ])->assertUnprocessable()->assertJsonValidationErrors('files.0');

        $this->postJson('/api/batches', [
            'target' => 'svg',
            'paper' => 'A9',
            'files' => [UploadedFile::fake()->create('a.dxf', 1)],
        ])->assertUnprocessable()->assertJsonValidationErrors(['target', 'paper']);

        $this->postJson('/api/batches', ['target' => 'pdf'])->assertUnprocessable()->assertJsonValidationErrors('files');
        $this->assertSame([], $this->calls);
    }

    public function test_file_count_limit(): void
    {
        config(['converter.max_files' => 2]);

        $this->postJson('/api/batches', [
            'target' => 'pdf',
            'files' => array_map(fn ($i) => UploadedFile::fake()->create("$i.dxf", 1), range(1, 3)),
        ])->assertUnprocessable()->assertJsonValidationErrors('files');
    }

    public function test_expired_batches_are_gone_and_pruned(): void
    {
        $id = $this->postJson('/api/batches', [
            'target' => 'pdf',
            'files' => [UploadedFile::fake()->create('a.dxf', 1)],
        ])->json('data.id');

        $batch = Batch::find($id);
        $this->assertNotEmpty(Storage::disk('local')->allFiles($batch->directory()));

        $this->travel(config('converter.retention_minutes') + 1)->minutes();

        $this->getJson("/api/batches/$id")->assertStatus(410);
        $this->get("/api/batches/$id/download")->assertStatus(410);

        $this->artisan('conversions:prune')->assertSuccessful();
        $this->assertNull(Batch::find($id));
        $this->assertSame([], Storage::disk('local')->allFiles($batch->directory()));
    }

    public function test_user_can_delete_a_batch_immediately(): void
    {
        $id = $this->postJson('/api/batches', [
            'target' => 'dxf',
            'files' => [UploadedFile::fake()->create('a.dxf', 1)],
        ])->json('data.id');

        $this->deleteJson("/api/batches/$id")->assertNoContent();
        $this->getJson("/api/batches/$id")->assertNotFound();
        $this->assertSame([], Storage::disk('local')->allFiles("conversions/$id"));
    }

    public function test_uploads_are_rate_limited(): void
    {
        config(['converter.rate_limit' => 1]);
        $payload = fn () => ['target' => 'dxf', 'files' => [UploadedFile::fake()->create('a.dxf', 1)]];

        $this->postJson('/api/batches', $payload())->assertCreated();
        $this->postJson('/api/batches', $payload())->assertTooManyRequests();
    }

    public function test_links_are_relative_so_they_work_behind_an_https_proxy(): void
    {
        $response = $this->postJson('/api/batches', [
            'target' => 'pdf',
            'files' => [UploadedFile::fake()->create('a.dxf', 1), UploadedFile::fake()->create('b.dxf', 1)],
        ]);

        $this->assertStringStartsWith('/api/conversions/', $response->json('data.conversions.0.download_url'));
        $this->assertStringStartsWith('/api/conversions/', $response->json('data.conversions.0.preview_url'));
        $this->assertStringStartsWith('/api/batches/', $response->json('data.zip_url'));
    }

    public function test_rate_limit_uses_client_ip_from_trusted_proxy(): void
    {
        config(['converter.rate_limit' => 1]);
        $payload = fn () => ['target' => 'dxf', 'files' => [UploadedFile::fake()->create('a.dxf', 1)]];
        $viaProxy = fn (string $client) => $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.1'])
            ->withHeaders(['X-Forwarded-For' => $client, 'X-Forwarded-Proto' => 'https']);

        // Two different visitors behind the same proxy get separate limits.
        $viaProxy('203.0.113.10')->postJson('/api/batches', $payload())->assertCreated();
        $viaProxy('203.0.113.20')->postJson('/api/batches', $payload())->assertCreated();
        $viaProxy('203.0.113.10')->postJson('/api/batches', $payload())->assertTooManyRequests();
    }

    public function test_untrusted_clients_cannot_spoof_their_ip(): void
    {
        config(['converter.rate_limit' => 1]);
        $payload = fn () => ['target' => 'dxf', 'files' => [UploadedFile::fake()->create('a.dxf', 1)]];
        $direct = fn (string $claimed) => $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])
            ->withHeaders(['X-Forwarded-For' => $claimed]);

        $direct('203.0.113.10')->postJson('/api/batches', $payload())->assertCreated();
        $direct('203.0.113.99')->postJson('/api/batches', $payload())->assertTooManyRequests();
    }

    public function test_home_page_renders(): void
    {
        $this->withoutVite()->get('/')->assertOk()->assertSee('<div id="app"></div>', false);
    }
}
