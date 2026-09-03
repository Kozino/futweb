
import { supabase } from '@/lib/supabase'

export const PLAYER_ATTRIBUTE_KEYS = [
  'finishing',
  'passing',
  'dribbling',
  'first_touch',
  'crossing',
  'technique',
  'heading',
  'acceleration',
  'sprint_speed',
  'agility',
  'stamina',
  'strength',
  'jumping',
  'balance',
  'vision',
  'positioning',
  'decision_making',
  'work_rate',
  'composure',
  'aggression',
  'leadership',
  'marking',
  'tackling',
  'interceptions',
  'aerial_duels',
  'reflexes',
  'handling',
  'gk_distribution',
  'shot_stopping',
] as const

export type PlayerAttributeKey = typeof PLAYER_ATTRIBUTE_KEYS[number]

export type PlayerAttributesRow = {
  player_id: string
  updated_at: string
} & Partial<Record<PlayerAttributeKey, number | null>>

export async function getPlayerAttributes(
  playerId: string,
): Promise<PlayerAttributesRow | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('player_attributes')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle()

  if (error) throw error

  return data as PlayerAttributesRow | null
}

export interface SelfRatingInput {
  playerId: string
  attributes: Record<string, number>
  context?: 'training' | 'match' | 'tournament' | 'combine'
  futwebScore: number
  positionFit?: Record<string, number>
  confidence?: number
  offlineCaptured?: boolean
}

export async function createSelfRatingSnapshot(
  input: SelfRatingInput,
  userId: string,
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('rating_snapshots')
    .insert({
      player_id: input.playerId,
      rated_by: userId,
      rated_by_role: 'self',
      context: input.context ?? 'training',
      attributes: input.attributes,
      futweb_score: input.futwebScore,
      position_fit: input.positionFit ?? {},
      confidence: input.confidence ?? 0,
      offline_captured: input.offlineCaptured ?? false,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function getPlayerRatingSnapshots(playerId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('rating_snapshots')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

