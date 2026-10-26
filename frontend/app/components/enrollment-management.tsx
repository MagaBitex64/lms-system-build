'use client'

import {useRef, useState} from 'react'
import useSWR from 'swr'
import {PlusCircle, Users, UserPlus} from 'lucide-react'
import {api} from '@/lib/api'
import {enrollmentSource, loadEnrollmentChoices, refreshEnrollmentQueries, type AssignedCourse, type AssignedGroup, type ChoiceKind, type EnrollmentStudent} from '@/lib/enrollments'
import {Badge, Button, ErrorState, Input, Modal, Spinner} from './ui'

function AssignmentPicker({kind, label, excluded, assign}: {kind: ChoiceKind; label: string; excluded: number[]; assign: (ids: number[]) => Promise<void>}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const choices = useSWR(open ? `enrollment-choices:${kind}` : null, () => loadEnrollmentChoices(kind))
  const q = query.trim().toLocaleLowerCase('kk')
  const options = (choices.data ?? []).filter(choice => !excluded.includes(choice.id) && `${choice.label} ${choice.detail}`.toLocaleLowerCase('kk').includes(q))
  async function save() {
    if (!selected.length || lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {await assign(selected); setOpen(false)}
    catch (err) {setError((err as Error).message)}
    finally {
      await refreshEnrollmentQueries()
      lock.current = false; setBusy(false)
    }
  }
  return <>
    <Button size="sm" onClick={() => {setSelected([]);setQuery('');setError(null);setOpen(true)}}><PlusCircle size={15} />{label}</Button>
    <Modal open={open} closeDisabled={busy} onClose={() => {if (!busy) setOpen(false)}} title={label}>
      <div className="space-y-4">
        <Input aria-label={`${label}: іздеу`} placeholder="Іздеу…" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} />
        {choices.isLoading ? <Spinner /> : choices.error ? <ErrorState message="Тізімді жүктеу мүмкін болмады" /> : <div className="max-h-80 space-y-2 overflow-auto">
          {options.map(choice => <label key={choice.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <input type="checkbox" disabled={busy} checked={selected.includes(choice.id)} onChange={event => setSelected(previous => event.target.checked ? [...previous, choice.id] : previous.filter(id => id !== choice.id))} />
            <span className="min-w-0 break-words"><strong className="block">{choice.label}</strong><small className="text-muted">{choice.detail}</small></span>
          </label>)}
          {!options.length && <p className="text-sm text-muted">Сәйкес жазба табылмады.</p>}
        </div>}
        {error && <ErrorState message={error} />}
        <Button disabled={busy || choices.isLoading || !!choices.error || !selected.length} onClick={() => void save()}>{busy ? 'Сақталуда…' : `Қосу (${selected.length})`}</Button>
      </div>
    </Modal>
  </>
}

function RemoveAssignment({label, warning, remove}: {label: string; warning: string; remove: () => Promise<void>}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  async function confirm() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {await remove(); setOpen(false)} catch (err) {setError((err as Error).message)}
    finally {await refreshEnrollmentQueries();lock.current = false;setBusy(false)}
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => {setError(null);setOpen(true)}}>{label}</Button>
    <Modal open={open} title={label} closeDisabled={busy} onClose={() => {if (!busy) setOpen(false)}}>
      <div className="space-y-4"><p className="text-sm text-muted">{warning}</p>{error && <ErrorState message={error} />}<Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Сақталуда…' : 'Растау'}</Button></div>
    </Modal>
  </>
}

export function CourseEnrollmentManagement({courseId, groups, students, canManage}: {courseId: number; groups: AssignedGroup[]; students: EnrollmentStudent[]; canManage: boolean}) {
  const [tab, setTab] = useState<'groups' | 'students'>('groups')
  return <section id="course-enrollments" className="space-y-4 rounded-[20px] border border-border bg-surface p-4 sm:p-5">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Users size={18} className="text-primary" />Оқушылар мен топтар</h2>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Курсқа қолжетімділік">
        <Button role="tab" aria-selected={tab === 'groups'} aria-controls="course-enrollment-groups" id="enrollment-groups-tab" variant={tab === 'groups' ? 'secondary' : 'ghost'} onClick={() => setTab('groups')}>Топтар ({groups.length})</Button>
        <Button role="tab" aria-selected={tab === 'students'} aria-controls="course-enrollment-students" id="enrollment-students-tab" variant={tab === 'students' ? 'secondary' : 'ghost'} onClick={() => setTab('students')}>Оқушылар ({students.length})</Button>
      </div>
      {canManage && (tab === 'groups' ? <AssignmentPicker kind="groups" label="Топ қосу" excluded={groups.map(group => group.id)} assign={async ids => {for (const id of ids) await api(`/admin/courses/${courseId}/groups`, {body: {group_id: id}})}} />
        : <AssignmentPicker kind="students" label="Оқушы қосу" excluded={students.filter(student => student.direct_enrollment === true).map(student => student.id)} assign={async ids => {for (const id of ids) await api(`/admin/courses/${courseId}/students`, {body: {student_id: id}})}} />)}
    </div>
    {tab === 'groups' ? <div id="course-enrollment-groups" role="tabpanel" aria-labelledby="enrollment-groups-tab" className="space-y-2">
      {groups.map(group => <div key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0 break-words text-sm"><strong>{group.code} — {group.title}</strong><p className="text-muted">{group.student_count} оқушы</p></div>
        {canManage && <RemoveAssignment label="Топты курстан шығару" warning={`«${group.code}» тобының курсқа байланысын ажыратасыз ба? Тікелей және басқа топтар арқылы берілген қолжетімділік сақталады.`} remove={async () => {await api(`/admin/courses/${courseId}/groups/${group.id}`, {method: 'DELETE'})}} />}
      </div>)}
      {!groups.length && <p className="text-sm text-muted">Курсқа топ қосылмаған.</p>}
    </div> : <div id="course-enrollment-students" role="tabpanel" aria-labelledby="enrollment-students-tab" className="space-y-2">
      {students.map(student => <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="min-w-0 break-words text-sm"><strong className="flex items-center gap-2"><UserPlus size={15} />{student.full_name}</strong><p className="text-muted">{student.email}</p><Badge tone="primary">{enrollmentSource(student)}</Badge>{!!student.groups.length && <p className="text-xs text-muted">{student.groups.map(group => group.code).join(', ')}</p>}</div>
        {canManage && student.direct_enrollment !== false && <RemoveAssignment label="Тікелей қолжетімділікті алып тастау" warning={`«${student.full_name}» оқушысының тікелей қолжетімділігін алып тастайсыз ба? Топ арқылы берілген қолжетімділік пен бұрынғы нәтижелер сақталады.`} remove={async () => {await api(`/admin/courses/${courseId}/students/${student.id}`, {method: 'DELETE'})}} />}
      </div>)}
      {!students.length && <p className="text-sm text-muted">Курсқа оқушы қосылмаған.</p>}
    </div>}
  </section>
}

export function GroupCourseAssignments({groupId, courses}: {groupId: number; courses: AssignedCourse[]}) {
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Курстар</h3>
      <AssignmentPicker kind="courses" label="Курсқа қосу" excluded={courses.map(course => course.id)} assign={async ids => {for (const id of ids) await api(`/admin/courses/${id}/groups`, {body: {group_id: groupId}})}} />
    </div>
    {courses.map(course => <div key={course.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted p-3">
      <div className="min-w-0 break-words text-sm"><strong>{course.title}</strong><p className="text-xs text-muted">{course.teacher_name}</p><Badge tone={course.is_published ? 'success' : 'neutral'}>{course.is_published ? 'Жарияланған' : 'Жоба'}</Badge></div>
      <RemoveAssignment label="Курстан ажырату" warning={`«${course.title}» курсын осы топтан ажыратасыз ба? Басқа қолжетімділік көздері мен нәтижелер сақталады.`} remove={async () => {await api(`/admin/courses/${course.id}/groups/${groupId}`, {method: 'DELETE'})}} />
    </div>)}
    {!courses.length && <p className="text-sm text-muted">Курс қосылмаған.</p>}
  </div>
}
