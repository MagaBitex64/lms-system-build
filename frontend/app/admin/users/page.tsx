'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Search, Users as UsersIcon } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { api, fetcher } from '@/lib/api'
import { Avatar, Badge, Button, Card, Input, PageHeader, Select, Spinner, ErrorState, EmptyState } from '../../components/ui'

type User = {
  id: number
  full_name: string
  email: string
  role: string
  is_blocked: boolean
}

const roleTone: Record<string, 'danger' | 'primary' | 'success' | 'neutral'> = {
  admin: 'danger',
  teacher: 'primary',
  student: 'success',
}

export default function AdminUsersPage() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, error, isLoading, mutate } = useSWR<{ items: User[] }>('/admin/users?per_page=50', fetcher)

  const filtered = useMemo(() => {
    const users = data?.items ?? []
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [data, query])

  async function updateRole(userId: number, role: string) {
    setWorkingId(userId)
    setActionError(null)
    try {
      await api(`/admin/users/${userId}/role`, { body: { role } })
      await mutate()
    } catch (err) {
      setActionError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorkingId(null)
    }
  }

  async function toggleBlocked(userId: number, isBlocked: boolean) {
    setWorkingId(userId)
    setActionError(null)
    try {
      await api(`/admin/users/${userId}/block`, { body: { is_blocked: !isBlocked } })
      await mutate()
    } catch (err) {
      setActionError((err as Error).message || t('errorOccurred'))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin"><span className="flex items-center gap-1.5"><ArrowLeft size={15} />{t('statistics')}</span></Link>
      </Button>

      <PageHeader
        eyebrow={t('admin')}
        title={t('users')}
        description={t('analytics')}
        actions={
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-9 sm:w-64"
            />
          </div>
        }
      />

      {actionError && <ErrorState message={actionError} />}

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={(error as Error).message || t('errorOccurred')} />
      ) : !filtered.length ? (
        <EmptyState icon={<UsersIcon size={22} />} title={t('noData')} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-border bg-surface-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
            <span>{t('name')}</span>
            <span>{t('role')}</span>
            <span>{t('status')}</span>
            <span>{t('settings')}</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((user) => (
              <li
                key={user.id}
                className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-surface-muted/40 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={user.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={roleTone[user.role] ?? 'neutral'}>{t((user.role as never)) || user.role}</Badge>
                    <Select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      disabled={workingId === user.id}
                      className="h-8 w-32"
                    >
                      <option value="guest">{t('guest')}</option>
                      <option value="student">{t('student')}</option>
                      <option value="teacher">{t('teacher')}</option>
                      <option value="admin">{t('admin')}</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Badge tone={user.is_blocked ? 'danger' : 'success'}>
                    {user.is_blocked ? t('blocked') : t('active')}
                  </Badge>
                </div>
                <div>
                  <Button
                    variant={user.is_blocked ? 'outline' : 'danger'}
                    size="sm"
                    onClick={() => toggleBlocked(user.id, user.is_blocked)}
                    disabled={workingId === user.id}
                  >
                    {user.is_blocked ? t('unblock') : t('block')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
