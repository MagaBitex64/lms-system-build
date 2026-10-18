'use client'

import useSWR from 'swr'
import { useAuth } from '@/lib/auth'
import { fetcher } from '@/lib/api'
import { Spinner } from '@/components/ui'
import type { ListingCourse } from '@/components/course-listing'
import { AdminDashboardHome } from './admin-home'
import StudentHome from './student-home'
import TeacherHome from './teacher-home'

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

  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'

  const mine = useSWR<ListingCourse[]>(isTeacher || isAdmin ? '/courses/mine' : null, fetcher)
  const stats = useSWR<Stat>(isAdmin ? '/admin/stats' : null, fetcher)

  const firstName = user?.full_name?.split(' ')[0] ?? ''

  if (!user) return <Spinner className="mt-20" />

  if (isAdmin) return <AdminDashboardHome
    firstName={firstName}
    stats={stats.data}
    statsLoading={stats.isLoading}
    statsError={Boolean(stats.error)}
    courses={mine.data ?? []}
    coursesLoading={mine.isLoading}
    coursesError={Boolean(mine.error)}
  />

  /* -------------------------------------------------------------- Student */
  if (isStudent) return <StudentHome firstName={firstName} />

  return <TeacherHome firstName={firstName} courses={mine.data} loading={mine.isLoading} error={Boolean(mine.error)} />
}
