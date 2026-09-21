'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Award, ClipboardCheck, Clock3, EyeOff, Users } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, Spinner, StatCard } from '@/components/ui'

type SubjectResult = {
  subject: string
  label: string
  score: number
  max_score: number
  percentage: number
}

type AttemptResult = {
  id: number
  student_id: number
  full_name: string
  email: string
  status: 'in_progress' | 'submitted'
  total_score: number
  max_score: number
  percentage: number
  attempt_number: number
  started_at: string
  submitted_at?: string | null
  absence_count: number
  absence_seconds: number
  proctor_status?: string
  proctor_violations?: number
  subjects: SubjectResult[]
}

type AccessInfo = {
  id: number
  variant_title?: string | null
  exam_mode?: 'full' | 'single' | null
  single_subject?: string | null
  combination: string
  combination_label?: string | null
  target_type: 'all' | 'group' | 'student'
  group_title?: string | null
  group_code?: string | null
  student_name?: string | null
  expires_at?: string | null
  max_attempts: number
  created_at: string
  revoked_at?: string | null
}

type AccessResults = {
  access: AccessInfo
  items: AttemptResult[]
}

type ProctorData = {
  items: Array<{ id: number; event_type: string; severity: number; created_at: string }>
  absences: Array<{ id: number; started_at: string; ended_at?: string | null; duration_seconds?: number | null }>
}

function targetLabel(access: AccessInfo) {
  if (access.target_type === 'all') return 'Барлық студенттерге'
  if (access.target_type === 'group') return `Топ: ${access.group_title || access.group_code || '—'}`
  return `Студент: ${access.student_name || '—'}`
}

export default function AccessResultsPage() {
  const params = useParams<{ accessId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const accessId = Number(params.accessId)
  const [proctorAttemptId, setProctorAttemptId] = useState<number | null>(null)
  const { data, error, isLoading } = useSWR<AccessResults>(
    user?.role === 'admin' && Number.isFinite(accessId) ? `/ent-trial/admin/accesses/${accessId}/results` : null,
    fetcher,
  )
  const { data: proctorData, error: proctorError, isLoading: proctorLoading } = useSWR<ProctorData>(
    proctorAttemptId ? `/ent-trial/admin/attempts/${proctorAttemptId}/proctor-events` : null,
    fetcher,
  )

  if (user && user.role !== 'admin') return <ErrorState message="Бұл бет тек әкімшіге қолжетімді." />
  if (!Number.isFinite(accessId)) return <ErrorState message="Рұқсат нөмірі қате." />
  if (isLoading || !user) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  const { access, items } = data
  const completed = items.filter(item => item.status === 'submitted')
  const uniqueStudents = new Set(items.map(item => item.student_id)).size
  const bestScore = completed.length ? Math.max(...completed.map(item => Number(item.total_score))) : 0
  const subjectLabel = access.exam_mode === 'single'
    ? completed.flatMap(item => item.subjects).find(part => part.subject === access.single_subject)?.label || access.single_subject || '—'
    : access.combination_label || access.combination

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Сынақ ҰБТ · Нәтижелер"
        title={access.variant_title || 'ҰБТ нұсқасы'}
        description="Осы рұқсат арқылы орындалған әрекеттер мен әр пән бойынша жиналған ұпайлар."
        actions={<Button type="button" variant="secondary" onClick={() => router.back()}><ArrowLeft size={16} />Рұқсаттарға қайту</Button>}
      />

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs font-medium text-muted">Кімге берілді</p><p className="mt-1 text-sm font-bold">{targetLabel(access)}</p></div>
        <div><p className="text-xs font-medium text-muted">Тест форматы</p><p className="mt-1 text-sm font-bold">{access.exam_mode === 'single' ? 'Бір пән бойынша' : 'Толық ҰБТ · 5 пән'}</p></div>
        <div><p className="text-xs font-medium text-muted">Пән / комбинация</p><p className="mt-1 text-sm font-bold">{subjectLabel}</p></div>
        <div><p className="text-xs font-medium text-muted">Рұқсат мерзімі</p><p className="mt-1 text-sm font-bold">{access.expires_at ? formatDate(access.expires_at) : 'Мерзімі жоқ'}</p><p className="mt-1 text-xs text-muted">Әр оқушыға {access.max_attempts ?? 1} әрекет</p></div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Оқушылар" value={uniqueStudents} hint="Тестті бастағандар" icon={<Users size={20} />} />
        <StatCard label="Барлық әрекет" value={items.length} hint="Осы рұқсат бойынша" icon={<ClipboardCheck size={20} />} tone="success" />
        <StatCard label="Аяқталған" value={completed.length} hint="Бағаланған әрекеттер" icon={<Clock3 size={20} />} tone="warning" />
        <StatCard label="Ең жоғары ұпай" value={bestScore} hint={completed.length ? `Мүмкін ұпай: ${Math.max(...completed.map(item => Number(item.max_score)))}` : 'Нәтиже әлі жоқ'} icon={<Award size={20} />} tone="primary" />
      </div>

      <section className="space-y-4" aria-labelledby="access-results-title">
        <div>
          <h2 id="access-results-title" className="text-xl font-bold">Оқушылар нәтижесі</h2>
          <p className="text-sm text-muted">Тек осы рұқсат пен осы нұсқаға қатысты әрекеттер көрсетілген.</p>
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<Users size={36} />} title="Бұл рұқсат бойынша нәтиже жоқ" hint="Оқушы тестті бастағаннан кейін оның әрекеті осы жерде пайда болады." />
        ) : (
          <div className="space-y-4">
            {items.map(item => {
              const submitted = item.status === 'submitted'
              const proctorOpen = proctorAttemptId === item.id
              return (
                <Card key={item.id} className="overflow-hidden p-0">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{item.full_name}</h3>
                        <Badge tone={submitted ? 'success' : 'warning'}>{submitted ? 'Аяқталған' : 'Орындалуда'}</Badge>
                        <Badge>{item.attempt_number}-әрекет</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">{item.email}</p>
                      <p className="mt-2 text-xs text-muted">
                        Басталды: {formatDate(item.started_at)}
                        {item.submitted_at ? ` · Аяқталды: ${formatDate(item.submitted_at)}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted">Тесттен шығу: {item.absence_count || 0} · Тесттен тыс: {Math.floor((item.absence_seconds || 0) / 60)} мин {(item.absence_seconds || 0) % 60} сек</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <div className="text-right">
                        <p className="whitespace-nowrap text-xl font-black text-primary">{submitted ? `${item.total_score} / ${item.max_score}` : '—'}</p>
                        <p className="text-xs font-semibold text-muted">{submitted ? `${Number(item.percentage).toFixed(2)}%` : 'Тест орындалуда'}</p>
                      </div>
                      <Button type="button" size="sm" variant="secondary" aria-expanded={proctorOpen} onClick={() => setProctorAttemptId(proctorOpen ? null : item.id)}><EyeOff size={15} />Тесттен шығу журналы</Button>
                    </div>
                  </div>

                  {submitted && (
                    <div className="border-t border-border bg-surface-muted/40 px-4 py-4 sm:px-5">
                      <h4 className="mb-3 text-sm font-bold">Пәндер бойынша нәтиже</h4>
                      {item.subjects?.length ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {item.subjects.map(part => (
                            <div key={part.subject} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold leading-snug">{part.label}</p>
                                <p className="shrink-0 text-sm font-black text-primary">{part.score} / {part.max_score}</p>
                              </div>
                              <ProgressBar value={part.percentage} />
                              <p className="mt-1.5 text-right text-xs font-medium text-muted">{Number(part.percentage).toFixed(2)}%</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted">Бұл әрекет үшін пәндер бойынша мәлімет сақталмаған.</p>}
                    </div>
                  )}

                  {proctorOpen && (
                    <div className="border-t border-border px-4 py-4 sm:px-5">
                      <h4 className="mb-2 text-sm font-bold">Тесттен шығу журналы</h4>
                      {proctorLoading ? <Spinner /> : proctorError ? <ErrorState message={proctorError.message} /> : proctorData?.absences?.length ? (
                        <div className="max-h-56 space-y-2 overflow-auto">
                          {proctorData.absences.map(absence => (
                            <div key={absence.id} className="rounded-lg bg-warning/10 p-3 text-xs">
                              <b>Тесттен шығу</b> · {Math.floor((absence.duration_seconds || 0) / 60)} мин {(absence.duration_seconds || 0) % 60} сек · {formatDate(absence.started_at)}
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted">Тесттен шығу тіркелмеген.</p>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
