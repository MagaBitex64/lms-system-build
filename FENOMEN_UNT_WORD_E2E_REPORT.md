# BUG-002 resolution — 2026-10-31

**Status: FIXED, verified against the original attack and both camera configurations.** Historical findings and original failure evidence are retained below.

Root cause: active attempt writes checked revision/deadline but no fresh proctor capability; the browser recovery gate only required local camera readiness when camera_required=true. Persisted session IDs and server active status incorrectly substituted for current screen/fullscreen readiness.

Backend now issues a random 256-bit per-attempt capability on authenticated activation, stores only SHA-256, and checks it plus the page session ID before answer modifications and proctor events. Capabilities expire after45 seconds without a valid affirmative heartbeat; activation rotates them. Old page capabilities cannot renew or write after rotation/expiry. Screen/fullscreen/absence loss and required camera loss revoke the capability. Arbitrary log events do not renew freshness. Re-activation closes an open absence period. Submitted attempts and timeout finalization retain their existing saved-answer semantics.

Frontend starts every mount/attempt navigation with fresh memory-only readiness/session state. Screen sharing and fullscreen are always required; camera is required only when configured. Live stream/fullscreen checks guard answer changes, autosave and voluntary submission. Loss returns the user to reactivation with a warning that saved answers remain and the timer continues. Capability errors pause editing. Reactivation keeps the same attempt/deadline and pending local edits; no timer or allowance reset.

## Verification

**22 isolated Playwright checks PASS, 0 FAIL.** For camera_required=false and true: initial/tokenless writes rejected; browser activation; answer autosave; refresh blocks inputs; reactivation preserves saved response/deadline/started_at; old capability rejected; forced synthetic lease expiry rejected; fullscreen loss/recovery; screen loss/recovery; fresh login/context attack blocked; normal submit succeeds. Required-camera stream loss/recovery passed. The camera-disabled original attack additionally closes and relaunches the actual Chrome process. The previous completed 7/140 attempt's complete admin review JSON remained identical.

**19 backend checks PASS:** capability rotation/expiry/loss, recovery and attempt count, ENT integration/access/deadline, matching/multiple scoring rules. **40 frontend tests PASS. Production frontend builds and TypeScript PASS.** Synthetic capture uses Chrome fake-media devices; tests do not prove physical camera/screen behavior. Early E2E harness timing mistakes were corrected to await media readiness; a unique synthetic account per run avoids cross-run login-rate-limit interference. No production accounts or real attempts were used.

## Files

- `frontend/app/ent-trial/[id]/page.tsx`
- `backend/routers/ent_trial.py`
- `backend/scripts/proctor_migrations.py`, `backend/scripts/init_db.py`
- `backend/tests/test_proctor_lease.py`, `backend/tests/test_ent_integration.py`
- `frontend/e2e/proctor-session.cjs`
- `docs/proctor-sessions.md`
- This report (and audit status cross-reference).

Additive migration: `proctor_lease_hash` nullable column via the existing journaled init_db procedure. It does not rewrite stored scores/answers. Update frontend/backend together; an older frontend cannot write without the new capability. Existing active sessions need reload/reactivation. No production migration/deployment or Git push performed.

Evidence: `/Users/nurasyl/Documents/Codex/2026-09-20/f-3/fenomen-unt-word-evidence/bug002-fixed/` — results.json, refresh and fresh-session screenshots for both camera settings. Before-fix `proctor-reload-gap.png` remains in the parent evidence folder.

Remaining limitations: a normal backend cannot attest actual media capture. An authenticated malicious client can fabricate media flags; capabilities enforce authorization/freshness rather than cryptographic proof of screen sharing. Abrupt browser disconnect has a bounded45-second stale-capability window if no loss event arrives. Full security model and migration handoff: `docs/proctor-sessions.md`.

---

# Fenomen Word / full UNT browser E2E — 2026-10-31

**Final logical scenarios: 43; PASS 41; FAIL 1; BLOCKED/unsupported 1. Confirmed defects: 1 HIGH (BUG-002).** BUG-001 remains fixed; this report does not reopen it.

## Isolation and execution
Existing dedicated Compose project fenomen-e2e: frontend 127.0.0.1:3101, API 127.0.0.1:8101, PostgreSQL fenomen_e2e. A database-name assertion preceded fixture insertion. Only synthetic credentials/accounts/questions were used. No app business logic or development/production database was modified. Existing test courses were preserved; new fixture course, quiz items, full variant, access and student were added. Chrome/Playwright performed actual form uploads/downloads, answer selection, navigation, submission and admin review. API reads and a read-only PostgreSQL query verified persisted results. No unit-test run is substituted for browser coverage.

## Word results
Actual parser uses inline `<question>`, `<variant_correct>`, `<variant>` paragraphs. Browser imported a valid 10-question DOCX with Kazakh text and LaTeX delimiters, a multiple-correct question, unmarked answers, duplicate options, and an image question. Empty and malformed inputs left question lists empty. Unmarked question remained without any correct flag; manual UI marking survived reload. Topical export downloaded a valid ZIP/DOCX with valid word/document.xml; browser reimport matched normalized question prompts/types/options/correct flags. Export header contains example tag syntax, so raw tag counting is not a question count; API roundtrip confirmed 10 questions. Formula source text survived; KaTeX rendering itself was not conclusively verified in this Informatics-course fixture.
UNT Word export/import is not implemented in the inspected UNT editor/router; no export control was found. This is classified unsupported, not a confirmed defect.

## Full UNT results
Fixture uses the existing blueprint with 120 questions, 140 maximum points, valid difficulty/context quotas and matching/multiple-choice structure. The first multiple-choice question has three correct options and max_points=2. No validity rules were bypassed to start it. Browser selected answers for eight deterministic cases; all other questions were unanswered. Browser submitted the exam once. Student result, admin review and PostgreSQL agree: **7/140**, Informatics **7/50**, all other subjects zero, one attempt row, submitted status.

| Informatics local question | Expected / actual | Status |
|---|---|---|
| 1 | 1/1 | correct |
| 2 | 0/1, answer submitted | incorrect |
| 3 | 0/1, no answer | unanswered |
| 31 matching | 2/2 | correct |
| 32 matching | 1/2 | partial |
| 36, three correct options | 2/2 | correct |
| 37 multiple choice | 1/2 | partial |
| 38 multiple choice | 0/2 | incorrect |

Stored snapshot keys and awarded values were compared through admin review. Repeated review GETs were identical. Completed answer/submit retries did not alter persisted score/answers; comparison excluded dynamic server_time and remaining_seconds. Attempt limit returned409. A valid future access grant was allowed to expire naturally, then start returned403. Student admin review and correct-key mutation returned403. No real historical attempt was changed.

## Admin answer review / responsive results
All four accordions toggled independently. Informatics filter gave exactly40 subject-local number buttons. Active buttons retained green/red/amber/gray backgrounds and aria-current=step. Computed colors and screenshots are recorded. Previous/next controls were visible, but not separately exercised. Missing-history neutral state was not fabricated or tested.
Actual screenshots and width checks cover Word editor, active exam and admin review at 1440×900,1366×768,768×1024,390×844,375×812. No horizontal overflow detected in these checks. Mobile admin review was visually inspected, including green/red/amber/gray indicators and 0/2 result card. Student result was captured at one viewport, not all five.

## BUG-002 — Screen/fullscreen requirement can be bypassed after restarting browser session
**Severity:** HIGH (assessment integrity). **Scope reproduced:** camera_required=false, screen-share/fullscreen still required. **Route:** `/ent-trial/1` on isolated site.
**Steps:** Start authorized valid full UNT; use synthetic Chrome display device to activate screen sharing/fullscreen normally; close browser; open a fresh browser context, log in as same student and reopen active attempt. **Expected:** Require fresh screen-share/fullscreen activation before answers can be edited. **Actual:** Questions and enabled inputs render with document.fullscreenElement absent, without any new capture activation; answers save and browser submission succeeds. **Evidence:** `proctor-reload-gap.png`, `scoring.cjs` and stored submitted 7/140 result.
**Relevant files:** frontend/app/ent-trial/[id]/page.tsx:172-178,270; backend/routers/ent_trial.py:775 and save_or_submit. **Likely cause:** setup gate after initial activation checks cameraReady only when camera_required; screenPrepared/fullscreen are not checked on initial reload. Server retains active proctor status. **Suggested fix:** require fresh screen/fullscreen readiness for every reopened active browser session regardless of camera requirement and validate proctor-session freshness on writes. **Risk:** Medium; must preserve recovery/autosave behavior. **Regression needed:** refresh/new-browser tests for both camera settings, no capture/fullscreen, stale session, reconnect, allowed autosave/submission. No fix made.

## Scenario evidence

| Scenario | Final result | Actual/evidence |
|---|---|---|
| Word browser import valid | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word browser import unmarked | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word browser import duplicate | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word browser import malformed | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word browser import empty | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word browser import image | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Manually mark missing correct answer and reload | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word export download and reimport | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word editor responsive 1440x900 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word editor responsive 1366x768 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word editor responsive 768x1024 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word editor responsive 390x844 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Word editor responsive 375x812 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT variant export UI support | BLOCKED | Unsupported: UNT authoring UI/router has no Word import/export feature. Topical Word export/import passed. |
| Student starts authorized full UNT from browser | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT browser screen sharing and fullscreen activation | PASS | Retry with Chrome synthetic media-device flag passed; original screen-capture environment failure retained in evidence. |
| Reload keeps proctoring requirements enforced | FAIL | Fresh browser session: question inputs enabled without new fullscreen/screen-share activation |
| Browser deterministic answers and navigation persistence | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT exam responsive 1440x900 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT exam responsive 1366x768 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT exam responsive 768x1024 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT exam responsive 390x844 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT exam responsive 375x812 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Browser submit full UNT; student result | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Student admin review API denied | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 1440x900 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 1366x768 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 768x1024 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 390x844 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 375x812 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review has exact score cases from saved answers | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin subject-local numbering, result colors and selected status | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 1440x900 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 1366x768 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 768x1024 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 390x844 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Admin review responsive 375x812 | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| All four review accordions toggle independently | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Repeated result GETs preserve score and saved answers | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| UNT attempt limit enforced after completed browser submission | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Student cannot change correct answer keys | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Completed answers cannot be changed or duplicate-submitted | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |
| Expired UNT permission rejected server-side | PASS | Completed in isolated Chrome; see scripts/results/screenshots. |

## Harness corrections and limitations
Initial media capture failed without the synthetic Chrome device flag; retry passed. Initial scoring assertion used the wrong JSON field awarded_points; corrected to actual points_earned and verified all cases. Exact label locator was replaced by the actual subject combobox. Dynamic server timestamps were excluded from persistence equality. Deadline testing used a near-future valid grant; the server correctly rejects creating already-expired grants. These harness/prerequisite issues are not app bugs.
Not executed: real physical camera/display capture; timer expiry; all120 answers; real legacy-result mutation resistance after scoring-rule changes; another student private-answer access; unauthorized teacher attempt viewing; shuffled exam order (no configured ENT shuffle toggles identified); status-filter interaction; full Word error localization; image export roundtrip; KaTeX visual correctness; all-five-size student result/screenshots and filter modal flows. Console pageerrors collected: 0. No complete failed-network-request trace was captured, so zero-network-error claims are not made.

## Evidence and readiness
/Users/nurasyl/Documents/Codex/2026-09-20/f-3/fenomen-unt-word-evidence
Not ready for unconditional release acceptance: fix BUG-002 in a separately authorized task and rerun reload/reconnect security cases. Topical Word workflow and deterministic full UNT scoring passed within stated coverage. No push, deploy or automatic fix.
