'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  ListChecks,
  Lock,
  Megaphone,
  MoreVertical,
  PlusCircle,
  Settings2,
  Trash,
  UserRound,
  Users,
} from 'lucide-react'
import { useI18n, type TKey } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { api, fetcher } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  DeletionConfirmModal,
  DropdownMenu,
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
  topic_open?: boolean
  access_group_ids?: number[]
  access_student_ids?: number[]
}

type CourseGroup = {
  id: number
  code: string
  title: string
  direction: string
  stream: string
  capacity: number
  student_count: number
}

type CourseStudent = {
  id: number
  full_name: string
  email: string
  groups: Array<{ id: number; code: string }>
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
  groups?: CourseGroup[] | null
  students?: CourseStudent[] | null
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
  const { user } = useAuth()
  const router = useRouter()
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
  const [accessItem, setAccessItem] = useState<Item | null>(null)
  const [accessGroupIds, setAccessGroupIds] = useState<number[]>([])
  const [accessStudentIds, setAccessStudentIds] = useState<number[]>([])
  const [expandedGroupIds, setExpandedGroupIds] = useState<number[]>([])
  
  // Delete course states
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  function openAccessModal(item: Item) {
    setAccessItem(item)
    setAccessGroupIds(item.access_group_ids ?? [])
    setAccessStudentIds(item.access_student_ids ?? [])
    setExpandedGroupIds(item.access_group_ids ?? [])
  }

  function toggleNumber(list: number[], value: number) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  }

  function studentsInGroup(groupId: number) {
    return (course?.students ?? []).filter((student) => student.groups.some((group) => group.id === groupId))
  }

  function setGroupAccess(groupId: number, checked: boolean) {
    setAccessGroupIds((current) => checked ? [...new Set([...current, groupId])] : current.filter((id) => id !== groupId))
    if (checked) {
      const groupStudentIds = studentsInGroup(groupId).map((student) => student.id)
      setAccessStudentIds((current) => current.filter((id) => !groupStudentIds.includes(id)))
    }
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessItem) return
    setWorking(true)
    setActionError(null)
    try {
      await api(`/courses/items/${accessItem.id}/access`, {
        method: 'PUT',
        body: { group_ids: accessGroupIds, student_ids: accessStudentIds },
      })
      setAccessItem(null)
      await mutate()
    } catch (err) {
      setActionError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteCourse() {
    setIsDeleting(true)
    try {
      await api(`/courses/${id}`, { method: 'DELETE' })
      // Close modal and show success message
      setDeleteModalOpen(false)
      // Redirect to teacher courses page
      router.push('/teacher')
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('404') || msg.includes('not found')) {
        setActionError(t('courseNotFound'))
      } else if (msg.includes('403') || msg.includes('permission')) {
        setActionError(t('noPermission'))
      } else if (msg.includes('5')) {
        setActionError(t('serverError'))
      } else {
        setActionError(t('courseDeleteError'))
      }
      setIsDeleting(false)
    }
  }

  const canDeleteCourse = user && (user.id === course?.teacher_id || user.role === 'admin')
  const studentCount = (course?.students ?? []).length
  const itemCount = (course?.items ?? []).length
  const shouldShowWarning = course?.is_published && studentCount > 0

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
          <div className="flex flex-wrap gap-2 items-center">
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

                {/* Menu button */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border transition-colors hover:bg-surface-muted text-muted hover:text-foreground"
                    aria-label={t('courseOptions')}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {/* Dropdown Menu */}
                  <DropdownMenu
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    items={[
                      {
                        label: t('deleteCourse'),
                        icon: <Trash size={16} />,
                        destructive: true,
                        divider: true,
                        onClick: () => setDeleteModalOpen(true),
                      },
                    ]}
                    position="right"
                  />
                </div>
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

      {isOwner && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <h2 className="text-base font-semibold">{t('courseGroups')}</h2>
          </div>
          {course.groups?.length ? (
            <div className="flex flex-wrap gap-2">
              {course.groups.map((group) => (
                <span key={group.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                  <span className="font-semibold">{group.code}</span>
                  <span className="text-muted">{group.student_count}/{group.capacity}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('noGroups')}</p>
          )}
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
                      {isOwner && (
                        <Badge tone={(item.access_group_ids?.length || item.access_student_ids?.length) ? 'primary' : 'neutral'}>
                          {t('topicAccess')}: {(item.access_group_ids?.length ?? 0) + (item.access_student_ids?.length ?? 0)}
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
                      <Button variant="outline" size="sm" onClick={() => openAccessModal(item)}>
                        <Users size={14} />
                        {t('topicAccess')}
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
                    <div title={locked ? (item.topic_open === false ? t('topicClosedHint') : t('lockedHint')) : undefined}>{content}</div>
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

      <Modal open={!!accessItem} onClose={() => setAccessItem(null)} title={t('topicAccess')}>
        <form onSubmit={saveAccess} className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-foreground">{accessItem?.title}</p>
            <p className="mt-1 text-sm text-muted">{t('topicAccessHint')}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('openToGroups')}</h3>
            {course.groups?.length ? (
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                {course.groups.map((group) => {
                  const expanded = expandedGroupIds.includes(group.id)
                  const wholeGroup = accessGroupIds.includes(group.id)
                  const groupStudents = studentsInGroup(group.id)
                  return (
                    <div key={group.id} className="rounded-lg border border-border bg-surface-muted">
                      <div className="flex items-center gap-3 p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedGroupIds((current) => toggleNumber(current, group.id))}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-surface"
                          aria-label={expanded ? t('collapse') : t('expand')}
                        >
                          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={wholeGroup}
                            onChange={(event) => setGroupAccess(group.id, event.target.checked)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{group.code} - {group.title}</span>
                            <span className="block text-xs text-muted">{group.student_count}/{group.capacity} {t('studentsCount')}</span>
                          </span>
                        </label>
                        <Badge tone={wholeGroup ? 'primary' : 'neutral'}>{wholeGroup ? t('wholeGroup') : t('selectGroup')}</Badge>
                      </div>

                      {expanded && (
                        <div className="border-t border-border bg-surface px-3 py-2">
                          {wholeGroup && <p className="mb-2 text-xs text-muted">{t('wholeGroupSelected')}</p>}
                          {groupStudents.length ? (
                            <div className="space-y-1">
                              {groupStudents.map((student) => (
                                <label key={student.id} className="flex items-start gap-3 rounded-md p-2 text-sm hover:bg-surface-muted">
                                  <input
                                    className="mt-1"
                                    type="checkbox"
                                    disabled={wholeGroup}
                                    checked={wholeGroup || accessStudentIds.includes(student.id)}
                                    onChange={() => setAccessStudentIds((current) => toggleNumber(current, student.id))}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium">{student.full_name}</span>
                                    <span className="block truncate text-xs text-muted">{student.email}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="py-2 text-sm text-muted">{t('noData')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('noGroups')}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAccessItem(null)}>{t('cancel')}</Button>
            <Button type="submit" disabled={working}>{working ? t('loading') : t('save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Course Modal */}
      <DeletionConfirmModal
        open={deleteModalOpen}
        onClose={() => !isDeleting && setDeleteModalOpen(false)}
        onConfirm={deleteCourse}
        title={t('confirmDeleteCourse')}
        description={t('deleteWarning')}
        courseName={course.title}
        warning={shouldShowWarning ? t('publishedWithStudents') : undefined}
        isLoading={isDeleting}
      />
    </div>
  )
}
