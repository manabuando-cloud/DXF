<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Batch extends Model
{
    use HasUuids;

    protected $fillable = ['target', 'options', 'expires_at'];

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
            'options' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    public function conversions(): HasMany
    {
        return $this->hasMany(Conversion::class)->orderBy('position');
    }

    public function directory(): string
    {
        return 'conversions/'.$this->id;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isFinished(): bool
    {
        return $this->conversions->every(fn (Conversion $c) => $c->status->isFinished());
    }

    protected static function booted(): void
    {
        // Uploaded drawings and results never outlive their batch row.
        static::deleting(function (Batch $batch) {
            Storage::disk(config('converter.disk'))->deleteDirectory($batch->directory());
        });
    }
}
