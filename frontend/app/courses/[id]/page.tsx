'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  ListChecks,
  Lock,
  Megaphone,
  PlusCircle,
  Settings2,
  UserRound,
} from 'lucide-react'
import { useI18n, type TKey } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FadeIn,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui'

type ItemType = 'lesson' | 'quiz' | 'homework'

type Item = {
  id: number
  type: ItemType
  title: string
  position: number
  is_visible: boolean
  sequential_unlock: boolean
  note?: string
  locked?: boolean
  completed?: boolean
  score?: number | null
  max_score?: number | null
  weight_pct?: number
  open_at?: string | null
  deadline_at?: string | null
  close_at?: string | null
  time_limit_minutes?: number | null
}

type Course = {
  id: number
  title: string
  description: string
  announcement?: string
  teacher_name: string
  is_published: boolean
  is_owner?: boolean
  enrollment_status?: string | null
  items: Item[] | null
}

const TYPE_ICON: Record<ItemType, ReactNode> = {
  lesson: <FileText size={18} />,
  quiz: <ListChecks size={18} />,
  homework: <BookOpen size={18} />,
}

function fmtDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export default function CoursePage() {
  const { t } = useI18n()
  const params = useParams()
  const id = params.id as string
  const { data: course, error, isLoading, mutate } = useSWR<Course>(id ? `/courses/${id}` : null, fetcher)

  const [addOpen, setAddOpen] = useState(false)
  const [itemType, setItemType] = useState<ItemType>('lesson')
  const [itemTitle, setItemTitle] = useState('')
  const [itemNote, setItemNote] = useState('')
  const [itemVisible, setItemVisible] = useState(true)
  const [itemSequential, setItemSequential] = useState(false)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <Spinner className="mt-20" />
  if (error || !course) return <ErrorState message={t('errorOccurred')} />

  const items = course.items ?? []
  const completed = items.filter((i) => i.completed).length
  const isOwner = !!course.is_owner
  const courseId = course.id

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!itemTitle.trim()) return
    setWorking(true)
    setActionError(null)
    try {
      await api(`/courses/${id}/items`, {
        body: {
          type: itemType,
          title: itemTitle,
          note: itemNote,
          is_visible: itemVisible,
          sequential_unlock: itemSequential,
        },
      })
      setItemTitle('')
      setItemNote('')
      setItemType('lesson')
      setItemVisible(true)
      setItemSequential(false)
      setAddOpen(false)
      await mutate()
    } catch (err) {
      setActionError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function patchItem(itemId: number, body: Record<string, unknown>) {
    setActionError(null)
    try {
      await api(`/courses/items/${itemId}`, { method: 'PATCH', body })
      await mutate()
    } catch (err) {
      setActionError((err as Error).message || t('errorOccurred'))
    }
  }

  return (
    <div className="space-y-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft size={16} />
        {t('catalog')}
      </Link>

      <PageHeader
        eyebrow={t('courses')}
        title={course.title}
        description={course.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {course.enrollment_status && (
              <Badge tone={course.enrollment_status === 'approved' ? 'success' : 'warning'}>
                {t(course.enrollment_status as TKey)}
              </Badge>
            )}
            <Badge tone={course.is_published ? 'primary' : 'neutral'}>
              {course.is_published ? t('published') : t('draft')}
            </Badge>
            {isOwner && (
              <>
                <Button asChild variant="outline">
                <Link href={`/teacher/courses/${courseId}/gradebook`}>{t('gradebook')}</Link>
                </Button>
                <Button onClick={() => setAddOpen(true)}>
                  <PlusCircle size={16} />
                  {t('addItem')}
                </Button>
              </>
            )}
          </div>
        }
      />

      {actionError && <ErrorState message={actionError} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UserRound size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">{t('instructor')}</p>
            <p className="font-semibold text-foreground">{course.teacher_name}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">{t('lessons')}</p>
            <p className="font-semibold text-foreground">{items.length} {t('itemsCount')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted">{t('completed')}</p>
            <p className="font-semibold text-foreground">{completed} {t('of')} {items.length}</p>
          </div>
        </Card>
      </div>

      {course.announcement && (
        <Card className="flex gap-3 border-primary/20 bg-primary-soft/50">
          <Megaphone size={20} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('announcement')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{course.announcement}</p>
          </div>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{t('courseContent')}</h2>
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <PlusCircle size={15} />
              {t('addItem')}
            </Button>
          )}
        </div>

        {course.items === null ? (
          <EmptyState
            icon={<Lock size={22} />}
            title={t('locked')}
            hint={t('lockedHint')}
          />
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item, i) => {
              const locked = item.locked
              const deadline = fmtDate(item.deadline_at)
              const content = (
                <Card interactive={!locked} className={`flex flex-col gap-4 sm:flex-row sm:items-center ${locked ? 'opacity-70' : ''}`}>
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                      item.completed ? 'bg-success-soft text-success' : 'bg-surface-muted text-muted'
                    }`}
                  >
                    {locked ? <Lock size={18} /> : TYPE_ICON[item.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <Badge tone="neutral">{t(item.type)}</Badge>
                      {item.completed && <Badge tone="success">{t('completed')}</Badge>}
                      {locked && <Badge tone="warning">{t('locked')}</Badge>}
                      {isOwner && (
                        <Badge tone={item.is_visible ? 'success' : 'neutral'}>
                          {item.is_visible ? t('visible') : t('hidden')}
                        </Badge>
                      )}
                      {item.sequential_unlock && <Badge tone="warning">{t('locked')}</Badge>}
                    </div>
                    {item.note && <p className="mt-1 line-clamp-1 text-sm text-muted">{item.note}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {deadline && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={13} />
                          {t('deadline')}: {deadline}
                        </span>
                      )}
                      {item.time_limit_minutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Settings2 size={13} />
                          {item.time_limit_minutes} min
                        </span>
                      ) : null}
                      {item.max_score != null && <span>{t('maxScore')}: {item.max_score}</span>}
                      {item.weight_pct ? <span>{t('weight')}: {item.weight_pct}%</span> : null}
                    </div>
                  </div>
                  {isOwner ? (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button asChild size="sm">
                        <Link href={`/items/${item.id}`}>{t('openItem')}</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => patchItem(item.id, { is_visible: !item.is_visible })}
                      >
                        {item.is_visible ? <EyeOff size={14} /> : <Eye size={14} />}
                        {item.is_visible ? t('hidden') : t('visible')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => patchItem(item.id, { sequential_unlock: !item.sequential_unlock })}
                      >
                        <Lock size={14} />
                        {item.sequential_unlock ? t('open') : t('locked')}
                      </Button>
                    </div>
                  ) : (
                    !locked && <ArrowRight size={18} className="shrink-0 text-muted" />
                  )}
                </Card>
              )
              return (
                <FadeIn key={item.id} delay={i * 30}>
                  {locked || isOwner ? (
                    <div title={locked ? t('lockedHint') : undefined}>{content}</div>
                  ) : (
                    <Link href={`/items/${item.id}`} className="block">
                      {content}
                    </Link>
                  )}
                </FadeIn>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={t('noData')}
            action={isOwner ? <Button onClick={() => setAddOpen(true)}>{t('addItem')}</Button> : undefined}
          />
        )}
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addItem')}>
        <form onSubmit={createItem} className="space-y-4">
          <Field label={t('title')}>
            <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} required />
          </Field>
          <Field label={t('content')}>
            <Select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>
              <option value="lesson">{t('lesson')}</option>
              <option value="quiz">{t('quiz')}</option>
              <option value="homework">{t('homework')}</option>
            </Select>
          </Field>
          <Field label={t('note')}>
            <Textarea value={itemNote} onChange={(e) => setItemNote(e.target.value)} rows={3} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm">
              <input type="checkbox" checked={itemVisible} onChange={(e) => setItemVisible(e.target.checked)} />
              {t('visible')}
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm">
              <input type="checkbox" checked={itemSequential} onChange={(e) => setItemSequential(e.target.checked)} />
              {t('locked')}
            </label>
          </div>
          {actionError && <ErrorState message={actionError} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={working}>
              {working ? t('loading') : t('create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
