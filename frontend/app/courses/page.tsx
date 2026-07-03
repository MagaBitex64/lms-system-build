'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'

type Course = {
  id: number
  title: string
  description: string
  teacher_name: string
  item_count: number
  student_count: number
  is_published: boolean
  enrollment_status?: string | null
}

function CoursesPageContent() {
  const { t } = useI18n()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api('/courses')
      .then((data) => setCourses((data as any).items as Course[]))
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <main className="container">
      <section className="page-hero page-hero-compact">
        <div>
          <span className="eyebrow">Fenomen School</span>
          <h1 className="page-title">{t('catalog')}</h1>
          <p className="hero-lead">
            Все курсы школы: материалы, уроки, домашние задания и оценки в удобном каталоге.
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/search" className="button button-secondary">
            {t('search')}
          </Link>
          <Link href="/profile" className="button button-primary">
            {t('profile')}
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="page-loading">
          <div className="loading-panel card">{t('loading')}</div>
        </div>
      ) : error ? (
        <div className="page-loading">
          <div className="loading-panel card">{error}</div>
        </div>
      ) : courses.length ? (
        <div className="course-grid">
          {courses.map((course) => (
            <article key={course.id} className="course-card card">
              <div className="course-card-header">
                <div>
                  <h2>{course.title}</h2>
                  <p className="text-muted course-description">{course.description}</p>
                </div>
                {course.enrollment_status ? (
                  <span className="status-pill course-status">{t(course.enrollment_status as keyof typeof t)}</span>
                ) : null}
              </div>

              <div className="course-meta">
                <span>{course.teacher_name}</span>
                <span>{course.item_count} {t('itemsCount')}</span>
                <span>{course.student_count} {t('studentsCount')}</span>
              </div>

              <div className="course-footer-row">
                <div className="course-progress-bar">
                  <span>56%</span>
                  <div className="progress-shell">
                    <div className="progress-fill" />
                  </div>
                </div>
                <Link href={`/courses/${course.id}`} className="button button-small button-primary">
                  {t('viewCourse')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="page-loading">
          <div className="loading-panel card">{t('noResults')}</div>
        </div>
      )}
    </main>
  )
}

export default function CoursesPage() {
  return <CoursesPageContent />
}
