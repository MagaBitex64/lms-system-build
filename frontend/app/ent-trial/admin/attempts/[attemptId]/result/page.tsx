'use client'

import { useId, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Award, ChevronDown, ClipboardCheck, EyeOff, Monitor } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { AdminAttemptReview as ReviewData } from '@/lib/admin-attempt-review'
import AdminAnswerReview from '@/components/admin-answer-review'
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, Spinner } from '@/components/ui'
import styles from '@/components/admin-attempt-review.module.css'

function Accordion({title, description, icon, initialOpen = false, children}: {title: string; description: string; icon: ReactNode; initialOpen?: boolean; children: ReactNode}) {
  const [open, setOpen] = useState(initialOpen)
  const [visited, setVisited] = useState(initialOpen)
  const id = useId()
  return <section className={styles.accordion}>
    <h2><button type="button" id={`${id}-header`} className={styles.header} aria-expanded={open} aria-controls={id} onClick={() => {setVisited(true); setOpen(value => !value)}}><span className={styles.icon} aria-hidden="true">{icon}</span><span className={styles.heading}><strong>{title}</strong><small>{description}</small></span><ChevronDown className={styles.chevron} size={19} aria-hidden="true" /></button></h2>
    <div id={id} role="region" aria-labelledby={`${id}-header`} hidden={!open} className={styles.body}>{visited && children}</div>
  </section>
}

type EventsData = {page: number; per_page: number; total: number; absence_total: number; items: Array<{id: number; event_type: string; severity: number; created_at: string; details?: unknown}>; absences: Array<{id: number; started_at: string; ended_at: string | null; duration_seconds: number | null}>}
const eventLabels: Record<string,string> = {heartbeat:'Байланыс сигналы',absence_start:'Тесттен шығу',absence_end:'Тестке оралу',tab_hidden:'Басқа бетке ауысу',window_blur:'Терезеден шығу',fullscreen_exit:'Толық экраннан шығу',camera_stopped:'Камера тоқтады',screen_share_stopped:'Экран бөлісу тоқтады',copy:'Көшіру',cut:'Қиып алу',paste:'Қою',context_menu:'Контекст мәзірі',forbidden_shortcut:'Перне тіркесімі'}

function EventLog({attemptId, kind}: {attemptId: number; kind: 'absences' | 'browser'}) {
  const [page, setPage] = useState(1)
  const {data, error, isLoading, mutate} = useSWR<EventsData>(`/ent-trial/admin/attempts/${attemptId}/proctor-events?page=${page}`, fetcher)
  if (isLoading) return <Spinner />
  if (error) return <div className="space-y-3"><ErrorState message="Журналды жүктеу мүмкін болмады." /><Button variant="secondary" onClick={() => void mutate()}>Қайталау</Button></div>
  if (!data) return null
  const total = kind === 'absences' ? data.absence_total : data.total
  return <div className="space-y-4">
    {total === 0 ? <EmptyState title={kind === 'absences' ? 'Тесттен шығу тіркелмеген.' : 'Браузер оқиғалары тіркелмеген.'} /> : <div className={styles.events}>
      {kind === 'absences' ? data.absences.map(item => <div key={item.id} className={styles.event}><strong>Тесттен шығу</strong><p>{formatDate(item.started_at)} → {item.ended_at ? formatDate(item.ended_at) : 'Оралу уақыты тіркелмеген'}</p><p>Ұзақтығы: {item.duration_seconds == null ? 'сақталмаған' : `${Math.floor(item.duration_seconds / 60)} мин ${item.duration_seconds % 60} сек`}</p></div>) : data.items.map(item => <div key={item.id} className={styles.event}><strong>{eventLabels[item.event_type] ?? item.event_type}</strong><p>{formatDate(item.created_at)} · {item.event_type} · Деңгей: {item.severity}</p>{item.details != null && <details><summary className="cursor-pointer">Оқиға мәліметтері</summary><pre>{JSON.stringify(item.details, null, 2)}</pre></details>}</div>)}
    </div>}
    {total > data.per_page && <div className={styles.navigation}><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Алдыңғы</Button><span>{page} / {Math.ceil(total / data.per_page)}</span><Button variant="secondary" disabled={page * data.per_page >= total} onClick={() => setPage(page + 1)}>Келесі</Button></div>}
  </div>
}

const score = (value: number | null) => value == null ? 'сақталмаған' : Number.isInteger(value) ? String(value) : value.toFixed(2)

export default function AdminCompletedAttemptPage() {
  const {attemptId} = useParams<{attemptId: string}>()
  const {user} = useAuth()
  const validId = Number.isSafeInteger(Number(attemptId)) && Number(attemptId) > 0
  const {data, error, isLoading} = useSWR<ReviewData>(user?.role === 'admin' && validId ? `/ent-trial/admin/attempts/${attemptId}/review` : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false})
  if (user && user.role !== 'admin') return <ErrorState message="Бұл бет тек әкімшіге қолжетімді." />
  if (!validId) return <ErrorState message="Әрекет нөмірі қате." />
  if (!user || isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null
  return <div key={data.id} className="mx-auto max-w-6xl space-y-4 pb-6">
    <PageHeader eyebrow="Сынақ ҰБТ · Әкімші" title="Тест нәтижесі" description={data.title} actions={<Button variant="secondary" asChild><Link href={`/ent-trial/accesses/${data.access_id}/results`}><ArrowLeft size={16} />Нәтижелерге қайту</Link></Button>} />
    <Accordion title="Жалпы нәтиже" description="Оқушы, әрекет және сақталған пәндік нәтижелер" icon={<Award size={21} />} initialOpen>
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between gap-4"><div className="min-w-0 break-words"><h3 className="font-bold">{data.student_name}</h3><p className="text-sm text-muted">{data.student_email}</p><p className="mt-2 text-sm">{data.title}</p><p className="text-xs text-muted">{data.attempt_number}-әрекет · ID {data.id}</p><p className="mt-1 text-xs text-muted">Басталды: {formatDate(data.started_at)} · Аяқталды: {data.submitted_at ? formatDate(data.submitted_at) : 'Уақыты сақталмаған'}</p></div><div><p className="text-3xl font-black text-primary">{score(data.total_score)} / {score(data.max_score)}</p><p className="mt-1 text-sm text-muted">{data.percentage == null ? 'Пайыз есептеуге тарихи максимум жоқ' : `${data.percentage.toFixed(2)}%`}</p></div></div>
        {data.subjects.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.subjects.map(part => <Card key={part.subject} className="min-w-0 p-4"><p className="mb-2 text-sm font-semibold">{part.label} — {score(part.score)}/{score(part.max_score)}</p>{part.percentage != null && <><ProgressBar value={part.percentage} /><p className="mt-2 text-right text-xs text-muted">{part.percentage.toFixed(2)}%</p></>}</Card>)}</div> : <p className="text-sm text-muted">Пәндер бойынша мәлімет сақталмаған.</p>}
        {data.history_warning && <p className={styles.notice}>{data.history_warning}</p>}
      </div>
    </Accordion>
    <Accordion title="Оқушының жауаптары" description="Тарихи көшірмедегі сұрақтар, таңдалған және дұрыс жауаптар" icon={<ClipboardCheck size={21} />}><AdminAnswerReview data={data} /></Accordion>
    <Accordion title="Тесттен шығу журналы" description="Тіркелген шығулар, оралу уақыты және ұзақтығы" icon={<EyeOff size={21} />}><EventLog attemptId={data.id} kind="absences" /></Accordion>
    <Accordion title="Браузер хабарлаған оқиғалар" description="Нақты тіркелген хабарлар. Оқиғалар автоматты жазаға негіз болмайды." icon={<Monitor size={21} />}><EventLog attemptId={data.id} kind="browser" /></Accordion>
  </div>
}
