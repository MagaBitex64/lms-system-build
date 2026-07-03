'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, PlusCircle, Sparkles } from 'lucide-react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { Badge, Button, Card, FadeIn, PageHeader, StatCard } from '../components/ui'

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teacher workspace"
        title={user ? `Welcome back, ${user.full_name}` : t('courseManagement')}
        description="Build engaging learning journeys and keep review cycles calm, fast, and consistent."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="/teacher/courses">Manage courses</Link></Button>
            <Button asChild><Link href="/teacher/courses/new"><span className="flex items-center gap-2"><PlusCircle size={16} />{t('newCourse')}</span></Link></Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Courses" value={String(courses.length)} hint="Owned or managed" icon={<BookOpen size={18} />} />
        <StatCard label="Students" value={String(courses.reduce((sum, course) => sum + course.student_count, 0))} hint="Enrolled across tracks" icon={<Sparkles size={18} />} />
        <StatCard label="Pending" value={String(courses.reduce((sum, course) => sum + (course.pending_count ?? 0), 0))} hint="Needs attention" icon={<PlusCircle size={18} />} />
      </div>
      {loading ? <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('loading')}</div> : error ? <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error}</div> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {courses.map((course, index) => (
            <FadeIn key={course.id} transition={{ delay: index * 0.04 }}>
              <Card className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">{course.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{course.description}</p>
                  </div>
                  <Badge>{course.is_published ? 'Published' : 'Draft'}</Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>{course.item_count} {t('itemsCount')}</span>
                  <span>{course.student_count} {t('studentsCount')}</span>
                  {course.pending_count ? <span>{course.pending_count} pending</span> : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline"><Link href={`/courses/${course.id}`}>{t('viewCourse')}</Link></Button>
                  <Button asChild><Link href={`/teacher/courses/${course.id}/gradebook`}>{t('gradebook')}</Link></Button>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TeacherDashboard() {
  return (
    <I18nProvider>
      <TeacherDashboardContent />
    </I18nProvider>
  )
}
