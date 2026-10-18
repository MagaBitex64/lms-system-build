'use client'

import { useId } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowRight, BookOpen, GraduationCap, PlusCircle, Users } from 'lucide-react'
import { fetcher } from '@/lib/api'
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui'
import { CourseListingCard, type ListingCourse } from '@/components/course-listing'
import courseStyles from '../teacher/my-courses.module.css'
import styles from './teacher-home.module.css'

type CourseGroups = { id: number; groups: { id: number }[] | null }

// Use the same persisted course-group relationships as the existing My Courses page.
async function loadTeacherGroups(ids: number[]) {
  const groups = new Set<number>()
  const byCourse: Record<number, number> = {}
  for (let start = 0; start < ids.length; start += 4) {
    const details = await Promise.all(ids.slice(start, start + 4).map(id => fetcher<CourseGroups>(`/courses/${id}`)))
    for (const detail of details) {
      if (!detail.groups) throw new Error('Топ деректерін жүктеу мүмкін болмады.')
      detail.groups.forEach(group => groups.add(group.id))
      byCourse[detail.id] = new Set(detail.groups.map(group => group.id)).size
    }
  }
  return { total: groups.size, byCourse }
}

function TeacherArt() {
  const id = useId().replace(/:/g, '')
  return <svg className={styles.art} viewBox="0 0 260 180" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-frame`} x1="0" x2="1" y2="1"><stop stopColor="#3a8bb1" /><stop offset="1" stopColor="#004e70" /></linearGradient>
      <linearGradient id={`${id}-screen`} x1="0" x2="1" y2="1"><stop stopColor="#f6fdff" /><stop offset="1" stopColor="#c8effc" /></linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" x2="1" y2="1"><stop stopColor="#8ce5c7" /><stop offset="1" stopColor="#1d9d94" /></linearGradient>
    </defs>
    <ellipse cx="132" cy="166" rx="113" ry="8" fill="#167e9a" opacity=".1" />
    <g transform="rotate(-5 93 100)"><rect x="25" y="48" width="128" height="110" rx="8" fill={`url(#${id}-frame)`} /><rect x="33" y="56" width="112" height="91" rx="3" fill={`url(#${id}-screen)`} />
    <path d="M50 75h59" stroke="#b5dfef" strokeWidth="3" strokeLinecap="round" />
    <path d="M88 95c-11-9-23-9-35-5v39c12-4 24-4 35 5 11-9 23-9 35-5V90c-12-4-24-4-35 5Z" fill="#fff" stroke="#49a9c3" strokeWidth="3" strokeLinejoin="round" /><path d="M88 95v39m-26-33h15m-15 8h15m22-8h15m-15 8h15" fill="none" stroke="#8acddb" strokeWidth="2" strokeLinecap="round" /></g>
    <path d="M21 155h143l11 7c-2 4-8 5-13 5H27c-7 0-11-2-12-5Z" fill="#3388a9" /><path d="M74 156h45l-4 4H80Z" fill="#91cddd" />
    <rect x="156" y="143" width="57" height="18" rx="4" fill="#31a4bc" /><path d="M162 147h47v10h-47c-4 0-4-10 0-10Z" fill="#f3fcff" /><rect x="151" y="125" width="60" height="17" rx="4" fill="#75cbd9" /><path d="M157 129h49v9h-49c-4 0-4-9 0-9Z" fill="#f4fcff" />
    <path d="M220 132c-16-29-32-48-33-80 24 14 33 46 33 80Z" fill={`url(#${id}-leaf)`} /><path d="M219 130c-6-39-7-68 7-95 9 32 7 64-7 95Zm1-3c1-29 14-55 33-68-3 35-12 53-33 68Z" fill={`url(#${id}-leaf)`} /><path d="m215 132 10-78m-6 78-23-64m25 64 24-54" stroke="#3aaca2" strokeWidth="1.5" fill="none" />
    <path d="m202 123 38 1-5 35c-2 9-27 9-29 0Z" fill={`url(#${id}-screen)`} /><ellipse cx="221" cy="124" rx="19" ry="4" fill="#c3e9f0" />
    <path d="m164 23 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm-148 77 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff" />
  </svg>
}

export default function TeacherHome({ firstName, courses, loading, error }: { firstName: string; courses?: ListingCourse[]; loading: boolean; error: boolean }) {
  const groups = useSWR(courses && !error ? ['teacher-home-groups', ...courses.map(course => course.id)] : null, () => loadTeacherGroups((courses ?? []).map(course => course.id)))
  // Preserve the current dashboard's approved-enrollment count across managed courses.
  const activeStudents = courses?.reduce((sum, course) => sum + (course.student_count ?? 0), 0)
  const metrics = [
    { label: 'Жасалған курстар', value: courses?.length, Icon: BookOpen, tone: styles.blue },
    { label: 'Белсенді оқушылар', value: activeStudents, Icon: Users, tone: styles.green },
    { label: 'Барлық топтар', value: groups.data?.total, Icon: GraduationCap, tone: styles.amber },
  ]

  return <div className={styles.page}>
    <header className={styles.banner}>
      <div className={styles.welcome}><h1>Қош келдіңіз{firstName ? `, ${firstName}` : ''}!</h1><p>Курстарыңызды басқарыңыз, оқушыларыңызды қадағалаңыз және оқу материалдарын ұйымдастырыңыз.</p></div>
      <TeacherArt />
      <div className={styles.actions}><Button asChild variant="secondary"><Link href="/teacher"><GraduationCap size={17} />Курстарды басқару</Link></Button><Button asChild><Link href="/teacher/courses/new"><PlusCircle size={17} />Жаңа курс</Link></Button></div>
    </header>

    <section aria-labelledby="teacher-statistics">
      <div className={styles.sectionHeading}><div><h2 id="teacher-statistics">Статистика</h2><p>Сіздің негізгі көрсеткіштеріңіз</p></div></div>
      <div className={styles.metrics} aria-busy={loading || groups.isLoading}>{metrics.map(({ label, value, Icon, tone }) => <div className={styles.metric} key={label}><span className={`${styles.icon} ${tone}`}><Icon size={25} /></span><div><p>{label}</p><strong>{loading || error ? '—' : value ?? '—'}</strong></div></div>)}</div>
      {groups.error && !error && <p role="status" className={styles.notice}>Топтар санын жүктеу мүмкін болмады. <button onClick={() => void groups.mutate()}>Қайталау</button></p>}
    </section>

    <section aria-labelledby="teacher-recent-courses">
      <div className={styles.sectionHeading}><h2 id="teacher-recent-courses">Менің курстарым{courses ? ` (${courses.length})` : ''}</h2><Link href="/teacher">Барлығын көру<ArrowRight size={16} /></Link></div>
      {loading ? <Spinner /> : error ? <ErrorState message="Курстарды жүктеу мүмкін болмады." /> : courses?.length ? <div className={courseStyles.grid}>{courses.slice(0, 3).map((course, index) => <CourseListingCard key={course.id} course={course} index={index} groupCount={groups.data?.byCourse[course.id]} />)}</div>
        : <EmptyState icon={<BookOpen size={26} />} title="Әзірге курстар жоқ" action={<Button asChild><Link href="/teacher/courses/new"><PlusCircle size={17} />Жаңа курс</Link></Button>} />}
    </section>
  </div>
}
