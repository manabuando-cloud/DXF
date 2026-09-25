<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('target', 8);
            $table->json('options')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });

        Schema::create('conversions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('batch_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('original_name');
            $table->string('input_path');
            $table->unsignedBigInteger('input_size')->default(0);
            $table->string('status', 16)->default('queued')->index();
            $table->string('output_path')->nullable();
            $table->string('output_name')->nullable();
            $table->unsignedBigInteger('output_size')->nullable();
            $table->json('meta')->nullable();
            $table->json('warnings')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversions');
        Schema::dropIfExists('batches');
    }
};
