'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Award, ClipboardCheck, Trophy, Users } from 'lucide-react'

import { formatDate } from '@/lib/date'
import { fetcher } from '@/lib/api'
import { Button, Card, EmptyState, ErrorState, Field, PageHeader, Select, Spinner, StatCard, cx } from '@/components/ui'

type RankingItem = {
  rank: number
  attempt_id: number
  student_id: number
  full_name: string
  score: number
  max_score: number
  percentage: number
  attempt_count: number
  submitted_at: string
  variant_title?: string | null
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
        description="Әр оқушының ең жақсы нәтижесі есепке алынады. Жалпы рейтингке тек 140 балдық толық ҰБТ, пәндік рейтингке толық ҰБТ мен бір пәндік сынақтардың нәтижелері кіреді."
      />

      <Card className="space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="font-bold">Рейтингті таңдаңыз</h2>
          <p className="text-xs text-muted">Жақша ішінде осы рейтингке қатысқан оқушылар саны көрсетілген.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-label="Рейтинг санаты">
          <Button type="button" aria-pressed={isGeneral} variant={isGeneral ? 'primary' : 'secondary'} onClick={() => setSelected('general')}>
            Жалпы ҰБТ · 140 балл ({data.general.participant_count})
          </Button>
          <Field label="Пән">
            <Select value={isGeneral ? '' : selected} onChange={event => setSelected(event.target.value || 'general')} className="sm:w-72">
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
          <p className="text-sm text-muted">Ең жоғары ұпай бойынша сұрыпталған алғашқы {data.limit} оқушы.</p>
        </div>

        {current.items.length === 0 ? (
          <EmptyState
            icon={<Trophy size={36} />}
            title="Бұл рейтингте әзірге қатысушылар жоқ"
            hint={isGeneral ? '140 балдық толық ҰБТ тапсырылғаннан кейін нәтиже осында шығады.' : 'Осы пән бойынша аяқталған нәтиже әлі жоқ.'}
          />
        ) : (
          <div className="space-y-2">
            {current.items.map(item => (
              <Card
                key={item.student_id}
                className={cx(
                  'grid items-center gap-3 p-4 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:gap-4',
                  item.rank <= 3 && 'border-primary/30 bg-primary-soft/20',
                )}
              >
                <div className={cx(
                  'flex size-11 items-center justify-center rounded-xl text-lg font-black',
                  item.rank === 1 ? 'bg-warning text-white' : item.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted',
                )}>
                  {item.rank}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{item.full_name}</p>
                    {item.rank <= 3 && <Trophy size={15} className={item.rank === 1 ? 'shrink-0 text-warning' : 'shrink-0 text-primary'} />}
                  </div>
                  <p className="truncate text-xs text-muted">{item.variant_title || (isGeneral ? 'Толық ҰБТ' : current.label)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.attempt_count} аяқталған әрекет · {formatDate(item.submitted_at)}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xl font-black text-primary">{item.score} / {item.max_score}</p>
                  <p className="text-xs font-semibold text-muted">{Number(item.percentage).toFixed(2)}%</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
