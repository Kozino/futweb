import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatNGN(amount: number, opts: { compact?: boolean } = {}) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN',
    maximumFractionDigits: 0,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(amount)
}

export function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-NG', opts).format(new Date(d))
}

export function relativeTime(d: string | Date) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(d)
}

export function initials(first: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Deterministic ID so offline records can be reconciled server-side. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)) }

export function plural(n: number, word: string, pluralForm?: string) {
  return n === 1 ? `${n} ${word}` : `${n} ${pluralForm ?? word + 's'}`
}

/** Truncate without cutting words mid-way. */
export function truncate(s: string, len: number) {
  if (s.length <= len) return s
  return s.slice(0, s.lastIndexOf(' ', len)) + '…'
}

/* ---------- Validation ---------- */
export const validators = {
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Enter a valid email address',
  required: (v: string) => (v && v.trim().length > 0) || 'This field is required',
  minLen: (n: number) => (v: string) => v.length >= n || `Must be at least ${n} characters`,
  phoneNG: (v: string) => {
    const digits = v.replace(/\D/g, '')
    return (digits.length >= 10 && digits.length <= 15) || 'Enter a valid phone number'
  },
  password: (v: string) => {
    if (v.length < 10) return 'Use at least 10 characters'
    if (!/[A-Z]/.test(v)) return 'Add at least one uppercase letter'
    if (!/[a-z]/.test(v)) return 'Add at least one lowercase letter'
    if (!/[0-9]/.test(v)) return 'Add at least one number'
    return true
  },
  match: (other: string, label = 'Passwords') => (v: string) => v === other || `${label} do not match`,
  url: (v: string) => {
    try { new URL(v); return true } catch { return 'Enter a valid URL (include https://)' }
  },
  cac: (v: string) => /^(RC|BN)?\s?\d{5,7}$/i.test(v.trim()) || 'CAC numbers look like RC123456',
  futureDate: (v: string) => new Date(v) > new Date() || 'Date must be in the future',
}

export function runValidators(value: string, rules: ((v: string) => true | string)[]): string | null {
  for (const r of rules) {
    const res = r(value)
    if (res !== true) return res as string
  }
  return null
}

/* ---------- Nigerian / African football context ---------- */
export const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta',
  'Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina',
  'Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
  'Sokoto','Taraba','Yobe','Zamfara',
] as const

export const AFRICAN_COUNTRIES = [
  'Nigeria','Ghana','Cameroon','Senegal','Ivory Coast','Egypt','Morocco','Algeria','Tunisia','Kenya',
  'South Africa','DR Congo','Mali','Burkina Faso','Guinea','Benin','Togo','Uganda','Tanzania','Zambia',
  'Angola','Gabon','Congo','Sudan','Ethiopia','Rwanda','Liberia','Sierra Leone','Gambia','Zimbabwe',
] as const
