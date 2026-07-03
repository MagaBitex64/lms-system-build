'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Button, Input, Field, Card } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, fullName)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorOccurred'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
            P
          </div>
          <h1 className="text-xl font-semibold text-balance">Phenomenon School</h1>
          <div className="flex gap-1 text-xs">
            {(['ru', 'kz'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-2 py-1 uppercase cursor-pointer ${lang === l ? 'bg-primary-soft text-primary font-semibold' : 'text-muted hover:text-foreground'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <Field label={t('fullName')}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" />
              </Field>
            )}
            <Field label={t('email')}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            <Field label={t('password')}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy}>
              {mode === 'login' ? t('login') : t('createAccount')}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
          <button
            className="font-medium text-primary hover:underline cursor-pointer"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? t('register') : t('login')}
          </button>
        </p>
      </div>
    </main>
  )
}
