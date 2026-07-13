'use client'

import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:scale-[0.98]',
  secondary: 'bg-surface text-foreground border border-border shadow-xs hover:bg-surface-muted active:scale-[0.98]',
  outline: 'border border-border bg-transparent text-foreground hover:bg-surface-muted active:scale-[0.98]',
  ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger text-primary-foreground shadow-sm hover:brightness-95 active:scale-[0.98]',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[0.95rem]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const classes = cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>
    return cloneElement(child, { className: cx(classes, child.props.className) })
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

const fieldBase =
  'w-full rounded-lg border border-border bg-surface text-foreground placeholder:text-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, 'h-10 px-3 text-sm', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, 'px-3 py-2.5 text-sm leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldBase, 'h-10 px-3 text-sm', className)} {...props}>
      {children}
    </select>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  )
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-border bg-surface p-5 shadow-xs',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
  children: ReactNode
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-muted text-muted border border-border',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Feedback / states                                                          */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <div className="flex justify-center py-12" role="status" aria-label="Loading">
      <div className={cx('size-6 rounded-full border-2 border-border border-t-primary animate-spin', className)} />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-surface-muted', className)} />
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface py-16 text-center">
      {icon && <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="mx-auto max-w-sm text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-danger/20 bg-danger-soft px-5 py-4 text-sm font-medium text-danger">
      {message}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Composition helpers                                                        */
/* -------------------------------------------------------------------------- */

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div className={cx('animate-fade-in', className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<string, string> = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
  }
  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {icon && <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>}
    </Card>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-muted', className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

export function Avatar({ 
  name, 
  className,
  size = 'md'
}: { 
  name: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base'
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary',
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="text-muted transition-colors hover:text-foreground" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function DropdownMenu({
  open,
  onClose,
  items,
  position = 'right',
}: {
  open: boolean
  onClose: () => void
  items: Array<{
    label: string
    icon?: ReactNode
    onClick: () => void
    destructive?: boolean
    divider?: boolean
  }>
  position?: 'left' | 'right'
}) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cx(
          'absolute top-full z-50 mt-1 rounded-lg border border-border bg-surface shadow-lg',
          position === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {items.map((item, idx) => (
          <div key={idx}>
            {item.divider && <div className="my-1 h-px bg-border" />}
            <button
              onClick={() => {
                item.onClick()
                onClose()
              }}
              className={cx(
                'flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                item.destructive
                  ? 'text-danger hover:bg-red-50/50'
                  : 'text-foreground hover:bg-surface-muted',
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

export function DeletionConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  courseName,
  warning,
  isLoading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  courseName: string
  warning?: string
  isLoading?: boolean
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={!isLoading ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-danger">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted">{description}</p>

          {/* Course name */}
          <div className="rounded-lg bg-surface-muted px-4 py-3">
            <p className="text-sm font-medium text-foreground">«{courseName}»</p>
          </div>

          {/* Warning */}
          {warning && (
            <div className="rounded-lg bg-red-50/30 px-4 py-3">
              <p className="text-xs text-danger">{warning}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            Бас тарту
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {isLoading ? 'Жойылуда...' : 'Курсты жою'}
          </button>
        </div>
      </div>
    </div>
  )
}
