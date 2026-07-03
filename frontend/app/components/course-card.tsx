'use client'

import Link from 'next/link'
import { BookOpen, Users, UserRound, ArrowRight } from 'lucide-react'
import { useI18n, type TKey } from '@/lib/i18n'
import { Badge, Button } from './ui'

export type CourseSummary = {
  id: number
  title: string
  description: string
  teacher_name?: string
  item_count: number
  student_count: number
  is_published: boolean
  enrollment_status?: string | null
}

const ENROLLMENT_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

export function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useI18n()
  const status = course.enrollment_status ?? undefined

  return (
    <Link href={`/courses/${course.id}`} className="group block">
      <div className="flex h-full flex-col rounded-2xl border border-border bg-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpen size={20} />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {status && (
              <Badge tone={ENROLLMENT_TONE[status] ?? 'neutral'}>{t(status as TKey)}</Badge>
            )}
            <Badge tone={course.is_published ? 'primary' : 'neutral'}>
              {course.is_published ? t('published') : t('draft')}
            </Badge>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground text-pretty group-hover:text-primary">
              {course.title}
            </h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted">
              {course.description || '—'}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            {course.teacher_name && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={14} />
                {course.teacher_name}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={14} />
              {course.item_count} {t('itemsCount')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />
              {course.student_count} {t('studentsCount')}
            </span>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-primary hover:bg-primary-soft"
            asChild
          >
            <span>
              {t('viewCourse')}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Button>
        </div>
      </div>
    </Link>
  )
}
