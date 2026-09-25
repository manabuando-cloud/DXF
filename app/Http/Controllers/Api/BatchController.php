<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBatchRequest;
use App\Http\Resources\BatchResource;
use App\Jobs\ConvertDrawing;
use App\Models\Batch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class BatchController extends Controller
{
    public function store(StoreBatchRequest $request): JsonResponse
    {
        $disk = Storage::disk(config('converter.disk'));
        $target = $request->string('target')->value();

        $batch = DB::transaction(function () use ($request, $target) {
            $batch = Batch::create([
                'target' => $target,
                'options' => $target === 'pdf' ? $request->pdfOptions() : null,
                'expires_at' => now()->addMinutes(config('converter.retention_minutes')),
            ]);

            foreach ($request->file('files') as $position => $file) {
                $id = (string) Str::uuid();
                $ext = strtolower($file->getClientOriginalExtension());
                $path = $file->storeAs($batch->directory().'/in', "$id.$ext", ['disk' => config('converter.disk')]);

                $batch->conversions()->create([
                    'id' => $id,
                    'position' => $position,
                    'original_name' => $this->safeName($file->getClientOriginalName()),
                    'input_path' => $path,
                    'input_size' => $file->getSize(),
                    'status' => ConversionStatus::Queued,
                ]);
            }

            return $batch;
        });

        $batch->load('conversions');
        foreach ($batch->conversions as $conversion) {
            ConvertDrawing::dispatch($conversion);
        }

        return (new BatchResource($batch->fresh('conversions.batch')))->response()->setStatusCode(201);
    }

    public function show(Batch $batch): BatchResource
    {
        abort_if($batch->isExpired(), 410, 'この変換結果は保存期間が過ぎたため削除されました。');

        return new BatchResource($batch->load('conversions.batch'));
    }

    public function download(Batch $batch): BinaryFileResponse
    {
        abort_if($batch->isExpired(), 410);
        $disk = Storage::disk(config('converter.disk'));
        $done = $batch->conversions->where('status', ConversionStatus::Done);
        abort_if($done->isEmpty(), 404);

        $zipPath = $disk->path($batch->directory().'/'.Str::random(16).'.zip');
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $used = [];
        foreach ($done as $conversion) {
            $zip->addFile($disk->path($conversion->output_path), $this->uniqueName($conversion->output_name, $used));
        }
        $zip->close();

        $name = sprintf('converted-%s-%s.zip', $batch->target, now()->format('Ymd-His'));

        return response()->download($zipPath, $name)->deleteFileAfterSend();
    }

    public function destroy(Batch $batch): Response
    {
        $batch->delete();

        return response()->noContent();
    }

    private function safeName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\]/u', '_', $name) ?? 'drawing';

        return Str::limit($name, 200, '');
    }

    /** Avoid silently overwriting files that share a name inside the zip. */
    private function uniqueName(string $name, array &$used): string
    {
        $candidate = $name;
        $i = 2;
        while (isset($used[mb_strtolower($candidate)])) {
            $candidate = pathinfo($name, PATHINFO_FILENAME)." ($i).".pathinfo($name, PATHINFO_EXTENSION);
            $i++;
        }
        $used[mb_strtolower($candidate)] = true;

        return $candidate;
    }
}
