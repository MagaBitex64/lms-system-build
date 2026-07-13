#!/bin/sh
set -e

# Apply any pending database migrations
python -m scripts.init_db

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port 8000