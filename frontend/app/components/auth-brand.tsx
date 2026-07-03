'use client'

import { GraduationCap, BookOpen, BarChart3, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function AuthBrand() {
  const { t } = useI18n()

  const features = [
    { icon: <BookOpen size={18} />, title: t('catalog'), text: t('exploreCatalogHint') },
    { icon: <GraduationCap size={18} />, title: t('myLearning'), text: t('continueLearning') },
    { icon: <BarChart3 size={18} />, title: t('analytics'), text: t('studentsPerCourse') },
  ]

  return (
    <div className="relative hidden overflow-hidden rounded-3xl bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #2563eb 0, transparent 40%), radial-gradient(circle at 80% 80%, #2563eb 0, transparent 35%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Fenomen School</p>
            <p className="text-sm text-sidebar-muted">Learning Platform</p>
          </div>
        </div>
        <h2 className="mt-10 max-w-sm text-3xl font-bold leading-tight text-balance text-white">
          Everything you need to teach and learn, in one place.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-sidebar-muted">
          Structured courses, quizzes, assignments, and grading — designed for a focused, premium learning experience.
        </p>
      </div>

      <div className="relative mt-10 space-y-4">
        {features.map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-hover text-primary-foreground">
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{f.title}</p>
              <p className="text-xs leading-relaxed text-sidebar-muted">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-10 flex items-center gap-2 text-xs text-sidebar-muted">
        <CheckCircle2 size={14} className="text-primary" />
        Trusted by students and educators
      </div>
    </div>
  )
}
