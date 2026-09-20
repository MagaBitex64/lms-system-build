'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { CheckCircle2, CircleAlert, FilePenLine, PlusCircle, Trash2, MoreHorizontal } from 'lucide-react'
import { api, fetcher } from '@/lib/api'
import { SUBJECT_NAMES } from '@/lib/ent'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Spinner, Textarea, Modal, DropdownMenu, DeletionConfirmModal } from '@/components/ui'

type Variant = {
  id: number
  title: string
  description: string
  single_subject: string
  ready: boolean
  question_count: number
  max_score: number
  duration_seconds: number
  issue_count: number
}

type VariantsResponse = { items: Variant[]; subject: string | null }

export default function CourseEntVariants({ courseId, subject }: { courseId: number; subject: string | null }) {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<VariantsResponse>(
    `/ent-trial/teacher/courses/${courseId}/variants`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const variants = data?.items ?? []
  const [pendingDelete, setPendingDelete] = useState<Variant | null>(null)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      const created = await api<{ id: number }>(`/ent-trial/teacher/courses/${courseId}/variants`, {
        method: 'POST', body: { title, description },
      })
      router.push(`/teacher/courses/${courseId}/ent-trial/${created.id}`)
    } catch (err) {
      setMessage((err as Error).message)
      setBusy(false)
    }
  }

  async function deleteVariant(variant: Variant) {
    setBusy(true); setMessage('')
    try {
      await api(`/ent-trial/teacher/variants/${variant.id}`, { method: 'DELETE' })
      await mutate()
      setPendingDelete(null)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <Spinner />
  if (error) return <ErrorState message={error.message} />

  if (!subject) {
    return <ErrorState message="Курстың пәні белгіленбеген. Бұл ескі курсқа пәнді әкімші бекітуі керек." />
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <p className="text-xs font-medium text-muted">Курс пәні</p>
        <p className="mt-1 font-semibold">{SUBJECT_NAMES[subject] ?? subject}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="primary">{variants.length} нұсқа</Badge>
        <Button size="sm" onClick={() => { setCreating(true); setTitle(''); setDescription(''); setMessage('') }}>
          <PlusCircle size={15} /> Нұсқа қосу
        </Button>
      </div>
    </div>

    {message && <ErrorState message={message} />}

    <Modal open={creating} onClose={() => setCreating(false)} title="Нұсқа құру" closeDisabled={busy}>
      <form onSubmit={createVariant} className="space-y-4">
        <div>
          <h3 className="font-semibold">Жаңа сынақ нұсқасы</h3>
          <p className="mt-1 text-sm text-muted">Пән: {SUBJECT_NAMES[subject] ?? subject}. Нұсқа құрылғаннан кейін сұрақтар редакторы жеке бетте ашылады.</p>
        </div>
        <Field label="Атауы"><Input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="Сипаттамасы"><Textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        {message && <ErrorState message={message} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setCreating(false)}>Бас тарту</Button>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Құрылуда…' : 'Құру және редакторды ашу'}</Button>
        </div>
      </form>
    </Modal>
    <DeletionConfirmModal open={pendingDelete !== null} onClose={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) void deleteVariant(pendingDelete) }} title="Нұсқаны өшіру" description={`«${pendingDelete?.title ?? ''}» нұсқасын өшіргіңіз келе ме?`} courseName={pendingDelete?.title ?? ''} warning={message || undefined} isLoading={busy} />

    {variants.length ? <div className="grid gap-3 lg:grid-cols-2">
      {variants.map((variant) => <Card key={variant.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{variant.title}</p>
            {variant.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{variant.description}</p>}
          </div>
          <div className="relative shrink-0">
            <Button variant="ghost" size="sm" disabled={busy} aria-label={`«${variant.title}» нұсқасының әрекеттері`} aria-haspopup="menu" aria-expanded={menuId === variant.id} onClick={() => setMenuId(menuId === variant.id ? null : variant.id)}><MoreHorizontal size={18} /></Button>
            <DropdownMenu open={menuId === variant.id} onClose={() => setMenuId(null)} items={[
              { label: 'Өңдеу', icon: <FilePenLine size={14} />, onClick: () => router.push(`/teacher/courses/${courseId}/ent-trial/${variant.id}`) },
              { label: 'Өшіру', icon: <Trash2 size={14} />, destructive: true, onClick: () => { setMessage(''); setPendingDelete(variant) } },
            ]} />
          </div>
        </div>
        <div className="mt-3">
          <Badge tone={variant.ready ? 'success' : 'warning'}>{variant.ready ? 'Дайын' : 'Толықтыру қажет'}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{variant.question_count} сұрақ</span><span>{variant.max_score} балл</span><span>{Math.round(variant.duration_seconds / 60)} минут</span>
          {!variant.ready && <span className="inline-flex items-center gap-1 text-warning-foreground"><CircleAlert size={13} />{variant.issue_count} ескерту</span>}
          {variant.ready && <span className="inline-flex items-center gap-1 text-success-foreground"><CheckCircle2 size={13} />ҰБТ талабына сай</span>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="primary">
            <Link href={`/teacher/courses/${courseId}/ent-trial/${variant.id}`}><FilePenLine size={14} /> Өңдеу</Link>
          </Button>
        </div>
      </Card>)}
    </div> : !creating && <EmptyState title="Әзірге сынақ нұсқалары жоқ" hint="Бірінші нұсқаны құрып, пән ережесі бойынша сұрақтарды толтырыңыз." />}
  </div>
}
