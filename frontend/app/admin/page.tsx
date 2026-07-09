'use client'

import { useMemo, useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { BookOpen, Check, GraduationCap, Pencil, PlusCircle, Search, Trash2, UserMinus, Users, UserPlus, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, Select, Spinner } from '../components/ui'

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
    <div className="space-y-6">
      <PageHeader eyebrow={t('admin')} title={t('adminPanel')} description={t('adminPanelHint')} />

      <div className="flex flex-wrap gap-2 border-b border-border">
        {([
          ['students', t('students'), <Users key="students" size={16} />],
          ['teachers', t('teachers'), <GraduationCap key="teachers" size={16} />],
          ['groups', t('groups'), <BookOpen key="groups" size={16} />],
        ] as const).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}
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

function StudentsTab() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data, isLoading, error: loadError, mutate } = useSWR<{ items: User[] }>('/admin/users?role=student&per_page=100', fetcher)
  const students = filterUsers(data?.items ?? [], query)

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
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
      event.currentTarget.reset()
      await mutate()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <h2 className="text-base font-semibold">{t('createStudent')}</h2>
        <form onSubmit={createUser} className="mt-4 space-y-4">
          <Field label={t('fullName')}><Input name="full_name" required minLength={2} /></Field>
          <Field label={t('email')}><Input name="email" type="email" required /></Field>
          <Field label={t('password')} hint={t('passwordHint')}><Input name="password" type="password" required minLength={8} /></Field>
          {error && <ErrorState message={error} />}
          <Button type="submit" className="w-full"><UserPlus size={16} />{t('create')}</Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <ListHeader title={t('students')} query={query} setQuery={setQuery} />
        {isLoading ? <Spinner /> : loadError ? <ErrorState message={t('errorOccurred')} /> : (
          <UserList users={students} fixedRole="student" onChanged={mutate} />
        )}
      </Card>
    </div>
  )
}

function TeachersTab() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const teachersReq = useSWR<{ items: User[] }>('/admin/users?role=teacher&per_page=100', fetcher)
  const groupsReq = useSWR<{ items: Group[] }>('/admin/groups?per_page=100', fetcher)
  const detailReq = useSWR<TeacherDetail>(selectedId ? `/admin/teachers/${selectedId}` : null, fetcher)
  const teachers = filterUsers(teachersReq.data?.items ?? [], query)

  async function createTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
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
      event.currentTarget.reset()
      await teachersReq.mutate()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    }
  }

  async function addGroup(courseId: number, groupId: string) {
    if (!groupId) return
    await api(`/admin/courses/${courseId}/groups`, { body: { group_id: Number(groupId) } })
    await detailReq.mutate()
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold">{t('createTeacher')}</h2>
          <form onSubmit={createTeacher} className="mt-4 space-y-4">
            <Field label={t('fullName')}><Input name="full_name" required minLength={2} /></Field>
            <Field label={t('email')}><Input name="email" type="email" required /></Field>
            <Field label={t('password')} hint={t('passwordHint')}><Input name="password" type="password" required minLength={8} /></Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" className="w-full"><UserPlus size={16} />{t('create')}</Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <ListHeader title={t('teachers')} query={query} setQuery={setQuery} />
          {teachersReq.isLoading ? <Spinner /> : teachersReq.error ? <ErrorState message={t('errorOccurred')} /> : (
            <div className="space-y-2">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => setSelectedId(teacher.id)}
                  className={`w-full rounded-lg border text-left transition-colors ${
                    selectedId === teacher.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-muted'
                  }`}
                >
                  <UserRow
                    user={teacher}
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
        </Card>
      </div>

      <Card className="space-y-4">
        {!selectedId ? (
          <EmptyState icon={<GraduationCap size={22} />} title={t('selectTeacher')} />
        ) : detailReq.isLoading ? (
          <Spinner />
        ) : detailReq.error || !detailReq.data ? (
          <ErrorState message={t('errorOccurred')} />
        ) : (
          <>
            <div>
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
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{course.description}</p>
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
                      {course.groups.length ? course.groups.map((group) => (
                        <span key={group.id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {group.code} - {group.student_count}/{group.capacity}
                          <button
                            onClick={async () => {
                              await api(`/admin/courses/${course.id}/groups/${group.id}`, { method: 'DELETE' })
                              await detailReq.mutate()
                            }}
                            className="rounded-full p-0.5 hover:bg-primary/10"
                            aria-label={t('remove')}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )) : <span className="text-sm text-muted">{t('noGroups')}</span>}
                    </div>
                  </div>
                )
              }) : <EmptyState icon={<BookOpen size={22} />} title={t('noCoursesYet')} />}
            </div>
          </>
        )}
      </Card>
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
  const groupsReq = useSWR<{ items: Group[] }>('/admin/groups?per_page=100', fetcher)
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
    const form = new FormData(event.currentTarget)
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
      event.currentTarget.reset()
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
    if (!window.confirm(t('confirmDelete'))) return
    await api(`/admin/groups/${groupId}`, { method: 'DELETE' })
    setSelectedId(null)
    await groupsReq.mutate()
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
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
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

        <Card className="space-y-4">
          <ListHeader title={t('groups')} query={query} setQuery={setQuery} />
          {groupsReq.isLoading ? <Spinner /> : groupsReq.error ? <ErrorState message={t('errorOccurred')} /> : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedId(group.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedId === group.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-surface-muted'
                  }`}
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

      <Card className="space-y-5">
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
                  <Button size="sm" variant="danger" onClick={() => deleteGroup(detailReq.data!.id)}><Trash2 size={14} />{t('delete')}</Button>
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

function ListHeader({ title, query, setQuery }: { title: string; query: string; setQuery: (value: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} className="pl-9 sm:w-56" />
      </div>
    </div>
  )
}

function UserList({
  users,
  fixedRole,
  onChanged,
  onRemove,
}: {
  users: User[]
  fixedRole?: 'student' | 'teacher' | 'admin'
  onChanged?: () => Promise<unknown>
  onRemove?: (user: User) => Promise<void>
}) {
  const { t } = useI18n()
  if (!users.length) return <EmptyState icon={<Users size={22} />} title={t('noData')} />
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
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
}: {
  user: User
  fixedRole?: 'student' | 'teacher' | 'admin'
  onChanged?: () => Promise<unknown>
  onDeleted?: () => void
  onRemove?: (user: User) => Promise<void>
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
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
    if (!window.confirm(t('confirmDelete'))) return
    setWorking(true)
    setError(null)
    try {
      await api(`/admin/users/${user.id}`, { method: 'DELETE' })
      onDeleted?.()
      await onChanged?.()
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorking(false)
    }
  }

  if (editing) {
    return (
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
      </form>
    )
  }

  return (
    <div className="flex w-full items-center gap-3 px-3 py-3">
      <Avatar name={user.full_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.full_name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
      <Badge tone={user.is_blocked ? 'danger' : 'success'}>{user.is_blocked ? t('blocked') : t('active')}</Badge>
      <div className="flex shrink-0 gap-1">
        {onRemove ? (
          <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onRemove(user) }} disabled={working}><UserMinus size={14} /></Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setEditing(true) }} disabled={working}><Pencil size={14} /></Button>
            <Button size="sm" variant="danger" onClick={(event) => { event.stopPropagation(); deleteUser() }} disabled={working}><Trash2 size={14} /></Button>
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
