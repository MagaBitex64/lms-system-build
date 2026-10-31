# Fenomen LMS release handoff

Target repository: https://github.com/MagaBitex64/lms-system-build — branch main.
Baseline: 281f1f57be5b72f68eece49f080baf9970a410d7. Release commit: use the exact
hash in the final release message, then verify `git rev-parse HEAD`; do not deploy
an arbitrary newer main. No production deployment has been performed.

Completed source: temporary password onboarding; group form simplification;
automatic course-subject inheritance/settings; official favicon; BUG-001 mobile
folder headers; BUG-002 expiring/rotating per-attempt proctor capabilities. Course
folders/enrollments already exist in the baseline and remain regression-covered.

Migrations: backend/scripts/onboarding_migrations.py and proctor_migrations.py via
scripts/init_db.py. Other existing section/enrollment migrations remain journaled.
Back up and restore-test PostgreSQL/uploads before upgrade. Deploy frontend/backend
together; old clients fail closed on exam writes and must reload/reactivate.

Procedure, health checks, rollback and security requirements:
[PRODUCTION_BACKUP_AND_DEPLOYMENT.md](PRODUCTION_BACKUP_AND_DEPLOYMENT.md).
Known limitations: browser claims are not capture attestation; disconnect lease
window45 seconds; physical media/TLS/email/provider behavior and unsupported UNT
Word export remain outside completed browser coverage. Consult retained audit
reports for exact scenarios, fixed status and limitations.

Release gate: verify push-trigger automation before publishing main. No tracked
GitHub Actions workflows were found; repository hooks API was not visible (404),
so external deployment automation cannot be ruled out from this environment.

## Fresh pre-publication verification

- TypeScript: PASS; frontend40 passed,0 failed.
- Full backend unittest discovery:97 passed,0 failed,0 skipped,0 errors.
- Browser regression BUG-001:9 passed; BUG-002:22 passed,0 failed.
- Production frontend/backend builds:PASS; git diff --check:PASS.
- Twice repeated isolated init_db preserved10 synthetic attempts, snapshots,
  responses, scores and deadlines; proctor_lease_hash is nullable.
- Credential-pattern scan: no private-key/GitHub-token/AWS-key findings. Tracked
  env files are templates only. Disposable credentials/screenshots are excluded.
- Push remains gated on owner confirmation of no external main-push deployment;
  GitHub hooks API404 prevented verification. GitHub CLI is not installed.
