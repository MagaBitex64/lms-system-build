'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { Search as SearchIcon, BookOpen, FileText, Paperclip } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import { Badge, Button, Card, Input, PageHeader, Spinner, EmptyState } from '@/components/ui'

type Result = {
  id: number
  title?: string
  label?: string
  description?: string
  course_title?: string
  course_id?: number
  teacher_name?: string
}

type SearchResponse = { courses: Result[]; lessons: Result[]; materials: Result[] }

function SearchContent() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const [query, setQuery] = useState(q)

  const { data, isLoading } = useSWR<SearchResponse>(
    q ? `/search?q=${encodeURIComponent(q)}` : null,
    fetcher,
  )

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const groups = data
    ? [
        { key: 'courses', title: t('courses'), icon: <BookOpen size={16} />, items: data.courses },
        { key: 'lessons', title: t('lessons'), icon: <FileText size={16} />, items: data.lessons },
        { key: 'materials', title: t('materials'), icon: <Paperclip size={16} />, items: data.materials },
      ]
    : []

  const totalResults = data ? data.courses.length + data.lessons.length + data.materials.length : 0

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('search')} title={t('search')} description={t('searchPlaceholder')} />

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <Input
            className="pl-9"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit">{t('search')}</Button>
      </form>

      {!q ? (
        <EmptyState icon={<SearchIcon size={22} />} title={t('search')} hint={t('searchPlaceholder')} />
      ) : isLoading ? (
        <Spinner />
      ) : totalResults === 0 ? (
        <EmptyState icon={<SearchIcon size={22} />} title={t('noResults')} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-primary">{group.icon}</span>
                <h2 className="text-base font-semibold">{group.title}</h2>
                <Badge tone="neutral">{group.items.length}</Badge>
              </div>
              {group.items.length ? (
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const itemTitle = item.title || item.label || t('noResults')
                    const inner = (
                      <Card interactive={!!(group.key === 'courses' || item.course_id)} className="py-3.5">
                        <p className="font-medium text-foreground">{itemTitle}</p>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {item.teacher_name || item.course_title || item.description || ''}
                        </p>
                      </Card>
                    )
                    const href =
                      group.key === 'courses'
                        ? `/courses/${item.id}`
                        : item.course_id
                          ? `/courses/${item.course_id}`
                          : null
                    return href ? (
                      <Link key={item.id} href={href} className="block">
                        {inner}
                      </Link>
                    ) : (
                      <div key={item.id}>{inner}</div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
                  {t('noResults')}
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner className="mt-20" />}>
      <SearchContent />
    </Suspense>
  )
}
