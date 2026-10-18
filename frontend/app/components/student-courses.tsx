'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { BookOpen, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { loadCatalog } from '@/lib/course-catalog'
import { Button, EmptyState, ErrorState, Spinner } from './ui'
import { CourseFilters, CourseListingCard, filterCourses, type CourseProgress } from './course-listing'
import gridStyles from '../teacher/my-courses.module.css'
import styles from './student-learning.module.css'

export function useStudentCourses(enabled: boolean) {
  const catalog = useSWR(enabled ? ['catalog-all-pages', ''] : null, () => loadCatalog(''))
  const grades = useSWR<CourseProgress[]>(enabled ? '/grades/my' : null, fetcher)
  const enrolled = (catalog.data ?? []).filter(course => course.enrollment_status === 'approved')
  // Same completion definition as the existing student profile; grades are server-calculated.
  const completed = grades.data?.filter(grade => grade.total_items > 0 && grade.completed_items === grade.total_items).length
  return { catalog, grades, enrolled, completed }
}

export default function StudentCourses() {
  const { user, isLoading: authLoading } = useAuth()
  const { catalog, grades, enrolled } = useStudentCourses(user?.role === 'student')
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const filtered = filterCourses(enrolled, query, subject, '', sort)
  const pages = Math.max(1, Math.ceil(filtered.length / 12))
  const currentPage = Math.min(page, pages)
  if (authLoading || !user) return <Spinner />
  if (user.role !== 'student') return <ErrorState message="Бұл бет оқушыларға арналған." />
  return <div className={styles.page}>
    <header className={styles.pageHeading}><p>ОҚУ</p><h1>Менің курстарым</h1><span>Жазылған курстарыңызды жалғастырып, оқу барысын бақылаңыз.</span></header>
    <section aria-label="Жазылған курстар">
      <CourseFilters query={query} subject={subject} status="" sort={sort} showStatus={false}
        onQuery={value => { setQuery(value); setPage(1) }} onSubject={value => { setSubject(value); setPage(1) }} onStatus={() => {}} onSort={value => { setSort(value); setPage(1) }} />
      {catalog.isLoading ? <Spinner /> : catalog.error ? <ErrorState message="Курстарды жүктеу мүмкін болмады." /> : !filtered.length ? <EmptyState icon={query || subject ? <Search size={24} /> : <BookOpen size={24} />} title={query || subject ? 'Курстар табылмады' : 'Әзірге жазылған курстар жоқ'} action={!query && !subject ? <Button asChild><Link href="/courses">Курстар каталогы</Link></Button> : undefined} /> : <div className={gridStyles.grid}>
        {filtered.slice((currentPage - 1) * 12, currentPage * 12).map((course, index) => <CourseListingCard key={course.id} course={course} index={index} studentView showTeacher showGradebook={false} progress={grades.data?.find(grade => grade.course_id === course.id)} />)}
      </div>}
      {grades.error && <p role="status" className={styles.notice}>Оқу барысын жүктеу мүмкін болмады.</p>}
    </section>
    {!catalog.isLoading && !catalog.error && <nav className={styles.pagination} aria-label="Курс беттері"><span>Барлығы: {filtered.length} курс</span><div><Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Алдыңғы</Button><span>{currentPage} / {pages}</span><Button variant="secondary" size="sm" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Келесі</Button></div></nav>}
  </div>
}
