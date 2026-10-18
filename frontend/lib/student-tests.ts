export type StudentTestAccess = {
  id: number; variant_title: string | null; variant_description: string | null
  combination: string; exam_mode: string; single_subject: string | null
  variant_ready: boolean; question_count: number | null; max_score: number | null
  duration_seconds: number | null; extra_time_minutes: number; camera_required: boolean
  expires_at: string | null; revoked_at: string | null
  attempt_id: number | null; attempt_status: string | null; attempt_score: number | null
  attempt_count: number; completed_attempt_count: number; max_attempts: number; best_score: number | null
}

/** Mirrors the existing start endpoint: expiry, readiness, active attempt and total attempt limit. */
export function studentTestState(access: StudentTestAccess, now = Date.now()) {
  const completed = access.attempt_status === 'submitted'
  const active = Boolean(access.attempt_id) && access.attempt_status === 'in_progress'
  const expired = Boolean(access.revoked_at) || Boolean(access.expires_at && new Date(access.expires_at).getTime() <= now)
  const limitReached = (access.attempt_count ?? 0) >= (access.max_attempts ?? 1)
  const canStart = !expired && (active || (access.variant_ready && !limitReached))
  const reason = expired ? 'Рұқсат мерзімі аяқталған немесе қайтарылған.' : limitReached ? 'Тапсыру лимиті аяқталды.' : !access.variant_ready ? 'Нұсқа әзірге дайын емес.' : ''
  return { completed, active, expired, canStart, reason,
    label: completed ? 'Аяқталған' : canStart ? 'Қолжетімді' : 'Қолжетімсіз' }
}
