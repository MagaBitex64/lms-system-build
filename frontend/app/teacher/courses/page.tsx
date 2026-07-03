'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { BookOpen, PlusCircle, Users, Clock } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import { Badge, Button, Card, FadeIn, PageHeader, Spinner, ErrorState, EmptyState } from '../../components/ui'

type CourseSummary = {
  id: number
  title: string
  description: string
  item_count: number
  student_count: number
  pending_count?: number
  is_published: boolean
}

export default function TeacherCoursesPage() {
  const { t } = useI18n()
  const { data: courses, error, isLoading } = useSWR<CourseSummary[]>('/courses/mine', fetcher)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('teacher')}
        title={t('courseManagement')}
        description={t('manageCourses')}
        actions={
          <Button asChild>
            <Link href="/teacher/courses/new">
              <span className="flex items-center gap-2"><PlusCircle size={16} />{t('newCourse')}</span>
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : !courses?.length ? (
        <EmptyState
          icon={<BookOpen size={22} />}
          title={t('noCoursesYet')}
          hint={t('manageCourses')}
          action={<Button asChild><Link href="/teacher/courses/new">{t('newCourse')}</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, i) => (
            <FadeIn key={course.id} delay={i * 40}>
              <Card interactive className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <BookOpen size={18} />
                  </div>
                  <Badge tone={course.is_published ? 'success' : 'neutral'}>
                    {course.is_published ? t('published') : t('draft')}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-foreground">{course.title}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted">{course.description}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5"><BookOpen size={14} />{course.item_count}</span>
                  <span className="flex items-center gap-1.5"><Users size={14} />{course.student_count}</span>
                  {course.pending_count ? (
                    <span className="flex items-center gap-1.5 text-warning"><Clock size={14} />{course.pending_count}</span>
                  ) : null}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm"><Link href={`/courses/${course.id}`}>{t('viewCourse')}</Link></Button>
                  <Button asChild size="sm"><Link href={`/teacher/courses/${course.id}/gradebook`}>{t('gradebook')}</Link></Button>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  )
}
