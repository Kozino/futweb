import { supabase } from '@/lib/supabase'

export async function getPlayerCareer(playerId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('career_entries')
    .select('*')
    .eq('player_id', playerId)
    .order('season', { ascending: false })

  if (error) throw error

  return data ?? []
}

export interface CareerEntryInput {
  player_id: string
  club_name: string
  season: string
  competition?: string | null
  appearances?: number
  goals?: number
  assists?: number
}

export async function createCareerEntry(input: CareerEntryInput) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('career_entries')
    .insert({
      player_id: input.player_id,
      club_name: input.club_name.trim(),
      season: input.season,
      competition: input.competition ?? null,
      appearances: input.appearances ?? 0,
      goals: input.goals ?? 0,
      assists: input.assists ?? 0,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}
