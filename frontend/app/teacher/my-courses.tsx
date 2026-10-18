'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { BookOpen, PlusCircle, Users, GraduationCap, Search, ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { Button, Spinner, ErrorState, EmptyState } from '../components/ui'
import { CourseFilters, CourseListingCard, filterCourses, type ListingCourse } from '../components/course-listing'
import styles from './my-courses.module.css'

type CourseMembership = { groups: { id: number }[] | null; students: { id: number }[] | null }

// Existing detail endpoints supply unique memberships, with bounded concurrency.
async function loadMembershipCounts(ids: number[]) {
  const groups = new Set<number>()
  const students = new Set<number>()
  for (let start = 0; start < ids.length; start += 4) {
    const details = await Promise.all(ids.slice(start, start + 4).map(id => fetcher<CourseMembership>(`/courses/${id}`)))
    for (const detail of details) {
      if (!detail.groups || !detail.students) throw new Error('Курс деректерін жүктеу мүмкін болмады.')
      detail.groups.forEach(group => groups.add(group.id))
      detail.students.forEach(student => students.add(student.id))
    }
  }
  return { groups: groups.size, students: students.size }
}

export default function MyCourses({ showAllLink = true }: { showAllLink?: boolean }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const canManage = user?.role === 'teacher' || user?.role === 'admin'
  const { data: courses, error, isLoading } = useSWR<ListingCourse[]>(canManage ? '/courses/mine' : null, fetcher)
  const membership = useSWR(canManage && courses ? ['my-course-memberships', ...courses.map(c => c.id)] : null,
    () => loadMembershipCounts((courses ?? []).map(c => c.id)))
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('recent')
  const visible = filterCourses(courses ?? [], query, subject, status, sort)

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>МЕНІҢ КУРСТАРЫМ</p><h1>Менің курстарым</h1><p>Курстарыңызды, оқушыларды және оқу материалдарын басқарыңыз.</p></div>
      <Button asChild><Link href="/teacher/courses/new"><PlusCircle size={18} />{t('newCourse')}</Link></Button>
    </header>
    <div className={styles.stats}>
      {[
        { label: 'Курстар', value: courses?.length, Icon: BookOpen },
        { label: 'Оқушылар', value: membership.data?.students, Icon: Users },
        { label: 'Топтар', value: membership.data?.groups, Icon: GraduationCap },
      ].map(({ label, value, Icon }, index) => <div className={styles.stat} key={label}>
        <span className={`${styles.statIcon} ${styles[`tone${index}`]}`}><Icon size={24} /></span>
        <div><p>{label}</p><strong>{value ?? '—'}</strong></div>
      </div>)}
    </div>
    {membership.error && !error && <p role="status" className={styles.notice}>Оқушылар мен топтар санын жүктеу мүмкін болмады. <button onClick={() => void membership.mutate()}>Қайталау</button></p>}
    <section aria-labelledby="my-course-list">
      <div className={styles.listHeading}><h2 id="my-course-list">Менің курстарым</h2>{showAllLink && <Link href="/teacher/courses">{t('seeAll')}<ArrowRight size={15} /></Link>}</div>
      <CourseFilters query={query} subject={subject} status={status} sort={sort} onQuery={setQuery} onSubject={setSubject} onStatus={setStatus} onSort={setSort} />
      {isLoading || !user ? <Spinner /> : error ? <ErrorState message={(error as Error).message || t('errorOccurred')} /> : !courses?.length ? <EmptyState icon={<BookOpen size={22} />} title={t('noCoursesYet')} hint={t('manageCourses')} action={<Button asChild><Link href="/teacher/courses/new">{t('newCourse')}</Link></Button>} /> : !visible.length ? <EmptyState icon={<Search size={22} />} title="Курстар табылмады" hint="Іздеу сөзін немесе сүзгілерді өзгертіңіз." /> : <div className={styles.grid}>
        {visible.map((course, index) => <CourseListingCard key={course.id} course={course} index={index} />)}
      </div>}
    </section>
  </div>
}
