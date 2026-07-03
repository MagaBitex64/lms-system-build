'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search as SearchIcon } from 'lucide-react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge, Button, Card, Input, PageHeader } from '../components/ui'

type SearchResult = {
  id: number
  title: string
  description?: string
  course_title?: string
  course_id?: number
  teacher_name?: string
}

function SearchPageContent() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(q)
  const [results, setResults] = useState<{ courses: SearchResult[]; lessons: SearchResult[]; materials: SearchResult[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q) return
    setLoading(true)
    api(`/search?q=${encodeURIComponent(q)}`)
      .then((data) => setResults(data as any))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [q])

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResults(null)
    api(`/search?q=${encodeURIComponent(query.trim())}`)
      .then((data) => setResults(data as any))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Search" title={t('search')} description="Find lessons, materials, and courses quickly with a refined search experience." />
      <Card className="space-y-5">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input className="pl-10" type="search" placeholder={t('searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Button type="submit">{t('search')}</Button>
        </form>
        {loading ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">{t('loading')}</div> : results ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="space-y-3">
              <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-950">{t('courses')}</h2><Badge>{results.courses.length}</Badge></div>
              {results.courses.length ? results.courses.map((course) => <div key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4"><Link href={`/courses/${course.id}`} className="font-semibold text-slate-900">{course.title}</Link><p className="mt-1 text-sm text-slate-500">{course.teacher_name}</p></div>) : <p className="text-sm text-slate-500">{t('noResults')}</p>}
            </section>
            <section className="space-y-3">
              <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-950">{t('lessons')}</h2><Badge>{results.lessons.length}</Badge></div>
              {results.lessons.length ? results.lessons.map((lesson) => <div key={lesson.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{lesson.title}</p><p className="mt-1 text-sm text-slate-500">{lesson.course_title}</p></div>) : <p className="text-sm text-slate-500">{t('noResults')}</p>}
            </section>
            <section className="space-y-3">
              <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-950">{t('materials')}</h2><Badge>{results.materials.length}</Badge></div>
              {results.materials.length ? results.materials.map((material) => <div key={material.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold text-slate-900">{material.title}</p><p className="mt-1 text-sm text-slate-500">{material.course_title}</p></div>) : <p className="text-sm text-slate-500">{t('noResults')}</p>}
            </section>
          </div> : null}
        )}
      </Card>
    </div>
  )
}

export default function SearchPage() {
  return (
    <I18nProvider>
      <Suspense fallback={<div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">Loading…</div>}>
        <SearchPageContent />
      </Suspense>
    </I18nProvider>
  )
}
