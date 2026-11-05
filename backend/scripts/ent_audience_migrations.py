"""Classify new grants without changing ambiguous historical global grants."""
ENT_AUDIENCE_MIGRATIONS = [
    "ALTER TABLE ent_trial_accesses ADD COLUMN IF NOT EXISTS audience_mode TEXT CHECK(audience_mode IN ('current_students','global'))",
]
