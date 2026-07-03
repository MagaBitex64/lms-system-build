'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserRound, Mail, ShieldCheck, LockKeyhole } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n, I18nProvider } from '@/lib/i18n'
import { Button, Card, Input } from '../components/ui'

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
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_0.95fr]">
        <Card className="space-y-5 border-none bg-slate-950 p-8 text-white shadow-2xl shadow-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3"><ShieldCheck size={18} /></div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">Create account</p>
              <h1 className="text-2xl font-semibold">Join the learning platform</h1>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-300">New students and educators can join instantly and start exploring tailored content and workflows with a refined experience.</p>
        </Card>
        <Card className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">Registration</p>
            <h2 className="text-2xl font-semibold text-slate-950">{t('register')}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>{t('fullName')}</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input className="pl-10" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>{t('email')}</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input className="pl-10" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>{t('password')}</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input className="pl-10" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </label>
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">{error}</div> : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? t('loading') : t('createAccount')}</Button>
          </form>
          <p className="text-sm text-slate-500">{t('haveAccount')} <Link className="font-semibold text-sky-600" href="/login">{t('login')}</Link></p>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <I18nProvider>
      <RegisterForm />
    </I18nProvider>
  )
}
