# Topical quiz import, scoring and assigned access

Scope: standalone course items of type `quiz`. Lesson-attached quizzes retain
their settings and one-attempt behavior; full UNT configuration is untouched.

## Word and answer editing

`<question>`, `<variant>` and `<variant_correct>` remain supported. Zero marked
answers imports a draft; all option `is_correct` flags stay false (explicitly
stored in the existing model). Multiple marked options infer `multiple`.
Missing keys produce warnings, not parsing errors. Invalid markup, empty text
or options and unsupported image structures remain errors. Preview reports
counts and errors, and the server independently revalidates confirmation.

Readiness is derived from question text, points, options and valid answer keys.
Drafts cannot start scored attempts. Teachers/administrators can save single or
multiple correct options before anyone starts. Once started, existing database
guards prevent question/key/settings changes that could invalidate results.

Confirmed imports are serialized and fingerprinted per quiz. Repeating the same
file does not duplicate questions. Files imported before this migration have no
fingerprints and cannot be retroactively deduplicated reliably. A changed file
is a new import; the existing import appends rather than replaces questions.

## Score and history compatibility

New topical tests use the sum of existing per-question points as their maximum.
The removed global inputs do not reset stored weights or schedules. The legacy
default weight remains zero; existing weights retain their gradebook effect.

Migration converts only topical quizzes with no starts or submissions to the
points scale. Already started/completed quizzes retain `legacy` scaling and
their stored maximum. Each new start freezes `max_score_snapshot`; submission
and manual grading use that value. Old rows fall back to the preserved legacy
maximum. Historical scores, IDs, answers and timestamps are not rewritten.
Gradebook uses the best normalized completed attempt, breaking ties by latest
submission. All attempts remain individually available for teacher review and
student score history; optional `attempt_number` selects a prior completed
result through the quiz detail endpoint.

## Assigned permissions and timers

Existing group/student grant tables gain `max_attempts` (default 1) and nullable
`deadline_at`. Existing grants therefore retain their previous one-attempt,
no-assignment-deadline behavior. Existing global schedules still apply.

No documented override rule previously existed for overlapping grants. The
explicit conservative policy is intersection: smallest attempt budget and
earliest non-null deadline across linked-course groups and individual grants.
Budgets are never summed; all attempts count against one quiz/student history.
Changing/removing a grant does not reset consumed attempts. Mixed grant values
are preserved unless the teacher explicitly edits the shared rule fields.

Attempt limits accept integers 1–100. New/changed deadlines must include a
timezone and be in the future; the UI converts local input to UTC. An unchanged
expired grant may be saved without silently replacing its deadline.

Server transactions serialize starts, allocate attempt numbers and reject
unauthorized, exhausted or expired starts. Refresh resumes an unfinished attempt
without consuming another. Concurrent starts cannot allocate duplicate extra
attempts; stale-tab saves/submissions get 409 instead of changing a newer attempt.

A new attempt freezes the earliest of duration, assignment deadline and legacy
close time. Editing grants never silently shortens/extends an already running
timer. At expiry the existing worker/request finalization grades only previously
saved answers. Late answers cannot be added. Saved-response revision/replay
protection remains in place.

## Migration / rollout safety

`backend/scripts/topical_migrations.py` is applied by the normal `init_db`
hash-journaled migration runner. It adds fields and an import journal, expands
score precision, and changes uniqueness from one row per quiz/student to one
row per numbered attempt. It does not delete/reset records or grants.

Before applying to a real database: take and verify a backup, stop incompatible
old writers, apply the normal initialization/migration once, then run matching
backend and frontend code. Do not run the new code against an unmigrated schema.
Do not roll back by dropping multi-attempt data; restore an approved backup or
write a forward compatibility migration instead.

The implementation was first verified against a disposable PostgreSQL
schema/database, including an actual old-schema upgrade fixture. On 2026-10-18,
the local development database was backed up and migrated, and localhost:3001
was rebuilt/restarted at the user's follow-up request. No remote deployment was
performed. Existing grant/history fingerprints matched before and after migration.

## Verification

`RUN_RELEASE_TESTS=1` against an isolated `auditdb` host:
`python -m unittest tests.test_ent_rules tests.test_quiz_docx
tests.test_ent_integration tests.test_ent_seed tests.test_release
tests.test_topical_quiz -v`.

The topical module covers draft/mixed/multi-key imports, malformed documents,
table order, deduplication, persisted manual keys, readiness, settings, point
totals, manual grading, 1/2/3 attempt budgets, concurrent starts, stale saves,
individual/group deadlines, overlapping grants, expiry and historical migration.
Frontend checks: TypeScript and production build. Browser QA uses disposable
teacher/student fixtures, never actual learner records.

Executed on 2026-10-18: all 56 tests passed (55.236s); TypeScript,
production build and `git diff --check` passed. Browser checks confirmed
automatic draft Word preview/import, manual answer selection persisting after
reload, grant fields, scoring, two attempts, exhausted state and score history.
Student result layout checked at 1440×900 and 390×844 without page overflow or
browser console warnings/errors. These checks preceded local activation; local
backend/frontend containers were subsequently rebuilt and restarted with a backup.

## Changed files

- `backend/core/quiz_attempts.py`
- `backend/core/topical_quiz.py`
- `backend/routers/quizzes.py`
- `backend/routers/courses.py`
- `backend/routers/grades.py`
- `backend/scripts/init_db.py`
- `backend/scripts/topical_migrations.py`
- `backend/tests/test_topical_quiz.py`
- `frontend/app/items/[id]/page.tsx`
- `frontend/app/courses/[id]/page.tsx`
- `docs/topical-tests.md`
