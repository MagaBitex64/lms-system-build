'use client'

import Link from 'next/link'
import useSWR from 'swr'
import {
  BookOpen,
  GraduationCap,
  Users,
  BarChart3,
  ArrowRight,
  PlusCircle,
  Compass,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import {
  Button,
  Card,
  PageHeader,
  StatCard,
  Spinner,
  EmptyState,
  ErrorState,
  FadeIn,
} from '@/components/ui'
import { CourseCard, type CourseSummary } from '@/components/course-card'

type Stat = {
  total_users: number
  total_teachers: number
  total_students: number
  total_courses: number
  active_enrollments: number
  total_groups: number
  completed_courses: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useI18n()

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'

  const catalog = useSWR<{ items: CourseSummary[] }>(isStudent ? '/courses' : null, fetcher)
  const mine = useSWR<CourseSummary[]>(isTeacher || isAdmin ? '/courses/mine' : null, fetcher)
  const stats = useSWR<Stat>(isAdmin ? '/admin/stats' : null, fetcher)

  const firstName = user?.full_name?.split(' ')[0] ?? ''

  if (!user) return <Spinner className="mt-20" />

  /* -------------------------------------------------------------- Student */
  if (isStudent) {
    const items = catalog.data?.items ?? []
    const enrolled = items.filter((c) => c.enrollment_status === 'approved')
    const recent = enrolled.length ? enrolled : items.slice(0, 6)

    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={t('overview')}
          title={`${t('welcomeBack')}, ${firstName}`}
          description={t('continueLearning')}
          actions={
            <Button asChild>
              <Link href="/courses">
                <Compass size={16} />
                {t('browseCatalog')}
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('enrolledCourses')} value={enrolled.length} icon={<BookOpen size={20} />} />
          <StatCard label={t('allCourses')} value={items.length} icon={<Compass size={20} />} tone="success" />
          <StatCard label={t('groups')} value={items.filter((c) => c.enrollment_status === 'approved').length} icon={<Users size={20} />} />
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{enrolled.length ? t('myCourses') : t('recentCourses')}</h2>
            <Link href="/courses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t('seeAll')}
              <ArrowRight size={15} />
            </Link>
          </div>

          {catalog.isLoading ? (
            <Spinner />
          ) : catalog.error ? (
            <ErrorState message={t('errorOccurred')} />
          ) : recent.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recent.map((course, i) => (
                <FadeIn key={course.id} delay={i * 40}>
                  <CourseCard course={course} />
                </FadeIn>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={22} />}
              title={t('noCoursesYet')}
              hint={t('exploreCatalogHint')}
              action={
                <Button asChild variant="secondary">
                  <Link href="/courses">{t('browseCatalog')}</Link>
                </Button>
              }
            />
          )}
        </section>
      </div>
    )
  }

  /* ------------------------------------------------------- Teacher / Admin */
  const courses = mine.data ?? []
  const totalStudents = courses.reduce((s, c) => s + (c.student_count ?? 0), 0)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('overview')}
        title={`${t('welcomeBack')}, ${firstName}`}
        description={t('courseManagement')}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/teacher">
                <GraduationCap size={16} />
                {t('manageCourses')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/teacher/courses/new">
                <PlusCircle size={16} />
                {t('newCourse')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && stats.data ? (
          <>
            <StatCard label={t('totalUsers')} value={stats.data.total_users} icon={<Users size={20} />} />
            <StatCard label={t('totalCourses')} value={stats.data.total_courses} icon={<BookOpen size={20} />} tone="success" />
            <StatCard label={t('activeEnrollments')} value={stats.data.active_enrollments} icon={<GraduationCap size={20} />} />
            <StatCard label={t('groups')} value={stats.data.total_groups} icon={<Users size={20} />} />
          </>
        ) : (
          <>
            <StatCard label={t('createdCourses')} value={courses.length} icon={<BookOpen size={20} />} />
            <StatCard label={t('activeStudents')} value={totalStudents} icon={<Users size={20} />} tone="success" />
            <StatCard label={t('groups')} value={courses.length} icon={<GraduationCap size={20} />} />
          </>
        )}
      </div>

      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickLink href="/admin" icon={<BarChart3 size={18} />} title={t('analytics')} desc={t('statistics')} />
          <QuickLink href="/admin" icon={<UserRound size={18} />} title={t('students')} desc={t('groups')} />
          <QuickLink href="/teacher" icon={<GraduationCap size={18} />} title={t('courseManagement')} desc={t('manageCourses')} />
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('recentCourses')}</h2>
          <Link href="/teacher" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t('seeAll')}
            <ArrowRight size={15} />
          </Link>
        </div>

        {mine.isLoading ? (
          <Spinner />
        ) : mine.error ? (
          <ErrorState message={t('errorOccurred')} />
        ) : courses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.slice(0, 6).map((course, i) => (
              <FadeIn key={course.id} delay={i * 40}>
                <CourseCard course={course} />
              </FadeIn>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={t('noCoursesYet')}
            action={
              <Button asChild>
                <Link href="/teacher/courses/new">
                  <PlusCircle size={16} />
                  {t('newCourse')}
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  )
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="group">
      <Card interactive className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground group-hover:text-primary">{title}</p>
          <p className="truncate text-sm text-muted">{desc}</p>
        </div>
        <ArrowRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Card>
    </Link>
  )
}
