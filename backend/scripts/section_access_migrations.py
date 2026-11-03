"""20261103: additive inherited section access; preserve every legacy item grant."""
SECTION_ACCESS_MIGRATIONS = [
    'ALTER TABLE course_items ADD COLUMN IF NOT EXISTS access_configured BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS access_restricted BOOLEAN NOT NULL DEFAULT false',
    *[f'''CREATE TABLE IF NOT EXISTS section_{target}_access (
        section_id BIGINT NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
        {target}_id BIGINT NOT NULL REFERENCES {table}(id) ON DELETE CASCADE,
        max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 100),
        deadline_at TIMESTAMPTZ,
        PRIMARY KEY(section_id,{target}_id))''' for target,table in [('student','users'),('group','groups')]],
    'CREATE INDEX IF NOT EXISTS section_student_access_student ON section_student_access(student_id,section_id)',
    'CREATE INDEX IF NOT EXISTS section_group_access_group ON section_group_access(group_id,section_id)',
]
