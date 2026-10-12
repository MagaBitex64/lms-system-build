'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { BookOpen, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import { PageHeader, Skeleton, EmptyState, ErrorState, Input, FadeIn, Button } from '@/components/ui'
import { CourseCard, type CourseSummary } from '@/components/course-card'

export default function CoursesPage() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [query])
  const { data, error, isLoading } = useSWR<{ items: CourseSummary[]; total: number }>(`/courses?page=${page}&q=${encodeURIComponent(query)}`, fetcher)
  const courses = data?.items ?? []
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 12))

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('catalog')} title={t('allCourses')} description={t('exploreCatalogHint')} />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <Input
          className="pl-9"
          placeholder={t('searchCourse')}
          aria-label={t('searchCourse')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Курстар жүктелуде">{[0, 1, 2].map(i => <Skeleton key={i} className="h-64 border border-border" />)}</div>
      ) : error ? (
        <ErrorState message={t('errorOccurred')} />
      ) : courses.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, i) => (
            <FadeIn key={course.id} delay={i * 40}>
              <CourseCard course={course} />
            </FadeIn>
          ))}
        </div>
      ) : (
        <EmptyState icon={<BookOpen size={22} />} title={query.trim() ? t('noResults') : t('noCoursesYet')} hint={t('exploreCatalogHint')} />
      )}
      <div className="flex justify-between gap-3">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Алдыңғы</Button>
        <span>{page} / {pages}</span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Келесі</Button>
      </div>
    </div>
  )
}
