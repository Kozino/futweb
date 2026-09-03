```tsx
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
  getMyPlayer,
  type PlayerProfileRow,
  updateMyPlayerProfile,
  type UpdateMyPlayerProfileInput,
} from '@/lib/supabase/players'
import {
  getPlayerAttributes,
  type PlayerAttributesRow,
} from '@/lib/supabase/attributes'
import { getPlayerStats } from '@/lib/supabase/stats'
import { getPlayerCareer } from '@/lib/supabase/career'
import { getMyTrialApplications } from '@/lib/supabase/recruitment'
import { hasSupabase } from '@/lib/supabase'

interface PlayerContextValue {
  player: PlayerProfileRow | null
  attributes: PlayerAttributesRow | null
  stats: Record<string, unknown>[]
  career: Record<string, unknown>[]
  applications: Record<string, unknown>[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateProfile: (input: UpdateMyPlayerProfileInput) => Promise<void>
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [player, setPlayer] = useState<PlayerProfileRow | null>(null)
  const [attributes, setAttributes] = useState<PlayerAttributesRow | null>(null)
  const [stats, setStats] = useState<Record<string, unknown>[]>([])
  const [career, setCareer] = useState<Record<string, unknown>[]>([])
  const [applications, setApplications] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!hasSupabase || !user || user.accountType !== 'player') {
      setPlayer(null)
      setAttributes(null)
      setStats([])
      setCareer([])
      setApplications([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const currentPlayer = await getMyPlayer(user.id)

      setPlayer(currentPlayer)

      if (!currentPlayer) {
        setAttributes(null)
        setStats([])
        setCareer([])
        setApplications([])
        return
      }

      const [
        currentAttributes,
        currentStats,
        currentCareer,
        currentApplications,
      ] = await Promise.all([
        getPlayerAttributes(currentPlayer.id),
        getPlayerStats(currentPlayer.id),
        getPlayerCareer(currentPlayer.id),
        getMyTrialApplications(currentPlayer.id),
      ])

      setAttributes(currentAttributes)
      setStats(currentStats as Record<string, unknown>[])
      setCareer(currentCareer as Record<string, unknown>[])
      setApplications(currentApplications as Record<string, unknown>[])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load player data.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateProfile = useCallback(
    async (input: UpdateMyPlayerProfileInput) => {
      if (!user || user.accountType !== 'player') {
        throw new Error('Only player accounts can update a player profile.')
      }

      setError(null)

      const updated = await updateMyPlayerProfile(user.id, input)

      setPlayer(updated)
    },
    [user],
  )

  const value = useMemo<PlayerContextValue>(
    () => ({
      player,
      attributes,
      stats,
      career,
      applications,
      loading,
      error,
      refresh,
      updateProfile,
    }),
    [
      player,
      attributes,
      stats,
      career,
      applications,
      loading,
      error,
      refresh,
      updateProfile,
    ],
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)

  if (!context) {
    throw new Error('usePlayer must be used inside <PlayerProvider>')
  }

  return context
}
```
