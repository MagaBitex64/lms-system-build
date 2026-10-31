'use client'

import {useState, type FormEvent} from 'react'
import Image from 'next/image'
import {api, setToken} from '@/lib/api'
import {Button, Input, Field, Card} from '@/components/ui'

export default function SetupPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (password !== confirmation) { setError('Құпиясөздер сәйкес келмейді'); return }
    setBusy(true); setError('')
    try {
      const result = await api<{token: string}>('/auth/setup-password', {body: {new_password: password, confirmation}})
      setToken(result.token)
      window.location.replace('/dashboard')
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }
  return <main className="min-h-screen bg-background px-4 py-16"><Card className="mx-auto max-w-lg space-y-5 p-6 sm:p-10">
    <Image src="/logo.jpg" alt="Fenomen FN" width={72} height={72} className="mx-auto rounded-xl" />
    <h1 className="text-2xl font-bold">Жаңа құпиясөз орнату</h1>
    <p className="text-muted">Алғашқы кіру кезінде жеке құпиясөзіңізді орнатыңыз.</p>
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <p id="guidance" className="text-sm text-muted">Кемінде 12 таңба. Ұзын сөз тіркесін қолдануға болады. Уақытша құпиясөзді қайталамаңыз.</p>
      <Field label="Жаңа құпиясөз"><Input type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={1024} required value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="guidance" /></Field>
      <Field label="Құпиясөзді қайталаңыз"><Input type={visible ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></Field>
      <Button type="button" variant="outline" onClick={()=>setVisible(!visible)} aria-pressed={visible}>{visible ? 'Құпиясөзді жасыру' : 'Құпиясөзді көрсету'}</Button>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Сақталуда…' : 'Құпиясөзді сақтау'}</Button>
    </form>
  </Card></main>
}
