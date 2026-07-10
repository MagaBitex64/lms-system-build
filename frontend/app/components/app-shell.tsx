'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Users,
  Search,
  Menu,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n, type TKey } from '@/lib/i18n'
import { Spinner, Avatar, cx } from './ui'

const PUBLIC_ROUTES = ['/', '/login']

type NavItem = { href: string; label: TKey; icon: ReactNode }

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.includes(pathname)

  if (isPublic) return <>{children}</>
  return <AuthedShell>{children}</AuthedShell>
}

function AuthedShell({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const { t } = useI18n()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')

  if (isLoading) return <Spinner className="mt-40" />
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <Spinner className="mt-40" />
  }

  const nav: NavItem[] = [{ href: '/dashboard', label: 'dashboard', icon: <LayoutDashboard size={18} /> }]
  if (user.role === 'student') {
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={18} /> })
  }
  if (user.role === 'teacher') {
    nav.push({ href: '/teacher', label: 'courseManagement', icon: <GraduationCap size={18} /> })
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={18} /> })
  }
  if (user.role === 'admin') {
    nav.push({ href: '/teacher', label: 'courseManagement', icon: <GraduationCap size={18} /> })
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={18} /> })
    nav.push({ href: '/admin', label: 'adminPanel', icon: <Users size={18} /> })
  }

  const roleLabel: TKey =
    user.role === 'admin' ? 'admin' : user.role === 'teacher' ? 'teacher' : 'student'

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 px-5 py-5"
        onClick={() => setMenuOpen(false)}
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <img
            src="/logo.jpg"
            alt="Logo"
            className="h-full w-full rounded-xl object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
              ;(e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
            }}
          />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Fenomen School</p>
          <p className="text-xs text-sidebar-muted">{t('platformLabel')}</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2" aria-label="Негізгі навигация">
        {nav.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-white',
              )}
            >
              <span className={cx('shrink-0', active ? 'text-primary-foreground' : '')}>{n.icon}</span>
              {t(n.label)}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/profile"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-hover"
        >
          <Avatar name={user.full_name} className="bg-sidebar-hover text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
            <p className="truncate text-xs text-sidebar-muted">{t(roleLabel)}</p>
          </div>
        </Link>
        <div className="mt-2 flex items-center justify-end gap-2 px-1">
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-sidebar-muted transition-colors hover:text-white"
          >
            <LogOut size={14} />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 z-10 text-sidebar-muted hover:text-white"
              aria-label="Мәзірді жабу"
            >
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
          <button
            className="text-muted transition-colors hover:text-foreground lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Мәзірді ашу"
          >
            <Menu size={22} />
          </button>

          <form
            className="flex max-w-md flex-1 items-center"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                aria-label={t('search')}
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 sm:flex">
              <Avatar name={user.full_name} className="size-7 text-xs" />
              <span className="text-sm font-medium text-foreground">{user.full_name.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
