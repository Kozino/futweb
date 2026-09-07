import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from '@/context/AuthContext'
import {
  getMyClub,
  getMyClubMembership,
  type ClubMembership,
  type ClubRow,
} from '@/lib/supabase/clubs'
import { getClubPlayers } from '@/lib/supabase/recruitment'
import { hasSupabase } from '@/lib/supabase'

export type StaffRole = 'club_admin' | 'club_staff' | 'scout'

interface ClubContextValue {
  club: ClubRow | null
  membership: ClubMembership | null
  squad: Record<string, unknown>[]
  loading: boolean
  /** True once the club/membership has been resolved for the current user.
   *  Unlike `loading`, this stays false from the first render until the fetch
   *  actually completes — so role-gated pages can wait on it instead of
   *  wrongly redirecting during the brief window before the club loads. */
  ready: boolean
  error: string | null
  refresh: () => Promise<void>
  /**
   * The caller's role within THIS club, resolved once membership has
   * loaded. The club owner is always 'club_admin' even before an
   * org_members row exists for them (see Staff.tsx for the same rule).
   * `null` while loading or when the user has no club role at all —
   * callers must not treat null as "allowed".
   */
  role: StaffRole | null
}

const ClubContext = createContext<ClubContextValue | null>(null)

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [club, setClub] = useState<ClubRow | null>(null)
  const [membership, setMembership] = useState<ClubMembership | null>(null)
  const [squad, setSquad] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!hasSupabase) {
      setClub(null)
      setMembership(null)
      setSquad([])
      setError(null)
      setReady(true)
      return
    }
    // While auth is still resolving (no user yet) we are NOT "ready": role-gated
    // pages must keep showing a skeleton, not treat a not-yet-loaded club as
    // "user has no access" and redirect.
    if (!user) {
      setClub(null)
      setMembership(null)
      setSquad([])
      setError(null)
      setReady(false)
      return
    }
    if (user.accountType !== 'club') {
      setClub(null)
      setMembership(null)
      setSquad([])
      setError(null)
      setReady(true)
      return
    }

    setLoading(true)
    setError(null)
    // Not "ready" again until this fetch resolves, so role-gated routes hold
    // on a skeleton instead of mis-redirecting during the load window.
    setReady(false)

    try {
      const [currentClub, currentMembership] = await Promise.all([
        getMyClub(user.id),
        getMyClubMembership(user.id),
      ])

      setClub(currentClub)
      setMembership(currentMembership)

      if (!currentClub) {
        setSquad([])
        setReady(true)
        return
      }

      const players = await getClubPlayers(currentClub.id)

      setSquad(players as Record<string, unknown>[])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load club data.'

      setError(message)
    } finally {
      setLoading(false)
      setReady(true)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const role = useMemo<StaffRole | null>(() => {
    if (loading || !ready) return null
    if (club && user && club.owner_id === user.id) return 'club_admin'
    return membership?.role ?? null
  }, [club, membership, user, loading, ready])

  const value = useMemo<ClubContextValue>(
    () => ({
      club,
      membership,
      squad,
      loading,
      ready,
      error,
      refresh,
      role,
    }),
    [club, membership, squad, loading, ready, error, refresh, role],
  )

  return (
    <ClubContext.Provider value={value}>
      {children}
    </ClubContext.Provider>
  )
}

export function useClub() {
  const context = useContext(ClubContext)

  if (!context) {
    throw new Error('useClub must be used inside <ClubProvider>')
  }

  return context
}
