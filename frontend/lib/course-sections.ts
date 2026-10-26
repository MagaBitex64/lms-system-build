export type CourseSection = {id: number; title: string; position: number}
export type SectionMaterial = {id: number; title: string; position: number; section_id?: number | null}

export function groupCourseMaterials<T extends SectionMaterial>(sections: CourseSection[], items: T[]) {
  const groups = [...sections].sort((a, b) => a.position - b.position || a.id - b.id)
    .map(section => ({...section, items: [] as T[]}))
  const ungrouped = {id: null, title: 'Бөлімге бөлінбеген материалдар', position: groups.length, items: [] as T[]}
  const byId = new Map(groups.map(group => [group.id, group]))
  for (const item of [...items].sort((a, b) => a.position - b.position || a.id - b.id)) {
    (item.section_id == null ? ungrouped : byId.get(item.section_id) ?? ungrouped).items.push(item)
  }
  return [...groups, ungrouped]
}
