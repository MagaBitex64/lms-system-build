'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { api, fetcher, getFileUrl } from '@/lib/api'
import { SUBJECT_NAMES, TYPE_NAMES, type Slot, type SubjectRule, type ContextBlock } from '@/lib/ent'
import { Button, Card, Spinner, ErrorState, cx } from '@/components/ui'

type Option = { text: string; is_correct: boolean }
type Pair = { left_text: string; correct_option_position: number | null; right_text?: string }
type Question = { id: number; subject: string; position: number; prompt: string; question_type: string; difficulty: string | null; image_url: string; image_file_id: number | null; image_placement: 'before' | 'after' | 'marker'; image_width: number; image_alt: string; context_mode: 'shared' | 'addendum' | 'override'; context_override: string; explanation: string; context_text: string; options: Option[]; matching_pairs: Pair[] }
type EditorData = {
  items: Question[]; rules: Record<string, SubjectRule>;
  contexts: { subject: string; start_position: number; content: string }[];
  validation: { ready: boolean; issues: { subject: string; position: number | null; message: string }[]; question_count: number; max_score: number; duration_seconds: number }
  variant: { exam_mode: 'full' | 'single'; single_subject: string | null }
}
const inputClass = 'w-full rounded-xl border border-border bg-surface p-3 text-foreground'

export default function VariantEditor({ variantId, variants, onSelectVariant, onSaved }: {
  variantId: number | null; variants: { id: number; title: string }[]; onSelectVariant: (id: number | null) => void; onSaved: () => void
}) {
  const { data, error, isLoading, mutate } = useSWR<EditorData>(variantId ? `/ent-trial/admin/variants/${variantId}/questions` : null, fetcher, { revalidateOnFocus: false })
  const [subject, setSubject] = useState('kaz_history')
  const [position, setPosition] = useState(0)
  const [dirtySources, setDirtySources] = useState<Record<string, boolean>>({})
  const dirty = Object.values(dirtySources).some(Boolean)
  const setDirty = (value: boolean) => setDirtySources(prev => ({ ...prev, question: value }))
  const [actionError, setActionError] = useState('')
  useEffect(() => {
    if (data && !data.rules[subject]) { setSubject(Object.keys(data.rules)[0]); setPosition(0) }
  }, [data, subject])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function navigate(action: () => void, leavingSubject = true) {
    if ((leavingSubject ? dirty : dirtySources.question) && !confirm('Сақталмаған өзгерістер бар. Оларды сақтамай шығасыз ба?')) return
    setDirtySources(prev => leavingSubject ? {} : { ...prev, question: false }); setActionError(''); action()
  }
  async function refresh() { await mutate(); onSaved() }
  async function remove(q: Question) {
    if (!confirm(`№${q.position + 1} сұрағын жою керек пе? Қалған сұрақтардың нөмірлері өзгермейді.`)) return
    try { await api(`/ent-trial/admin/questions/${q.id}`, { method: 'DELETE' }); await refresh() }
    catch (e) { setActionError((e as Error).message) }
  }
  const rule = data?.rules[subject]
  const slot = rule?.slots[position]
  const question = data?.items.find(q => q.subject === subject && q.position === position)
  const currentContext = data?.contexts.find(c => c.subject === subject && c.start_position === slot?.context_start)?.content.trim() ?? ''
  const contextWords = currentContext ? currentContext.split(/\s+/).length : 0
  const wordRange = rule?.contexts.find(c => c.start === slot?.context_start)?.word_range
  const contextReady = slot?.context_start === null || Boolean(currentContext && (!wordRange || (contextWords >= wordRange[0] && contextWords <= wordRange[1])))
  const extras = data?.items.filter(q => !data.rules[q.subject]?.slots[q.position] || data.items.find(x => x.subject === q.subject && x.position === q.position)?.id !== q.id) ?? []
  return <div className="space-y-5">
    <label className="block space-y-2"><span className="text-sm font-semibold">Вариант</span>
      <select className={inputClass} value={variantId ?? ''} onChange={e => navigate(() => { onSelectVariant(Number(e.target.value) || null); setSubject('kaz_history'); setPosition(0) })}>
        <option value="">Вариантты таңдаңыз</option>{variants.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
      </select>
    </label>
    {isLoading && <Spinner />}{error && <ErrorState message={error.message} />}{actionError && <ErrorState message={actionError} />}
    {data && <>
      <Card className="space-y-3 p-5">
        <h2 className="text-lg font-bold">{data.validation.ready ? '✓ Вариант дайын' : 'Вариант әлі дайын емес'} · {data.validation.question_count}/{Object.values(data.rules).reduce((n, r) => n + r.slots.length, 0)} сұрақ</h2>
        <p className="text-sm text-muted">{Object.keys(data.rules).length} пән · {data.validation.max_score} балл · {Math.round(data.validation.duration_seconds / 60)} минут. Сұрақ түрі мен орны автоматты түрде бекітілген. Барлық талап орындалғаннан кейін ғана оқушыларға рұқсат беріледі.</p>
        {!data.validation.ready && <details><summary className="cursor-pointer font-medium text-warning">Толықтыру қажет: {data.validation.issues.length} ескерту</summary>
          <div className="mt-3 max-h-64 space-y-1 overflow-auto">{data.validation.issues.map((issue, i) => <button key={i} className="block text-left text-sm hover:underline" onClick={() => navigate(() => { if (data.rules[issue.subject]) { setSubject(issue.subject); setPosition(issue.position !== null && data.rules[issue.subject].slots[issue.position] ? issue.position : 0) } })}>
            {SUBJECT_NAMES[issue.subject] || issue.subject}{issue.position !== null ? ` №${issue.position + 1}` : ''}: {issue.message}
          </button>)}</div>
        </details>}
      </Card>
      <div className="flex flex-wrap gap-2">{Object.entries(data.rules).map(([key, r]) => <Button key={key} variant={subject === key ? 'primary' : 'secondary'} onClick={() => navigate(() => { setSubject(key); setPosition(0) })}>{r.label} · {data.items.filter(q => q.subject === key).length}/{r.slots.length}</Button>)}</div>
      {rule && <>
        <p className="text-sm text-muted">Күрделілік: {Object.entries(rule.difficulty_quota).map(([level, quota]) => `${level}: ${data.items.filter(q => q.subject === subject && q.difficulty === level).length}/${quota}`).join(' · ')}. Деңгейді сұрақ мазмұнына қарай таңдаңыз.</p>
        <div className="grid gap-4 lg:grid-cols-2">{rule.contexts.map(block => <ContextEditor key={`${variantId}-${subject}-${block.start}`} block={block} variantId={variantId!} subject={subject} initial={data.contexts.find(c => c.subject === subject && c.start_position === block.start)?.content ?? ''} onSaved={refresh} onDirty={value => setDirtySources(prev => ({ ...prev, [`context-${block.start}`]: value }))} />)}</div>
        <div className="flex flex-wrap gap-2" aria-label="Сұрақ нөмірін таңдау">{rule.slots.map(s => {
          const exists = data.items.some(q => q.subject === subject && q.position === s.position)
          const invalid = data.validation.issues.some(i => i.subject === subject && i.position === s.position)
          return <button key={s.position} onClick={() => navigate(() => setPosition(s.position), false)} title={`${s.number}. ${TYPE_NAMES[s.question_type]}${invalid ? ' · Тексеру қажет' : ''}`} aria-pressed={position === s.position}
            className={cx('h-11 min-w-11 rounded-xl border px-2 text-sm font-bold', position === s.position ? 'border-primary bg-primary text-primary-foreground' : invalid && exists ? 'border-warning bg-warning/10' : exists ? 'border-success bg-success/10' : 'border-border bg-surface')}>{s.number}</button>
        })}</div>
        {slot && <QuestionEditor key={`${variantId}-${subject}-${position}-${question?.id ?? 'new'}`} variantId={variantId!} subject={subject} slot={slot} question={question} contextReady={contextReady} onSaved={refresh} onDirty={setDirty} />}
        {question && <Button variant="danger" onClick={() => void remove(question)}>Осы сұрақты жою</Button>}
      </>}
      {extras.length > 0 && <Card className="space-y-3 p-5"><h3 className="font-semibold">Құрылымнан тыс ескі сұрақтар</h3><p className="text-sm text-muted">Мәтіндер сақталған. Қажетті мазмұнды тиісті орынға көшіріп, содан кейін артық сұрақты жойыңыз.</p>{extras.map(q => <details key={q.id}><summary>{SUBJECT_NAMES[q.subject] || q.subject} №{q.position + 1} · ID {q.id}</summary><p className="whitespace-pre-wrap py-3">{q.prompt}</p><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(q, null, 2)}</pre><Button variant="danger" onClick={() => void remove(q)}>Артық сұрақты жою</Button></details>)}</Card>}
    </>}
  </div>
}

function ContextEditor({ block, variantId, subject, initial, onSaved, onDirty }: { block: ContextBlock; variantId: number; subject: string; initial: string; onSaved: () => Promise<void>; onDirty: (value: boolean) => void }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try { await api(`/ent-trial/admin/variants/${variantId}/contexts/${subject}/${block.start}`, { method: 'PUT', body: { content: text } }); setSaved(text); onDirty(false); await onSaved() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <Card className="space-y-3 p-4">
    <label className="block space-y-2"><span className="font-semibold">Ортақ контекст: №{block.start + 1}–{block.end + 1}</span>
      <textarea className={inputClass} rows={6} maxLength={30000} value={text} onChange={e => { setText(e.target.value); onDirty(e.target.value !== saved) }} placeholder="Контекст бір рет енгізіледі және осы блоктағы барлық сұрақта көрсетіледі." />
    </label>
    <p className="text-xs text-muted">{text.trim() ? text.trim().split(/\s+/).length : 0} сөз{block.word_range ? ` · Қажет: ${block.word_range.join('–')} сөз` : ''}</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button variant="secondary" disabled={busy || text === saved} onClick={() => void save()}>{busy ? 'Сақталуда…' : text === saved && saved ? 'Контекст сақталған' : 'Контекстті сақтау'}</Button>
  </Card>
}

function QuestionEditor({ variantId, subject, slot, question, contextReady, onSaved, onDirty }: { variantId: number; subject: string; slot: Slot; question?: Question; contextReady: boolean; onSaved: () => Promise<void>; onDirty: (value: boolean) => void }) {
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? '')
  const [imageFileId, setImageFileId] = useState<number | null>(question?.image_file_id ?? null)
  const [legacyImageUrl, setLegacyImageUrl] = useState(question?.image_url ?? '')
  const [imagePlacement, setImagePlacement] = useState<'before' | 'after' | 'marker'>(question?.image_placement ?? 'after')
  const [imageWidth, setImageWidth] = useState(question?.image_width ?? 640)
  const [imageAlt, setImageAlt] = useState(question?.image_alt ?? '')
  const [contextMode, setContextMode] = useState<'shared' | 'addendum' | 'override'>(question?.context_mode ?? 'shared')
  const [contextOverride, setContextOverride] = useState(question?.context_override ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [options, setOptions] = useState<Option[]>(Array.from({ length: slot.option_count }, (_, i) => question?.options[i] ?? { text: '', is_correct: false }))
  const [pairs, setPairs] = useState<Pair[]>(Array.from({ length: 2 }, (_, i) => question?.matching_pairs[i] ?? { left_text: '', correct_option_position: null }))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const correctCount = options.filter(o => o.is_correct).length
  const previewUrl = imageFileId ? getFileUrl(imageFileId) : legacyImageUrl
  async function uploadImage(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage('Тек сурет файлын таңдаңыз'); return }
    setUploading(true); setMessage('')
    try {
      const formData = new FormData(); formData.append('file', file)
      const uploaded = await api<{ id: number }>('/files/upload', { method: 'POST', formData })
      setImageFileId(uploaded.id); setLegacyImageUrl(''); onDirty(true); setSaved(false)
    } catch (err) { setMessage((err as Error).message) } finally { setUploading(false) }
  }
  function insertImageMarker() {
    const el = promptRef.current
    const start = el?.selectionStart ?? prompt.length
    const end = el?.selectionEnd ?? start
    const next = `${prompt.slice(0, start)}{{image}}${prompt.slice(end)}`
    setPrompt(next); setImagePlacement('marker'); onDirty(true)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + 9, start + 9) })
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(''); setSaved(false)
    try {
      await api('/ent-trial/admin/questions', { method: 'POST', body: { variant_id: variantId, subject, position: slot.position, question_type: slot.question_type, prompt, difficulty, image_url: legacyImageUrl, image_file_id: imageFileId, image_placement: imagePlacement, image_width: imageWidth, image_alt: imageAlt, context_mode: slot.context_start === null ? 'shared' : contextMode, context_override: slot.context_start === null ? '' : contextOverride, explanation, options, matching_pairs: slot.question_type === 'matching' ? pairs : [] } })
      onDirty(false); setSaved(true); await onSaved()
    } catch (err) { setMessage((err as Error).message) } finally { setBusy(false) }
  }
  return <Card className="p-5 sm:p-6"><form onSubmit={save} onChange={() => { onDirty(true); setSaved(false) }} className="space-y-5">
    <div><h3 className="text-xl font-bold">№{slot.number} · {TYPE_NAMES[slot.question_type]}</h3><p className="mt-1 text-sm text-muted">{slot.max_points} балл. Түрін немесе нөмірін өзгертуге болмайды.{slot.context_start !== null ? ' Контекст жоғарыдағы ортақ блоктан алынады.' : ''}</p></div>
    {slot.context_start !== null && <details className="rounded-xl border border-border p-4" open={contextMode !== 'shared'}><summary className="cursor-pointer font-semibold">Осы сұрақтың контекстін жеке баптау</summary><div className="mt-4 space-y-3">
      <p className="text-sm text-muted">Әдетте «Ортақ контекст» қалдырыңыз. Тек осы сұраққа қосымша түсініктеме қосуға немесе ортақ мәтінді ауыстыруға болады.</p>
      <select className={inputClass} value={contextMode} onChange={e => setContextMode(e.target.value as typeof contextMode)}><option value="shared">Ортақ контекстті өзгеріссіз қолдану</option><option value="addendum">Ортақ контекстке мәтін қосу</option><option value="override">Тек осы сұрақта контекстті ауыстыру</option></select>
      {contextMode !== 'shared' && <textarea className={inputClass} rows={4} maxLength={30000} required value={contextOverride} onChange={e => setContextOverride(e.target.value)} placeholder={contextMode === 'addendum' ? 'Ортақ контексттен кейін көрсетілетін қосымша мәтін' : 'Тек осы сұрақта көрсетілетін контекст'} />}
      {question?.context_text && !question.context_override && <p className="rounded-xl bg-warning/10 p-3 text-sm">Ескі жеке контекст табылды. Қажет болса, оны осы өріске көшіріңіз: {question.context_text}</p>}
    </div></details>}
    <label className="block space-y-2"><span>Сұрақ мәтіні</span><textarea ref={promptRef} maxLength={10000} className={inputClass} rows={5} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Сурет сұрақтың толық мәтінін қамтыса, бұл өрісті бос қалдыруға болады." /></label>
    <Card className="space-y-4 bg-surface-muted p-4"><div><h4 className="font-semibold">Сұрақ суреті (міндетті емес)</h4><p className="text-sm text-muted">Кез келген сұраққа JPG, PNG, GIF немесе WebP жүктеуге болады.</p></div>
      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={uploading} onChange={e => { void uploadImage(e.target.files?.[0]); e.currentTarget.value = '' }} />
      {uploading && <p className="text-sm text-muted">Сурет жүктелуде…</p>}
      {previewUrl && <><img src={previewUrl} alt={imageAlt || 'Сұрақ суреті'} className="max-h-72 max-w-full rounded-xl object-contain" style={{ width: Math.min(imageWidth, 760) }} />
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2"><span className="text-sm">Суреттің орны</span><select className={inputClass} value={imagePlacement} onChange={e => setImagePlacement(e.target.value as typeof imagePlacement)}><option value="before">Мәтіннің алдында</option><option value="after">Мәтіннен кейін</option><option value="marker">Мәтін ішіндегі белгі орнында</option></select></label>
          <label className="space-y-2"><span className="text-sm">Ені: {imageWidth}px</span><input className="w-full" type="range" min="120" max="1200" step="20" value={imageWidth} onChange={e => setImageWidth(Number(e.target.value))} /></label></div>
        {imagePlacement === 'marker' && <div className="space-y-2"><Button type="button" variant="secondary" onClick={insertImageMarker}>Курсор тұрған жерге сурет орнын қою</Button><p className="text-xs text-muted">Мәтінде <code>{'{{image}}'}</code> белгісі болуы керек. Оны мәтін ішінде жылжытуға болады.</p></div>}
        <label className="block space-y-2"><span className="text-sm">Сурет сипаттамасы</span><input className={inputClass} maxLength={500} value={imageAlt} onChange={e => setImageAlt(e.target.value)} placeholder="Мысалы: функция графигі" /></label>
        <Button type="button" variant="danger" onClick={() => { setImageFileId(null); setLegacyImageUrl(''); setImagePlacement('after'); setPrompt(v => v.replace('{{image}}', '')); onDirty(true) }}>Суретті сұрақтан алып тастау</Button></>}
    </Card>
    <label className="block space-y-2"><span>Күрделілік деңгейі</span><select required className={inputClass} value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="">Деңгейді таңдаңыз</option><option value="A">A · базалық</option><option value="B">B · орташа</option><option value="C">C · жоғары</option></select></label>
    <fieldset className="space-y-3"><legend className="mb-2 font-semibold">{slot.option_count} жауап нұсқасы{slot.question_type === 'matching' ? ' · дұрыс сәйкестіктер төменде таңдалады' : ' · дұрысын белгілеңіз'}</legend>
      {options.map((o, i) => <div key={i} className="flex items-center gap-3">
        {slot.question_type !== 'matching' && <input aria-label={`${String.fromCharCode(65 + i)} дұрыс жауап`} type={slot.question_type === 'multi_choice' ? 'checkbox' : 'radio'} name="correct-option" checked={o.is_correct} onChange={e => setOptions(prev => prev.map((v, j) => ({ ...v, is_correct: j === i ? e.target.checked : slot.question_type === 'multi_choice' ? v.is_correct : false })))} className="h-5 w-5" />}
        <label className="flex flex-1 items-center gap-2"><span className="font-semibold">{String.fromCharCode(65 + i)}</span><input required aria-label={`Жауап ${String.fromCharCode(65 + i)}`} maxLength={2000} className={inputClass} value={o.text} onChange={e => setOptions(prev => prev.map((v, j) => j === i ? { ...v, text: e.target.value } : v))} /></label>
      </div>)}
      {slot.question_type !== 'matching' && <p className="text-sm text-muted">Дұрыс жауаптар: {correctCount}. Қажет: {slot.question_type === 'multi_choice' ? '1–3' : '1'}.</p>}
    </fieldset>
    {slot.question_type === 'matching' && <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Сәйкестендіру жолдары</legend>{pairs.map((p, i) => <div key={i} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-2"><span>Жол {String.fromCharCode(65 + i)}</span><input required maxLength={1000} className={inputClass} value={p.left_text} onChange={e => setPairs(prev => prev.map((v, j) => j === i ? { ...v, left_text: e.target.value } : v))} /></label>
      <label className="space-y-2"><span>Дұрыс сәйкестік</span><select required className={inputClass} value={p.correct_option_position ?? ''} onChange={e => setPairs(prev => prev.map((v, j) => j === i ? { ...v, correct_option_position: e.target.value === '' ? null : Number(e.target.value) } : v))}><option value="">Таңдаңыз</option>{options.map((o, j) => <option key={j} value={j}>{String.fromCharCode(65 + j)} · {o.text || 'Толтырылмаған'}</option>)}</select></label>
    </div>)}</fieldset>}
    <label className="block space-y-2"><span>Түсіндірме (тест аяқталғаннан кейін көрсетіледі)</span><textarea maxLength={5000} className={inputClass} rows={3} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>
    {message && <p role="alert" className="text-sm text-danger">{message}</p>}{saved && <p role="status" className="text-sm text-success">Сұрақ сақталды</p>}
    {!contextReady && <p className="rounded-xl bg-warning/10 p-3 text-sm">Алдымен жоғарыдағы осы блоктың ортақ контекстін толтырып, сақтаңыз. Мәтін көлемі талапқа сай болуы керек.</p>}
    <Button type="submit" disabled={busy || !contextReady}>{busy ? 'Сақталуда…' : `№${slot.number} сұрағын сақтау`}</Button>
  </form></Card>
}
