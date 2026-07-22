'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import {
  ArrowRight, Atom, BarChart3, BookOpen, Bot, CalendarCheck, Check,
  ChevronDown, ChevronLeft, ChevronRight, Clock3, ExternalLink, FlaskConical, GraduationCap, History, Laptop,
  Lightbulb, MapPin, Menu, MonitorPlay, Quote, School, Sparkles,
  Trophy, UserRound, X, Zap,
} from 'lucide-react'
import styles from './landing.module.css'

const whatsappUrl = 'https://api.whatsapp.com/send?phone=7474794383'
const mapUrl = 'https://2gis.kz/shymkent/geo/70000001026160761/69.614394,42.304299'

const landingImages = {
  hero: '/landing/hero/students.jpg',
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
  ['Артықшылықтарымыз', 'advantages'], ['Курстар', 'courses'],
  ['Нәтижелеріміз', 'results'], ['Мұғалімдер', 'teachers'],
  ['Байланыс', 'contact'],
] as const

const features = [
  { icon: Zap, title: 'Алғашқы 7 күн тегін', text: 'Сабаққа қатысып, мұғалімнің әдісі мен оқу жүйесін өзіңіз бағалап көріңіз.', tone: 'yellow' },
  { icon: Trophy, title: 'Мақсатқа сай дайындық', text: 'Әр пәнге арналған нақты жоспар, түсінікті сабақ және мол тәжірибе бар.', tone: 'blue' },
  { icon: Laptop, title: 'Өзіңізге ыңғайлы оқу', text: 'Филиалға келіп оқуға да, бейнесабақтарды кез келген уақытта көруге де болады.', tone: 'mint' },
  { icon: CalendarCheck, title: 'Әр аптадағы нәтиже', text: 'Бақылау тестері қай тақырыпты нығайту керек екенін дәл көрсетеді.', tone: 'violet' },
]

const courses = [
  { icon: Lightbulb, title: 'Математикалық сауаттылық', text: 'Логикалық есептерді тез түсініп, дұрыс тәсілмен шешуге дағдыланыңыз.' },
  { icon: History, title: 'Қазақстан тарихы', text: 'Оқиғалар арасындағы байланысты түсініп, даталарды жүйелі түрде есте сақтаңыз.' },
  { icon: BookOpen, title: 'Оқу сауаттылығы', text: 'Мәтіннің негізгі ойын ажыратып, сұраққа дәл жауап беруді меңгеріңіз.' },
  { icon: BarChart3, title: 'Математика', text: 'Теорияны есеппен бекітіп, күрделі тақырыптарды кезең-кезеңімен игеріңіз.' },
  { icon: Atom, title: 'Физика', text: 'Заңдар мен формулалардың мәнін түсініп, оларды есепте дұрыс қолданыңыз.' },
  { icon: Sparkles, title: 'Биология', text: 'Күрделі үдерістерді сызба, кесте және нақты мысалдар арқылы оңай меңгеріңіз.' },
  { icon: FlaskConical, title: 'Химия', text: 'Реакцияларды түсініп, теңдеулер мен есептерді жүйелі түрде орындаңыз.' },
  { icon: Bot, title: 'Информатика', text: 'Алгоритмдік ойлауды дамытып, код жазу мен ақпаратты талдауды үйреніңіз.' },
]

const steps = [
  ['Кеңеске жазылу', 'Өтінім қалдырыңыз — менеджеріміз сізбен хабарласады.'],
  ['Деңгейді анықтау', 'Қазіргі білім деңгейін бағалап, мақсатқа сай дайындық жоспарын ұсынамыз.'],
  ['Курсқа қосылу', 'Әкімші жеке кабинетті ашып, таңдалған курсқа кіруге рұқсат береді.'],
  ['Жүйелі оқу', 'Бейнесабақты көріп, тапсырманы орындайсыз және мұғалімнен кері байланыс аласыз.'],
  ['Нәтижені бақылау', 'Апталық тесттер арқылы өсімді көріп, әлсіз тақырыптарды уақтылы нығайтасыз.'],
]

const platformItems = [
  { icon: UserRound, title: 'Оқушы кабинеті', text: 'Курстар, сабақтар, тапсырмалар мен тест нәтижелері бір жерде жиналған.' },
  { icon: GraduationCap, title: 'Мұғалім кабинеті', text: 'Мұғалім оқу материалдарын жүктейді, тапсырма береді және әр оқушының нәтижесін бақылайды.' },
  { icon: School, title: 'Әкімші панелі', text: 'Оқушылар, мұғалімдер, курстар мен өтінімдер бір жүйе арқылы басқарылады.' },
  { icon: MonitorPlay, title: 'Бейнесабақтар', text: 'Өзіңізге ашылған сабақты кез келген уақытта көріп, күрделі тақырыпты қайталай аласыз.' },
]

const results = [
  { name: 'Жарқынбай Даяна', score: '126 балл', subjects: 'Химия – Биология', quote: 'Түсінбеген тақырыптарымды ретке келтіріп, балымды біртіндеп көтердім.', image: landingImages.results[0] },
  { name: 'Балқыбек Сұңқар', score: '124 балл', subjects: 'География – Математика', quote: 'Әр аптадағы бақылау қай жерге көбірек күш салу керек екенін анық көрсетті.', image: landingImages.results[1] },
  { name: 'Туйчи Шыңғысхан', score: '125 балл', subjects: 'Информатика – Математика', quote: 'Есептің жауабын жаттағаннан гөрі, шешу жолын түсінуді үйрендім.', image: landingImages.results[2] },
  { name: 'Хусайнова Медина', score: '121 балл', subjects: 'Ағылшын тілі – Дүниежүзі тарихы', quote: 'Сабақтың түсіндірілуі мен мұғалімнің қолдауы өзіме деген сенімімді арттырды.', image: landingImages.results[3] },
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
  return <header className={styles.header}><div className={styles.headerInner}><a href="#top" aria-label="Басты бет"><Brand /></a><nav className={`${styles.nav} ${open ? styles.navOpen : ''}`}>{navItems.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}<a className={styles.consultLink} href="#contact" onClick={() => setOpen(false)}>Кеңес алу</a><Link className={styles.loginCta} href="/login" onClick={() => setOpen(false)}>Кіру</Link></nav><button className={styles.menu} onClick={() => setOpen(!open)} aria-label="Мәзірді ашу">{open ? <X /> : <Menu />}</button></div></header>
}

function HeroSection() {
  return <section id="top" className={styles.heroWrap}><div className={styles.hero}><div className={styles.heroCopy}><span className={styles.badge}><Sparkles size={16} /> Бірінші апта — тегін оқу</span><h1>ҰБТ-ға дайындық<br /><em>енді бір жүйеде</em></h1><p>Fenomen.kaz-та курс, бейнесабақ, тапсырма мен нәтижені бақылау бір жерде жиналған. Сіз мақсатқа қарай жүресіз, біз әр қадамды бақылаймыз.</p><div className={styles.heroActions}><a className={styles.primaryButton} href="#contact">Курсқа қосылу <ArrowRight size={18} /></a><a className={styles.ghostButton} href="#courses">Курстарды көру</a><a className={`${styles.whatsappButton} ${styles.heroWhatsapp}`} href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp арқылы жазылу</a></div><div className={styles.heroStats}><span><b>500+</b> оқушы</span><span><b>20+</b> мұғалім</span></div></div><div className={styles.heroVisual}><Picture src={landingImages.hero} alt="Fenomen оқушылары" /><div className={`${styles.floatCard} ${styles.cardTop}`}><CalendarCheck /><span><b>Апталық тест</b><small>Ілгерілеу әр аптада көрінеді</small></span></div><div className={`${styles.floatCard} ${styles.cardBottom}`}><Laptop /><span><b>Онлайн және филиалда</b><small>Өзіңізге ыңғайлы тәсілді таңдаңыз</small></span></div></div></div></section>
}

function FeatureCards() {
  return <section id="advantages" className={styles.section}><SectionHead eyebrow="Неліктен Fenomen?" title="Әр күнгі нақты жоспар" text="Жүйелі сабақ, тәжірибелі мұғалім және нәтижені үнемі бақылау — дайындықтың басты тірегі." /><div className={styles.featureGrid}>{features.map(({ icon: Icon, title, text, tone }) => <article key={title} className={`${styles.featureCard} ${styles[tone]}`}><span className={styles.iconBox}><Icon /></span><h3>{title}</h3><p>{text}</p><span className={styles.cardArrow}><ArrowRight /></span></article>)}</div></section>
}

function CoursesSection() {
  return <section id="courses" className={`${styles.section} ${styles.softSection}`}><SectionHead eyebrow="Бағыттар" title="ҰБТ курстары" text="Міндетті және бейіндік пәндерді бос орынсыз жаттамай, түсініп меңгеріңіз." /><div className={styles.courseGrid}>{courses.map(({ icon: Icon, title, text }) => <article className={styles.courseCard} key={title}><div className={styles.courseTop}><span className={styles.courseIcon}><Icon /></span><span className={styles.courseBadge}>ҰБТ пәні</span></div><h3>{title}</h3><p>{text}</p><a href="#contact">Курсты таңдау <ArrowRight size={16} /></a></article>)}</div></section>
}

function HowItWorksSection() {
  return <section className={styles.section}><SectionHead eyebrow="Барлығы түсінікті" title="Оқу қалай өтеді?" text="Кеңестен бастап, ҰБТ күніне дейін қай қадамды қалай жасау керек екенін біліп отырасыз." /><div className={styles.steps}>{steps.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{text}</p></div>{index < steps.length - 1 && <i />}</article>)}</div></section>
}

function PlatformSection() {
  return <section className={`${styles.section} ${styles.platform}`}><div className={styles.platformIntro}><span className={styles.badgeDark}>FENOMEN ПЛАТФОРМАСЫ</span><h2>Оқуға қажеттінің<br />бәрі бір жерде</h2><p>Оқушы не оқу керек екенін біледі, мұғалім нәтижені көреді, ал ата-ана баласының ілгерілеуінен хабардар болады.</p><a href="#contact" className={styles.primaryButton}>Алғашқы аптаны бастау <ArrowRight size={18} /></a></div><div className={styles.platformGrid}>{platformItems.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
}

function ResultsSection() {
  return <section id="results" className={styles.section}><SectionHead eyebrow="Баллдан бұрын — еңбек" title="Оқушыларымыздың нәтижесі" text="Бұл баллдардың артында күнделікті еңбек, мұғалімнің қолдауы және дұрыс құрылған жоспар тұр." /><div className={styles.resultsGrid}>{results.map((student) => <article className={styles.resultCard} key={student.name}><Picture src={student.image} alt={`${student.name} — ${student.score}`} /><div className={styles.score}>{student.score}</div><div className={styles.resultText}><Quote /><p>«{student.quote}»</p><h3>{student.name}</h3><span>{student.subjects}</span></div></article>)}</div></section>
}

function TeachersSection() {
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
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: 'smooth' })
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    updateControls()
    const onResize = () => updateControls()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return <section id="teachers" className={`${styles.section} ${styles.softSection} ${styles.teachersSection}`}><div className={styles.teachersHeader}><SectionHead eyebrow="Білімі мол ұстаздар" title="Мұғалімдеріміз" text="Әр пән бойынша тәжірибелі ұстаздар оқушының деңгейін ескеріп, нәтижеге бағытталған дайындық жүргізеді." /></div><div className={styles.teachersCarousel}><div ref={trackRef} className={styles.teachersTrack} onScroll={updateControls}>{teachers.map(teacher => <article className={styles.teacherCard} key={teacher.name}><div className={styles.teacherPhoto}><Picture src={teacher.image} alt={`${teacher.name} — ${teacher.subject} мұғалімі`} /><span>{teacher.subject}</span></div><div className={styles.teacherBody}>{teacher.title && <strong className={styles.teacherTitle}>{teacher.title}</strong>}<h3>{teacher.name}</h3><p className={styles.teacherExperience}><Clock3 size={14} /> {teacher.experience}</p><p className={styles.teacherDescription}>{teacher.description}</p><a href="#contact">Толығырақ <ArrowRight size={16} /></a></div></article>)}</div></div><div className={styles.carouselControls}><button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Алдыңғы мұғалім"><ChevronLeft /></button><button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Келесі мұғалім"><ChevronRight /></button></div></section>
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
  return <main className={styles.landing}><LandingHeader /><HeroSection /><FeatureCards /><CoursesSection /><HowItWorksSection /><PlatformSection /><ResultsSection /><TeachersSection /><BranchSection /><LeadFormSection /><FAQSection /><LandingFooter /></main>
}
