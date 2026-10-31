# Production backup and deployment handoff

Server team executes this document; no production commands were executed by Codex.
Deploy outside active examinations. A verified backup is mandatory before migration.

## Identify the target

On the server, inspect the running Compose project, its labels, working directory,
compose files and approved environment file. Do not assume a container name or
that the development compose file is production. Repository production template:
`docker-compose.production.yml`, services `db`, `backend`, `frontend` and proxy.
Confirm the actual running project matches it. Use the actual project name and
files if they differ. Verify database name/user via service configuration without
printing passwords. Confirm domain/HTTPS, current commit, image IDs, volumes and
upload storage. Record previous image tags/digests and commit before changing anything.

The following examples require operator-selected values, not invented server paths:

```bash
DC=(docker compose --project-name "$PROD_PROJECT" --env-file "$PROD_ENV_FILE" -f "$PROD_COMPOSE_FILE")
"${DC[@]}" ps
"${DC[@]}" exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(),current_user,version();"'
```

Do not continue until this target is positively confirmed by the server owner.

## Back up and validate

Choose a secure absolute backup directory outside the checkout. Avoid shared/public
folders. Use umask077 and unique filenames; never overwrite an earlier backup.

```bash
umask 077
test ! -e "$BACKUP_FILE"
"${DC[@]}" exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_FILE"
test -s "$BACKUP_FILE"
"${DC[@]}" exec -T db pg_restore --list < "$BACKUP_FILE" > "$BACKUP_FILE.list"
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
```

Check each exit status. A nonempty file alone is not proof of a usable backup.
Copy the dump and checksum to protected backup storage, encrypt according to team
policy, and separately back up uploads and required configuration/secrets securely.
Never commit these backups or secret files.

Restore a copy to a separately provisioned disposable PostgreSQL instance/database
using `pg_restore --exit-on-error --no-owner --no-acl` with explicitly confirmed test
host/database credentials. Never target the production database for this drill.
Verify tables, user/enrollment counts, sample historical results and application
read access in the restored environment. Record the successful restore check.

## Upgrade

Confirm maintenance window, previous version, approved release hash and rollback
images. Check clean server checkout; fetch main and integrate only with fast-forward
when appropriate. Verify checkout HEAD equals the approved commit supplied in the
release message. Do not discard server edits or pull an unreviewed newer commit.

Build frontend/backend together using the actual production Compose configuration.
Preserve DOMAIN, DATABASE_URL/JWT secret, existing mail configuration, Docker secrets,
volumes and proxy TLS settings. Do not seed, run down -v, or recreate the DB volume.

Migration procedure is `python -m scripts.init_db`, from `/app` inside the backend
container with the production backend environment/network. Existing backend
entrypoint performs it automatically before provisioning checks and Uvicorn.
A controlled migration-first stage may use:

```bash
"${DC[@]}" build backend frontend
"${DC[@]}" run --rm --no-deps --entrypoint python backend -m scripts.init_db
"${DC[@]}" up -d --no-deps backend frontend
```

Only run this after backup validation and confirming the real service names/network.
The migration adds nullable `proctor_lease_hash`; onboarding adds default-false
`must_change_password` and makes group direction optional. Journaling/advisory locks
make repeated init safe. Historical answers/scores are not rewritten.

## Smoke checks

Check Compose health and bounded backend/frontend logs (never publish credentials).
Backend `/health`, frontend `/login`, HTTPS public domain and API proxy must work.
Verify existing login/logout and profile; new temporary-password onboarding; groups,
direct/group enrollment and independent direct access; student courses/lesson/files;
topical import/submission; full UNT start/save/submit/result/admin review; refresh and
browser restart require screen/fullscreen/camera as configured. Compare historical
result samples before/after. Monitor errors during and after the window.

Active examinations are not promised uninterrupted: users may need reload and
proctor reactivation while their original deadline continues. Avoid rollout during
exams. Heartbeat/capability claims do not prove genuine screen capture.

## Rollback

Previous repository baseline: `281f1f57be5b72f68eece49f080baf9970a410d7` (verify the
actual server's known-good version; it may differ). Restore both frontend and
backend images together using recorded known-good image IDs/tags/configuration.
Use a separate clean checkout/worktree if necessary; never reset server edits.
Pause exams during rollback and verify auth, courses, submissions and historical
results afterward. Do not automatically drop additive columns or reverse migrations.
Older backend may restore the BUG-002 risk; consider keeping exams disabled until
reviewed. DB restoration is only for demonstrated corruption/loss with explicit
server-owner approval, acknowledging loss of writes since backup. Never restore
production automatically.
