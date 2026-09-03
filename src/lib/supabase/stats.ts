import { supabase } from '@/lib/supabase'

export interface MatchStatsInput {
  player_id: string
  season: string
  competition?: string | null
  appearances?: number
  minutes?: number
  goals?: number
  assists?: number
  shots?: number
  shots_on_target?: number
  pass_attempts?: number
  passes_completed?: number
  duels?: number
  duels_won?: number
  tackles?: number
  interceptions?: number
  fouls_committed?: number
  yellow_cards?: number
  red_cards?: number
  clean_sheets?: number
  goals_conceded?: number
  saves?: number
}

export async function getPlayerStats(playerId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('match_stats')
    .select('*')
    .eq('player_id', playerId)
    .order('season', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function upsertPlayerStats(input: MatchStatsInput) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('match_stats')
    .upsert(
      {
        ...input,
        appearances: input.appearances ?? 0,
        minutes: input.minutes ?? 0,
        goals: input.goals ?? 0,
        assists: input.assists ?? 0,
        shots: input.shots ?? 0,
        shots_on_target: input.shots_on_target ?? 0,
        pass_attempts: input.pass_attempts ?? 0,
        passes_completed: input.passes_completed ?? 0,
        duels: input.duels ?? 0,
        duels_won: input.duels_won ?? 0,
        tackles: input.tackles ?? 0,
        interceptions: input.interceptions ?? 0,
        fouls_committed: input.fouls_committed ?? 0,
        yellow_cards: input.yellow_cards ?? 0,
        red_cards: input.red_cards ?? 0,
        clean_sheets: input.clean_sheets ?? 0,
        goals_conceded: input.goals_conceded ?? 0,
        saves: input.saves ?? 0,
      },
      { onConflict: 'player_id,season' },
    )
    .select('*')
    .single()

  if (error) throw error

  return data
}
