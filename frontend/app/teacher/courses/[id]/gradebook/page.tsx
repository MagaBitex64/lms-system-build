'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

type GradeEntry = {
  student_id: number
  student_name: string
  student_email: string
  final_grade: number
  progress: number
  entries: Array<{ item_id: number; title: string; type: string; score: number | null; status: string }>
}

function GradebookPage() {
  const { t } = useI18n()
  const params = useParams()
  const courseId = params.id
  const [gradebook, setGradebook] = useState<GradeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    api(`/grades/gradebook/${courseId}`)
      .then((data) => setGradebook(data as GradeEntry[]))
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [courseId, t])

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{t('gradebook')}</h1>
        {loading ? (
          <div>{t('loading')}</div>
        ) : error ? (
          <div>{error}</div>
        ) : gradebook.length ? (
          <div className="grid" style={{ gap: '1rem' }}>
            {gradebook.map((student) => (
              <div key={student.student_id} className="card">
                <h2>{student.student_name}</h2>
                <p className="text-muted">{student.student_email}</p>
                <p>{t('finalGrade')}: {student.final_grade}</p>
                <p>{t('progress')}: {student.progress}%</p>
                <div style={{ marginTop: '0.75rem' }}>
                  {student.entries.map((entry) => (
                    <div key={entry.item_id} style={{ marginBottom: '0.75rem' }}>
                      <strong>{entry.title}</strong> • {t(entry.type === 'quiz' ? 'quiz' : 'homework')}: {entry.score ?? t('noData')} • {t(entry.status as keyof typeof t)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>{t('noData')}</div>
        )}
      </div>
    </main>
  )
}

export default function GradebookPageWrapper() {
  return (
    <I18nProvider>
      <GradebookPage />
    </I18nProvider>
  )
}
