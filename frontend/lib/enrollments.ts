import {mutate} from 'swr'
import {api} from './api'
import {fetchAllGroups} from './groups'

export type EnrollmentStudent = {id: number; full_name: string; email: string; direct_enrollment?: boolean | null; legacy_access?: boolean; groups: Array<{id: number; code: string}>}
export type AssignedGroup = {id: number; code: string; title: string; student_count: number}
export type AssignedCourse = {id: number; title: string; teacher_name: string; is_published: boolean}
export type Choice = {id: number; label: string; detail: string}
export type ChoiceKind = 'groups' | 'students' | 'courses'

export function enrollmentSource(student: EnrollmentStudent) {
  if (student.legacy_access || student.direct_enrollment == null) {
    return student.groups.length ? 'Бұрынғы қолжетімділік + топ арқылы' : 'Бұрынғы қолжетімділік'
  }
  return student.direct_enrollment ? (student.groups.length ? 'Тікелей + топ арқылы' : 'Тікелей') : 'Топ арқылы'
}

export async function loadEnrollmentChoices(kind: ChoiceKind): Promise<Choice[]> {
  if (kind === 'groups') {
    const data = await fetchAllGroups<AssignedGroup>()
    return data.items.map(group => ({id: group.id, label: `${group.code} — ${group.title}`, detail: `${group.student_count} оқушы`}))
  }
  if (kind === 'courses') {
    const data = await api<AssignedCourse[]>('/courses/mine')
    return data.map(course => ({id: course.id, label: course.title, detail: course.is_published ? 'Жарияланған' : 'Жоба'}))
  }
  const items: Choice[] = []
  for (let page = 1; ; page++) {
    const result = await api<{items: Array<{id: number; full_name: string; email: string}>; total: number}>(`/admin/users?role=student&per_page=100&page=${page}`)
    items.push(...result.items.map(student => ({id: student.id, label: student.full_name, detail: student.email})))
    if (!result.items.length || items.length >= result.total) return items
  }
}

export async function refreshEnrollmentQueries() {
  await mutate(key => typeof key === 'string' && (
    key.startsWith('/courses') || key.startsWith('/admin/groups') || key.startsWith('/admin/students') ||
    key === '/admin/stats' || key.startsWith('/admin/teachers') || key === 'admin-student-directory' ||
    key === 'admin-groups-all-pages' || key.startsWith('enrollment-choices:')
  ), undefined, {revalidate: true, throwOnError: false})
}
