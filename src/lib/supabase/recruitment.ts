```ts
import { supabase } from '@/lib/supabase'

export async function getClubPlayers(clubId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('managed_by_club_id', clubId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function searchPlayers(filters?: {
  position?: string
  nationality?: string
  availability?: string
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  let query = supabase
    .from('players')
    .select('*')
    .order('futweb_score', { ascending: false, nullsFirst: false })
    .limit(100)

  if (filters?.position) {
    query = query.eq('position_primary', filters.position)
  }

  if (filters?.nationality) {
    query = query.eq('nationality', filters.nationality)
  }

  if (filters?.availability) {
    query = query.eq('availability', filters.availability)
  }

  const { data, error } = await query

  if (error) throw error

  return data ?? []
}

export async function getClubShortlist(clubId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('shortlists')
    .select('*')
    .eq('club_id', clubId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function addToShortlist(
  clubId: string,
  playerId: string,
  userId: string,
  stage:
    | 'watching'
    | 'shortlisted'
    | 'trial_invited'
    | 'signed'
    | 'rejected' = 'watching',
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('shortlists')
    .insert({
      club_id: clubId,
      player_id: playerId,
      created_by: userId,
      stage,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function updateShortlistStage(
  shortlistId: string,
  stage:
    | 'watching'
    | 'shortlisted'
    | 'trial_invited'
    | 'signed'
    | 'rejected',
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('shortlists')
    .update({ stage })
    .eq('id', shortlistId)
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function getOpenTrials() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_postings')
    .select('*')
    .eq('status', 'open')
    .eq('verified', true)
    .order('trial_date', { ascending: true })

  if (error) throw error

  return data ?? []
}

export async function getClubTrials(clubId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_postings')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function createTrialPosting(input: {
  club_id: string
  title: string
  description: string
  positions: string[]
  age_min: number
  age_max: number
  location: string
  trial_date: string
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_postings')
    .insert({
      club_id: input.club_id,
      title: input.title.trim(),
      description: input.description.trim(),
      positions: input.positions,
      age_min: input.age_min,
      age_max: input.age_max,
      location: input.location.trim(),
      trial_date: input.trial_date,
      fee_charged_to_player: 0,
      status: 'pending_verification',
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function applyForTrial(
  trialId: string,
  playerId: string,
  message?: string,
) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_applications')
    .insert({
      trial_id: trialId,
      player_id: playerId,
      message: message?.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

export async function getMyTrialApplications(playerId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_applications')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function getClubTrialApplications(trialId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('trial_applications')
    .select('*')
    .eq('trial_id', trialId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data ?? []
}
```
