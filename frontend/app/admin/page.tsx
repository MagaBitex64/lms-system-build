'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { BookOpen, Check, ChevronDown, GraduationCap, Pencil, PlusCircle, Search, Trash2, UserMinus, Users, UserPlus, X, ClipboardList } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import { fetchAllGroups, useAllGroups } from '@/lib/groups'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Spinner, Modal, DeletionConfirmModal } from '../components/ui'
import { buildStudentGroups, studentGroupLabel } from './student-groups'
import styles from './users.module.css'

type UserPage = { items: User[]; total: number }

type User = {
  id: number
  full_name: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  is_blocked: boolean
}

type Group = {
  id: number
  code: string
  title: string
  direction: string
  stream: string
  capacity: number
  student_count: number
}

type GroupDetail = Group & {
  students: Array<User & { added_at: string }>
  courses: Array<{ id: number; title: string; teacher_name: string }>
}

type TeacherDetail = User & {
  courses_count: number
  active_students: number
  courses: Array<{
    id: number
    title: string
    description: string
    is_published: boolean
    students: number
    items: number
    groups: Array<Group>
  }>
}

type Tab = 'students' | 'teachers' | 'groups'

export default function AdminDashboard() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('students')

  return (
    <div className={styles.page}>
      <header className={styles.heading}><p>ӘКІМШІ</p><h1>Пайдаланушылар</h1><span>Оқушыларды, мұғалімдерді және оқу топтарын басқарыңыз.</span></header>

      <div className={styles.tabs} aria-label="Пайдаланушы санаттары">
        {([
          ['students', t('students'), <Users key="students" size={16} />],
          ['teachers', t('teachers'), <GraduationCap key="teachers" size={16} />],
          ['groups', t('groups'), <BookOpen key="groups" size={16} />],
        ] as const).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentsTab />}
      {tab === 'teachers' && <TeachersTab />}
      {tab === 'groups' && <GroupsTab />}
    </div>
  )
}

async function loadStudentDirectory() {
  const students: User[] = []
  for (let page = 1; ; page++) {
    const result = await fetcher<UserPage>(`/admin/users?role=student&per_page=100&page=${page}`)
    students.push(...result.items)
    if (!result.items.length || students.length >= result.total) break
  }
  const groups = await fetchAllGroups<Group>()
  const details: GroupDetail[] = []
  for (let start = 0; start < groups.items.length; start += 4) {
    details.push(...await Promise.all(groups.items.slice(start, start + 4).map(group => fetcher<GroupDetail>(`/admin/groups/${group.id}`))))
  }
  return { students, groups: details }
}

function StudentsTab() {
  const { t } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState('')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const { data, isLoading, error: loadError, mutate } = useSWR('admin-student-directory', loadStudentDirectory)
  const sections = useMemo(() => buildStudentGroups(data?.students ?? [], data?.groups ?? []), [data])
  const visibleGroups = sections.filter(group => !groupFilter || group.id === groupFilter).map(group => ({ ...group, matches: filterUsers(group.students, query) }))
    .filter(group => query.trim() ? group.matches.length > 0 : group.id !== 'unassigned' || group.students.length > 0 || groupFilter === 'unassigned')

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creating) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setCreating(true)
    setError(null)
    try {
      await api('/admin/users', {
        body: {
          full_name: String(form.get('full_name') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          role: 'student',
        },
      })
      formElement.reset()
      setCreateOpen(false)
      setNotice('Оқушы қосылды')
      await mutate()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="text-sm text-success-foreground">{notice}</p>}
      <div className={styles.studentToolbar}>
        <div className={styles.search}><Search size={17} /><Input aria-label="Оқушыны іздеу" placeholder="Оқушыны іздеу..." value={query} onChange={event => { setQuery(event.target.value); setOpenGroups({}) }} /></div>
        <Select aria-label="Топ бойынша" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">Топ бойынша</option>{(data?.groups ?? []).map(group => <option key={group.id} value={group.id}>{studentGroupLabel(group)}</option>)}<option value="unassigned">Топқа тіркелмеген оқушылар</option></Select>
        <Button onClick={() => { setCreateOpen(true); setError(null) }}><UserPlus size={16} />{t('createStudent')}</Button>
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('createStudent')} closeDisabled={creating}>
        <form onSubmit={createUser} autoComplete="off" className="space-y-4">
          <Field label={t('fullName')}><Input name="full_name" required minLength={2} /></Field>
          <Field label={t('email')}><Input name="email" type="email" autoComplete="off" required /></Field>
          <Field label={t('password')} hint={t('passwordHint')}><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={creating} className="w-full"><UserPlus size={16} />{creating ? 'Қосылуда…' : 'Оқушыны қосу'}</Button>
        </form>
      </Modal>

      {isLoading ? <Spinner /> : loadError ? <ErrorState message={t('errorOccurred')} /> : !visibleGroups.length ? <EmptyState icon={<Users size={22} />} title={query.trim() || groupFilter ? t('noResults') : t('noData')} /> : <div className={styles.groupedStudents}>
        {visibleGroups.map((group, index) => {
          const expanded = openGroups[group.id] ?? (query.trim() !== '' || index === 0)
          const panelId = `student-group-${group.id}`
          return <section key={group.id} className={styles.studentGroup}>
            <button type="button" className={styles.groupToggle} aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpenGroups(current => ({ ...current, [group.id]: !expanded }))}>
              <span className={styles.groupIcon}><Users size={20} /></span><strong>{studentGroupLabel(group)}</strong><span className={styles.groupCount}>{query.trim() ? `${group.matches.length} / ` : ''}{group.students.length} оқушы</span><ChevronDown size={18} className={expanded ? styles.chevronOpen : ''} />
            </button>
            {expanded && <div id={panelId} className={styles.groupContent}>
              {!group.matches.length ? <div className={styles.emptyGroup}>{t('noData')}</div> : <div role="table" aria-label={`${studentGroupLabel(group)} оқушылары`} className={styles.studentTable}>
                <div role="row" className={styles.tableHeader}><span role="columnheader">#</span><span role="columnheader">Аты-жөні</span><span role="columnheader">Электрондық пошта</span><span role="columnheader">Күйі</span><span role="columnheader">Әрекеттер</span></div>
                <div role="rowgroup">{group.matches.map((student, row) => <UserRow key={student.id} user={student} fixedRole="student" onChanged={mutate} tableLayout rowNumber={row + 1} />)}</div>
              </div>}
            </div>}
          </section>
        })}
      </div>}
    </div>
  )
}

function TeachersTab() {
  const { t } = useI18n()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')
  const [groupToRemove, setGroupToRemove] = useState<{ courseId: number; group: Group } | null>(null)
  const [removingGroup, setRemovingGroup] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [query])
  const teachersReq = useSWR<UserPage>(`/admin/users?role=teacher&per_page=50&page=${page}&q=${encodeURIComponent(query)}`, fetcher)
  const groupsReq = useAllGroups<Group>()
  const detailReq = useSWR<TeacherDetail>(selectedId ? `/admin/teachers/${selectedId}` : null, fetcher)
  const teachers = teachersReq.data?.items ?? []

  async function createTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creating) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setCreating(true)
    setError(null)
    try {
      await api('/admin/users', {
        body: {
          full_name: String(form.get('full_name') ?? ''),
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
          role: 'teacher',
        },
      })
      formElement.reset()
      setCreateOpen(false)
      setNotice('Мұғалім қосылды')
      await teachersReq.mutate()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setCreating(false)
    }
  }

  async function addGroup(courseId: number, groupId: string) {
    if (!groupId) return
    await api(`/admin/courses/${courseId}/groups`, { body: { group_id: Number(groupId) } })
    await detailReq.mutate()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-success-foreground">{notice}</p>
        <Button onClick={() => { setCreateOpen(true); setError(null) }}><UserPlus size={16} />{t('createTeacher')}</Button>
      </div>
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('createTeacher')} closeDisabled={creating}>
          <form onSubmit={createTeacher} autoComplete="off" className="space-y-4">
            <Field label={t('fullName')}><Input name="full_name" required minLength={2} /></Field>
            <Field label={t('email')}><Input name="email" type="email" autoComplete="off" required /></Field>
            <Field label={t('password')} hint={t('passwordHint')}><Input name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" disabled={creating} className="w-full"><UserPlus size={16} />{creating ? 'Қосылуда…' : 'Мұғалімді қосу'}</Button>
          </form>
      </Modal>
      <DeletionConfirmModal open={groupToRemove !== null} onClose={() => setGroupToRemove(null)}
        title="Топты курстан алып тастау" description="Осы топты курстан алып тастағыңыз келе ме?"
        courseName={groupToRemove?.group.title ?? ''} isLoading={removingGroup} warning={removeError || undefined}
        onConfirm={async () => {
          if (!groupToRemove) return
          setRemovingGroup(true); setRemoveError('')
          try {
            await api(`/admin/courses/${groupToRemove.courseId}/groups/${groupToRemove.group.id}`, { method: 'DELETE' })
            await detailReq.mutate(); setGroupToRemove(null)
          } catch (err) { setRemoveError((err as Error).message) }
          finally { setRemovingGroup(false) }
        }}
      />
      <div className={styles.teacherLayout}>
      <div className="min-w-0 space-y-6">

        <Card className={`${styles.panel} space-y-4`}>
          <ListHeader title={t('teachers')} query={query} setQuery={setQuery} placeholder="Мұғалімді іздеу" />
          {teachersReq.isLoading ? <Spinner /> : teachersReq.error ? <ErrorState message={t('errorOccurred')} /> : (
            <div className="space-y-2">
              {!teachers.length && <EmptyState title={query ? t('noResults') : t('noData')} />}
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  role="group"
                  tabIndex={0}
                  aria-label={`${teacher.full_name} мұғалімін таңдау`}
                  onClick={() => setSelectedId(teacher.id)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setSelectedId(teacher.id)
                    }
                  }}
                  className={styles.teacherItem}
                  data-selected={selectedId === teacher.id}
                >
                  <UserRow
                    user={teacher}
                    onSelect={() => setSelectedId(teacher.id)}
                    fixedRole="teacher"
                    onChanged={async () => {
                      await teachersReq.mutate()
                      await detailReq.mutate()
                    }}
                    onDeleted={() => {
                      if (selectedId === teacher.id) setSelectedId(null)
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} total={teachersReq.data?.total ?? 0} perPage={50} onPage={setPage} />
        </Card>
      </div>

      <Card className={`${styles.panel} space-y-4`}>
        {!selectedId ? (
          <EmptyState icon={<GraduationCap size={22} />} title={t('selectTeacher')} />
        ) : detailReq.isLoading ? (
          <Spinner />
        ) : detailReq.error || !detailReq.data ? (
          <ErrorState message={t('errorOccurred')} />
        ) : (
          <>
            <div className={styles.detailHeading}>
              <h2 className="text-lg font-semibold">{detailReq.data.full_name}</h2>
              <p className="text-sm text-muted">{detailReq.data.email}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label={t('courses')} value={detailReq.data.courses_count} />
              <Metric label={t('activeStudents')} value={detailReq.data.active_students} />
            </div>
            <div className="space-y-3">
              {detailReq.data.courses.length ? detailReq.data.courses.map((course) => {
                const availableGroups = (groupsReq.data?.items ?? []).filter((g) => !course.groups.some((cg) => cg.id === g.id))
                return (
                  <div key={course.id} className="rounded-lg border border-border bg-surface-muted p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{course.title}</p>
                        <p className="mt-1 text-sm text-muted">{course.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={course.is_published ? 'success' : 'neutral'}>{course.is_published ? t('published') : t('draft')}</Badge>
                          <Badge>{course.students} {t('studentsCount')}</Badge>
                          <Badge>{course.items} {t('itemsCount')}</Badge>
                        </div>
                      </div>
                      <Select defaultValue="" onChange={(e) => addGroup(course.id, e.target.value)} className="sm:w-56">
                        <option value="">{t('addGroup')}</option>
                        {availableGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.code} - {group.title}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {course.groups.length ? course.groups.map((group) => {
                        const capacity = group.capacity ?? groupsReq.data?.items.find(item => item.id === group.id)?.capacity
                        return (
                        <span key={group.id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {group.code} - {group.student_count}{capacity != null && `/${capacity}`}
                          <button
                            onClick={() => { setRemoveError(''); setGroupToRemove({ courseId: course.id, group }) }}
                            className="rounded-full p-0.5 hover:bg-primary/10"
                            aria-label={t('remove')}
                          >
                            <X size={12} />
                          </button>
                        </span>
                        )
                      }) : <span className="text-sm text-muted">{t('noGroups')}</span>}
                    </div>
                  </div>
                )
              }) : <EmptyState icon={<BookOpen size={22} />} title={t('noCoursesYet')} />}
            </div>
          </>
        )}
      </Card>
    </div>
    </div>
  )
}

function GroupsTab() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [studentQuery, setStudentQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const groupsReq = useAllGroups<Group>()
  const detailReq = useSWR<GroupDetail>(selectedId ? `/admin/groups/${selectedId}` : null, fetcher)
  const searchReq = useSWR<{ items: User[] }>(
    selectedId ? `/admin/groups/${selectedId}/student-search?q=${encodeURIComponent(studentQuery)}` : null,
    fetcher,
  )
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = groupsReq.data?.items ?? []
    if (!q) return items
    return items.filter((g) => `${g.code} ${g.title} ${g.direction}`.toLowerCase().includes(q))
  }, [groupsReq.data, query])

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError(null)
    try {
      await api('/admin/groups', {
        body: {
          code: String(form.get('code') ?? ''),
          title: String(form.get('title') ?? ''),
          direction: String(form.get('direction') ?? ''),
          stream: String(form.get('stream') ?? ''),
          capacity: Number(form.get('capacity') || 20),
        },
      })
      formElement.reset()
      await groupsReq.mutate()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    }
  }

  async function addStudent(studentId: number) {
    if (!selectedId) return
    await api(`/admin/groups/${selectedId}/students`, { body: { student_id: studentId } })
    setStudentQuery('')
    await detailReq.mutate()
    await searchReq.mutate()
    await groupsReq.mutate()
  }

  async function deleteGroup(groupId: number) {
    setDeleting(true); setDeleteError('')
    try {
      await api(`/admin/groups/${groupId}`, { method: 'DELETE' })
      setConfirmDelete(false)
      setSelectedId(null)
      await groupsReq.mutate()
    } catch (err) { setDeleteError((err as Error).message) }
    finally { setDeleting(false) }
  }

  async function updateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return
    const form = new FormData(event.currentTarget)
    await api(`/admin/groups/${selectedId}`, {
      method: 'PATCH',
      body: {
        code: String(form.get('code') ?? ''),
        title: String(form.get('title') ?? ''),
        direction: String(form.get('direction') ?? ''),
        stream: String(form.get('stream') ?? ''),
        capacity: Number(form.get('capacity') || 20),
      },
    })
    setEditingGroup(false)
    await detailReq.mutate()
    await groupsReq.mutate()
  }

  return (
    <div className={styles.groupsLayout}>
      <DeletionConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)}
        onConfirm={() => { if (selectedId) void deleteGroup(selectedId) }}
        title="Топты өшіру" description={`«${detailReq.data?.title ?? ''}» тобын өшіргіңіз келе ме?`}
        courseName={detailReq.data?.title ?? ''} warning={deleteError || undefined} isLoading={deleting}
      />
      <div className="space-y-6">
        <Card className={styles.panel}>
          <h2 className="text-base font-semibold">{t('createGroup')}</h2>
          <form onSubmit={createGroup} className="mt-4 space-y-4">
            <Field label={t('groupCode')}><Input name="code" placeholder="ИМ1" required /></Field>
            <Field label={t('title')}><Input name="title" placeholder="ИМ1 - Информатика-математика" required /></Field>
            <Field label={t('direction')}><Input name="direction" placeholder="Информатика-математика" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('stream')}><Input name="stream" placeholder="1" required /></Field>
              <Field label={t('capacity')}><Input name="capacity" type="number" defaultValue={20} min={1} max={40} required /></Field>
            </div>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full"><PlusCircle size={16} />{t('create')}</Button>
          </form>
        </Card>

        <Card className={`${styles.panel} space-y-4`}>
          <ListHeader title={t('groups')} query={query} setQuery={setQuery} />
          {groupsReq.isLoading ? <Spinner /> : groupsReq.error ? <ErrorState message={t('errorOccurred')} /> : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedId(group.id)}
                  className={styles.groupChoice}
                  data-selected={selectedId === group.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{group.code}</p>
                    <Badge>{group.student_count}/{group.capacity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">{group.title}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className={`${styles.panel} space-y-5`}>
        {!selectedId ? (
          <EmptyState icon={<Users size={22} />} title={t('selectGroup')} />
        ) : detailReq.isLoading ? (
          <Spinner />
        ) : detailReq.error || !detailReq.data ? (
          <ErrorState message={t('errorOccurred')} />
        ) : (
          <>
            {editingGroup ? (
              <form onSubmit={updateGroup} className="space-y-3 rounded-lg border border-border bg-surface-muted p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('groupCode')}><Input name="code" defaultValue={detailReq.data.code} required /></Field>
                  <Field label={t('title')}><Input name="title" defaultValue={detailReq.data.title} required /></Field>
                  <Field label={t('direction')}><Input name="direction" defaultValue={detailReq.data.direction} required /></Field>
                  <Field label={t('stream')}><Input name="stream" defaultValue={detailReq.data.stream} required /></Field>
                  <Field label={t('capacity')}><Input name="capacity" type="number" defaultValue={detailReq.data.capacity} min={1} max={40} required /></Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingGroup(false)}><X size={15} />{t('cancel')}</Button>
                  <Button type="submit"><Check size={15} />{t('save')}</Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{detailReq.data.code} - {detailReq.data.title}</h2>
                  <p className="text-sm text-muted">{detailReq.data.direction}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="primary">{detailReq.data.students.length}/{detailReq.data.capacity}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setEditingGroup(true)}><Pencil size={14} />{t('edit')}</Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => { setDeleteError(''); setConfirmDelete(true) }}><Trash2 size={14} />{t('delete')}</Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t('addStudent')}</h3>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input className="pl-9" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder={t('searchByName')} />
              </div>
              {studentQuery.trim() && (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  {(searchReq.data?.items ?? []).map((student) => (
                    <button
                      key={student.id}
                      onClick={() => addStudent(student.id)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-muted"
                    >
                      <span>
                        <span className="block text-sm font-medium">{student.full_name}</span>
                        <span className="block text-xs text-muted">{student.email}</span>
                      </span>
                      <PlusCircle size={16} className="text-primary" />
                    </button>
                  ))}
                  {!searchReq.isLoading && !(searchReq.data?.items ?? []).length && <p className="p-3 text-sm text-muted">{t('noResults')}</p>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t('students')}</h3>
              {detailReq.data.students.length ? (
                <UserList
                  users={detailReq.data.students}
                  fixedRole="student"
                  onRemove={async (student) => {
                    await api(`/admin/groups/${detailReq.data!.id}/students/${student.id}`, { method: 'DELETE' })
                    await detailReq.mutate()
                    await groupsReq.mutate()
                    await searchReq.mutate()
                  }}
                />
              ) : <EmptyState title={t('noData')} />}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t('courses')}</h3>
              {detailReq.data.courses.length ? (
                <div className="space-y-2">
                  {detailReq.data.courses.map((course) => (
                    <div key={course.id} className="rounded-lg border border-border bg-surface-muted px-3 py-2">
                      <p className="text-sm font-medium">{course.title}</p>
                      <p className="text-xs text-muted">{course.teacher_name}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted">{t('noCoursesYet')}</p>}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

function filterUsers(users: User[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
}

function ListHeader({ title, query, setQuery, placeholder }: { title: string; query: string; setQuery: (value: string) => void; placeholder?: string }) {
  const { t } = useI18n()
  return (
    <div className={styles.listHeader}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className={styles.compactSearch}>
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder ?? t('search')} aria-label={placeholder ?? t('search')} className="pl-9 sm:w-56" />
      </div>
    </div>
  )
}

function UserList({
  users,
  fixedRole,
  onChanged,
  onRemove,
  emptyTitle,
}: {
  users: User[]
  fixedRole?: 'student' | 'teacher' | 'admin'
  onChanged?: () => Promise<unknown>
  onRemove?: (user: User) => Promise<void>
  emptyTitle?: string
}) {
  const { t } = useI18n()
  if (!users.length) return <EmptyState icon={<Users size={22} />} title={emptyTitle ?? t('noData')} />
  return (
    <div className={styles.userList}>
      {users.map((user) => (
        <UserRow key={user.id} user={user} fixedRole={fixedRole} onChanged={onChanged} onRemove={onRemove} />
      ))}
    </div>
  )
}

function UserRow({
  user,
  fixedRole,
  onChanged,
  onDeleted,
  onRemove,
  onSelect,
  tableLayout = false,
  rowNumber,
}: {
  user: User
  fixedRole?: 'student' | 'teacher' | 'admin'
  onChanged?: () => Promise<unknown>
  onSelect?: () => void
  onDeleted?: () => void
  onRemove?: (user: User) => Promise<void>
  tableLayout?: boolean
  rowNumber?: number
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setWorking(true)
    setError(null)
    try {
      const password = String(form.get('password') ?? '')
      await api(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: {
          full_name: String(form.get('full_name') ?? ''),
          email: String(form.get('email') ?? ''),
          password: password || undefined,
          role: fixedRole ?? String(form.get('role') ?? user.role),
          is_blocked: String(form.get('is_blocked')) === 'true',
        },
      })
      setEditing(false)
      await onChanged?.()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  async function deleteUser() {
    setWorking(true)
    setError(null)
    try {
      if (onRemove) {
        await onRemove(user)
      } else {
        await api(`/admin/users/${user.id}`, { method: 'DELETE' })
        onDeleted?.()
        await onChanged?.()
      }
      setConfirmOpen(false)
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  if (editing) {
    return (
      <div role={tableLayout ? 'row' : undefined} className={styles.editRow}><div role={tableLayout ? 'cell' : undefined} aria-colspan={tableLayout ? 5 : undefined}>
      <form onSubmit={update} className="w-full space-y-3 px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('fullName')}><Input name="full_name" defaultValue={user.full_name} required /></Field>
          <Field label={t('email')}><Input name="email" type="email" defaultValue={user.email} required /></Field>
          <Field label={t('password')} hint={t('optionalPassword')}><Input name="password" type="password" minLength={8} /></Field>
          <Field label={t('status')}>
            <Select name="is_blocked" defaultValue={String(user.is_blocked)}>
              <option value="false">{t('active')}</option>
              <option value="true">{t('blocked')}</option>
            </Select>
          </Field>
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={working}><X size={14} />{t('cancel')}</Button>
          <Button type="submit" size="sm" disabled={working}><Check size={14} />{t('save')}</Button>
        </div>
      </form></div></div>
    )
  }

  const statusBadge = <Badge tone={user.is_blocked ? 'danger' : 'success'}><span className={styles.statusDot} />{user.is_blocked ? t('blocked') : t('active')}</Badge>
  const actions = <div className={styles.rowActions}>
    {onRemove ? <Button size="sm" variant="outline" aria-label="Топтан шығару" onClick={(event) => { event.stopPropagation(); setError(null); setConfirmOpen(true) }} disabled={working}><UserMinus size={14} /></Button> : <>
      <Button size="sm" variant="ghost" aria-label="Өңдеу" onClick={(event) => { event.stopPropagation(); setEditing(true) }} disabled={working}><Pencil size={14} /></Button>
      <Button size="sm" variant="danger-ghost" aria-label="Өшіру" onClick={(event) => { event.stopPropagation(); setError(null); setConfirmOpen(true) }} disabled={working}><Trash2 size={14} /></Button>
    </>}
  </div>
  const name = onSelect ? <button type="button" className={styles.userName} onClick={onSelect}>{user.full_name}</button> : <p className={styles.userName}>{user.full_name}</p>

  return (
    <>
    <DeletionConfirmModal
      open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => void deleteUser()}
      title={onRemove ? 'Оқушыны топтан шығару' : 'Пайдаланушыны өшіру'}
      description={onRemove ? `«${user.full_name}» оқушысын топтан шығарғыңыз келе ме?` : `«${user.full_name}» пайдаланушысын өшіргіңіз келе ме?`}
      courseName={user.full_name} warning={error || undefined} isLoading={working}
    />
    {tableLayout ? <div role="row" className={styles.tableRow} data-user-id={user.id}>
      <span role="cell" className={styles.rowNumber}>{rowNumber}</span>
      <div role="cell" className={styles.tableIdentity}><Avatar name={user.full_name} />{name}</div>
      <p role="cell" className={styles.tableEmail}>{user.email}</p>
      <div role="cell" className={styles.tableStatus}>{statusBadge}</div><div role="cell" className={styles.tableActions}>{actions}</div>
    </div> : <div className={styles.userRow}>
      <Avatar name={user.full_name} /><div className={styles.userIdentity}>{name}<p className={styles.userEmail}>{user.email}</p></div><div className={styles.userStatus}>{statusBadge}</div>{actions}
    </div>}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.metric}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function EntTrialTab() {
  return <Card className="space-y-4 p-6">
    <h2 className="text-xl font-bold">ҰБТ нұсқалары</h2>
    <p className="text-muted">Сұрақтар мен контекстерді ҰБТ ережелеріне сай құрылымды редакторда басқарыңыз.</p>
    <a href="/ent-trial" className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">ҰБТ редакторын ашу →</a>
  </Card>
}

function Pagination({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  return <div className={styles.pagination}>
    <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Алдыңғы</Button>
    <span className="text-sm">{page} / {pages} · {total}</span>
    <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Келесі</Button>
  </div>
}
