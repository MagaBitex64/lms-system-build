'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useI18n, I18nProvider } from '@/lib/i18n'

function RegisterForm() {
  const { t } = useI18n()
  const { register } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      await register(email, password, fullName)
      router.push('/')
    } catch (err) {
      setError((err as Error).message || t('errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 className="page-title">{t('register')}</h1>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: '1rem' }}>
          <label>
            {t('fullName')}
            <input
              className="input"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label>
            {t('email')}
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            {t('password')}
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="text-muted">{error}</div>}
          <button className="button" type="submit" disabled={loading}>
            {loading ? t('loading') : t('createAccount')}
          </button>
        </form>
        <p className="text-muted" style={{ marginTop: '1rem' }}>
          {t('haveAccount')} <Link href="/login">{t('login')}</Link>
        </p>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <I18nProvider>
      <RegisterForm />
    </I18nProvider>
  )
}
