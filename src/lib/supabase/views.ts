import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface ProfileView {
  viewerName: string
  viewerClub: string | null
  viewedAt: string
}

/**
 * Record that the signed-in account viewed a player's profile. Safe to call on
 * every open of a profile detail — the server drops self-views and rate-limits
 * repeats (see migration 0012). No-ops gracefully if the RPC is not yet deployed.
 */
export async function recordProfileView(playerId: string): Promise<void> {
  if (!supabase) return
  try {
    await supabase.rpc('record_profile_view', { p_player_id: playerId })
  } catch {
    /* non-fatal — viewing is best-effort telemetry */
  }
}

/** Who recently viewed the signed-in player's own profile(s). */
export async function getMyProfileViews(limit = 25): Promise<ProfileView[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('my_profile_views', { p_limit: limit })
  if (error) throw error
  return (data as ProfileView[] | null) ?? []
}
