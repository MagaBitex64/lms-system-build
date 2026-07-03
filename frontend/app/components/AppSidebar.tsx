'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { useSidebar } from './SidebarContext'

export default function AppSidebar() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { open, close } = useSidebar()

  return (
    <>
      <div
        className={`sidebar-backdrop${open ? ' open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside className={`app-sidebar${open ? ' open' : ''}`} aria-label="Site navigation">
        <p className="sidebar-section-title">{t('catalog')}</p>
        <Link href="/" className="sidebar-link" onClick={close}>
          <span className="sidebar-icon" aria-hidden="true">⌂</span>
          {t('welcomeBack')}
        </Link>
        <Link href="/courses" className="sidebar-link" onClick={close}>
          <span className="sidebar-icon" aria-hidden="true">▤</span>
          {t('catalog')}
        </Link>
        <Link href="/search" className="sidebar-link" onClick={close}>
          <span className="sidebar-icon" aria-hidden="true">⌕</span>
          {t('search')}
        </Link>

        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <>
            <div className="sidebar-divider" />
            <p className="sidebar-section-title">{t('courseManagement')}</p>
            <Link href="/teacher" className="sidebar-link" onClick={close}>
              <span className="sidebar-icon" aria-hidden="true">✎</span>
              {t('courseManagement')}
            </Link>
          </>
        )}

        {user?.role === 'admin' && (
          <Link href="/admin" className="sidebar-link" onClick={close}>
            <span className="sidebar-icon" aria-hidden="true">▦</span>
            {t('statistics')}
          </Link>
        )}

        <div className="sidebar-divider" />
        <p className="sidebar-section-title">{t('profile')}</p>
        {user ? (
          <Link href="/profile" className="sidebar-link" onClick={close}>
            <span className="sidebar-icon" aria-hidden="true">☺</span>
            {t('profile')}
          </Link>
        ) : (
          <Link href="/login" className="sidebar-link" onClick={close}>
            <span className="sidebar-icon" aria-hidden="true">☺</span>
            {t('login')}
          </Link>
        )}
      </aside>
    </>
  )
}
