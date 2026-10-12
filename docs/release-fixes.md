# Audit fixes — 12 October 2026

The repository fixes were implemented without running migrations or writes on
the existing application database. Verification used disposable PostgreSQL,
temporary uploads, isolated schemas and a separate local browser fixture.
Pre-existing formula-editor and chemistry/KaTeX changes were preserved.

Production startup now provisions the sole administrator
`nurdildanurasyl7@gmail.com` from an ignored Docker secret. It retains old user
records, disables other administrators and invalidates their sessions. Repeated
startup preserves later password changes; production API and a unique DB index
prevent a second administrator. This was tested on a disposable database using
the actual production backend image, including successful login. The real
server database has not been changed.

| Finding | Result |
| --- | --- |
| F01 grades with homework | Correct student_ids argument; student overview/gradebook regressions pass |
| F02 standalone quiz start | question_count/quiz_started and persisted answers returned; actual browser start passes |
| F03 restart corrupts pending ENT | Journalled transactional migrations; modern pending snapshots preserved; null/frozen legacy converted once |
| F04 cascade loss of history | Database RESTRICT constraints protect histories even in parent-delete races; API returns409 |
| F05 file access bypass | Common item/course permission checks; unpublished/sequential access rejected; grade/search access corrected |
| F06 shared files destroyed | Removing links/materials/questions/courses retains uploaded files; shared-download regression passes |
| F07 LMS timer bypass/loss | Server deadline, durable answers, revision and idempotent save retries; worker/read/submit completion after expiry |
| F08 blocking bcrypt/login abuse | Dedicated bounded password executor and shared PostgreSQL rate limits |
| F09 concurrent manual grading | Attempt locked before updating/recalculating grades; concurrent correct result100 |
| F10 stale homework grades | Resubmit clears grade/feedback and increments revision; stale teacher review rejected409 |
| F11 first100 students / first12 courses | Server search, pagination and teacher-name search; browser page4 + student199 passes |
| F12 questions before ENT timer | Pending questions and snapshot media withheld; single-subject initialization tested after activation |
| F13 production env/TLS | Separate private production configuration, secret-generation helper and fail-fast validation; real DNS/TLS awaits server |
| F14 bearer token in image URL | Header-authenticated blob images; query-token authentication removed; logs omit queries |
| F15 recovery/readiness/startup | DB readiness503 on failure, private healthchecks, restart/log rotation, atomic migration journal, backup/restore scripts |
| F16 data/disk spam | Account file quotas, bounded/pre-authenticated multipart, HTTP body caps, upload/login/reset/lead throttling; failed uploads cleaned |
| F17 group capacity races | Parent row lock and capacity-shrink DB trigger |
| F18 duplicate homework / quiz submission | Serialized/idempotent persistence; concurrent homework requests succeed without duplicates |
| F19 excessive course queries | Bulk per-student access/results, SQL unlock check; 50-item course4 helper queries versus1378 |
| F20 pool initialization races | One startup pool behind async lock; close on shutdown |
| F21 bcrypt byte overflow | Central72-byte password validation; admin create/update returns422 |
| F22 misleading proctoring promises | Advisory-client limitations documented; admin paginated event/absence log; no invented automatic punishments |
| F23 growth/build/auth settings | SQL top100 ranking with complete counts; bounded event pages, reset/rate retention, explicit CORS, server logout; pinned dependencies/images, real build typecheck |

Educational history and ENT snapshots are retained deliberately. Their deletion
needs an owner-approved retention policy and backup; this change does not silently
purge results or guess repairs for modern attempts corrupted by the old migration.
The production runbook includes the review query and size-monitoring requirements.

## Verified locally

- 39 tests passed: 22 existing + 17 release regressions. A fresh read-only verifier
  independently executed the release suite and the additional stale-homework fix.
  The two production-administrator regressions also passed independently.
- Frontend production Docker build (Next 16.3.8 / Node 24) and explicit TypeScript
  validation passed. pnpm production dependency audit reported zero known issues.
- Browser: standalone start, future-close quiz does not immediately submit, lost
  autosave response is retried without permanent revision conflict, choice/text
  survive refresh, protected images load as blobs without token query; expiry
  result visible, admin page 4 reachable and student 199 searchable.
- Single-subject ENT: questions withheld before timer and correct subject selected
  after activation. Screen/fullscreen were simulated in this headless check;
  real device permissions and mobile compatibility were not established.
- Real HTTP/Uvicorn: 200 distinct simultaneous successful logins in 12.948s;
  health p95 0.061s, max 3.060s, all probes 200. Local hardware, no production TLS.
  Compare with the earlier ASGI measurement cautiously: protocols/clients differ.
- Course 50 completed sequential quizzes: 4 helper SQL queries, 0.073s local.
- Standalone production Compose, nginx configuration and Caddy configuration
  validate; local gateway serves backend readiness and frontend with 200.
- Disposable DB dump restored successfully; every file referenced by restored
  files table was present in the uploads archive (one real fixture image).

## Still to verify on the actual server

DNS/HTTPS issuance, firewall/proxy trust, external password-reset delivery,
scheduled off-server backups and alerts, full production restore/download drill,
actual mixed 200-user/long-running load, disk growth and rollback. Source
configuration and local tests are preparation for these checks, not a claim that
an unconfigured server is ready for public release.
