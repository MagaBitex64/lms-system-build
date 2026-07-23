'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { api } from '@/lib/api'

type ForgotPasswordResponse = { message: string }

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Дұрыс email мекенжайын енгізіңіз.')
      return
    }

    setBusy(true)
    try {
      const response = await api<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      })
      setMessage(response.message)
    } catch {
      setError('Сұрауды жіберу мүмкін болмады. Кейінірек қайталап көріңіз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 -mr-48 -mt-48 rounded-full bg-primary opacity-5" />
      <div className="relative z-10 w-full max-w-[470px]">
        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="p-8 sm:p-10">
            <div className="mb-8 flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
                <Image src="/logo.jpg" alt="FENOMEN" width={80} height={80} className="h-14 w-14 object-contain" priority />
              </div>
              <p className="text-xl font-semibold text-foreground">FENOMEN School</p>
            </div>

            {message ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-4 text-success" size={44} />
                <h1 className="mb-3 text-2xl font-bold text-foreground">Email-ді тексеріңіз</h1>
                <p className="mb-7 text-sm leading-relaxed text-muted">{message}</p>
                <Link href="/login" className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary-hover">
                  <ArrowLeft size={17} />
                  Кіру бетіне оралу
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <h1 className="mb-2 text-2xl font-bold text-foreground">Құпиясөзді ұмыттыңыз ба?</h1>
                  <p className="text-sm leading-relaxed text-muted">
                    Аккаунтыңыздың email мекенжайын енгізіңіз. Біз құпиясөзді өзгерту сілтемесін жібереміз.
                  </p>
                </div>
                <form onSubmit={onSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="reset-email" className="mb-2.5 block text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="example@mail.com"
                        className="h-14 w-full rounded-lg border border-border pl-12 pr-4 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                  {error && <p className="rounded-lg border border-danger bg-danger-soft p-3 text-xs font-medium text-danger">{error}</p>}
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-14 w-full rounded-lg bg-primary font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busy ? 'Жіберілуде...' : 'Қалпына келтіру сілтемесін жіберу'}
                  </button>
                </form>
                <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:text-primary-hover">
                  <ArrowLeft size={17} />
                  Кіру бетіне оралу
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
