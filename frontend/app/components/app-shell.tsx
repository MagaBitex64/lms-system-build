'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useI18n, type TKey } from '@/lib/i18n'
import { Spinner } from './ui'

const icons: Record<string, ReactNode> = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  courses: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  ),
  catalog: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
    </svg>
  ),
  grades: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  teach: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
    </svg>
  ),
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')

  if (isLoading) return <Spinner />
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <Spinner />
  }

  const nav: { href: string; label: TKey; icon: ReactNode }[] = [
    { href: '/dashboard', label: 'dashboard', icon: icons.dashboard },
  ]
  if (user.role === 'student') {
    nav.push({ href: '/my-courses', label: 'myCourses', icon: icons.courses })
    nav.push({ href: '/courses', label: 'catalog', icon: icons.catalog })
    nav.push({ href: '/grades', label: 'grades', icon: icons.grades })
  }
  if (user.role === 'teacher') {
    nav.push({ href: '/teach', label: 'courseManagement', icon: icons.teach })
    nav.push({ href: '/courses', label: 'catalog', icon: icons.catalog })
  }
  if (user.role === 'admin') {
    nav.push({ href: '/teach', label: 'courseManagement', icon: icons.teach })
    nav.push({ href: '/courses', label: 'catalog', icon: icons.catalog })
    nav.push({ href: '/admin', label: 'statistics', icon: icons.admin })
  }
  if (user.role === 'guest') {
    nav.push({ href: '/courses', label: 'catalog', icon: icons.catalog })
  }

  const roleLabel: TKey =
    user.role === 'admin' ? 'admin' : user.role === 'teacher' ? 'teacher' : user.role === 'student' ? 'student' : 'guest'

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          P
        </div>
        <span className="text-sm font-semibold">Phenomenon School</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
        {nav.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-background hover:text-foreground'
              }`}
            >
              {n.icon}
              {t(n.label)}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-muted">{t(roleLabel)}</p>
          </div>
          <div className="flex gap-0.5 text-xs">
            {(['ru', 'kz'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-1.5 py-1 uppercase cursor-pointer ${lang === l ? 'bg-primary-soft text-primary font-semibold' : 'text-muted hover:text-foreground'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={logout} className="text-sm text-muted hover:text-danger cursor-pointer">
          {t('logout')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 border-r border-border bg-surface">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button className="lg:hidden text-muted cursor-pointer" onClick={() => setMenuOpen(true)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          {user.role !== 'guest' && (
            <form
              className="flex max-w-md flex-1 items-center"
              onSubmit={(e) => {
                e.preventDefault()
                if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                aria-label={t('search')}
              />
            </form>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
