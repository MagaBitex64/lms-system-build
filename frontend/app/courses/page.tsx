'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Search as SearchIcon, Sparkles, UserRound } from 'lucide-react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge, Button, Card, FadeIn, PageHeader } from '../components/ui'

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Course catalog"
        title={t('catalog')}
        description="Browse the complete course catalog, see who teaches each program, and open any learning journey in seconds."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/search"><span className="flex items-center gap-2"><SearchIcon size={16} />{t('search')}</span></Link>
            </Button>
            <Button asChild>
              <Link href="/profile">{t('profile')}</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('loading')}</div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div>
      ) : courses.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {courses.map((course, index) => (
            <FadeIn key={course.id} transition={{ delay: index * 0.04 }}>
              <Card className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge>{course.enrollment_status ? t(course.enrollment_status as keyof typeof t) : 'Open'}</Badge>
                      <Badge className="border-sky-200 bg-sky-50 text-sky-700">{course.is_published ? 'Published' : 'Draft'}</Badge>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-950">{course.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{course.description}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <BookOpen size={18} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-2"><UserRound size={16} />{course.teacher_name}</span>
                  <span>{course.item_count} {t('itemsCount')}</span>
                  <span>{course.student_count} {t('studentsCount')}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Progress snapshot</p>
                    <p className="text-sm text-slate-500">Built for focused coaching and practical learning.</p>
                  </div>
                  <Button asChild>
                    <Link href={`/courses/${course.id}`}>{t('viewCourse')}</Link>
                  </Button>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('noResults')}</div>
      )}
    </div>
  )
}

export default function CoursesPage() {
  return (
    <I18nProvider>
      <CoursesPageContent />
    </I18nProvider>
  )
}
