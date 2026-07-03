'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

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
    <main className="container">
      <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 className="page-title">{t('search')}</h1>
        <form onSubmit={handleSearch} className="grid" style={{ gap: '1rem' }}>
          <input
            className="input"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="button" type="submit">
            {t('search')}
          </button>
        </form>
        {loading ? (
          <div>{t('loading')}</div>
        ) : results ? (
          <div className="grid" style={{ gap: '1.5rem', marginTop: '1rem' }}>
            <section>
              <h2 className="section-title">{t('courses')}</h2>
              {results.courses.length ? (
                results.courses.map((course) => (
                  <div key={course.id} className="card">
                    <Link href={`/courses/${course.id}`}><strong>{course.title}</strong></Link>
                    <p className="text-muted">{course.teacher_name}</p>
                  </div>
                ))
              ) : (
                <p>{t('noResults')}</p>
              )}
            </section>
            <section>
              <h2 className="section-title">{t('lessons')}</h2>
              {results.lessons.length ? (
                results.lessons.map((lesson) => (
                  <div key={lesson.id} className="card">
                    <strong>{lesson.title}</strong>
                    <p className="text-muted">{lesson.course_title}</p>
                  </div>
                ))
              ) : (
                <p>{t('noResults')}</p>
              )}
            </section>
            <section>
              <h2 className="section-title">{t('materials')}</h2>
              {results.materials.length ? (
                results.materials.map((material) => (
                  <div key={material.id} className="card">
                    <strong>{material.title}</strong>
                    <p className="text-muted">{material.course_title}</p>
                  </div>
                ))
              ) : (
                <p>{t('noResults')}</p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default function SearchPage() {
  return (
    <I18nProvider>
      <Suspense fallback={<div className="container"><div className="card">Loading…</div></div>}>
        <SearchPageContent />
      </Suspense>
    </I18nProvider>
  )
}
