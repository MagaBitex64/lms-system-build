'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { CalendarClock, ClipboardList, Phone, Search } from 'lucide-react'
import { formatDate } from '@/lib/date'
import { api, fetcher } from '@/lib/api'
import { Badge, Card, EmptyState, ErrorState, Input, PageHeader, Select, Spinner } from '../../components/ui'

type LeadStatus = 'new' | 'contacted' | 'closed'

type Lead = {
  id: number
  name: string
  phone: string
  course: string
  branch: string
  status: LeadStatus
  created_at: string
  updated_at: string
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'Жаңа',
  contacted: 'Байланыстық',
  closed: 'Жабылды',
}

const statusTones: Record<LeadStatus, 'warning' | 'primary' | 'neutral'> = {
  new: 'warning',
  contacted: 'primary',
  closed: 'neutral',
}

export default function AdminLeadsPage() {
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [savingIds, setSavingIds] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LeadStatus | ''>('')
  const endpoint = `/admin/leads?status=${status}&q=${encodeURIComponent(query)}`
  const { data, isLoading, error, mutate } = useSWR<{ items: Lead[] }>(endpoint, fetcher)

  const counts = useMemo(() => {
    const items = data?.items ?? []
    return {
      total: items.length,
      new: items.filter((lead) => lead.status === 'new').length,
    }
  }, [data])

  async function changeStatus(leadId: number, nextStatus: LeadStatus) {
    setSavingIds(ids => [...ids, leadId]); setActionError(''); setNotice('')
    try {
      await api(`/admin/leads/${leadId}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      })
      await mutate()
      setNotice('Мәртебе өзгертілді')
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setSavingIds(ids => ids.filter(id => id !== leadId))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Әкімші"
        title="Кеңес алуға өтінімдер"
        description="Лендингтегі өтінім формасы арқылы жіберілген сұраныстар."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold text-muted">Барлық өтінімдер</p>
          <p className="mt-1 text-3xl font-bold">{counts.total}</p>
          {(query || status) && <p className="mt-1 text-xs text-muted">Таңдалған сүзгілер бойынша</p>}
        </Card>
        <Card>
          <p className="text-xs font-semibold text-muted">Жаңа өтінімдер</p>
          <p className="mt-1 text-3xl font-bold text-warning-foreground">{counts.new}</p>
        </Card>
      </div>

      {notice && <p role="status" className="text-sm text-success-foreground">{notice}</p>}
      {actionError && <ErrorState message={actionError} />}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Аты-жөні, телефон нөмірі немесе курс бойынша іздеу"
              aria-label="Өтінімді іздеу"
              className="pl-10"
            />
          </div>
          <Select aria-label="Мәртебе бойынша сүзу" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus | '')} className="md:w-52">
            <option value="">Барлық мәртебелер</option>
            <option value="new">Жаңа</option>
            <option value="contacted">Байланыстық</option>
            <option value="closed">Жабылды</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message="Өтінімдерді жүктеу мүмкін болмады." />
        ) : !(data?.items.length) ? (
          <EmptyState
            icon={<ClipboardList size={22} />}
            title={query || status ? 'Ештеңе табылмады' : 'Әзірге өтінімдер жоқ'}
            hint="Жаңа өтінімдер лендинг формасы жіберілгеннен кейін осында пайда болады."
          />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {data.items.map((lead) => (
              <article key={lead.id} className="grid gap-4 bg-surface px-4 py-4 lg:grid-cols-[1.1fr_1fr_1.3fr_180px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{lead.name}</p>
                    <Badge tone={statusTones[lead.status]}>{statusLabels[lead.status]}</Badge>
                  </div>
                  <a className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline" href={`tel:${lead.phone}`}>
                    <Phone size={14} />{lead.phone}
                  </a>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">Қызықтырған курс</p>
                  <p className="mt-1 break-words text-sm font-medium">{lead.course}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted">Филиал</p>
                  <p className="mt-1 text-sm">{lead.branch || 'Көрсетілмеген'}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarClock size={13} />{formatDate(lead.created_at)}</p>
                </div>
                <Select
                  aria-label="Өтінім мәртебесі"
                  disabled={savingIds.includes(lead.id)}
                  value={lead.status}
                  onChange={(event) => changeStatus(lead.id, event.target.value as LeadStatus)}
                >
                  <option value="new">Жаңа</option>
                  <option value="contacted">Байланыстық</option>
                  <option value="closed">Жабылды</option>
                </Select>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
