'use client'

import { useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { api, fetcher } from '@/lib/api'
import useSWR from 'swr'
import { Card, Button, Spinner, ErrorState, EmptyState, Badge, PageHeader, Modal, DropdownMenu, DeletionConfirmModal, Field, Select } from '@/components/ui'
import { ClipboardList, ArrowRight, Plus, Trash2, CheckCircle, Users, Layers, Award, Edit, ChevronDown, FileText, Shuffle, ListChecks, MoreHorizontal, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import VariantEditor from '@/components/ent-variant-editor'
import { formatDate } from '@/lib/date'
import { type Rules } from '@/lib/ent'

export default function EntTrialListPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const router = useRouter()
  const isAdmin = user?.role === 'admin'
  const isStudent = user?.role === 'student'
  const { data: rulesData } = useSWR<Rules>(user ? '/ent-trial/rules' : null, fetcher)
  const COMBO_LABELS: Record<string, string> = Object.fromEntries(Object.entries(rulesData?.combinations ?? {}).map(([key, subjects]) => [key, subjects.map(s => rulesData?.subject_labels[s] ?? s).join(' – ')]))

  const { data: accessesData, error: accessesError, isLoading: accessesLoading, mutate: mutateAccesses } = useSWR<{ items: any[] }>(isStudent ? '/ent-trial/my-accesses' : null, fetcher)
  const { data: variantsData, isLoading: variantsLoading, mutate: mutateVariants } = useSWR<{ items: any[] }>(isAdmin ? '/ent-trial/variants' : null, fetcher)
  const { data: allAccessesData, mutate: mutateAdminAccesses } = useSWR<{ items: any[] }>(isAdmin ? '/ent-trial/admin/accesses' : null, fetcher)
  const { data: groupsData } = useSWR<{ items: any[] }>(isAdmin ? '/admin/groups?per_page=100' : null, fetcher)
  const [adminTab, setAdminTab] = useState<'variants' | 'grant_access' | 'edit_variant'>('variants')
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [notice, setNotice] = useState('')
  const [menuVariantId, setMenuVariantId] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; title: string; kind: 'variant' | 'access' } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [variantModeFilter, setVariantModeFilter] = useState<'all' | 'full' | 'single'>('all')
  const [variantDetailFilter, setVariantDetailFilter] = useState('')

  // Form states for creating variant
  const [newVarTitle, setNewVarTitle] = useState('')
  const [newVarDesc, setNewVarDesc] = useState('')
  const [newVarCombo, setNewVarCombo] = useState('infmat')
  const [newVarMode, setNewVarMode] = useState<'full' | 'single'>('full')
  const [newVarSubject, setNewVarSubject] = useState('kaz_history')

  // Form states for granting access
  const [accessVarId, setAccessVarId] = useState<number | ''>('')
  const [accessCombo, setAccessCombo] = useState('infmat')
  const [accessTarget, setAccessTarget] = useState<'all' | 'group' | 'student'>('all')
  const [accessGroupId, setAccessGroupId] = useState<number | ''>('')
  const [accessStudentIds, setAccessStudentIds] = useState<number[]>([])
  const [studentFilter, setStudentFilter] = useState('')
  const [extraTime, setExtraTime] = useState(false)
  const [cameraRequired, setCameraRequired] = useState(true)
  const [accessExpiresAt, setAccessExpiresAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState<number | ''>(1)
  const { data: studentOptionsData, isLoading: studentOptionsLoading } = useSWR<{ groups: Array<{ id: number; code: string; title: string; students: Array<{ id: number; full_name: string; email: string }> }> }>(
    isAdmin && accessTarget === 'student' ? '/ent-trial/admin/student-options' : null,
    fetcher,
  )

  if (user?.role === 'teacher') {
    return <ErrorState message="Мұғалімдерге бұл бетке кіруге рұқсат жоқ." />
  }

  if (variantsLoading || accessesLoading) return <Spinner className="mt-20" />

  const accesses = accessesData?.items || []
  const variants = variantsData?.items || []
  const adminAccesses = allAccessesData?.items || []
  const groups = groupsData?.items || []
  const normalizedStudentFilter = studentFilter.trim().toLocaleLowerCase('kk')
  const filteredStudentGroups = (studentOptionsData?.groups || []).map(group => ({
    ...group,
    students: group.students.filter(student => !normalizedStudentFilter || `${student.full_name} ${student.email}`.toLocaleLowerCase('kk').includes(normalizedStudentFilter)),
  })).filter(group => group.students.length > 0 || !normalizedStudentFilter)
  const fullCombinationOptions = Array.from(new Set(
    variants.filter(v => v.exam_mode !== 'single').map(v => String(v.combination)),
  )).sort((a, b) => (COMBO_LABELS[a] || a).localeCompare(COMBO_LABELS[b] || b, 'kk'))
  const singleSubjectOptions = Array.from(new Set(
    variants.filter(v => v.exam_mode === 'single' && v.single_subject).map(v => String(v.single_subject)),
  )).sort((a, b) => (rulesData?.subject_labels[a] || a).localeCompare(rulesData?.subject_labels[b] || b, 'kk'))
  const filteredVariants = variants.filter(variant => {
    const mode = variant.exam_mode === 'single' ? 'single' : 'full'
    if (variantModeFilter !== 'all' && mode !== variantModeFilter) return false
    if (!variantDetailFilter) return true
    const [detailMode, value] = variantDetailFilter.split(':', 2)
    return detailMode === 'single'
      ? mode === 'single' && variant.single_subject === value
      : mode === 'full' && variant.combination === value
  })
  const hasVariantFilters = variantModeFilter !== 'all' || variantDetailFilter !== ''

  function resetVariantFilters() {
    setVariantModeFilter('all')
    setVariantDetailFilter('')
  }

  async function handleStart(accessId: number) {
    try {
      const res = await api<{ attempt_id?: number }>(`/ent-trial/accesses/${accessId}/start`, { method: 'POST' })
      if (res.attempt_id) router.push(`/ent-trial/${res.attempt_id}`)
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleCreateVariant(e: FormEvent) {
    e.preventDefault()
    if (!newVarTitle) return alert('Нұсқа атауын енгізіңіз')
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      await api('/ent-trial/admin/variants', {
        method: 'POST',
        body: { title: newVarTitle, description: newVarDesc, combination: newVarCombo, exam_mode: newVarMode, single_subject: newVarMode === 'single' ? newVarSubject : null }
      })
      setNewVarTitle('')
      setNewVarDesc('')
      setCreateOpen(false)
      setNotice('Нұсқа құрылды')
      mutateVariants()
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteVariant(id: number) {
    setDeleting(true)
    setDeleteError('')
    try {
      await api(`/ent-trial/admin/variants/${id}`, { method: 'DELETE' })
      mutateVariants()
      setPendingDelete(null)
      setNotice('Нұсқа өшірілді')
      if (editingVariantId === id) {
        setEditingVariantId(null)
        setAdminTab('variants')
      }
    } catch (err: any) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleGrantAccess(e: FormEvent) {
    e.preventDefault()
    if (!accessVarId) return alert('Нұсқаны таңдаңыз')
    if (accessTarget === 'group' && !accessGroupId) return alert('Топты таңдаңыз')
    if (accessTarget === 'student' && accessStudentIds.length === 0) return alert('Кемінде бір оқушыны таңдаңыз')
    const attemptLimit = Number(maxAttempts)
    if (!Number.isInteger(attemptLimit) || attemptLimit < 1 || attemptLimit > 100) return alert('Тапсыру санын 1 мен 100 аралығында көрсетіңіз')
    try {
      await api('/ent-trial/admin/accesses', {
        method: 'POST',
        body: {
          variant_id: accessVarId ? Number(accessVarId) : null,
          combination: accessCombo,
          target_type: accessTarget,
          group_id: accessTarget === 'group' && accessGroupId ? Number(accessGroupId) : null,
          student_ids: accessTarget === 'student' ? accessStudentIds : [],
          extra_time_minutes: accessTarget === 'student' && extraTime ? 40 : 0,
          camera_required: cameraRequired,
          expires_at: accessExpiresAt ? new Date(accessExpiresAt).toISOString() : null,
          max_attempts: attemptLimit,
        }
      })
      alert('Рұқсат берілді!')
      setAccessExpiresAt('')
      setMaxAttempts(1)
      setAccessStudentIds([])
      setStudentFilter('')
      mutateAdminAccesses()
      if (isStudent) mutateAccesses()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleRevokeAccess(id: number) {
    setDeleting(true)
    setDeleteError('')
    try {
      await api(`/ent-trial/admin/accesses/${id}`, { method: 'DELETE' })
      mutateAdminAccesses()
      setPendingDelete(null)
      setNotice('Рұқсат қайтарылды')
    } catch (err: any) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ADMIN VIEW
  if (isAdmin) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Басқару"
          title="Сынақ ҰБТ"
          description="Нұсқаларды құру, сұрақтарды қосу, оқушыларға рұқсат беру"
          actions={<Button onClick={() => { setCreateOpen(true); setCreateError('') }}><Plus size={16} />Нұсқа құру</Button>}
        />

        {notice && <p role="status" className="text-sm font-medium text-success-foreground">{notice}</p>}
        {deleteError && <ErrorState message={deleteError} />}
        <DeletionConfirmModal
          open={pendingDelete !== null}
          onClose={() => { setPendingDelete(null); setDeleteError('') }}
          onConfirm={() => { if (pendingDelete) void (pendingDelete.kind === 'variant' ? handleDeleteVariant(pendingDelete.id) : handleRevokeAccess(pendingDelete.id)) }}
          title={pendingDelete?.kind === 'access' ? 'Рұқсатты қайтарып алу' : 'Нұсқаны өшіру'}
          description={pendingDelete?.kind === 'access' ? 'Осы нұсқаға берілген рұқсатты қайтарып алғыңыз келе ме?' : `«${pendingDelete?.title ?? ''}» нұсқасын өшіргіңіз келе ме?`}
          courseName={pendingDelete?.title ?? ''}
          warning={deleteError || undefined}
          isLoading={deleting}
        />

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {([
            ['variants', 'Нұсқалар', <Layers key="v" size={16} />],
            ['grant_access', 'Рұқсаттар', <Users key="a" size={16} />],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setAdminTab(key)}
              aria-pressed={adminTab === key}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                adminTab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

            <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Нұсқа құру" closeDisabled={creating}>
              <form onSubmit={handleCreateVariant} className="space-y-4">
                <div>
                  <label htmlFor="ent-field-1" className="block text-sm font-medium mb-1">Атауы</label>
                  <input id="ent-field-1" type="text" required placeholder="Сынақ ҰБТ — 3-нұсқа"
                    value={newVarTitle} onChange={(e) => setNewVarTitle(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground" />
                </div>
                <div>
                  <label htmlFor="ent-field-2" className="block text-sm font-medium mb-1">Сипаттамасы</label>
                  <textarea id="ent-field-2" placeholder="Толық формат, 120 сұрақ"
                    value={newVarDesc} onChange={(e) => setNewVarDesc(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground h-20" />
                </div>
                <div>
                  <label htmlFor="ent-field-3" className="block text-sm font-medium mb-1">Тест форматы</label>
                  <select id="ent-field-3" value={newVarMode} onChange={(e) => setNewVarMode(e.target.value as 'full' | 'single')}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    <option value="full">Толық ҰБТ · 5 пән</option><option value="single">Бір пән бойынша тест</option>
                  </select>
                </div>
                {newVarMode === 'single' ? <div>
                  <label htmlFor="ent-field-4" className="block text-sm font-medium mb-1">Пән</label>
                  <select id="ent-field-4" value={newVarSubject} onChange={(e) => setNewVarSubject(e.target.value)} className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    {Object.entries(rulesData?.subject_labels ?? {}).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div> : <div>
                  <label htmlFor="ent-field-5" className="block text-sm font-medium mb-1">Бейіндік комбинация</label>
                  <select id="ent-field-5" value={newVarCombo} onChange={(e) => setNewVarCombo(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    {Object.entries(COMBO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>}
                {createError && <ErrorState message={createError} />}
                <Button disabled={creating} type="submit" variant="primary" className="w-full py-2.5">
                  <Plus size={16} /> Нұсқа құру
                </Button>
              </form>
            </Modal>

        {/* TAB 1: Variants */}
        {adminTab === 'variants' && (
          <div className="space-y-4">
            <div className="space-y-4">
              <Card className="p-4 sm:p-5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] md:items-end">
                  <Field label="Тест форматы">
                    <Select
                      value={variantModeFilter}
                      onChange={event => {
                        setVariantModeFilter(event.target.value as 'all' | 'full' | 'single')
                        setVariantDetailFilter('')
                      }}
                    >
                      <option value="all">Барлығы</option>
                      <option value="full">Толық ҰБТ · 5 пән</option>
                      <option value="single">Бір пән бойынша</option>
                    </Select>
                  </Field>
                  <Field label={variantModeFilter === 'full' ? 'Пәндер комбинациясы' : variantModeFilter === 'single' ? 'Пән' : 'Пән немесе комбинация'}>
                    <Select value={variantDetailFilter} onChange={event => setVariantDetailFilter(event.target.value)}>
                      <option value="">Барлығы</option>
                      {variantModeFilter !== 'single' && fullCombinationOptions.length > 0 && (
                        <optgroup label="Толық ҰБТ комбинациялары">
                          {fullCombinationOptions.map(key => <option key={`full:${key}`} value={`full:${key}`}>{COMBO_LABELS[key] || key}</option>)}
                        </optgroup>
                      )}
                      {variantModeFilter !== 'full' && singleSubjectOptions.length > 0 && (
                        <optgroup label="Бір пән бойынша">
                          {singleSubjectOptions.map(key => <option key={`single:${key}`} value={`single:${key}`}>{rulesData?.subject_labels[key] || key}</option>)}
                        </optgroup>
                      )}
                    </Select>
                  </Field>
                  {hasVariantFilters && <Button type="button" variant="secondary" onClick={resetVariantFilters}>Сүзгілерді тазалау</Button>}
                </div>
              </Card>

              <h2 className="text-lg font-bold">Нұсқалар ({filteredVariants.length})</h2>
              {variants.length === 0 ? (
                <EmptyState icon={<Layers size={36} />} title="Нұсқалар жоқ" hint="Жаңа нұсқа құрыңыз." />
              ) : filteredVariants.length === 0 ? (
                <EmptyState
                  icon={<Layers size={36} />}
                  title="Таңдалған сүзгілер бойынша нұсқалар табылмады"
                  hint="Басқа форматты немесе пәндер комбинациясын таңдаңыз."
                  action={<Button type="button" variant="secondary" onClick={resetVariantFilters}>Сүзгілерді тазалау</Button>}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredVariants.map((v) => (
                    <Card key={v.id} className="flex flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-bold">{v.title}</h3>
                          <p className="text-xs text-muted mt-0.5">{v.description || 'Сипаттамасыз'}</p>
                        </div>
                        <div className="relative shrink-0">
                          <Button variant="ghost" size="sm" aria-label={`«${v.title}» нұсқасының әрекеттері`} aria-haspopup="menu" aria-expanded={menuVariantId === v.id} onClick={() => setMenuVariantId(menuVariantId === v.id ? null : v.id)}><MoreHorizontal size={18} /></Button>
                          <DropdownMenu open={menuVariantId === v.id} onClose={() => setMenuVariantId(null)} items={[
                            { label: 'Өңдеу', icon: <Edit size={14} />, onClick: () => { setEditingVariantId(v.id); setAdminTab('edit_variant') } },
                            { label: 'Өшіру', icon: <Trash2 size={14} />, destructive: true, onClick: () => { setDeleteError(''); setPendingDelete({ id: v.id, title: v.title, kind: 'variant' }) } },
                          ]} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="primary">{v.exam_mode === 'single' ? rulesData?.subject_labels[v.single_subject] : COMBO_LABELS[v.combination] || v.combination}</Badge>
                        <span className="text-sm text-muted">Формат: {v.question_count} сұрақ · {v.max_score} балл · {Math.round(v.duration_seconds / 60)} мин</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={v.ready ? 'success' : 'warning'}>{v.ready ? 'Дайын' : 'Толықтыру қажет'}</Badge>
                        {!v.ready && typeof v.issue_count === 'number' && <span className="text-xs text-muted">{v.issue_count} ескерту</span>}
                      </div>
                      <Button variant="primary" size="sm" className="mt-auto w-full" onClick={() => {
                        setEditingVariantId(v.id)
                        setAdminTab('edit_variant')
                      }}>
                        <Edit size={14} /> Сұрақтарды басқару
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Edit Variant Questions */}
        {adminTab === 'edit_variant' && (
          <section className="space-y-4" aria-label="Нұсқаны өңдеу">
          <Button variant="ghost" onClick={() => setAdminTab('variants')}><ArrowLeft size={16} />Нұсқаларға оралу</Button>
          <h2 className="text-lg font-semibold">Нұсқаны өңдеу</h2>
          <VariantEditor
            variantId={editingVariantId}
            variants={variants}
            onSelectVariant={setEditingVariantId}
            onSaved={() => { void mutateVariants() }}
          />
          </section>
        )}

        {/* TAB 2: Grant Access */}
        {adminTab === 'grant_access' && (
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <Card className="p-6 space-y-4 h-fit">
              <h2 className="text-lg font-bold border-b border-border pb-3">Рұқсат беру</h2>
              <form onSubmit={handleGrantAccess} className="space-y-4">
                <div>
                  <label htmlFor="ent-field-6" className="block text-sm font-medium mb-1">Нұсқаны таңдаңыз</label>
                  <select id="ent-field-6" required value={accessVarId} onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    setAccessVarId(id)
                    const found = variants.find(v => v.id === id)
                    if (found) setAccessCombo(found.combination)
                  }} className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    <option value="">Таңдаңыз...</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={!v.ready}>
                        {v.title} — {v.exam_mode === 'single' ? rulesData?.subject_labels[v.single_subject] : COMBO_LABELS[v.combination] || v.combination} ({v.question_count} сұрақ · {v.ready ? 'Дайын' : 'Дайын емес'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ent-field-7" className="block text-sm font-medium mb-1">Кімге</label>
                  <select id="ent-field-7" value={accessTarget} onChange={(e) => {
                    const target = e.target.value as 'all' | 'group' | 'student'
                    setAccessTarget(target)
                    if (target !== 'group') setAccessGroupId('')
                    if (target !== 'student') { setAccessStudentIds([]); setStudentFilter('') }
                  }}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    <option value="all">Барлық студенттерге</option>
                    <option value="group">Топқа</option>
                    <option value="student">Таңдалған студенттерге</option>
                  </select>
                </div>

                {accessTarget === 'group' && (
                  <div>
                    <label htmlFor="ent-field-8" className="block text-sm font-medium mb-1">Топ</label>
                  <select id="ent-field-8" value={accessGroupId} onChange={(e) => setAccessGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                      <option value="">Топты таңдаңыз</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.title} ({g.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {accessTarget === 'student' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="ent-student-filter" className="block text-sm font-medium mb-1">Топтардан студенттерді таңдаңыз</label>
                      <input id="ent-student-filter" type="search" placeholder="Аты немесе email бойынша іздеу"
                        value={studentFilter} onChange={e => setStudentFilter(e.target.value)}
                        className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground" />
                      <p className="mt-1 text-xs text-muted">Бірнеше топтан кез келген студенттерді қатар таңдауға болады.</p>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">Таңдалды: {accessStudentIds.length}</span>
                      {accessStudentIds.length > 0 && <button type="button" className="font-medium text-muted hover:text-foreground" onClick={() => setAccessStudentIds([])}>Барлығын тазалау</button>}
                    </div>
                    <div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-border bg-surface-muted p-2">
                      {studentOptionsLoading ? <Spinner /> : filteredStudentGroups.length === 0 ? (
                        <p className="p-3 text-sm text-muted">Топтарда сәйкес студенттер табылмады.</p>
                      ) : filteredStudentGroups.map(group => {
                        const memberIds = group.students.map(student => student.id)
                        const allSelected = memberIds.length > 0 && memberIds.every(id => accessStudentIds.includes(id))
                        return <div key={group.id} className="rounded-lg border border-border bg-surface p-3">
                          <label className="flex cursor-pointer items-center gap-2 border-b border-border pb-2 text-sm font-bold">
                            <input type="checkbox" checked={allSelected} disabled={memberIds.length === 0} onChange={() => setAccessStudentIds(current => allSelected
                              ? current.filter(id => !memberIds.includes(id))
                              : Array.from(new Set([...current, ...memberIds])))} />
                            <span className="min-w-0 flex-1 truncate">{group.title} ({group.code})</span>
                            <span className="text-xs font-medium text-muted">{group.students.length}</span>
                          </label>
                          <div className="mt-2 space-y-1">
                            {group.students.length === 0 ? <p className="py-1 text-xs text-muted">Бұл топта студенттер жоқ.</p> : group.students.map(student => (
                              <label key={`${group.id}-${student.id}`} className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-surface-muted">
                                <input type="checkbox" className="mt-1" checked={accessStudentIds.includes(student.id)} onChange={() => setAccessStudentIds(current => current.includes(student.id) ? current.filter(id => id !== student.id) : [...current, student.id])} />
                                <span className="min-w-0"><span className="block truncate font-medium">{student.full_name}</span><span className="block truncate text-xs text-muted">{student.email}</span></span>
                              </label>
                            ))}
                          </div>
                        </div>
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="ent-field-10" className="block text-sm font-medium mb-1">Мерзімі · күні және уақыты</label>
                  <input id="ent-field-10"
                    type="datetime-local"
                    value={accessExpiresAt}
                    onChange={(e) => setAccessExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted">Бос қалдырсаңыз, рұқсат қайтарып алынғанша ашық болады.</p>
                </div>

                <div>
                  <label htmlFor="ent-max-attempts" className="block text-sm font-medium mb-1">Тапсыру саны</label>
                  <input id="ent-max-attempts" type="number" min={1} max={100} step={1} value={maxAttempts}
                    onChange={e => setMaxAttempts(e.target.value === '' ? '' : Math.min(100, Number(e.target.value)))}
                    onBlur={() => { if (!Number.isInteger(Number(maxAttempts)) || Number(maxAttempts) < 1) setMaxAttempts(1) }}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground" />
                  <p className="mt-1 text-xs text-muted">Әр оқушы тестті қанша рет тапсыра алатынын көрсетіңіз. Дедлайн аяқталса, қалған әрекеттер қолжетімсіз болады.</p>
                </div>

                {accessTarget === 'student' && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={extraTime} onChange={e => setExtraTime(e.target.checked)} className="mt-1" /><span>Қосымша 40 минут (ерекше білім беру қажеттілігіне байланысты құқығы расталған оқушы үшін)</span></label>}
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={cameraRequired} onChange={e => setCameraRequired(e.target.checked)} className="mt-1" /><span>Камераның болуы міндетті</span></label>
                <Button type="submit" variant="primary" className="w-full py-2.5" disabled={!accessVarId || !variants.find(v => v.id === accessVarId)?.ready}>
                  <CheckCircle size={16} /> Рұқсат беру
                </Button>
              </form>
            </Card>

            <div className="space-y-4">
              <h2 className="text-lg font-bold">Берілген рұқсаттар ({adminAccesses.length})</h2>
              {adminAccesses.length === 0 ? (
                <EmptyState icon={<Users size={36} />} title="Рұқсаттар жоқ" />
              ) : (
                adminAccesses.map((a) => (
                  <Card key={a.id} className="overflow-hidden p-0 transition-colors hover:border-primary/30">
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        className="min-w-0 flex-1 p-4 text-left transition-colors hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                        onClick={() => router.push(`/ent-trial/accesses/${a.id}/results`)}
                        aria-label={`${a.variant_title || 'ҰБТ нұсқасы'} нәтижелерін ашу`}
                      >
                        <p className="font-bold">{a.variant_title || 'ҰБТ нұсқасы'}</p>
                        <p className="text-xs text-muted">
                          {a.target_type === 'all' ? 'Барлық студенттерге' : a.target_type === 'group' ? `Топ: ${a.group_title || a.group_code}` : `Студент: ${a.student_name}`}
                        </p>
                        <p className="text-xs text-muted">{a.exam_mode === 'single' ? `Пән: ${rulesData?.subject_labels[a.single_subject] || a.single_subject}` : `Комбинация: ${COMBO_LABELS[a.combination] || a.combination}`}</p>
                        <p className="text-xs text-muted">
                          {a.expires_at ? `Мерзімі: ${formatDate(a.expires_at)}` : 'Мерзімі жоқ'}
                          {' · '}{a.max_attempts ?? 1} әрекетке дейін
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Нәтижелерді ашу <ArrowRight size={14} /></span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2 border-l border-border px-3">
                        <Button variant="secondary" size="sm" onClick={() => router.push(`/ent-trial/accesses/${a.id}/results`)}>Нәтижелер</Button>
                        <Button variant="danger-ghost" size="sm" aria-label="Рұқсатты қайтарып алу" onClick={() => { setDeleteError(''); setPendingDelete({ id: a.id, title: a.variant_title || 'Сынақ ҰБТ', kind: 'access' }) }}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // STUDENT VIEW
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader eyebrow="ҰБТ" title="Сынақ ҰБТ" description="Тағайындалған сынақ нұсқалары" />

      {accesses.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="Сынақ тестер жоқ" hint="Әзірге тағайындалған тестер жоқ." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {accesses.map((a) => {
            const isCompleted = a.attempt_status === 'submitted'
            const expired = Boolean(a.revoked_at) || (a.expires_at && new Date(a.expires_at) <= new Date())
            const cannotStart = !a.attempt_id && (expired || !a.variant_ready)
            const canRetake = isCompleted && (a.completed_attempt_count ?? 0) < (a.max_attempts ?? 1) && !expired && a.variant_ready
            return (
              <Card key={a.id} className="p-6 flex flex-col justify-between hover:shadow-lg transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <Badge tone={isCompleted ? 'success' : 'primary'}>
                      {canRetake ? 'Қайта тапсыруға болады' : isCompleted ? 'Аяқталған' : a.attempt_id ? 'Басталған' : expired ? 'Мерзімі аяқталған' : !a.variant_ready ? 'Әкімші толықтыруда' : 'Жаңа'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{a.variant_title || 'Сынақ ҰБТ'}</h3>
                  {a.variant_description && <p className="text-sm text-muted mb-3">{a.variant_description}</p>}
                  <div className="space-y-1 text-sm text-muted">
                    <p><span className="font-semibold text-foreground">{a.exam_mode === 'single' ? 'Пән:' : 'Бейін:'}</span> {a.exam_mode === 'single' ? rulesData?.subject_labels[a.single_subject] || a.single_subject : COMBO_LABELS[a.combination] || a.combination}</p>
                    <p><span className="font-semibold text-foreground">Формат:</span> {a.question_count ?? '—'} сұрақ, {a.max_score ?? '—'} балл, {a.duration_seconds ? Math.round(a.duration_seconds / 60) + (a.extra_time_minutes ?? 0) : '—'} мин</p>
                    <p><span className="font-semibold text-foreground">Бақылау:</span> камера және толық экран міндетті</p>
                    {a.expires_at && <p><span className="font-semibold text-foreground">Мерзімі:</span> {formatDate(a.expires_at)}</p>}
                    <p><span className="font-semibold text-foreground">Әрекеттер:</span> {a.completed_attempt_count ?? 0} / {a.max_attempts ?? 1} аяқталды</p>
                  </div>
                  {isCompleted && a.attempt_score !== null && (
                    <div className="mt-4 p-3 bg-success/10 rounded-xl border border-success/20 flex items-center justify-between">
                      <span className="text-sm font-semibold text-success">Нәтиже:</span>
                      <span className="text-lg font-bold text-success">{a.attempt_score} / {a.max_score ?? 140} балл</span>
                    </div>
                  )}
                  {(a.max_attempts ?? 1) > 1 && a.best_score !== null && a.completed_attempt_count > 0 && <p className="mt-2 text-right text-xs font-medium text-muted">Ең жақсы нәтиже: {a.best_score} / {a.max_score ?? 140}</p>}
                </div>
                <div className="mt-6 pt-4 border-t border-border flex justify-end">
                  {isCompleted ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button onClick={() => router.push(`/ent-trial/${a.attempt_id}/result`)} variant="secondary">
                        Нәтижені көру
                      </Button>
                      {canRetake && <Button onClick={() => handleStart(a.id)} variant="primary">Қайта тапсыру <ArrowRight size={16} /></Button>}
                    </div>
                  ) : (
                    <Button disabled={cannotStart} onClick={() => handleStart(a.id)} variant="primary">
                      {a.attempt_id ? 'Жалғастыру' : 'Бастау'} <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ===============================================
// VARIANT EDITOR COMPONENT
// ===============================================
