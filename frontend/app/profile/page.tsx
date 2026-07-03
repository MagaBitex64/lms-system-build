'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

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

  if (loading) {
    return <main className="container"><div className="card">{t('loading')}</div></main>
  }

  if (!profile) {
    return <main className="container"><div className="card">{t('errorOccurred')}</div></main>
  }

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 className="page-title">{t('profile')}</h1>
        <div className="grid" style={{ gap: '0.75rem' }}>
          <div>
            <strong>{t('fullName')}:</strong> {profile.full_name}
          </div>
          <div>
            <strong>{t('email')}:</strong> {profile.email}
          </div>
          <div>
            <strong>{t('role')}:</strong> {profile.role}
          </div>
          {user?.role === 'student' && (
            <div className="badge">{t('student')}</div>
          )}
          {user?.role === 'teacher' && (
            <div className="badge">{t('teacher')}</div>
          )}
          {user?.role === 'admin' && (
            <div className="badge">{t('admin')}</div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function ProfilePage() {
  return (
    <I18nProvider>
      <ProfilePageContent />
    </I18nProvider>
  )
}
