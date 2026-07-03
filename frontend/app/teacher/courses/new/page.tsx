'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

function NewCoursePage() {
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
      const created = await api('/courses', {
        body: { title, description, announcement, is_published: isPublished },
      })
      router.push(`/courses/${(created as any).id}`)
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 className="page-title">{t('newCourse')}</h1>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: '1rem' }}>
          <label>
            {t('title')}
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            {t('description')}
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </label>
          <label>
            {t('announcement')}
            <textarea className="textarea" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} rows={4} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            {t('published')}
          </label>
          {error && <div className="text-muted">{error}</div>}
          <button className="button" type="submit" disabled={loading}>
            {loading ? t('loading') : t('create')}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function NewCoursePageWrapper() {
  return (
    <I18nProvider>
      <NewCoursePage />
    </I18nProvider>
  )
}
