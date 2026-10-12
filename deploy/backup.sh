#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
destination=${1:?Usage: sh deploy/backup.sh /absolute/off-server-mounted/backup-directory}
case "$destination" in /*) ;; *) echo 'An absolute backup directory is required' >&2; exit 1;; esac
umask 077
mkdir -p "$destination"
archive="$destination/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$archive"
dc() { docker compose --env-file .env.production -f docker-compose.production.yml "$@"; }
# Files are immutable after successful upload. Dump DB first, then files, so
# every committed DB file reference is present in the later uploads archive.
dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$archive/database.dump"
dc exec -T backend tar -C /app/uploads -czf - . > "$archive/uploads.tar.gz"
dc images > "$archive/images.txt"
cp .env.production "$archive/environment.private"
(cd "$archive" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
echo "Backup completed: $archive"
