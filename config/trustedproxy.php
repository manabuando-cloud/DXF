<?php

return [
    /*
     * Reverse proxies (e.g. Caddy on the Docker host) whose X-Forwarded-*
     * headers are believed. Needed so the app sees https:// and the real
     * client IP for rate limiting. Only list addresses you control: a
     * trusted proxy can claim any client IP.
     *
     * Default: loopback plus Docker's bridge networks (172.16.0.0/12).
     */
    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,::1,172.16.0.0/12'),
];
