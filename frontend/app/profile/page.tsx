'use client'

import useSWR from 'swr'
import { UserRound, Mail, ShieldCheck, CalendarDays } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge, Card, PageHeader, Spinner, ErrorState, Avatar, FadeIn } from '../components/ui'

type Profile = {
  email: string
  full_name: string
  role: string
  created_at?: string
}

const roleTone: Record<string, 'primary' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  admin: 'danger',
  teacher: 'primary',
  student: 'success',
}

export default function ProfilePage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data, error, isLoading } = useSWR<Profile>('/auth/me', (url: string) => api(url) as Promise<Profile>)

  if (isLoading) return <Spinner />
  if (error || !data) return <ErrorState message={t('errorOccurred')} />

  const role = data.role || user?.role || 'student'
  const joined = data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'

  const details = [
    { icon: <Mail size={16} />, label: t('email'), value: data.email },
    { icon: <ShieldCheck size={16} />, label: t('role'), value: t(role as never) || role },
    { icon: <CalendarDays size={16} />, label: t('memberSince'), value: joined },
  ]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('profile')} title={data.full_name} description={data.email} />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
        <FadeIn>
          <Card className="flex flex-col items-center gap-4 py-8 text-center">
            <Avatar name={data.full_name} className="size-20 text-2xl" />
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">{data.full_name}</h2>
              <p className="text-sm text-muted">{data.email}</p>
            </div>
            <Badge tone={roleTone[role] ?? 'neutral'}>{t(role as never) || role}</Badge>
          </Card>
        </FadeIn>

        <FadeIn delay={60}>
          <Card className="space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserRound size={16} className="text-primary" />
              {t('accountDetails')}
            </div>
            <dl className="divide-y divide-border">
              {details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="flex items-center gap-2.5 text-sm text-muted">
                    <span className="text-muted">{d.icon}</span>
                    {d.label}
                  </dt>
                  <dd className="text-sm font-medium text-foreground">{d.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
