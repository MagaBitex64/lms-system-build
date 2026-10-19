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
  ChevronDown,
  ChevronRight,
  ClipboardList,
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
import { SUBJECT_NAMES } from '@/lib/ent'
import CourseEntVariants from '@/components/course-ent-variants'
import {
  Badge,
  Button,
  Card,
  DeletionConfirmModal,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui'
import styles from '@/components/course-detail.module.css'

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
  quiz_access_rules?: Array<{target_type:string;target_id:number;max_attempts:number;deadline_at:string|null}>
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
  teacher_id?: number
  is_published: boolean
  is_owner?: boolean
  enrollment_status?: string | null
  items: Item[] | null
  groups?: CourseGroup[] | null
  students?: CourseStudent[] | null
  ent_subject?: string | null
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
  const [accessAttempts,setAccessAttempts]=useState('1')
  const [accessDeadline,setAccessDeadline]=useState('')
  const [accessRulesDirty,setAccessRulesDirty]=useState(false)
  const [mixedAccessRules,setMixedAccessRules]=useState(false)
  const [expandedGroupIds, setExpandedGroupIds] = useState<number[]>([])
  const [contentExpanded, setContentExpanded] = useState(true)
  const [entExpanded, setEntExpanded] = useState(true)
  const [entSubjectDraft, setEntSubjectDraft] = useState('')
  const [savingEntSubject, setSavingEntSubject] = useState(false)
  const [entSubjectError, setEntSubjectError] = useState<string | null>(null)
  
  // Delete course states
  const [menuOpen, setMenuOpen] = useState(false)
  const [itemMenuId, setItemMenuId] = useState<number | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (isLoading) return <Spinner className="mt-20" />
  if (error || !course) return <ErrorState message={t('errorOccurred')} />

  const items = course.items ?? []
  const completed = items.filter((i) => i.completed).length
  const isOwner = !!course.is_owner
  const courseId = course.id
  const currentEntSubject = course.ent_subject || ''

  async function saveEntSubject() {
    const subject = entSubjectDraft || currentEntSubject
    if (!subject) return
    setSavingEntSubject(true)
    setEntSubjectError(null)
    try {
      await api(`/courses/${courseId}/ent-subject`, { method: 'PUT', body: { subject } })
      await mutate()
    } catch (err) {
      setEntSubjectError((err as Error).message || t('errorOccurred'))
    } finally {
      setSavingEntSubject(false)
    }
  }

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
    const rules=item.type === 'quiz' ? item.quiz_access_rules ?? [] : []
    const mixed=new Set(rules.map(r=>`${r.max_attempts}:${r.deadline_at??''}`)).size>1
    setMixedAccessRules(mixed);setAccessRulesDirty(false)
    setAccessAttempts(String(!mixed&&rules[0]?rules[0].max_attempts:1))
    const deadline=!mixed?rules[0]?.deadline_at:null
    if(deadline){const d=new Date(deadline);setAccessDeadline(new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16))}else setAccessDeadline('')
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
        body: { group_ids: accessGroupIds, student_ids: accessStudentIds,
          ...(accessItem.type==='quiz' && (!mixedAccessRules||accessRulesDirty)?{quiz_rules:{max_attempts:Number(accessAttempts),deadline_at:!accessRulesDirty&&!mixedAccessRules&&accessItem.quiz_access_rules?.[0]?accessItem.quiz_access_rules[0].deadline_at:accessDeadline?new Date(accessDeadline).toISOString():null}}:{}) },
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

  const studentCount = (course?.students ?? []).length
  const shouldShowWarning = course?.is_published && studentCount > 0

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Курсқа өту жолы">
        <Link href="/courses" className="inline-flex items-center gap-1"><ArrowLeft size={15} />{t('catalog')}</Link>
        <ChevronRight size={15} aria-hidden="true" /><span aria-current="page">Курс</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroIcon}><BookOpen size={37} aria-hidden="true" /></div>
        <div className={styles.heroMain}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <div className="flex flex-wrap gap-2">
                <Badge tone={course.is_published ? 'success' : 'neutral'}>{course.is_published ? t('published') : t('draft')}</Badge>
                {course.enrollment_status && <Badge tone={course.enrollment_status === 'approved' ? 'success' : 'warning'}>{t(course.enrollment_status as TKey)}</Badge>}
              </div>
              <h1 className={styles.heroTitle}>{course.title}</h1>
              {course.description && <p className={styles.heroDescription}>{course.description}</p>}
            </div>
            {isOwner && <div className={styles.heroActions}>
              <div className={styles.menuAnchor}>
                <button type="button" className={styles.menuTrigger} aria-label={t('courseOptions')} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreVertical size={18} /></button>
                <DropdownMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={[{label:t('deleteCourse'),icon:<Trash size={16} />,destructive:true,onClick:()=>setDeleteModalOpen(true)}]} />
              </div>
              <Button asChild variant="outline"><Link href={`/teacher/courses/${courseId}/gradebook`}>{t('gradebook')}</Link></Button>
              <Button onClick={() => setAddOpen(true)}><PlusCircle size={16} />{t('addItem')}</Button>
            </div>}
          </div>
          <div className={styles.heroMeta}>
            <div className={styles.metaItem}><span className={styles.metaIcon}><UserRound size={18} /></span><span className={styles.metaText}><small>{t('instructor')}</small><strong>{course.teacher_name}</strong></span></div>
            <div className={styles.metaItem}><span className={styles.metaIcon}><BookOpen size={18} /></span><span className={styles.metaText}><small>{t('lessons')}</small><strong>{items.length} {t('itemsCount')}</strong>{!isOwner && <em>{completed} / {items.length} {t('completed')}</em>}</span></div>
            {isOwner && <div className={styles.metaItem}><span className={styles.metaIcon}><Users size={18} /></span><span className={styles.metaText}><small>{t('courseGroups')}{course.groups?.length ? ` · ${course.groups.length}` : ''}</small><strong>{course.groups?.length ? course.groups.map(group => `${group.code} — ${group.title}`).join(', ') : t('noGroups')}</strong>{course.groups?.length ? <em>{course.groups.map(group => `${group.code}: ${group.student_count}/${group.capacity} ${t('studentsCount')}`).join(' · ')}</em> : null}</span></div>}
          </div>
        </div>
      </header>

      {actionError && <ErrorState message={actionError} />}

      {course.announcement && (
        <Card className="flex gap-3 border-primary/20 bg-primary-soft/50">
          <Megaphone size={20} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t('announcement')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{course.announcement}</p>
          </div>
        </Card>
      )}

      <nav className={styles.sectionTabs} aria-label="Курс бөлімдері"><a href="#course-content">{t('courseContent')}</a>{isOwner && <a href="#course-ent">Пәндік сынақ ҰБТ</a>}</nav>

      <section id="course-content" className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <button
            type="button"
            className={`${styles.sectionHeading} ${styles.sectionToggle}`}
            onClick={() => setContentExpanded((value) => !value)}
            aria-expanded={contentExpanded}
          >
            <span className={styles.sectionIcon}><ClipboardList size={20} /></span>
            <span><h2>{t('courseContent')}</h2><p>Курстың оқу материалдары: сабақтар, тапсырмалар мен тесттер.</p></span>
            {contentExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {isOwner && (
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <PlusCircle size={15} />
              {t('addItem')}
            </Button>
          )}
        </div>

        {contentExpanded && (course.items === null ? (
          <EmptyState
            icon={<Lock size={22} />}
            title={t('locked')}
            hint={t('lockedHint')}
          />
        ) : items.length ? (
          <div className={styles.rows}>
            {items.map((item) => {
              const locked = item.locked
              const deadline = fmtDate(item.deadline_at)
              const content = (
                <div className={`${styles.itemRow} ${locked && !isOwner ? styles.itemRowLocked : ''}`}>
                  <span className={styles.itemIcon}>{!locked || isOwner ? TYPE_ICON[item.type] : <Lock size={18} />}</span>
                  <div className={styles.itemMain}>
                    <div className={styles.itemTitle}>
                      <strong>{item.title}</strong>
                      <span className={styles.itemBadges}><Badge tone="neutral">{t(item.type)}</Badge>
                      {item.completed && <Badge tone="success">{t('completed')}</Badge>}
                      {!isOwner && locked && <Badge tone="warning">{t('locked')}</Badge>}
                      {isOwner && <><Badge tone={item.is_visible ? 'success' : 'neutral'}>{item.is_visible ? t('visible') : t('hidden')}</Badge><Badge tone={item.sequential_unlock ? 'warning' : 'neutral'}>{item.sequential_unlock ? 'Кезекпен құлыпталады' : 'Құлып шарты жоқ'}</Badge></>}
                      </span>
                    </div>
                    {item.note && <p className={styles.itemNote}>{item.note}</p>}
                    {isOwner && <p className={styles.itemNote}>{t('topicAccess')}: {(item.access_group_ids?.length ?? 0) + (item.access_student_ids?.length ?? 0)}</p>}
                  </div>
                  <div className={styles.itemMetrics}>
                    {item.time_limit_minutes ? <span><CalendarClock size={14} />{item.time_limit_minutes} минут</span> : item.type === 'quiz' ? <span><CalendarClock size={14} />Уақыт шегі: —</span> : null}
                    {item.max_score != null && <span><Settings2 size={14} />{t('maxScore')}: {item.max_score}</span>}
                    {deadline && <span><CalendarClock size={14} />{t('deadline')}: {deadline}</span>}
                    {item.weight_pct ? <span><Settings2 size={14} />{t('weight')}: {item.weight_pct}%</span> : null}
                  </div>
                  {isOwner ? <div className={styles.itemActions}>
                    <Button asChild size="sm" variant="outline" className={styles.openButton}><Link href={`/items/${item.id}`}>{t('openItem')}</Link></Button>
                    <div className={styles.menuAnchor}>
                      <button type="button" className={styles.menuTrigger} aria-label={`«${item.title}» әрекеттері`} aria-haspopup="menu" aria-expanded={itemMenuId === item.id} onClick={() => setItemMenuId(itemMenuId === item.id ? null : item.id)}><MoreVertical size={17} /></button>
                      <DropdownMenu open={itemMenuId === item.id} onClose={() => setItemMenuId(null)} items={[
                        {label:item.is_visible ? t('hidden') : t('visible'),icon:item.is_visible ? <EyeOff size={15} /> : <Eye size={15} />,onClick:()=>{void patchItem(item.id,{is_visible:!item.is_visible})}},
                        {label:item.sequential_unlock ? t('open') : t('locked'),icon:<Lock size={15} />,onClick:()=>{void patchItem(item.id,{sequential_unlock:!item.sequential_unlock})}},
                        {label:t('topicAccess'),icon:<Users size={15} />,onClick:()=>openAccessModal(item)},
                      ]} />
                    </div>
                  </div> : !locked && <span className={styles.itemActions}><span className="text-sm font-semibold text-primary">{t('openItem')}</span><ArrowRight size={18} className="text-primary" /></span>}
                </div>
              )
              return (
                <div key={item.id}>
                  {locked || isOwner ? (
                    <div title={locked ? (item.topic_open === false ? t('topicClosedHint') : t('lockedHint')) : undefined}>{content}</div>
                  ) : (
                    <Link href={`/items/${item.id}`} className="block">
                      {content}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={t('noData')}
            action={isOwner ? <Button onClick={() => setAddOpen(true)}>{t('addItem')}</Button> : undefined}
          />
        ))}
      </section>

      {isOwner && <section id="course-ent" className={styles.sectionCard}>
        <button
          type="button"
          className={`${styles.sectionHeading} ${styles.sectionToggle} mb-4 w-full`}
          onClick={() => setEntExpanded((value) => !value)}
          aria-expanded={entExpanded}
        >
          <span className={styles.sectionIcon}><ClipboardList size={20} /></span>
          <span className="flex-1"><h2>Пәндік сынақ ҰБТ</h2><p>Курс пәні бойынша нұсқаларды құру және редакциялау.</p></span>
          {entExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {entExpanded && user?.role === 'admin' && (
          <Card className="space-y-3 border-primary/20 bg-primary-soft/30">
            <div>
              <p className="text-sm font-semibold text-foreground">Курс пәні</p>
              <p className="mt-1 text-sm text-muted">
                Пәндік сынақ нұсқаларын құру үшін курсқа ҰБТ пәнін бекітіңіз.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Пәнді таңдаңыз">
                  <Select
                    value={entSubjectDraft || currentEntSubject}
                    onChange={(event) => setEntSubjectDraft(event.target.value)}
                  >
                    <option value="">Пәнді таңдаңыз</option>
                    {Object.entries(SUBJECT_NAMES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                type="button"
                onClick={saveEntSubject}
                disabled={savingEntSubject || !(entSubjectDraft || currentEntSubject)}
              >
                {savingEntSubject ? t('loading') : 'Пәнді сақтау'}
              </Button>
            </div>
            {entSubjectError && <ErrorState message={entSubjectError} />}
          </Card>
        )}
        {entExpanded && <CourseEntVariants
          courseId={courseId}
          subject={course.ent_subject ?? null}
        />}
      </section>}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addItem')}>
        <form onSubmit={createItem} className="space-y-4">
          <Field label={t('title')}>
            <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} required />
          </Field>
          <Field label={t('content')}>
            <Select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>
              <option value="lesson">{t('lesson')}</option>
              <option value="quiz">Тараулық тест</option>
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

          {accessItem?.type==='quiz'&&<div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Тапсыру саны"><Input type="number" required min={1} max={100} step={1} value={accessAttempts} onChange={e=>{setAccessAttempts(e.target.value);setAccessRulesDirty(true)}}/></Field><Field label="Тапсыру мерзімі"><Input type="datetime-local" value={accessDeadline} onChange={e=>{setAccessDeadline(e.target.value);setAccessRulesDirty(true)}}/></Field></div>
            <p className="text-xs text-muted">Мерзім жергілікті уақытпен көрсетіледі. Қабаттасатын рұқсаттарда ең қатаң шектеу қолданылады. Басталған әрекеттің таймері өзгермейді.</p>
            {mixedAccessRules&&!accessRulesDirty&&<p role="status" className="text-xs text-muted">Таңдалған рұқсаттардың шектеулері әртүрлі. Өрістерді өзгертпесеңіз, бұрынғы шектеулер сақталады; жаңа рұқсатқа 1 әрекет және мерзімсіз қолжетімділік беріледі.</p>}
          </div>}
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
