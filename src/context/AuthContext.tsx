import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { supabase, DEMO_MODE, hasSupabase } from '@/lib/supabase'
import type { UserRole, AccountType, SubscriptionStatus, VerificationTier } from '@/types'
import { uuid } from '@/lib/utils'

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  accountType: AccountType
  fullName: string
  clubName?: string
  playerId?: string
  clubId?: string
  avatarUrl?: string
  emailVerified: boolean
  verificationTier: VerificationTier
  verificationStatus: 'none' | 'pending' | 'in_review' | 'verified' | 'rejected'
  subStatus: SubscriptionStatus
  planCode: string | null
  trialEndsAt: string | null
  onboardingComplete: boolean
}

interface AuthState {
  user: SessionUser | null
  loading: boolean
  /** True when the account can reach gated product surfaces. */
  hasAccess: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (input: SignUpInput) => Promise<{ error?: string; userId?: string }>
  signOut: () => Promise<void>
  updateUser: (patch: Partial<SessionUser>) => void
  demoLogin: (role: 'player' | 'club' | 'admin') => void
  /** Re-fetch the caller's profile row from Supabase and sync local state —
   *  used to reflect a subscription/verification change made server-side. */
  refreshProfile: () => Promise<void>
}

interface SignUpInput {
  email: string
  password: string
  accountType: AccountType
  fullName: string
  clubName?: string
  phone?: string
  playerDetails?: {
    dob: string
    position: string
    foot: string
    height: string
    weight: string
    nationality: string
    stateOfOrigin: string
  }
  clubDetails?: {
    shortName: string
    country: string
    stateRegion: string
    leagueCode: string
  }
}

const DEMO_KEY = 'futweb.session'
const ACCESS_STATES: SubscriptionStatus[] = ['active', 'trialing', 'grace']

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  /* ---------------- Hydrate session ---------------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (hasSupabase && supabase) {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        if (data.session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.session.user.id)
            .single()
          if (!cancelled && profile) setUser(mapProfile(profile, data.session.user.email ?? ''))
        }
        if (!cancelled) setLoading(false)

        const client = supabase
        const { data: sub } = client.auth.onAuthStateChange(async (_e, session) => {
          if (!session) { setUser(null); return }
          const { data: profile } = await client
            .from('profiles').select('*').eq('id', session.user.id).single()
          setUser(profile ? mapProfile(profile, session.user.email ?? '') : null)
        })
        return () => sub.subscription.unsubscribe()
      } else {
        const raw = localStorage.getItem(DEMO_KEY)
        if (raw && !cancelled) {
          try { setUser(JSON.parse(raw)) } catch { localStorage.removeItem(DEMO_KEY) }
        }
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = useCallback((u: SessionUser | null) => {
    setUser(u)
    if (u) localStorage.setItem(DEMO_KEY, JSON.stringify(u))
    else localStorage.removeItem(DEMO_KEY)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (hasSupabase && supabase) {
      // Generic error on purpose: never reveal whether an email exists (user enumeration).
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) return { error: 'Invalid email or password.' }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      if (profile) setUser(mapProfile(profile, data.user.email ?? email))
      return {}
    }
    await new Promise(r => setTimeout(r, 600))
    if (password.length < 6) return { error: 'Invalid email or password.' }
    const stored = JSON.parse(localStorage.getItem('futweb.accounts') ?? '{}')
    const acc = stored[email.toLowerCase()]
    if (acc && acc.password !== password) return { error: 'Invalid email or password.' }
    const demo = acc ?? makeDemoUser(email, 'player')
    persist(demo.session)
    return {}
  }, [persist])

  const signUp = useCallback(async (input: SignUpInput) => {
    if (hasSupabase && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
         data: {
  full_name: input.fullName,
  account_type: input.accountType,
  club_name: input.clubName ?? null,
  phone: input.phone ?? null,

  player_details: input.playerDetails ?? null,
  club_details: input.clubDetails ?? null,
},
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) return { error: error.message }
      return { userId: data.user?.id }
    }
    await new Promise(r => setTimeout(r, 900))
    const email = input.email.toLowerCase()
    const stored = JSON.parse(localStorage.getItem('futweb.accounts') ?? '{}')
    if (stored[email]) return { error: 'An account with this email already exists.' }
    const session = makeDemoUser(email, input.accountType, input.fullName, input.clubName)
    stored[email] = { password: input.password, session }
    localStorage.setItem('futweb.accounts', JSON.stringify(stored))
    persist(session.session)
    return { userId: session.session.id }
  }, [persist])

  const signOut = useCallback(async () => {
    if (hasSupabase && supabase) await supabase.auth.signOut()
    persist(null)
  }, [persist])

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem(DEMO_KEY, JSON.stringify(next))
      // Keep the credential store in sync so re-login reflects changes.
      const stored = JSON.parse(localStorage.getItem('futweb.accounts') ?? '{}')
      const key = Object.keys(stored).find(k => stored[k]?.session?.email === next.email)
      if (key) { stored[key].session = next; localStorage.setItem('futweb.accounts', JSON.stringify(stored)) }
      return next
    })
  }, [])

  const demoLogin = useCallback((role: 'player' | 'club' | 'admin') => {
    const presets = {
      player: makeDemoUser('chidi.okonkwo@futweb.app', 'player', 'Chidi Okonkwo'),
      club: makeDemoUser('recruitment@riversunited.ng', 'club', 'Rivers United Recruitment', 'Rivers United FC'),
      admin: makeDemoUser('admin@futweb.app', 'admin'),
    }
    persist(presets[role].session)
  }, [persist])

  const refreshProfile = useCallback(async () => {
    if (!hasSupabase || !supabase) return
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    if (profile) setUser(mapProfile(profile, session.user.email ?? ''))
  }, [])

  const hasAccess = useMemo(
    () => !!user && ACCESS_STATES.includes(user.subStatus),
    [user],
  )

  const value = useMemo(() => ({ user, loading, hasAccess, signIn, signUp, signOut, updateUser, demoLogin, refreshProfile }),
    [user, loading, hasAccess, signIn, signUp, signOut, updateUser, demoLogin, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/* ---------------- helpers ---------------- */

export const DEMO_MODE_ENABLED = DEMO_MODE

function makeDemoUser(email: string, accountType: AccountType | 'admin', fullName?: string, clubName?: string) {
  const isAdmin = accountType === 'admin'
  const name = fullName ?? (isAdmin ? 'FutWeb Admin' : email.split('@')[0].replace(/[._]/g, ' '))
  const session: SessionUser = {
    id: uuid(),
    email,
    role: isAdmin ? 'admin' : accountType === 'club' ? 'club_admin' : 'player',
    accountType: isAdmin ? 'club' : (accountType as AccountType),
    fullName: isAdmin ? 'FutWeb Admin' : name.replace(/\b\w/g, c => c.toUpperCase()),
    clubName: clubName ?? (isAdmin ? 'FutWeb Operations' : undefined),
    playerId: accountType === 'player' ? 'p_self' : undefined,
    clubId: accountType === 'club' || isAdmin ? 'c1' : undefined,
    emailVerified: true,
    verificationTier: isAdmin ? 'gold' : accountType === 'club' ? 'gold' : 'identity',
    verificationStatus: 'verified',
    // Players land in trial so the paywall is demonstrable in demo mode.
    subStatus: isAdmin ? 'active' : 'trialing',
    planCode: isAdmin ? 'club_enterprise' : accountType === 'club' ? 'club_pro' : 'player_pro',
    trialEndsAt: isAdmin ? null : new Date(Date.now() + 11 * 86400000).toISOString(),
    onboardingComplete: isAdmin,
  }
  return { session }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProfile(p: any, email: string): SessionUser {
  return {
    id: p.id, email,
    role: p.role,
    accountType: p.account_type,
    fullName: p.full_name,
    clubName: p.club_name ?? undefined,
    playerId: p.player_id ?? undefined,
    clubId: p.club_id ?? undefined,
    avatarUrl: p.avatar_url ?? undefined,
    emailVerified: p.email_verified ?? false,
    verificationTier: p.verification_tier ?? 'unverified',
    verificationStatus: p.verification_status ?? 'none',
    subStatus: p.sub_status ?? 'expired',
    planCode: p.plan_code ?? null,
    trialEndsAt: p.trial_ends_at ?? null,
    onboardingComplete: p.onboarding_complete ?? false,
  }
}
