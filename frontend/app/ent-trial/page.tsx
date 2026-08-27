'use client'

import { useI18n } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import useSWR from 'swr'
import { Card, Button, Spinner, ErrorState, EmptyState, Badge } from '@/components/ui'
import { ClipboardList, ArrowRight, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function EntTrialListPage() {
  const { t } = useI18n()
  const router = useRouter()
  const { data, error, isLoading } = useSWR<{ items: any[] }>('/ent-trial/my-accesses', fetcher)

  if (isLoading) return <Spinner className="mt-20" />
  if (error) return <ErrorState message={error.message} />

  const accesses = data?.items || []

  async function handleStart(accessId: number) {
    try {
      const res = await api(`/ent-trial/accesses/${accessId}/start`, { method: 'POST' })
      if (res.attempt_id) {
        router.push(`/ent-trial/${res.attempt_id}`)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary-soft rounded-xl text-primary">
          <ClipboardList size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('entTrial')}</h1>
          <p className="text-muted">Менің байқау тестерім</p>
        </div>
      </div>

      {accesses.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="Сынақ тестер жоқ"
          hint="Әзірге сізге ешқандай сынақ тест тағайындалмаған."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accesses.map((a) => {
            const isCompleted = a.attempt_status === 'submitted'
            return (
              <Card key={a.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={isCompleted ? 'success' : 'primary'}>
                      {isCompleted ? 'Аяқталған' : 'Жаңа'}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold mt-2">
                    {a.combination === 'infmat' ? 'Информатика-Математика' :
                     a.combination === 'phymat' ? 'Физика-Математика' :
                     a.combination === 'biochem' ? 'Биология-Химия' :
                     a.combination === 'chemphi' ? 'Химия-Физика' :
                     a.combination === 'matgeo' ? 'Математика-География' : a.combination}
                  </h3>
                  {a.expires_at && (
                    <p className="text-sm text-muted mt-1">
                      Мерзімі: {new Date(a.expires_at).toLocaleDateString()}
                    </p>
                  )}
                  {isCompleted && a.attempt_score !== null && (
                    <p className="text-sm font-semibold mt-2 text-success">
                      Нәтиже: {a.attempt_score} / 140 ұпай
                    </p>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  {isCompleted ? (
                    <Button onClick={() => router.push(`/ent-trial/${a.attempt_id}/result`)} variant="secondary">
                      Нәтижені көру <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button onClick={() => handleStart(a.id)}>
                      {a.attempt_id ? 'Жалғастыру' : 'Бастау'} <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
