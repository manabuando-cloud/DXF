<?php

namespace App\Http\Resources;

use App\Models\Conversion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Conversion */
class ConversionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $done = $this->status->value === 'done';

        return [
            'id' => $this->id,
            'name' => $this->original_name,
            'format' => $this->extension(),
            'size' => $this->input_size,
            'status' => $this->status->value,
            'output_name' => $this->output_name,
            'output_size' => $this->output_size,
            'pages' => $this->meta['pages'] ?? null,
            'paper' => $this->meta['paper'] ?? null,
            'elapsed_ms' => $this->meta['elapsed_ms'] ?? null,
            'warnings' => $this->warnings ?? [],
            'error' => $this->error,
            'download_url' => $done ? route('conversions.download', $this->resource, false) : null,
            'preview_url' => $done && $this->batch->target === 'pdf' ? route('conversions.download', [$this->resource, 'inline' => 1], false) : null,
        ];
    }
}
