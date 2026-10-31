# BUG-001 resolution — 2026-10-31

**Status: FIXED and browser-verified locally.** The historical audit and its failing screenshots below remain as baseline evidence.

Only section-header layout was changed in `frontend/app/components/course-content-sections.tsx`. Below 640px, icon/title/chevron use a full-width grid row, count occupies a second grid row, and management controls use a separate right-aligned row. At >=640px the heading/count/actions remain compact in one row. No backend, database or enrollment/scoring/authentication code changed.

Regression: `frontend/e2e/course-section-responsive.cjs` runs against isolated 3101/8101 only. It creates its own synthetic course/sections/material/student and does not mutate pre-existing courses. **9 checks PASS:** five viewport layouts with six short/long Kazakh/Russian/English names, empty and nonempty sections and expand/collapse; mobile create/rename/delete; material move with persisted section ID verification; section reorder/contextual add; student readonly rendering without management controls.

Viewports: **375×812, 390×844, 768×1024, 1366×768, 1440×900**. Assertions check title width/height, row separation, desktop alignment, page overflow and actual controls. The 375/390 screenshots were visually compared with original `course-375x812.png` and `course-390x844.png`: the vertical character columns are gone, titles wrap across words, and control buttons remain outside the title area.

TypeScript passed; existing course-section frontend tests passed; production frontend builds passed for both isolated and normal local configurations. The normal local frontend was restarted with the new image. No production deploy or Git push.

Evidence: `/Users/nurasyl/Documents/Codex/2026-09-20/f-3/fenomen-e2e-evidence/bug001-fixed/` contains all five course screenshots, student readonly screenshot and `results.json`.

Reproduce (with the disposable stack running): set `PLAYWRIGHT_MODULE` to an installed Playwright module, `E2E_CREDENTIALS_FILE` to synthetic isolated-admin credentials, then run `node frontend/e2e/course-section-responsive.cjs`. Credentials are never included in reports or screenshots.

---

# Fenomen isolated browser E2E results — 2026-10-31

Latest result: **43 executed scenarios, 41 PASS, 2 FAIL, 0 technically BLOCKED**. Two failing mobile scenarios reproduce **one MEDIUM UI bug**. Untested items below are not counted as passed or blocked.

## Isolation
Dedicated Compose project `fenomen-e2e`, separate private network and PostgreSQL `fenomen_e2e`; initial users count verified as 0 before creating the synthetic admin. Database data uses container tmpfs. Frontend binds only 127.0.0.1:3101, backend 127.0.0.1:8101. No development DB volume, production URL, environment file, real records, or real credentials are used. Uploads stay in the disposable backend. No application code was edited. Credentials are held only in the disposable credential file/browser process, excluded from evidence.

## Execution
Headless installed Google Chrome controlled with Playwright. Browser clicks/forms execute account creation, onboarding, group and course management, folders, lessons, enrollment, and topical submission. API reads assert actual persisted enrollments/scores; synthetic material permissions, publication and credential resets are fixture preparation using the isolated admin API, not claimed as browser actions. Initial locator/prerequisite mistakes were corrected and rerun; these were harness issues, not app defects.

## Results by scenario

| Scenario | Result | Actual / evidence |
|---|---|---|
| Admin login | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create student; temporary password shown once | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create teacher | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create group without direction/stream | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create course with stored subject | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student mandatory setup and dashboard bypass prevention | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student personal password setup | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Temporary password rejected; new personal password accepted | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student admin API denied | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Teacher first login/setup | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive landing 1440x900 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive teacher dashboard 1440x900 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive landing 1366x768 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive teacher dashboard 1366x768 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive landing 768x1024 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive teacher dashboard 768x1024 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive landing 390x844 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive teacher dashboard 390x844 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive landing 375x812 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive teacher dashboard 375x812 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Favicon HTTP and metadata | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Add synthetic student to group | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create course folder in browser | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create regular lesson in browser | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Assign group to course | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Direct enrollment alongside group enrollment | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Removing group preserves independent direct enrollment | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Create topical test in browser | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive course 1440x900 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive course 1366x768 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive course 768x1024 | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Responsive course 390x844 | FAIL | Visual review BUG-001: section title wraps almost one character per line. Width-only overflow assertion passed, visual layout failed. |
| Responsive course 375x812 | FAIL | Visual review BUG-001: section title wraps almost one character per line. Width-only overflow assertion passed, visual layout failed. |
| Teacher creates own course | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Teacher creates section | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Teacher creates lesson | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Teacher saves lesson text and YouTube URL | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Teacher cannot modify another teachers course | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student sees assigned course | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student opens authorized lesson | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student starts authorized topical test | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Student submits correct answer and views saved score | PASS | Expected operation completed; see isolated Playwright script and results.json. |
| Attempt limit rejected server-side after submission | PASS | Expected operation completed; see isolated Playwright script and results.json. |

## BUG-001 — Mobile section title collapses to a vertical letter column
**Severity:** MEDIUM. **Area:** UI/UX, responsive course content. **Role:** Admin/teacher. **Route:** `http://localhost:3101/courses/1`.
**Steps:** Create a course section named `Synthetic Folder`; open course at 390×844 or 375×812 with section action controls visible. **Expected:** Readable horizontally wrapped title with controls on a separate line as needed. **Actual:** Title gets squeezed to roughly one character per line, creating a very tall mostly empty section header.
**Evidence:** `course-390x844.png`, `course-375x812.png` in the evidence folder. Both were visually inspected. Horizontal page overflow checks alone pass and therefore cannot detect this defect.
**Relevant source:** `frontend/app/components/course-content-sections.tsx:75-89`. **Likely cause:** flex-1 toggle shares the row with nonshrinking action controls, while title has min-w-0/break-words and receives almost no width. **Suggested fix:** Put controls on a separate mobile row or give the heading full width at the small breakpoint. **Fix risk:** Low, scoped layout change. **Regression:** Screenshot assertion with long Kazakh and Latin section names at 375/390 widths, including empty and nonempty sections. No fix applied.

## Console/network observations
First-run browser collector saw 0 pageerror events and 0 HTTP 5xx responses. This does not assert zero console warnings, failed external requests, or 4xx responses. Later workflows collected pageerror events but did not collect a complete network trace. External YouTube playback was not exercised.

## Remaining unexecuted coverage
- Word document import and export in browser; marking/correcting imported answers.
- Moving materials between folders and teacher gradebook/result review.
- Full UNT attempt with single/multiple/matching questions, partial 1/2, 2/2, incorrect 0/2, unanswered and administrator color/navigation review.
- UNT deadlines and unauthorized enrollment API calls in this browser run (existing integration coverage is not substituted).
- Video playback and file upload/download.
- Responsive question editor/test screen/modal screenshots at all five sizes; screenshots cover landing, teacher dashboard and course detail only.
- Student logout flow (the script revisits login, not the logout control).
- Cross-view group/course synchronization was checked through course API persistence, not every group management screen.

## Evidence
/Users/nurasyl/Documents/Codex/2026-09-20/f-3/fenomen-e2e-evidence

## Readiness
Not ready for unconditional acceptance: fix BUG-001 in a separately authorized implementation task and finish the unexecuted assessment/import/browser security scenarios. Current automated backend/frontend results remain separate from browser coverage. No deployment or push performed.
