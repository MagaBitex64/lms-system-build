'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useSidebar } from './SidebarContext'

export default function AppHeader() {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { toggle } = useSidebar()

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null

  return (
    <header className="site-header">
      <div className="container header-inner">
        <button
          type="button"
          className="navbar-toggle"
          onClick={toggle}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <Link href="/" className="site-brand">
          Fenomen School
        </Link>

        <nav className="site-nav">
          <Link href="/courses" className="nav-link">{t('catalog')}</Link>
          <Link href="/search" className="nav-link">{t('search')}</Link>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <Link href="/teacher" className="nav-link">{t('courseManagement')}</Link>
          )}
          {user?.role === 'admin' && (
            <Link href="/admin" className="nav-link">{t('statistics')}</Link>
          )}
        </nav>

        <div className="header-actions">
          <select
            className="select header-select"
            value={lang}
            onChange={(event) => setLang(event.target.value as 'ru' | 'kz')}
          >
            <option value="ru">RU</option>
            <option value="kz">KZ</option>
          </select>

          {user ? (
            <>
              <Link href="/profile" className="button button-secondary button-small">
                {initials ?? t('profile')}
              </Link>
              <button className="button button-ghost button-small" onClick={() => logout()}>
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="button button-secondary button-small">{t('login')}</Link>
              <Link href="/register" className="button button-small">{t('register')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}