<?php

namespace App\Enums;

enum ConversionStatus: string
{
    case Queued = 'queued';
    case Processing = 'processing';
    case Done = 'done';
    case Failed = 'failed';

    public function isFinished(): bool
    {
        return $this === self::Done || $this === self::Failed;
    }
}
