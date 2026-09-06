'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { fetcher, api } from '@/lib/api'
import { Button, Spinner, ErrorState, cx } from '@/components/ui'
import { Check, Clock, FileText, Image as ImageIcon, HelpCircle } from 'lucide-react'

export default function EntTestPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<any>(`/ent-trial/attempts/${id}`, fetcher, { revalidateOnFocus: false })
  
  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [timeLeft, setTimeLeft] = useState(240 * 60) // 4 hours in seconds

  useEffect(() => {
    if (data?.questions && !activeSubject) {
      const keys = Object.keys(data.questions)
      if (keys.includes('kaz_history')) setActiveSubject('kaz_history')
      else if (keys.length > 0) setActiveSubject(keys[0])
      
      const initial: Record<number, number> = {}
      for (const subj of keys) {
        for (const q of data.questions[subj]) {
          if (q.selected_option_id) initial[q.question_id] = q.selected_option_id
        }
      }
      setAnswers(initial)
    }
  }, [data, activeSubject])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => (t > 0 ? t - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  if (data.status === 'submitted') {
    router.replace(`/ent-trial/${id}/result`)
    return <Spinner className="mt-20" />
  }

  const subjects = Object.keys(data.questions)
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleSelect = (qId: number, optId: number) => {
    setAnswers(prev => ({ ...prev, [qId]: optId }))
  }

  const handleSubmit = async () => {
    if (!window.confirm("Тестті аяқтап, нәтижені жіберуге сенімдісіз бе?")) return
    try {
      const answersPayload = Object.entries(answers).map(([qId, oId]) => ({
        question_id: Number(qId),
        selected_option_id: oId
      }))
      await api(`/ent-trial/attempts/${id}/submit`, {
        method: 'POST',
        body: { answers: answersPayload }
      })
      router.push(`/ent-trial/${id}/result`)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const subjectNames: Record<string, string> = {
    kaz_history: 'Қазақстан тарихы',
    reading: 'Оқу сауаттылығы',
    math_literacy: 'Мат. сауаттылық',
    informatics: 'Информатика',
    mathematics: 'Математика',
    physics: 'Физика',
    chemistry: 'Химия',
    biology: 'Биология',
    geography: 'География',
  }

  const currentQuestions = activeSubject ? data.questions[activeSubject] : []

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-surface -m-4 sm:-m-6 lg:-m-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">ЕНТ Сынақ тесті</h1>
          <p className="text-sm text-muted">{data.combination} бейіндік комбинациясы</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-4 py-2 text-lg font-mono font-semibold text-foreground">
            <Clock size={20} className={timeLeft < 600 ? 'text-danger animate-pulse' : 'text-muted'} />
            <span className={timeLeft < 600 ? 'text-danger' : ''}>{formatTime(timeLeft)}</span>
          </div>
          <Button onClick={handleSubmit} variant="primary">
            Тестті аяқтау <Check size={18} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-border bg-surface-muted overflow-y-auto p-4 space-y-2">
          <p className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Пәндер</p>
          {subjects.map(subj => {
            const qs = data.questions[subj]
            const answered = qs.filter((q: any) => answers[q.question_id] !== undefined).length
            const total = qs.length
            return (
              <button
                key={subj}
                onClick={() => setActiveSubject(subj)}
                className={cx(
                  "w-full text-left rounded-xl px-4 py-3 transition-colors flex flex-col gap-1",
                  activeSubject === subj 
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-sidebar-hover bg-surface"
                )}
              >
                <span className="font-semibold">{subjectNames[subj] || subj}</span>
                <span className={cx(
                  "text-xs",
                  activeSubject === subj ? "text-primary-foreground/80" : "text-muted"
                )}>
                  {answered} / {total} сұрақ
                </span>
                <div className="h-1 w-full bg-black/10 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={cx("h-full rounded-full transition-all", activeSubject === subj ? "bg-white" : "bg-primary")} 
                    style={{ width: `${total ? (answered/total)*100 : 0}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-background">
          <div className="max-w-3xl mx-auto space-y-8 pb-20">
            <h2 className="text-2xl font-bold border-b border-border pb-4">{subjectNames[activeSubject || '']}</h2>
            
            {currentQuestions.map((q: any, i: number) => (
              <div key={q.question_id} className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                {/* Header tag */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary font-bold">
                      {i + 1}
                    </span>
                    {q.question_type === 'context' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <FileText size={14} /> Мәтінге негізделген контекст
                      </span>
                    )}
                    {q.question_type === 'image' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <ImageIcon size={14} /> Суретті сұрақ
                      </span>
                    )}
                  </div>
                </div>

                {/* Context Reading Passage */}
                {q.context_text && (
                  <div className="p-4 rounded-xl bg-surface-muted border border-border text-foreground/90 italic leading-relaxed text-sm">
                    <p className="font-semibold not-italic text-xs text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                      <FileText size={14} /> Контекст / Мәтін:
                    </p>
                    {q.context_text}
                  </div>
                )}

                {/* Question Image */}
                {q.image_url && (
                  <div className="overflow-hidden rounded-xl border border-border bg-black/5 max-h-80 flex items-center justify-center">
                    <img 
                      src={q.image_url} 
                      alt="Question diagram" 
                      className="max-h-80 object-contain w-full"
                    />
                  </div>
                )}

                {/* Question Prompt */}
                <p className="text-lg font-medium whitespace-pre-wrap leading-snug">{q.prompt}</p>
                
                {/* Options */}
                <div className="space-y-2 pt-2">
                  {q.options.map((opt: any) => {
                    const isSelected = answers[q.question_id] === opt.id
                    return (
                      <label 
                        key={opt.id} 
                        className={cx(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:border-primary",
                          isSelected ? "border-primary bg-primary-soft/50 ring-1 ring-primary" : "border-border bg-surface-muted"
                        )}
                      >
                        <input
                          type="radio"
                          name={`q_${q.question_id}`}
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => handleSelect(q.question_id, opt.id)}
                          className="h-5 w-5 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className={cx("text-base", isSelected ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {opt.text}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
