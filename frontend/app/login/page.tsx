'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, LockKeyhole, Eye, EyeOff, GraduationCap, BarChart3, UsersRound, Headphones, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errors.email = t('emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('emailInvalid')
    }
    if (!password) {
      errors.password = t('passwordRequired')
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setBusy(true)
    try {
      await login(email, password, rememberMe)
      router.replace('/dashboard')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errorOccurred')
      if (errorMessage.includes('Invalid') || errorMessage.includes('invalid')) {
        setError(t('invalidCredentials'))
      } else if (errorMessage.includes('blocked') || errorMessage.includes('lock')) {
        setError(t('accountLocked'))
      } else {
        setError(errorMessage || t('serverError'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.introduction} aria-labelledby="login-introduction">
          <div className={styles.brand}>
            <Image src="/logo.jpg" alt="FENOMEN" width={90} height={90} priority />
            <div><strong>FENOMEN</strong><span>School</span></div>
          </div>
          <p className={styles.eyebrow}>БІЛІМ ӘРҚАШАН ЖАҢА<br />МҮМКІНДІКТЕРГЕ АПАРАДЫ</p>
          <h2 id="login-introduction">Өзіңіздің<br />оқу жолыңызды<br />бастауға <span>кірісіңіз</span></h2>
          <p className={styles.description}>Жеке кабинетке кіріп, курстарыңызды жалғастырыңыз, материалдарға қол жеткізіңіз және нәтижеге жақындаңыз.</p>
          <ul className={styles.benefits}>
            <li><span className={styles.blueIcon}><GraduationCap aria-hidden="true" /></span><div><strong>Сапалы курстар</strong><p>Тәжірибелі мұғалімдерден</p></div></li>
            <li><span className={styles.greenIcon}><BarChart3 aria-hidden="true" /></span><div><strong>Жеке оқу жоспары</strong><p>Деңгейіңізге сай</p></div></li>
            <li><span className={styles.yellowIcon}><UsersRound aria-hidden="true" /></span><div><strong>Қайда болсаңыз да қолжетімді</strong><p>Кез келген құрылғыдан</p></div></li>
          </ul>
        </section>
        <section className={styles.card} aria-labelledby="login-title">
          <div className={styles.formBrand}>
            <Image src="/logo.jpg" alt="FENOMEN" width={76} height={76} priority />
            <strong>FENOMEN School</strong>
          </div>
          <header className={styles.welcome}>
            <h1 id="login-title">{t('loginWelcome')}</h1>
            <p>{t('loginSubtitle')}</p>
          </header>
          <form onSubmit={onSubmit} className={styles.form} aria-busy={busy}>
            <div className={styles.field}>
              <label htmlFor="email">{t('email')}</label>
              <div className={styles.inputWrapper}>
                <Mail className={styles.inputIcon} size={21} aria-hidden="true" />
                <input id="email" type="email" value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) {
                      setFieldErrors({ ...fieldErrors, email: undefined })
                    }
                  }}
                  placeholder={t('emailPlaceholder')} autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
              </div>
              {fieldErrors.email && <p id="email-error" role="alert" className={styles.fieldError}>{fieldErrors.email}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor="password">{t('password')}</label>
              <div className={styles.inputWrapper}>
                <LockKeyhole className={styles.inputIcon} size={21} aria-hidden="true" />
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) {
                      setFieldErrors({ ...fieldErrors, password: undefined })
                    }
                  }}
                  placeholder={t('passwordPlaceholder')} autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={t('togglePassword')} aria-pressed={showPassword} className={styles.passwordToggle}>
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
              {fieldErrors.password && <p id="password-error" role="alert" className={styles.fieldError}>{fieldErrors.password}</p>}
            </div>
            <div className={styles.options}>
              <label><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /><span>{t('rememberMe')}</span></label>
              <Link href="/forgot-password">{t('forgotPassword')}</Link>
            </div>
            {error && <div role="alert" className={styles.error}>{error}</div>}
            <button type="submit" disabled={busy} className={styles.submit}>
              {busy ? t('signingIn') : t('signIn')}<ArrowRight size={23} aria-hidden="true" />
            </button>
          </form>
          <div className={styles.separator}><span>немесе</span></div>
          <div className={styles.support}>
            <span className={styles.supportIcon}><Headphones size={25} aria-hidden="true" /></span>
            <p><strong>Кіру кезінде мәселе туындады ма?</strong><span>Қолдау қызметіне хабарласыңыз</span></p>
          </div>
          <p className={styles.copyright}>{t('copyright')}</p>
        </section>
      </div>
    </main>
  )
}
