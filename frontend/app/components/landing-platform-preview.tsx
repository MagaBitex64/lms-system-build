import Image from 'next/image'
import { BookOpen, Calculator, ClipboardList, Home, Trophy, Atom, GraduationCap } from 'lucide-react'
import styles from '../landing.module.css'

/** Static, non-interactive preview based on the existing student dashboard layout. */
export function PlatformDashboardPreview() {
  return <div className={styles.showcaseLaptop} role="img" aria-label="Fenomen оқушы кабинетінің көрінісі: мәзір, оқу көрсеткіштері және курстар">
    <div className={styles.showcaseLaptopFrame} aria-hidden="true">
      <div className={styles.showcaseDashboard}>
        <div className={styles.showcaseSidebar}>
          <div className={styles.showcasePreviewBrand}><Image src="/logo.jpg" alt="" width={24} height={24} /><b>FENOMEN<small>Оқу платформасы</small></b></div>
          <span className={styles.showcaseSidebarActive}><Home />Шолу</span>
          <span><BookOpen />Курстар каталогы</span><span><Trophy />Рейтинг</span><span><ClipboardList />Сынақ ҰБТ</span>
        </div>
        <div className={styles.showcaseDashboardMain}>
          <div className={styles.showcaseDashboardTop}><span>Платформа бойынша іздеу</span><i>ОҚ</i></div>
          <div className={styles.showcaseWelcome}><strong>Қош келдіңіз!</strong><span>Оқуды жалғастырыңыз</span><small>Курстар каталогы →</small></div>
          <div className={styles.showcaseQuickStats}><span><BookOpen />Курстарым</span><span><GraduationCap />Барлық курстар</span><span><Trophy />Нәтижелер</span></div>
          <b className={styles.showcaseCoursesTitle}>Менің курстарым</b>
          <div className={styles.showcasePreviewCourses}>
            <div><span><Calculator /></span><b>Математика</b><small>Теория және практика</small></div>
            <div><span><Atom /></span><b>Физика</b><small>Формулалар мен есептер</small></div>
          </div>
        </div>
      </div>
      <span className={styles.showcaseLaptopBrand}>FENOMEN</span>
    </div>
    <div className={styles.showcaseLaptopBase} aria-hidden="true"><i /></div>
  </div>
}

export function PlatformFeatureArt({ feature }: { feature: number }) {
  const id = `platform-feature-${feature}`
  const colors = [['#b5d9ff', '#5c92f3', '#3976d9'], ['#ffe4a2', '#fbb64c', '#e39630'], ['#a5efe4', '#38bfa7', '#10967e'], ['#dbc6ff', '#a27de9', '#7953cf']][feature - 1]
  const face = `url(#${id}-face)`
  const paper = `url(#${id}-paper)`
  return <svg viewBox="0 0 150 110" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={colors[0]} /><stop offset=".55" stopColor={colors[1]} /><stop offset="1" stopColor={colors[2]} /></linearGradient>
      <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#dbe8f2" /></linearGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor={colors[2]} floodOpacity=".18" /></filter>
      <radialGradient id={`${id}-floor`}><stop stopColor={colors[1]} stopOpacity=".18" /><stop offset="1" stopColor={colors[0]} stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="79" cy="98" rx="58" ry="10" fill={`url(#${id}-floor)`} />
    <g filter={`url(#${id}-shadow)`}>
      {feature === 1 && <g transform="rotate(-8 78 57)">
        <rect x="37" y="22" width="88" height="61" rx="10" fill={colors[0]} opacity=".65" transform="rotate(12 81 52)" />
        <rect x="28" y="21" width="92" height="65" rx="10" fill={face} stroke={colors[0]} strokeWidth="1.5" />
        <path d="m65 38 23 16q3 2 0 4L65 73q-3 2-3-2V40q0-4 3-2Z" fill={paper} />
        <path d="M36 28h39" stroke="#e3f1ff" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      </g>}
      {feature === 2 && <>
        <g transform="rotate(5 69 52)"><rect x="34" y="14" width="69" height="79" rx="9" fill="#bdd4e5" /><rect x="38" y="18" width="61" height="70" rx="6" fill={paper} />{[29, 48, 67].map(y => <g key={y}><rect x="46" y={y} width="12" height="12" rx="3" fill="#77a7e7" /><path d={`m49 ${y + 6} 3 3 4-6`} stroke="#fff" strokeWidth="1.5" fill="none" /><rect x="64" y={y + 2} width="25" height="3" rx="1.5" fill="#b8cddc" /><rect x="64" y={y + 8} width="18" height="3" rx="1.5" fill="#d0deea" /></g>)}</g>
        <g transform="rotate(35 112 65)"><rect x="105" y="29" width="13" height="56" rx="3" fill={face} /><path d="m105 85 6.5 14 6.5-14Z" fill="#eed4ad" /><path d="m109 94 2.5 5 2.5-5Z" fill="#627787" /><path d="M110 36v43" stroke="#ffe9b3" strokeWidth="2" /></g>
      </>}
      {feature === 3 && <>
        <g transform="rotate(-5 63 53)"><rect x="28" y="12" width="68" height="83" rx="9" fill="#c7dce6" /><rect x="33" y="17" width="58" height="72" rx="6" fill={paper} /><rect x="43" y="27" width="18" height="12" rx="3" fill={face} /><path d="M45 48h34M45 57h28M45 66h32M45 75h23" stroke="#bccfdb" strokeWidth="3" strokeLinecap="round" /></g>
        <rect x="101" y="40" width="13" height="7" rx="2" fill={colors[2]} /><circle cx="107" cy="72" r="25" fill={face} /><circle cx="107" cy="72" r="19" fill={paper} stroke={colors[0]} strokeWidth="2" /><path d="M107 59v14l10 5" stroke={colors[2]} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M107 56v2M123 72h-2M107 88v-2M91 72h2" stroke="#82b5ac" strokeWidth="2" />
      </>}
      {feature === 4 && <>
        {[22, 37, 58].map((height, index) => <g key={height}><rect x={38 + index * 28} y={94 - height} width="21" height={height} rx="5" fill={face} /><ellipse cx={48.5 + index * 28} cy={96 - height} rx="10" ry="3" fill={colors[0]} /></g>)}
        <path d="M32 57q44-7 72-36" fill="none" stroke={colors[1]} strokeWidth="4" strokeLinecap="round" /><path d="m95 17 19-3-5 18Z" fill={face} />
      </>}
    </g>
  </svg>
}
