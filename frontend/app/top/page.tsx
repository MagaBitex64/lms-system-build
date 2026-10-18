'use client'

import { Fragment, useState } from 'react'
import useSWR from 'swr'
import { Award, ChevronDown, ClipboardCheck, Trophy, Users } from 'lucide-react'

import { formatDate } from '@/lib/date'
import { fetcher } from '@/lib/api'
import { Button, EmptyState, ErrorState, Field, ProgressBar, Select, Spinner, cx } from '@/components/ui'
import styles from './top.module.css'

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
    <div className={styles.page}>
      <header className={styles.banner}>
        <div><p className={styles.eyebrow}>РЕЙТИНГ</p><h1>Топ-100</h1><p className={styles.explanation}>Әр аяқталған әрекет рейтингте жеке көрсетіледі. Бір оқушы бірнеше рет тапсырса, оның әр нәтижесі бөлек жолмен шығады. Жалпы рейтингке 140 балдық толық ҰБТ, пәндік рейтингке толық ҰБТ мен бір пәндік сынақтар кіреді.</p></div>
        <TrophyArt />
      </header>

      <div className={styles.filterPanel}>
        <div>
          <h2>Рейтингті таңдаңыз</h2>
          <p>Жақша ішінде осы рейтингке қатысқан оқушылар саны көрсетілген.</p>
        </div>
        <div className={styles.filterControls} aria-label="Рейтинг санаты">
          <Button type="button" aria-pressed={isGeneral} className={styles.general} variant={isGeneral ? 'primary' : 'secondary'} onClick={() => { setSelected('general'); setExpandedAttemptId(null) }}>
            Жалпы ҰБТ · 140 балл ({data.general.participant_count})
          </Button>
          <Field label="Пән">
            <Select value={isGeneral ? '' : selected} onChange={event => { setSelected(event.target.value || 'general'); setExpandedAttemptId(null) }}>
              <option value="">Пәнді таңдаңыз</option>
              {data.subjects.map(group => <option key={group.subject} value={group.subject}>{group.label} ({group.participant_count})</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <div className={styles.kpis}>
        {[
          { label: 'Қатысушылар', value: current.participant_count, hint: 'Бірегей оқушылар', Icon: Users },
          { label: 'Тапсырылған тесттер', value: current.completed_attempt_count, hint: 'Барлық аяқталған әрекет', Icon: ClipboardCheck },
          { label: 'Максималды ұпай', value: current.max_score, hint: isGeneral ? 'Толық ҰБТ форматы' : current.label, Icon: Award },
        ].map(({ label, value, hint, Icon }, index) => <div className={styles.kpi} key={label}><span className={cx(styles.kpiIcon, styles[`tone${index}`])}><Icon size={24} /></span><div><p>{label}</p><strong>{value}</strong><small>{hint}</small></div></div>)}
      </div>

      <section className={styles.leaderboard} aria-labelledby="ranking-title">
        <div className={styles.listHeading}>
          <h2 id="ranking-title">{current.label}</h2>
          <p>Ең жоғары ұпай бойынша сұрыпталған алғашқы {data.limit} аяқталған әрекет.</p>
        </div>

        {current.items.length === 0 ? (
          <EmptyState
            icon={<Trophy size={36} />}
            title="Бұл рейтингте әзірге қатысушылар жоқ"
            hint={isGeneral ? '140 балдық толық ҰБТ тапсырылғаннан кейін нәтиже осында шығады.' : 'Осы пән бойынша аяқталған нәтиже әлі жоқ.'}
          />
        ) : (
          <div>
            <p className={styles.scrollHint}>Кестені көлденең жылжытып, барлық бағанды көре аласыз.</p>
            <div className={styles.tableWrap} role="region" aria-label="Рейтинг кестесі" tabIndex={0}>
            <table className={styles.table}>
            <caption className="sr-only">{current.label} — аяқталған әрекеттер рейтингі</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Оқушы</th><th scope="col">Сынақ атауы</th><th scope="col">Әрекеттер</th><th scope="col">Күні және уақыты</th><th scope="col">Нәтиже</th><th scope="col"><span className="sr-only">Мәліметтер</span></th></tr></thead>
            <tbody>
            {current.items.map(item => {
              const expanded = expandedAttemptId === item.attempt_id
              const detailsId = `ranking-details-${item.attempt_id}`
              return (
                <Fragment key={item.attempt_id}>
                  <tr className={cx(styles.row, expanded && styles.expandedRow)} onClick={() => setExpandedAttemptId(expanded ? null : item.attempt_id)}>
                    <td><span className={cx(styles.rank, item.rank === 1 && styles.gold, item.rank > 1 && item.rank <= 3 && styles.topRank)}>{item.rank}</span></td>
                    <td><span className={styles.student}>{item.full_name}{item.rank <= 3 && <Trophy size={15} aria-hidden="true" className={item.rank === 1 ? styles.goldIcon : styles.tealIcon} />}</span></td>
                    <td className={styles.exam}>{item.variant_title || (isGeneral ? 'Толық ҰБТ' : current.label)}</td>
                    <td className={styles.attempts}>{item.attempt_number}-әрекет · барлығы {item.attempt_count} рет тапсырды</td>
                    <td className={styles.date}>{formatDate(item.submitted_at)}</td>
                    <td className={styles.score}><strong>{item.score} / {item.max_score}</strong><small>{Number(item.percentage).toFixed(2)}%</small></td>
                    <td><button type="button" className={styles.expandButton} aria-label={`${item.full_name}, ${item.attempt_number}-әрекет: мәліметтер`} aria-expanded={expanded} aria-controls={detailsId} onClick={event => { event.stopPropagation(); setExpandedAttemptId(expanded ? null : item.attempt_id) }}><ChevronDown size={19} className={expanded ? styles.chevronOpen : undefined} /></button></td>
                  </tr>

                  {expanded && (
                    <tr className={styles.details}><td colSpan={7}><div id={detailsId} className={styles.detailsContent}>
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
                    </div></td></tr>
                  )}
                </Fragment>
              )
            })}
            </tbody></table></div>
          </div>
        )}
      </section>
    </div>
  )
}

function TrophyArt() {
  return <svg className={styles.trophy} viewBox="0 0 280 220" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="rating-gold" x1="0" x2="1"><stop stopColor="#e7a126" /><stop offset=".3" stopColor="#ffe99b" /><stop offset=".58" stopColor="#ffc949" /><stop offset="1" stopColor="#df8c12" /></linearGradient>
      <linearGradient id="rating-podium" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#b9e4f6" /></linearGradient>
    </defs>
    <ellipse cx="153" cy="203" rx="94" ry="9" fill="#73bcd4" opacity=".14" />
    <path d="M25 161C-1 113 44 57 112 51s119 24 141 72" fill="none" stroke="#b1e9f9" strokeWidth="12" opacity=".65" />
    <path d="M76 40h-25v26c0 32 25 45 46 43M189 40h25v26c0 32-25 45-46 43" fill="none" stroke="url(#rating-gold)" strokeWidth="10" />
    <path d="M75 30h115l-7 50c-4 28-23 43-49 43S89 108 84 80Z" fill="url(#rating-gold)" />
    <ellipse cx="133" cy="30" rx="57" ry="6" fill="#ffedb1" />
    <path d="M125 120h19v28l17 12h-53l17-12Z" fill="url(#rating-gold)" /><rect x="105" y="157" width="59" height="11" rx="4" fill="url(#rating-gold)" />
    <path d="M92 174h84v19H92Z" fill="url(#rating-podium)" /><path d="M80 193h108v12H80Z" fill="url(#rating-podium)" />
    <path d="m230 38 4 11 12 4-12 4-4 11-4-11-12-4 12-4ZM39 95l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#fff" />
  </svg>
}
