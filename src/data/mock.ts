import type { PlayerAttributes, MatchStats, PlayerProfile, ClubProfile, PlayerRatingSnapshot, MediaAsset } from '@/types'
import { uuid } from '@/lib/utils'
import { ageFrom, computeConfidence, computeFutWebScore, computeTrustScore } from '@/lib/ratings'

/* Deterministic pseudo-random so demo data is stable across reloads. */
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

function attrs(seed: number, base: number, spread = 14): PlayerAttributes {
  const r = rng(seed)
  const mk = () => Math.max(20, Math.min(99, Math.round(base + (r() - 0.45) * spread * 2)))
  return {
    finishing: mk(), passing: mk(), dribbling: mk(), first_touch: mk(),
    crossing: mk(), technique: mk(), heading: mk(),
    acceleration: mk(), sprint_speed: mk(), agility: mk(), stamina: mk(),
    strength: mk(), jumping: mk(), balance: mk(),
    vision: mk(), positioning: mk(), decision_making: mk(), work_rate: mk(),
    composure: mk(), aggression: mk(), leadership: mk(),
    marking: mk(), tackling: mk(), interceptions: mk(), aerial_duels: mk(),
    reflexes: mk(), handling: mk(), gk_distribution: mk(), shot_stopping: mk(),
  }
}

function stats(seed: number, apps: number, goals: number): MatchStats {
  const r = rng(seed)
  return {
    appearances: apps, minutes: apps * Math.round(70 + r() * 20),
    goals, assists: Math.round(goals * (0.4 + r() * 0.5)),
    shots: Math.round(goals * (3 + r() * 2)), shots_on_target: Math.round(goals * (1.4 + r())),
    pass_attempts: Math.round(apps * (28 + r() * 22)), passes_completed: Math.round(apps * (22 + r() * 20)),
    duels: Math.round(apps * (9 + r() * 6)), duels_won: Math.round(apps * (4 + r() * 4)),
    tackles: Math.round(apps * (1.5 + r() * 3)), interceptions: Math.round(apps * (1 + r() * 2)),
    fouls_committed: Math.round(apps * (0.6 + r())), yellow_cards: Math.round(r() * 5), red_cards: 0,
    clean_sheets: 0, goals_conceded: 0, saves: 0,
  }
}

export interface DemoPlayer extends PlayerProfile {
  attributes: PlayerAttributes
  matchStats: MatchStats
  ratingSnapshots: PlayerRatingSnapshot[]
  nationality_flag: string
  league: string
  viewCount: number
  shortlistCount: number
  clubName: string
}

interface Seed {
  first: string; last: string; pos: string; pos2: string[]
  age: number; state: string; club: string; league: string; base: number; seed: number
  foot: 'left' | 'right' | 'both'; h: number; w: number
  availability: PlayerProfile['availability']; visibility: PlayerProfile['visibility']
}

const SEEDS: Seed[] = [
  { first: 'Chidi',   last: 'Okonkwo',    pos: 'ST',  pos2: ['CF','LW'], age: 21, state: 'Anambra',   club: 'Rivers United FC',   league: 'npfl', base: 74, seed: 11, foot: 'right', h: 181, w: 76, availability: 'available', visibility: 'public' },
  { first: 'Musa',    last: 'Ibrahim',    pos: 'CM',  pos2: ['CDM','CAM'], age: 19, state: 'Kano',    club: 'Kano Pillars FC',    league: 'npfl', base: 69, seed: 22, foot: 'both',  h: 176, w: 70, availability: 'trial_only', visibility: 'public' },
  { first: 'Emeka',   last: 'Nwosu',      pos: 'CB',  pos2: ['RB'],       age: 23, state: 'Imo',      club: 'Enyimba FC',         league: 'npfl', base: 71, seed: 33, foot: 'right', h: 189, w: 84, availability: 'under_contract', visibility: 'public' },
  { first: 'Tunde',   last: 'Adeyemi',    pos: 'LW',  pos2: ['RW','LM'],  age: 18, state: 'Oyo',      club: 'Shooting Stars SC',  league: 'npfl', base: 66, seed: 44, foot: 'left',  h: 172, w: 65, availability: 'available', visibility: 'public' },
  { first: 'Ibrahim', last: 'Yakubu',     pos: 'GK',  pos2: [],           age: 24, state: 'Kaduna',   club: 'Plateau United FC',  league: 'npfl', base: 70, seed: 55, foot: 'right', h: 190, w: 82, availability: 'available', visibility: 'public' },
  { first: 'Kelechi', last: 'Obi',        pos: 'RB',  pos2: ['RWB','RM'], age: 20, state: 'Delta',    club: 'Warri Wolves FC',    league: 'nnl',  base: 64, seed: 66, foot: 'right', h: 175, w: 69, availability: 'available', visibility: 'verified_only' },
  { first: 'Sadiq',   last: 'Bello',      pos: 'CDM', pos2: ['CM'],       age: 22, state: 'Sokoto',   club: 'Katsina United FC',  league: 'npfl', base: 68, seed: 77, foot: 'right', h: 183, w: 78, availability: 'trial_only', visibility: 'public' },
  { first: 'Chiamaka',last: 'Eze',        pos: 'CAM', pos2: ['CM','RW'],  age: 17, state: 'Enugu',    club: 'Rangers International', league: 'npfl', base: 62, seed: 88, foot: 'left', h: 168, w: 60, availability: 'available', visibility: 'verified_only' },
  { first: 'Uche',    last: 'Nwachukwu',  pos: 'CF',  pos2: ['ST'],       age: 25, state: 'Abia',     club: 'Abia Warriors FC',   league: 'npfl', base: 72, seed: 99, foot: 'right', h: 185, w: 80, availability: 'under_contract', visibility: 'public' },
  { first: 'Bashir',  last: 'Lawal',      pos: 'LB',  pos2: ['LWB','LM'], age: 19, state: 'Bauchi',   club: 'Wikki Tourists FC',  league: 'nnl',  base: 61, seed: 101, foot: 'left', h: 174, w: 68, availability: 'available', visibility: 'public' },
  { first: 'Femi',    last: 'Oladele',    pos: 'RW',  pos2: ['LW','ST'],  age: 20, state: 'Lagos',    club: 'Remo Stars FC',      league: 'npfl', base: 67, seed: 112, foot: 'right', h: 170, w: 64, availability: 'available', visibility: 'public' },
  { first: 'Yusuf',   last: 'Danjuma',    pos: 'CM',  pos2: ['CAM'],      age: 16, state: 'Katsina',  club: 'Golden Boot Academy', league: 'academy', base: 58, seed: 123, foot: 'right', h: 169, w: 61, availability: 'available', visibility: 'verified_only' },
  { first: 'Obinna',  last: 'Chukwu',     pos: 'CB',  pos2: ['CDM'],      age: 21, state: 'Rivers',   club: 'Bayelsa United FC',  league: 'nnl',  base: 65, seed: 134, foot: 'right', h: 186, w: 81, availability: 'trial_only', visibility: 'public' },
  { first: 'Halima',  last: 'Sule',       pos: 'ST',  pos2: ['CF'],       age: 22, state: 'Niger',    club: 'Nasarawa Amazons',   league: 'nwfl', base: 70, seed: 145, foot: 'right', h: 173, w: 66, availability: 'available', visibility: 'public' },
  { first: 'Gideon',  last: 'Peters',     pos: 'ST',  pos2: [],           age: 26, state: 'Cross River', club: 'Akwa United FC',  league: 'npfl', base: 73, seed: 156, foot: 'right', h: 180, w: 75, availability: 'under_contract', visibility: 'public' },
  { first: 'Adebayo', last: 'Sanni',      pos: 'CM',  pos2: ['CDM'],      age: 18, state: 'Ogun',     club: 'Beyond Limits FA',   league: 'academy', base: 63, seed: 167, foot: 'both', h: 177, w: 71, availability: 'available', visibility: 'public' },
]

function makePlayer(s: Seed, idx: number): DemoPlayer {
  const r = rng(s.seed)
  const attributes = attrs(s.seed, s.base)
  const appearances = Math.round(8 + r() * 24)
  const goals = s.pos === 'GK' ? 0 : ['ST','CF','LW','RW','CAM'].includes(s.pos)
    ? Math.round(appearances * (0.25 + r() * 0.6)) : Math.round(r() * 4)
  const matchStats = stats(s.seed + 7, appearances, goals)
  const dobYear = new Date().getFullYear() - s.age
  const dob = `${dobYear}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 27)).padStart(2, '0')}`
  const isMinor = s.age < 18
  const ratingCount = Math.round(1 + r() * 8)
  const verifiedRaters = Math.round(r() * 3)
  const conf = computeConfidence({
    ratingCount, independentRaters: Math.round(r() * ratingCount),
    verifiedRaters, matchesObserved: Math.round(r() * 14),
    hasVideo: r() > 0.3, hasVerifiedStats: r() > 0.5,
  })
  const score = computeFutWebScore({ attributes, position: s.pos, age: s.age, confidence: conf.score })
  const id = uuid()

  const snapshots: PlayerRatingSnapshot[] = Array.from({ length: 5 }, (_, i) => {
    const back = (5 - i) * 3
    const d = new Date(); d.setMonth(d.getMonth() - back)
    const a: PlayerAttributes = { ...attributes }
    for (const k of Object.keys(a)) a[k] = Math.max(20, Math.min(99, a[k] - back * 0.6 + (rng(s.seed + i)() - 0.5) * 4))
    const sc = computeFutWebScore({ attributes: a, position: s.pos, age: s.age - back / 12, confidence: conf.score })
    return {
      id: uuid(), player_id: id, recorded_at: d.toISOString(),
      rated_by: ['Coach A. Bello', 'Scout M. Danjuma', 'Academy Verified', 'Self'][i % 4],
      rated_by_role: (['coach','scout','academy','self'] as const)[i % 4],
      attributes: a, futweb_score: sc.current,
      position_fit: sc.positionFit as unknown as Record<string, number>,
      confidence: conf.score, context: 'match', offline_captured: i === 1,
    }
  })
  snapshots.push({
    id: uuid(), player_id: id, recorded_at: new Date().toISOString(),
    rated_by: 'Coach A. Bello', rated_by_role: 'coach',
    attributes, futweb_score: score.current,
    position_fit: score.positionFit as unknown as Record<string, number>,
    confidence: conf.score, context: 'match', offline_captured: false,
  })

  return {
    id, user_id: `u_${idx}`, slug: `${s.first}-${s.last}`.toLowerCase(),
    first_name: s.first, last_name: s.last, dob,
    nationality: 'Nigeria', state_of_origin: s.state,
    position_primary: s.pos, position_secondary: s.pos2,
    foot: s.foot, height_cm: s.h, weight_kg: s.w,
    bio: `${s.pos} with ${appearances} competitive appearances for ${s.club}. Comfortable in possession, strong in transition.`,
    availability: s.availability, visibility: s.visibility,
    is_minor: isMinor,
    guardian_name: isMinor ? 'Mr. ' + s.last : undefined,
    guardian_phone: isMinor ? '+234 80' + String(1000000 + Math.floor(r() * 8999999)) : undefined,
    guardian_consent_at: isMinor ? new Date().toISOString() : undefined,
    media: Array.from({ length: Math.round(1 + r() * 3) }, (_, i) => ({
      id: uuid(), kind: (i === 0 ? 'highlight' : i === 1 ? 'full_match' : 'photo') as MediaAsset['kind'],
      url: '#', title: i === 0 ? 'Season highlights 24/25' : i === 1 ? 'Full match vs Enyimba' : 'Training gallery',
      duration_s: i === 2 ? undefined : Math.round(90 + r() * 400),
      recorded_at: new Date(Date.now() - i * 86400000 * 20).toISOString(),
      recorded_location: `${s.state}, Nigeria`,
      verified: r() > 0.4, uploaded_at: new Date(Date.now() - i * 86400000 * 18).toISOString(),
    })),
    career: [
      { id: uuid(), club_name: s.club, season: '2024/25', league: s.league, appearances, goals, assists: matchStats.assists, verified: r() > 0.4 },
      { id: uuid(), club_name: 'Previous Club', season: '2023/24', league: s.league, appearances: Math.round(appearances * 0.8), goals: Math.max(0, goals - 2), assists: Math.max(0, matchStats.assists - 1), verified: false },
    ],
    created_at: new Date(Date.now() - (idx + 1) * 86400000 * 12).toISOString(),
    updated_at: new Date(Date.now() - idx * 86400000).toISOString(),
    attributes, matchStats, ratingSnapshots: snapshots,
    nationality_flag: '🇳🇬', league: s.league,
    viewCount: Math.round(40 + r() * 900), shortlistCount: Math.round(r() * 14),
    clubName: s.club,
  }
}

export const DEMO_PLAYERS: DemoPlayer[] = SEEDS.map(makePlayer)

export const DEMO_CLUBS: (ClubProfile & { trust: number; staff: number; players: number })[] = [
  { id: 'c1', user_id: 'cu1', slug: 'rivers-united', name: 'Rivers United FC', short_name: 'RIV',
    country: 'Nigeria', state: 'Rivers', city: 'Port Harcourt', league: 'npfl',
    cac_number: 'RC118823', nff_affiliation: 'NFF/RIV/041', stadium: 'Adokiye Amiesimaka Stadium',
    founded_year: 2016, verification_tier: 'gold', verification_status: 'verified',
    created_at: new Date(Date.now() - 400 * 86400000).toISOString(), trust: 94, staff: 8, players: 42 },
  { id: 'c2', user_id: 'cu2', slug: 'kano-pillars', name: 'Kano Pillars FC', short_name: 'KAN',
    country: 'Nigeria', state: 'Kano', city: 'Kano', league: 'npfl',
    cac_number: 'RC99211', nff_affiliation: 'NFF/KN/002', stadium: 'Sani Abacha Stadium',
    founded_year: 1990, verification_tier: 'entity', verification_status: 'verified',
    created_at: new Date(Date.now() - 300 * 86400000).toISOString(), trust: 78, staff: 5, players: 31 },
  { id: 'c3', user_id: 'cu3', slug: 'golden-boot-academy', name: 'Golden Boot Academy', short_name: 'GBA',
    country: 'Nigeria', state: 'Katsina', city: 'Katsina', league: 'academy',
    cac_number: 'RC204419', nff_affiliation: 'NFF/KT/118', founded_year: 2018,
    verification_tier: 'identity', verification_status: 'verified',
    created_at: new Date(Date.now() - 180 * 86400000).toISOString(), trust: 52, staff: 3, players: 64 },
  { id: 'c4', user_id: 'cu4', slug: 'lagos-talent-hub', name: 'Lagos Talent Hub', short_name: 'LTH',
    country: 'Nigeria', state: 'Lagos', city: 'Lagos', league: 'academy',
    verification_tier: 'unverified', verification_status: 'pending', founded_year: 2022,
    created_at: new Date(Date.now() - 40 * 86400000).toISOString(), trust: 18, staff: 2, players: 22 },
  { id: 'c5', user_id: 'cu5', slug: 'enyimba', name: 'Enyimba International FC', short_name: 'ENY',
    country: 'Nigeria', state: 'Abia', city: 'Aba', league: 'npfl',
    cac_number: 'RC77120', nff_affiliation: 'NFF/AB/001', stadium: 'Enyimba International Stadium',
    founded_year: 1976, verification_tier: 'gold', verification_status: 'verified',
    created_at: new Date(Date.now() - 520 * 86400000).toISOString(), trust: 96, staff: 12, players: 38 },
]

export const DEMO_TRIALS = [
  { id: 't1', club_id: 'c1', title: 'Open Trials — U23 Attacking Players',
    description: 'Rivers United are holding open trials for attacking players ahead of the 2025/26 NPFL season. Transportation and accommodation provided. No fees payable by players at any stage.',
    positions: ['ST','LW','RW'], age_min: 17, age_max: 23, location: 'Port Harcourt, Rivers State',
    trial_date: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
    fee_charged_to_player: 0, verified: true, status: 'open' as const, applicant_count: 214,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 't2', club_id: 'c5', title: 'Goalkeeper Assessment Day',
    description: 'Enyimba scouting department is assessing goalkeepers aged 18-24. Bring boots, gloves and a valid ID.',
    positions: ['GK'], age_min: 18, age_max: 24, location: 'Aba, Abia State',
    trial_date: new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10),
    fee_charged_to_player: 0, verified: true, status: 'open' as const, applicant_count: 68,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 't3', club_id: 'c4', title: 'European Placement Opportunity — Pay ₦45,000',
    description: 'Agency links players to European clubs. Registration fee required.',
    positions: ['ST','CM'], age_min: 16, age_max: 25, location: 'Lagos',
    trial_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    fee_charged_to_player: 45000, verified: false, status: 'pending_verification' as const, applicant_count: 3,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
]

export const DEMO_AUDIT = Array.from({ length: 14 }, (_, i) => {
  const actions = ['club.verification.approved','player.profile.updated','subscription.created','user.login','scout_report.created','player.rating.added','trial.posting.verified','dispute.opened','staff.role.changed','payment.succeeded']
  const a = actions[i % actions.length]
  return {
    id: uuid(), actor_id: `u${i}`, actor_role: (['admin','club_admin','player','scout'] as const)[i % 4],
    action: a, entity_type: a.split('.')[0], entity_id: uuid(),
    metadata: { note: 'Demo event' }, ip: `102.89.${i}.${i * 7 + 3}`,
    created_at: new Date(Date.now() - i * 3600000 * 3.4).toISOString(),
  }
})

/* Enrichment helpers used by demo mode */
export function enrichPlayer(p: DemoPlayer) {
  const age = ageFrom(p.dob)
  const conf = computeConfidence({
    ratingCount: p.ratingSnapshots.length, independentRaters: 3,
    verifiedRaters: 2, matchesObserved: 9,
    hasVideo: p.media.some(m => m.kind === 'highlight'), hasVerifiedStats: true,
  })
  return {
    ...p, age,
    score: computeFutWebScore({ attributes: p.attributes, position: p.position_primary, age, confidence: conf.score }),
    confidence: conf,
    trust: computeTrustScore({
      emailVerified: true, phoneVerified: true, identityVerified: !p.is_minor,
      entityVerified: false, videoVerified: p.visibility === 'public',
      referencesVerified: true, paymentVerified: true, tenureDays: 120, disputesUpheld: 0,
    }),
  }
}
