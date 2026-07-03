'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, LockKeyhole, GraduationCap } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Button, Field, Input, ErrorState } from '@/components/ui'
import { AuthBrand } from '@/components/auth-brand'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorOccurred'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-2">
        <AuthBrand />

        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap size={20} />
              </div>
              <span className="text-base font-semibold">Fenomen School</span>
            </Link>
            <div className="ml-auto flex gap-1 rounded-lg border border-border bg-surface p-1">
              {(['ru', 'kz'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
                    lang === l ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('login')}</h1>
            <p className="text-sm text-muted">{t('welcomeBack')} — {t('continueLearning')}</p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <Field label={t('email')}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <Input
                  type="email"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </Field>
            <Field label={t('password')}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <Input
                  type="password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </Field>
            {error && <ErrorState message={error} />}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? t('loading') : t('login')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {t('noAccount')}{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
