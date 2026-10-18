'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { BookOpen, PlusCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { loadCatalog } from '@/lib/course-catalog'
import { Button, Skeleton, EmptyState, ErrorState } from '@/components/ui'
import { CourseFilters, CourseListingCard, filterCourses, type ListingCourse } from '@/components/course-listing'
import styles from '../teacher/my-courses.module.css'

const PAGE_SIZE = 12

export default function CoursesPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const canCreate = user?.role === 'admin' || user?.role === 'teacher'
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const catalog = useSWR(user ? ['catalog-all-pages', query] : null, () => loadCatalog(query))
  const managed = useSWR<ListingCourse[]>(user?.role === 'teacher' ? '/courses/mine' : null, fetcher)
  const managedIds = new Set((managed.data ?? []).map(course => course.id))
  const filtered = filterCourses(catalog.data ?? [], '', subject, '', sort)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>{t('catalog')}</p><h1>Барлық курстар</h1><p>Өзіңізге қажет курсты табу үшін каталогты қараңыз.</p></div>
      {canCreate && <Button asChild><Link href="/teacher/courses/new"><PlusCircle size={18} />{t('newCourse')}</Link></Button>}
    </header>
    <section aria-label="Курстар каталогы">
      <CourseFilters query={query} subject={subject} status="" sort={sort} showStatus={false} placeholder="Курсты іздеу..."
        onQuery={value => { setQuery(value); setPage(1) }} onSubject={value => { setSubject(value); setPage(1) }}
        onStatus={() => {}} onSort={value => { setSort(value); setPage(1) }} />
      {catalog.isLoading || !user ? <div className={styles.grid} role="status" aria-label="Курстар жүктелуде">{[0, 1, 2].map(i => <Skeleton key={i} className="h-64 border border-border" />)}</div>
        : catalog.error ? <ErrorState message={t('errorOccurred')} />
        : !visible.length ? <EmptyState icon={<BookOpen size={22} />} title={query.trim() || subject ? t('noResults') : t('noCoursesYet')} hint={t('exploreCatalogHint')} />
        : <div className={styles.grid}>{visible.map((course, index) => <CourseListingCard key={course.id} course={course} index={index} studentView={user.role === 'student'} showTeacher showGradebook={user.role === 'admin' || (user.role === 'teacher' && managedIds.has(course.id))} />)}</div>}
    </section>
    {!catalog.isLoading && !catalog.error && <nav aria-label="Каталог беттері" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span aria-live="polite">Барлығы: {filtered.length} курс</span>
      <div className="flex items-center gap-3"><Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Алдыңғы</Button><span>{currentPage} / {pages}</span><Button variant="secondary" size="sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Келесі</Button></div>
    </nav>}
  </div>
}
