'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, Trophy } from 'lucide-react'

import { fetcher } from '@/lib/api'
import { Button, Card, ErrorState, ProgressBar, Spinner } from '@/components/ui'

type SubjectResult = {
  subject: string
  label: string
  score: number
  max_score: number
  percentage: number
}

type ResultData = {
  status: 'in_progress' | 'submitted'
  scores: { total: number }
  max_score: number
  subjects: SubjectResult[]
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export default function EntResultPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<ResultData>(`/ent-trial/attempts/${id}`, fetcher)

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />
  if (!data) return null
  if (data.status !== 'submitted') return <div className="mx-auto mt-20 max-w-2xl space-y-4 text-center"><h2 className="text-2xl font-bold">Тест әлі аяқталмаған</h2><Button onClick={() => router.push(`/ent-trial/${id}`)}>Тестке қайту</Button></div>

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Button variant="ghost" onClick={() => router.push('/ent-trial')} className="mb-4"><ArrowLeft size={16} /> Артқа қайту</Button>
      <Card className="border-primary/20 bg-gradient-to-br from-primary-soft to-surface p-8 text-center">
        <Trophy size={48} className="mx-auto mb-4 text-primary" />
        <h1 className="mb-2 text-3xl font-bold">Тест аяқталды!</h1>
        <p className="mb-6 text-muted">Жалпы нәтиже:</p>
        <div className="text-6xl font-black text-foreground">{formatScore(data.scores.total)} <span className="text-3xl font-bold text-muted">/ {data.max_score}</span></div>
        <p className="mt-4 text-sm text-muted">Сұрақтар, таңдалған жауаптар және қателер көрсетілмейді.</p>
      </Card>

      <section className="space-y-4" aria-labelledby="subject-results-title">
        <div>
          <h2 id="subject-results-title" className="text-xl font-bold">Пәндер бойынша нәтиже</h2>
          <p className="text-sm text-muted">Әр пән бойынша жиналған және мүмкін ұпай көрсетілген.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map(item => (
            <Card key={item.subject} className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-semibold">{item.label}</p>
                <p className="shrink-0 text-lg font-black text-primary">{formatScore(item.score)} / {formatScore(item.max_score)}</p>
              </div>
              <ProgressBar value={item.percentage} />
              <p className="mt-2 text-right text-xs font-medium text-muted">{Number(item.percentage).toFixed(2)}%</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
