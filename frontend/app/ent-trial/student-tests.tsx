'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, ClipboardList, Clock3, FileText, ShieldCheck, Trophy } from 'lucide-react'
import { api, fetcher } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { Rules } from '@/lib/ent'
import { studentTestState, type StudentTestAccess } from '@/lib/student-tests'
import { Badge, Button, EmptyState, ErrorState } from '@/components/ui'
import { ExamArt } from './variant-art'
import styles from '../components/student-learning.module.css'

type AttemptSummary = { status: string; submitted_at: string | null; max_score: number; scores: { total: number }; duration_seconds: number }

export function StudentTestCard({ access, rules, onStart, index = 0, compact = false }: { access: StudentTestAccess; rules?: Rules; onStart: (id: number) => Promise<void>; index?: number; compact?: boolean }) {
  const state = studentTestState(access)
  const result = useSWR<AttemptSummary>(state.completed && access.attempt_id ? `/ent-trial/attempts/${access.attempt_id}` : null, fetcher)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState('')
  const subjectKeys = access.exam_mode === 'single' ? [access.single_subject ?? ''] : rules?.combinations[access.combination] ?? []
  const subjects = subjectKeys.map(key => rules?.subject_labels[key] ?? key).filter(Boolean).join(' – ') || access.combination
  const maxScore = result.data?.max_score ?? (state.completed ? null : access.max_score)
  const score = result.data?.scores.total ?? access.attempt_score
  const duration = result.data?.duration_seconds ?? access.duration_seconds

  async function start() {
    if (busyRef.current || !studentTestState(access).canStart) return
    busyRef.current = true
    setBusy(true)
    setStartError('')
    try { await onStart(access.id) }
    catch (error) { setStartError((error as Error).message) }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <article className={styles.testCard} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
    <div className={`${styles.testCover} ${state.completed ? styles.completedCover : !state.canStart ? styles.unavailableCover : ''}`}>
      <Badge tone={state.completed ? 'success' : state.canStart ? 'success' : 'danger'}>{state.label}</Badge><ExamArt className={styles.testArt} />
    </div>
    <div className={styles.testBody}>
      <h3>{access.variant_title || 'Сынақ ҰБТ'}</h3>
      {!compact && access.variant_description && <p className={styles.testDescription}>{access.variant_description}</p>}
      <p className={styles.testSubject}>{subjects}</p>
      <div className={styles.testMeta}>
        <p><FileText size={15} /><span>{access.question_count ?? '—'} сұрақ · {maxScore ?? '—'} балл{compact && ` · ${duration ? Math.round(duration / 60) + (access.extra_time_minutes ?? 0) : '—'} мин`}</span></p>
        {!compact && <p><Clock3 size={15} /><span>{duration ? Math.round(duration / 60) + (access.extra_time_minutes ?? 0) : '—'} мин</span></p>}
        <p><CalendarDays size={15} /><span>Күні белгіленбеген</span></p>
        {access.expires_at && <p><CalendarDays size={15} /><span>Қолжетімділік мерзімі: {formatDate(access.expires_at)}</span></p>}
        {!compact && <p><ClipboardList size={15} /><span>{access.attempt_count ?? 0} / {access.max_attempts ?? 1} әрекет · {access.completed_attempt_count ?? 0} аяқталған</span></p>}
        {!compact && <p><ShieldCheck size={15} /><span>{access.camera_required ? 'Камера және толық экран міндетті' : 'Толық экран міндетті'}</span></p>}
      </div>
      {state.completed && score != null && <div className={styles.testResult}><Trophy size={17} /><strong>{score} / {maxScore ?? '—'} балл</strong></div>}
      {state.completed && result.data?.submitted_at && <p className={styles.attemptDate}>Аяқталған уақыты: {formatDate(result.data.submitted_at)}</p>}
      {state.completed && result.error && <p role="status" className={styles.notice}>Нәтиженің толық деректерін жүктеу мүмкін болмады.</p>}
      {(access.max_attempts ?? 1) > 1 && access.best_score != null && access.completed_attempt_count > 0 && <p className={styles.attemptDate}>Ең жақсы нәтиже: {access.best_score} балл</p>}
      {!state.canStart && (!compact || !state.completed) && <p className={styles.availabilityNote}>{state.reason}</p>}
      {state.active && state.canStart && <p className={styles.availabilityNote}>Басталған әрекетті жалғастыра аласыз.</p>}
      {startError && <p role="alert" className={styles.notice}>{startError}</p>}
      <div className={styles.testActions}>
        {state.completed && access.attempt_id && <Button asChild variant="secondary" size="sm"><Link href={`/ent-trial/${access.attempt_id}/result`}>Нәтижені көру</Link></Button>}
        {state.canStart ? <Button size="sm" disabled={busy} onClick={() => void start()}>{busy ? 'Ашылуда…' : state.completed ? 'Қайта тапсыру' : state.active ? 'Жалғастыру' : 'Сынақты бастау'}<ArrowRight size={15} /></Button>
          : !state.completed && <Button size="sm" disabled>Қолжетімсіз</Button>}
      </div>
    </div>
  </article>
}

/** Same start request and destination as the original student listing. Never runs on render. */
export function useStudentTestStart() {
  const router = useRouter()
  return async (accessId: number) => {
    const res = await api<{ attempt_id?: number }>(`/ent-trial/accesses/${accessId}/start`, { method: 'POST' })
    if (res.attempt_id) router.push(`/ent-trial/${res.attempt_id}`)
  }
}

export default function StudentTests({ accesses, rules, error, onStart }: { accesses: StudentTestAccess[]; rules?: Rules; error?: boolean; onStart: (id: number) => Promise<void> }) {
  return <div className={styles.page}>
    <header className={styles.banner}><div><p className={styles.eyebrow}>ДАЙЫНДЫҚ</p><h1>Сынақ ҰБТ</h1><p>Тағайындалған сынақтарды өтіп, біліміңізді тексеріңіз және нәтижелеріңізді бақылаңыз.</p></div><ExamArt className={styles.bannerArt} /></header>
    <section aria-label="Тағайындалған сынақтар">
      {error ? <ErrorState message="Сынақтарды жүктеу мүмкін болмады." /> : !accesses.length ? <EmptyState icon={<ClipboardList size={28} />} title="Сынақ тестер жоқ" hint="Әзірге тағайындалған тестер жоқ." /> : <div className={styles.testGrid}>{accesses.map((access, index) => <StudentTestCard key={access.id} access={access} rules={rules} onStart={onStart} index={index} />)}</div>}
    </section>
  </div>
}
