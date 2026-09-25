<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The app is public and anonymous, so uploads are limited per IP.
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(config('converter.rate_limit'))
            ->by($request->ip())
            ->response(fn () => response()->json([
                'message' => 'アップロードが集中しています。1分ほど待ってから再度お試しください。',
            ], 429)));
    }
}
