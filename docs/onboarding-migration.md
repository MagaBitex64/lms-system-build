# Account onboarding migration (2026-10-31)

`backend/scripts/onboarding_migrations.py` is applied transactionally and journaled by
`python -m scripts.init_db` through the existing backend entrypoint. Back up the
database before deployment; rebuild frontend/backend together. No seed is needed.
No production migration was executed during implementation.

Adds `users.must_change_password NOT NULL DEFAULT FALSE` without changing existing
hashes, memberships or results. Makes historical `groups.direction` nullable;
existing direction/stream values remain intact. Group edits omit both fields.

New admin-created accounts receive a backend-generated 192-bit temporary password,
returned only in the creation response. Closing the dialog discards the frontend
value. Recovery uses the existing email reset workflow; no password email is sent
automatically. Temporary credentials do not expire independently. Login/setup have
existing database-backed rate limiting. All protected APIs check the database flag.
Setup locks the user row, increments auth_version and invalidates reset links.
Bearer authorization (not cookies) preserves the current CSRF architecture.

Personal setup passwords support Unicode and long passphrases (12–1024 characters).
Versioned SHA-256/base64 + existing bcrypt prevents bcrypt's 72-byte truncation;
legacy unprefixed bcrypt hashes remain valid. Common-password checks use a small
local denylist; no compromised-password provider is configured. Existing email
reset password limits remain unchanged. Production HTTPS is provided by the
existing reverse proxy; keep that configuration in place.

## Changed files

- `backend/scripts/onboarding_migrations.py`
- `backend/tests/test_onboarding.py`
- `docs/onboarding-migration.md`
- `frontend/app/auth/setup-password/page.tsx`
- `frontend/public/favicon.ico`
- `backend/core/deps.py`
- `backend/core/security.py`
- `backend/routers/admin.py`
- `backend/routers/auth.py`
- `backend/scripts/init_db.py`
- `backend/tests/test_release.py`
- `frontend/app/admin/page.tsx`
- `frontend/app/components/app-shell.tsx`
- `frontend/app/layout.tsx`
- `frontend/app/login/page.tsx`
- `frontend/lib/auth.tsx`
- `frontend/lib/group-form.ts`
- `frontend/tests/group-form.cjs`
