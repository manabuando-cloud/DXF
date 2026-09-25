#!/bin/sh
set -e
cd /app

mkdir -p storage/app/private storage/database storage/logs \
         storage/framework/cache storage/framework/sessions storage/framework/views

# Generate an APP_KEY once and keep it on the storage volume.
if [ -z "$APP_KEY" ]; then
    if [ ! -s storage/app.key ]; then
        php -r 'echo "base64:".base64_encode(random_bytes(32));' > storage/app.key
    fi
    export APP_KEY="$(cat storage/app.key)"
fi

[ -f "$DB_DATABASE" ] || touch "$DB_DATABASE"
chown -R www-data:www-data storage bootstrap/cache

export QUEUE_WORKERS="${QUEUE_WORKERS:-2}"

su -s /bin/sh www-data -c "php artisan migrate --force --no-interaction" 
su -s /bin/sh www-data -c "php artisan optimize"

exec "$@"
