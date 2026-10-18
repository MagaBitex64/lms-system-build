'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { ArrowRight, CalendarDays, KeyRound, Mail, Save, Settings, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth, type User } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/api'
import { Avatar, Badge, Button, Card, ErrorState, Field, Input, Spinner } from './ui'
import styles from './account-profile.module.css'

export default function AccountProfile({ settings = false }: { settings?: boolean }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const { mutate } = useSWRConfig()
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { setFullName(user?.full_name ?? '') }, [user?.id, user?.full_name])
  useEffect(() => { setError(''); setNotice('') }, [user?.id])
  const canEdit = settings && user?.role === 'admin'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !canEdit || busyRef.current || fullName.trim() === user.full_name) return
    if (fullName.trim().length < 2 || fullName.trim().length > 120) { setError('Аты-жөніңіз 2–120 таңбадан тұруы керек.'); return }
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      // Existing admin-only API; update only this authenticated user's name, never role/access/password.
      const updated = await api<User>(`/admin/users/${user.id}`, { method: 'PATCH', body: { full_name: fullName.trim() } })
      await mutate('/auth/me', updated, { revalidate: false })
      setNotice('Өзгерістер сақталды.')
    } catch (err) { setError((err as Error).message || 'Өзгерістерді сақтау мүмкін болмады.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  if (!user) return <Spinner />
  const joined = new Date(user.created_at)
  const joinedText = Number.isNaN(joined.getTime()) ? '—' : joined.toLocaleDateString('kk-KZ')
  return <div className={styles.page}>
    <header className={styles.heading}><div><p>FENOMEN АККАУНТЫ</p><h1>{settings ? 'Аккаунт баптаулары' : 'Менің профилім'}</h1><span>{settings ? 'Жеке ақпаратыңызды және аккаунт параметрлерін басқарыңыз.' : 'Аккаунтыңызға қатысты жеке ақпарат.'}</span></div>{!settings && <Button asChild variant="secondary"><Link href="/settings"><Settings size={17} />Аккаунт баптаулары</Link></Button>}</header>
    <div className={styles.layout}>
      <Card className={styles.identity}>
        <div className={styles.identityTop}><Avatar name={user.full_name} size="lg" className={styles.avatar} /><h2>{user.full_name}</h2><Badge tone="primary">{t(user.role)}</Badge><p>{user.email}</p></div>
        <dl><div><dt><CalendarDays size={15} />Тіркелген күні</dt><dd>{joinedText}</dd></div><div><dt><ShieldCheck size={15} />Аккаунт күйі</dt><dd>{user.is_blocked ? 'Бұғатталған' : 'Белсенді'}</dd></div></dl>
        <p className={styles.help}>Профиль суретін жүктеу әзірге қолжетімсіз. Атыңыздың бастапқы әріптері көрсетіледі.</p>
      </Card>
      <div className={styles.panels}>
        <Card className={styles.panel}>
          <h2><UserRound size={20} />Жеке ақпарат</h2><p className={styles.intro}>{!settings ? 'Аккаунтыңызда сақталған жеке мәліметтер.' : canEdit ? 'Аты-жөніңізді өзгертіп, сақтай аласыз.' : 'Бұл ақпаратты өзгерту үшін әкімшіге хабарласыңыз.'}</p>
          <form onSubmit={save} className={styles.form}>
            <Field label="Аты-жөніңіз"><Input name="full_name" autoComplete="name" value={canEdit ? fullName : user.full_name} onChange={event => { setFullName(event.target.value); setError(''); setNotice('') }} readOnly={!canEdit} disabled={busy} required minLength={2} maxLength={120} /></Field>
            <Field label="Электрондық пошта" hint="Email осы бетте өзгертілмейді."><Input type="email" name="email" autoComplete="email" value={user.email} readOnly /></Field>
            <Field label="Рөл" hint="Рөлді аккаунт баптауларынан өзгерту мүмкін емес."><Input value={t(user.role)} readOnly /></Field>
            {settings && !canEdit && <p className={styles.readOnlyNotice}><ShieldCheck size={17} />Сіздің рөліңіз үшін жеке ақпаратты өз бетіңізше өзгерту әзірге қолжетімсіз.</p>}
            {error && <ErrorState message={error} />}
            {notice && <p role="status" className={styles.success}>{notice}</p>}
            {canEdit && <div className={styles.save}><Button type="submit" disabled={busy || fullName.trim() === user.full_name}><Save size={16} />{busy ? 'Сақталуда…' : 'Өзгерістерді сақтау'}</Button></div>}
          </form>
        </Card>
        <section id="security" className={styles.securitySection}><Card className={styles.panel}>
          <h2><KeyRound size={20} />Қауіпсіздік</h2><p className={styles.intro}>Құпиясөзді өзгерту үшін тіркелген email арқылы қалпына келтіру сілтемесін сұраңыз.</p>
          <div className={styles.security}><span><Mail size={21} /></span><div><strong>Құпиясөзді қалпына келтіру</strong><p>Қауіпсіз сілтеме email мекенжайыңызға жіберіледі. Құпиясөз осы бетте сақталмайды.</p></div></div>
          <Button asChild variant="secondary"><Link href="/forgot-password">Құпиясөзді өзгерту<ArrowRight size={16} /></Link></Button>
        </Card></section>
      </div>
    </div>
  </div>
}
