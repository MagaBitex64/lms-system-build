'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, GraduationCap, History, Search, ShieldCheck } from 'lucide-react'
import { fetcher } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui'

type ActorRole = 'admin' | 'teacher'

type AuditLog = {
  id: number
  actor_id: number | null
  actor_name: string
  actor_email: string
  actor_role: ActorRole
  action: string
  entity_type: string
  entity_id: string | null
  summary: string
  details: {
    method?: string
    path?: string
    status_code?: number
  }
  created_at: string
}

type AuditResponse = {
  items: AuditLog[]
  total: number
  page: number
  per_page: number
}

const roleLabels: Record<ActorRole, string> = {
  admin: 'Әкімші',
  teacher: 'Мұғалім',
}

const entityLabels: Record<string, string> = {
  user: 'Пайдаланушы',
  group: 'Топ',
  course: 'Курс',
  course_item: 'Курс элементі',
  lesson: 'Сабақ',
  material: 'Материал',
  quiz: 'Тест',
  question: 'Сұрақ',
  answer: 'Жауап',
  homework: 'Үй тапсырмасы',
  submission: 'Оқушы жұмысы',
  lead: 'Кеңес өтінімі',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

export default function AuditLogsPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<ActorRole | ''>('')
  const [page, setPage] = useState(1)
  const roleParam = role ? `&role=${role}` : ''
  const endpoint = `/admin/audit-logs?page=${page}&per_page=30&q=${encodeURIComponent(query)}${roleParam}`
  const { data, isLoading, error } = useSWR<AuditResponse>(endpoint, fetcher)
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.per_page ?? 30)))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Әкімші"
        title="Әрекеттер журналы"
        description="Әкімшілер мен мұғалімдердің курстарға, бағаларға, пайдаланушыларға және топтарға енгізген маңызды өзгерістері."
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Аты, поштасы немесе әрекеті бойынша іздеу"
              className="pl-10"
            />
          </div>
          <Select
            value={role}
            onChange={(event) => {
              setRole(event.target.value as ActorRole | '')
              setPage(1)
            }}
            className="md:w-52"
            aria-label="Рөл бойынша сүзу"
          >
            <option value="">Барлық рөлдер</option>
            <option value="admin">Әкімшілер</option>
            <option value="teacher">Мұғалімдер</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message="Әрекеттер журналын жүктеу мүмкін болмады." />
        ) : !(data?.items.length) ? (
          <EmptyState
            icon={<History size={22} />}
            title="Әрекеттер табылмады"
            hint="Жаңа маңызды өзгерістер жасалғаннан кейін олар осында автоматты түрде пайда болады."
          />
        ) : (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {data.items.map((item) => {
                const RoleIcon = item.actor_role === 'admin' ? ShieldCheck : GraduationCap
                return (
                  <article
                    key={item.id}
                    className="grid gap-4 bg-surface px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px_190px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <RoleIcon size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.summary}</p>
                          <Badge>{item.action}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {entityLabels[item.entity_type] ?? item.entity_type}
                          {item.entity_id ? ` · ID ${item.entity_id}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <Badge tone={item.actor_role === 'admin' ? 'primary' : 'success'}>
                        {roleLabels[item.actor_role]}
                      </Badge>
                      <p className="mt-1 truncate text-sm font-medium">{item.actor_name}</p>
                      <p className="truncate text-xs text-muted">{item.actor_email}</p>
                    </div>
                    <div className="text-sm text-muted lg:text-right">
                      <p>{formatDate(item.created_at)}</p>
                      {item.details.method && item.details.path && (
                        <p className="mt-1 truncate text-xs">
                          {item.details.method} {item.details.path}
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Барлығы: <span className="font-semibold text-foreground">{data.total}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  aria-label="Алдыңғы бет"
                >
                  <ChevronLeft size={15} />
                </Button>
                <span className="min-w-20 text-center text-sm font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  aria-label="Келесі бет"
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
