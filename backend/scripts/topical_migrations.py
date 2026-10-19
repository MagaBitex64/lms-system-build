"""Additive, journaled migration: no attempts/results/permissions are removed or reset."""
TOPICAL_MIGRATIONS = [
    "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'legacy' CHECK(scoring_mode IN ('legacy','points'))",
    "ALTER TABLE quiz_starts ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1 CHECK(attempt_number>0)",
    "ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1 CHECK(attempt_number>0)",
    "ALTER TABLE quiz_starts ADD COLUMN IF NOT EXISTS max_score_snapshot INTEGER",
    "ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS max_score_snapshot INTEGER",
    "ALTER TABLE quiz_starts DROP CONSTRAINT IF EXISTS quiz_starts_pkey",
    "ALTER TABLE quiz_starts ADD PRIMARY KEY(quiz_id,student_id,attempt_number)",
    "ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_quiz_id_student_id_key",
    "CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempt_number_unique ON quiz_attempts(quiz_id,student_id,attempt_number)",
    "ALTER TABLE quiz_attempts ALTER COLUMN auto_score TYPE NUMERIC(12,2), ALTER COLUMN manual_score TYPE NUMERIC(12,2)",
    "ALTER TABLE item_group_access ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts>0)",
    "ALTER TABLE item_group_access ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ",
    "ALTER TABLE item_student_access ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts>0)",
    "ALTER TABLE item_student_access ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ",
    """CREATE TABLE IF NOT EXISTS quiz_import_batches(
        quiz_id BIGINT NOT NULL REFERENCES quizzes(item_id) ON DELETE CASCADE,
        content_hash TEXT NOT NULL, imported_count INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY(quiz_id,content_hash))""",
    # Only quizzes without any started/historical attempts adopt the new points scale.
    # Existing schedules and weights are retained, not reset or copied into permissions.
    """UPDATE quizzes q SET scoring_mode='points' FROM course_items ci
        WHERE ci.id=q.item_id AND ci.type='quiz'
        AND NOT EXISTS(SELECT 1 FROM quiz_starts s WHERE s.quiz_id=q.item_id)
        AND NOT EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.quiz_id=q.item_id)""",
    """CREATE OR REPLACE FUNCTION protect_quiz_scoring_mode() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.scoring_mode IS DISTINCT FROM OLD.scoring_mode AND
               (EXISTS(SELECT 1 FROM quiz_starts WHERE quiz_id=NEW.item_id) OR
                EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=NEW.item_id)) THEN
                RAISE EXCEPTION 'Quiz has started attempts' USING ERRCODE='55000';
            END IF;
            RETURN NEW;
        END $$""",
    "DROP TRIGGER IF EXISTS protect_quiz_scoring_mode ON quizzes",
    "CREATE TRIGGER protect_quiz_scoring_mode BEFORE UPDATE OF scoring_mode ON quizzes FOR EACH ROW EXECUTE FUNCTION protect_quiz_scoring_mode()",
]
