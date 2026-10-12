# Production runbook

## Before opening access

Use `docker-compose.production.yml` as a standalone file, not as an override of
the development Compose. It publishes only 80/443. Backend, frontend and DB have
no public ports. Frontend receives no database/JWT/mail secrets. Caddy obtains
HTTPS certificates after DNS points to the server and 80/443 are reachable.

On the server, create secrets without posting them in chat or terminal logs:

```sh
sh deploy/prepare-env.sh school.your-domain.kz ops@your-domain.kz
# Edit .env.production privately to add the Brevo key/sender.
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d --wait
```

Never seed demo users/questions in production. Before startup, securely copy the
prepared `.secrets/production_admin_password` file to the same path on the server
(directory mode 700, file mode 600). This ignored file is a Docker secret and must
not be committed or printed. The backend creates the sole administrator
`nurdildanurasyl7@gmail.com` automatically on first production startup. Existing
other administrator records are retained, demoted to teacher and blocked; their
sessions are invalidated. The selected account is promoted/unblocked if it exists.
A transaction/advisory lock and unique index prevent concurrent duplicate admins.
Later restarts verify the bootstrap record and never reset a changed password.
The secret can be emptied after first provisioning, but the mounted file must
still exist for Compose. Administrator creation/promotion and changing the sole
admin email are rejected through the production API. Interactive `create_admin`
is for development only. Verify mail/reset using an owned account. Change
NEXT_PUBLIC_API_BASE_URL by rebuilding frontend, never merely changing runtime
environment. APP_ENV=production rejects default JWT/DB credentials and HTTP URLs.

Check resource availability before choosing server limits: CPU, RAM, disk and
expected growth of snapshots/uploads. Run mixed 200-user traffic through HTTPS,
including login, quiz autosave, ENT heartbeat, start and simultaneous expiry.
Readiness `/api/health` must be 200; DB outage must make it 503. Monitor 5xx/429,
p95 latency, CPU/RAM, DB connections, free disk and backup freshness. Logs rotate;
proxy access logs omit query strings and Uvicorn access logs are disabled.

Application and proxy limits are complementary. API JSON bodies are capped at
2 MB; upload bodies at 26 MB before multipart parsing and after authentication.
Each stored file remains limited to 25 MB. Account quota defaults to 200 files /
500 MB. Public leads/reset/login are rate-limited in PostgreSQL across workers.
The proxy allows a cohort burst, while per-account login throttling prevents
repeated guesses. Rate-limited users receive 429 and Retry-After. Review values
for the actual school's shared IP before opening access.

The forwarded-IP trust is valid only while backend remains private and the
gateway is the sole ingress. Do not publish backend ports or use this trust
setting in the development Compose.

## Backup and rollback

Back up DB **and uploads** to an off-server mounted destination:

```sh
sh deploy/backup.sh /mnt/secure-off-server-backups/fenomen
sh deploy/restore-check.sh /mnt/secure-off-server-backups/fenomen/TIMESTAMP
```

The backup includes environment.private for recovery: restrict access, encrypt
the destination and never commit it. Uploads are retained when links are removed;
this makes dump-first/file-archive-second coherent under normal API writes. Do
not run file garbage collection concurrently with backup. A database restore is
tested in an isolated container, never over the live database. For a full drill,
also verify that every files.stored_name from the restored DB exists in the
restored archive and download representative quiz/ENT images.

Schedule backup execution and alert on missing/failed backups on the actual
server. Backup scripts are not proof that the target off-server storage exists.
Store release image digests plus source revision before updates. Revert the app
to the previous image only when compatible with the current schema. Restore old
data only as a separate planned operation: it loses writes made since backup.
Never run `docker compose down -v` on production.

Migrations use one transaction, an advisory deployment lock and a journal;
unexpected errors abort startup. Legacy conversion does not alter modern
pending snapshots. Existing attempts previously changed by the old migration
must be reviewed, not blindly reset:

```sql
SELECT id,student_id,started_at,activated_at,deadline_at,proctor_status
FROM ent_trial_attempts
WHERE snapshot IS NOT NULL AND snapshot->>'version' <> 'legacy'
  AND proctor_status='legacy';
```

Run that read-only query after backup; actual activation cannot always be inferred
from the old data. This release does not automatically rewrite those attempts.

## Product boundaries

Browser proctoring is advisory client telemetry, with no recorded/server-streamed
video. It is not a secure exam client. Events do not automatically terminate an
attempt; absence is shown separately. Questions/images are withheld until the
server starts the timer. Use desktop browsers with screen sharing/fullscreen;
mobile support must be separately validated before it is promised.

Homework resubmission clears the old grade/feedback and requires another review.
Started LMS quizzes freeze question/settings edits. Timed quizzes autosave and
complete server-side, including when the browser is closed. Deletion of entities
with history is rejected by database constraints; block users/unpublish courses.
Shared uploaded files are retained; cleanup requires checking live references
including ENT JSON snapshots. No automatic deletion of educational history is
enabled. Monitor size and choose a retention policy with the owner before any
historical-data purge.

## Checks still requiring server access

DNS/TLS, trusted proxy addresses, firewall, external reset email, actual server
load/soak, scheduled off-server backups, restore/download drill and release
rollback. Local tests do not establish these as passed.
