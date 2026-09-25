<?php

use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\ConversionController;
use App\Http\Controllers\Api\StatusController;
use Illuminate\Support\Facades\Route;

Route::get('status', StatusController::class)->name('status');

Route::post('batches', [BatchController::class, 'store'])->middleware('throttle:uploads')->name('batches.store');
Route::get('batches/{batch}', [BatchController::class, 'show'])->name('batches.show');
Route::get('batches/{batch}/download', [BatchController::class, 'download'])->name('batches.download');
Route::delete('batches/{batch}', [BatchController::class, 'destroy'])->name('batches.destroy');

Route::get('conversions/{conversion}/download', [ConversionController::class, 'download'])->name('conversions.download');
