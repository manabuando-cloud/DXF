# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1. Native CAD tools: LibreDWG (dwg2dxf) and jww2jif (jwwlib)
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS native
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl xz-utils \
 && rm -rf /var/lib/apt/lists/*

ARG LIBREDWG_VERSION=0.13.3
RUN curl -fsSL "https://github.com/LibreDWG/libredwg/releases/download/${LIBREDWG_VERSION}/libredwg-${LIBREDWG_VERSION}.tar.xz" \
    | tar -xJ -C /tmp \
 && cd "/tmp/libredwg-${LIBREDWG_VERSION}" \
 && ./configure --disable-bindings --disable-docs --disable-shared --prefix=/opt/cad \
 && make -j"$(nproc)" \
 && make install \
 && strip /opt/cad/bin/dwg2dxf

COPY converter/native/jww2jif /src/jww2jif
RUN cd /src/jww2jif && CXX="g++ -static-libstdc++ -static-libgcc" ./build.sh \
 && install -m 755 jww2jif /opt/cad/bin/jww2jif \
 && strip /opt/cad/bin/jww2jif

# ---------------------------------------------------------------------------
# 2. Front-end assets
# ---------------------------------------------------------------------------
FROM node:22-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js tsconfig.json ./
COPY resources resources
COPY public public
RUN npm run build

# ---------------------------------------------------------------------------
# 3. PHP dependencies
# ---------------------------------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-scripts

# ---------------------------------------------------------------------------
# 4. Runtime: FrankenPHP + queue workers + scheduler
# ---------------------------------------------------------------------------
FROM dunglas/frankenphp:1-php8.4-bookworm

RUN install-php-extensions pdo_sqlite zip pcntl opcache intl \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv fonts-ipaexfont-gothic supervisor \
 && rm -rf /var/lib/apt/lists/*

COPY converter/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
 && rm /tmp/requirements.txt

COPY --from=native /opt/cad/bin/dwg2dxf /opt/cad/bin/jww2jif /usr/local/bin/
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/app.conf
COPY docker/entrypoint.sh /usr/local/bin/app-entrypoint

WORKDIR /app
COPY --from=vendor /app /app
COPY --from=assets /app/public/build /app/public/build

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/app/storage/database/database.sqlite \
    QUEUE_CONNECTION=database \
    CACHE_STORE=file \
    SESSION_DRIVER=file \
    CONVERTER_PYTHON=/opt/venv/bin/python \
    CADCONV_DWG2DXF=/usr/local/bin/dwg2dxf \
    CADCONV_JWW2JIF=/usr/local/bin/jww2jif \
    CADCONV_FONT=/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf \
    XDG_CACHE_HOME=/app/storage/framework/cache \
    SERVER_NAME=:8080

RUN chmod +x /usr/local/bin/app-entrypoint \
 && chown -R www-data:www-data /app/storage /app/bootstrap/cache

VOLUME /app/storage
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://127.0.0.1:8080/up || exit 1

ENTRYPOINT ["app-entrypoint"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
