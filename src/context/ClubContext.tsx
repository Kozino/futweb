
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

interface ClubContextValue {
  club: ClubRow | null
  membership: ClubMembership | null
  squad: Record<string, unknown>[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
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

  const value = useMemo<ClubContextValue>(
    () => ({
      club,
      membership,
      squad,
      loading,
      error,
      refresh,
    }),
    [club, membership, squad, loading, error, refresh],
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

