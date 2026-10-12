#!/bin/sh
set -eu
archive=${1:?Usage: sh deploy/restore-check.sh /absolute/backup-path}
test -f "$archive/database.dump"
test -f "$archive/uploads.tar.gz"
(cd "$archive" && sha256sum -c SHA256SUMS)
name="fenomen-restore-check-$$"
secret=$(openssl rand -hex 32)
db_files=$(mktemp)
archive_files=$(mktemp)
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$db_files" "$archive_files"; }
trap cleanup EXIT INT TERM
docker run -d --name "$name" --tmpfs /var/lib/postgresql/data -e "POSTGRES_PASSWORD=$secret" postgres:15-alpine >/dev/null
attempt=0
until docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; do
    attempt=$((attempt+1)); test "$attempt" -lt 30; sleep 1
done
docker exec -i "$name" pg_restore -U postgres -d postgres --no-owner --no-privileges --exit-on-error < "$archive/database.dump"
docker exec "$name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS users FROM users; SELECT count(*) AS attempts FROM ent_trial_attempts;'
tar -tzf "$archive/uploads.tar.gz" >/dev/null
docker exec "$name" psql -U postgres -d postgres -At -c 'SELECT stored_name FROM files' > "$db_files"
tar -tzf "$archive/uploads.tar.gz" | sed 's#^\./##' > "$archive_files"
while IFS= read -r stored_file; do
    grep -Fx -- "$stored_file" "$archive_files" >/dev/null || { echo "Missing stored file: $stored_file" >&2; exit 1; }
done < "$db_files"
echo 'Database restore, archive integrity and every referenced file passed on a disposable instance.'
