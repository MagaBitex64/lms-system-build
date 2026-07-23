'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { api } from '@/lib/api'

type ResetPasswordResponse = { message: string }

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('Қалпына келтіру сілтемесі жарамсыз.')
      return
    }
    if (password.length < 8) {
      setError('Құпиясөз кемінде 8 таңбадан тұруы керек.')
      return
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Құпиясөз тым ұзын.')
      return
    }
    if (password !== confirmPassword) {
      setError('Құпиясөздер сәйкес келмейді.')
      return
    }

    setBusy(true)
    try {
      await api<ResetPasswordResponse>('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password },
      })
      setSuccess(true)
    } catch {
      setError('Сілтеме жарамсыз немесе оның мерзімі аяқталған. Жаңа сілтеме сұраңыз.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 text-success" size={44} />
        <h1 className="mb-3 text-2xl font-bold text-foreground">Құпиясөз өзгертілді</h1>
        <p className="mb-7 text-sm text-muted">Енді жаңа құпиясөзбен аккаунтқа кіре аласыз.</p>
        <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">
          Аккаунтқа кіру
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Жаңа құпиясөз орнату</h1>
        <p className="text-sm text-muted">Жаңа құпиясөзді екі рет енгізіңіз.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5">
        {[
          { id: 'new-password', label: 'Жаңа құпиясөз', value: password, setter: setPassword, autoComplete: 'new-password' },
          { id: 'confirm-password', label: 'Құпиясөзді қайталаңыз', value: confirmPassword, setter: setConfirmPassword, autoComplete: 'new-password' },
        ].map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} className="mb-2.5 block text-sm font-medium text-foreground">{field.label}</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                id={field.id}
                type={showPassword ? 'text' : 'password'}
                value={field.value}
                onChange={(event) => field.setter(event.target.value)}
                autoComplete={field.autoComplete}
                className="h-14 w-full rounded-lg border border-border pl-12 pr-12 text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Құпиясөзді жасыру' : 'Құпиясөзді көрсету'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        ))}
        {error && <p className="rounded-lg border border-danger bg-danger-soft p-3 text-xs font-medium text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full rounded-lg bg-primary font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? 'Сақталуда...' : 'Құпиясөзді сақтау'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary hover:text-primary-hover">Жаңа сілтеме сұрау</Link>
      </p>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="relative z-10 w-full max-w-[470px]">
        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="p-8 sm:p-10">
            <div className="mb-8 flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
                <Image src="/logo.jpg" alt="FENOMEN" width={80} height={80} className="h-14 w-14 object-contain" priority />
              </div>
              <p className="text-xl font-semibold text-foreground">FENOMEN School</p>
            </div>
            <Suspense fallback={<p className="text-center text-sm text-muted">Жүктелуде...</p>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  )
}
