-- Read-only, fail-closed classification. A missing heartbeat NEVER expires a timer.
WITH ent AS (
  SELECT t.id,
    CASE
      WHEN t.status='submitted' THEN 'completed'
      WHEN t.status<>'in_progress' THEN 'ambiguous'
      WHEN t.deadline_at IS NOT NULL AND t.deadline_at<=clock_timestamp() THEN 'expired'
      WHEN t.deadline_at IS NOT NULL THEN 'active'
      WHEN t.activated_at IS NULL AND t.proctor_status='pending'
        AND t.proctor_last_seen_at IS NULL AND t.proctor_session_id IS NULL
        AND t.proctor_lease_hash IS NULL AND t.proctor_violations=0
        AND t.response_revision=0 AND t.responses='{}'::jsonb AND t.submitted_at IS NULL
        AND t.total_score=0 AND t.snapshot->>'version'='ent-2026-v1'
        AND jsonb_typeof(t.snapshot->'questions')='array'
        AND jsonb_array_length(CASE WHEN jsonb_typeof(t.snapshot->'questions')='array' THEN t.snapshot->'questions' ELSE '[]'::jsonb END)>0
        AND NOT EXISTS(SELECT 1 FROM ent_trial_answers a WHERE a.attempt_id=t.id)
        AND NOT EXISTS(SELECT 1 FROM ent_proctor_events p WHERE p.attempt_id=t.id)
        AND NOT EXISTS(SELECT 1 FROM ent_absence_periods p WHERE p.attempt_id=t.id)
      THEN 'created' ELSE 'ambiguous'
    END state
  FROM ent_trial_attempts t
), quiz AS (
  SELECT CASE WHEN EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.quiz_id=s.quiz_id
    AND a.student_id=s.student_id AND a.attempt_number=s.attempt_number) THEN 'completed'
    WHEN s.deadline_at<=clock_timestamp() THEN 'expired'
    ELSE 'active' END state FROM quiz_starts s
)
SELECT (SELECT count(*) FROM ent WHERE state IN ('active','ambiguous'))
     + (SELECT count(*) FROM quiz WHERE state='active') AS blockers;
