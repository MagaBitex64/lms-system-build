'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, KeyRound, LogOut, Settings, UserRound } from 'lucide-react'
import type { User } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Avatar } from './ui'
import styles from './profile-menu.module.css'

export default function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const initialFocus = useRef<'first' | 'last'>('first')
  const busyRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const entries = root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
      if (entries?.length) entries[initialFocus.current === 'last' ? entries.length - 1 : 0].focus()
    })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside) }
  }, [open])

  async function logout() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try { await onLogout() }
    catch { setError('Шығу кезінде қате орын алды. Кіру бетіне қайта өтіңіз.') }
    finally { busyRef.current = false; setBusy(false) }
  }

  return <div ref={root} className={styles.root} onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }} onKeyDown={event => {
    if (!open) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const entries = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = entries.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length
    entries[next]?.focus()
  }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label="Аккаунт мәзірін ашу" aria-haspopup="menu" aria-controls={open ? menuId : undefined} aria-expanded={open}
      onClick={() => { initialFocus.current = 'first'; setOpen(current => !current) }}
      onKeyDown={event => {
        if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); initialFocus.current = event.key === 'ArrowUp' ? 'last' : 'first'; setOpen(true)
        }
      }}>
      <Avatar name={user.full_name} size="sm" className="bg-primary-soft text-primary flex-shrink-0" />
      <span className={styles.triggerCopy}><strong>{user.full_name}</strong><span>{t(user.role)}</span></span><ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
    </button>
    {open && <div id={menuId} role="menu" aria-label="Аккаунт мәзірі" className={styles.menu}>
      <div className={styles.identity} role="presentation"><Avatar name={user.full_name} size="md" /><div><strong>{user.full_name}</strong><span>{t(user.role)}</span><span>{user.email}</span></div></div>
      {[
        { href: '/profile', title: 'Менің профилім', Icon: UserRound },
        { href: '/settings', title: 'Аккаунт баптаулары', Icon: Settings },
        { href: '/forgot-password', title: 'Құпиясөзді өзгерту', Icon: KeyRound },
      ].map(({ href, title, Icon }) => <Link key={href} href={href} role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={styles.item}><Icon size={17} aria-hidden="true" />{title}</Link>)}
      <div role="separator" className={styles.divider} />
      <button type="button" role="menuitem" tabIndex={-1} aria-disabled={busy} className={`${styles.item} ${styles.logout}`} onClick={() => void logout()}><LogOut size={17} aria-hidden="true" />{busy ? 'Шығуда…' : 'Шығу'}</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>}
  </div>
}
