'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

type Item = {
  id: number
  type: string
  title: string
  position: number
  is_visible: boolean
  sequential_unlock: boolean
  note: string
  locked?: boolean
  completed?: boolean
  score?: number
  max_score?: number | null
  weight_pct?: number
}

type Course = {
  id: number
  title: string
  description: string
  announcement: string
  teacher_name: string
  is_published: boolean
  is_owner: boolean
  enrollment_status?: string | null
  items: Item[] | null
}

function CoursePageContent() {
  const { t } = useI18n()
  const params = useParams()
  const courseId = params.id
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    api(`/courses/${courseId}`)
      .then(setCourse)
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [courseId, t])

  if (loading) {
    return <main className="container"><div className="card">{t('loading')}</div></main>
  }

  if (error || !course) {
    return <main className="container"><div className="card">{error || t('errorOccurred')}</div></main>
  }

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{course.title}</h1>
        <p className="text-muted">{course.description}</p>
        <p>{course.announcement}</p>
        <p className="text-muted">{t('teacher')}: {course.teacher_name}</p>
        {course.enrollment_status && <div className="badge">{t(course.enrollment_status as keyof typeof t)}</div>}
      </div>
      {course.items ? (
        <div className="grid" style={{ gap: '1rem', marginTop: '1rem' }}>
          {course.items.map((item) => (
            <div key={item.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <h2>{item.title}</h2>
                  <p className="text-muted">{t(item.type === 'lesson' ? 'lesson' : item.type === 'quiz' ? 'quiz' : 'homework')}</p>
                  {item.note && <p>{item.note}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {item.locked && <span className="badge">{t('locked')}</span>}
                  {item.completed && <span className="badge">{t('completed')}</span>}
                </div>
              </div>
              <div className="grid" style={{ gap: '0.75rem', marginTop: '0.75rem' }}>
                <Link href={`/items/${item.id}`} className="button">{t('viewCourse')}</Link>
                {item.max_score !== undefined && item.max_score !== null && (
                  <div>{t('maxScore')}: {item.max_score}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ marginTop: '1rem' }}>
          <p className="text-muted">{t('noData')}</p>
        </div>
      )}
    </main>
  )
}

export default function CoursePage() {
  return (
    <I18nProvider>
      <CoursePageContent />
    </I18nProvider>
  )
}
