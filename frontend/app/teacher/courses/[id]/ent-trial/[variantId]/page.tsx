'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api, fetcher } from '@/lib/api'
import { SUBJECT_NAMES } from '@/lib/ent'
import VariantEditor from '@/components/ent-variant-editor'
import { Badge, Button, Card, ErrorState, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui'

type Course = { id: number; title: string; ent_subject: string | null; is_owner: boolean }
type Variant = {
  id: number
  title: string
  description: string
  single_subject: string
  ready: boolean
  question_count: number
  max_score: number
  duration_seconds: number
}
type VariantsResponse = { items: Variant[]; subject: string | null }

export default function TeacherEntVariantPage() {
  const params = useParams()
  const courseId = Number(params.id)
  const variantId = Number(params.variantId)
  const { data: course, error: courseError, isLoading: courseLoading } = useSWR<Course>(
    Number.isFinite(courseId) ? `/courses/${courseId}` : null,
    fetcher,
  )
  const { data, error: variantsError, isLoading: variantsLoading, mutate } = useSWR<VariantsResponse>(
    Number.isFinite(courseId) ? `/ent-trial/teacher/courses/${courseId}/variants` : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  const variant = data?.items.find((item) => item.id === variantId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!variant) return
    setTitle(variant.title)
    setDescription(variant.description)
  }, [variant?.id])

  async function updateVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!variant) return
    setBusy(true); setMessage(''); setSaved(false)
    try {
      await api(`/ent-trial/teacher/variants/${variant.id}`, {
        method: 'PATCH', body: { title, description },
      })
      await mutate()
      setSaved(true)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (courseLoading || variantsLoading) return <Spinner className="mt-20" />
  if (courseError || variantsError) return <ErrorState message={(courseError || variantsError)?.message ?? 'Деректерді жүктеу мүмкін болмады'} />
  if (!course?.is_owner || !variant) return <ErrorState message="Вариант табылмады немесе оны редакциялауға рұқсат жоқ." />

  return <div className="space-y-7">
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={`/courses/${courseId}`}><ArrowLeft size={15} /> {course.title}</Link>
    </Button>

    <PageHeader
      eyebrow="Пәндік пробный ҰБТ"
      title={variant.title}
      description="Варианттың атауын, ортақ контекстерін және сұрақтарын осы жеке бетте редакциялаңыз."
      actions={<div className="flex flex-wrap gap-2">
        <Badge tone="primary">{SUBJECT_NAMES[variant.single_subject] ?? variant.single_subject}</Badge>
        <Badge tone={variant.ready ? 'success' : 'warning'}>{variant.ready ? 'Дайын' : 'Жоба'}</Badge>
      </div>}
    />

    <Card>
      <form onSubmit={updateVariant} className="space-y-4">
        <div>
          <h2 className="font-semibold">Вариант туралы</h2>
          <p className="mt-1 text-sm text-muted">Пән курстан автоматты түрде алынады және бұл жерде өзгертілмейді.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Атауы"><Input required maxLength={200} value={title} onChange={(event) => { setTitle(event.target.value); setSaved(false) }} /></Field>
          <Field label="Сипаттамасы"><Textarea rows={3} maxLength={1000} value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false) }} /></Field>
        </div>
        {message && <ErrorState message={message} />}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Сақталуда…' : 'Өзгерістерді сақтау'}</Button>
          {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 size={16} /> Сақталды</span>}
        </div>
      </form>
    </Card>

    <VariantEditor
      variantId={variant.id}
      variants={[variant]}
      onSelectVariant={() => undefined}
      onSaved={() => void mutate()}
      hideVariantSelect
    />
  </div>
}
