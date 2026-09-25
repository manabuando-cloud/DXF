<?php

namespace App\Models;

use App\Enums\ConversionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Conversion extends Model
{
    use HasUuids;

    protected $fillable = [
        'batch_id', 'position', 'original_name', 'input_path', 'input_size', 'status',
        'output_path', 'output_name', 'output_size', 'meta', 'warnings', 'error',
        'started_at', 'finished_at',
    ];

    /**
     * IDs double as the only access key to a user's files, so use fully random
     * UUIDv4 instead of the time-ordered default.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }

    protected function casts(): array
    {
        return [
            'status' => ConversionStatus::class,
            'meta' => 'array',
            'warnings' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function extension(): string
    {
        return strtolower(pathinfo($this->original_name, PATHINFO_EXTENSION));
    }
}
