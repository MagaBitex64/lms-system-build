#!/bin/sh
set -eu
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT HUP INT TERM

cd /opt/lms/app
: "${BACKUP_DIR:?BACKUP_DIR is required}"
case "$BACKUP_DIR" in /*) ;; *) echo 'BACKUP_DIR must be absolute' >&2; exit 1;; esac
test -s .env || { echo 'Missing /opt/lms/app/.env; refusing deployment' >&2; exit 1; }
test -s .deploy.env || { echo 'Missing deployment image configuration' >&2; exit 1; }

dc_old() { docker compose -p app --env-file .env -f docker-compose.yml "$@"; }
dc_new() { docker compose -p app --env-file .env --env-file .deploy.env -f docker-compose.deploy.yml "$@"; }

backend_id=$(dc_old ps -q backend)
frontend_id=$(dc_old ps -q frontend)
db_id=$(dc_old ps -q db)
test -n "$backend_id" && test -n "$frontend_id" && test -n "$db_id" || {
  echo 'Expected existing backend, frontend, and database containers; refusing first-time takeover' >&2
  exit 1
}
test -d ./backend/uploads || { echo 'Missing uploads directory; refusing deployment' >&2; exit 1; }
old_backend=$(docker inspect --format '{{.Config.Image}}' "$backend_id")
old_frontend=$(docker inspect --format '{{.Config.Image}}' "$frontend_id")
old_api=$(docker exec "$frontend_id" printenv NEXT_PUBLIC_API_BASE_URL 2>/dev/null || true)

umask 077
mkdir -p "$BACKUP_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$BACKUP_DIR/$stamp"
mkdir "$backup"
dc_old exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
tar -C ./backend/uploads -czf "$backup/uploads.tar.gz" .
docker inspect --format '{{.Config.Image}} {{.Image}}' "$backend_id" "$frontend_id" > "$backup/previous-images.txt"
cp .env "$backup/environment.private"
(cd "$backup" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)

cat > .rollback.env <<EOF
BACKEND_IMAGE=$old_backend
FRONTEND_IMAGE=$old_frontend
NEXT_PUBLIC_API_BASE_URL=$old_api
EOF

dc_new pull backend frontend
if ! dc_new up -d --no-build --wait --wait-timeout 120 backend frontend; then
  echo 'New containers failed health checks; restoring previous images' >&2
  dc_new --env-file .rollback.env up -d --no-build --wait --wait-timeout 120 backend frontend || true
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8000/health >/dev/null || \
   ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3001/login >/dev/null; then
  echo 'Post-deploy local probes failed; restoring previous images' >&2
  dc_new --env-file .rollback.env up -d --no-build --wait --wait-timeout 120 backend frontend || true
  exit 1
fi

rm -f .rollback.env
echo "Deployment healthy: $stamp; backup: $backup"
