"""Idempotent database schema initialization for Phenomenon School LMS.

Run: python -m scripts.init_db  (from the backend/ directory)
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg

from core.config import DATABASE_URL

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('guest','student','teacher','admin')),
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);

CREATE TABLE IF NOT EXISTS courses (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    announcement TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_title ON courses USING gin (to_tsvector('simple', title || ' ' || description));

CREATE TABLE IF NOT EXISTS course_items (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('lesson','quiz','homework')),
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    sequential_unlock BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_course_pos ON course_items(course_id, position);

CREATE TABLE IF NOT EXISTS lessons (
    item_id BIGINT PRIMARY KEY REFERENCES course_items(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    youtube_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS lesson_materials (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL REFERENCES lessons(item_id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('file','link')),
    file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
    url TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_materials_lesson ON lesson_materials(lesson_id);

CREATE TABLE IF NOT EXISTS quizzes (
    item_id BIGINT PRIMARY KEY REFERENCES course_items(id) ON DELETE CASCADE,
    max_score INTEGER NOT NULL DEFAULT 100,
    weight_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    open_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    close_at TIMESTAMPTZ,
    time_limit_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(item_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('single','multiple','short_text','long_text')),
    prompt TEXT NOT NULL,
    image_file_id BIGINT REFERENCES files(id) ON DELETE SET NULL,
    explanation TEXT NOT NULL DEFAULT '',
    points INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON quiz_questions(quiz_id, position);

CREATE TABLE IF NOT EXISTS question_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_question ON question_options(question_id, position);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(item_id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    auto_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    manual_score NUMERIC(6,2),
    status TEXT NOT NULL DEFAULT 'graded' CHECK (status IN ('pending_review','graded')),
    UNIQUE (quiz_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id);

CREATE TABLE IF NOT EXISTS attempt_answers (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option_ids BIGINT[] NOT NULL DEFAULT '{}',
    text_answer TEXT NOT NULL DEFAULT '',
    awarded_points NUMERIC(6,2)
);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);

CREATE TABLE IF NOT EXISTS homework (
    item_id BIGINT PRIMARY KEY REFERENCES course_items(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    open_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    close_at TIMESTAMPTZ,
    max_score INTEGER NOT NULL DEFAULT 100,
    weight_pct NUMERIC(5,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS homework_submissions (
    id BIGSERIAL PRIMARY KEY,
    homework_id BIGINT NOT NULL REFERENCES homework(item_id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL DEFAULT '',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    grade NUMERIC(6,2),
    feedback TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded')),
    UNIQUE (homework_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON homework_submissions(student_id);

CREATE TABLE IF NOT EXISTS submission_files (
    submission_id BIGINT NOT NULL REFERENCES homework_submissions(id) ON DELETE CASCADE,
    file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (submission_id, file_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
"""

MIGRATIONS = [
    "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS open_at TIMESTAMPTZ",
    "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ",
    "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ",
    "ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER",
]


async def main() -> None:
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    try:
        await conn.execute(SCHEMA)
        for migration in MIGRATIONS:
            await conn.execute(migration)
        print("Schema initialized successfully.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
