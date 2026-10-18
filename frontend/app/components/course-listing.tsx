'use client'

import Link from 'next/link'
import { BookOpen, Users, UserRound, Search } from 'lucide-react'
import { useI18n, type TKey } from '@/lib/i18n'
import { SUBJECT_NAMES } from '@/lib/ent'
import { Badge, Button, ProgressBar } from './ui'
import { CourseCover } from '../teacher/course-cover'
import styles from '../teacher/my-courses.module.css'

export type ListingCourse = {
  id: number; title: string; description: string; item_count: number
  student_count: number; is_published: boolean; ent_subject?: string | null
  teacher_name?: string; enrollment_status?: string | null
}

export function filterCourses(courses: ListingCourse[], query: string, subject: string, status: string, sort: string) {
  const search = query.trim().toLocaleLowerCase('kk')
  const visible = courses.filter(course =>
    (!search || `${course.title} ${course.description ?? ''}`.toLocaleLowerCase('kk').includes(search)) &&
    (!subject || (subject === 'unassigned' ? !course.ent_subject || !Object.hasOwn(SUBJECT_NAMES, course.ent_subject) : course.ent_subject === subject)) &&
    (!status || course.is_published === (status === 'published')),
  )
  if (sort === 'title') visible.sort((a, b) => a.title.localeCompare(b.title, 'kk'))
  if (sort === 'students') visible.sort((a, b) => b.student_count - a.student_count)
  return visible
}

export function CourseFilters({ query, subject, status, sort, onQuery, onSubject, onStatus, onSort, showStatus = true, placeholder = 'Курстарды іздеу...' }: {
  query: string; subject: string; status: string; sort: string
  onQuery: (value: string) => void; onSubject: (value: string) => void
  onStatus: (value: string) => void; onSort: (value: string) => void
  showStatus?: boolean; placeholder?: string
}) {
  const { t } = useI18n()
  return <div className={`${styles.toolbar} ${!showStatus ? styles.catalogToolbar : ''}`}>
    <label className={styles.search}><Search size={18} /><input aria-label="Курстарды іздеу" placeholder={placeholder} value={query} onChange={e => onQuery(e.target.value)} /></label>
    <select aria-label="Пән бойынша сүзу" value={subject} onChange={e => onSubject(e.target.value)}><option value="">Барлық пәндер</option>{Object.entries(SUBJECT_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="unassigned">Пәні белгіленбеген</option></select>
    {showStatus && <select aria-label="Жариялану күйі" value={status} onChange={e => onStatus(e.target.value)}><option value="">Барлық күйлер</option><option value="published">{t('published')}</option><option value="draft">{t('draft')}</option></select>}
    <select aria-label="Курстарды сұрыптау" value={sort} onChange={e => onSort(e.target.value)}><option value="recent">Соңғы қосылғаны</option><option value="title">Атауы бойынша</option><option value="students">Оқушылар саны</option></select>
  </div>
}

export type CourseProgress = { course_id: number; progress: number; completed_items: number; total_items: number }

export function CourseListingCard({ course, index = 0, showTeacher = false, showGradebook = true, progress, studentView = false, groupCount }: { course: ListingCourse; index?: number; showTeacher?: boolean; showGradebook?: boolean; progress?: CourseProgress; studentView?: boolean; groupCount?: number }) {
  const { t } = useI18n()
  const enrollment = course.enrollment_status
  const tone = enrollment === 'approved' ? 'success' : enrollment === 'pending' ? 'warning' : enrollment === 'rejected' ? 'danger' : 'neutral'
  return <article className={styles.card} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
    <div className={styles.cover}><CourseCover subject={course.ent_subject} /><div className={styles.status}><Badge tone={course.is_published ? 'success' : 'neutral'}>{course.is_published ? t('published') : t('draft')}</Badge></div>{studentView && enrollment && <div className="absolute left-2 top-2"><Badge tone={tone}>{t(enrollment as TKey)}</Badge></div>}</div>
    <div className={styles.body}>
      <h3>{course.title}</h3><p className={styles.description}>{course.description || '—'}</p>
      {showTeacher && course.teacher_name && <p className={styles.teacher}><UserRound size={14} />{course.teacher_name}</p>}
      {showTeacher && !studentView && enrollment && <div className={styles.enrollment}><Badge tone={tone}>{t(enrollment as TKey)}</Badge></div>}
      <div className={styles.metadata}><span><BookOpen size={16} />{course.item_count} {t('itemsCount')}</span><span><Users size={16} />{course.student_count} {t('studentsCount')}</span>{groupCount !== undefined && <span><Users size={16} />{groupCount} топ</span>}</div>
      {progress && progress.total_items > 0 && <div className="mb-3 space-y-1.5 text-xs text-muted"><div className="flex items-center justify-between gap-2"><span>Оқу барысы</span><span>{progress.progress}% · {progress.completed_items}/{progress.total_items}</span></div><ProgressBar value={progress.progress} /></div>}
      <div className={`${styles.actions} ${!showGradebook ? styles.singleAction : ''}`}><Button asChild size="sm"><Link href={`/courses/${course.id}`}>{t('viewCourse')}</Link></Button>{showGradebook && <Button asChild variant="secondary" size="sm"><Link href={`/teacher/courses/${course.id}/gradebook`}>{t('gradebook')}</Link></Button>}</div>
    </div>
  </article>
}
