'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export default function AppFooter() {
  const { t } = useI18n()

  return (
    <footer className="app-footer">
      <div className="container footer-inner">
        <div>
          <p className="footer-brand">Fenomen School</p>
          <p className="text-muted">{t('continueLearning')}</p>
        </div>
        <div className="footer-links">
          <Link href="/courses">{t('courses')}</Link>
          <Link href="/search">{t('search')}</Link>
          <Link href="/login">{t('login')}</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p className="text-muted">© 2026 Fenomen School</p>
          <p className="text-muted">{t('welcomeBack')}</p>
        </div>
      </div>
    </footer>
  )
}
