<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DrawingConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class StatusController extends Controller
{
    public function __invoke(DrawingConverter $converter): JsonResponse
    {
        $capabilities = Cache::remember('converter.capabilities', 300, fn () => $converter->capabilities());

        return response()->json([
            'converter' => $capabilities,
            'limits' => [
                'max_files' => config('converter.max_files'),
                'max_file_mb' => round(config('converter.max_file_kb') / 1024, 1),
                'retention_minutes' => config('converter.retention_minutes'),
                'extensions' => config('converter.extensions'),
            ],
        ]);
    }
}
