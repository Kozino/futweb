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

/* ------------------------------------------------------------------ *
 * Bundled trial + club payloads so pages can render without a client
 * join and without leaking club ids in two round-trips.
 * ------------------------------------------------------------------ */

export interface TrialWithClub {
  id: string
  club_id: string
  club_name: string
  club_verified: boolean
  title: string
  description: string
  positions: string[]
  age_min: number
  age_max: number
  location: string
  trial_date: string
  fee_charged_to_player: number
  verified: boolean
  status: string
  created_at: string
}

async function attachClubs(
  trials: Array<Record<string, unknown>>,
): Promise<TrialWithClub[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const clubIds = [...new Set(trials.map(t => t.club_id as string))]
  const clubMap = new Map<string, { name: string; entity_verified: boolean }>()
  if (clubIds.length) {
    const { data } = await supabase
      .from('clubs')
      .select('id, name, entity_verified')
      .in('id', clubIds)
    ;(data ?? []).forEach((c: { id: string; name: string; entity_verified: boolean }) =>
      clubMap.set(c.id, c))
  }
  return trials.map(t => {
    const club = clubMap.get(t.club_id as string)
    return {
      id: t.id as string,
      club_id: t.club_id as string,
      club_name: club?.name ?? 'Football club',
      club_verified: club?.entity_verified ?? false,
      title: t.title as string,
      description: t.description as string,
      positions: (t.positions as string[]) ?? [],
      age_min: t.age_min as number,
      age_max: t.age_max as number,
      location: t.location as string,
      trial_date: t.trial_date as string,
      fee_charged_to_player: t.fee_charged_to_player as number,
      verified: t.verified as boolean,
      status: t.status as string,
      created_at: t.created_at as string,
    }
  })
}

export async function getOpenTrialsWithClubs(): Promise<TrialWithClub[]> {
  return attachClubs(await getOpenTrials() as unknown as Record<string, unknown>[])
}

export async function getClubTrialsWithClubs(clubId: string): Promise<TrialWithClub[]> {
  return attachClubs(await getClubTrials(clubId) as unknown as Record<string, unknown>[])
}

export interface MyTrialApplication {
  id: string
  trial_id: string
  status: string
  message: string | null
  created_at: string
  trial: TrialWithClub | null
}

export async function getMyApplicationsWithTrials(
  playerId: string,
): Promise<MyTrialApplication[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const apps = (await getMyTrialApplications(playerId)) as unknown as Array<{
    id: string; trial_id: string; status: string; message: string | null; created_at: string
  }>
  const trialIds = [...new Set(apps.map(a => a.trial_id))]
  if (!trialIds.length) return apps.map(a => ({ ...a, trial: null }))

  const { data: postings, error } = await supabase
    .from('trial_postings').select('*').in('id', trialIds)
  if (error) throw error
  const withClub = await attachClubs((postings ?? []) as unknown as Record<string, unknown>[])
  const map = new Map(withClub.map(t => [t.id, t]))
  return apps.map(a => ({ ...a, trial: map.get(a.trial_id) ?? null }))
}
