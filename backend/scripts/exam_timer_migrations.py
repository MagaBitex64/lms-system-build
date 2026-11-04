"""Add finalization metadata only; never relabel historical results."""
EXAM_TIMER_MIGRATIONS = [
    "ALTER TABLE ent_trial_attempts ADD COLUMN IF NOT EXISTS completion_reason TEXT CHECK(completion_reason IN ('submitted','expired'))",
    "ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS completion_reason TEXT CHECK(completion_reason IN ('submitted','expired'))",
]
