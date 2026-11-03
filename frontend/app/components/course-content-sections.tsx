'use client'

import {useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react'
import {ArrowDown, ArrowUp, ChevronDown, ChevronRight, Folder, FolderInput, MoreVertical, Pencil, PlusCircle, Trash2, Users} from 'lucide-react'
import {api} from '@/lib/api'
import {groupCourseMaterials, type CourseSection, type SectionMaterial} from '@/lib/course-sections'
import {Button, DropdownMenu, ErrorState, Field, Input, Modal, Select} from './ui'

export type MaterialMoveAction = {label: string; icon?: ReactNode; onClick: () => void}

export default function CourseContentSections<T extends SectionMaterial>({courseId, sections, items, isOwner, reload, onAdd, onAccess, renderItem}: {
  courseId: number
  sections: CourseSection[]
  items: T[]
  isOwner: boolean
  reload: () => Promise<unknown>
  onAdd: (sectionId: number | null) => void
  onAccess?: (section: CourseSection) => void
  renderItem: (item: T, actions: MaterialMoveAction[]) => ReactNode
}) {
  const groups = useMemo(() => groupCourseMaterials(sections, items), [sections, items])
  const [expanded, setExpanded] = useState<Array<number | null>>([null])
  const [menuId, setMenuId] = useState<number | null>(null)
  const [editing, setEditing] = useState<{id: number | null; title: string} | null>(null)
  const [moving, setMoving] = useState<T | null>(null)
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)

  async function perform(job: () => Promise<unknown>, done?: () => void) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await job()
      await reload()
      done?.()
    } catch (err) {setError((err as Error).message)}
    finally {lock.current = false; setBusy(false)}
  }

  function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const title = editing.title.trim()
    if (!title || title.length > 200) {setError('Бөлім атауын енгізіңіз (1–200 таңба)'); return}
    void perform(async () => {
      const section = await api<CourseSection>(`/courses/${courseId}/sections${editing.id == null ? '' : `/${editing.id}`}`, {
        method: editing.id == null ? 'POST' : 'PATCH', body: {title},
      })
      setExpanded(previous => [...new Set([...previous, section.id])])
    }, () => setEditing(null))
  }

  function reorderSection(index: number, delta: number) {
    const ids = groups.filter(group => group.id != null).map(group => group.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    void perform(() => api(`/courses/${courseId}/sections/reorder`, {body: {section_ids: ids}}))
  }

  function reorderMaterial(group: typeof groups[number], index: number, delta: number) {
    const ids = group.items.map(item => item.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    void perform(() => api(`/courses/${courseId}/items/reorder`, {body: {section_id: group.id, item_ids: ids}}))
  }

  return <div className="space-y-3">
    {isOwner && <div className="flex justify-end"><Button variant="outline" size="sm" disabled={busy} onClick={() => {setError(null);setEditing({id: null, title: ''})}}><PlusCircle size={15} />Бөлім қосу</Button></div>}
    {error && !editing && !moving && <ErrorState message={error} />}
    {groups.filter(group => group.id != null || group.items.length || !sections.length).map((group, index) => {
      const open = expanded.includes(group.id)
      const panelId = `course-${courseId}-section-${group.id ?? 'ungrouped'}`
      return <section key={group.id ?? 'ungrouped'} className="min-w-0 rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-3 sm:flex-row sm:items-center">
          <button type="button" className="grid w-full min-w-0 grid-cols-[18px_minmax(0,1fr)_16px] items-center gap-x-2 gap-y-1 text-left text-sm font-semibold sm:w-auto sm:flex-1 sm:grid-cols-[18px_minmax(0,1fr)_auto_16px]" aria-expanded={open} aria-controls={panelId}
            onClick={() => setExpanded(previous => open ? previous.filter(id => id !== group.id) : [...previous, group.id])}>
            <Folder size={18} className="shrink-0 text-primary" />
            <span className="col-start-2 row-start-1 min-w-0 whitespace-normal break-words">{group.title}</span>
            <span className="col-start-2 row-start-2 whitespace-nowrap text-xs font-normal text-muted sm:col-start-3 sm:row-start-1">{group.items.length} материал</span>
            {open ? <ChevronDown size={16} className="col-start-3 row-start-1 sm:col-start-4" /> : <ChevronRight size={16} className="col-start-3 row-start-1 sm:col-start-4" />}
          </button>
          {isOwner && <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => {setExpanded(previous => [...new Set([...previous, group.id])]);onAdd(group.id)}} aria-label={`${group.title}: элемент қосу`}><PlusCircle size={15} /></Button>
            {group.id != null && <>
              <Button size="sm" variant="ghost" disabled={busy || index === 0} aria-label={`${group.title}: жоғары жылжыту`} onClick={() => reorderSection(index, -1)}><ArrowUp size={15} /></Button>
              <Button size="sm" variant="ghost" disabled={busy || index === sections.length - 1} aria-label={`${group.title}: төмен жылжыту`} onClick={() => reorderSection(index, 1)}><ArrowDown size={15} /></Button>
              <div className="relative">
                <Button size="sm" variant="ghost" disabled={busy} aria-label={`${group.title}: бөлім әрекеттері`} aria-haspopup="menu" aria-expanded={menuId === group.id} onClick={() => setMenuId(menuId === group.id ? null : group.id)}><MoreVertical size={15} /></Button>
                <DropdownMenu open={menuId === group.id} onClose={() => setMenuId(null)} items={[
                  ...(onAccess ? [{label:'Бөлімге қолжетімділік',icon:<Users size={15}/>,onClick:()=>onAccess(group)}] : []),
                  {label: 'Атауын өзгерту', icon: <Pencil size={15} />, onClick: () => {setError(null);setEditing({id: group.id, title: group.title})}},
                  {label: 'Бөлімді өшіру', icon: <Trash2 size={15} />, destructive: true, onClick: () => {void perform(() => api(`/courses/${courseId}/sections/${group.id}`, {method: 'DELETE'}))}},
                ]} />
              </div>
            </>}
          </div>}
        </div>
        <div id={panelId} hidden={!open}>
          {open && <div className="space-y-2 p-2">{group.items.length ? group.items.map((item, itemIndex) => <div key={item.id}>{renderItem(item, isOwner && !busy ? [
            ...(itemIndex > 0 ? [{label: 'Жоғары жылжыту', icon: <ArrowUp size={15} />, onClick: () => reorderMaterial(group, itemIndex, -1)}] : []),
            ...(itemIndex < group.items.length - 1 ? [{label: 'Төмен жылжыту', icon: <ArrowDown size={15} />, onClick: () => reorderMaterial(group, itemIndex, 1)}] : []),
            {label: 'Басқа бөлімге көшіру', icon: <FolderInput size={15} />, onClick: () => {setError(null);setMoving(item);setDestination(item.section_id == null ? '' : String(item.section_id))}},
          ] : [])}</div>) : <p className="p-2 text-sm text-muted">Бұл бөлімде материал жоқ.</p>}</div>}
        </div>
      </section>
    })}
    <Modal open={!!editing} onClose={() => {if (!busy) setEditing(null)}} closeDisabled={busy} title={editing?.id == null ? 'Бөлім қосу' : 'Бөлім атауын өзгерту'}>
      <form onSubmit={saveSection} className="space-y-4">
        <Field label="Бөлім атауы"><Input value={editing?.title ?? ''} maxLength={200} required onChange={event => setEditing(previous => previous && {...previous, title: event.target.value})} /></Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={busy}>{busy ? 'Сақталуда…' : 'Сақтау'}</Button>
      </form>
    </Modal>
    <Modal open={!!moving} onClose={() => {if (!busy) setMoving(null)}} closeDisabled={busy} title="Материалды бөлімге көшіру">
      <form className="space-y-4" onSubmit={event => {event.preventDefault(); if (moving) void perform(() => api(`/courses/items/${moving.id}/section`, {method: 'PATCH', body: {section_id: destination ? Number(destination) : null}}), () => {setExpanded(previous => [...new Set([...previous, destination ? Number(destination) : null])]);setMoving(null)})}}>
        <Field label="Бөлім"><Select value={destination} onChange={event => setDestination(event.target.value)}><option value="">Бөлімге бөлінбеген материалдар</option>{groups.filter(group => group.id != null).map(group => <option key={group.id} value={group.id!}>{group.title}</option>)}</Select></Field>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={busy}>{busy ? 'Сақталуда…' : 'Көшіру'}</Button>
      </form>
    </Modal>
  </div>
}
