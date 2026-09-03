/* ============================================================================
 * FutWeb Rating Engine
 * ----------------------------------------------------------------------------
 * Why this exists (competitor weakness → our strength):
 *   Wyscout / InStat / TransferRoom show RAW attribute numbers. A raw "72
 *   dribbling" is meaningless without context. Three questions scouts actually
 *   ask are never answered by incumbents:
 *
 *   1. "Is he good FOR THAT POSITION?"   → position-fit weighting
 *   2. "Is he good FOR HIS AGE?"         → age-curve adjustment
 *   3. "Can I trust this number?"        → confidence discount
 *
 * FutWeb answers all three. Every rating published on FutWeb is therefore a
 * *decision input*, not a vanity number.
 * ==========================================================================*/

import type { PlayerAttributes, PositionGroup, MatchStats } from '@/types'

/* ------------------------------------------------------------------ *
 * 1. Position-aware weighting
 * ------------------------------------------------------------------ */

/** Attribute weights per position group. Each group sums to 1.0. */
export const POSITION_WEIGHTS: Record<PositionGroup, Partial<Record<keyof PlayerAttributes | string, number>>> = {
  GK: {
    shot_stopping: 0.20, reflexes: 0.18, handling: 0.14, gk_distribution: 0.10,
    positioning: 0.10, composure: 0.08, decision_making: 0.07,
    aerial_duels: 0.06, jumping: 0.04, acceleration: 0.03,
  },
  DF: {
    tackling: 0.14, marking: 0.13, interceptions: 0.12, positioning: 0.11,
    aerial_duels: 0.10, strength: 0.08, decision_making: 0.07,
    passing: 0.06, acceleration: 0.06, composure: 0.05,
    work_rate: 0.04, stamina: 0.04,
  },
  MF: {
    passing: 0.15, vision: 0.13, decision_making: 0.11, first_touch: 0.10,
    positioning: 0.09, work_rate: 0.09, stamina: 0.08, dribbling: 0.07,
    composure: 0.06, technique: 0.05, interceptions: 0.04, tackling: 0.03,
  },
  FW: {
    finishing: 0.19, composure: 0.11, acceleration: 0.11, positioning: 0.10,
    dribbling: 0.09, sprint_speed: 0.09, first_touch: 0.08, decision_making: 0.07,
    technique: 0.06, strength: 0.05, heading: 0.05,
  },
}

export const ATTRIBUTE_GROUPS = {
  Technical: ['finishing', 'passing', 'dribbling', 'first_touch', 'crossing', 'technique', 'heading'],
  Physical: ['acceleration', 'sprint_speed', 'agility', 'stamina', 'strength', 'jumping', 'balance'],
  Mental: ['vision', 'positioning', 'decision_making', 'work_rate', 'composure', 'aggression', 'leadership'],
  Defending: ['marking', 'tackling', 'interceptions', 'aerial_duels'],
  Goalkeeping: ['reflexes', 'handling', 'gk_distribution', 'shot_stopping'],
} as const

export const ATTRIBUTE_LABELS: Record<string, string> = {
  finishing: 'Finishing', passing: 'Passing', dribbling: 'Dribbling', first_touch: 'First Touch',
  crossing: 'Crossing', technique: 'Technique', heading: 'Heading',
  acceleration: 'Acceleration', sprint_speed: 'Sprint Speed', agility: 'Agility',
  stamina: 'Stamina', strength: 'Strength', jumping: 'Jumping', balance: 'Balance',
  vision: 'Vision', positioning: 'Positioning', decision_making: 'Decision Making',
  work_rate: 'Work Rate', composure: 'Composure', aggression: 'Aggression', leadership: 'Leadership',
  marking: 'Marking', tackling: 'Tackling', interceptions: 'Interceptions', aerial_duels: 'Aerial Duels',
  reflexes: 'Reflexes', handling: 'Handling', gk_distribution: 'Distribution', shot_stopping: 'Shot Stopping',
}

export const POSITION_LIST = [
  'GK', 'RB', 'RWB', 'CB', 'LB', 'LWB', 'CDM', 'CM', 'CAM',
  'RM', 'LM', 'RW', 'LW', 'ST', 'CF',
] as const

export function groupForPosition(position: string): PositionGroup {
  const p = position.toUpperCase()
  if (p === 'GK') return 'GK'
  if (['RB', 'RWB', 'CB', 'LB', 'LWB'].includes(p)) return 'DF'
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'MF'
  return 'FW'
}

/** Weighted attribute composite for one position group (0–100). */
export function weightedScore(attrs: PlayerAttributes, group: PositionGroup): number {
  const w = POSITION_WEIGHTS[group]
  let total = 0
  let weightSum = 0
  for (const [key, weight] of Object.entries(w)) {
    const v = attrs[key as keyof PlayerAttributes]
    if (typeof v === 'number' && weight) {
      total += v * weight
      weightSum += weight
    }
  }
  return weightSum === 0 ? 0 : total / weightSum
}

/* ------------------------------------------------------------------ *
 * 2. Age-curve adjustment — "good for his age"
 * ------------------------------------------------------------------ */

/**
 * Physical attributes peak ~25, technical ~27, mental ~30.
 * We model a normalised development curve so a 17-year-old's 68 finishing
 * is not compared unfairly against a 26-year-old's 78.
 * Returns a multiplier applied to the *projected* figure.
 */
const PEAK_AGE: Record<PositionGroup, number> = { GK: 29, DF: 28, MF: 27, FW: 26 }
const DEVELOPMENT_RATE = 0.055 // ~5.5% of current rating per year of gap, capped

export interface AgeContext {
  age: number
  /** Rating relative to peers of the same age band. >1 = ahead of curve. */
  ageFactor: number
  /** Projected peak rating if development continues on the current curve. */
  projectedPeak: number
  /** Years until the position's typical prime. */
  yearsToPrime: number
  band: 'U17' | 'U20' | 'U23' | 'Prime' | 'Veteran'
}

export function ageBand(age: number): AgeContext['band'] {
  if (age < 17) return 'U17'
  if (age < 20) return 'U20'
  if (age < 23) return 'U23'
  if (age <= 30) return 'Prime'
  return 'Veteran'
}

export function computeAgeContext(age: number, base: number, group: PositionGroup): AgeContext {
  const peak = PEAK_AGE[group]
  const gap = peak - age
  const yearsToPrime = Math.max(0, gap)
  // Cap so pre-teen projections don't produce absurd numbers.
  const effectiveGap = Math.max(-6, Math.min(gap, 12))
  const ageFactor = 1 + effectiveGap * DEVELOPMENT_RATE * (effectiveGap > 0 ? 1 : 0.4)
  const projectedPeak = Math.min(99, base * ageFactor)
  return { age, ageFactor, projectedPeak, yearsToPrime, band: ageBand(age) }
}

/* ------------------------------------------------------------------ *
 * 3. Confidence — how much evidence backs this number
 * ------------------------------------------------------------------ */

export interface ConfidenceBreakdown {
  score: number               // 0–100
  factors: { label: string; weight: number; satisfied: boolean; detail: string }[]
  label: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Very High'
}

/**
 * A self-rated profile with one video is NOT equivalent to a rating backed by
 * 12 scout observations. Incumbents treat them the same. We don't.
 */
export function computeConfidence(input: {
  ratingCount: number
  independentRaters: number
  verifiedRaters: number
  matchesObserved: number
  hasVideo: boolean
  hasVerifiedStats: boolean
}): ConfidenceBreakdown {
  const factors = [
    { label: 'Multiple observations', weight: 25, satisfied: input.ratingCount >= 3, detail: `${input.ratingCount} rating${input.ratingCount === 1 ? '' : 's'} on file` },
    { label: 'Independent raters', weight: 25, satisfied: input.independentRaters >= 2, detail: `${input.independentRaters} independent source${input.independentRaters === 1 ? '' : 's'}` },
    { label: 'Verified raters', weight: 20, satisfied: input.verifiedRaters >= 1, detail: `${input.verifiedRaters} verified scout/coach rating${input.verifiedRaters === 1 ? '' : 's'}` },
    { label: 'Live match observation', weight: 15, satisfied: input.matchesObserved >= 3, detail: `${input.matchesObserved} match${input.matchesObserved === 1 ? '' : 'es'} observed` },
    { label: 'Video evidence', weight: 8, satisfied: input.hasVideo, detail: input.hasVideo ? 'Highlight footage attached' : 'No verified footage' },
    { label: 'Official match stats', weight: 7, satisfied: input.hasVerifiedStats, detail: input.hasVerifiedStats ? 'Federation stats linked' : 'Self-reported stats only' },
  ]
  const score = Math.round(factors.filter(f => f.satisfied).reduce((s, f) => s + f.weight, 0))
  const label: ConfidenceBreakdown['label'] =
    score >= 85 ? 'Very High' : score >= 65 ? 'High' : score >= 40 ? 'Moderate' : score >= 20 ? 'Low' : 'Very Low'
  return { score, factors, label }
}

/* ------------------------------------------------------------------ *
 * 4. The FutWeb Score
 * ------------------------------------------------------------------ */

export interface FutWebScore {
  /** Headline 0–99. Position-weighted, confidence-discounted "now" rating. */
  current: number
  /** Age-adjusted projection at the player's positional prime. */
  potential: number
  confidence: number
  confidenceLabel: string
  group: PositionGroup
  /** Fit score 0–100 for every position group — reveals versatility. */
  positionFit: Record<PositionGroup, number>
  /** Which positions this player is genuinely suited to (fit >= 70). */
  viablePositions: string[]
  ratingTier: 'Elite' | 'High' | 'Solid' | 'Developing' | 'Raw'
}

/**
 * Confidence discount: a rating nobody has corroborated is regressed toward
 * the population mean (~50). Full confidence → no regression.
 */
function applyConfidenceDiscount(raw: number, confidence: number): number {
  const POPULATION_MEAN = 50
  const shrink = 0.30 * (1 - confidence / 100) // max 30% pull to mean
  return raw * (1 - shrink) + POPULATION_MEAN * shrink
}

export function computeFutWebScore(opts: {
  attributes: PlayerAttributes
  position: string
  age: number
  confidence: number
}): FutWebScore {
  const { attributes, position, age, confidence } = opts
  const primaryGroup = groupForPosition(position)

  const positionFit = {} as Record<PositionGroup, number>
  for (const g of Object.keys(POSITION_WEIGHTS) as PositionGroup[]) {
    positionFit[g] = Math.round(weightedScore(attributes, g))
  }

  const raw = positionFit[primaryGroup]
  const current = applyConfidenceDiscount(raw, confidence)

  const ctx = computeAgeContext(age, current, primaryGroup)
  const potential = Math.min(99, Math.round(ctx.projectedPeak))

  const viablePositions = POSITION_LIST.filter(p => {
    const fit = positionFit[groupForPosition(p)]
    return fit >= 70
  }) as unknown as string[]

  const ratingTier: FutWebScore['ratingTier'] =
    current >= 82 ? 'Elite' : current >= 72 ? 'High' : current >= 60 ? 'Solid' : current >= 45 ? 'Developing' : 'Raw'

  return {
    current: Math.round(current),
    potential,
    confidence,
    confidenceLabel: computeConfidence({
      ratingCount: 0, independentRaters: 0, verifiedRaters: 0,
      matchesObserved: 0, hasVideo: false, hasVerifiedStats: false,
    }).label,
    group: primaryGroup,
    positionFit,
    viablePositions,
    ratingTier,
  }
}

/* ------------------------------------------------------------------ *
 * 5. Per-90 performance metrics derived from raw match stats
 * ------------------------------------------------------------------ */

export function per90(stats: MatchStats) {
  const n = Math.max(stats.minutes / 90, 0.01)
  const r = (v: number, d = 2) => Math.round((v / n) * 10 ** d) / 10 ** d
  return {
    goals: r(stats.goals),
    assists: r(stats.assists),
    goalsPlusAssists: r(stats.goals + stats.assists),
    shots: r(stats.shots),
    shotAccuracy: stats.shots ? Math.round((stats.shots_on_target / stats.shots) * 100) : 0,
    passAccuracy: stats.pass_attempts ? Math.round((stats.passes_completed / stats.pass_attempts) * 100) : 0,
    duelSuccess: stats.duels ? Math.round((stats.duels_won / stats.duels) * 100) : 0,
    tackles: r(stats.tackles),
    interceptions: r(stats.interceptions),
    cards: r(stats.yellow_cards + stats.red_cards),
    conversion: stats.shots ? Math.round((stats.goals / stats.shots) * 100) : 0,
    minutesPerGoal: stats.goals ? Math.round(stats.minutes / stats.goals) : null,
  }
}

/* ------------------------------------------------------------------ *
 * 6. Trust Score — the anti-scam layer
 * ------------------------------------------------------------------ */

export interface TrustScore {
  score: number
  tier: 'unverified' | 'identity' | 'entity' | 'gold'
  label: string
  checks: { label: string; passed: boolean; pending: boolean; hint: string }[]
  nextStep?: string
}

/**
 * FutWeb's answer to the single biggest problem in Nigerian football:
 * fake agents and phantom trials. Drogba called it "human trafficking";
 * FIFPRO documented families losing £4,300–£8,600 per scam.
 * Every club on FutWeb carries a machine-readable, tamper-evident trust score.
 */
export function computeTrustScore(input: {
  emailVerified: boolean
  phoneVerified: boolean
  identityVerified: boolean
  entityVerified: boolean
  videoVerified: boolean
  referencesVerified: boolean
  paymentVerified: boolean
  tenureDays: number
  disputesUpheld: number
}): TrustScore {
  const checks = [
    { label: 'Email verified', passed: input.emailVerified, pending: false, hint: 'Confirms control of the address', points: 10 },
    { label: 'Phone verified', passed: input.phoneVerified, pending: false, hint: 'Nigerian or international line, OTP confirmed', points: 10 },
    { label: 'Identity verified', passed: input.identityVerified, pending: false, hint: 'NIN, BVN or passport matched to the account holder', points: 20 },
    { label: 'Entity verified', passed: input.entityVerified, pending: false, hint: 'CAC number and NFF/state FA affiliation confirmed', points: 25 },
    { label: 'Liveness check', passed: input.videoVerified, pending: false, hint: 'Short video selfie — defeats impersonation', points: 10 },
    { label: 'References confirmed', passed: input.referencesVerified, pending: false, hint: 'Two independent football references', points: 10 },
    { label: 'Billing in good standing', passed: input.paymentVerified, pending: false, hint: 'Active paid subscription', points: 10 },
    { label: 'Clean conduct record', passed: input.disputesUpheld === 0, pending: false, hint: 'No upheld disputes against this account', points: 5 },
  ]

  let score = checks.filter(c => c.passed).reduce((s, c) => s + c.points, 0)
  // Tenure bonus, capped
  score += Math.min(10, Math.floor(input.tenureDays / 30))
  // Dispute penalty
  score -= input.disputesUpheld * 15
  score = Math.max(0, Math.min(100, score))

  const tier: TrustScore['tier'] =
    score >= 85 && input.entityVerified && input.videoVerified ? 'gold'
    : score >= 65 && input.entityVerified ? 'entity'
    : score >= 35 && input.identityVerified ? 'identity'
    : 'unverified'

  const label =
    tier === 'gold' ? 'Gold Verified' : tier === 'entity' ? 'Entity Verified'
    : tier === 'identity' ? 'Identity Verified' : 'Unverified'

  const nextCheck = checks.find(c => !c.passed)
  const nextStep = nextCheck ? `Next: ${nextCheck.label} — ${nextCheck.hint}` : undefined

  return {
    score, tier, label,
    checks: checks.map(({ points, ...c }) => c),
    nextStep,
  }
}

export const TRUST_TIER_STYLES: Record<TrustScore['tier'], { bg: string; text: string; ring: string; dot: string }> = {
  gold: { bg: 'bg-gold-50', text: 'text-gold-700', ring: 'ring-gold-300', dot: 'bg-gold-400' },
  entity: { bg: 'bg-trust-50', text: 'text-trust-700', ring: 'ring-trust-200', dot: 'bg-trust-400' },
  identity: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-500' },
  unverified: { bg: 'bg-ink-100', text: 'text-ink-600', ring: 'ring-ink-200', dot: 'bg-ink-400' },
}

/* ------------------------------------------------------------------ *
 * 7. Formatting helpers
 * ------------------------------------------------------------------ */

export function scoreColor(score: number): string {
  if (score >= 82) return '#00B67A'
  if (score >= 72) return '#34D9A4'
  if (score >= 60) return '#F5B301'
  if (score >= 45) return '#F59E0B'
  return '#E4002B'
}

export function ageFrom(dob: string): number {
  const d = new Date(dob)
  const diff = Date.now() - d.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}
