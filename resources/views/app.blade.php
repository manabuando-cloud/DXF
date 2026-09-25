<!DOCTYPE html>
<html lang="ja">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="DWG / DXF / JWW の図面をブラウザだけで印刷用PDF・DXFに一括変換。インストール不要、登録不要。">
        <meta name="theme-color" content="#05070d">
        <title>{{ config('app.name') }}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/main.tsx'])
    </head>
    <body class="min-h-dvh bg-void text-ink antialiased">
        <div id="app"></div>
        <noscript>このアプリを使うにはJavaScriptを有効にしてください。</noscript>
    </body>
</html>
