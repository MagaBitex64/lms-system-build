'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, ExternalLink, PlayCircle, Sparkles } from 'lucide-react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api, downloadFile, ApiError } from '@/lib/api'
import { Badge, Button, Card, FadeIn, PageHeader } from '../../components/ui'

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

const endpoints = ['/courses/lessons/', '/quizzes/', '/homework/']

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
          if (err instanceof ApiError && err.status === 404) continue
          setError((err as Error).message || t('errorOccurred'))
          return
        }
      }
      setError(t('errorOccurred'))
    }

    void load()
  }, [itemId, t])

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('loading')}</div>
  if (error || !item) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error || t('errorOccurred')}</div>

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t(item.type === 'lesson' ? 'lesson' : item.type === 'quiz' ? 'quiz' : 'homework')} title={item.item.title} description={item.item.note} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><Sparkles size={18} /></div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-950">Content</h2>
              <p className="text-sm leading-7 text-slate-600">{item.content || item.description || 'The lesson content will appear here once available from the API.'}</p>
            </div>
          </div>
          {item.youtube_url ? (
            <Button asChild>
              <a href={item.youtube_url} target="_blank" rel="noreferrer"><span className="flex items-center gap-2"><PlayCircle size={16} />{t('watchVideo')}</span></a>
            </Button>
          ) : null}
        </Card>
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Download size={18} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Resources</p>
              <h2 className="text-xl font-semibold text-slate-950">Materials & files</h2>
            </div>
          </div>
          {item.materials && item.materials.length > 0 ? (
            <div className="space-y-3">
              {item.materials.map((material) => (
                <div key={material.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">{material.label || (material.kind === 'file' ? material.original_name : t('link'))}</p>
                    {material.kind === 'file' ? (
                      <Button variant="outline" size="sm" onClick={() => downloadFile(material.file_id!, material.original_name ?? 'file')}>
                        <span className="flex items-center gap-2"><Download size={14} />{t('downloadFile')}</span>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <a href={material.url} target="_blank" rel="noreferrer"><span className="flex items-center gap-2"><ExternalLink size={14} />{t('viewCourse')}</span></a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No downloadable materials were provided by the backend for this item.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function ItemDetailPageWrapper() {
  return (
    <I18nProvider>
      <ItemDetailPage />
    </I18nProvider>
  )
}
