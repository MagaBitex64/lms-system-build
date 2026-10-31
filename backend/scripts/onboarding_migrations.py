"""2026-10-31: additive onboarding; existing accounts and hashes are untouched."""
ONBOARDING_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE groups ALTER COLUMN direction DROP NOT NULL",
]
