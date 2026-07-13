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
  LayoutDashboard,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import {
  Button,
  Card,
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
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary-soft via-primary-extra-light to-surface rounded-3xl border border-primary/10 p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {t('welcomeBack')}, {firstName}!
              </h1>
              <p className="text-base md:text-lg text-muted max-w-lg">
                {t('continueLearning')}. Өтіңіз немесе жаңа материалды ашыңыз.
              </p>
            </div>
            <Button asChild size="lg" className="w-fit">
              <Link href="/courses">
                <Compass size={18} />
                {t('browseCatalog')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('enrolledCourses')} value={enrolled.length} icon={<BookOpen size={20} />} />
          <StatCard label={t('allCourses')} value={items.length} icon={<Compass size={20} />} tone="success" />
          <StatCard label={t('completedCourses')} value={0} icon={<GraduationCap size={20} />} tone="primary" />
        </div>

        {/* Courses Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{enrolled.length ? t('myCourses') : t('recentCourses')}</h2>
              <p className="text-sm text-muted mt-1">{recent.length} {recent.length === 1 ? 'курс' : 'курстар'}</p>
            </div>
            {enrolled.length > 6 && (
              <Link href="/courses" className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-medium transition-colors">
                {t('seeAll')}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>

          {catalog.isLoading ? (
            <Spinner />
          ) : catalog.error ? (
            <ErrorState message={t('errorOccurred')} />
          ) : recent.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((course, i) => (
                <FadeIn key={course.id} delay={i * 50}>
                  <CourseCard course={course} />
                </FadeIn>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={24} />}
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-soft via-primary-extra-light to-surface rounded-3xl border border-primary/10 p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {t('welcomeBack')}, {firstName}!
            </h1>
            <p className="text-base md:text-lg text-muted max-w-lg">
              Курстарыңызды басқарыңыз, оқушыларыңызды қадағалаңыз және оқу материалдарын ұйымдастырыңыз.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-fit">
            <Button asChild variant="secondary" size="lg">
              <Link href="/teacher">
                <GraduationCap size={18} />
                {t('manageCourses')}
              </Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/teacher/courses/new">
                <PlusCircle size={18} />
                {t('newCourse')}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">{t('statistics')}</h2>
          <p className="text-sm text-muted">Сіздің платформасының түлік көрсеткіші</p>
        </div>
        
        {isAdmin && stats.data ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('totalUsers')} value={stats.data.total_users} icon={<Users size={20} />} />
            <StatCard label={t('totalCourses')} value={stats.data.total_courses} icon={<BookOpen size={20} />} tone="success" />
            <StatCard label={t('activeEnrollments')} value={stats.data.active_enrollments} icon={<LayoutDashboard size={20} />} tone="warning" />
            <StatCard label={t('groups')} value={stats.data.total_groups} icon={<Users size={20} />} tone="primary" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            <StatCard label={t('createdCourses')} value={courses.length} icon={<BookOpen size={20} />} />
            <StatCard label={t('activeStudents')} value={totalStudents} icon={<Users size={20} />} tone="success" />
            <StatCard label={t('totalGroups')} value={courses.length} icon={<GraduationCap size={20} />} tone="primary" />
          </div>
        )}
      </section>

      {/* Quick Actions for Admin */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Түйінді шолу</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <QuickLink href="/admin" icon={<BarChart3 size={20} />} title={t('statistics')} desc="Барлық метрикалар және есептеулер" />
            <QuickLink href="/admin/users" icon={<Users size={20} />} title={t('users')} desc="Пайдаланушыларды басқару" />
            <QuickLink href="/teacher" icon={<GraduationCap size={20} />} title={t('myCourses')} desc="Курстарды ауытқылау" />
          </div>
        </section>
      )}

      {/* Courses Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('recentCourses')}</h2>
            <p className="text-sm text-muted mt-1">{courses.length} {courses.length === 1 ? 'курс' : 'курстар'}</p>
          </div>
          {courses.length > 6 && (
            <Link href="/teacher" className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-medium transition-colors">
              {t('seeAll')}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>

        {mine.isLoading ? (
          <Spinner />
        ) : mine.error ? (
          <ErrorState message={t('errorOccurred')} />
        ) : courses.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((course, i) => (
              <FadeIn key={course.id} delay={i * 50}>
                <CourseCard course={course} />
              </FadeIn>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen size={24} />}
            title={t('noCoursesYet')}
            action={
              <Button asChild>
                <Link href="/teacher/courses/new">
                  <PlusCircle size={18} />
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

function QuickLink({ 
  href, 
  icon, 
  title, 
  desc 
}: { 
  href: string
  icon: React.ReactNode
  title: string
  desc: string 
}) {
  return (
    <Link href={href} className="group">
      <Card interactive className="flex items-center gap-4 p-6">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary group-hover:text-primary-hover transition-colors">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{title}</p>
          <p className="truncate text-sm text-muted">{desc}</p>
        </div>
        <ArrowRight size={18} className="flex-shrink-0 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </Card>
    </Link>
  )
}
