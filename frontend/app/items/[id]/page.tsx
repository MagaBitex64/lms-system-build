'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  Paperclip,
  PlayCircle,
  PlusCircle,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n, type TKey } from '@/lib/i18n'
import { api, downloadFile, ApiError } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui'

type ItemType = 'lesson' | 'quiz' | 'homework'
type QuestionType = 'single' | 'multiple' | 'short_text' | 'long_text'

type Material = {
  id: number
  kind: 'file' | 'link'
  label?: string
  url?: string
  file_id?: number
  original_name?: string
}

type QuestionOption = { id: number; text: string; is_correct?: boolean }
type Question = {
  id: number
  type: QuestionType
  prompt: string
  image_file_id?: number | null
  points: number
  explanation?: string
  options: QuestionOption[]
}

type AttemptAnswer = {
  question_id: number
  selected_option_ids: number[]
  text_answer: string
  awarded_points: number | null
}

type QuizAttempt = {
  id: number
  submitted_at: string
  auto_score: number
  manual_score: number | null
  status: string
  answers: AttemptAnswer[]
}

type ItemDetail = {
  type?: ItemType
  is_owner?: boolean
  item: { id: number; title: string; note?: string; course_id: number }
  content?: string
  youtube_url?: string
  materials?: Material[]
  has_quiz?: boolean
  quiz_started?: boolean
  question_count?: number
  description?: string
  open_at?: string | null
  deadline_at?: string | null
  close_at?: string | null
  time_limit_minutes?: number | null
  max_score?: number
  weight_pct?: number
  total_points?: number
  questions?: Question[]
  attempt?: QuizAttempt | null
  submission?: {
    id: number
    comment: string
    submitted_at: string
    grade: number | null
    feedback: string
    status: string
    files: Array<{ id: number; original_name: string; mime?: string; size?: number }>
  } | null
}

type UploadedFile = { id: number; original_name: string; mime: string; size: number; created_at: string }

const ENDPOINTS = ['/courses/lessons/', '/quizzes/', '/homework/']

async function itemFetcher(id: string): Promise<ItemDetail> {
  for (const base of ENDPOINTS) {
    try {
      return await api<ItemDetail>(`${base}${id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) continue
      throw err
    }
  }
  throw new ApiError(404, 'Not found')
}

function fmtDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function fromDateInput(value: string) {
  return value ? new Date(value).toISOString() : null
}

function statusLabel(status: string, t: (key: TKey) => string) {
  if (status === 'pending_review') return t('pendingReview')
  if (status === 'not_started') return t('notStarted')
  if (status === 'submitted') return t('submitted')
  if (status === 'graded') return t('graded')
  return status
}

function questionLabel(type: QuestionType, t: (key: TKey) => string) {
  if (type === 'single') return t('singleChoice')
  if (type === 'multiple') return t('multipleChoice')
  if (type === 'short_text') return t('shortText')
  return t('longText')
}

function inferType(data: ItemDetail): ItemType {
  if (data.type) return data.type
  if (data.questions) return 'quiz'
  if (data.materials) return 'lesson'
  return 'homework'
}

function youtubeEmbedUrl(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    let id = ''
    if (url.hostname.includes('youtu.be')) {
      id = url.pathname.slice(1)
    } else if (url.pathname.startsWith('/shorts/')) {
      id = url.pathname.split('/')[2] ?? ''
    } else if (url.pathname.startsWith('/embed/')) {
      id = url.pathname.split('/')[2] ?? ''
    } else {
      id = url.searchParams.get('v') ?? ''
    }
    const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '')
    return cleanId ? `https://www.youtube.com/embed/${cleanId}` : null
  } catch {
    return null
  }
}

function isBefore(value?: string | null) {
  return !!value && Date.now() < new Date(value).getTime()
}

function isAfter(value?: string | null) {
  return !!value && Date.now() > new Date(value).getTime()
}

export default function ItemDetailPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const params = useParams()
  const id = params.id as string
  const { data, error, isLoading, mutate } = useSWR<ItemDetail>(id ? ['item', id] : null, () => itemFetcher(id))

  if (isLoading) return <Spinner className="mt-20" />
  if (error || !data) return <ErrorState message={(error as Error)?.message || t('errorOccurred')} />

  const itemType = inferType(data)
  const isOwner = !!data.is_owner || user?.role === 'admin'
  const reload = async () => {
    await mutate()
  }
  const dates = [
    { label: t('openDate'), value: fmtDate(data.open_at) },
    { label: t('deadline'), value: fmtDate(data.deadline_at) },
    { label: t('closeDate'), value: fmtDate(data.close_at) },
  ].filter((d) => d.value)

  return (
    <div className="space-y-8">
      <Link
        href={`/courses/${data.item.course_id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t('back')}
      </Link>

      <PageHeader
        eyebrow={t(itemType)}
        title={data.item.title}
        description={data.item.note}
        actions={
          <div className="flex flex-wrap gap-2">
            {data.max_score != null && <Badge tone="primary">{t('maxScore')}: {data.max_score}</Badge>}
            {data.weight_pct != null && <Badge tone="neutral">{t('weight')}: {data.weight_pct}%</Badge>}
            {data.time_limit_minutes ? <Badge tone="warning">{data.time_limit_minutes} min</Badge> : null}
            {data.submission && (
              <Badge tone={data.submission.status === 'graded' ? 'success' : 'warning'}>
                {statusLabel(data.submission.status, t)}
              </Badge>
            )}
            {data.attempt && (
              <Badge tone={data.attempt.status === 'graded' ? 'success' : 'warning'}>
                {statusLabel(data.attempt.status, t)}
              </Badge>
            )}
          </div>
        }
      />

      {dates.length > 0 && (
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            {dates.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Calendar size={17} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">{d.label}</p>
                  <p className="text-sm font-semibold text-foreground">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {itemType === 'lesson' && (
        isOwner ? <LessonEditor data={data} reload={reload} /> : <LessonViewer data={data} />
      )}

      {itemType === 'quiz' && (
        isOwner ? <QuizEditor data={data} reload={reload} /> : <StudentQuiz data={data} reload={reload} />
      )}

      {itemType === 'homework' && (
        isOwner ? <HomeworkEditor data={data} reload={reload} /> : <StudentHomework data={data} reload={reload} />
      )}
    </div>
  )
}

function LessonViewer({ data }: { data: ItemDetail }) {
  const { t } = useI18n()
  const embedUrl = youtubeEmbedUrl(data.youtube_url)
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <FileText size={18} className="text-primary" />
            <h2 className="text-base font-semibold">{t('content')}</h2>
          </div>
          {embedUrl ? (
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              <iframe
                className="aspect-video w-full"
                src={embedUrl}
                title={data.item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : data.has_quiz && data.quiz_started ? (
            <div className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm font-medium text-warning">
              {t('videoLockedDuringQuiz')}
            </div>
          ) : null}
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{data.content || t('noData')}</p>
          {data.youtube_url && !embedUrl && (
            <Button asChild>
              <a href={data.youtube_url} target="_blank" rel="noreferrer">
                <PlayCircle size={16} />
                {t('watchVideo')}
              </a>
            </Button>
          )}
        </Card>
        <MaterialsList materials={data.materials ?? []} />
      </div>
      {data.has_quiz && <StudentQuiz data={data} reload={async () => { window.location.reload() }} />}
    </div>
  )
}

function MaterialsList({ materials, onDelete }: { materials: Material[]; onDelete?: (id: number) => void }) {
  const { t } = useI18n()
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2 text-foreground">
        <Paperclip size={18} className="text-primary" />
        <h2 className="text-base font-semibold">{t('materials')}</h2>
      </div>
      {materials.length > 0 ? (
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {m.label || (m.kind === 'file' ? m.original_name : t('link'))}
              </span>
              <div className="flex shrink-0 gap-2">
                {m.kind === 'file' ? (
                  <Button variant="outline" size="sm" onClick={() => downloadFile(m.file_id!, m.original_name ?? 'file')}>
                    <Download size={14} />
                    {t('downloadFile')}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <a href={m.url} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} />
                      {t('link')}
                    </a>
                  </Button>
                )}
                {onDelete && (
                  <Button variant="danger" size="sm" onClick={() => onDelete(m.id)} aria-label={t('delete')}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted">{t('noMaterials')}</p>
      )}
    </Card>
  )
}

function LessonEditor({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [content, setContent] = useState(data.content ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(data.youtube_url ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [fileLabel, setFileLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const embedUrl = youtubeEmbedUrl(youtubeUrl)

  useEffect(() => {
    setContent(data.content ?? '')
    setYoutubeUrl(data.youtube_url ?? '')
  }, [data.content, data.youtube_url])

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/courses/lessons/${data.item.id}`, { method: 'PUT', body: { content, youtube_url: youtubeUrl } })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function addFileMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return
    setWorking(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploaded = await api<UploadedFile>('/files/upload', { formData })
      await api(`/courses/lessons/${data.item.id}/materials`, {
        body: { kind: 'file', file_id: uploaded.id, label: fileLabel || uploaded.original_name },
      })
      setFile(null)
      setFileLabel('')
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function addLinkMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!linkUrl.trim()) return
    setWorking(true)
    setError(null)
    try {
      await api(`/courses/lessons/${data.item.id}/materials`, {
        body: { kind: 'link', url: linkUrl, label: linkLabel || linkUrl },
      })
      setLinkUrl('')
      setLinkLabel('')
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteMaterial(materialId: number) {
    setError(null)
    try {
      await api(`/courses/materials/${materialId}`, { method: 'DELETE' })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    }
  }

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} />}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <form onSubmit={saveLesson} className="space-y-4">
            <Field label={t('content')}>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} />
            </Field>
            <Field label={t('youtubeUrl')}>
              <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </Field>
            {embedUrl && (
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                <iframe
                  className="aspect-video w-full"
                  src={embedUrl}
                  title={data.item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
            <Button type="submit" disabled={working}>
              <Save size={16} />
              {working ? t('loading') : t('save')}
            </Button>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <form onSubmit={addFileMaterial} className="space-y-4">
              <h2 className="text-base font-semibold">{t('attachFiles')}</h2>
              <Input value={fileLabel} onChange={(e) => setFileLabel(e.target.value)} placeholder={t('label')} />
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              />
              <Button type="submit" disabled={!file || working}>
                <Upload size={16} />
                {t('add')}
              </Button>
            </form>
          </Card>
          <Card>
            <form onSubmit={addLinkMaterial} className="space-y-4">
              <h2 className="text-base font-semibold">{t('links')}</h2>
              <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder={t('label')} />
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={t('url')} />
              <Button type="submit" disabled={!linkUrl.trim() || working}>
                <PlusCircle size={16} />
                {t('add')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
      <MaterialsList materials={data.materials ?? []} onDelete={deleteMaterial} />
      <QuizEditor data={data} reload={reload} />
    </div>
  )
}

function QuizEditor({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  return (
    <div className="space-y-6">
      <QuizSettings data={data} reload={reload} />
      <QuestionBuilder data={data} reload={reload} />
      <QuizAttemptsPanel itemId={data.item.id} />
    </div>
  )
}

function QuizSettings({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [maxScore, setMaxScore] = useState(String(data.max_score ?? 100))
  const [weight, setWeight] = useState(String(data.weight_pct ?? 0))
  const [openAt, setOpenAt] = useState(toDateInput(data.open_at))
  const [deadlineAt, setDeadlineAt] = useState(toDateInput(data.deadline_at))
  const [closeAt, setCloseAt] = useState(toDateInput(data.close_at))
  const [timeLimit, setTimeLimit] = useState(data.time_limit_minutes ? String(data.time_limit_minutes) : '')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setMaxScore(String(data.max_score ?? 100))
    setWeight(String(data.weight_pct ?? 0))
    setOpenAt(toDateInput(data.open_at))
    setDeadlineAt(toDateInput(data.deadline_at))
    setCloseAt(toDateInput(data.close_at))
    setTimeLimit(data.time_limit_minutes ? String(data.time_limit_minutes) : '')
  }, [data])

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/quizzes/${data.item.id}/settings`, {
        method: 'PUT',
        body: {
          max_score: Number(maxScore),
          weight_pct: Number(weight),
          open_at: fromDateInput(openAt),
          deadline_at: fromDateInput(deadlineAt),
          close_at: fromDateInput(closeAt),
          time_limit_minutes: timeLimit ? Number(timeLimit) : null,
        },
      })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Card>
      <form onSubmit={saveSettings} className="space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-primary" />
          <h2 className="text-base font-semibold">{t('settings')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('maxScore')}>
            <Input type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </Field>
          <Field label={t('weight')}>
            <Input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Time limit">
            <Input type="number" min={1} max={1440} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="minutes" />
          </Field>
          <Field label={t('openDate')}>
            <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </Field>
          <Field label={t('deadline')}>
            <Input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
          </Field>
          <Field label={t('closeDate')}>
            <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={working}>
          <Save size={16} />
          {working ? t('loading') : t('save')}
        </Button>
      </form>
    </Card>
  )
}

function QuestionBuilder({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [type, setType] = useState<QuestionType>('single')
  const [prompt, setPrompt] = useState('')
  const [points, setPoints] = useState('1')
  const [explanation, setExplanation] = useState('')
  const [options, setOptions] = useState([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
  ])
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const isChoice = type === 'single' || type === 'multiple'

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/quizzes/${data.item.id}/questions`, {
        body: {
          type,
          prompt,
          points: Number(points),
          explanation,
          options: isChoice ? options.filter((o) => o.text.trim()) : [],
        },
      })
      setPrompt('')
      setPoints('1')
      setExplanation('')
      setOptions([
        { text: '', is_correct: true },
        { text: '', is_correct: false },
      ])
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteQuestion(questionId: number) {
    setError(null)
    try {
      await api(`/quizzes/questions/${questionId}`, { method: 'DELETE' })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <form onSubmit={addQuestion} className="space-y-4">
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-primary" />
            <h2 className="text-base font-semibold">{t('addQuestion')}</h2>
          </div>
          <Field label={t('question')}>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('content')}>
              <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
                <option value="single">{t('singleChoice')}</option>
                <option value="multiple">{t('multipleChoice')}</option>
                <option value="short_text">{t('shortText')}</option>
                <option value="long_text">{t('longText')}</option>
              </Select>
            </Field>
            <Field label={t('points')}>
              <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
            </Field>
          </div>
          {isChoice && (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type={type === 'single' ? 'radio' : 'checkbox'}
                    checked={option.is_correct}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, i) => ({
                          ...o,
                          is_correct: type === 'single' ? i === index : i === index ? e.target.checked : o.is_correct,
                        })),
                      )
                    }
                    name="correct-option"
                  />
                  <Input
                    value={option.text}
                    onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))}
                    placeholder={`${t('option')} ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, { text: '', is_correct: false }])}
              >
                <PlusCircle size={14} />
                {t('option')}
              </Button>
            </div>
          )}
          <Field label={t('explanation')}>
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
          </Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={working}>
            {working ? t('loading') : t('addQuestion')}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-primary" />
          <h2 className="text-base font-semibold">{t('questions')}</h2>
        </div>
        {data.questions?.length ? (
          <div className="space-y-3">
            {data.questions.map((q, index) => (
              <div key={q.id} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{index + 1}</Badge>
                      <Badge tone="primary">{questionLabel(q.type, t)}</Badge>
                      <Badge tone="neutral">{q.points} {t('points')}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm font-medium text-foreground">{q.prompt}</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => deleteQuestion(q.id)} aria-label={t('delete')}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                {q.options.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                        {o.is_correct ? <CheckCircle2 size={14} className="text-success" /> : <span className="size-3 rounded-full border border-border" />}
                        <span>{o.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.explanation && <p className="mt-3 text-xs text-muted">{t('explanation')}: {q.explanation}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<ListChecks size={22} />} title={t('noData')} />
        )}
      </Card>
    </div>
  )
}

function StudentQuiz({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [answers, setAnswers] = useState<Record<number, { selected_option_ids: number[]; text_answer: string }>>({})
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState((data.time_limit_minutes ?? 0) * 60)

  const questions = data.questions ?? []
  const notOpen = isBefore(data.open_at)
  const closed = isAfter(data.close_at)

  useEffect(() => {
    if (!data.time_limit_minutes || data.attempt || !data.quiz_started) return
    setSecondsLeft(data.time_limit_minutes * 60)
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [data.time_limit_minutes, data.attempt, data.quiz_started])

  const attemptAnswers = useMemo(() => {
    const map = new Map<number, AttemptAnswer>()
    data.attempt?.answers.forEach((answer) => map.set(answer.question_id, answer))
    return map
  }, [data.attempt])

  function setChoice(question: Question, optionId: number, checked: boolean) {
    setAnswers((prev) => {
      const current = prev[question.id] ?? { selected_option_ids: [], text_answer: '' }
      const selected =
        question.type === 'single'
          ? [optionId]
          : checked
            ? Array.from(new Set([...current.selected_option_ids, optionId]))
            : current.selected_option_ids.filter((id) => id !== optionId)
      return { ...prev, [question.id]: { ...current, selected_option_ids: selected } }
    })
  }

  async function startQuiz() {
    setWorking(true)
    setError(null)
    try {
      await api(`/quizzes/${data.item.id}/start`, { method: 'POST' })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/quizzes/${data.item.id}/attempt`, {
        body: {
          answers: questions.map((q) => ({
            question_id: q.id,
            selected_option_ids: answers[q.id]?.selected_option_ids ?? [],
            text_answer: answers[q.id]?.text_answer ?? '',
          })),
        },
      })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  if (data.attempt) {
    return (
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('quizResult')}</h2>
            <p className="text-sm text-muted">{fmtDate(data.attempt.submitted_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{t('score')}: {data.attempt.auto_score + (data.attempt.manual_score ?? 0)}</Badge>
            <Badge tone={data.attempt.status === 'graded' ? 'success' : 'warning'}>{statusLabel(data.attempt.status, t)}</Badge>
          </div>
        </div>
        <div className="space-y-4">
          {questions.map((q, index) => {
            const answer = attemptAnswers.get(q.id)
            return (
              <div key={q.id} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{index + 1}</Badge>
                  <Badge tone="primary">{questionLabel(q.type, t)}</Badge>
                  <Badge tone={answer?.awarded_points == null ? 'warning' : 'success'}>
                    {answer?.awarded_points ?? t('pendingReview')} / {q.points}
                  </Badge>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm font-medium">{q.prompt}</p>
                {q.options.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((option) => {
                      const selected = answer?.selected_option_ids.includes(option.id)
                      return (
                        <div key={option.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                          {option.is_correct ? <CheckCircle2 size={14} className="text-success" /> : <span className="size-3 rounded-full border border-border" />}
                          <span className={selected ? 'font-semibold text-foreground' : 'text-muted'}>{option.text}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {answer?.text_answer && <p className="mt-3 whitespace-pre-line text-sm text-muted">{t('yourAnswer')}: {answer.text_answer}</p>}
                {q.explanation && <p className="mt-3 text-xs text-muted">{t('explanation')}: {q.explanation}</p>}
              </div>
            )
          })}
        </div>
      </Card>
    )
  }

  if (!data.quiz_started) {
    return (
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('quiz')}</h2>
            <p className="mt-1 text-sm text-muted">{t('quizStartLocksVideo')}</p>
          </div>
          <Badge tone="neutral">{data.question_count ?? questions.length} {t('questions')}</Badge>
        </div>
        {notOpen && <ErrorState message={t('homeworkNotOpen')} />}
        {closed && <ErrorState message={t('homeworkClosed')} />}
        {error && <ErrorState message={error} />}
        <Button onClick={startQuiz} disabled={working || notOpen || closed || (data.question_count ?? 0) === 0}>
          {working ? t('loading') : t('startQuiz')}
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <form onSubmit={submitQuiz} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('questions')}</h2>
            <p className="text-sm text-muted">{questions.length} {t('questions')} · {data.total_points ?? 0} {t('points')}</p>
          </div>
          {data.time_limit_minutes ? (
            <Badge tone={secondsLeft <= 60 ? 'danger' : 'warning'}>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </Badge>
          ) : null}
        </div>
        {notOpen && <ErrorState message={t('homeworkNotOpen')} />}
        {closed && <ErrorState message={t('homeworkClosed')} />}
        {questions.length ? (
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={q.id} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{index + 1}</Badge>
                  <Badge tone="primary">{questionLabel(q.type, t)}</Badge>
                  <Badge tone="neutral">{q.points} {t('points')}</Badge>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm font-medium">{q.prompt}</p>
                {(q.type === 'single' || q.type === 'multiple') && (
                  <div className="mt-3 grid gap-2">
                    {q.options.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                        <input
                          type={q.type === 'single' ? 'radio' : 'checkbox'}
                          name={`question-${q.id}`}
                          checked={answers[q.id]?.selected_option_ids.includes(option.id) ?? false}
                          onChange={(e) => setChoice(q, option.id, e.target.checked)}
                        />
                        {option.text}
                      </label>
                    ))}
                  </div>
                )}
                {(q.type === 'short_text' || q.type === 'long_text') && (
                  <Textarea
                    className="mt-3"
                    rows={q.type === 'long_text' ? 6 : 3}
                    value={answers[q.id]?.text_answer ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.id]: {
                          selected_option_ids: prev[q.id]?.selected_option_ids ?? [],
                          text_answer: e.target.value,
                        },
                      }))
                    }
                    placeholder={t('yourAnswer')}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<ListChecks size={22} />} title={t('noData')} />
        )}
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={working || questions.length === 0 || notOpen || closed || (!!data.time_limit_minutes && secondsLeft === 0)}>
          {working ? t('loading') : t('submitQuiz')}
        </Button>
      </form>
    </Card>
  )
}

type AttemptSummary = {
  id: number
  student_name: string
  student_email: string
  submitted_at: string
  auto_score: number
  manual_score: number | null
  status: string
  late?: boolean
}

type AttemptDetail = {
  id: number
  student_name: string
  quiz_title: string
  submitted_at: string
  auto_score: number
  manual_score: number | null
  status: string
  answers: Array<{
    id: number
    question_id: number
    type: QuestionType
    prompt: string
    question_points: number
    selected_option_ids: number[]
    text_answer: string
    awarded_points: number | null
  }>
}

function QuizAttemptsPanel({ itemId }: { itemId: number }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<number | null>(null)
  const { data, error, isLoading, mutate } = useSWR<AttemptSummary[]>(
    `/quizzes/${itemId}/attempts`,
    (path: string) => api<AttemptSummary[]>(path),
  )
  const detail = useSWR<AttemptDetail>(
    selected ? `/quizzes/attempts/${selected}` : null,
    (path: string) => api<AttemptDetail>(path),
  )

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-primary" />
        <h2 className="text-base font-semibold">{t('attempts')}</h2>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : data?.length ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-2">
            {data.map((attempt) => (
              <button
                key={attempt.id}
                onClick={() => setSelected(attempt.id)}
                className="w-full rounded-lg border border-border bg-surface-muted px-4 py-3 text-left transition-colors hover:bg-surface"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{attempt.student_name}</p>
                    <p className="truncate text-xs text-muted">{attempt.student_email}</p>
                  </div>
                  <Badge tone={attempt.status === 'graded' ? 'success' : 'warning'}>{statusLabel(attempt.status, t)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  <span>{fmtDate(attempt.submitted_at)}</span>
                  <span>{t('score')}: {attempt.auto_score + (attempt.manual_score ?? 0)}</span>
                  {attempt.late && <Badge tone="danger">{t('late')}</Badge>}
                </div>
              </button>
            ))}
          </div>
          <div className="min-h-40">
            {selected ? (
              detail.isLoading ? (
                <Spinner />
              ) : detail.error || !detail.data ? (
                <ErrorState message={(detail.error as Error)?.message || t('errorOccurred')} />
              ) : (
                <AttemptReview detail={detail.data} refresh={async () => { await detail.mutate(); await mutate() }} />
              )
            ) : (
              <EmptyState icon={<FileText size={22} />} title={t('reviewNeeded')} />
            )}
          </div>
        </div>
      ) : (
        <EmptyState icon={<ListChecks size={22} />} title={t('noData')} />
      )}
    </Card>
  )
}

function AttemptReview({ detail, refresh }: { detail: AttemptDetail; refresh: () => Promise<unknown> }) {
  const { t } = useI18n()
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
        <p className="text-sm font-semibold">{detail.student_name}</p>
        <p className="text-xs text-muted">{fmtDate(detail.submitted_at)}</p>
      </div>
      {detail.answers.map((answer) => (
        <div key={answer.id} className="rounded-lg border border-border bg-surface-muted p-4">
          <Badge tone="primary">{questionLabel(answer.type, t)}</Badge>
          <p className="mt-2 whitespace-pre-line text-sm font-medium">{answer.prompt}</p>
          {answer.text_answer && <p className="mt-3 whitespace-pre-line rounded-md bg-surface p-3 text-sm text-muted">{answer.text_answer}</p>}
          {answer.selected_option_ids.length > 0 && (
            <p className="mt-2 text-xs text-muted">{t('yourAnswer')}: {answer.selected_option_ids.join(', ')}</p>
          )}
          <GradeAnswerForm answer={answer} refresh={refresh} />
        </div>
      ))}
    </div>
  )
}

function GradeAnswerForm({
  answer,
  refresh,
}: {
  answer: AttemptDetail['answers'][number]
  refresh: () => Promise<unknown>
}) {
  const { t } = useI18n()
  const [points, setPoints] = useState(String(answer.awarded_points ?? 0))
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setPoints(String(answer.awarded_points ?? 0))
  }, [answer.awarded_points])

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/quizzes/answers/${answer.id}/grade`, { body: { awarded_points: Number(points) } })
      await refresh()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={saveGrade} className="mt-3 flex flex-wrap items-end gap-2">
      <Field label={`${t('grade')} / ${answer.question_points}`}>
        <Input type="number" min={0} max={answer.question_points} value={points} onChange={(e) => setPoints(e.target.value)} className="w-28" />
      </Field>
      <Button type="submit" size="sm" disabled={working}>
        {t('setGrade')}
      </Button>
      {error && <div className="w-full"><ErrorState message={error} /></div>}
    </form>
  )
}

function HomeworkEditor({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  return (
    <div className="space-y-6">
      <HomeworkSettings data={data} reload={reload} />
      <HomeworkSubmissionsPanel itemId={data.item.id} />
    </div>
  )
}

function HomeworkSettings({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [description, setDescription] = useState(data.description ?? '')
  const [maxScore, setMaxScore] = useState(String(data.max_score ?? 100))
  const [weight, setWeight] = useState(String(data.weight_pct ?? 0))
  const [openAt, setOpenAt] = useState(toDateInput(data.open_at))
  const [deadlineAt, setDeadlineAt] = useState(toDateInput(data.deadline_at))
  const [closeAt, setCloseAt] = useState(toDateInput(data.close_at))
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    setDescription(data.description ?? '')
    setMaxScore(String(data.max_score ?? 100))
    setWeight(String(data.weight_pct ?? 0))
    setOpenAt(toDateInput(data.open_at))
    setDeadlineAt(toDateInput(data.deadline_at))
    setCloseAt(toDateInput(data.close_at))
  }, [data])

  async function saveHomework(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/homework/${data.item.id}`, {
        method: 'PUT',
        body: {
          description,
          max_score: Number(maxScore),
          weight_pct: Number(weight),
          open_at: fromDateInput(openAt),
          deadline_at: fromDateInput(deadlineAt),
          close_at: fromDateInput(closeAt),
        },
      })
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <Card>
      <form onSubmit={saveHomework} className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-base font-semibold">{t('settings')}</h2>
        </div>
        <Field label={t('description')}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label={t('maxScore')}>
            <Input type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
          </Field>
          <Field label={t('weight')}>
            <Input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label={t('openDate')}>
            <Input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} />
          </Field>
          <Field label={t('deadline')}>
            <Input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
          </Field>
          <Field label={t('closeDate')}>
            <Input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={working}>
          <Save size={16} />
          {working ? t('loading') : t('save')}
        </Button>
      </form>
    </Card>
  )
}

type HomeworkSubmission = {
  id: number
  student_name: string
  student_email: string
  comment: string
  submitted_at: string
  grade: number | null
  feedback: string
  status: string
  late: boolean
  files: Array<{ id: number; original_name: string; mime?: string; size?: number }>
}

function HomeworkSubmissionsPanel({ itemId }: { itemId: number }) {
  const { t } = useI18n()
  const { data, error, isLoading, mutate } = useSWR<{ submissions: HomeworkSubmission[]; max_score: number }>(
    `/homework/${itemId}/submissions`,
    (path: string) => api<{ submissions: HomeworkSubmission[]; max_score: number }>(path),
  )

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Upload size={18} className="text-primary" />
        <h2 className="text-base font-semibold">{t('submissions')}</h2>
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : data?.submissions.length ? (
        <div className="space-y-4">
          {data.submissions.map((submission) => (
            <div key={submission.id} className="rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{submission.student_name}</p>
                  <p className="text-xs text-muted">{submission.student_email}</p>
                  <p className="text-xs text-muted">{fmtDate(submission.submitted_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={submission.status === 'graded' ? 'success' : 'warning'}>{statusLabel(submission.status, t)}</Badge>
                  <Badge tone={submission.late ? 'danger' : 'success'}>{submission.late ? t('late') : t('onTime')}</Badge>
                </div>
              </div>
              {submission.comment && <p className="mt-3 whitespace-pre-line rounded-md bg-surface p-3 text-sm text-muted">{submission.comment}</p>}
              {submission.files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {submission.files.map((file) => (
                    <Button key={file.id} variant="outline" size="sm" onClick={() => downloadFile(file.id, file.original_name)}>
                      <Download size={14} />
                      {file.original_name}
                    </Button>
                  ))}
                </div>
              )}
              <GradeSubmissionForm submission={submission} maxScore={data.max_score} refresh={mutate} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Upload size={22} />} title={t('noData')} />
      )}
    </Card>
  )
}

function GradeSubmissionForm({
  submission,
  maxScore,
  refresh,
}: {
  submission: HomeworkSubmission
  maxScore: number
  refresh: () => Promise<unknown>
}) {
  const { t } = useI18n()
  const [grade, setGrade] = useState(String(submission.grade ?? 0))
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      await api(`/homework/submissions/${submission.id}/grade`, {
        body: { grade: Number(grade), feedback },
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={saveGrade} className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
      <Field label={`${t('grade')} / ${maxScore}`}>
        <Input type="number" min={0} max={maxScore} value={grade} onChange={(e) => setGrade(e.target.value)} />
      </Field>
      <Field label={t('feedback')}>
        <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </Field>
      <Button type="submit" disabled={working}>{t('setGrade')}</Button>
      {error && <div className="sm:col-span-3"><ErrorState message={error} /></div>}
    </form>
  )
}

function StudentHomework({ data, reload }: { data: ItemDetail; reload: () => Promise<unknown> }) {
  const { t } = useI18n()
  const [comment, setComment] = useState(data.submission?.comment ?? '')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const notOpen = isBefore(data.open_at)
  const closed = isAfter(data.close_at)

  useEffect(() => {
    setComment(data.submission?.comment ?? '')
  }, [data.submission?.comment])

  async function submitHomework(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setError(null)
    try {
      const fileIds: number[] = []
      for (const file of Array.from(files ?? [])) {
        const formData = new FormData()
        formData.append('file', file)
        const uploaded = await api<UploadedFile>('/files/upload', { formData })
        fileIds.push(uploaded.id)
      }
      await api(`/homework/${data.item.id}/submit`, { body: { comment, file_ids: fileIds } })
      setFiles(null)
      await reload()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-base font-semibold">{t('description')}</h2>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{data.description || t('noData')}</p>
        {data.submission && (
          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.submission.status === 'graded' ? 'success' : 'warning'}>{statusLabel(data.submission.status, t)}</Badge>
              {data.submission.grade != null && <Badge tone="primary">{t('grade')}: {data.submission.grade}</Badge>}
            </div>
            <p className="mt-2 text-xs text-muted">{fmtDate(data.submission.submitted_at)}</p>
            {data.submission.feedback && <p className="mt-3 text-sm text-muted">{t('feedback')}: {data.submission.feedback}</p>}
            {data.submission.files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.submission.files.map((file) => (
                  <Button key={file.id} variant="outline" size="sm" onClick={() => downloadFile(file.id, file.original_name)}>
                    <Download size={14} />
                    {file.original_name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      <Card>
        <form onSubmit={submitHomework} className="space-y-4">
          <h2 className="text-base font-semibold">{data.submission ? t('resubmit') : t('submit')}</h2>
          {notOpen && <ErrorState message={t('homeworkNotOpen')} />}
          {closed && <ErrorState message={t('homeworkClosed')} />}
          <Field label={t('yourComment')}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={5} />
          </Field>
          <Field label={t('attachFiles')}>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={working || notOpen || closed}>
            <Upload size={16} />
            {working ? t('loading') : data.submission ? t('resubmit') : t('submit')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
