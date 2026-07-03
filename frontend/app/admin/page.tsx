'use client'

import type { ReactNode } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Users, GraduationCap, BookOpen, UserCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import { Button, Card, FadeIn, PageHeader, StatCard, Spinner, ErrorState, EmptyState, ProgressBar } from '../components/ui'

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

type PendingEnrollment = {
  id: number
  requested_at: string
  course_title: string
  student_name: string
  student_email: string
}

export default function AdminDashboard() {
  const { t } = useI18n()
  const { data: stats, error, isLoading } = useSWR<Stat>('/admin/stats', fetcher)
  const pending = useSWR<{ items: PendingEnrollment[] }>('/enrollments/pending?per_page=50', fetcher)

  if (isLoading) return <Spinner />
  if (error) return <ErrorState message={(error as Error).message || t('errorOccurred')} />
  if (!stats) return <EmptyState title={t('noData')} />

  const cards = [
    { label: t('totalUsers'), value: stats.total_users, icon: <Users size={18} />, tone: 'primary' as const },
    { label: t('totalTeachers'), value: stats.total_teachers, icon: <GraduationCap size={18} />, tone: 'primary' as const },
    { label: t('totalStudents'), value: stats.total_students, icon: <UserCheck size={18} />, tone: 'success' as const },
    { label: t('totalCourses'), value: stats.total_courses, icon: <BookOpen size={18} />, tone: 'primary' as const },
    { label: t('activeEnrollments'), value: stats.active_enrollments, icon: <UserCheck size={18} />, tone: 'success' as const },
    { label: t('pendingRequests'), value: stats.pending_enrollments, icon: <Clock size={18} />, tone: 'warning' as const },
    { label: t('completedCourses'), value: stats.completed_courses, icon: <CheckCircle2 size={18} />, tone: 'success' as const },
  ]

  const maxStudents = Math.max(1, ...stats.students_per_course.map((c) => c.students))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('admin')}
        title={t('statistics')}
        description={t('analytics')}
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/users"><span className="flex items-center gap-2"><Users size={16} />{t('users')}</span></Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <FadeIn key={c.label} delay={i * 30}>
            <StatCard label={c.label} value={c.value} icon={c.icon} tone={c.tone} />
          </FadeIn>
        ))}
      </div>

      <PendingEnrollments items={pending.data?.items ?? []} loading={pending.isLoading} error={pending.error} refresh={pending.mutate} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('studentsPerCourse')}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users"><span className="flex items-center gap-1">{t('users')}<ArrowRight size={14} /></span></Link>
        </Button>
      </div>

      {stats.students_per_course.length ? (
        <Card className="space-y-4">
          {stats.students_per_course.map((course) => (
            <div key={course.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate font-medium text-foreground">{course.title}</span>
                <span className="shrink-0 text-muted">{course.students}</span>
              </div>
              <ProgressBar value={(course.students / maxStudents) * 100} />
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<BookOpen size={22} />} title={t('noData')} />
      )}
    </div>
  )
}

function PendingEnrollments({
  items,
  loading,
  error,
  refresh,
}: {
  items: PendingEnrollment[]
  loading: boolean
  error: unknown
  refresh: () => Promise<unknown>
}) {
  const { t } = useI18n()

  async function decide(id: number, status: 'approved' | 'rejected') {
    await api(`/enrollments/${id}/decide`, { body: { status } })
    await refresh()
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('enrollmentRequests')}</h2>
        </div>
        <BadgeLike>{items.length}</BadgeLike>
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.student_name}</p>
                <p className="truncate text-xs text-muted">{item.student_email}</p>
                <p className="truncate text-xs text-muted">{item.course_title}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" onClick={() => decide(item.id, 'approved')}>{t('approve')}</Button>
                <Button size="sm" variant="outline" onClick={() => decide(item.id, 'rejected')}>{t('reject')}</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-3 text-sm text-muted">{t('noData')}</p>
      )}
    </Card>
  )
}

function BadgeLike({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">{children}</span>
}
