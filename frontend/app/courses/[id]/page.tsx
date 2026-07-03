'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, Lock, MessageSquareText, Sparkles } from 'lucide-react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge, Button, Card, FadeIn, PageHeader } from '../../components/ui'

type Item = {
  id: number
  type: string
  title: string
  position: number
  is_visible: boolean
  sequential_unlock: boolean
  note: string
  locked?: boolean
  completed?: boolean
  score?: number
  max_score?: number | null
  weight_pct?: number
}

type Course = {
  id: number
  title: string
  description: string
  announcement: string
  teacher_name: string
  is_published: boolean
  is_owner: boolean
  enrollment_status?: string | null
  items: Item[] | null
}

function CoursePageContent() {
  const { t } = useI18n()
  const params = useParams()
  const courseId = params.id
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    api(`/courses/${courseId}`)
      .then(setCourse)
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [courseId, t])

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('loading')}</div>
  if (error || !course) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{error || t('errorOccurred')}</div>

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Course overview"
        title={course.title}
        description={course.description}
        actions={course.enrollment_status ? <Badge>{t(course.enrollment_status as keyof typeof t)}</Badge> : null}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Sparkles size={18} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Instructor</p>
              <h2 className="text-xl font-semibold text-slate-950">{course.teacher_name}</h2>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-600">{course.announcement || 'This course is ready for learners to explore at their own pace.'}</p>
          <div className="flex flex-wrap gap-2">
            <Badge>{t('teacher')}: {course.teacher_name}</Badge>
            <Badge>{course.items?.length ?? 0} items</Badge>
          </div>
        </Card>
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><BookOpen size={18} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">What’s inside</p>
              <h2 className="text-xl font-semibold text-slate-950">Structured learning</h2>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-600">Every lesson, quiz, and assignment is organized to support a premium, distraction-free experience.</p>
        </Card>
      </div>

      {course.items ? (
        <div className="grid gap-4">
          {course.items.map((item, index) => (
            <FadeIn key={item.id} transition={{ delay: index * 0.04 }}>
              <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    {item.type === 'quiz' ? <MessageSquareText size={18} /> : item.type === 'homework' ? <BookOpen size={18} /> : <Sparkles size={18} />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                      {item.locked ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">{t('locked')}</Badge> : null}
                      {item.completed ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{t('completed')}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.note || `${t(item.type === 'lesson' ? 'lesson' : item.type === 'quiz' ? 'quiz' : 'homework')} included in this course.`}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {item.max_score !== undefined && item.max_score !== null ? <Badge>{t('maxScore')}: {item.max_score}</Badge> : null}
                  <Button asChild>
                    <Link href={`/items/${item.id}`}>Open item <ArrowRight size={16} /></Link>
                  </Button>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      ) : (
        <Card>{t('noData')}</Card>
      )}
    </div>
  )
}

export default function CoursePage() {
  return (
    <I18nProvider>
      <CoursePageContent />
    </I18nProvider>
  )
}
