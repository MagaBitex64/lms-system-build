'use client'

import Link from 'next/link'
import useSWR from 'swr'
import type { ReactNode } from 'react'
import { ArrowRight, BookOpen, ClipboardList, Clock3, GraduationCap, History, LibraryBig, PlusCircle, Users, Zap } from 'lucide-react'
import { fetcher } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { useI18n } from '@/lib/i18n'
import { Avatar, Badge, EmptyState, ErrorState, Spinner } from '@/components/ui'
import type { CourseSummary } from '@/components/course-card'
import styles from './admin-home.module.css'

type Stats = { total_users: number; total_courses: number; active_enrollments: number; total_groups: number }
type Lead = { id: number; name: string; course: string; status: 'new' | 'contacted' | 'closed'; created_at: string }
type Activity = { id: number; actor_name: string; summary: string; created_at: string }
type Props = {
  firstName: string
  stats?: Stats
  statsLoading: boolean
  statsError: boolean
  courses: CourseSummary[]
  coursesLoading: boolean
  coursesError: boolean
}

const leadStatuses = {
  new: { label: 'Жаңа', tone: 'warning' },
  contacted: { label: 'Байланыстық', tone: 'primary' },
  closed: { label: 'Жабылды', tone: 'neutral' },
} as const

export function AdminDashboardHome({ firstName, stats, statsLoading, statsError, courses, coursesLoading, coursesError }: Props) {
  const { t } = useI18n()
  // Read-only previews reuse the same endpoints as the existing management pages.
  const leads = useSWR<{ items: Lead[] }>('/admin/leads', fetcher)
  const activity = useSWR<{ items: Activity[] }>('/admin/audit-logs?page=1&per_page=4', fetcher)
  const recentLeads = [...(leads.data?.items ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4)
  const metrics = [
    { label: t('totalUsers'), value: stats?.total_users, icon: Users, href: '/admin/users', tone: styles.blue },
    { label: t('totalCourses'), value: stats?.total_courses, icon: BookOpen, href: '/teacher', tone: styles.green },
    { label: t('activeEnrollments'), value: stats?.active_enrollments, icon: Users, href: '/teacher', tone: styles.amber },
    { label: t('groups'), value: stats?.total_groups, icon: GraduationCap, href: '/admin', tone: styles.violet },
  ]
  const actions = [
    { title: t('newCourse'), description: 'Курс қосу', icon: BookOpen, href: '/teacher/courses/new', tone: styles.blue },
    { title: t('users'), description: 'Пайдаланушыларды басқару', icon: Users, href: '/admin/users', tone: styles.green },
    { title: t('myCourses'), description: 'Курстарды басқару', icon: GraduationCap, href: '/teacher', tone: styles.amber },
    { title: t('leadRequests'), description: 'Өтінімдерді қарау', icon: ClipboardList, href: '/admin/leads', tone: styles.violet },
  ]

  return <div className={styles.dashboard}>
    <section className={styles.welcome} aria-labelledby="admin-welcome">
      <div className={styles.welcomeCopy}>
        <p className={styles.eyebrow}>БАСҚАРУ ПАНЕЛІ</p>
        <h1 id="admin-welcome">Қош келдіңіз{firstName ? `, ${firstName}` : ''}!</h1>
        <p>Мектебіңіздің жұмысы туралы негізгі көрсеткіштер<br className={styles.desktopBreak} /> мен соңғы жаңалықтар осы жерде.</p>
      </div>
      <div className={styles.motto}><span className={`${styles.icon} ${styles.blue}`}><LibraryBig size={23} aria-hidden="true" /></span><div><p>Білімді ұрпақ —<br />жарқын болашақтың кепілі.</p><small>FENOMEN SCHOOL</small></div></div>
    </section>

    <section aria-label="Платформа көрсеткіштері" aria-busy={statsLoading}>
      {statsError && <ErrorState message="Көрсеткіштерді жүктеу мүмкін болмады." />}
      <div className={styles.metrics}>
        {metrics.map(({ label, value, icon: Icon, href, tone }) => <Link key={label} href={href} className={styles.metric}>
          <span className={`${styles.icon} ${tone}`}><Icon size={23} aria-hidden="true" /></span>
          <span className={styles.metricLabel}>{label}</span><ArrowRight className={styles.metricArrow} size={17} aria-hidden="true" />
          <strong aria-label={statsLoading ? 'Жүктелуде' : undefined}>{statsLoading || value === undefined ? '—' : value.toLocaleString('kk-KZ')}</strong>
        </Link>)}
      </div>
    </section>

    <div className={styles.columns}>
      <div className={styles.column}>
        <section className={styles.panel} aria-labelledby="admin-actions">
          <PanelHeading id="admin-actions" icon={<Zap size={22} />} title={t('quickActions')} href="/admin" linkLabel="Басқару" />
          <div className={styles.actions}>
            {actions.map(({ title, description, icon: Icon, href, tone }) => <Link key={href} href={href} className={`${styles.action} ${tone}`}>
              <span className={styles.icon}><Icon size={22} aria-hidden="true" /></span><ArrowRight className={styles.actionArrow} size={18} aria-hidden="true" />
              <strong>{title}</strong><small>{description}</small>
            </Link>)}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="admin-courses">
          <PanelHeading id="admin-courses" icon={<BookOpen size={22} />} title={t('recentCourses')} href="/teacher" linkLabel={t('seeAll')} />
          {coursesLoading ? <Spinner /> : coursesError ? <ErrorState message="Курстарды жүктеу мүмкін болмады." /> : !courses.length ?
            <EmptyState icon={<BookOpen size={23} />} title={t('noCoursesYet')} action={<Link className={styles.emptyLink} href="/teacher/courses/new"><PlusCircle size={16} />{t('newCourse')}</Link>} /> :
            <div className={styles.courseList}>{courses.slice(0, 6).map((course, index) => <Link key={course.id} href={`/courses/${course.id}`} className={styles.course}>
              <span className={`${styles.courseArt} ${[styles.blue, styles.green, styles.violet][index % 3]}`}><BookOpen size={29} aria-hidden="true" /></span>
              <div className={styles.courseInfo}><h3>{course.title}</h3><div className={styles.courseMeta}>
                <span><Users size={14} aria-hidden="true" />{course.student_count} {t('studentsCount')}</span>
                <span><LibraryBig size={14} aria-hidden="true" />{course.item_count} {t('itemsCount')}</span>
              </div></div>
              <Badge tone={course.is_published ? 'success' : 'neutral'}>{course.is_published ? t('published') : t('draft')}</Badge>
              <ArrowRight className={styles.courseArrow} size={18} aria-hidden="true" />
            </Link>)}</div>}
        </section>
      </div>

      <div className={styles.column}>
        <section className={styles.panel} aria-labelledby="admin-leads">
          <PanelHeading id="admin-leads" icon={<ClipboardList size={22} />} title={t('leadRequests')} href="/admin/leads" linkLabel={t('seeAll')} />
          {leads.isLoading ? <Spinner /> : leads.error ? <ErrorState message="Өтінімдерді жүктеу мүмкін болмады." /> : !recentLeads.length ?
            <EmptyState icon={<ClipboardList size={23} />} title="Әзірге өтінімдер жоқ" hint="Жаңа кеңес өтінімдері осында көрсетіледі." /> :
            <div className={styles.list}>{recentLeads.map(lead => <Link key={lead.id} href="/admin/leads" className={styles.lead}>
              <Avatar name={lead.name} size="sm" />
              <div className={styles.listCopy}><h3>{lead.name}</h3><p>{lead.course}</p><time dateTime={lead.created_at}>{formatDate(lead.created_at)}</time></div>
              <Badge tone={leadStatuses[lead.status].tone}>{leadStatuses[lead.status].label}</Badge>
            </Link>)}</div>}
        </section>

        <section className={styles.panel} aria-labelledby="admin-activity">
          <PanelHeading id="admin-activity" icon={<Clock3 size={22} />} title="Соңғы әрекеттер" href="/admin/audit-logs" linkLabel={t('seeAll')} />
          {activity.isLoading ? <Spinner /> : activity.error ? <ErrorState message="Әрекеттерді жүктеу мүмкін болмады." /> : !activity.data?.items.length ?
            <EmptyState icon={<History size={23} />} title="Әзірге әрекеттер жоқ" hint="Маңызды өзгерістер журналда көрсетіледі." /> :
            <div className={styles.list}>{activity.data.items.map(item => <Link key={item.id} href="/admin/audit-logs" className={styles.activity}>
              <span className={`${styles.icon} ${styles.blue}`}><History size={20} aria-hidden="true" /></span>
              <div className={styles.listCopy}><h3>{item.summary}</h3><p>{item.actor_name}</p><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></div>
            </Link>)}</div>}
        </section>
      </div>
    </div>
  </div>
}

function PanelHeading({ id, icon, title, href, linkLabel }: { id: string; icon: ReactNode; title: string; href: string; linkLabel: string }) {
  return <div className={styles.panelHeading}><h2 id={id}>{icon}{title}</h2><Link href={href}>{linkLabel}<ArrowRight size={16} aria-hidden="true" /></Link></div>
}
