'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { getToken, api } from '@/lib/api'

function HomeContent() {
  const { t } = useI18n()
  const [user, setUser] = useState<{ full_name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }

    api('/auth/me')
      .then((data) => setUser(data as { full_name: string; role: string }))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-panel card">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="page-home">
      <section className="hero hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Fenomen School</span>
          <h1 className="page-title">{t('appName')}</h1>
          <p className="hero-lead">
            Удобная учебная платформа для школы и вуза — для курсов, заданий, тестов и оценок в одном месте.
          </p>

          <div className="hero-actions">
            <Link href="/courses" className="button button-primary">
              {t('catalog')}
            </Link>
            <Link href="/search" className="button button-secondary">
              {t('search')}
            </Link>
          </div>

          <div className="hero-status">
            <span className="status-pill">{t('courses')}</span>
            <span className="status-pill">{t('grades')}</span>
            <span className="status-pill">{t('homework')}</span>
            <span className="status-pill">{t('search')}</span>
          </div>
        </div>

        <aside className="hero-panel panel-simple hero-panel-card">
          <div className="panel-head">
            <span className="panel-label">{t('dashboard')}</span>
            <h2 className="panel-title">{user ? user.full_name : t('guest')}</h2>
            <p className="text-muted small-text">
              {user ? t(user.role as keyof typeof t) : t('guestWaiting')}
            </p>
          </div>

          <div className="quick-links">
            <Link href="/courses" className="panel-link">{t('catalog')}</Link>
            <Link href="/search" className="panel-link">{t('search')}</Link>
            <Link href="/login" className="panel-link">{t('login')}</Link>
          </div>

          <div className="panel-summary">
            <div className="summary-item">
              <span className="summary-value">14</span>
              <span>{t('courses')}</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">32</span>
              <span>{t('lessons')}</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">3</span>
              <span>{t('pendingRequests')}</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="featured-grid">
        <article className="featured-card card">
          <p className="featured-label">{t('catalog')}</p>
          <h3>Быстрый доступ к курсам</h3>
          <p className="text-muted">Обзор каталога, фильтрация по направлениям и запись за один клик.</p>
        </article>
        <article className="featured-card card">
          <p className="featured-label">{t('grades')}</p>
          <h3>Мониторинг успеваемости</h3>
          <p className="text-muted">Следите за оценками, сдачей тестов и итоговой статистикой.</p>
        </article>
        <article className="featured-card card">
          <p className="featured-label">{t('homework')}</p>
          <h3>Управление заданиями</h3>
          <p className="text-muted">Проверяйте сроки, отправляйте решения и получайте обратную связь.</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card card">
          <div className="card-header">
            <span className="card-chip">{t('courses')}</span>
            <span className="card-count">12</span>
          </div>
          <h3 className="section-title">Текущие курсы</h3>
          <p className="text-muted">Просмотрите свои активные курсы и продолжите обучение.</p>
          <div className="card-actions">
            <Link href="/courses" className="button button-small button-primary">
              {t('viewCourse')}
            </Link>
          </div>
        </article>

        <article className="dashboard-card card">
          <div className="card-header">
            <span className="card-chip">{t('grades')}</span>
            <span className="card-count">87%</span>
          </div>
          <h3 className="section-title">Журнал оценок</h3>
          <p className="text-muted">Следите за прогрессом, итоговыми баллами и динамикой успеваемости.</p>
          <div className="card-actions">
            <Link href="/profile" className="button button-small button-secondary">
              {t('profile')}
            </Link>
          </div>
        </article>

        <article className="dashboard-card card">
          <div className="card-header">
            <span className="card-chip">{t('homework')}</span>
            <span className="card-count">2</span>
          </div>
          <h3 className="section-title">Срочные задания</h3>
          <p className="text-muted">Завершите домашние задания до дедлайна и сохраните высокий балл.</p>
          <div className="card-actions">
            <Link href="/search" className="button button-small button-secondary">
              {t('search')}
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}

export default function Page() {
  return (
    <div className="page-home">
      <HomeContent />
    </div>
  )
}
