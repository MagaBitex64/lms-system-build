"""Additive course folders: no existing content or permissions are rewritten."""
COURSE_SECTION_MIGRATIONS = [
    """CREATE TABLE IF NOT EXISTS course_sections (
        id BIGSERIAL PRIMARY KEY,
        course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
        position INTEGER NOT NULL DEFAULT 0,
        UNIQUE(id, course_id)
    )""",
    "ALTER TABLE course_items ADD COLUMN IF NOT EXISTS section_id BIGINT",
    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
            WHERE conname='course_items_section_course_fkey' AND conrelid='course_items'::regclass) THEN
            ALTER TABLE course_items ADD CONSTRAINT course_items_section_course_fkey
                FOREIGN KEY (section_id, course_id) REFERENCES course_sections(id, course_id)
                DEFERRABLE INITIALLY DEFERRED;
        END IF;
    END $$""",
    "CREATE INDEX IF NOT EXISTS idx_course_sections_order ON course_sections(course_id, position, id)",
    "CREATE INDEX IF NOT EXISTS idx_course_items_section ON course_items(course_id, section_id, position, id)",
]
