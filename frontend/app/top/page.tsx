'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Award, ChevronDown, ClipboardCheck, Trophy, Users } from 'lucide-react'

import { formatDate } from '@/lib/date'
import { fetcher } from '@/lib/api'
import { Button, Card, EmptyState, ErrorState, Field, PageHeader, ProgressBar, Select, Spinner, StatCard, cx } from '@/components/ui'

type SubjectScore = {
  subject: string
  label: string
  score: number
  max_score: number
  percentage: number
}

type RankingItem = {
  rank: number
  attempt_id: number
  student_id: number
  full_name: string
  score: number
  max_score: number
  percentage: number
  attempt_number: number
  attempt_count: number
  submitted_at: string
  variant_title?: string | null
  subjects: SubjectScore[]
}

type RankingGroup = {
  subject?: string
  label: string
  max_score: number
  participant_count: number
  completed_attempt_count: number
  items: RankingItem[]
}

type LeaderboardData = {
  general: RankingGroup
  subjects: RankingGroup[]
  limit: number
}

export default function TopPage() {
  const { data, error, isLoading } = useSWR<LeaderboardData>('/ent-trial/leaderboard', fetcher)
  const [selected, setSelected] = useState('general')
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null)

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  const current = selected === 'general'
    ? data.general
    : data.subjects.find(group => group.subject === selected) ?? data.general
  const isGeneral = selected === 'general'

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <PageHeader
        eyebrow="Рейтинг"
        title="Топ-100"
        description="Әр аяқталған әрекет рейтингте жеке көрсетіледі. Бір оқушы бірнеше рет тапсырса, оның әр нәтижесі бөлек жолмен шығады. Жалпы рейтингке 140 балдық толық ҰБТ, пәндік рейтингке толық ҰБТ мен бір пәндік сынақтар кіреді."
      />

      <Card className="space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="font-bold">Рейтингті таңдаңыз</h2>
          <p className="text-xs text-muted">Жақша ішінде осы рейтингке қатысқан оқушылар саны көрсетілген.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-label="Рейтинг санаты">
          <Button type="button" aria-pressed={isGeneral} variant={isGeneral ? 'primary' : 'secondary'} onClick={() => { setSelected('general'); setExpandedAttemptId(null) }}>
            Жалпы ҰБТ · 140 балл ({data.general.participant_count})
          </Button>
          <Field label="Пән">
            <Select value={isGeneral ? '' : selected} onChange={event => { setSelected(event.target.value || 'general'); setExpandedAttemptId(null) }} className="sm:w-72">
              <option value="">Пәнді таңдаңыз</option>
              {data.subjects.map(group => <option key={group.subject} value={group.subject}>{group.label} ({group.participant_count})</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Қатысушылар" value={current.participant_count} hint="Бірегей оқушылар" icon={<Users size={20} />} />
        <StatCard label="Тапсырылған тесттер" value={current.completed_attempt_count} hint="Барлық аяқталған әрекет" icon={<ClipboardCheck size={20} />} tone="success" />
        <StatCard label="Максималды ұпай" value={current.max_score} hint={isGeneral ? 'Толық ҰБТ форматы' : current.label} icon={<Award size={20} />} tone="warning" />
      </div>

      <section className="space-y-4" aria-labelledby="ranking-title">
        <div>
          <h2 id="ranking-title" className="text-xl font-bold">{current.label}</h2>
          <p className="text-sm text-muted">Ең жоғары ұпай бойынша сұрыпталған алғашқы {data.limit} аяқталған әрекет.</p>
        </div>

        {current.items.length === 0 ? (
          <EmptyState
            icon={<Trophy size={36} />}
            title="Бұл рейтингте әзірге қатысушылар жоқ"
            hint={isGeneral ? '140 балдық толық ҰБТ тапсырылғаннан кейін нәтиже осында шығады.' : 'Осы пән бойынша аяқталған нәтиже әлі жоқ.'}
          />
        ) : (
          <div className="space-y-2">
            {current.items.map(item => {
              const expanded = expandedAttemptId === item.attempt_id
              const detailsId = `ranking-details-${item.attempt_id}`
              return (
                <Card
                  key={item.attempt_id}
                  className={cx('overflow-hidden p-0', item.rank <= 3 && 'border-primary/30 bg-primary-soft/20')}
                >
                  <button
                    type="button"
                    className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto_24px] items-center gap-3 p-4 text-left transition-colors hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:grid-cols-[56px_minmax(0,1fr)_auto_28px] sm:gap-4"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    onClick={() => setExpandedAttemptId(expanded ? null : item.attempt_id)}
                  >
                    <span className={cx(
                      'flex size-11 items-center justify-center rounded-xl text-lg font-black',
                      item.rank === 1 ? 'bg-warning text-white' : item.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted',
                    )}>
                      {item.rank}
                    </span>

                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-bold">{item.full_name}</span>
                        {item.rank <= 3 && <Trophy size={15} className={item.rank === 1 ? 'shrink-0 text-warning' : 'shrink-0 text-primary'} />}
                      </span>
                      <span className="block truncate text-xs text-muted">{item.variant_title || (isGeneral ? 'Толық ҰБТ' : current.label)}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {item.attempt_number}-әрекет · барлығы {item.attempt_count} рет тапсырды · {formatDate(item.submitted_at)}
                      </span>
                    </span>

                    <span className="text-right">
                      <span className="block whitespace-nowrap text-lg font-black text-primary sm:text-xl">{item.score} / {item.max_score}</span>
                      <span className="block text-xs font-semibold text-muted">{Number(item.percentage).toFixed(2)}%</span>
                    </span>
                    <ChevronDown size={20} className={cx('text-muted transition-transform', expanded && 'rotate-180 text-primary')} />
                  </button>

                  {expanded && (
                    <div id={detailsId} className="border-t border-border bg-surface-muted/40 px-4 py-4 sm:px-5">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold">Пәндер бойынша нәтиже</h3>
                          <p className="text-xs text-muted">Әр бөлімде жиналған ұпай және максималды ұпай көрсетілген.</p>
                        </div>
                        <p className="text-sm font-bold text-primary">Жалпы: {item.score} / {item.max_score}</p>
                      </div>
                      {item.subjects?.length ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {item.subjects.map(part => (
                            <div key={part.subject} className="rounded-xl border border-border bg-surface p-3 shadow-xs">
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold leading-snug">{part.label}</p>
                                <p className="shrink-0 text-sm font-black text-primary">{part.score} / {part.max_score}</p>
                              </div>
                              <ProgressBar value={part.percentage} />
                              <p className="mt-1.5 text-right text-xs font-medium text-muted">{Number(part.percentage).toFixed(2)}%</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
                          Бұл әрекет үшін пәндер бойынша мәлімет сақталмаған.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
