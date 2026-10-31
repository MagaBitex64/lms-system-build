"""Add an expiring per-attempt proctor capability without changing saved results."""
PROCTOR_MIGRATIONS = ["ALTER TABLE ent_trial_attempts ADD COLUMN IF NOT EXISTS proctor_lease_hash TEXT"]
