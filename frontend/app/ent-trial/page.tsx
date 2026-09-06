'use client'

import { useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { api, fetcher } from '@/lib/api'
import useSWR from 'swr'
import { Card, Button, Spinner, ErrorState, EmptyState, Badge, PageHeader } from '@/components/ui'
import { ClipboardList, ArrowRight, Plus, Trash2, CheckCircle, Users, Layers, Award, Edit, ChevronDown, FileText, Shuffle, ListChecks } from 'lucide-react'
import { useRouter } from 'next/navigation'

const COMBO_LABELS: Record<string, string> = {
  infmat: 'Информатика - Математика',
  phymat: 'Физика - Математика',
  biochem: 'Биология - Химия',
  chemphi: 'Химия - Физика',
  matgeo: 'Математика - География',
}

const SUBJECT_LABELS: Record<string, string> = {
  kaz_history: 'Қазақстан тарихы',
  reading: 'Оқу сауаттылығы',
  math_literacy: 'Мат. сауаттылық',
  informatics: 'Информатика',
  mathematics: 'Математика',
  physics: 'Физика',
  chemistry: 'Химия',
  biology: 'Биология',
  geography: 'География',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: '1 дұрыс жауап (4-тен)',
  context: 'Контексттік (мәтінге негізделген)',
  matching: 'Сәйкестендіру',
  multi_choice: 'Бірнеше дұрыс жауап (6-дан)',
}

const QUESTION_TYPE_ICONS: Record<string, any> = {
  single_choice: <CheckCircle size={14} />,
  context: <FileText size={14} />,
  matching: <Shuffle size={14} />,
  multi_choice: <ListChecks size={14} />,
}

export default function EntTrialListPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const router = useRouter()
  const isAdmin = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const { data: accessesData, error: accessesError, isLoading: accessesLoading, mutate: mutateAccesses } = useSWR<{ items: any[] }>(isStudent ? '/ent-trial/my-accesses' : null, fetcher)
  const { data: variantsData, isLoading: variantsLoading, mutate: mutateVariants } = useSWR<{ items: any[] }>('/ent-trial/variants', fetcher)
  const { data: allAccessesData, mutate: mutateAdminAccesses } = useSWR<{ items: any[] }>(isAdmin ? '/ent-trial/admin/accesses' : null, fetcher)
  const { data: groupsData } = useSWR<{ items: any[] }>(isAdmin ? '/admin/groups?per_page=100' : null, fetcher)

  const [adminTab, setAdminTab] = useState<'variants' | 'grant_access' | 'edit_variant'>('variants')
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null)

  // Form states for creating variant
  const [newVarTitle, setNewVarTitle] = useState('')
  const [newVarDesc, setNewVarDesc] = useState('')
  const [newVarCombo, setNewVarCombo] = useState('infmat')

  // Form states for granting access
  const [accessVarId, setAccessVarId] = useState<number | ''>('')
  const [accessCombo, setAccessCombo] = useState('infmat')
  const [accessTarget, setAccessTarget] = useState<'all' | 'group' | 'student'>('all')
  const [accessGroupId, setAccessGroupId] = useState<number | ''>('')
  const [accessStudentId, setAccessStudentId] = useState<number | ''>('')

  if (user?.role === 'teacher') {
    return <ErrorState message="Мұғалімдерге бұл бетке кіруге рұқсат жоқ." />
  }

  if (variantsLoading || accessesLoading) return <Spinner className="mt-20" />

  const accesses = accessesData?.items || []
  const variants = variantsData?.items || []
  const adminAccesses = allAccessesData?.items || []
  const groups = groupsData?.items || []

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
    if (!newVarTitle) return alert('Вариант атауын енгізіңіз')
    try {
      await api('/ent-trial/admin/variants', {
        method: 'POST',
        body: { title: newVarTitle, description: newVarDesc, combination: newVarCombo }
      })
      setNewVarTitle('')
      setNewVarDesc('')
      mutateVariants()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDeleteVariant(id: number) {
    if (!confirm('Вариантты жоюға сенімдісіз бе?')) return
    try {
      await api(`/ent-trial/admin/variants/${id}`, { method: 'DELETE' })
      mutateVariants()
      if (editingVariantId === id) {
        setEditingVariantId(null)
        setAdminTab('variants')
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleGrantAccess(e: FormEvent) {
    e.preventDefault()
    if (!accessVarId) return alert('Вариантты таңдаңыз')
    try {
      await api('/ent-trial/admin/accesses', {
        method: 'POST',
        body: {
          variant_id: accessVarId ? Number(accessVarId) : null,
          combination: accessCombo,
          target_type: accessTarget,
          group_id: accessTarget === 'group' && accessGroupId ? Number(accessGroupId) : null,
          student_id: accessTarget === 'student' && accessStudentId ? Number(accessStudentId) : null,
        }
      })
      alert('Рұқсат берілді!')
      mutateAdminAccesses()
      if (isStudent) mutateAccesses()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleRevokeAccess(id: number) {
    if (!confirm('Рұқсатты жоюға сенімдісіз бе?')) return
    try {
      await api(`/ent-trial/admin/accesses/${id}`, { method: 'DELETE' })
      mutateAdminAccesses()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // ADMIN VIEW
  if (isAdmin) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          eyebrow="Басқару"
          title="Пробный ЕНТ"
          description="Варианттарды жасау, сұрақтарды қосу, студенттерге рұқсат беру"
        />

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-1">
          {([
            ['variants', 'Варианттар', <Layers key="v" size={16} />],
            ['grant_access', 'Рұқсаттар', <Users key="a" size={16} />],
            ['edit_variant', 'Редактировать вариант', <Edit key="e" size={16} />],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setAdminTab(key as any)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                adminTab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: Variants */}
        {adminTab === 'variants' && (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <Card className="p-6 space-y-4 h-fit">
              <h2 className="text-lg font-bold border-b border-border pb-3">Жаңа Вариант Құру</h2>
              <form onSubmit={handleCreateVariant} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Атауы</label>
                  <input type="text" required placeholder="Пробный ЕНТ — Вариант 3"
                    value={newVarTitle} onChange={(e) => setNewVarTitle(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Сипаттамасы</label>
                  <textarea placeholder="Толық формат, 120 сұрақ"
                    value={newVarDesc} onChange={(e) => setNewVarDesc(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground h-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Бейіндік комбинация</label>
                  <select value={newVarCombo} onChange={(e) => setNewVarCombo(e.target.value)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    {Object.entries(COMBO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="primary" className="w-full py-2.5">
                  <Plus size={16} /> Вариант құру
                </Button>
              </form>
            </Card>

            <div className="space-y-4">
              <h2 className="text-lg font-bold">Варианттар ({variants.length})</h2>
              {variants.length === 0 ? (
                <EmptyState icon={<Layers size={36} />} title="Варианттар жоқ" hint="Жаңа вариант жасаңыз." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {variants.map((v) => (
                    <Card key={v.id} className="p-5 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-base">{v.title}</h3>
                          <p className="text-xs text-muted mt-0.5">{v.description || 'Сипаттамасыз'}</p>
                        </div>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteVariant(v.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="primary">{COMBO_LABELS[v.combination] || v.combination}</Badge>
                        <Badge>{v.question_count} сұрақ</Badge>
                      </div>
                      <Button variant="secondary" size="sm" className="w-full" onClick={() => {
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
          <VariantEditor
            variantId={editingVariantId}
            variants={variants}
            onSelectVariant={setEditingVariantId}
          />
        )}

        {/* TAB 2: Grant Access */}
        {adminTab === 'grant_access' && (
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <Card className="p-6 space-y-4 h-fit">
              <h2 className="text-lg font-bold border-b border-border pb-3">Рұқсат Беру</h2>
              <form onSubmit={handleGrantAccess} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Вариантты таңдаңыз</label>
                  <select required value={accessVarId} onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : ''
                    setAccessVarId(id)
                    const found = variants.find(v => v.id === id)
                    if (found) setAccessCombo(found.combination)
                  }} className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    <option value="">Таңдаңыз...</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} — {COMBO_LABELS[v.combination] || v.combination} ({v.question_count} сұрақ)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Кімге</label>
                  <select value={accessTarget} onChange={(e) => setAccessTarget(e.target.value as any)}
                    className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                    <option value="all">Барлық студенттерге</option>
                    <option value="group">Топқа</option>
                    <option value="student">Жеке студентке (ID)</option>
                  </select>
                </div>

                {accessTarget === 'group' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Топ</label>
                    <select value={accessGroupId} onChange={(e) => setAccessGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground">
                      <option value="">Топты таңдаңыз</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.title} ({g.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {accessTarget === 'student' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Студент ID</label>
                    <input type="number" required placeholder="Студент ID"
                      value={accessStudentId} onChange={(e) => setAccessStudentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-lg border border-border p-2.5 bg-surface text-foreground" />
                  </div>
                )}

                <Button type="submit" variant="primary" className="w-full py-2.5" disabled={!accessVarId}>
                  <CheckCircle size={16} /> Рұқсат Беру
                </Button>
              </form>
            </Card>

            <div className="space-y-4">
              <h2 className="text-lg font-bold">Берілген Рұқсаттар ({adminAccesses.length})</h2>
              {adminAccesses.length === 0 ? (
                <EmptyState icon={<Users size={36} />} title="Рұқсаттар жоқ" />
              ) : (
                adminAccesses.map((a) => (
                  <Card key={a.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{a.variant_title || 'ЕНТ Варианты'}</p>
                      <p className="text-xs text-muted">
                        {a.target_type === 'all' ? 'Барлық студенттерге' : a.target_type === 'group' ? `Топ: ${a.group_title || a.group_code}` : `Студент: ${a.student_name}`}
                      </p>
                      <p className="text-xs text-muted">Комбинация: {COMBO_LABELS[a.combination] || a.combination}</p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleRevokeAccess(a.id)}>
                      <Trash2 size={14} />
                    </Button>
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
      <PageHeader eyebrow="ЕНТ" title="Пробный ЕНТ" description="Тағайындалған пробтық варианттар" />

      {accesses.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="Сынақ тестер жоқ" hint="Әзірге тағайындалған тестер жоқ." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {accesses.map((a) => {
            const isCompleted = a.attempt_status === 'submitted'
            return (
              <Card key={a.id} className="p-6 flex flex-col justify-between hover:shadow-lg transition-all">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <Badge tone={isCompleted ? 'success' : 'primary'}>
                      {isCompleted ? 'Аяқталған' : 'Жаңа'}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{a.variant_title || 'Пробтық ЕНТ'}</h3>
                  {a.variant_description && <p className="text-sm text-muted mb-3">{a.variant_description}</p>}
                  <div className="space-y-1 text-sm text-muted">
                    <p><span className="font-semibold text-foreground">Бейін:</span> {COMBO_LABELS[a.combination] || a.combination}</p>
                    <p><span className="font-semibold text-foreground">Формат:</span> 120 сұрақ, 140 балл, 210 мин</p>
                  </div>
                  {isCompleted && a.attempt_score !== null && (
                    <div className="mt-4 p-3 bg-success/10 rounded-xl border border-success/20 flex items-center justify-between">
                      <span className="text-sm font-semibold text-success">Нәтиже:</span>
                      <span className="text-lg font-bold text-success">{a.attempt_score} / 140 балл</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 pt-4 border-t border-border flex justify-end">
                  {isCompleted ? (
                    <Button onClick={() => router.push(`/ent-trial/${a.attempt_id}/result`)} variant="secondary">
                      Нәтижені көру <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button onClick={() => handleStart(a.id)} variant="primary">
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

function VariantEditor({ variantId, variants, onSelectVariant }: {
  variantId: number | null
  variants: any[]
  onSelectVariant: (id: number | null) => void
}) {
  const [subject, setSubject] = useState('kaz_history')
  const [qType, setQType] = useState<string>('single_choice')
  const [prompt, setPrompt] = useState('')
  const [contextText, setContextText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [options, setOptions] = useState([
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])
  const [matchingPairs, setMatchingPairs] = useState([
    { left_text: '', right_text: '' },
    { left_text: '', right_text: '' },
    { left_text: '', right_text: '' },
    { left_text: '', right_text: '' },
    { left_text: '', right_text: '' },
  ])
  const [error, setError] = useState<string | null>(null)

  const questionsReq = useSWR<{ items: any[], grouped: any }>(
    variantId ? `/ent-trial/admin/variants/${variantId}/questions` : null, fetcher
  )

  const questions = questionsReq.data?.items || []
  const grouped = questionsReq.data?.grouped || {}

  // Get subjects for current variant
  const selectedVariant = variants.find(v => v.id === variantId)

  async function handleAddQuestion(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const body: any = {
        variant_id: variantId,
        subject,
        prompt,
        question_type: qType,
        context_text: qType === 'context' ? contextText : '',
        explanation,
      }

      if (qType === 'single_choice' || qType === 'context') {
        body.options = options.slice(0, 4)
      } else if (qType === 'multi_choice') {
        // For multi_choice, use 6 options
        body.options = options.slice(0, 6)
      } else if (qType === 'matching') {
        body.matching_pairs = matchingPairs.filter(p => p.left_text && p.right_text)
      }

      await api('/ent-trial/admin/questions', { method: 'POST', body })
      // Reset form
      setPrompt('')
      setContextText('')
      setExplanation('')
      setOptions([
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ])
      setMatchingPairs([
        { left_text: '', right_text: '' },
        { left_text: '', right_text: '' },
        { left_text: '', right_text: '' },
        { left_text: '', right_text: '' },
        { left_text: '', right_text: '' },
      ])
      questionsReq.mutate()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleDeleteQuestion(id: number) {
    if (!confirm('Сұрақты жоюға сенімдісіз бе?')) return
    await api(`/ent-trial/admin/questions/${id}`, { method: 'DELETE' })
    questionsReq.mutate()
  }

  // Handle option changes for multi_choice (6 options)
  function initOptionsForType(type: string) {
    if (type === 'multi_choice') {
      setOptions([
        { text: '', is_correct: true },
        { text: '', is_correct: true },
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ])
    } else {
      setOptions([
        { text: '', is_correct: true },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
        { text: '', is_correct: false },
      ])
    }
  }

  if (!variantId) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Вариантты таңдаңыз</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {variants.map(v => (
            <button key={v.id} type="button" className="text-left" onClick={() => onSelectVariant(v.id)}>
              <Card interactive className="h-full p-4">
                <h3 className="font-bold">{v.title}</h3>
                <p className="text-xs text-muted">{v.question_count} сұрақ • {COMBO_LABELS[v.combination]}</p>
              </Card>
            </button>
          ))}
        </div>
        {variants.length === 0 && <EmptyState icon={<Layers size={36} />} title="Алдымен вариант жасаңыз" />}
      </div>
    )
  }

  // Subject counts
  const subjectCounts: Record<string, number> = {}
  for (const q of questions) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1
  }

  return (
    <div className="space-y-6">
      {/* Variant header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold">{selectedVariant?.title}</h2>
          <p className="text-sm text-muted">{COMBO_LABELS[selectedVariant?.combination]} • {questions.length} сұрақ</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onSelectVariant(null)}>
          Басқа вариант
        </Button>
      </div>

      {/* Subject stats */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(subjectCounts).map(([s, c]) => (
          <Badge key={s} tone="neutral">{SUBJECT_LABELS[s] || s}: {c}</Badge>
        ))}
        <Badge tone="primary">Барлығы: {questions.length}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* Add Question Form */}
        <Card className="p-5 space-y-4 h-fit">
          <h3 className="text-base font-bold border-b border-border pb-2">Сұрақ қосу</h3>
          <form onSubmit={handleAddQuestion} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">Пән</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-border p-2 bg-surface text-foreground text-sm">
                {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Сұрақ типі</label>
              <select value={qType} onChange={(e) => { setQType(e.target.value); initOptionsForType(e.target.value) }}
                className="w-full rounded-lg border border-border p-2 bg-surface text-foreground text-sm">
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {qType === 'context' && (
              <div>
                <label className="block text-xs font-medium mb-1">Контекст мәтіні</label>
                <textarea value={contextText} onChange={(e) => setContextText(e.target.value)}
                  placeholder="Мәтін, кесте немесе деректер..."
                  className="w-full rounded-lg border border-border p-2 bg-surface text-foreground text-sm h-24" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Сұрақ</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} required
                className="w-full rounded-lg border border-border p-2 bg-surface text-foreground text-sm h-16" />
            </div>

            {/* Options for single_choice, context, multi_choice */}
            {(qType === 'single_choice' || qType === 'context' || qType === 'multi_choice') && (
              <div className="space-y-2">
                <label className="block text-xs font-medium">
                  Жауап нұсқалары {qType === 'multi_choice' ? '(1-3 дұрыс, checkbox)' : '(1 дұрыс, radio)'}
                </label>
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {qType === 'multi_choice' ? (
                      <input type="checkbox" checked={opt.is_correct}
                        onChange={(e) => {
                          const newOpts = [...options]
                          newOpts[i] = { ...newOpts[i], is_correct: e.target.checked }
                          setOptions(newOpts)
                        }}
                        className="h-4 w-4 shrink-0" />
                    ) : (
                      <input type="radio" name="correct_opt" checked={opt.is_correct}
                        onChange={() => {
                          setOptions(options.map((o, j) => ({ ...o, is_correct: j === i })))
                        }}
                        className="h-4 w-4 shrink-0" />
                    )}
                    <input type="text" value={opt.text} required
                      onChange={(e) => {
                        const newOpts = [...options]
                        newOpts[i] = { ...newOpts[i], text: e.target.value }
                        setOptions(newOpts)
                      }}
                      placeholder={`Нұсқа ${i + 1}`}
                      className="flex-1 rounded-lg border border-border p-2 bg-surface text-foreground text-sm" />
                  </div>
                ))}
              </div>
            )}

            {/* Matching pairs */}
            {qType === 'matching' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium">Сәйкестік жұптары (Сол ↔ Оң)</label>
                {matchingPairs.map((pair, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={pair.left_text}
                      onChange={(e) => {
                        const newPairs = [...matchingPairs]
                        newPairs[i] = { ...newPairs[i], left_text: e.target.value }
                        setMatchingPairs(newPairs)
                      }}
                      placeholder={`Сол ${i + 1}`}
                      className="flex-1 rounded-lg border border-border p-2 bg-surface text-foreground text-sm" />
                    <span className="text-muted">↔</span>
                    <input type="text" value={pair.right_text}
                      onChange={(e) => {
                        const newPairs = [...matchingPairs]
                        newPairs[i] = { ...newPairs[i], right_text: e.target.value }
                        setMatchingPairs(newPairs)
                      }}
                      placeholder={`Оң ${i + 1}`}
                      className="flex-1 rounded-lg border border-border p-2 bg-surface text-foreground text-sm" />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Түсіндірме (міндетті емес)</label>
              <input type="text" value={explanation} onChange={(e) => setExplanation(e.target.value)}
                className="w-full rounded-lg border border-border p-2 bg-surface text-foreground text-sm" />
            </div>

            {error && <ErrorState message={error} />}
            <Button type="submit" variant="primary" className="w-full">
              <Plus size={16} /> Сұрақ қосу
            </Button>
          </form>
        </Card>

        {/* Questions List */}
        <div className="space-y-4">
          <h3 className="text-base font-bold">Сұрақтар тізімі</h3>
          {questionsReq.isLoading ? <Spinner /> : (
            Object.entries(grouped).length === 0 ? (
              <EmptyState icon={<ClipboardList size={36} />} title="Сұрақтар жоқ" hint="Сол жақтағы форма арқылы сұрақ қосыңыз" />
            ) : (
              Object.entries(grouped).map(([subj, qs]: [string, any]) => (
                <div key={subj} className="space-y-2">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-1">
                    {SUBJECT_LABELS[subj] || subj}
                    <Badge>{(qs as any[]).length}</Badge>
                  </h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {(qs as any[]).map((q: any, i: number) => (
                      <div key={q.id} className="rounded-lg border border-border p-3 text-sm relative bg-surface">
                        <button onClick={() => handleDeleteQuestion(q.id)}
                          className="absolute right-2 top-2 text-muted hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-muted">#{i + 1}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-muted">
                            {QUESTION_TYPE_ICONS[q.question_type]}
                            {QUESTION_TYPE_LABELS[q.question_type]}
                          </span>
                          {q.max_points > 1 && <Badge tone="primary">{q.max_points} балл</Badge>}
                        </div>
                        <p className="font-medium pr-6 text-foreground">{q.prompt}</p>
                        {q.options?.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {q.options.map((o: any) => (
                              <li key={o.id} className={o.is_correct ? 'font-semibold text-success' : 'text-muted'}>
                                {q.question_type === 'multi_choice' ? (o.is_correct ? '☑' : '☐') : (o.is_correct ? '●' : '○')} {o.text}
                              </li>
                            ))}
                          </ul>
                        )}
                        {q.matching_pairs?.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {q.matching_pairs.map((p: any) => (
                              <p key={p.id} className="text-muted">{p.left_text} ↔ {p.right_text}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}
