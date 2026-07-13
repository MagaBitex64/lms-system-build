'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, LockKeyhole, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui'

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
      await login(email, password)
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
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5 -mr-48 -mt-48"
          style={{
            background: 'radial-gradient(circle, #005f7a 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-5 -ml-48 -mb-48"
          style={{
            background: 'radial-gradient(circle, #005f7a 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Main content */}
      <div className="w-full max-w-[470px] relative z-10">
        {/* Card */}
        <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden">
          <div className="p-8 sm:p-10">
            {/* Logo section */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-primary-soft rounded-2xl">
                <Image
                  src="/logo.jpg"
                  alt="FENOMEN"
                  width={80}
                  height={80}
                  className="object-contain w-14 h-14"
                  priority
                />
              </div>
              <h1 className="text-xl font-semibold text-foreground">FENOMEN School</h1>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t('loginWelcome')}
              </h2>
              <p className="text-muted text-sm leading-relaxed">
                {t('loginSubtitle')}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-5">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2.5">
                  {t('email')}
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    size={18}
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (fieldErrors.email) {
                        setFieldErrors({ ...fieldErrors, email: undefined })
                      }
                    }}
                    placeholder={t('emailPlaceholder')}
                    autoComplete="email"
                    className={`w-full h-14 pl-12 pr-4 rounded-lg border text-foreground placeholder:text-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface ${
                      fieldErrors.email
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-border focus:border-primary focus:ring-primary/10'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-danger font-medium">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2.5">
                  {t('password')}
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    size={18}
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) {
                        setFieldErrors({ ...fieldErrors, password: undefined })
                      }
                    }}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="current-password"
                    className={`w-full h-14 pl-12 pr-12 rounded-lg border text-foreground placeholder:text-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface ${
                      fieldErrors.password
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-border focus:border-primary focus:ring-primary/10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={t('togglePassword')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-danger font-medium">{fieldErrors.password}</p>
                )}
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between gap-4 -mt-1">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-surface border cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-muted group-hover:text-foreground transition-colors">
                    {t('rememberMe')}
                  </span>
                </label>
                <a
                  href="#"
                  className="text-sm text-primary hover:text-primary-hover transition-colors font-medium"
                  onClick={(e) => {
                    e.preventDefault()
                    // Handle forgot password
                  }}
                >
                  {t('forgotPassword')}
                </a>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-lg">
                  <p className="text-xs text-danger font-medium">{error}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full h-14 bg-primary hover:bg-primary-hover active:scale-95 text-primary-foreground font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 mt-6"
              >
                {busy ? t('signingIn') : t('signIn')}
              </button>
            </form>

            {/* Support text */}
            <p className="text-center text-xs text-muted mt-6 px-2 leading-relaxed">
              {t('supportText')}
            </p>
          </div>

          {/* Footer */}
          <div className="px-8 sm:px-10 py-4 bg-surface-muted border-t border-border text-center">
            <p className="text-xs text-muted">{t('copyright')}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
