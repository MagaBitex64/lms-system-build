'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { fetcher } from '@/lib/api'
import { cx, Avatar, Badge, Button, Card, PageHeader, ProgressBar, Spinner, ErrorState, EmptyState } from '../../../../components/ui'

type GradeEntry = {
  student_id: number
  student_name: string
  student_email: string
  final_grade: number
  progress: number
  entries: Array<{ item_id: number; title: string; type: string; score: number | null; status: string }>
}

const statusTone: Record<string, 'success' | 'warning' | 'neutral'> = {
  graded: 'success',
  submitted: 'warning',
}

function gradeTone(grade: number): 'success' | 'warning' | 'danger' {
  if (grade >= 80) return 'success'
  if (grade >= 50) return 'warning'
  return 'danger'
}

export default function GradebookPage() {
  const { t } = useI18n()
  const params = useParams()
  const courseId = params.id as string
  const [openId, setOpenId] = useState<number | null>(null)
  const { data, error, isLoading } = useSWR<GradeEntry[]>(
    courseId ? `/grades/gradebook/${courseId}` : null,
    fetcher,
  )

  const avg = data?.length ? Math.round(data.reduce((s, r) => s + r.final_grade, 0) / data.length) : 0

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/teacher/courses"><span className="flex items-center gap-1.5"><ArrowLeft size={15} />{t('courseManagement')}</span></Link>
      </Button>

      <PageHeader
        eyebrow={t('gradebook')}
        title={t('gradebook')}
        description={t('analytics')}
        actions={
          data?.length ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2">
              <span className="text-sm text-muted">{t('avgProgress')}</span>
              <Badge tone={gradeTone(avg)}>{avg}%</Badge>
            </div>
          ) : null
        }
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : !data?.length ? (
        <EmptyState icon={<Users size={22} />} title={t('noData')} hint={t('analytics')} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border bg-surface-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid-cols-[2fr_1fr_1fr_auto]">
            <span>{t('student')}</span>
            <span className="hidden sm:block">{t('progress')}</span>
            <span>{t('finalGrade')}</span>
            <span className="sr-only">{t('open')}</span>
          </div>
          <ul className="divide-y divide-border">
            {data.map((row) => {
              const open = openId === row.student_id
              return (
                <li key={row.student_id}>
                  <button
                    onClick={() => setOpenId(open ? null : row.student_id)}
                    className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-muted/40 sm:grid-cols-[2fr_1fr_1fr_auto]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={row.student_name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.student_name}</p>
                        <p className="truncate text-xs text-muted">{row.student_email}</p>
                      </div>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <ProgressBar value={row.progress} className="w-24" />
                      <span className="text-xs text-muted">{row.progress}%</span>
                    </div>
                    <Badge tone={gradeTone(row.final_grade)}>{row.final_grade}</Badge>
                    <ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} />
                  </button>

                  {open && (
                    <div className="space-y-2 bg-surface-muted/30 px-5 py-4">
                      {row.entries.length ? (
                        row.entries.map((entry) => (
                          <div
                            key={entry.item_id}
                            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{entry.title}</p>
                              <p className="text-xs text-muted">{t(entry.type === 'quiz' ? 'quiz' : 'homework')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge tone={statusTone[entry.status] ?? 'neutral'}>
                                {t((entry.status as never)) || entry.status}
                              </Badge>
                              <span className="w-10 text-right text-sm font-semibold text-foreground">
                                {entry.score ?? '—'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="py-2 text-center text-sm text-muted">{t('noData')}</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
