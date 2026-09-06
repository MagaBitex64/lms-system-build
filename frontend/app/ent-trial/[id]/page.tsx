'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { fetcher, api } from '@/lib/api'
import { Button, Spinner, ErrorState, cx } from '@/components/ui'
import { Check, Clock, FileText, ListChecks, Shuffle } from 'lucide-react'

const TEST_DURATION_SECONDS = 210 * 60
const MAX_SCORE = 140

type EntOption = { id: number; text: string }
type MatchingPair = { id: number; left_text: string; right_text: string; position: number }
type EntQuestion = {
  question_id: number
  subject: string
  prompt: string
  question_type: 'single_choice' | 'context' | 'matching' | 'multi_choice'
  context_text: string
  image_url: string
  max_points: number
  options: EntOption[]
  matching_pairs: MatchingPair[]
  selected_option_id: number | null
  selected_option_ids: number[]
  matching_answer: Record<string, string>
}
type AttemptData = {
  id: number
  status: 'in_progress' | 'submitted'
  combination: string
  started_at: string
  questions: Record<string, EntQuestion[]>
}
type AnswerValue = {
  selectedOptionId: number | null
  selectedOptionIds: number[]
  matchingAnswer: Record<string, string>
}

const SUBJECT_NAMES: Record<string, string> = {
  kaz_history: 'Қазақстан тарихы', reading: 'Оқу сауаттылығы', math_literacy: 'Мат. сауаттылық',
  informatics: 'Информатика', mathematics: 'Математика', physics: 'Физика', chemistry: 'Химия',
  biology: 'Биология', geography: 'География',
}
const COMBINATION_NAMES: Record<string, string> = {
  infmat: 'Информатика – Математика', phymat: 'Физика – Математика', biochem: 'Биология – Химия',
  chemphi: 'Химия – Физика', matgeo: 'Математика – География',
}

function emptyAnswer(question: EntQuestion): AnswerValue {
  return {
    selectedOptionId: question.selected_option_id ?? null,
    selectedOptionIds: question.selected_option_ids ?? [],
    matchingAnswer: question.matching_answer ?? {},
  }
}

function isAnswered(question: EntQuestion, answer?: AnswerValue) {
  if (!answer) return false
  if (question.question_type === 'multi_choice') return answer.selectedOptionIds.length > 0
  if (question.question_type === 'matching') {
    return question.matching_pairs.length > 0
      && question.matching_pairs.every((pair) => Boolean(answer.matchingAnswer[String(pair.id)]))
  }
  return answer.selectedOptionId !== null
}

export default function EntTestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<AttemptData>(`/ent-trial/attempts/${id}`, fetcher, { revalidateOnFocus: false })
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({})
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION_SECONDS)
  const [submitting, setSubmitting] = useState(false)
  const initializedAttempt = useRef<number | null>(null)
  const autoSubmitted = useRef(false)

  const subjects = useMemo(() => Object.keys(data?.questions ?? {}), [data?.questions])
  const allQuestions = useMemo(
    () => subjects.flatMap((subject) => data?.questions[subject] ?? []),
    [data?.questions, subjects],
  )

  useEffect(() => {
    if (!data || initializedAttempt.current === data.id) return
    initializedAttempt.current = data.id
    const initial: Record<number, AnswerValue> = {}
    for (const question of Object.values(data.questions).flat()) initial[question.question_id] = emptyAnswer(question)
    setAnswers(initial)
    setActiveSubject(subjects.includes('kaz_history') ? 'kaz_history' : subjects[0] ?? null)
  }, [data, subjects])

  useEffect(() => {
    if (!data?.started_at || data.status !== 'in_progress') return
    const endAt = new Date(data.started_at).getTime() + TEST_DURATION_SECONDS * 1000
    const updateTimer = () => setTimeLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [data?.started_at, data?.status])

  useEffect(() => {
    if (data?.status === 'submitted') router.replace(`/ent-trial/${id}/result`)
  }, [data?.status, id, router])

  const buildPayload = useCallback(() => allQuestions.map((question) => {
    const answer = answers[question.question_id] ?? emptyAnswer(question)
    if (question.question_type === 'multi_choice') {
      return { question_id: question.question_id, selected_option_ids: answer.selectedOptionIds }
    }
    if (question.question_type === 'matching') {
      return { question_id: question.question_id, matching_answer: answer.matchingAnswer }
    }
    return { question_id: question.question_id, selected_option_id: answer.selectedOptionId }
  }), [allQuestions, answers])

  const submitAttempt = useCallback(async (askConfirmation: boolean) => {
    if (submitting || data?.status !== 'in_progress') return
    if (askConfirmation && !window.confirm('Тестті аяқтап, нәтижені жіберуге сенімдісіз бе?')) return
    setSubmitting(true)
    try {
      await api(`/ent-trial/attempts/${id}/submit`, { method: 'POST', body: { answers: buildPayload() } })
      router.push(`/ent-trial/${id}/result`)
    } catch (submitError) {
      window.alert((submitError as Error).message)
      setSubmitting(false)
    }
  }, [buildPayload, data?.status, id, router, submitting])

  useEffect(() => {
    if (timeLeft !== 0 || !data || data.status !== 'in_progress' || autoSubmitted.current) return
    autoSubmitted.current = true
    void submitAttempt(false)
  }, [data, submitAttempt, timeLeft])

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null
  if (data.status === 'submitted') return <Spinner className="mt-20" />

  const currentQuestions = activeSubject ? data.questions[activeSubject] ?? [] : []
  const answeredPoints = allQuestions.reduce(
    (sum, question) => sum + (isAnswered(question, answers[question.question_id]) ? question.max_points : 0), 0,
  )
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  const selectSingle = (questionId: number, optionId: number) => setAnswers((previous) => {
    const current = previous[questionId] ?? { selectedOptionId: null, selectedOptionIds: [], matchingAnswer: {} }
    return { ...previous, [questionId]: { ...current, selectedOptionId: optionId } }
  })
  const toggleMultiple = (questionId: number, optionId: number) => setAnswers((previous) => {
    const current = previous[questionId] ?? { selectedOptionId: null, selectedOptionIds: [], matchingAnswer: {} }
    const selected = current.selectedOptionIds
    const next = selected.includes(optionId)
      ? selected.filter((idValue) => idValue !== optionId)
      : selected.length < 3 ? [...selected, optionId] : selected
    return { ...previous, [questionId]: { ...current, selectedOptionIds: next } }
  })
  const selectMatch = (questionId: number, pairId: number, rightText: string) => setAnswers((previous) => {
    const current = previous[questionId] ?? { selectedOptionId: null, selectedOptionIds: [], matchingAnswer: {} }
    return {
      ...previous,
      [questionId]: { ...current, matchingAnswer: { ...current.matchingAnswer, [String(pairId)]: rightText } },
    }
  })

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-surface -m-4 sm:-m-6 lg:-m-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 shadow-sm sm:px-6 sm:py-4">
        <div>
          <h1 className="text-xl font-bold">ЕНТ Сынақ тесті</h1>
          <p className="text-sm text-muted">{COMBINATION_NAMES[data.combination] ?? data.combination}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="rounded-lg bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
            Жауап берілді: {answeredPoints} / {MAX_SCORE} балл
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-2 text-lg font-mono font-semibold text-foreground">
            <Clock size={20} className={timeLeft < 600 ? 'animate-pulse text-danger' : 'text-muted'} />
            <span className={timeLeft < 600 ? 'text-danger' : ''}>{formatTime(timeLeft)}</span>
          </div>
          <Button onClick={() => void submitAttempt(true)} variant="primary" disabled={submitting}>
            {submitting ? 'Жіберілуде...' : 'Тестті аяқтау'} <Check size={18} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 space-y-2 overflow-y-auto border-r border-border bg-surface-muted p-4">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Пәндер</p>
          {subjects.map((subject) => {
            const questions = data.questions[subject]
            const answered = questions.filter((question) => isAnswered(question, answers[question.question_id])).length
            return (
              <button key={subject} onClick={() => setActiveSubject(subject)} className={cx(
                'flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-left transition-colors',
                activeSubject === subject ? 'bg-primary text-primary-foreground shadow-md' : 'bg-surface hover:bg-sidebar-hover',
              )}>
                <span className="font-semibold">{SUBJECT_NAMES[subject] || subject}</span>
                <span className={cx('text-xs', activeSubject === subject ? 'text-primary-foreground/80' : 'text-muted')}>
                  {answered} / {questions.length} сұрақ
                </span>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
                  <div className={cx('h-full rounded-full transition-all', activeSubject === subject ? 'bg-white' : 'bg-primary')}
                    style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-8 pb-20">
            <h2 className="border-b border-border pb-4 text-2xl font-bold">{SUBJECT_NAMES[activeSubject || '']}</h2>
            {currentQuestions.map((question, index) => {
              const answer = answers[question.question_id] ?? emptyAnswer(question)
              const selectedMultiple = answer.selectedOptionIds
              const rightOptions = question.matching_pairs.map((pair) => pair.right_text)
              const shuffledRightOptions = rightOptions.length > 1 ? [...rightOptions.slice(1), rightOptions[0]] : rightOptions
              return (
                <div key={question.question_id} className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{index + 1}</span>
                      {question.question_type === 'context' && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><FileText size={14} /> Контекст</span>}
                      {question.question_type === 'matching' && <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400"><Shuffle size={14} /> Сәйкестендіру</span>}
                      {question.question_type === 'multi_choice' && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-400"><ListChecks size={14} /> Бірнеше жауап</span>}
                    </div>
                    <span className="text-xs font-semibold text-muted">{question.max_points} балл</span>
                  </div>
                  {question.context_text && <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm leading-relaxed text-foreground/90"><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted"><FileText size={14} /> Контекст / Мәтін</p><p className="whitespace-pre-wrap">{question.context_text}</p></div>}
                  {question.image_url && <div className="flex max-h-80 items-center justify-center overflow-hidden rounded-xl border border-border bg-black/5"><img src={question.image_url} alt="Сұрақ суреті" className="max-h-80 w-full object-contain" /></div>}
                  <p className="whitespace-pre-wrap text-lg font-medium leading-snug">{question.prompt}</p>

                  {(question.question_type === 'single_choice' || question.question_type === 'context') && <div className="space-y-2 pt-2">
                    {question.options.map((option) => {
                      const selected = answer.selectedOptionId === option.id
                      return <label key={option.id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all hover:border-primary', selected ? 'border-primary bg-primary-soft/50 ring-1 ring-primary' : 'border-border bg-surface-muted')}>
                        <input type="radio" name={`q_${question.question_id}`} checked={selected} onChange={() => selectSingle(question.question_id, option.id)} className="h-5 w-5 border-gray-300 text-primary focus:ring-primary" />
                        <span className={cx('text-base', selected ? 'font-medium text-foreground' : 'text-muted-foreground')}>{option.text}</span>
                      </label>
                    })}
                  </div>}

                  {question.question_type === 'multi_choice' && <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted">1–3 жауап таңдаңыз. Таңдалды: {selectedMultiple.length} / 3</p>
                    {question.options.map((option) => {
                      const selected = selectedMultiple.includes(option.id)
                      const disabled = !selected && selectedMultiple.length >= 3
                      return <label key={option.id} className={cx('flex items-center gap-3 rounded-xl border p-4 transition-all', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary', selected ? 'border-primary bg-primary-soft/50 ring-1 ring-primary' : 'border-border bg-surface-muted')}>
                        <input type="checkbox" checked={selected} disabled={disabled} onChange={() => toggleMultiple(question.question_id, option.id)} className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" />
                        <span className={cx('text-base', selected ? 'font-medium text-foreground' : 'text-muted-foreground')}>{option.text}</span>
                      </label>
                    })}
                  </div>}

                  {question.question_type === 'matching' && <div className="space-y-3 pt-2">
                    <p className="text-xs text-muted">Әр сол жақтағы элементке сәйкес жауапты таңдаңыз.</p>
                    {question.matching_pairs.map((pair) => <div key={pair.id} className="grid items-center gap-2 rounded-xl border border-border bg-surface-muted p-3 sm:grid-cols-[1fr_auto_1fr]">
                      <span className="text-sm font-medium">{pair.left_text}</span><span className="hidden text-muted sm:inline">→</span>
                      <select value={answer.matchingAnswer[String(pair.id)] ?? ''} onChange={(event) => selectMatch(question.question_id, pair.id, event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
                        <option value="">Жауапты таңдаңыз</option>
                        {shuffledRightOptions.map((rightText, optionIndex) => <option key={`${rightText}-${optionIndex}`} value={rightText}>{rightText}</option>)}
                      </select>
                    </div>)}
                  </div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
