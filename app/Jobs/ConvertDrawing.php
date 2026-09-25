<?php

namespace App\Jobs;

use App\Enums\ConversionStatus;
use App\Models\Conversion;
use App\Services\DrawingConverter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ConvertDrawing implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public Conversion $conversion)
    {
        $this->timeout = config('converter.timeout') + 30;
    }

    public function handle(DrawingConverter $converter): void
    {
        $conversion = $this->conversion->fresh(['batch']);
        if (! $conversion || $conversion->status !== ConversionStatus::Queued) {
            return;
        }

        $batch = $conversion->batch;
        $disk = Storage::disk(config('converter.disk'));
        $target = $batch->target;
        $outputName = pathinfo($conversion->original_name, PATHINFO_FILENAME).'.'.$target;
        $outputPath = $batch->directory().'/out/'.$conversion->id.'.'.$target;
        $disk->makeDirectory(dirname($outputPath));

        $conversion->update(['status' => ConversionStatus::Processing, 'started_at' => now()]);

        try {
            $result = $converter->convert(
                $disk->path($conversion->input_path),
                $target,
                $disk->path($outputPath),
                $batch->options ?? [],
            );
        } catch (Throwable $e) {
            Log::error('Drawing conversion crashed', ['conversion' => $conversion->id, 'error' => $e->getMessage()]);
            $result = ['ok' => false, 'error' => '変換処理を実行できませんでした。時間をおいて再度お試しください。'];
        }

        if (($result['ok'] ?? false) && $disk->exists($outputPath)) {
            $conversion->update([
                'status' => ConversionStatus::Done,
                'output_path' => $outputPath,
                'output_name' => $outputName,
                'output_size' => $disk->size($outputPath),
                'warnings' => $result['warnings'] ?? [],
                'meta' => array_intersect_key($result, array_flip(['pages', 'paper', 'elapsed_ms'])),
                'finished_at' => now(),
            ]);
        } else {
            if (isset($result['detail'])) {
                Log::warning('Drawing conversion failed', ['conversion' => $conversion->id, 'detail' => $result['detail']]);
            }
            $conversion->update([
                'status' => ConversionStatus::Failed,
                'error' => $result['error'] ?? '変換に失敗しました。',
                'finished_at' => now(),
            ]);
        }

        // The upload is no longer needed once it has been converted.
        $disk->delete($conversion->input_path);
    }

    public function failed(?Throwable $e): void
    {
        $this->conversion->update([
            'status' => ConversionStatus::Failed,
            'error' => '変換がタイムアウトしました。図面が大きすぎる可能性があります。',
            'finished_at' => now(),
        ]);
    }
}
