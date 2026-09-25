# CAD Convert — notes for Claude

Public, anonymous web app that batch-converts DWG / DXF / JWW drawings to PDF or DXF.
The user (MANABU, Kurashiki Laser) prefers Japanese, short conclusions first, numbered steps.

## Layout

- Laravel 13 API + queue: `app/`, `routes/api.php`, `config/converter.php`
- React 19 + TypeScript + Tailwind v4 SPA: `resources/js/` (entry `main.tsx`, mounted by `resources/views/app.blade.php`)
- Conversion engine (Python): `converter/cadconv/`, called as `python -m cadconv` by `App\Services\DrawingConverter`
- JWW reader (C++, jwwlib): `converter/native/jww2jif/` — `build.sh` fetches jwwlib at a pinned LibreCAD commit

## Commands

```bash
php artisan test                        # API tests (converter is faked)
vendor/bin/pint                         # PHP formatting
npx tsc -p . && npm run build           # front-end type-check + build
(cd converter && python -m pytest -q)   # converter tests
converter/native/jww2jif/build.sh       # build jww2jif (TARGET=windows for .exe via mingw)
php artisan serve & php artisan queue:work
```

## Gotchas

- Parse converter stdout with `/\r?\n/`, not `/\R/`: without the `u` flag `\R` matches byte 0x85, which occurs inside UTF-8 Japanese text.
- php-fpm / `artisan serve` strip `PATH`; `DrawingConverter::environment()` re-adds it so `dwg2dxf` / `jww2jif` are found.
- LibreDWG output can contain `5 / 0` handle tags that ezdxf rejects even in recover mode — `dwg.strip_null_handles()` removes them.
- JWW text is raw Shift-JIS; JW_CAD print settings (`Printer_Orientation = 0`) appear as TEXT far from the drawing and must be filtered.
- Playwright drops non-ASCII file paths in `setInputFiles`; pass `{name, buffer}` objects and run with `LANG=C.UTF-8`.
- Behind a reverse proxy: API returns relative download URLs, and `config/trustedproxy.php` (`TRUSTED_PROXIES`) decides whose `X-Forwarded-*` headers count — the upload rate limit depends on it.
