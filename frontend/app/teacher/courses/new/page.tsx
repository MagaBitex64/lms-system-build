'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Button, Card, Field, Input, Textarea, PageHeader, ErrorState } from '../../../components/ui'

export default function NewCoursePage() {
  const { t } = useI18n()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const created = await api<{ id: number }>('/courses', {
        body: { title, description, announcement, is_published: isPublished },
      })
      router.push(`/courses/${created.id}`)
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/teacher/courses"><span className="flex items-center gap-1.5"><ArrowLeft size={15} />{t('courseManagement')}</span></Link>
      </Button>

      <PageHeader eyebrow={t('teacher')} title={t('newCourse')} description={t('manageCourses')} />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label={t('title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('title')} required />
          </Field>
          <Field label={t('description')}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t('description')} />
          </Field>
          <Field label={t('announcement')}>
            <Textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)} rows={3} placeholder={t('announcement')} />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-muted/50 p-3.5">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{t('published')}</p>
              <p className="text-xs text-muted">{t('open')}</p>
            </div>
          </label>

          {error && <ErrorState message={error} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button asChild variant="outline" type="button"><Link href="/teacher/courses">{t('cancel')}</Link></Button>
            <Button type="submit" disabled={loading}>{loading ? t('loading') : t('create')}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
