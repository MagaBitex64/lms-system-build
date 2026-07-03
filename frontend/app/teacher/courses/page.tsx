'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

type CourseSummary = {
  id: number
  title: string
  description: string
  item_count: number
  student_count: number
  pending_count?: number
  is_published: boolean
}

function TeacherCoursesPage() {
  const { t } = useI18n()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api('/courses/mine')
      .then((data) => setCourses(data as CourseSummary[]))
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{t('courseManagement')}</h1>
        <Link href="/teacher/courses/new" className="button" style={{ marginTop: '1rem' }}>
          {t('newCourse')}
        </Link>
      </div>
      {loading ? (
        <div className="card">{t('loading')}</div>
      ) : error ? (
        <div className="card">{error}</div>
      ) : (
        <div className="grid" style={{ gap: '1rem', marginTop: '1rem' }}>
          {courses.map((course) => (
            <div key={course.id} className="card">
              <h2>{course.title}</h2>
              <p className="text-muted">{course.description}</p>
              <p className="text-muted">{course.item_count} {t('itemsCount')} • {course.student_count} {t('studentsCount')}</p>
              <div className="grid" style={{ gap: '0.75rem', marginTop: '1rem' }}>
                <Link href={`/courses/${course.id}`} className="button button-secondary">{t('viewCourse')}</Link>
                <Link href={`/teacher/courses/${course.id}/gradebook`} className="button">{t('gradebook')}</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default function TeacherCoursesPageWrapper() {
  return (
    <I18nProvider>
      <TeacherCoursesPage />
    </I18nProvider>
  )
}
