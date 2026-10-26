"""Preserve unknown historical access; explicitly track all future access sources."""
ENROLLMENT_MIGRATIONS = [
    # NULL means legacy provenance is unknown, not that direct access is absent.
    "ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS direct_enrollment BOOLEAN",
    "ALTER TABLE enrollments ALTER COLUMN direct_enrollment SET DEFAULT TRUE",
]
