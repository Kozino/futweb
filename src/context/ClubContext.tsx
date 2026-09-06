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
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!hasSupabase || !user || user.accountType !== 'club') {
      setClub(null)
      setMembership(null)
      setSquad([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [currentClub, currentMembership] = await Promise.all([
        getMyClub(user.id),
        getMyClubMembership(user.id),
      ])

      setClub(currentClub)
      setMembership(currentMembership)

      if (!currentClub) {
        setSquad([])
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
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const role = useMemo<StaffRole | null>(() => {
    if (loading) return null
    if (club && user && club.owner_id === user.id) return 'club_admin'
    return membership?.role ?? null
  }, [club, membership, user, loading])

  const value = useMemo<ClubContextValue>(
    () => ({
      club,
      membership,
      squad,
      loading,
      error,
      refresh,
      role,
    }),
    [club, membership, squad, loading, error, refresh, role],
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
