#!/bin/sh
set -eu
restore_id=''
cleanup() {
  if test -n "$restore_id"; then docker rm -f "$restore_id" >/dev/null 2>&1 || true; fi
  docker logout ghcr.io >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

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

# Refuse to interrupt running UNT or topical tests. Fail closed if SQL fails.
check_exam_window() {
  active=$(dc_old exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' sh "
    SELECT (SELECT count(*) FROM ent_trial_attempts
      WHERE status='in_progress' AND (deadline_at IS NULL OR deadline_at>now()))
    + (SELECT count(*) FROM quiz_starts s
      WHERE (s.deadline_at IS NULL OR s.deadline_at>now())
      AND NOT EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.quiz_id=s.quiz_id
        AND a.student_id=s.student_id AND a.attempt_number=s.attempt_number));")
  test "$active" = 0 || { echo 'Active examinations detected; deployment stopped before service changes' >&2; exit 1; }
}
check_exam_window

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

# Verify archives and actually restore the dump in an isolated, temporary DB.
# This container has no network/host ports and never mounts production data.
(cd "$backup" && sha256sum -c SHA256SUMS)
gzip -t "$backup/uploads.tar.gz"
tar -tzf "$backup/uploads.tar.gz" >/dev/null
db_image=$(docker inspect --format '{{.Config.Image}}' "$db_id")
restore_id=$(docker run -d --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  --mount "type=bind,src=$backup/database.dump,dst=/backup/database.dump,readonly" "$db_image")
tries=0
until docker exec "$restore_id" pg_isready -U postgres >/dev/null 2>&1; do
  tries=$((tries + 1))
  test "$tries" -lt 30 || { echo 'Backup verification DB did not become ready' >&2; exit 1; }
  sleep 1
done
# --clean applies only to the disposable verifier, never to production.
docker exec "$restore_id" pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges \
  -U postgres -d postgres /backup/database.dump
docker rm -f "$restore_id" >/dev/null
restore_id=''
echo 'Backup restore verification succeeded'

cat > .rollback.env <<EOF
BACKEND_IMAGE=$old_backend
FRONTEND_IMAGE=$old_frontend
NEXT_PUBLIC_API_BASE_URL=$old_api
EOF

dc_new pull backend frontend
check_exam_window
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
