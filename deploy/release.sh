#!/bin/sh
set -eu
restore_id=''
gate_dir=''
gate_pid=''
release_gate() {
  if test -n "$gate_pid"; then
    printf '%s\n' 'ROLLBACK;' '\q' >&3 || true
    wait "$gate_pid" || true
    exec 3>&-
    gate_pid=''
  fi
}
cleanup() {
  release_gate
  if test -n "$gate_dir"; then rm -rf "$gate_dir"; fi
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

# Read-only classification: never-activated records are not running timers.
# Unknown/inconsistent records and unfinished untimed quizzes remain blockers.
check_exam_window() {
  active=$(dc_old exec -T db sh -c 'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' < deploy/exam-window.sql)
  test "$active" = 0 || { echo 'Active or ambiguous examinations detected; deployment stopped before service changes' >&2; exit 1; }
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
until docker exec "$restore_id" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do
  tries=$((tries + 1))
  test "$tries" -lt 30 || { echo 'Backup verification DB did not become ready' >&2; exit 1; }
  sleep 1
done
# --clean applies only to the disposable verifier, never to production.
docker exec "$restore_id" pg_restore --exit-on-error --clean --if-exists --no-owner --no-privileges \
  -h 127.0.0.1 -U postgres -d postgres /backup/database.dump
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
# Close the start/activation race using PostgreSQL table locks, including for
# the OLD backend which does not know about deployment gates. No row is changed.
# SHARE conflicts with INSERT/UPDATE, but allows read-only classification.
# Release only AFTER the old backend has stopped, so new initialization can run.
umask 077
gate_dir=$(mktemp -d)
mkfifo "$gate_dir/input"
exec 3<>"$gate_dir/input"
dc_old exec -T db sh -c 'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$gate_dir/input" > "$gate_dir/output" 2> "$gate_dir/error" &
gate_pid=$!
printf '%s\n' 'BEGIN;' "SET LOCAL lock_timeout='3s';" 'LOCK TABLE ent_trial_attempts, quiz_starts IN SHARE MODE;' '\echo EXAM_GATE_READY' >&3
tries=0
until grep -q '^EXAM_GATE_READY$' "$gate_dir/output"; do
  kill -0 "$gate_pid" 2>/dev/null || { echo 'Exam activation lock failed; refusing deployment' >&2; exit 1; }
  tries=$((tries+1))
  test "$tries" -lt 10 || { echo 'Exam activation lock timed out; refusing deployment' >&2; exit 1; }
  sleep 1
done
check_exam_window
kill -0 "$gate_pid" 2>/dev/null || exit 1
rollout() {
  dc_new up -d --no-build backend frontend > "$gate_dir/rollout" 2>&1 &
  rollout_pid=$!
  tries=0
  while test "$(docker inspect --format '{{.State.Running}}' "$backend_id" 2>/dev/null || true)" = true; do
    kill -0 "$gate_pid" 2>/dev/null || { kill "$rollout_pid" 2>/dev/null || true; wait "$rollout_pid" || true; return 1; }
    kill -0 "$rollout_pid" 2>/dev/null || { wait "$rollout_pid"; return 1; }
    tries=$((tries+1))
    if test "$tries" -ge 60; then kill "$rollout_pid" 2>/dev/null || true; wait "$rollout_pid" || true; return 1; fi
    sleep 1
  done
  release_gate
  wait "$rollout_pid" || return 1
  dc_new up -d --no-build --wait --wait-timeout 120 backend frontend
}
if ! rollout; then
  release_gate
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
