'use client'

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import {
  ArrowRight, Atom, BarChart3, BookOpen, Check,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink, FlaskConical, GraduationCap, History, Laptop,
  MapPin, Menu, MonitorPlay, Quote, ClipboardCheck, ClipboardList,
  Trophy, UsersRound, Calculator, Leaf, X,
} from 'lucide-react'
import styles from './landing.module.css'
import { CourseArt } from './components/landing-course-art'
import { ProcessArt } from './components/landing-process-art'
import { PlatformDashboardPreview, PlatformFeatureArt } from './components/landing-platform-preview'

const whatsappUrl = 'https://api.whatsapp.com/send?phone=7474794383'
const mapUrl = 'https://2gis.kz/shymkent/geo/70000001026160761/69.614394,42.304299'

const landingImages = {
  results: [
    '/landing/results/student-1.jpg',
    '/landing/results/student-2.jpg',
    '/landing/results/student-3.jpg',
    '/landing/results/student-4.jpg',
  ],
  teachers: [
    '/landing/teachers/teacher-01.jpg',
    '/landing/teachers/teacher-02.jpg',
    '/landing/teachers/teacher-03.jpg',
    '/landing/teachers/teacher-04.jpg',
    '/landing/teachers/teacher-05.jpg',
    '/landing/teachers/teacher-06.jpg',
    '/landing/teachers/teacher-07.png',
    '/landing/teachers/teacher-08.jpg',
    '/landing/teachers/teacher-09.png',
    '/landing/teachers/teacher-10.jpg',
  ],
}

const navItems = [
  ['Басты бет', 'top'], ['Курстар', 'courses'],
  ['Нәтижелер', 'results'], ['Мұғалімдер', 'teachers'],
  ['Біз туралы', 'branch'],
] as const

const courses = [
  { icon: Calculator, title: 'Математика', text: 'Теория, есептер, ҰБТ форматы', tone: 'Math', art: 'math' },
  { icon: Atom, title: 'Физика', text: 'Формулалар, заңдар және есептер', tone: 'Physics', art: 'physics' },
  { icon: Leaf, title: 'Биология', text: 'Тірі ағзалар, жүйелер және практика', tone: 'Biology', art: 'biology' },
  { icon: FlaskConical, title: 'Химия', text: 'Реакциялар, теңдеулер және есептер', tone: 'Chemistry', art: 'chemistry' },
  { icon: History, title: 'Қазақстан тарихы', text: 'Негізгі оқиғалар, даталар және талдау', tone: 'History', art: 'history' },
  { icon: BookOpen, title: 'Оқу сауаттылығы', text: 'Мәтінмен жұмыс, талдау және жауап стратегиялары', tone: 'Reading', art: 'reading' },
  { icon: BarChart3, title: 'Математикалық сауаттылық', text: 'Күнделікті өмірдегі есептер және логика', tone: 'Literacy', art: 'literacy' },
  { icon: Laptop, title: 'Информатика', text: 'Алгоритмдер, код, ақпараттық технологиялар', tone: 'Informatics', art: 'informatics' },
]

const steps = [
  ['Өтінім қалдыру', 'Өтінім қалдырыңыз. Менеджеріміз сізбен байланысып, оқу бағдарламасы туралы толық ақпарат береді.'],
  ['Деңгейді анықтау', 'Бастапқы білім деңгейіңізді бағалап, мақсатыңызға сай дайындық бағытын таңдаймыз.'],
  ['Оқуды бастау', 'Жеке кабинетіңіз ашылып, таңдаған курсыңыздың сабақтары мен материалдарына қол жеткізесіз.'],
  ['Жүйелі дайындалу', 'Бейнесабақтарды көріп, тапсырмаларды орындайсыз және мұғалімдерден кері байланыс аласыз.'],
  ['Нәтижеге жету', 'Апталық сынақ тесттері арқылы жетістігіңізді бақылап, әлсіз тақырыптарыңызды жақсартасыз.'],
]

const platformItems = [
  { icon: MonitorPlay, title: 'Бейнесабақтар', text: 'Тақырыптарды өзіңізге ыңғайлы уақытта оқып, қайталайсыз.' },
  { icon: ClipboardCheck, title: 'Тапсырмалар', text: 'Әр сабақтан кейін алған біліміңізді тәжірибеде бекітесіз.' },
  { icon: ClipboardList, title: 'Апталық сынақ тесттері', text: 'Біліміңізді тексеріп, ҰБТ форматына дайындаласыз.' },
  { icon: BarChart3, title: 'Нәтижені бақылау', text: 'Жетістіктеріңізді бақылап, қай тақырыпқа көбірек көңіл бөлу керегін анықтайсыз.' },
]

const results = [
  { name: 'Жарқынбай Диана', score: '126 балл', subjects: 'Химия — Биология', quote: 'Түсінбеген тақырыптарымды ретке келтіріп, баллымды біртіндеп көтердім.', image: landingImages.results[0] },
  { name: 'Балқыбек Сұңқар', score: '124 балл', subjects: 'География — Математика', quote: 'Әр аптадағы бақылау қай жерге көбірек күш салу керек екенін анық көрсетті.', image: landingImages.results[1] },
  { name: 'Түйіш Шыңғысхан', score: '125 балл', subjects: 'Информатика — Математика', quote: 'Есептің жауабын жаттағаннан гөрі, шешу жолын түсінуді үйрендім.', image: landingImages.results[2] },
  { name: 'Хусайнова Медина', score: '121 балл', subjects: 'Ағылшын тілі — Дүниежүзі тарихы', quote: 'Сабақтың түсіндірілуі мен мұғалімнің қолдауы өзіме деген сенімімді арттырды.', image: landingImages.results[3] },
]

const teachers = [
  { name: 'Есиркепов Ержан Жанысбайұлы', subject: 'Физика', title: 'Мектеп құрылтайшысы', experience: '20 жыл тәжірибе · Магистр · Педагог-зерттеуші', description: 'Физиканы терең әрі түсінікті жеткізеді. Есеп шығару дағдысын нақты қалыптастыруға мән береді.', image: landingImages.teachers[0] },
  { name: 'Спатаев Нұркен Нұрділдәұлы', subject: 'Дүниежүзі тарихы', experience: '27 жыл тәжірибе · Педагог-шебер', description: 'Тарихи оқиғаларды жүйелі түсіндіріп, есте сақтаудың тиімді әдістерін қолданады.', image: landingImages.teachers[1] },
  { name: 'Нарыбек Нұрәділ Нұрланұлы', subject: 'Математика', experience: '12 жыл тәжірибе · Магистр · Педагог-модератор', description: 'Күрделі тақырыпты қарапайым тілмен түсіндіріп, есеп шығару жылдамдығы мен логиканы дамытады.', image: landingImages.teachers[2] },
  { name: 'Алайдар Бақберген Ерғазыұлы', subject: 'Математика', experience: '8 жыл тәжірибе · Магистр · Педагог-модератор', description: 'Тақырыпты кезең-кезеңімен түсіндіріп, әр оқушының әлсіз тұсымен жеке жұмыс істейді.', image: landingImages.teachers[3] },
  { name: 'Абдулла Бейбіт Болатұлы', subject: 'Физика', experience: '5 жыл тәжірибе', description: 'Физиканы ҰБТ қалыбына сай түсіндіріп, есепті талдау мен формуланы дұрыс қолдануға көңіл бөледі.', image: landingImages.teachers[4] },
  { name: 'Бәйсейіт Ілияс Сұлтанбекұлы', subject: 'Информатика', experience: 'Магистр · Педагог-сарапшы', description: 'Олимпиада және жобалық бағытта тәжірибесі бар. Алгоритм, логика және бағдарламау негіздерін түсіндіреді.', image: landingImages.teachers[5] },
  { name: 'Келесбаев Жақсылық Елубаевич', subject: 'Математика', experience: '15 жыл тәжірибе · Педагог-зерттеуші', description: 'Олимпиадалық және ҰБТ есептерін жүйелі талдап, оқушының нақты нәтижеге жетуіне жағдай жасайды.', image: landingImages.teachers[6] },
  { name: 'Ерімбетов Мұхит Елубекұлы', subject: 'Қазақстан тарихы', experience: '17 жыл тәжірибе · Педагог-зерттеуші', description: 'Тарихи кезеңдер, тұлғалар мен оқиғаларды логикалық байланыспен меңгеруге көмектеседі.', image: landingImages.teachers[7] },
  { name: 'Рахимова Гүлжан Ануарбековна', subject: 'Химия', experience: '15 жыл тәжірибе · Магистр · Педагог-модератор', description: 'Теориялық білім мен есеп шығару дағдысын қатар дамытып, ҰБТ тақырыптарын ретімен түсіндіреді.', image: landingImages.teachers[8] },
  { name: 'Ізден Айгерім Кенжебайқызы', subject: 'География', experience: '9 жыл тәжірибе · Магистр · Педагог-сарапшы', description: 'Карта, ұғым және нақты мысалдар арқылы тақырыпты тез қабылдап, ҰБТ сұрақтарына сенімді жауап беруге көмектеседі.', image: landingImages.teachers[9] },
]

const faqs = [
  ['Алғашқы апта шынымен тегін бе?', 'Иә. Жеті күн ішінде сабаққа қатысып, оқу форматы мен мұғалімнің әдісін бағалай аласыз.'],
  ['Онлайн оқуға бола ма?', 'Әрине. Оқушы жеке кабинеті арқылы бейнесабақтарды көреді. Қаласаңыз, Шымкенттегі филиалға келіп оқуға да болады.'],
  ['Жеке кабинетке қалай кіремін?', 'Курсқа тіркелгеннен кейін әкімші сізге жеке кіру деректерін береді.'],
  ['Курстар қалай ашылады?', 'Төлем мен тіркелу расталған соң, әкімші таңдалған курсты, ал мұғалім қажетті сабақтарды ашады.'],
  ['Филиал қай жерде?', 'Шымкент қаласы, Төле би, 32А.'],
]

function Brand() {
  return <span className={styles.brand}><span className={styles.logo}><Image src="/logo.jpg" alt="Fenomen логотипі" width={46} height={46} /></span><span><b>FENOMEN</b><small>ҰБТ-ға дайындық мектебі</small></span></span>
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a9.7 9.7 0 0 0-8.4 14.6L2.2 22l5.5-1.4A9.8 9.8 0 1 0 12 2Zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3.2.9.9-3.1-.2-.3A8 8 0 1 1 12 19.7Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.1 7.1 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.2-.4c.1-.2 0-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.4-.6 1.6-1.1.2-.6.2-1.1.1-1.2-.1-.2-.3-.2-.5-.3Z" /></svg>
}

function Picture({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <div className={`${styles.picture} ${className}`}>{!failed && <img src={src} alt={alt} onError={() => setFailed(true)} />}{failed && <GraduationCap aria-hidden="true" />}</div>
}

function SectionHead({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text?: string; light?: boolean }) {
  return <div className={`${styles.sectionHead} ${light ? styles.light : ''}`}><span>{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>
}

function LandingHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  function navigateTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
    setOpen(false)
    const target = document.getElementById(id)
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    event.preventDefault()
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${id}`)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}><div className={styles.headerInner}><a href="#top" aria-label="Басты бет" onClick={(event) => navigateTo(event, 'top')}><Brand /></a><nav id="landing-navigation" className={`${styles.nav} ${open ? styles.navOpen : ''}`}>{navItems.map(([label, id]) => <a key={id} href={`#${id}`} onClick={(event) => navigateTo(event, id)}>{label}</a>)}<div className={styles.headerActions}><Link className={styles.loginCta} href="/login" onClick={() => setOpen(false)}>Кіру</Link></div></nav><button className={styles.menu} type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'} aria-expanded={open} aria-controls="landing-navigation">{open ? <X /> : <Menu />}</button></div></header>
}

function HeroSection() {
  return <section id="top" className={styles.heroWrap}><div className={styles.hero}>
    <div className={styles.heroPhoto}><Image src="/landing/hero/approved-students-composite.jpg" alt="Fenomen мектебінің үш түлегі" fill priority quality={90} sizes="100vw" /></div>
    <div className={styles.heroPhotoShade} aria-hidden="true" />
    <div className={styles.heroCopy}>
      <span className={styles.badge}><span className={styles.badgeDot} /> Бірінші апта тегін</span>
      <h1>Түлектерге ҰБТ-ға<br />дайындалуға<br /><em>көмектесіп келеміз</em></h1>
      <p>Курс, бейнесабақ, тапсырма, сынақ тесттері және нәтижені бақылау — бәрі бір платформада.</p>
      <div className={styles.heroActions}><a className={styles.primaryButton} href="#contact">Алғашқы апта тегін <ArrowRight size={20} /></a><a className={styles.ghostButton} href="#courses">Курстарды көру</a></div>
      <div className={styles.subjectTags} aria-label="ҰБТ пәндері"><span><Calculator size={16} />Математика</span><span><Atom size={16} />Физика</span><span><Leaf size={16} />Биология</span><span><FlaskConical size={16} />Химия</span><span><BookOpen size={16} />Қазақстан тарихы</span></div>
    </div>
    <div className={styles.heroFloating}><BarChart3 size={30} /><span><b>Апталық тест</b><small>Нәтижеңді бақыла</small></span></div>
  </div></section>
}

function AnimatedStat({ value, rangeStart, suffix = '' }: { value: number; rangeStart?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [current, setCurrent] = useState(value)

  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - start) / 1250, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setCurrent(Math.round(value * eased))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.35 })
    observer.observe(node)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [value])

  const startValue = rangeStart === undefined ? '' : `${Math.round(rangeStart * current / value)}–`
  const finalLabel = rangeStart === undefined ? `${value}${suffix}` : `${rangeStart}–${value}${suffix}`
  return <span ref={ref} aria-label={finalLabel}>{startValue}{current}{suffix}</span>
}

function ResultsStatsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const cards = sectionRef.current?.querySelectorAll<HTMLElement>('[data-stats-reveal]')
    if (!cards) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add(styles.resultsStatsRevealed)
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.15 })
    cards.forEach((card) => { card.classList.add(styles.resultsStatsPending); observer.observe(card) })
    return () => observer.disconnect()
  }, [])

  return <section ref={sectionRef} className={styles.resultsStats} aria-labelledby="results-stats-title">
    <div className={styles.resultsStatsInner}>
      <div className={styles.resultsStatsIntro}>
        <span className={styles.resultsStatsEyebrow}><i /> FENOMEN ЖЕТІСТІКТЕРІ</span>
        <h2 id="results-stats-title">10 жылдық еңбектің <em>нәтижесі</em></h2>
        <p>Әр оқушының жетістігі — біздің мақтанышымыз.</p>
      </div>
      <div className={styles.resultsStatsGrid}>
        <article className={styles.resultsStatsCard} data-stats-reveal>
          <div className={styles.resultsStatsImage}><Image src="/landing/stats/academic-books.jpg" alt="Оқулықтар, қаламдар және глобус" fill sizes="(max-width: 780px) 100vw, 370px" /></div>
          <div className={styles.resultsStatsCardContent}><span className={styles.resultsStatsIcon}><UsersRound size={27} /></span><strong><AnimatedStat value={1000} suffix="+" /></strong><p>10 жылдан бері оқушы<br />бізді таңдайды</p></div>
        </article>
        <article className={styles.resultsStatsCard} data-stats-reveal>
          <div className={styles.resultsStatsImage}><Image src="/landing/stats/exam-sheet.jpg" alt="ҰБТ жауап парағы мен қалам" fill sizes="(max-width: 780px) 100vw, 370px" /></div>
          <div className={styles.resultsStatsCardContent}><span className={styles.resultsStatsIcon}><Trophy size={27} /></span><strong><AnimatedStat value={140} rangeStart={130} /></strong><p>балл иегерлерін<br />дайындаймыз</p></div>
        </article>
        <article className={styles.resultsStatsCard} data-stats-reveal>
          <div className={styles.resultsStatsImage}><Image src="/landing/stats/graduation-campus.jpg" alt="Университет ғимараты мен академиялық қалпақ" fill sizes="(max-width: 780px) 100vw, 370px" /></div>
          <div className={styles.resultsStatsCardContent}><span className={styles.resultsStatsIcon}><GraduationCap size={28} /></span><strong><AnimatedStat value={90} suffix="%" /></strong><p>түлектеріміз мемлекеттік<br />грант иегері атанды</p></div>
        </article>
      </div>
    </div>
  </section>
}

function CoursesSection() {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-course-reveal]')
    if (!cards) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add(styles.courseVisible)
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12 })
    cards.forEach((card) => { card.classList.add(styles.coursePending); observer.observe(card) })
    return () => observer.disconnect()
  }, [])

  return <section id="courses" className={styles.coursesSection}>
    <div className={styles.coursesInner}>
      <div className={styles.coursesHeader}>
        <div className={styles.coursesHeading}><span>БАҒЫТТАР</span><h2>ҰБТ <em>курстары</em></h2><p>Міндетті және бейіндік пәндерді түсінікті, жүйелі және нәтижеге бағытталған форматта оқыңыз.</p></div>
        <div className={styles.coursesHighlights}><span><GraduationCap size={25} /><b>ҰБТ форматы<small>нақты бағдарлама</small></b></span><span><BarChart3 size={25} /><b>Тәжірибелі<small>мұғалімдер</small></b></span><span><BookOpen size={25} /><b>Жүйелі оқу<small>қадам-қадаммен</small></b></span></div>
      </div>
      <div ref={gridRef} className={styles.courseGrid}>{courses.map(({ icon: Icon, title, text, tone, art }, index) => <div className={styles.courseRevealSlot} data-course-reveal key={title} style={{ transitionDelay: `${index * 65}ms` }}><article className={`${styles.courseCard} ${styles[`courseTone${tone}`]}`}><span className={styles.courseIcon}><Icon size={26} /></span><div className={styles.courseArtwork}><CourseArt subject={art} /></div><div className={styles.courseCardCopy}><h3>{title}</h3><p>{text}</p></div><a href="#contact"><span>Курсты таңдау <ArrowRight size={17} /></span><span className={styles.courseArrowCircle}><ArrowRight size={21} /></span></a></article></div>)}</div>
    </div>
  </section>
}

function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      section.classList.add(styles.processRevealed)
      observer.disconnect()
    }, { threshold: 0.08 })
    section.classList.add(styles.processPending)
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return <section ref={sectionRef} className={styles.processSection} aria-labelledby="process-title">
    <div className={styles.processInner}>
      <div className={styles.processHeading}>
        <span>5 ҚАРАПАЙЫМ ҚАДАМ</span>
        <h2 id="process-title">Fenomen-де <em>оқу</em> қалай өтеді?</h2>
        <p>Өтінім қалдырудан бастап ҰБТ нәтижесіне дейін — әр қадамыңызда сізге қолдау көрсетеміз.</p>
      </div>
      <ol className={styles.processTimeline}>{steps.map(([title, text], index) => <li key={title}>
        <span className={styles.processNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <article className={styles.processCard}>
          <div className={styles.processIllustration}><ProcessArt step={index + 1} /></div>
          <h3>{title}</h3><p>{text}</p>
        </article>
      </li>)}</ol>
    </div>
  </section>
}

function PlatformSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      section.classList.add(styles.showcaseRevealed)
      observer.disconnect()
    }, { threshold: 0.08 })
    section.classList.add(styles.showcasePending)
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return <section ref={sectionRef} className={styles.platformShowcaseWrap} aria-labelledby="platform-showcase-title">
    <div className={styles.platformShowcase}>
      <div className={styles.showcaseCopy}>
        <span className={styles.showcaseEyebrow}><i />FENOMEN ПЛАТФОРМАСЫ</span>
        <h2 id="platform-showcase-title">Дайындыққа қажеттінің бәрі <em>бір жерде</em></h2>
        <p>Бейнесабақтар, тапсырмалар, сынақ тесттері және оқу нәтижелері — барлығы бір платформада.</p>
        <a href="#contact" className={`${styles.primaryButton} ${styles.showcaseCta}`}>Алғашқы аптаны бастау <ArrowRight size={18} /></a>
      </div>
      <PlatformDashboardPreview />
      <div className={styles.showcaseFeatures}>{platformItems.map(({ icon: Icon, title, text }, index) => <article className={`${styles.showcaseFeature} ${styles[`showcaseTone${index + 1}`]}`} key={title}>
        <div className={styles.showcaseFeatureVisual}><span><Icon size={25} /></span><PlatformFeatureArt feature={index + 1} /></div>
        <h3>{title}</h3><p>{text}</p>
      </article>)}</div>
    </div>
  </section>
}

function ResultsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const section = sectionRef.current
    if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        section.classList.add(styles.studentResultsRevealed)
        observer.disconnect()
      }
    }, { threshold: 0.08 })
    section.classList.add(styles.studentResultsPending)
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return <section ref={sectionRef} id="results" className={styles.studentResults} aria-labelledby="student-results-title">
    <div className={styles.studentResultsInner}>
      <div className={styles.studentResultsHeading}>
        <span className={styles.studentResultsEyebrow}>НАҚТЫ НӘТИЖЕЛЕР</span>
        <h2 id="student-results-title">Оқушыларымыздың <em>жетістіктері</em></h2>
        <p>Әр нәтиженің артында жүйелі дайындық, ұстаздардың қолдауы және оқушының еңбегі бар.</p>
      </div>
      <div className={styles.studentResultsGrid}>
        {results.map((student) => <article className={styles.studentResultCard} key={student.name}>
          <div className={styles.studentResultPhoto}>
            <Image src={student.image} alt={student.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 25vw" />
            <strong className={styles.studentResultScore}>{student.score}</strong>
          </div>
          <div className={styles.studentResultContent}>
            <Quote aria-hidden="true" className={styles.studentResultQuoteIcon} />
            <blockquote>{student.quote}</blockquote>
            <div className={styles.studentResultIdentity}><h3>{student.name}</h3><p>{student.subjects}</p></div>
          </div>
        </article>)}
      </div>
    </div>
  </section>
}

function TeachersSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  function updateControls() {
    const track = trackRef.current
    if (!track) return
    setCanPrev(track.scrollLeft > 4)
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
  }

  function move(direction: -1 | 1) {
    const track = trackRef.current
    const card = track?.firstElementChild as HTMLElement | null
    if (!track || !card) return
    const gap = Number.parseFloat(getComputedStyle(track).columnGap || '16')
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    updateControls()
    const onResize = () => updateControls()
    window.addEventListener('resize', onResize)
    const section = sectionRef.current
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && section) {
        section.classList.add(styles.facultyRevealed)
        observer.disconnect()
      }
    }, { threshold: 0.08 })
    if (section && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      section.classList.add(styles.facultyPending)
      observer.observe(section)
    }
    return () => { window.removeEventListener('resize', onResize); observer.disconnect() }
  }, [])

  return <section ref={sectionRef} id="teachers" className={styles.facultySection} aria-labelledby="faculty-title">
    <div className={styles.facultyInner}>
      <div className={styles.facultyHeader}>
        <div className={styles.facultyHeading}>
          <span className={styles.facultyEyebrow}>БІЛІКТІ ҰСТАЗДАР</span>
          <h2 id="faculty-title">Мұғалімд<em>еріміз</em></h2>
          <p>Тәжірибелі ұстаздарымыз күрделі тақырыптарды түсінікті жеткізіп, әр оқушының нәтижеге бағытталған дайындығына көмектеседі.</p>
        </div>
        <div className={styles.facultyControls}>
          <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Алдыңғы мұғалім"><ChevronLeft /></button>
          <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Келесі мұғалім"><ChevronRight /></button>
        </div>
      </div>
      <div ref={trackRef} className={styles.facultyTrack} onScroll={updateControls} role="region" aria-label="Мұғалімдер тізімі" tabIndex={0}>
        {teachers.map(teacher => {
          const [experience, ...qualifications] = teacher.experience.split(' · ')
          return <article className={styles.facultyCard} key={teacher.name}>
            <div className={styles.facultyPhoto}><Picture src={teacher.image} alt={`${teacher.name} — ${teacher.subject} мұғалімі`} /><span>{teacher.subject}</span></div>
            <div className={styles.facultyBody}>
              <div className={styles.facultyIdentity}>{teacher.title && <strong className={styles.facultyFounder}>{teacher.title}</strong>}<h3>{teacher.name}</h3></div>
              <div className={styles.facultyExperience}><Clock3 size={20} aria-hidden="true" /><p><strong>{experience}</strong>{qualifications.length > 0 && <span>{qualifications.join(' · ')}</span>}</p></div>
              <p className={styles.facultyDescription}>{teacher.description}</p>
              <a href="#contact">Толығырақ <ArrowRight size={20} aria-hidden="true" /></a>
            </div>
          </article>
        })}
      </div>
    </div>
  </section>
}

function BranchSection() {
  return <section id="branch" className={styles.section}><div className={styles.branch}><div className={styles.branchMap}><iframe src="/2gis-map.html" width="100%" height="100%" style={{ border: 0, minHeight: '440px' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><div className={styles.branchCopy}><span className={styles.kicker}>ШЫМКЕНТТЕГІ FENOMEN</span><h2>Филиалға келіп оқыңыз</h2><p>Бетпе-бет сабақты қаласаңыз, Шымкенттегі филиалымызға келіңіз. Мұнда тыныш оқу ортасы, мұғаліммен тікелей жұмыс және тұрақты бақылау бар.</p><a className={styles.address} href={mapUrl} target="_blank" rel="noreferrer"><MapPin /><span><small>Мекенжайымыз</small><b>Шымкент қаласы, Төле би, 32А</b></span><ExternalLink size={16} /></a><div className={styles.branchActions}><a className={styles.whatsappButton} href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp арқылы жазылу</a><a className={styles.outlineButton} href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Картадан көру</a></div></div></div></section>
}

function LeadFormSection() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setSent(false)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const next: Record<string, string> = {}
    if (!String(form.get('name') || '').trim()) next.name = 'Аты-жөніңізді енгізіңіз'
    if (!String(form.get('phone') || '').trim()) next.phone = 'Телефон нөмірін енгізіңіз'
    if (!String(form.get('course') || '').trim()) next.course = 'Курсты таңдаңыз'
    setErrors(next)
    if (Object.keys(next).length === 0) {
      setBusy(true)
      setSent(false)
      try {
        await api('/leads', {
          body: {
            name: String(form.get('name') || '').trim(),
            phone: String(form.get('phone') || '').trim(),
            course: String(form.get('course') || '').trim(),
            branch: 'Шымкент, Төле би, 32А',
          },
        })
        setSent(true)
        formElement.reset()
      } catch {
        setErrors({ form: 'Өтінімді жіберу мүмкін болмады. Қайтадан көріңіз.' })
        window.alert('Өтінімді жіберу мүмкін болмады. Қайтадан көріңіз.')
      } finally {
        setBusy(false)
      }
    }
  }
  return <section id="contact" className={`${styles.section} ${styles.contact}`}><div className={styles.contactCopy}><span className={styles.badgeDark}>БІРІНШІ ҚАДАМ</span><h2>Кеңес алуға өтінім қалдырыңыз</h2><p>Менеджеріміз сізбен хабарласып, оқу тәсілі, курс мазмұны мен филиал туралы сұрақтарыңызға жауап береді.</p><ul><li><Check /> Деңгейіңізге сай дайындық бағыты</li><li><Check /> Өзіңізге ыңғайлы оқу тәсілі</li><li><Check /> Алғашқы апта тегін</li></ul><a className={styles.whatsappButton} href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp арқылы жазылу</a></div><form className={styles.form} onSubmit={submit} noValidate><label>Аты-жөніңіз<input name="name" placeholder="Аты-жөніңізді жазыңыз" />{errors.name && <small>{errors.name}</small>}</label><label>Телефон нөміріңіз<input name="phone" type="tel" placeholder="+7 (___) ___-__-__" />{errors.phone && <small>{errors.phone}</small>}</label><label>Қызықтырған курс<select name="course" defaultValue=""><option value="" disabled>Курсты таңдаңыз</option>{courses.map(course => <option key={course.title}>{course.title}</option>)}</select>{errors.course && <small>{errors.course}</small>}</label><label>Филиал<input value="Шымкент, Төле би, 32А" readOnly /></label><button className={styles.primaryButton}>Өтінім қалдыру <ArrowRight size={18} /></button>{sent && <p className={styles.success}><Check /> Өтініміңіз қабылданды! Менеджеріміз жақын арада хабарласады.</p>}</form></section>
}

function FAQSection() {
  return <section className={styles.section}><SectionHead eyebrow="Сұрақ пен жауап" title="Жиі қойылатын сұрақтар" /><div className={styles.faq}>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<ChevronDown /></summary><p>{answer}</p></details>)}</div></section>
}

function LandingFooter() {
  return <footer className={styles.footer}><div className={styles.footerMain}><div className={styles.footerBrand}><Brand /><p>ҰБТ-ға дайындықты жоспарлы, түсінікті және нәтижелі ететін оқу ортасы.</p><a className={`${styles.whatsappButton} ${styles.footerWhatsapp}`} href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp-қа жазу</a></div><div><h3>Fenomen.kaz</h3><a href="#courses">Курстар</a><a href="#teachers">Мұғалімдер</a><a href="#results">Нәтижелер</a></div><div><h3>Мекенжай</h3><a href={mapUrl} target="_blank" rel="noreferrer">Шымкент филиалы</a><span>Төле би, 32А</span></div><div><h3>Байланыс</h3><a href={whatsappUrl} target="_blank" rel="noreferrer">+7 747 794 38 83</a><a href="#contact">Instagram</a></div></div><div className={styles.footerBottom}>© 2026 Fenomen.kaz. Барлық құқықтар қорғалған.<a href="#top">Жоғарыға көтерілу ↑</a></div></footer>
}

export default function HomePage() {
  return <main className={styles.landing}><LandingHeader /><HeroSection /><ResultsStatsSection /><CoursesSection /><HowItWorksSection /><PlatformSection /><ResultsSection /><TeachersSection /><BranchSection /><LeadFormSection /><FAQSection /><LandingFooter /></main>
}
