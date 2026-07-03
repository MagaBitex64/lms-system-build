'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Compass, LayoutDashboard, LogIn, Menu, Search, Settings, ShieldCheck, UserCircle2, Users2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Button } from './ui'
import { useSidebar } from './SidebarContext'

const navItems = [
  { href: '/', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/courses', labelKey: 'catalog', icon: Compass },
  { href: '/search', labelKey: 'search', icon: Search },
  { href: '/profile', labelKey: 'profile', icon: UserCircle2 },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { open, toggle, close } = useSidebar()

  const role = user?.role ?? 'guest'
  const isTeacher = role === 'teacher' || role === 'admin'
  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_24%),linear-gradient(135deg,_#f8fbff_0%,_#f3f7ff_48%,_#eef2ff_100%)] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggle} className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm lg:hidden">
              <Menu size={18} />
            </button>
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-950 p-2.5 text-white shadow-lg shadow-slate-900/15">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Fenomen School</p>
                <p className="text-lg font-semibold text-slate-950">LMS Studio</p>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map(({ href, labelKey, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} className={active ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' : 'rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950'}>
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {t(labelKey as keyof typeof t)}
                  </span>
                </Link>
              )
            })}
            {isTeacher ? <Link href="/teacher" className={pathname.startsWith('/teacher') ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' : 'rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950'}><span className="flex items-center gap-2"><ShieldCheck size={16} />{t('courseManagement')}</span></Link> : null}
            {isAdmin ? <Link href="/admin" className={pathname.startsWith('/admin') ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white' : 'rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950'}><span className="flex items-center gap-2"><Users2 size={16} />{t('statistics')}</span></Link> : null}
          </nav>

          <div className="flex items-center gap-2">
            <select value={lang} onChange={(event) => setLang(event.target.value as 'ru' | 'kz')} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none">
              <option value="ru">RU</option>
              <option value="kz">KZ</option>
            </select>
            {user ? (
              <Button variant="outline" size="sm" onClick={() => logout()}>{t('logout')}</Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/login"><span className="flex items-center gap-2"><LogIn size={16} />{t('login')}</span></Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24 space-y-4 rounded-[32px] border border-slate-200/70 bg-white/85 p-4 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Workspace</p>
              <h2 className="mt-2 text-xl font-semibold">{user ? user.full_name : 'Welcome aboard'}</h2>
              <p className="mt-2 text-sm text-slate-300">{user ? t(user.role as keyof typeof t) : 'Sign in to unlock your learning journey.'}</p>
            </div>
            <nav className="space-y-1">
              {navItems.map(({ href, labelKey, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} className={active ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}>
                    <Icon size={16} />
                    {t(labelKey as keyof typeof t)}
                  </Link>
                )
              })}
              {isTeacher ? <Link href="/teacher" className={pathname.startsWith('/teacher') ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}><ShieldCheck size={16} />{t('courseManagement')}</Link> : null}
              {isAdmin ? <Link href="/admin" className={pathname.startsWith('/admin') ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}><Users2 size={16} />{t('statistics')}</Link> : null}
            </nav>
          </div>
        </aside>

        <AnimatePresence mode="wait">
          <motion.main key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 space-y-6">
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div key="mobile-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={close} />
        ) : null}
      </AnimatePresence>
      <motion.aside initial={false} animate={{ x: open ? 0 : '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 25 }} className="fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white/95 p-4 shadow-2xl lg:hidden">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Menu</p>
          <button onClick={close} className="rounded-full border border-slate-200 p-2 text-slate-600">✕</button>
        </div>
        <div className="mt-6 space-y-2">
          {navItems.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link onClick={close} key={href} href={href} className={active ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}>
                <Icon size={16} />
                {t(labelKey as keyof typeof t)}
              </Link>
            )
          })}
          {isTeacher ? <Link onClick={close} href="/teacher" className={pathname.startsWith('/teacher') ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}><ShieldCheck size={16} />{t('courseManagement')}</Link> : null}
          {isAdmin ? <Link onClick={close} href="/admin" className={pathname.startsWith('/admin') ? 'flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white' : 'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950'}><Users2 size={16} />{t('statistics')}</Link> : null}
        </div>
      </motion.aside>
    </div>
  )
}
