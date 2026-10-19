'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, MinusCircle, XCircle } from 'lucide-react'
import AuthImage from './auth-image'
import LatexText from './latex-text'
import { Badge, Button, EmptyState, cx } from './ui'
import { TYPE_NAMES } from '@/lib/ent'
import { reviewNavigation, scoreIndicator, selectedReviewOptions, type ReviewQuestion, type AdminAttemptReview, type ScoreIndicator } from '@/lib/admin-attempt-review'
import styles from './admin-attempt-review.module.css'

const labels: Record<ScoreIndicator, string> = {correct: 'Жауап дұрыс', incorrect: 'Жауап қате', partial: 'Жауап жартылай дұрыс', unanswered: 'Жауап берілмеген', unknown: 'Ұпай дерегі жоқ'}
const indicatorStyles: Record<ScoreIndicator, string> = {correct: styles.correct, incorrect: styles.incorrect, partial: styles.partial, unanswered: styles.unanswered, unknown: styles.unknown}

export function ReviewQuestionContent({question: q}: {question: ReviewQuestion}) {
  const pictureProps = {alt: q.image_alt || 'Сұраққа арналған сурет', className: styles.picture, style: {width: q.image_width || 640}}
  const picture = q.image_file_id ? <AuthImage fileId={q.image_file_id} {...pictureProps} /> : q.image_url ? <img src={q.image_url} {...pictureProps} /> : null
  const text = (value: string) => <LatexText text={value.replaceAll('{{image}}', '')} />
  if (q.image_placement === 'before') return <>{picture}{text(q.prompt)}</>
  if (picture && q.image_placement === 'marker' && q.prompt.includes('{{image}}')) {
    const at = q.prompt.indexOf('{{image}}')
    return <>{text(q.prompt.slice(0, at))}{picture}{text(q.prompt.slice(at + 9))}</>
  }
  return <>{text(q.prompt)}{picture}</>
}

export function ReviewedQuestion({question: q, displayNumber = q.number, showGlobal = false}: {question: ReviewQuestion; displayNumber?: number; showGlobal?: boolean}) {
  const selected = selectedReviewOptions(q)
  const indicator = scoreIndicator(q)
  const StatusIcon = indicator === 'correct' ? CheckCircle2 : indicator === 'incorrect' ? XCircle : indicator === 'unanswered' ? MinusCircle : CircleHelp
  const optionText = (id: number | string | undefined) => q.options.find(o => String(o.id) === String(id))?.text
  return <article className={styles.question} aria-label={`Сұрақ ${displayNumber}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-bold">Сұрақ №{displayNumber} · {q.subject_label}</h3><Badge>{TYPE_NAMES[q.question_type] || q.question_type}</Badge>
    </div>
    {showGlobal && <p className="text-xs text-muted">Толық тесттегі нөмірі: {q.number}</p>}
    <div className={cx(styles.status, indicatorStyles[indicator])}><StatusIcon size={18} aria-hidden="true" />{labels[indicator]}</div>
    <p className={cx(styles.points, indicatorStyles[indicator])}>Жиналған ұпай: {q.points_earned ?? 'қолжетімсіз'} / {q.max_points ?? 'сақталмаған'} балл{q.evaluation_source === 'reconstructed' && ' · Тарихи көшірмеден қалпына келтірілген'}{q.evaluation_source === 'snapshot_keys' && ' · Жеке бағалау сақталмаған'}</p>
    {q.context_text && <div className={styles.context}><h4 className="mb-2 text-sm font-bold text-primary">Ортақ контекст</h4><LatexText text={q.context_text} /></div>}
    <ReviewQuestionContent question={q} />
    {!q.keys_available && <p role="status" className="text-sm text-muted">Бұл сұрақтың дұрыс жауап кілті сақталмаған.</p>}
    {q.question_type !== 'matching' ? <ul className="space-y-2" aria-label="Жауап нұсқалары">{q.options.map((option, index) => {
      const chosen = selected.has(option.id)
      const wrong = chosen && q.keys_available && !option.is_correct
      return <li key={option.id} className={cx(styles.option, option.is_correct ? styles.correct : wrong ? styles.incorrect : '')}>
        <b aria-hidden="true">{String.fromCharCode(65 + index)}.</b><div className="min-w-0 flex-1"><LatexText text={option.text} />
          {option.is_correct && <p className={styles.optionLabel}><CheckCircle2 size={15} aria-hidden="true" />Дұрыс жауап</p>}
          {wrong && <p className={styles.optionLabel}><XCircle size={15} aria-hidden="true" />Оқушының қате жауабы</p>}
          {chosen && <p className="mt-1 text-xs font-semibold">Оқушы таңдаған жауап</p>}
        </div>
      </li>
    })}</ul> : <div className="space-y-3">
      <div className={styles.context}><h4 className="mb-2 text-sm font-bold">Жауап нұсқалары</h4>{q.options.map((o, i) => <div key={o.id} className="flex min-w-0 gap-2"><b>{i + 1}.</b><LatexText text={o.text} /></div>)}</div>
      {q.matching_pairs.map(pair => {
        const value = q.response.matching_answer?.[String(pair.id)]
        const answered = value != null && value !== ''
        const known = pair.correct_option_id != null
        const correct = answered && pair.correct_option_id != null && String(value) === String(pair.correct_option_id)
        return <div key={pair.id} className={cx(styles.matching, answered && known ? correct ? styles.correct : styles.incorrect : styles.neutral)}>
          <LatexText text={pair.left_text} className="font-semibold" />
          <div className="space-y-2"><p className="text-xs font-semibold">{answered ? !known ? 'Оқушы таңдаған жауап' : correct ? 'Оқушының дұрыс жауабы' : 'Оқушының қате жауабы' : 'Жауап берілмеген'}</p>
            {answered && <LatexText text={optionText(value) ?? `Мәтіні сақталмаған (ID: ${value})`} />}
            <p className="text-xs font-semibold">Дұрыс жауап</p><LatexText text={optionText(pair.correct_option_id) ?? pair.right_text ?? 'Кілт сақталмаған'} />
          </div>
        </div>
      })}
    </div>}
    {[...selected].filter(id => !q.options.some(o => o.id === id)).map(id => <p key={id} className="text-sm text-muted">Оқушының сақталған таңдауы: ID {id}. Нұсқа мәтіні сақталмаған.</p>)}
  </article>
}

export default function AdminAnswerReview({data}: {data: AdminAttemptReview}) {
  const [subject, setSubject] = useState('')
  const [status, setStatus] = useState('')
  const [index, setIndex] = useState(0)
  const questions = reviewNavigation(data.questions, subject, status)
  const current = Math.min(index, Math.max(0, questions.length - 1))
  const selectedQuestion = questions[current]
  const q = selectedQuestion?.question
  const subjects = [...new Map(data.questions.map(item => [item.subject, item.subject_label])).entries()]
  const unexpectedMaximums = data.questions.map(item => item.max_points)
    .filter((value): value is number => value != null && ![1, 2].includes(value))
    .filter((value, index, values) => values.indexOf(value) === index)
  if (!data.review_available) return <EmptyState title="Жауаптардың тарихи көшірмесі қолжетімсіз" hint={data.history_warning || 'Жауап мәліметтері сақталмаған.'} />
  return <div className="space-y-4">
    {data.points_warning && <p role="note" className={styles.notice}>{data.points_warning}</p>}
    {unexpectedMaximums.length > 0 && <p role="note" className={styles.notice}>ҰБТ сұрағының ұпай шегі күтілген 1 немесе 2 баллдан өзгеше: {unexpectedMaximums.join(', ')}. Сақталған дерек өзгертілмеді.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={styles.filter}>Пән<select value={subject} onChange={e => {setSubject(e.target.value); setIndex(0)}}><option value="">Барлық пәндер</option>{subjects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className={styles.filter}>Жауап күйі<select value={status} onChange={e => {setStatus(e.target.value); setIndex(0)}}><option value="">Барлығы</option><option value="correct">Дұрыс</option><option value="incorrect">Қате</option><option value="unanswered">Жауапсыз</option>{data.questions.some(q => q.status === 'partial') && <option value="partial">Жартылай дұрыс</option>}</select></label>
    </div>
    {q ? <>
      <nav className={styles.numbers} aria-label="Сұрақтар арасында ауысу">{questions.map((item, i) => {
        const indicator = scoreIndicator(item.question)
        return <button type="button" key={item.question.question_id} className={indicatorStyles[indicator]} aria-label={`Сұрақ ${item.displayNumber}: ${labels[indicator]}`} aria-current={i === current ? 'step' : undefined} onClick={() => setIndex(i)}>{item.displayNumber}</button>
      })}</nav>
      <div className={styles.legend} aria-label="Сұрақ түстерінің түсіндірмесі">
        <span><i className={styles.correct} aria-hidden="true" />Жасыл — Дұрыс</span>
        <span><i className={styles.partial} aria-hidden="true" />Сары — Жартылай дұрыс</span>
        <span><i className={styles.incorrect} aria-hidden="true" />Қызыл — Қате</span>
        <span><i className={styles.unanswered} aria-hidden="true" />Сұр — Жауапсыз</span>
      </div>
      <div className={styles.navigation}><Button variant="secondary" disabled={current === 0} onClick={() => setIndex(current - 1)}><ChevronLeft size={16} />Алдыңғы</Button><span role="status">{status && 'Сүзгі бойынша: '}{current + 1} / {questions.length}</span><Button variant="secondary" disabled={current === questions.length - 1} onClick={() => setIndex(current + 1)}>Келесі<ChevronRight size={16} /></Button></div>
      <ReviewedQuestion key={q.question_id} question={q} displayNumber={selectedQuestion.displayNumber} showGlobal={!!subject} />
    </> : <EmptyState title="Сүзгіге сәйкес сұрақтар жоқ" />}
  </div>
}
