'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api, downloadFile, ApiError } from '@/lib/api'

type ItemDetail = {
  item: { id: number; title: string; note: string; course_id: number }
  type?: string
  content?: string
  youtube_url?: string
  materials?: Array<{ id: number; kind: string; label: string; url?: string; file_id?: number; original_name?: string }>
  description?: string
  open_at?: string | null
  deadline_at?: string | null
  close_at?: string | null
  max_score?: number
  weight_pct?: number
  submission?: { status: string; files: Array<{ id: number; original_name: string }> }
}

const endpoints = [
  '/courses/lessons/',
  '/quizzes/',
  '/homework/',
]

function ItemDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const itemId = params.id
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!itemId) return

    async function load() {
      setLoading(true)
      setError(null)
      for (const base of endpoints) {
        try {
          const data = await api(`${base}${itemId}`)
          setItem(data as ItemDetail)
          return
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            continue
          }
          setError((err as Error).message || t('errorOccurred'))
          return
        }
      }
      setError(t('errorOccurred'))
    }

    void load()
  }, [itemId, t])

  if (loading) {
    return <main className="container"><div className="card">{t('loading')}</div></main>
  }

  if (error || !item) {
    return <main className="container"><div className="card">{error || t('errorOccurred')}</div></main>
  }

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{item.item.title}</h1>
        <p>{item.item.note}</p>
        {item.content && <p>{item.content}</p>}
        {item.youtube_url && (
          <div style={{ marginTop: '1rem' }}>
            <a href={item.youtube_url} target="_blank" rel="noreferrer" className="button">
              {t('watchVideo')}
            </a>
          </div>
        )}
        {item.materials && item.materials.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h2 className="section-title">{t('materials')}</h2>
            <div className="grid" style={{ gap: '0.75rem' }}>
              {item.materials.map((material) => (
                <div key={material.id} className="card">
                  <p>{material.label || (material.kind === 'file' ? material.original_name : t('link'))}</p>
                  {material.kind === 'file' ? (
                    <button className="button button-secondary" onClick={() => downloadFile(material.file_id!, material.original_name ?? 'file')}>
                      {t('downloadFile')}
                    </button>
                  ) : (
                    <a href={material.url} target="_blank" rel="noreferrer" className="button button-secondary">
                      {t('viewCourse')}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function ItemDetailPageWrapper() {
  return (
    <I18nProvider>
      <ItemDetailPage />
    </I18nProvider>
  )
}
