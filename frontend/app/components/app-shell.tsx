'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Users,
  Search,
  Menu,
  LogOut,
  ClipboardList,
  History,
  X,
  Home,
  Settings,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n, type TKey } from '@/lib/i18n'
import { Spinner, Avatar, cx } from './ui'

const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/reset-password']

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

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = q.trim()
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  if (isLoading) return <Spinner className="mt-40" />
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <Spinner className="mt-40" />
  }

  // Build navigation based on role
  const nav: NavItem[] = [{ href: '/dashboard', label: 'overview', icon: <Home size={20} /> }]
  
  if (user.role === 'student') {
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={20} /> })
  }
  
  if (user.role === 'teacher') {
    nav.push({ href: '/teacher', label: 'myCourses', icon: <GraduationCap size={20} /> })
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={20} /> })
  }
  
  if (user.role === 'admin') {
    nav.push({ href: '/teacher', label: 'myCourses', icon: <GraduationCap size={20} /> })
    nav.push({ href: '/courses', label: 'catalog', icon: <BookOpen size={20} /> })
    nav.push({ href: '/admin', label: 'adminPanel', icon: <Users size={20} /> })
    nav.push({ href: '/admin/leads', label: 'leadRequests', icon: <ClipboardList size={20} /> })
    nav.push({ href: '/admin/audit-logs', label: 'auditLog', icon: <History size={20} /> })
  }

  const roleLabel: TKey =
    user.role === 'admin' ? 'admin' : user.role === 'teacher' ? 'teacher' : 'student'

  // Sidebar component
  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo section */}
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border"
        onClick={() => setMenuOpen(false)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft flex-shrink-0 overflow-hidden">
          <Image
            src="/logo.jpg"
            alt="FENOMEN"
            width={52}
            height={52}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-bold text-sidebar-foreground">FENOMEN</p>
          <p className="text-xs text-sidebar-muted">{t('platformLabel')}</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-4 py-4" aria-label="Негізгі навигация">
        {nav.map((n) => {
          const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href + '/'))
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenuOpen(false)}
              className={cx(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground',
              )}
            >
              <span className="flex-shrink-0">{n.icon}</span>
              <span>{t(n.label)}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profile & Logout */}
      <div className="border-t border-sidebar-border p-4">
        <button
          onClick={() => {
            setMenuOpen(false)
            logout()
          }}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground transition-colors"
        >
          <LogOut size={18} />
          {t('logout')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block bg-sidebar">
        {sidebar}
      </aside>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-2xl bg-sidebar">
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute right-4 top-4 z-10 text-sidebar-muted hover:text-sidebar-foreground p-2"
              aria-label="Мәзірді жабу"
            >
              <X size={24} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-surface">
          <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-4">
            {/* Left: Menu button + Search */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-surface-muted transition-colors lg:hidden text-sidebar-muted hover:text-sidebar-foreground"
                aria-label="Мәзірді ашу"
              >
                <Menu size={20} />
              </button>

              {/* Search */}
              <form
                className="hidden sm:flex flex-1 max-w-md items-center"
                onSubmit={onSearchSubmit}
                role="search"
              >
                <div className="relative w-full">
                  <button
                    type="submit"
                    aria-label={t('search')}
                    className="absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-primary"
                  >
                    <Search size={18} />
                  </button>
                  <input
                    type="search"
                    name="q"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-surface-muted text-foreground placeholder:text-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </form>
            </div>

            {/* Right: Profile */}
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2.5 px-2.5 py-1.5">
                {/* Avatar */}
                <Avatar name={user.full_name} className="bg-primary-soft text-primary flex-shrink-0" size="sm" />
                
                {/* Name & Role - Hidden on mobile */}
                <div className="hidden sm:flex flex-col gap-0 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground leading-tight">{user.full_name}</p>
                  <p className="truncate text-xs text-muted leading-tight">{t(roleLabel)}</p>
                </div>
                
                {/* Avatar only - Visible on mobile */}
                <div className="sm:hidden flex-shrink-0" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
