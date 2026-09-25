<?php

namespace App\Console\Commands;

use App\Models\Batch;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('conversions:prune')]
#[Description('Delete expired conversion batches and their files')]
class PruneConversions extends Command
{
    public function handle(): int
    {
        $count = 0;
        Batch::where('expires_at', '<', now())->each(function (Batch $batch) use (&$count) {
            $batch->delete();
            $count++;
        });

        $this->info("Pruned $count expired batch(es).");

        return self::SUCCESS;
    }
}
