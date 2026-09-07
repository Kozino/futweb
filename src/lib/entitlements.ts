/**
 * FutWeb plan entitlements.
 *
 * Decides WHICH features an account may use based on their plan and their
 * subscription state. This is the single source of truth for per-plan gating
 * in the client. The real security boundary remains Supabase RLS; this drives
 * the UX so users are nudged to the correct plan instead of hitting dead ends.
 *
 * Model (configurable):
 *   - Trial = FULL access for the account's audience (player or club). We
 *     deliberately do not limit a trial to the specific plan picked, so a
 *     potential buyer can evaluate everything before paying. Set
 *     TRIAL_GRANTS_FULL=false to scope trial to the chosen plan instead.
 *   - Active / grace = features of the plan they actually subscribed to.
 *   - Anything else (expired/cancelled/paused/none) = no premium features.
 *     (RequireSubscription already blocks those users at the route level.)
 *
 * Plan codes (see plans table seed):
 *   players: player_scout (0)  < player_pro (1)  < player_elite (2)
 *   clubs:   club_academy (0)  < club_pro (1)    < club_enterprise (2)
 */

export type EntitlementAudience = 'player' | 'club'

/** Named feature a gate can check. Add keys here and describe them below. */
export type EntitlementKey =
  // Player — Pro level (1)
  | 'radar_full'            // Full 32-attribute radar + position fit
  | 'share_card'            // Shareable WhatsApp/PNG player card
  | 'coach_ratings'         // Coach/scout-verified ratings
  | 'profile_analytics'     // See who viewed your profile
  | 'verified_trials'       // Verified trial invitations
  // Player — Elite level (2)
  | 'unlimited_video'       // No highlight-video cap (Pro caps at 10)
  | 'development_timeline'  // Career development timeline & projection
  | 'priority_discovery'    // Priority placement in club discovery
  | 'verified_badge'        // Verified (gold) badge eligibility
  | 'direct_messaging'      // Direct club messaging
  | 'pdf_dossier'           // PDF scouting dossier export
  // Club — Pro Club level (1)
  | 'full_discovery'        // Full discovery search index
  | 'verified_trial_postings' // Post verified/open trials players can apply to
  | 'per90_analytics'       // Per-90 analytics
  | 'comparison'            // Side-by-side player comparison
  | 'audit_export'          // Audit log export

export interface FeatureInfo {
  key: EntitlementKey
  audience: EntitlementAudience
  minLevel: number
  label: string
  desc: string
}

/** Human catalogue used for the "what your plan includes" panel. */
export const FEATURE_CATALOG: FeatureInfo[] = [
  // Player — Pro
  { key: 'radar_full', audience: 'player', minLevel: 1, label: 'Full 32-attribute radar', desc: 'Position-fit weighting across all attribute groups.' },
  { key: 'share_card', audience: 'player', minLevel: 1, label: 'Shareable player card', desc: 'Download & share a WhatsApp/PNG player card.' },
  { key: 'coach_ratings', audience: 'player', minLevel: 1, label: 'Coach-verified ratings', desc: 'Independent coach/scout ratings raise your confidence.' },
  { key: 'profile_analytics', audience: 'player', minLevel: 1, label: 'Profile view analytics', desc: 'See who viewed your profile.' },
  { key: 'verified_trials', audience: 'player', minLevel: 1, label: 'Verified trial invitations', desc: 'Apply to verified, zero-fee club trials.' },
  // Player — Elite
  { key: 'unlimited_video', audience: 'player', minLevel: 2, label: 'Unlimited video', desc: 'No cap on highlight or full-match uploads.' },
  { key: 'development_timeline', audience: 'player', minLevel: 2, label: 'Development timeline', desc: 'Career timeline & projection to your positional prime.' },
  { key: 'priority_discovery', audience: 'player', minLevel: 2, label: 'Priority discovery placement', desc: 'Surface first in club search results.' },
  { key: 'verified_badge', audience: 'player', minLevel: 2, label: 'Verified badge eligibility', desc: 'Unlock the gold verified badge.' },
  { key: 'direct_messaging', audience: 'player', minLevel: 2, label: 'Direct club messaging', desc: 'Message verified clubs directly.' },
  { key: 'pdf_dossier', audience: 'player', minLevel: 2, label: 'PDF dossier export', desc: 'Download your full profile as a scouting dossier.' },
  // Club — Pro Club
  { key: 'full_discovery', audience: 'club', minLevel: 1, label: 'Full discovery index', desc: 'Search every player across the FutWeb index.' },
  { key: 'verified_trial_postings', audience: 'club', minLevel: 1, label: 'Verified trial postings', desc: 'Post trials that publish as open + verified to players.' },
  { key: 'per90_analytics', audience: 'club', minLevel: 1, label: 'Per-90 analytics', desc: 'Normalised per-90 performance metrics.' },
  { key: 'comparison', audience: 'club', minLevel: 1, label: 'Side-by-side comparison', desc: 'Compare players head to head.' },
  { key: 'audit_export', audience: 'club', minLevel: 1, label: 'Audit log export', desc: 'Export your organisation activity.' },
]

const PLAYER_LEVEL: Record<string, number> = { player_scout: 0, player_pro: 1, player_elite: 2 }
const CLUB_LEVEL: Record<string, number> = { club_academy: 0, club_pro: 1, club_enterprise: 2 }
const MAX_PLAYER_LEVEL = 2
const MAX_CLUB_LEVEL = 2

/** Trial grants full access to the account's audience (players -> Elite, clubs -> Pro Club/Enterprise). */
export const TRIAL_GRANTS_FULL = true

function levelForPlan(audience: EntitlementAudience, planCode: string | null | undefined): number {
  const table = audience === 'player' ? PLAYER_LEVEL : CLUB_LEVEL
  return planCode ? (table[planCode] ?? 0) : 0
}

export interface Entitlements {
  audience: EntitlementAudience
  /** 0 = free/lowest, 1 = mid, 2 = top for the audience. -1 = locked. */
  level: number
  planCode: string | null
  /** True when the account is still within its trial (full access). */
  trial: boolean
  granted: Set<EntitlementKey>
  /** Highlight-video upload quota: -1 = unlimited, else a hard cap. */
  videoQuota: number
}

export function resolveEntitlements(
  audience: EntitlementAudience,
  subStatus: string | null | undefined,
  planCode: string | null | undefined,
): Entitlements {
  const isTrial = subStatus === 'trialing'
  const isActiveOrGrace = subStatus === 'active' || subStatus === 'grace'

  // Locked unless on a live subscription state.
  if (!isTrial && !isActiveOrGrace) {
    return {
      audience,
      level: -1,
      planCode: planCode ?? null,
      trial: false,
      granted: new Set(),
      videoQuota: 0,
    }
  }

  let level = levelForPlan(audience, planCode)
  if (isTrial && TRIAL_GRANTS_FULL) {
    level = audience === 'player' ? MAX_PLAYER_LEVEL : MAX_CLUB_LEVEL
  }

  const granted = new Set<EntitlementKey>()
  for (const f of FEATURE_CATALOG) {
    if (f.audience === audience && level >= f.minLevel) granted.add(f.key)
  }

  // Highlight-video upload quota for players (club plans don't cap player CV video here).
  let videoQuota = -1 // unlimited by default
  if (audience === 'player') {
    videoQuota = level >= 2 ? -1 : level >= 1 ? 10 : 0
  }

  return { audience, level, planCode: planCode ?? null, trial: isTrial, granted, videoQuota }
}

/** Convenience for components that already have the auth SessionUser shape. */
export function entitlementsFor(
  user: { accountType?: string; role?: string; subStatus?: string; planCode?: string | null } | null | undefined,
): Entitlements {
  if (!user) {
    return resolveEntitlements('player', null, null)
  }
  const audience: EntitlementAudience =
    user.accountType === 'club' || user.role === 'admin' ? 'club' : 'player'
  // Site admins bypass per-plan gating entirely.
  if (user.role === 'admin') {
    return resolveEntitlements(audience, 'active', audience === 'club' ? 'club_enterprise' : 'player_elite')
  }
  return resolveEntitlements(audience, user.subStatus, user.planCode)
}

export function hasFeature(user: Parameters<typeof entitlementsFor>[0], feature: EntitlementKey): boolean {
  const e = entitlementsFor(user)
  return e.level >= 0 && e.granted.has(feature)
}

/**
 * Whether a club can self-publish a verified (open) trial right now. Requires
 * the club to be an entity-verified organisation AND on a plan/state that grants
 * 'verified_trial_postings' (Pro Club/Enterprise, or full-access trial).
 */
export function clubMayPublishVerifiedTrials(
  user: Parameters<typeof entitlementsFor>[0],
  entityVerified: boolean,
): boolean {
  if (!entityVerified) return false
  return hasFeature(user, 'verified_trial_postings')
}

/** Lowest tier label text used in upgrade prompts. */
export function upgradeTarget(feature: EntitlementKey): string {
  const f = FEATURE_CATALOG.find(x => x.key === feature)
  if (!f) return 'a paid plan'
  return f.audience === 'player'
    ? f.minLevel >= 2 ? 'Elite' : 'Pro'
    : f.minLevel >= 1 ? 'Pro Club' : 'a paid plan'
}
