'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search as SearchIcon, BookOpen, FileText, Paperclip } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import { createSearchPager, emptySearchState, mergeSearchPages, validSearchQuery, type SearchPage } from '@/lib/search-results'
import { Badge, Button, Card, Input, PageHeader, Spinner, EmptyState } from '@/components/ui'

function SearchContent() {
  const { t } = useI18n()
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const [query, setQuery] = useState(q)
  const [inputError, setInputError] = useState(false)
  const [state, setState] = useState(() => emptySearchState(q))
  const pager = useRef<ReturnType<typeof createSearchPager> | null>(null)
  useEffect(() => {
    setQuery(q)
    setInputError(false)
    const current = createSearchPager((value, page) => api<SearchPage>(`/search?q=${encodeURIComponent(value)}&page=${page}`), setState)
    pager.current = current
    current.setQuery(q)
    return () => { current.dispose(); pager.current = null }
  }, [q])
  const current = state.query === q ? state : emptySearchState(q)
  const data = mergeSearchPages(current.pages)
  const hasMore = current.pages.at(-1)?.has_more ?? false
  const error = inputError ? 'invalid' : current.error
  const totalResults = data.courses.length + data.lessons.length + data.materials.length

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validSearchQuery(query)) { setInputError(true); return }
    setInputError(false)
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const groups = [
        { key: 'courses', title: t('courses'), icon: <BookOpen size={16} />, items: data.courses },
        { key: 'lessons', title: t('lessons'), icon: <FileText size={16} />, items: data.lessons },
        { key: 'materials', title: t('materials'), icon: <Paperclip size={16} />, items: data.materials },
      ]

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('search')} title={t('search')} description={t('searchPlaceholder')} />

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <Input
            className={`pl-9 ${error === 'invalid' ? 'border-danger' : ''}`}
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            maxLength={200}
            aria-label={t('searchPlaceholder')}
            aria-invalid={error === 'invalid'}
            aria-describedby={error ? 'search-error' : undefined}
            onChange={(e) => { setQuery(e.target.value); setInputError(false) }}
            autoFocus
          />
        </div>
        <Button type="submit">{t('search')}</Button>
      </form>

      {error && <div id="search-error" role="alert" className="space-y-3 rounded-xl border border-border bg-surface p-4 text-sm">
        <p>{error === 'invalid' ? 'Іздеу сұранысын тексеріңіз' : 'Іздеу кезінде қате орын алды. Қайталап көріңіз.'}</p>
        {error === 'request' && <Button variant="secondary" disabled={current.pending} onClick={() => pager.current?.retry()}>Қайталау</Button>}
      </div>}
      {!q && !error ? (
        <EmptyState icon={<SearchIcon size={22} />} title={t('search')} hint={t('searchPlaceholder')} />
      ) : current.pending && !current.pages.length ? (
        <Spinner />
      ) : !error && current.pages.length > 0 && totalResults === 0 && !hasMore ? (
        <EmptyState icon={<SearchIcon size={22} />} title={t('noResults')} />
      ) : totalResults > 0 ? (
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
                !error && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
                  {t('noResults')}
                </p>
              )}
            </section>
          ))}
        </div>
      ) : null}
      {hasMore && !error && <Button variant="secondary" disabled={current.pending} onClick={() => pager.current?.loadMore()}>{current.pending ? 'Жүктелуде…' : 'Тағы көрсету'}</Button>}
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
