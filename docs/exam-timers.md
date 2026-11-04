# Durable examination timing

`deadline_at` is the persisted source of truth. API `expires_at` is an alias,
not a second database clock. Responses include `server_time`, `started_at` and
`remaining_seconds`; the browser uses a monotonic countdown and revalidates on
focus, visibility return and reconnect.

ENT starts its timer only after successful proctor activation. Pending setup has
lifecycle `created`, no deadline and no running timer. Reopening setup reuses the
same attempt. Activated reconnects preserve the original deadline and answers;
reconnect never grants a fresh duration. Existing proctor capability, heartbeat,
fullscreen, screen sharing and camera enforcement still apply.

Topical tests keep their existing server start, access deadline, attempt count
and saved-answer mechanisms. Untimed tests remain untimed. Duration and access
permission are separate constraints; the earliest applicable deadline wins.

The existing 30-second background worker scans persisted deadlines at startup
and each cycle. It scores saved answers under row locks without a browser request.
Late writes cannot change answers or scores. Finalization is idempotent. An
individual failure is logged without rolling back other rows in the batch.
Finalization may lag the deadline by one scan interval, plus processing time;
write endpoints enforce the deadline immediately. Restart recovery scans the
same persisted rows.

`backend/scripts/exam_timer_migrations.py` adds nullable completion reasons through
`backend/scripts/init_db.py`, the established hash-journal initialization process.
There is no historical backfill, deadline rewrite or score recalculation.
Historical completed attempts with no reason stay `completed`.

## Release safety

`deploy/exam-window.sql` is a fail-closed, read-only classifier. Future deadlines
block deployment even with old/missing heartbeats. Unfinished untimed topical
attempts and ambiguous records block too. Only strict evidence of never-activated
ENT setup permits classification as created (no answers, events, absence periods,
lease, activity, activation, score or revision; known nonempty snapshot).

The release script verifies a fresh database dump by restoring it in an isolated
networkless temporary PostgreSQL container, and checks uploads/checksums. After
pulling images it rechecks the window and takes a short SHARE lock on attempt/start
tables, preventing an activation race until the old backend stops. New backend
initialization then applies additive migrations. Failed health probes restore
previous images; additive columns remain compatible with the previous release.
No examination is cancelled, force-completed or deleted by the deployment guard.

## Release verification

Controlled API clocks verify ENT and topical tests at minutes 0, 20 and 45:
3600, 2400 and 900 seconds, with the same deadline. Saved answers are preserved.
Real Chrome browser check on disposable auditdb closes the process after saving,
advances only fixture timestamps, starts a fresh browser/login and repeats real
proctor setup. The answer returns with 14:57 visible after loading. A subsequent
closed-browser backend restart finalizes expiry from persisted rows without any
student request; responses stay identical. Production records are never edited.
Late writes, concurrent/idempotent finalization, stale capabilities, untimed
quizzes and a two-connection PostgreSQL deployment-lock race have regressions.
