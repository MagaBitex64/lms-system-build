'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { fetcher } from '@/lib/api'
import { Spinner, ErrorState, Card, Button, cx } from '@/components/ui'
import { CheckCircle, XCircle, ArrowLeft, Trophy } from 'lucide-react'

export default function EntResultPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<any>(`/ent-trial/attempts/${id}`, fetcher)

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null

  if (data.status !== 'submitted') {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-4">
        <h2 className="text-2xl font-bold">Тест әлі аяқталмаған</h2>
        <Button onClick={() => router.push(`/ent-trial/${id}`)}>Тестке қайту</Button>
      </div>
    )
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

  const maxScores = {
    kaz_history: 20,
    reading: 10,
    math_literacy: 10,
    subject1: 50,
    subject2: 50,
    total: 140
  }

  const scoreMap: Record<string, { score: number, max: number, label: string }> = {
    kaz_history: { score: data.scores.kaz_history, max: 20, label: 'Қазақстан тарихы' },
    reading: { score: data.scores.reading, max: 10, label: 'Оқу сауаттылығы' },
    math_literacy: { score: data.scores.math_literacy, max: 10, label: 'Мат. сауаттылық' },
  }

  // Figure out which subjects are subject1 and subject2 based on keys in data.questions
  const allSubjs = Object.keys(data.questions)
  const profileSubjs = allSubjs.filter(s => !['kaz_history', 'reading', 'math_literacy'].includes(s))
  if (profileSubjs.length >= 1) scoreMap[profileSubjs[0]] = { score: data.scores.subject1, max: 50, label: subjectNames[profileSubjs[0]] || profileSubjs[0] }
  if (profileSubjs.length >= 2) scoreMap[profileSubjs[1]] = { score: data.scores.subject2, max: 50, label: subjectNames[profileSubjs[1]] || profileSubjs[1] }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Button variant="ghost" onClick={() => router.push('/ent-trial')} className="mb-4">
        <ArrowLeft size={16} /> Артқа қайту
      </Button>

      {/* Overview Score */}
      <Card className="p-8 text-center bg-gradient-to-br from-primary-soft to-surface border-primary/20">
        <Trophy size={48} className="mx-auto text-primary mb-4" />
        <h1 className="text-3xl font-bold mb-2">Тест аяқталды!</h1>
        <p className="text-muted mb-6">Сіздің жалпы нәтижеңіз:</p>
        <div className="text-6xl font-black text-foreground">
          {data.scores.total} <span className="text-3xl text-muted font-bold">/ 140</span>
        </div>
      </Card>

      {/* Breakdown */}
      <h2 className="text-xl font-bold">Пәндер бойынша талдау</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(scoreMap).map(([key, info]) => {
          const percent = (info.score / info.max) * 100
          return (
            <Card key={key} className="p-5">
              <p className="font-semibold mb-2">{info.label}</p>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold">{info.score}</span>
                <span className="text-sm text-muted">/ {info.max}</span>
              </div>
              <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden">
                <div 
                  className={cx("h-full rounded-full", percent >= 70 ? "bg-success" : percent >= 40 ? "bg-warning" : "bg-danger")}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Detail questions review */}
      <h2 className="text-xl font-bold mt-12 mb-4">Қатемен жұмыс</h2>
      {allSubjs.map(subj => {
        const questions = data.questions[subj]
        if (!questions) return null
        return (
          <div key={subj} className="space-y-4 mb-8">
            <h3 className="text-lg font-semibold border-b border-border pb-2 text-primary">{subjectNames[subj] || subj}</h3>
            {questions.map((q: any, i: number) => {
              const isCorrect = q.is_correct
              return (
                <div key={q.question_id} className={cx("p-5 rounded-2xl border", isCorrect ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
                  <div className="flex gap-3 mb-3">
                    <div className="mt-0.5">
                      {isCorrect ? <CheckCircle size={20} className="text-success" /> : <XCircle size={20} className="text-danger" />}
                    </div>
                    <p className="font-medium">{i + 1}. {q.prompt}</p>
                  </div>
                  <div className="pl-8 space-y-2">
                    {q.options.map((opt: any) => {
                      const isSelected = q.selected_option_id === opt.id
                      const isActualCorrect = opt.is_correct
                      
                      let badge = null
                      let colorClass = "text-muted-foreground"
                      if (isActualCorrect) {
                        badge = <span className="ml-2 text-xs font-bold text-success">(Дұрыс жауап)</span>
                        colorClass = "text-foreground font-semibold"
                      } else if (isSelected && !isActualCorrect) {
                        badge = <span className="ml-2 text-xs font-bold text-danger">(Сіздің жауап)</span>
                        colorClass = "text-danger"
                      }

                      return (
                        <div key={opt.id} className="flex items-center gap-2">
                          <div className={cx(
                            "w-4 h-4 rounded-full border flex-shrink-0",
                            isActualCorrect ? "bg-success border-success" : isSelected ? "bg-danger border-danger" : "border-muted"
                          )} />
                          <p className={cx("text-sm", colorClass)}>{opt.text} {badge}</p>
                        </div>
                      )
                    })}
                  </div>
                  {q.explanation && (
                    <div className="ml-8 mt-4 p-3 bg-background rounded-lg border border-border text-sm">
                      <span className="font-semibold">Түсіндірме:</span> {q.explanation}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
