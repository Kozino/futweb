import {
  forwardRef, useState, useId, useEffect, useRef, type ReactNode, type ElementType,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes,
  type TextareaHTMLAttributes, type HTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Icon, type IconName } from './Icon'

/* ============================ Button ============================ */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm',
  secondary: 'bg-ink-100 text-ink-900 hover:bg-ink-200 active:bg-ink-100',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  gold: 'bg-gold-400 text-ink-900 hover:bg-gold-300 shadow-sm',
  outline: 'border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50',
  dark: 'bg-ink-900 text-white hover:bg-ink-850',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  xl: 'h-13 px-6 text-base gap-2.5 rounded-xl py-3.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.985]',
        VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  )
})

/* ============================ Inputs ============================ */
interface FieldWrapProps { label?: string; error?: string; hint?: string; required?: boolean; htmlFor?: string; children: ReactNode; className?: string }

export function Field({ label, error, hint, required, htmlFor, children, className }: FieldWrapProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={htmlFor} className="fw-label">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
          <Icon name="alert" size={13} />{error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string
  icon?: IconName; suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, suffix, className, id, required, ...rest }, ref,
) {
  const autoId = useId(); const fid = id ?? autoId
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={fid}>
      <div className="relative">
        {icon && <Icon name={icon} size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />}
        <input
          ref={ref} id={fid} required={required}
          aria-invalid={!!error}
          className={cn('fw-input', icon && 'pl-10', suffix && 'pr-11', error && 'fw-input-error', className)}
          {...rest}
        />
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </Field>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string; options: { value: string; label: string; disabled?: boolean }[]
  placeholder?: string
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, required, ...rest }, ref,
) {
  const autoId = useId(); const fid = id ?? autoId
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={fid}>
      <div className="relative">
        <select ref={ref} id={fid} required={required}
          className={cn('fw-input cursor-pointer appearance-none pr-10', error && 'fw-input-error', className)} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      </div>
    </Field>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string; hint?: string; maxChars?: number
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, maxChars, className, id, required, value, ...rest }, ref,
) {
  const autoId = useId(); const fid = id ?? autoId
  const len = typeof value === 'string' ? value.length : 0
  return (
    <Field label={label} error={error} required={required} htmlFor={fid}
      hint={maxChars ? `${len}/${maxChars}` : hint}>
      <textarea ref={ref} id={fid} value={value} required={required}
        className={cn('fw-input min-h-[96px] resize-y', error && 'fw-input-error', className)} {...rest} />
    </Field>
  )
})

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-red-500' : 'bg-ink-300')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4.5 left-0.5' : 'left-0.5')}
          style={{ transform: checked ? 'translateX(1rem)' : 'translateX(0)' }} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-ink-900">{label}</span>}
          {description && <span className="block text-xs text-ink-500">{description}</span>}
        </span>
      )}
    </label>
  )
}

/* ============================ Badge ============================ */
type BadgeTone = 'neutral' | 'red' | 'gold' | 'trust' | 'blue' | 'warn' | 'dark' | 'green'
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  red: 'bg-red-50 text-red-700',
  gold: 'bg-gold-50 text-gold-700',
  trust: 'bg-trust-50 text-trust-700',
  blue: 'bg-blue-50 text-blue-700',
  warn: 'bg-amber-50 text-amber-700',
  dark: 'bg-ink-900 text-white',
  green: 'bg-emerald-50 text-emerald-700',
}

export function Badge({ tone = 'neutral', icon, children, className, size = 'md' }:
  { tone?: BadgeTone; icon?: IconName; children: ReactNode; className?: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
      size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
      BADGE_TONES[tone], className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 11 : 13} />}
      {children}
    </span>
  )
}

/* ============================ Card ============================ */
export function Card({ children, className, hover, as: As = 'div', ...rest }:
  { children: ReactNode; className?: string; hover?: boolean; as?: ElementType } & HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={cn('fw-card', hover && 'fw-card-hover', className)} {...rest}>{children}</As>
  )
}
export function CardHeader({ title, subtitle, action, className }:
  { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ============================ Modal ============================ */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }:
  { open: boolean; onClose: () => void; title?: string; description?: string; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cn(
          'relative z-10 max-h-[92vh] w-full animate-scale-in overflow-y-auto bg-white shadow-2xl',
          'rounded-t-3xl sm:rounded-2xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl')}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-ink-900">{title}</h2>
              {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
            </div>
            <button onClick={onClose} className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ============================ Stats & misc ============================ */
export function Stat({ label, value, sub, icon, tone = 'default', trend }:
  { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: 'default' | 'red' | 'trust' | 'gold'; trend?: number }) {
  const toneCls = { default: 'bg-ink-100 text-ink-600', red: 'bg-red-50 text-red-500', trust: 'bg-trust-50 text-trust-500', gold: 'bg-gold-50 text-gold-600' }[tone]
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
          <p className="mt-1.5 fw-stat tnum">{value}</p>
          {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
        </div>
        {icon && <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', toneCls)}><Icon name={icon} size={17} /></span>}
      </div>
      {typeof trend === 'number' && (
        <div className={cn('mt-2 inline-flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-trust-600' : 'text-red-600')}>
          <Icon name={trend >= 0 ? 'arrow-up' : 'arrow-down'} size={12} />
          {Math.abs(trend)}% vs last month
        </div>
      )}
    </Card>
  )
}

export function ProgressBar({ value, max = 100, tone = 'red', size = 'md', showLabel, className }:
  { value: number; max?: number; tone?: 'red' | 'trust' | 'gold' | 'ink'; size?: 'sm' | 'md'; showLabel?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const tones = { red: 'bg-red-500', trust: 'bg-trust-400', gold: 'bg-gold-400', ink: 'bg-ink-900' }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-full overflow-hidden rounded-full bg-ink-100', size === 'sm' ? 'h-1' : 'h-1.5')}>
        <div className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="tnum shrink-0 text-xs font-semibold text-ink-600">{Math.round(pct)}%</span>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('fw-skeleton', className)} />
}

export function EmptyState({ icon = 'search', title, description, action }:
  { icon?: IconName; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
        <Icon name={icon} size={24} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }:
  { tabs: { value: T; label: string; count?: number; icon?: IconName }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-100', className)}>
      {tabs.map(t => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={cn(
            'relative shrink-0 px-3.5 py-2.5 text-sm font-semibold transition-colors',
            value === t.value ? 'text-red-600' : 'text-ink-500 hover:text-ink-800')}>
          <span className="inline-flex items-center gap-1.5">
            {t.icon && <Icon name={t.icon} size={15} />}
            {t.label}
            {typeof t.count === 'number' && (
              <span className={cn('ml-0.5 rounded-full px-1.5 py-0.5 text-2xs', value === t.value ? 'bg-red-50 text-red-600' : 'bg-ink-100 text-ink-500')}>
                {t.count}
              </span>
            )}
          </span>
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-red-500" />}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, src, size = 40, ring }: { name: string; src?: string; size?: number; ring?: string }) {
  const [failed, setFailed] = useState(false)
  const letters = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <span style={{ width: size, height: size }}
      className={cn('relative grid shrink-0 place-items-center rounded-full font-bold text-white', ring)}>
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover" style={{ width: size, height: size }} />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-full"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 70% 35%))`, fontSize: size * 0.36 }}>
          {letters}
        </span>
      )}
    </span>
  )
}

/* ============================ Toast ============================ */
export interface Toast { id: string; title: string; description?: string; tone: 'success' | 'error' | 'info' | 'warning' }
let pushToast: ((t: Omit<Toast, 'id'>) => void) | null = null
export function toast(t: Omit<Toast, 'id'>) { pushToast?.(t) }

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    pushToast = (t) => {
      const id = Math.random().toString(36).slice(2)
      setItems(p => [...p, { ...t, id }])
      setTimeout(() => setItems(p => p.filter(i => i.id !== id)), 4500)
    }
    return () => { pushToast = null }
  }, [])
  const TONES = {
    success: { icon: 'check-circle' as IconName, cls: 'text-trust-600 bg-trust-50' },
    error: { icon: 'x-circle' as IconName, cls: 'text-red-600 bg-red-50' },
    warning: { icon: 'alert' as IconName, cls: 'text-amber-600 bg-amber-50' },
    info: { icon: 'info' as IconName, cls: 'text-blue-600 bg-blue-50' },
  }
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 safe-b">
      {items.map(t => (
        <div key={t.id}
          className="pointer-events-auto flex animate-slide-in-right items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5 shadow-card-hover">
          <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', TONES[t.tone].cls)}>
            <Icon name={TONES[t.tone].icon} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink-900">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-ink-500">{t.description}</p>}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/* ============================ Tooltip ============================ */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span ref={ref} className="relative inline-flex"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      {children}
      {open && (
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 animate-fade-in rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
          {content}
          <span className="absolute left-1/2 top-full -ml-1 h-2 w-2 -translate-y-1 rotate-45 bg-ink-900" />
        </span>
      )}
    </span>
  )
}

/* Re-export the icon set so consumers import everything from one place. */
export { Icon } from './Icon'
export type { IconName } from './Icon'
