'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'

type TeacherCourse = {
  id: number
  title: string
  description: string
  item_count: number
  student_count: number
  pending_count?: number
  is_published: boolean
}

function TeacherDashboardContent() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api('/courses/mine')
      .then((data) => setCourses(data as TeacherCourse[]))
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [t])

  if (loading) {
    return <main className="container"><div className="card">{t('loading')}</div></main>
  }

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{t('courseManagement')}</h1>
        <p className="text-muted">{t('courseManagement')} / {t('welcomeBack')}</p>
        <div className="grid" style={{ gap: '1rem', marginTop: '1rem' }}>
          <Link href="/teacher/courses/new" className="button">{t('newCourse')}</Link>
          <Link href="/teacher/courses" className="button button-secondary">{t('courses')}</Link>
        </div>
      </div>
      {error ? (
        <div className="card" style={{ marginTop: '1rem' }}>{error}</div>
      ) : (
        <div className="grid" style={{ gap: '1rem', marginTop: '1rem' }}>
          {courses.map((course) => (
            <div key={course.id} className="card">
              <h2>{course.title}</h2>
              <p className="text-muted">{course.description}</p>
              <p className="text-muted">{course.item_count} {t('itemsCount')} • {course.student_count} {t('studentsCount')}</p>
              {typeof course.pending_count !== 'undefined' && course.pending_count > 0 && (
                <div className="badge">{course.pending_count} {t('pendingRequests')}</div>
              )}
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

export default function TeacherDashboard() {
  return (
    <I18nProvider>
      <TeacherDashboardContent />
    </I18nProvider>
  )
}
