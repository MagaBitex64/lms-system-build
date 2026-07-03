'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { BookOpen, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import { PageHeader, Spinner, EmptyState, ErrorState, Input, FadeIn } from '@/components/ui'
import { CourseCard, type CourseSummary } from '@/components/course-card'

export default function CoursesPage() {
  const { t } = useI18n()
  const { data, error, isLoading } = useSWR<{ items: CourseSummary[] }>('/courses', fetcher)
  const [query, setQuery] = useState('')

  const courses = useMemo(() => {
    const items = data?.items ?? []
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.teacher_name?.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('catalog')} title={t('allCourses')} description={t('exploreCatalogHint')} />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <Input
          className="pl-9"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner />
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
        <EmptyState icon={<BookOpen size={22} />} title={t('noResults')} hint={t('exploreCatalogHint')} />
      )}
    </div>
  )
}
