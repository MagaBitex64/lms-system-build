# UNT grant audience semantics

New grants must explicitly use `current_students`, `global`, `student` or `group`.
Legacy ambiguous API input `all` is rejected with422. Default UI is current_students.

- current_students selects unblocked student IDs in one database query at grant
  time and creates ordinary individual grants for those IDs in the same transaction.
  Future registrations cannot match them. No registration hook copies grants.
- global explicitly creates a target_type=all grant marked audience_mode=global.
- student and group retain their existing authorization and membership checks.
- nullable audience_mode is additive metadata; no existing rows are backfilled.

Listing matches audience or retained attempt history. Starting independently
checks the grant recipient, revocation, deadline, readiness and attempt limit.
Attempt/question reads and writes require the student's own attempt, and existing
proctor capabilities. No scoring, timers or historic responses are changed.
General UNT grants remain administrator-only. Existing teacher course ownership
and course-specific test permissions are unchanged; this does not give teachers
system-wide UNT assignment privileges.

## Legacy grants

Old target_type=all rows with null audience_mode retain their old global behavior,
including access for future students, and are labelled as needing administrator
classification. It is impossible to infer intended snapshot recipients from the
label or creation date reliably. Do not silently rewrite or revoke these rows.
Owner must explicitly decide which remain global and which should be replaced
with a reviewed individual recipient list using existing assignment/revocation
workflows. Revocation preserves completed attempts and results.

Read-only production audit (2026-11-05): ten unrevoked all grants, all variant2.
ID1 expired; IDs2–10 no deadline. Completed results exist under3,4,9,10.
No grants, answers or results were modified by the audit. These nine legacy
permissions can still explain access on a newly created production account.

## Regression verification

118 backend tests;47 frontend tests; TypeScript and production build pass.
Browser E2E performs current_students grant in the real UI, creates a new disposable
student through the admin API, completes password setup, checks listing exclusion
and direct-start403, then explicitly selects global in the UI and verifies start.
The isolated fixture refuses any database except auditdb. No unexpected HTTP400
occurred. Initial browser script failure was an incorrect tab locator (UI exposes
buttons); corrected to button and rerun successfully. Historical reported generic
Bad Request could not be reproduced or attributed without its originating request.
