<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversionStatus;
use App\Http\Controllers\Controller;
use App\Models\Conversion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConversionController extends Controller
{
    public function download(Request $request, Conversion $conversion): StreamedResponse
    {
        abort_if($conversion->batch->isExpired(), 410);
        abort_unless($conversion->status === ConversionStatus::Done, 404);

        $disk = Storage::disk(config('converter.disk'));
        $mime = $conversion->batch->target === 'pdf' ? 'application/pdf' : 'application/dxf';

        if ($request->boolean('inline') && $conversion->batch->target === 'pdf') {
            return $disk->response($conversion->output_path, $conversion->output_name, ['Content-Type' => $mime]);
        }

        return $disk->download($conversion->output_path, $conversion->output_name, ['Content-Type' => $mime]);
    }
}
