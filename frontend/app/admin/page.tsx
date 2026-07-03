'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

type Stat = {
  total_users: number
  total_teachers: number
  total_students: number
  total_guests: number
  total_courses: number
  active_enrollments: number
  pending_enrollments: number
  completed_courses: number
  students_per_course: Array<{ id: number; title: string; students: number }>
}

function AdminDashboardContent() {
  const { t } = useI18n()
  const [stats, setStats] = useState<Stat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/admin/stats')
      .then(setStats)
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{t('statistics')}</h1>
        {loading ? (
          <div>{t('loading')}</div>
        ) : error ? (
          <div>{error}</div>
        ) : stats ? (
          <div className="grid" style={{ gap: '1rem' }}>
            <div className="card">
              <p>{t('totalUsers')}: {stats.total_users}</p>
              <p>{t('totalTeachers')}: {stats.total_teachers}</p>
              <p>{t('totalStudents')}: {stats.total_students}</p>
            </div>
            <div className="card">
              <p>{t('totalCourses')}: {stats.total_courses}</p>
              <p>{t('activeEnrollments')}: {stats.active_enrollments}</p>
              <p>{t('pendingRequests')}: {stats.pending_enrollments}</p>
            </div>
            <div className="card">
              <p>{t('completedCourses')}: {stats.completed_courses}</p>
            </div>
            <div className="card">
              <h2 className="section-title">{t('studentsPerCourse')}</h2>
              <ul>
                {stats.students_per_course.map((course) => (
                  <li key={course.id}>
                    {course.title}: {course.students}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 className="section-title">{t('users')}</h2>
        <Link href="/admin/users" className="button">{t('users')}</Link>
      </div>
    </main>
  )
}

export default function AdminDashboardPage() {
  return (
    <I18nProvider>
      <AdminDashboardContent />
    </I18nProvider>
  )
}
