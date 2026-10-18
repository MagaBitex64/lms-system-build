type MembershipGroup = { id: number; code: string; title: string; students: { id: number }[] }

/** Group only by persisted membership IDs, never by names, emails or course titles. */
export function buildStudentGroups<T extends { id: number }>(students: T[], groups: MembershipGroup[]) {
  const usersById = new Map(students.map(student => [student.id, student]))
  const assignedIds = new Set(groups.flatMap(group => group.students.map(student => student.id)))
  const sections = groups.map(group => ({
    id: String(group.id), code: group.code, title: group.title,
    students: group.students.map(member => usersById.get(member.id)).filter((student): student is T => !!student),
  }))
  return [...sections, { id: 'unassigned', code: '', title: 'Топқа тіркелмеген оқушылар', students: students.filter(student => !assignedIds.has(student.id)) }]
}

export function studentGroupLabel(group: { code: string; title: string }) {
  if (!group.code) return group.title
  const prefix = [' - ', ' – ', ' — '].map(separator => group.code + separator).find(value => group.title.startsWith(value))
  return `${group.code} — ${prefix ? group.title.slice(prefix.length) : group.title}`
}
