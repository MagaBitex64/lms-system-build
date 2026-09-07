'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { fetcher, getFileUrl } from '@/lib/api'
import { Spinner, ErrorState, Card, Button, cx } from '@/components/ui'
import { AlertCircle, ArrowLeft, CheckCircle, FileText, Trophy, XCircle } from 'lucide-react'

type ResultOption = { id: number; text: string; is_correct: boolean }
type MatchingPair = { id: number; left_text: string; right_text: string; correct_option_id: number }
type ResultQuestion = {
  question_id: number
  prompt: string
  question_type: 'single_choice' | 'context' | 'matching' | 'multi_choice'
  context_text: string
  image_url: string
  image_file_id: number | null
  image_placement: 'before' | 'after' | 'marker'
  image_width: number
  image_alt: string
  max_points: number
  points_earned: number
  is_correct: boolean
  explanation?: string
  options: ResultOption[]
  matching_pairs: MatchingPair[]
  selected_option_id: number | null
  selected_option_ids: number[]
  matching_answer: Record<string, string | number>
}
type ResultData = {
  status: 'in_progress' | 'submitted'
  combination: string
  scores: { kaz_history: number; reading: number; math_literacy: number; subject1: number; subject2: number; total: number }
  scores_by_subject: Record<string, number>
  max_score: number
  proctor_status: string
  proctor_violations: number
  questions: Record<string, ResultQuestion[]>
}

import { SUBJECT_NAMES } from '@/lib/ent'

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function ResultPrompt({ question }: { question: ResultQuestion }) {
  const src = question.image_file_id ? getFileUrl(question.image_file_id) : question.image_url
  const image = src ? <img src={src} alt={question.image_alt || 'Сұрақ суреті'} className="max-h-72 max-w-full rounded-lg border border-border object-contain" style={{ width: question.image_width || 640 }} /> : null
  const text = (value: string) => value ? <p className="whitespace-pre-wrap font-medium">{value.replaceAll('{{image}}', '')}</p> : null
  if (!image) return text(question.prompt)
  if (question.image_placement === 'before') return <div className="space-y-3">{image}{text(question.prompt)}</div>
  if (question.image_placement === 'marker' && question.prompt.includes('{{image}}')) {
    const at = question.prompt.indexOf('{{image}}')
    return <div className="space-y-3">{text(question.prompt.slice(0, at))}{image}{text(question.prompt.slice(at + 9))}</div>
  }
  return <div className="space-y-3">{text(question.prompt)}{image}</div>
}

export default function EntResultPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<ResultData>(`/ent-trial/attempts/${id}`, fetcher)

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null
  if (data.status !== 'submitted') return <div className="mx-auto mt-20 max-w-2xl space-y-4 text-center"><h2 className="text-2xl font-bold">Тест әлі аяқталмаған</h2><Button onClick={() => router.push(`/ent-trial/${id}`)}>Тестке қайту</Button></div>

  const scoreItems = Object.entries(data.questions).map(([key, questions]) => ({ key,
    score: Number(data.scores_by_subject?.[key] ?? 0), max: questions.reduce((sum, q) => sum + Number(q.max_points), 0) }))

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Button variant="ghost" onClick={() => router.push('/ent-trial')} className="mb-4"><ArrowLeft size={16} /> Артқа қайту</Button>
      <Card className="border-primary/20 bg-gradient-to-br from-primary-soft to-surface p-8 text-center">
        <Trophy size={48} className="mx-auto mb-4 text-primary" />
        <h1 className="mb-2 text-3xl font-bold">Тест аяқталды!</h1>
        <p className="mb-6 text-muted">Дифференциалды бағалауды ескерген жалпы нәтиже:</p>
        <div className="text-6xl font-black text-foreground">{formatScore(data.scores.total)} <span className="text-3xl font-bold text-muted">/ {data.max_score}</span></div>
        <p className="mt-4 text-sm text-muted">Прокторинг: {data.proctor_status === 'terminated' ? 'бұзушылықтарға байланысты автоматты аяқталды' : 'аяқталды'} · тіркелген бұзушылық: {data.proctor_violations}</p>
      </Card>

      <h2 className="text-xl font-bold">Пәндер бойынша талдау</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scoreItems.map((item) => {
          const percent = Math.min(100, (item.score / item.max) * 100)
          return <Card key={item.key} className="p-5">
            <p className="mb-2 font-semibold">{SUBJECT_NAMES[item.key] || item.key}</p>
            <div className="mb-2 flex items-end justify-between"><span className="text-2xl font-bold">{formatScore(item.score)}</span><span className="text-sm text-muted">/ {item.max}</span></div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"><div className={cx('h-full rounded-full', percent >= 70 ? 'bg-success' : percent >= 40 ? 'bg-warning' : 'bg-danger')} style={{ width: `${percent}%` }} /></div>
          </Card>
        })}
      </div>

      <h2 className="mb-4 mt-12 text-xl font-bold">Қатемен жұмыс</h2>
      {Object.entries(data.questions).map(([subject, questions]) => <div key={subject} className="mb-8 space-y-4">
        <h3 className="border-b border-border pb-2 text-lg font-semibold text-primary">{SUBJECT_NAMES[subject] || subject}</h3>
        {questions.map((question, index) => {
          const earned = Number(question.points_earned ?? 0)
          const maxPoints = Number(question.max_points ?? 1)
          const complete = earned >= maxPoints
          const partial = earned > 0 && earned < maxPoints
          const cardClass = complete ? 'border-success/30 bg-success/5' : partial ? 'border-warning/30 bg-warning/5' : 'border-danger/30 bg-danger/5'
          return <div key={question.question_id} className={cx('rounded-2xl border p-5', cardClass)}>
            <div className="mb-3 flex gap-3">
              <div className="mt-0.5">{complete ? <CheckCircle size={20} className="text-success" /> : partial ? <AlertCircle size={20} className="text-warning" /> : <XCircle size={20} className="text-danger" />}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Сұрақ №{index + 1}</p>
                <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', complete ? 'bg-success/10 text-success' : partial ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger')}>{formatScore(earned)} / {formatScore(maxPoints)} балл</span>
              </div></div>
            </div>

            {question.context_text && <div className="ml-8 mb-4 rounded-lg border border-border bg-background p-3 text-sm"><p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-muted"><FileText size={13} /> Контекст</p><p className="whitespace-pre-wrap">{question.context_text}</p></div>}
            <div className="ml-8 mb-4"><ResultPrompt question={question} /></div>

            {(question.question_type === 'single_choice' || question.question_type === 'context') && <div className="space-y-2 pl-8">
              {question.options.map((option) => {
                const selected = question.selected_option_id === option.id
                return <div key={option.id} className="flex items-start gap-2 text-sm">
                  <span className={cx('mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border', option.is_correct ? 'border-success bg-success' : selected ? 'border-danger bg-danger' : 'border-muted')} />
                  <p className={cx(option.is_correct ? 'font-semibold text-foreground' : selected ? 'text-danger' : 'text-muted-foreground')}>{option.text}
                    {option.is_correct && <span className="ml-2 text-xs font-bold text-success">(Дұрыс жауап)</span>}
                    {selected && !option.is_correct && <span className="ml-2 text-xs font-bold text-danger">(Сіздің жауап)</span>}
                  </p>
                </div>
              })}
            </div>}

            {question.question_type === 'multi_choice' && <div className="space-y-2 pl-8">
              <p className="mb-2 text-xs text-muted">Бірнеше жауабы бар сұрақ</p>
              {question.options.map((option) => {
                const selected = question.selected_option_ids.includes(option.id)
                return <div key={option.id} className="flex items-start gap-2 text-sm">
                  <span className={cx('mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] text-white', option.is_correct ? 'border-success bg-success' : selected ? 'border-danger bg-danger' : 'border-muted')}>{selected ? '✓' : ''}</span>
                  <p className={cx(option.is_correct ? 'font-semibold text-foreground' : selected ? 'text-danger' : 'text-muted-foreground')}>{option.text}
                    {option.is_correct && <span className="ml-2 text-xs font-bold text-success">(Дұрыс)</span>}
                    {selected && <span className={cx('ml-2 text-xs font-bold', option.is_correct ? 'text-success' : 'text-danger')}>(Сіз таңдадыңыз)</span>}
                  </p>
                </div>
              })}
            </div>}

            {question.question_type === 'matching' && <div className="space-y-2 pl-8">
              <p className="mb-2 text-xs text-muted">Сәйкестендіру нәтижесі</p>
              {question.matching_pairs.map((pair) => {
                const selectedId = question.matching_answer?.[String(pair.id)] ?? ''
                const selected = question.options.find(o => String(o.id) === String(selectedId))?.text ?? ''
                const correct = String(selectedId) === String(pair.correct_option_id)
                return <div key={pair.id} className={cx('rounded-lg border p-3 text-sm', correct ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5')}>
                  <div className="flex items-center gap-2">{correct ? <CheckCircle size={16} className="shrink-0 text-success" /> : <XCircle size={16} className="shrink-0 text-danger" />}<span className="font-medium">{pair.left_text}</span><span className="text-muted">→</span><span className={correct ? 'font-semibold text-success' : 'font-semibold text-danger'}>{selected || 'Жауап берілмеді'}</span></div>
                  {!correct && <p className="mt-1 pl-6 text-xs text-success">Дұрыс жауап: {pair.right_text}</p>}
                </div>
              })}
            </div>}

            {question.explanation && <div className="ml-8 mt-4 rounded-lg border border-border bg-background p-3 text-sm"><span className="font-semibold">Түсіндірме:</span> {question.explanation}</div>}
          </div>
        })}
      </div>)}
    </div>
  )
}
