'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { api, ApiError, fetcher, getFileUrl } from '@/lib/api'
import { SUBJECT_NAMES, TYPE_NAMES } from '@/lib/ent'
import { Button, Spinner, ErrorState, cx } from '@/components/ui'
import { Clock, Flag, ChevronLeft, ChevronRight } from 'lucide-react'
import EntCalculator from '@/components/ent-calculator'

type Answer = { selected_option_id: number | null; selected_option_ids: number[]; matching_answer: Record<string, number | string> }
type Question = Answer & { question_id: number; position: number; prompt: string; question_type: string; context_text: string; image_url: string; image_file_id: number | null; image_placement: 'before' | 'after' | 'marker'; image_width: number; image_alt: string; max_points: number; options: { id: number; text: string }[]; matching_pairs: { id: number; left_text: string }[] }
type Attempt = { id: number; title: string; rules_version: string; status: string; revision: number; remaining_seconds: number | null; server_time: string; deadline_at: string | null; requires_proctor_setup: boolean; proctor_status: string; proctor_violations: number; questions: Record<string, Question[]> }
type SaveResult = { revision: number; status: string }
const empty = (): Answer => ({ selected_option_id: null, selected_option_ids: [], matching_answer: {} })
function answered(q: Question, a: Answer) {
  if (q.question_type === 'matching') return q.matching_pairs.length > 0 && q.matching_pairs.every(p => a.matching_answer[String(p.id)] !== undefined && a.matching_answer[String(p.id)] !== '')
  return q.question_type === 'multi_choice' ? a.selected_option_ids.length > 0 : a.selected_option_id !== null
}

function QuestionPrompt({ q }: { q: Question }) {
  const src = q.image_file_id ? getFileUrl(q.image_file_id) : q.image_url
  const picture = src ? <img src={src} alt={q.image_alt || 'Сұраққа арналған сурет'} className="max-h-[520px] max-w-full rounded-xl object-contain" style={{ width: q.image_width || 640 }} /> : null
  const text = (value: string) => <p className="whitespace-pre-wrap text-lg leading-relaxed">{value.replaceAll('{{image}}', '')}</p>
  if (!picture) return text(q.prompt)
  if (q.image_placement === 'before') return <div className="space-y-4">{picture}{text(q.prompt)}</div>
  if (q.image_placement === 'marker' && q.prompt.includes('{{image}}')) {
    const at = q.prompt.indexOf('{{image}}')
    return <div className="space-y-4">{text(q.prompt.slice(0, at))}{picture}{text(q.prompt.slice(at + 9))}</div>
  }
  return <div className="space-y-4">{text(q.prompt)}{picture}</div>
}

export default function EntTestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<Attempt>(`/ent-trial/attempts/${id}`, fetcher, { revalidateOnFocus: false, refreshInterval: 30000 })
  const [subject, setSubject] = useState('kaz_history')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [flags, setFlags] = useState<Record<number, boolean>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Жауаптар сақталған')
  const [saveError, setSaveError] = useState('')
  const [proctorError, setProctorError] = useState('')
  const [proctorStarting, setProctorStarting] = useState(false)
  const [cameraPrepared, setCameraPrepared] = useState(false)
  const [screenPrepared, setScreenPrepared] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [violations, setViolations] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRef = useRef<MediaStream | null>(null)
  const screenRef = useRef<MediaStream | null>(null)
  const sessionId = useRef('')
  const initialized = useRef<number | null>(null)
  const revision = useRef(0)
  const sequence = useRef(0)
  const savedSequence = useRef(0)
  const latest = useRef<Record<number, Answer>>({})
  const inFlight = useRef<Promise<void> | null>(null)
  const submissionLock = useRef(false)
  const conflict = useRef(false)
  const all = useMemo(() => Object.values(data?.questions ?? {}).flat(), [data?.questions])
  const subjects = Object.keys(data?.questions ?? {})
  const payload = useCallback(() => all.map(q => ({ question_id: q.question_id, ...(latest.current[q.question_id] ?? empty()) })), [all])

  useEffect(() => {
    if (!data || initialized.current === data.id) return
    initialized.current = data.id; revision.current = data.revision
    setSubject(Object.keys(data.questions)[0] ?? 'kaz_history'); setIndex(0); setViolations(data.proctor_violations ?? 0)
    sessionId.current = sessionStorage.getItem(`ent-proctor-${data.id}`) || crypto.randomUUID()
    sessionStorage.setItem(`ent-proctor-${data.id}`, sessionId.current)
    const initial = Object.fromEntries(Object.values(data.questions).flat().map(q => [q.question_id, { selected_option_id: q.selected_option_id, selected_option_ids: q.selected_option_ids, matching_answer: q.matching_answer }]))
    latest.current = initial; setAnswers(initial)
    try { setFlags(JSON.parse(sessionStorage.getItem(`ent-flags-${data.id}`) || '{}')) } catch { /* optional local bookmarks */ }
  }, [data])

  useEffect(() => {
    if (data?.status === 'submitted') router.replace(`/ent-trial/${id}/result`)
    if (!data || data.remaining_seconds === null) { setTimeLeft(null); return }
    const end = performance.now() + data.remaining_seconds * 1000
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((end - performance.now()) / 1000)))
    tick(); const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [data, id, router])

  const reportProctor = useCallback(async (event_type: string, details: Record<string, unknown> = {}) => {
    if (!sessionId.current) return
    try {
      const result = await api<{ status: string; violations: number; terminated: boolean }>(`/ent-trial/attempts/${id}/proctor/events`, {
        method: 'POST', body: { session_id: sessionId.current, event_type, details },
      })
      setViolations(result.violations)
      if (result.status === 'submitted' || result.terminated) router.replace(`/ent-trial/${id}/result`)
    } catch (e) { if (event_type === 'heartbeat') setProctorError((e as Error).message) }
  }, [id, router])

  async function prepareCamera() {
    if (!data || proctorStarting) return
    setProctorStarting(true); setProctorError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Бұл браузер камераны қолдамайды')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      mediaRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { setCameraPrepared(false); setCameraReady(false); void reportProctor('camera_stopped') }, { once: true }))
      setCameraPrepared(true)
    } catch (e) { setProctorError((e as Error).message) } finally { setProctorStarting(false) }
  }

  async function prepareScreen() {
    if (!data || proctorStarting || !mediaRef.current?.active) return
    setProctorStarting(true); setProctorError('')
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Бұл браузер экран бөлісуді қолдамайды')
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false })
      if (screen.getVideoTracks()[0]?.getSettings().displaySurface !== 'monitor') {
        screen.getTracks().forEach(track => track.stop())
        throw new Error('Бөлек терезені емес, бүкіл экранды таңдаңыз')
      }
      screenRef.current = screen
      screen.getVideoTracks().forEach(track => track.addEventListener('ended', () => { setScreenPrepared(false); setCameraReady(false); void reportProctor('screen_share_stopped') }, { once: true }))
      setScreenPrepared(true)
    } catch (e) { setProctorError((e as Error).message) } finally { setProctorStarting(false) }
  }

  async function startProctoring() {
    if (!data || proctorStarting || !mediaRef.current?.active || !screenRef.current?.active) return
    setProctorStarting(true); setProctorError('')
    try {
      if (!document.documentElement.requestFullscreen) throw new Error('Бұл браузер толық экран режимін қолдамайды')
      await document.documentElement.requestFullscreen()
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (!document.fullscreenElement) throw new Error('Толық экран режимі қосылмады. Қайтадан көріңіз.')
      await api(`/ent-trial/attempts/${id}/proctor/activate`, { method: 'POST', body: { session_id: sessionId.current, camera_active: mediaRef.current.active, screen_active: screenRef.current.active, fullscreen: true } })
      setCameraReady(true)
      await mutate()
    } catch (e) {
      if (document.fullscreenElement) void document.exitFullscreen()
      setProctorError((e as Error).message)
    } finally { setProctorStarting(false) }
  }

  useEffect(() => {
    if (!data || data.requires_proctor_setup || data.status !== 'in_progress' || (data.proctor_status === 'active' && !cameraReady)) return
    const visibility = () => { if (document.hidden) void reportProctor('tab_hidden') }
    const blur = () => { window.setTimeout(() => { if (!document.hasFocus()) void reportProctor('window_blur') }, 400) }
    const fullscreen = () => { if (!document.fullscreenElement) { setCameraReady(false); void reportProctor('fullscreen_exit') } }
    const block = (event: Event) => { event.preventDefault(); void reportProctor(event.type === 'contextmenu' ? 'context_menu' : event.type) }
    const shortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'p', 'u'].includes(key) || event.key === 'F12') {
        event.preventDefault(); void reportProctor('forbidden_shortcut', { key })
      }
    }
    document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', blur)
    document.addEventListener('fullscreenchange', fullscreen); document.addEventListener('copy', block)
    document.addEventListener('cut', block); document.addEventListener('paste', block); document.addEventListener('contextmenu', block)
    document.addEventListener('keydown', shortcut)
    const heartbeat = window.setInterval(() => { void reportProctor('heartbeat', { fullscreen: Boolean(document.fullscreenElement), camera: mediaRef.current?.active ?? false, screen: screenRef.current?.active ?? false }) }, 15000)
    return () => {
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', blur)
      document.removeEventListener('fullscreenchange', fullscreen); document.removeEventListener('copy', block)
      document.removeEventListener('cut', block); document.removeEventListener('paste', block); document.removeEventListener('contextmenu', block)
      document.removeEventListener('keydown', shortcut); window.clearInterval(heartbeat)
    }
  }, [cameraReady, data?.proctor_status, data?.requires_proctor_setup, data?.status, reportProctor])

  useEffect(() => { if (cameraReady && videoRef.current && mediaRef.current) videoRef.current.srcObject = mediaRef.current }, [cameraReady, data?.requires_proctor_setup])

  useEffect(() => () => { mediaRef.current?.getTracks().forEach(track => track.stop()); screenRef.current?.getTracks().forEach(track => track.stop()) }, [])

  const save = useCallback(async () => {
    if (inFlight.current) { await inFlight.current; return }
    if (conflict.current || submissionLock.current || sequence.current === savedSequence.current) return
    const current = sequence.current
    setSaveStatus('Сақталуда…'); setSaveError('')
    const request = (async () => {
      try {
        const res = await api<SaveResult>(`/ent-trial/attempts/${id}/answers`, { method: 'PATCH', body: { revision: revision.current, answers: payload() } })
        revision.current = res.revision; savedSequence.current = current
        setSaveStatus(sequence.current === current ? 'Барлық жауап сақталды' : 'Сақталуда…')
        if (res.status === 'submitted') router.replace(`/ent-trial/${id}/result`)
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) conflict.current = true
        setSaveError((e as Error).message); setSaveStatus('Сақтау орындалмады')
      }
    })()
    inFlight.current = request
    try { await request } finally { inFlight.current = null }
  }, [id, payload, router])

  useEffect(() => {
    if (!data || data.status !== 'in_progress' || data.requires_proctor_setup || (data.proctor_status === 'active' && !cameraReady) || initialized.current !== data.id) return
    const timer = window.setTimeout(() => { void save() }, 350)
    // Periodic retry also saves edits made while a previous request was in flight.
    const retry = window.setInterval(() => { void save() }, 5000)
    return () => { window.clearTimeout(timer); window.clearInterval(retry) }
  }, [answers, cameraReady, data?.id, data?.proctor_status, data?.status, data?.requires_proctor_setup, save])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (sequence.current !== savedSequence.current && !submissionLock.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const submit = useCallback(async (confirmFirst: boolean) => {
    if (submissionLock.current || data?.status !== 'in_progress') return
    const missing = all.filter(q => !answered(q, latest.current[q.question_id] ?? empty())).length
    if (confirmFirst && !confirm(`Тестті аяқтайсыз ба? Толық жауап берілмеген сұрақтар: ${missing}. Аяқтағаннан кейін жауаптарды өзгерту мүмкін емес.`)) return
    submissionLock.current = true; setSubmitting(true); setSaveError('')
    if (inFlight.current) await inFlight.current
    try {
      const res = await api<SaveResult>(`/ent-trial/attempts/${id}/submit`, { method: 'POST', body: { revision: revision.current, answers: payload() } })
      revision.current = res.revision; savedSequence.current = sequence.current
      router.replace(`/ent-trial/${id}/result`)
    } catch (e) {
      setSaveError((e as Error).message); submissionLock.current = false; setSubmitting(false)
    }
  }, [all, data?.status, id, payload, router])

  useEffect(() => { if (timeLeft === 0 && data?.status === 'in_progress') void submit(false) }, [timeLeft, data?.status, submit])

  function change(qid: number, answer: Answer) {
    if (submitting || timeLeft === 0 || conflict.current) return
    const next = { ...latest.current, [qid]: answer }
    latest.current = next; sequence.current += 1; setAnswers(next); setSaveStatus('Сақталуда…')
  }
  function flag(qid: number) {
    const next = { ...flags, [qid]: !flags[qid] }; setFlags(next)
    try { sessionStorage.setItem(`ent-flags-${id}`, JSON.stringify(next)) } catch { /* bookmarking must not stop the exam */ }
  }
  if (isLoading || !data) return error ? <ErrorState message={error.message} /> : <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (data.status === 'submitted') return <Spinner />
  if (data.requires_proctor_setup || (data.proctor_status === 'active' && !cameraReady)) return <div className="mx-auto max-w-2xl py-10"><div className="space-y-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
    <div><p className="text-sm font-semibold text-primary">Прокторингті тексеру</p><h1 className="mt-1 text-2xl font-bold">{data.title}</h1></div>
    <p className="text-muted">Тест уақыты камера, бүкіл экранды бөлісу және толық экран режимі қосылғаннан кейін ғана басталады.</p>
    <ul className="list-disc space-y-2 pl-5 text-sm"><li>Алдымен камераны тексеріңіз, содан кейін «Бүкіл экран» нұсқасын таңдаңыз.</li><li>Қойындыны ауыстыруға, экран бөлісуді тоқтатуға және толық экраннан шығуға болмайды.</li><li>Көшіру, қою, оң жақ мәзір және тыйым салынған пернелер бұғатталады.</li><li>Үш тіркелген бұзушылықтан кейін тест автоматты түрде аяқталады.</li><li>Камера мен экран бейнесі жазылмайды және серверге жіберілмейді; браузер тек олардың қосулы екенін бақылайды.</li></ul>
    <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />
    {proctorError && <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">{proctorError}</p>}
    {!cameraPrepared ? <Button className="w-full" disabled={proctorStarting} onClick={() => void prepareCamera()}>{proctorStarting ? 'Камера тексерілуде…' : '1. Камераны қосу және тексеру'}</Button>
      : !screenPrepared ? <Button className="w-full" disabled={proctorStarting} onClick={() => void prepareScreen()}>{proctorStarting ? 'Экран таңдалуда…' : '2. Бүкіл экранды бөлісу'}</Button>
      : <Button className="w-full" disabled={proctorStarting} onClick={() => void startProctoring()}>{proctorStarting ? 'Тест басталуда…' : '3. Толық экранды қосып, тестті бастау'}</Button>}
    <p className="text-xs text-muted">Маңызды: браузер басқа телефонды немесе экран сыртындағы әрекеттерді толық анықтай алмайды. Күмәнді оқиғалар әкімші журналында сақталады.</p>
  </div></div>
  const questions = data.questions[subject] ?? []
  const q = questions[index]
  const answer = q ? answers[q.question_id] ?? empty() : empty()
  const count = all.filter(q => answered(q, answers[q.question_id] ?? empty())).length
  const seconds = timeLeft ?? data.remaining_seconds ?? 0
  const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
  const disabled = submitting || timeLeft === 0 || conflict.current
  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div><h1 className="text-xl font-bold">{data.title}</h1><p className="text-sm text-muted">Жауап берілді: {count}/{all.length} сұрақ</p></div>
      <div className="flex items-center gap-4"><span className="text-xs text-muted">Бұзушылық: {violations}/3</span><span className={cx('flex items-center gap-2 font-mono text-xl font-bold', seconds < 600 && 'text-danger')}><Clock size={20} />{time}</span><Button disabled={submitting} onClick={() => void submit(true)}>{submitting ? 'Аяқталуда…' : 'Тестті аяқтау'}</Button></div>
    </header>
    {data.rules_version === 'legacy' && <p className="rounded-xl bg-warning/10 p-3 text-sm">Бұл — жаңартуға дейін басталған, ескі форматтағы тест. Жаңа ҰБТ құрылымына сай емес.</p>}
    <div aria-live="polite" className="text-sm text-muted">{saveStatus}</div>
    {saveError && <div role="alert" className="space-y-2 rounded-xl border border-danger p-4 text-sm text-danger"><p>Жауаптарды сақтау қатесі: {saveError}</p><p>Сақтау расталмайынша бетті жаппаңыз. Басқа терезеде тест ашылса, оны жабыңыз.</p><Button variant="secondary" onClick={() => conflict.current ? window.location.reload() : void save()}>{conflict.current ? 'Сервердегі жауаптарды қайта жүктеу' : 'Қайта сақтау'}</Button></div>}
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
      <aside className="space-y-4"><div className="flex flex-wrap gap-2 lg:flex-col">{subjects.map(s => <button key={s} onClick={() => { setSubject(s); setIndex(0) }} className={cx('rounded-xl border p-3 text-left text-sm font-semibold', subject === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface')}>{SUBJECT_NAMES[s] || s}<span className="ml-2 opacity-75">{data.questions[s].filter(q => answered(q, answers[q.question_id] ?? empty())).length}/{data.questions[s].length}</span></button>)}</div>
        <div className="flex flex-wrap gap-2">{questions.map((item, i) => <button key={item.question_id} onClick={() => setIndex(i)} aria-label={`Сұрақ ${item.position + 1}${flags[item.question_id] ? ', кейін қарау' : ''}`} aria-current={i === index ? 'step' : undefined} className={cx('relative h-10 min-w-10 rounded-lg border text-sm font-bold', i === index ? 'border-primary ring-2 ring-primary' : 'border-border', answered(item, answers[item.question_id] ?? empty()) ? 'bg-primary-soft text-primary' : 'bg-surface')}>
          {item.position + 1}{flags[item.question_id] && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning" />}
        </button>)}</div><p className="text-xs text-muted">Боялған — жауап берілген; сары белгі — кейін қарау. Жауаптың дұрыстығы тест барысында көрсетілмейді.</p>
      </aside>
      <main className="min-w-0">{q ? <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">№{q.position + 1} · {TYPE_NAMES[q.question_type]}</h2><span className="text-sm text-muted">{q.max_points} балл</span></div>
        {q.context_text && <section className="rounded-xl border border-border bg-surface-muted p-5"><h3 className="mb-3 text-sm font-bold text-primary">Ортақ контекст</h3><p className="whitespace-pre-wrap leading-relaxed">{q.context_text}</p></section>}
        <QuestionPrompt q={q} />
        <fieldset disabled={disabled} className="space-y-3">
          <legend className="sr-only">Жауапты таңдаңыз</legend>
          {q.question_type === 'multi_choice' && <p className="text-sm text-muted">Бір немесе бірнеше дұрыс жауапты белгілеңіз. Таңдалғаны: {answer.selected_option_ids.length}.</p>}
          {q.question_type !== 'matching' ? q.options.map((o, i) => {
            const multiple = q.question_type === 'multi_choice'
            const selected = multiple ? answer.selected_option_ids.includes(o.id) : answer.selected_option_id === o.id
            return <label key={o.id} className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-4', selected ? 'border-primary bg-primary-soft' : 'border-border')}>
              <input type={multiple ? 'checkbox' : 'radio'} name={`q-${q.question_id}`} checked={selected} className="mt-1 h-5 w-5 shrink-0" onChange={() => change(q.question_id, multiple ? { ...answer, selected_option_ids: selected ? answer.selected_option_ids.filter(v => v !== o.id) : [...answer.selected_option_ids, o.id] } : { ...answer, selected_option_id: o.id })} />
              <span className="whitespace-pre-wrap"><b className="mr-2">{String.fromCharCode(65 + i)}.</b>{o.text}</span>
            </label>
          }) : <>
            <div className="space-y-2 rounded-xl bg-surface-muted p-4">{q.options.map((o, i) => <p key={o.id}><b>{i + 1}.</b> {o.text}</p>)}</div>
            {q.matching_pairs.map((pair, i) => <label key={pair.id} className="grid items-center gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"><span><b>{String.fromCharCode(65 + i)}.</b> {pair.left_text}</span><select className="w-full rounded-xl border border-border bg-surface p-3" value={answer.matching_answer[String(pair.id)] ?? ''} onChange={e => change(q.question_id, { ...answer, matching_answer: { ...answer.matching_answer, [String(pair.id)]: e.target.value === '' ? '' : Number(e.target.value) } })}>
              <option value="">Жауапты таңдаңыз</option>{q.options.map((o, j) => <option key={o.id} value={o.id}>{j + 1}. {o.text}</option>)}
            </select></label>)}
          </>}
        </fieldset>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4"><Button variant="ghost" disabled={disabled} onClick={() => change(q.question_id, empty())}>Жауапты тазарту</Button><Button variant="secondary" onClick={() => flag(q.question_id)}><Flag size={16} />{flags[q.question_id] ? 'Белгіні алып тастау' : 'Кейін қарау'}</Button></div>
        <div className="flex justify-between gap-3"><Button variant="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft size={16} />Алдыңғы</Button><Button variant="secondary" disabled={index === questions.length - 1} onClick={() => setIndex(i => i + 1)}>Келесі<ChevronRight size={16} /></Button></div>
      </div> : <p>Бұл ескі әрекетте осы пәннің сұрақтары жоқ.</p>}</main>
    </div>
    <video ref={videoRef} autoPlay muted playsInline className="fixed bottom-20 left-5 z-30 aspect-video w-32 rounded-xl border border-border bg-black object-cover shadow-lg" aria-label="Камераны бақылау" />
    <EntCalculator />
  </div>
}
