export type ReviewStatus = 'correct' | 'incorrect' | 'partial' | 'unanswered' | 'unknown'
export type ReviewQuestion = {
  question_id: number; number: number; subject: string; subject_label: string; question_type: string
  prompt: string; context_text: string; image_file_id?: number | null; image_url: string
  image_placement: string; image_width: number; image_alt: string
  options: Array<{id: number; text: string; is_correct?: boolean}>
  matching_pairs: Array<{id: number; left_text: string; right_text?: string; correct_option_id?: number}>
  response: {selected_option_id?: number | null; selected_option_ids?: number[]; matching_answer?: Record<string, number | string>}
  status: ReviewStatus; keys_available: boolean; points_earned: number | null; max_points: number | null
  evaluation_source: 'stored' | 'reconstructed' | 'snapshot_keys' | 'unavailable'
}
export type AdminAttemptReview = {
  id: number; access_id: number; attempt_number: number; student_name: string; student_email: string; title: string
  started_at: string; submitted_at: string | null; total_score: number; max_score: number | null; percentage: number | null
  subjects: Array<{subject: string; label: string; score: number | null; max_score: number | null; percentage: number | null}>
  questions: ReviewQuestion[]; review_available: boolean; history_warning: string | null; points_warning: string | null
}
export function filterReviewQuestions(questions: ReviewQuestion[], subject: string, status: string) {
  return questions.filter(q => (!subject || q.subject === subject) && (!status || q.status === status))
}
export function reviewNavigation(questions: ReviewQuestion[], subject: string, status: string) {
  return filterReviewQuestions(questions, subject, '').map((question, index) => ({
    question, displayNumber: subject ? index + 1 : question.number,
  })).filter(({question}) => !status || question.status === status)
}
export function selectedReviewOptions(question: ReviewQuestion) {
  return new Set([...(question.response.selected_option_ids || []), ...(question.response.selected_option_id == null ? [] : [question.response.selected_option_id])])
}

export type ScoreIndicator = 'correct' | 'partial' | 'incorrect' | 'unanswered' | 'unknown'

export function scoreIndicator(question: ReviewQuestion): ScoreIndicator {
  const maximum = question.max_points
  const awarded = question.points_earned
  if (maximum == null || awarded == null || ![1, 2].includes(maximum) ||
      !Number.isFinite(awarded) || awarded < 0 || awarded > maximum) return 'unknown'

  const response = question.response || {}
  const answered = question.question_type === 'matching'
    ? Object.values(response.matching_answer || {}).some(value => value != null && value !== '')
    : selectedReviewOptions(question).size > 0

  if (!answered) return awarded === 0 ? 'unanswered' : 'unknown'
  if (awarded === maximum) return 'correct'
  if (awarded === 0) return 'incorrect'
  return 'partial'
}
