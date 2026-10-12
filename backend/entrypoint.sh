#!/bin/sh
set -e

# Apply any pending database migrations
python -m scripts.init_db
python -m scripts.bootstrap_admin

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port 8000 --no-access-log --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"
