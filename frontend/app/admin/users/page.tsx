'use client'

import { useEffect, useState } from 'react'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { api } from '@/lib/api'

type User = {
  id: number
  full_name: string
  email: string
  role: string
  is_blocked: boolean
}

function AdminUsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api('/admin/users?per_page=50')
      .then((data) => setUsers((data as any).items as User[]))
      .catch((err) => setError((err as Error).message || t('errorOccurred')))
      .finally(() => setLoading(false))
  }, [t])

  return (
    <main className="container">
      <div className="card">
        <h1 className="page-title">{t('users')}</h1>
        {loading ? (
          <div>{t('loading')}</div>
        ) : error ? (
          <div>{error}</div>
        ) : users.length ? (
          <div className="grid" style={{ gap: '1rem' }}>
            {users.map((user) => (
              <div key={user.id} className="card">
                <h2>{user.full_name}</h2>
                <p className="text-muted">{user.email}</p>
                <p>{t('role')}: {user.role}</p>
                <p>{t('blocked')}: {user.is_blocked ? t('yes') : t('no')}</p>
              </div>
            ))}
          </div>
        ) : (
          <div>{t('noData')}</div>
        )}
      </div>
    </main>
  )
}

export default function AdminUsersPageWrapper() {
  return (
    <I18nProvider>
      <AdminUsersPage />
    </I18nProvider>
  )
}
