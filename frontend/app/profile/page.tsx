'use client'

import { useEffect, useState } from 'react'
import { UserRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Badge, Card, PageHeader } from '../components/ui'

function ProfilePageContent() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [profile, setProfile] = useState<{ email: string; full_name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/auth/me')
      .then((data) => setProfile(data as any))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white/80 p-8 text-sm text-slate-500">{t('loading')}</div>
  if (!profile) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-600">{t('errorOccurred')}</div>

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Profile" title={profile.full_name} description="Keep your profile details and account context close at hand." />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><UserRound size={18} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Account</p>
              <h2 className="text-xl font-semibold text-slate-950">{profile.full_name}</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.role === 'student' ? <Badge>{t('student')}</Badge> : null}
            {user?.role === 'teacher' ? <Badge>{t('teacher')}</Badge> : null}
            {user?.role === 'admin' ? <Badge>{t('admin')}</Badge> : null}
            <Badge>{profile.role}</Badge>
          </div>
        </Card>
        <Card className="space-y-4">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><Mail size={16} /><span>{profile.email}</span></div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><ShieldCheck size={16} /><span>{t('role')}: {profile.role}</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <I18nProvider>
      <ProfilePageContent />
    </I18nProvider>
  )
}
