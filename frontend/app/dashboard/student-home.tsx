'use client'

import { useId } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowRight, BookOpen, Compass, GraduationCap } from 'lucide-react'
import { fetcher } from '@/lib/api'
import type { Rules } from '@/lib/ent'
import type { StudentTestAccess } from '@/lib/student-tests'
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui'
import { CourseListingCard } from '@/components/course-listing'
import { useStudentCourses } from '@/components/student-courses'
import { StudentTestCard, useStudentTestStart } from '../ent-trial/student-tests'
import gridStyles from '../teacher/my-courses.module.css'
import styles from '../components/student-learning.module.css'

function StudyArt() {
  const id = useId().replace(/:/g, '')
  return <svg viewBox="0 0 320 180" className={styles.studyArt} aria-hidden="true">
    <defs><linearGradient id={`${id}-book`} x1="0" x2="1" y2="1"><stop stopColor="#91deef" /><stop offset="1" stopColor="#299ac3" /></linearGradient><linearGradient id={`${id}-cap`} x1="0" x2="1" y2="1"><stop stopColor="#259ab8" /><stop offset="1" stopColor="#00566f" /></linearGradient></defs>
    <ellipse cx="168" cy="164" rx="113" ry="9" fill="#176c8d" opacity=".09" />
    <g transform="rotate(-6 165 125)"><rect x="63" y="121" width="205" height="36" rx="9" fill="#4bb4d6" /><path d="M76 127h185v22H76c-8 0-8-22 0-22Z" fill="#effbff" /><path d="M82 134h173M82 140h173" stroke="#cee9f2" strokeWidth="2" />
    <rect x="77" y="88" width="190" height="34" rx="8" fill={`url(#${id}-book)`} /><path d="M89 94h173v21H89c-7 0-7-21 0-21Z" fill="#f6fdff" /><path d="M94 101h162M94 107h162" stroke="#c9e6f0" strokeWidth="2" /></g>
    <path d="M111 57v33c39 25 77 26 117 2V58" fill={`url(#${id}-cap)`} /><path d="m54 50 118-33 118 32-117 37Z" fill={`url(#${id}-cap)`} /><path d="m173 48 65 24v58" fill="none" stroke="#ffcf65" strokeWidth="4" strokeLinecap="round" /><path d="m234 129-4 22h15l-4-22Z" fill="#ffcf65" /><circle cx="238" cy="127" r="5" fill="#f6bd4e" />
    <path d="m35 109 4 10 10 4-10 4-4 10-4-10-10-4 10-4Zm252-21 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#53bee2" />
  </svg>
}

export default function StudentHome({ firstName }: { firstName: string }) {
  const { catalog, grades, enrolled, completed } = useStudentCourses(true)
  const tests = useSWR<{ items: StudentTestAccess[] }>('/ent-trial/my-accesses', fetcher)
  const rules = useSWR<Rules>('/ent-trial/rules', fetcher)
  const startTest = useStudentTestStart()
  return <div className={styles.page}>
    <header className={styles.banner}><div><h1>Қош келдіңіз, {firstName}!</h1><p>Оқуды жалғастырыңыз. Өтіңіз немесе жаңа материалды ашыңыз.</p></div><StudyArt /></header>
    <section className={styles.stats} aria-label="Оқу көрсеткіштері">
      {[
        { label: 'Жазылған курстар', value: catalog.data ? enrolled.length : undefined, Icon: BookOpen },
        { label: 'Барлық қолжетімді курстар', value: catalog.data?.length, Icon: Compass },
        { label: 'Аяқталған курстар', value: completed, Icon: GraduationCap },
      ].map(({ label, value, Icon }, index) => <div className={styles.stat} key={label}><span className={`${styles.statIcon} ${index === 2 ? styles.green : ''}`}><Icon size={25} /></span><div><p>{label}</p><strong>{value ?? '—'}</strong></div></div>)}
    </section>
    {grades.error && <p className={styles.notice} role="status">Аяқталған курстар мен оқу барысын жүктеу мүмкін болмады.</p>}
    <section aria-labelledby="student-courses-title">
      <div className={styles.sectionHeading}><h2 id="student-courses-title">Менің курстарым</h2><Link href="/my-courses">Барлығын көру<ArrowRight size={16} /></Link></div>
      {catalog.isLoading ? <Spinner /> : catalog.error ? <ErrorState message="Курстарды жүктеу мүмкін болмады." /> : enrolled.length ? <div className={gridStyles.grid}>{enrolled.slice(0, 3).map((course, index) => <CourseListingCard key={course.id} course={course} index={index} studentView showGradebook={false} progress={grades.data?.find(grade => grade.course_id === course.id)} />)}</div>
        : <EmptyState icon={<BookOpen size={25} />} title="Әзірге жазылған курстар жоқ" action={<Button asChild><Link href="/courses">Курстар каталогы</Link></Button>} />}
    </section>
    <section aria-labelledby="student-tests-title">
      <div className={styles.sectionHeading}><div><h2 id="student-tests-title">Сынақ ҰБТ</h2><p>Қолжетімді сынақтарды өтіп, нәтижелеріңізді тексеріңіз.</p></div><Link href="/ent-trial">Барлығын көру<ArrowRight size={16} /></Link></div>
      {tests.isLoading ? <Spinner /> : tests.error ? <ErrorState message="Сынақтарды жүктеу мүмкін болмады." /> : tests.data?.items.length ? <div className={styles.testGrid}>{tests.data.items.slice(0, 3).map((access, index) => <StudentTestCard key={access.id} access={access} rules={rules.data} onStart={startTest} index={index} compact />)}</div>
        : <EmptyState icon={<GraduationCap size={25} />} title="Әзірге тағайындалған сынақтар жоқ" />}
    </section>
  </div>
}
