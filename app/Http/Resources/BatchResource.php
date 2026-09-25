<?php

namespace App\Http\Resources;

use App\Models\Batch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Batch */
class BatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $counts = $this->conversions->countBy(fn ($c) => $c->status->value);

        return [
            'id' => $this->id,
            'target' => $this->target,
            'options' => $this->options ?: (object) [],
            'finished' => $this->isFinished(),
            'counts' => [
                'total' => $this->conversions->count(),
                'queued' => $counts->get('queued', 0),
                'processing' => $counts->get('processing', 0),
                'done' => $counts->get('done', 0),
                'failed' => $counts->get('failed', 0),
            ],
            'expires_at' => $this->expires_at->toIso8601String(),
            'zip_url' => $counts->get('done', 0) > 0 ? route('batches.download', $this->resource) : null,
            'conversions' => ConversionResource::collection($this->conversions),
        ];
    }
}
