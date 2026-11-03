'use client'

import { useState, useRef, type FormEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR, { useSWRConfig } from 'swr'
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
import CourseContentSections from '@/components/course-content-sections'
import ContentAccessModal, {type AccessTarget} from '@/components/content-access-modal'
import {CourseEnrollmentManagement} from '@/components/enrollment-management'
import type {CourseSection} from '@/lib/course-sections'
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
  section_id?: number | null
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
  access_configured?: boolean
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
  direct_enrollment?: boolean | null
  legacy_access?: boolean
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
  sections?: CourseSection[]
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

  const { mutate: refreshCache } = useSWRConfig()
  const [publicationOpen, setPublicationOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const publicationBusy = useRef(false)
  const [publicationError, setPublicationError] = useState<string | null>(null)
  const [publicationSuccess, setPublicationSuccess] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [itemType, setItemType] = useState<ItemType>('lesson')
  const [itemTitle, setItemTitle] = useState('')
  const [itemNote, setItemNote] = useState('')
  const [itemVisible, setItemVisible] = useState(true)
  const [itemSequential, setItemSequential] = useState(false)
  const [itemSectionId, setItemSectionId] = useState<number | null>(null)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [accessTarget, setAccessTarget] = useState<AccessTarget | null>(null)
  const [contentExpanded, setContentExpanded] = useState(true)
  const [entExpanded, setEntExpanded] = useState(true)
  const [subjectSettingsOpen, setSubjectSettingsOpen] = useState(false)
  const [subjectConfirmed, setSubjectConfirmed] = useState(false)
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

  async function togglePublication() {
    if (!course || !isOwner || publicationBusy.current) return
    publicationBusy.current = true
    setPublishing(true)
    setPublicationError(null)
    setPublicationSuccess(null)
    try {
      const updated = await api<Course>(`/courses/${course.id}`, {
        method: 'PUT',
        body: {
          title: course.title,
          description: course.description,
          announcement: course.announcement ?? '',
          is_published: !course.is_published,
        },
      })
      await mutate({ ...course, is_published: updated.is_published }, { revalidate: false })
      setPublicationOpen(false)
      setPublicationSuccess(updated.is_published ? 'Курс жарияланды.' : 'Курс жариялаудан алынды.')
      // Refresh catalog, dashboard and course caches without repeating the mutation.
      void refreshCache(key => typeof key === 'string' &&
        (key.startsWith('/courses') || key.startsWith('/dashboard') || key.startsWith('/teacher'))
      ).catch(() => {})
    } catch (err) {
      setPublicationError((err as Error).message || 'Курс күйін өзгерту мүмкін болмады. Қайта көріңіз.')
    } finally {
      publicationBusy.current = false
      setPublishing(false)
    }
  }

  async function saveEntSubject() {
    const subject = entSubjectDraft || currentEntSubject
    if (!subject) return
    setSavingEntSubject(true)
    setEntSubjectError(null)
    try {
      await api(`/courses/${courseId}/ent-subject`, { method: 'PUT', body: { subject, confirm_subject_change: subjectConfirmed } })
      await mutate()
      setSubjectSettingsOpen(false)
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
          section_id: itemSectionId,
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

  function openAddItem(sectionId: number | null = null) {
    setItemSectionId(sectionId)
    setActionError(null)
    setAddOpen(true)
  }

  function openAccessModal(item: Item) { setAccessTarget({...item, kind:'item'}) }

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
                <DropdownMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={[{label:course.is_published ? 'Жариялаудан алып тастау' : 'Жариялау',icon:course.is_published ? <EyeOff size={16} /> : <Eye size={16} />,onClick:()=>{setPublicationError(null);setPublicationOpen(true)}},...(user?.role === 'admin' ? [{label:'Курс параметрлері',icon:<Settings2 size={16} />,onClick:()=>{setEntSubjectDraft(currentEntSubject);setSubjectConfirmed(false);setEntSubjectError(null);setSubjectSettingsOpen(true)}}] : []),{label:t('deleteCourse'),icon:<Trash size={16} />,destructive:true,onClick:()=>setDeleteModalOpen(true)}]} />
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

      {publicationSuccess && <p role="status" className="rounded-lg border border-primary/20 bg-primary-soft p-3 text-sm text-primary">{publicationSuccess}</p>}
      <Modal open={publicationOpen} onClose={() => { if (!publicationBusy.current) setPublicationOpen(false) }} closeDisabled={publishing} title={course.is_published ? 'Курсты жариялаудан алып тастау' : 'Курсты жариялау'}>
        <p className="text-sm leading-relaxed text-muted">{course.is_published
          ? 'Курс жарияланған курстар каталогынан алынады. Оқу материалдары, топтар, тіркелімдер мен нәтижелер сақталады. Қолданыстағы ереже бойынша оқушылар курс материалдарын қайта жарияланғанға дейін аша алмайды.'
          : 'Курс жарияланған күйге өтіп, курстар каталогында көрсетіледі. Оқушылар автоматты түрде тіркелмейді.'}</p>
        {publicationError && <p role="alert" className="mt-3 text-sm text-red-700">{publicationError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={publishing} onClick={() => setPublicationOpen(false)}>Бас тарту</Button>
          <Button disabled={publishing} onClick={() => void togglePublication()}>{publishing ? 'Сақталуда…' : course.is_published ? 'Жариялаудан алып тастау' : 'Жариялау'}</Button>
        </div>
      </Modal>
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

      <nav className={styles.sectionTabs} aria-label="Курс бөлімдері"><a href="#course-content">{t('courseContent')}</a>{isOwner && <><a href="#course-enrollments">Оқушылар мен топтар</a><a href="#course-ent">Пәндік сынақ ҰБТ</a></>}</nav>

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
            <Button variant="secondary" size="sm" onClick={() => openAddItem()}>
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
        ) : items.length || course.sections?.length || isOwner ? (
          <CourseContentSections key={courseId} courseId={courseId} sections={course.sections ?? []} items={items} isOwner={isOwner} reload={mutate} onAdd={openAddItem} onAccess={section=>setAccessTarget({...section,kind:'section'})}
            renderItem={(item, moveActions) => {
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
                        ...moveActions,
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
            }} />
        ) : (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={t('noData')}
            action={isOwner ? <Button onClick={() => openAddItem()}>{t('addItem')}</Button> : undefined}
          />
        ))}
      </section>

      {isOwner && <CourseEnrollmentManagement key={`enrollments-${courseId}`} courseId={courseId} groups={course.groups ?? []} students={course.students ?? []} canManage={user?.role === 'admin'} />}

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
        {entExpanded && <CourseEntVariants
          courseId={courseId}
          subject={course.ent_subject ?? null}
          onConfigure={user?.role === 'admin' ? () => { setEntSubjectDraft(currentEntSubject); setSubjectConfirmed(false); setEntSubjectError(null); setSubjectSettingsOpen(true) } : undefined}
        />}
      </section>}

        {user?.role === 'admin' && <Modal open={subjectSettingsOpen} onClose={() => setSubjectSettingsOpen(false)} title="Курс параметрлері">
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
                    onChange={(event) => {setEntSubjectDraft(event.target.value); setSubjectConfirmed(false)}}
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
                disabled={savingEntSubject || !(entSubjectDraft || currentEntSubject) || (!!currentEntSubject && entSubjectDraft !== currentEntSubject && !subjectConfirmed)}
              >
                {savingEntSubject ? t('loading') : 'Пәнді сақтау'}
              </Button>
            </div>
            <p className="text-sm text-muted">Өзгеріс тек жаңа нұсқаларға қолданылады. Бұрынғы нұсқалар, сұрақтар мен нәтижелер өзгермейді.</p>
            {currentEntSubject && entSubjectDraft && entSubjectDraft !== currentEntSubject && <label className="flex gap-2 text-sm"><input type="checkbox" checked={subjectConfirmed} onChange={e => setSubjectConfirmed(e.target.checked)} />Курс пәнін өзгертуді растаймын. Бұрынғы нұсқалардың пәні сақталады.</label>}
            {entSubjectError && <ErrorState message={entSubjectError} />}
          </Card>
        </Modal>}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addItem')}>
        <form onSubmit={createItem} className="space-y-4">
          <Field label="Бөлім"><Select value={itemSectionId ?? ''} onChange={event => setItemSectionId(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Бөлімге бөлінбеген материалдар</option>
            {(course.sections ?? []).map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
          </Select></Field>
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

      {accessTarget && <ContentAccessModal key={`${accessTarget.kind}-${accessTarget.id}`} courseId={courseId} target={accessTarget} students={course.students ?? []} groups={course.groups ?? []} parent={accessTarget.kind==='item' ? (course.sections ?? []).find(s=>s.id===accessTarget.section_id) : undefined} onClose={()=>setAccessTarget(null)} onSaved={mutate} />}

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
