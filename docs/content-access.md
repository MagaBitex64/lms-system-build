# Material and section access (2026-11-03)

## Staff workflow

Administrators manage every course; teachers manage only their own courses under
existing `ensure_course_owner` authorization. No new delegated role is introduced.
Open a material's menu → **Тақырыпқа қолжетімділік**, or a folder's menu →
**Бөлімге қолжетімділік**. Both use the same Students / Groups selector.
Students are approved course enrollees, including students without groups; groups
are linked course groups. Search, direct selections, group membership and the
effective test limit are shown. Selecting a folder target enables its explicit
restriction; saving a newly restricted folder or removing grants requires confirmation.
Enrollment is managed separately through the modal's course-enrollment link.

## Precedence

1. Published course + approved enrollment are required for student material access.
2. Material visibility and sequential prerequisites remain mandatory.
3. A legacy/unrestricted section (`access_restricted=false`) adds no gate. The
   existing manual material grants still decide access; absence of grants keeps
   the original closed behavior. Migration never opens old materials.
4. A restricted section requires a direct section grant OR membership in a granted
   group still linked to the course. If the material has explicit grants or its
   access was explicitly saved (`access_configured=true`), it ALSO requires a valid
   material grant. Empty explicitly saved material policy is deny-all. Removing
   the final material grant must never silently reopen the item by inheritance.
5. A new, otherwise unconfigured material in a restricted section inherits the
   section grant. Moving the material evaluates the destination section immediately.
6. Direct and group grants are independent. Removing one does not delete the other.
   Section updates never write to material grants, enrollments, membership or results.
7. For topical tests, all applicable material and active-section grants intersect:
   lowest maximum attempt count, earliest non-null deadline. Limits are not summed.
   A new grant defaults to one attempt and no extra deadline; existing per-target
   rules survive unchanged unless the staff member edits the shared rules fields.
   Existing frozen attempt deadlines, visibility, readiness, quiz schedules, attempt
   numbering and scoring are unchanged. No ENT variant permissions or proctor
   controls are modified. Homework retains its independent submission rules.

The same SQL predicate is used in course listing, direct item checks, search,
sequential prerequisites and current grade visibility. File downloads, homework,
quiz retrieval/start/autosave/submission use the existing central item gate.
Stored grades, answers, attempts and ranking data are never rewritten.

## Schema and release

`backend/scripts/section_access_migrations.py` adds two Boolean columns and the
`section_student_access` / `section_group_access` tables, composite primary keys
and target indexes. Defaults preserve legacy behavior; no existing grant is copied,
deleted or rewritten. Migrations are journaled by the existing hash-based migration
runner, transaction and advisory lock in `python -m scripts.init_db`.

Deploy frontend and backend together using the existing GitHub workflow/release
script. The backend entrypoint runs initialization. `deploy/release.sh` now refuses
active UNT/topical attempts before backup and again immediately before restart,
checks the dump/uploads checksums and archive integrity, and restores the dump into
a temporary network-isolated PostgreSQL container before changing app services.
Failure stops deployment. Backup artifacts stay outside containers under BACKUP_DIR.

Rollback: health-check failure restores prior images using `.rollback.env`; additive
schema can remain. Once staff have configured restricted section policies, an old
backend would not enforce those policies: prefer a corrected forward release. Do
not roll back to an old permission implementation while new section policies are
in use without a separately reviewed access-containment plan. Never restore a live
DB over newer student writes as an application rollback.

## Verification

Use disposable auditdb with RUN_RELEASE_TESTS=1. Browser fixtures use only
localhost:3102/8102 and E2E_CREDENTIALS_FILE, never real students or production.
Run `node --test tests/*.cjs`, TypeScript, production build, backend unittest
discovery, `frontend/e2e/content-access.cjs`, and BUG-001
`frontend/e2e/course-section-responsive.cjs` (E2E_BASE_URL/E2E_API_URL may select
only its approved local stacks). Screenshots and credentials remain outside Git.
