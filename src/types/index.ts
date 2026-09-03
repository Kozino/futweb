/* ============================================================================
 * FutWeb — Domain model
 * Single source of truth shared by web app, edge functions and DB migrations.
 * ==========================================================================*/

export type UserRole = 'player' | 'club_admin' | 'club_staff' | 'scout' | 'admin'
export type AccountType = 'player' | 'club'

/* ---------- Trust & verification (FutWeb's core moat) ---------- */
export type VerificationTier = 'unverified' | 'identity' | 'entity' | 'gold'
export type VerificationStatus = 'none' | 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'

export interface TrustSignals {
  email_verified: boolean
  phone_verified: boolean
  identity_verified: boolean      // NIN / BVN / passport
  entity_verified: boolean        // CAC registration (clubs) or NFF/state FA affiliation
  video_verified: boolean         // live liveness check
  references_verified: boolean    // 2+ confirmed references (coach / club)
  payment_verified: boolean       // successful paid subscription
  tenure_days: number
  disputes_upheld: number
}

/* ---------- Football domain ---------- */
export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW'
export type Foot = 'left' | 'right' | 'both'

export interface PlayerAttributes {
  /* Technical */
  finishing: number; passing: number; dribbling: number; first_touch: number
  crossing: number; technique: number; heading: number
  /* Physical */
  acceleration: number; sprint_speed: number; agility: number; stamina: number
  strength: number; jumping: number; balance: number
  /* Mental */
  vision: number; positioning: number; decision_making: number; work_rate: number
  composure: number; aggression: number; leadership: number
  /* Defensive */
  marking: number; tackling: number; interceptions: number; aerial_duels: number
  /* Goalkeeping (scored only for GK) */
  reflexes: number; handling: number; gk_distribution: number; shot_stopping: number
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  [key: string]: any
}

export interface MatchStats {
  appearances: number; minutes: number; goals: number; assists: number
  shots: number; shots_on_target: number; pass_attempts: number; passes_completed: number
  duels: number; duels_won: number; tackles: number; interceptions: number
  fouls_committed: number; yellow_cards: number; red_cards: number
  clean_sheets: number; goals_conceded: number; saves: number
}

export interface PhysicalProfile {
  height_cm: number; weight_kg: number; wingspan_cm?: number
  body_fat_pct?: number; resting_hr?: number; vo2max?: number
  sprint_10m_s?: number; sprint_40m_s?: number; yo_yo_level?: number
}

export interface CareerEntry {
  id: string; club_name: string; season: string; league: string
  appearances: number; goals: number; assists: number
  verified: boolean; verified_by?: string
}

export interface MediaAsset {
  id: string; kind: 'highlight' | 'full_match' | 'photo' | 'document'
  url: string; thumbnail_url?: string; title: string
  duration_s?: number; size_bytes?: number
  /* Provenance — stops stolen / mislabelled footage */
  recorded_at?: string; recorded_location?: string
  verified: boolean; uploaded_at: string
}

export interface PlayerProfile {
  id: string
  user_id: string
  slug: string
  first_name: string; last_name: string
  dob: string
  nationality: string; state_of_origin?: string
  position_primary: string; position_secondary: string[]
  foot: Foot
  height_cm: number; weight_kg: number
  bio?: string
  current_club_id?: string
  availability: 'available' | 'trial_only' | 'under_contract' | 'not_looking'
  contract_expiry?: string
  visibility: 'public' | 'verified_only' | 'private'
  /* Minors protection (FIFA Art.19 + NDPA) */
  is_minor: boolean
  guardian_name?: string; guardian_phone?: string; guardian_consent_at?: string
  media: MediaAsset[]
  career: CareerEntry[]
  created_at: string; updated_at: string
}

export interface PlayerRatingSnapshot {
  id: string; player_id: string; recorded_at: string
  rated_by: string; rated_by_role: 'self' | 'coach' | 'scout' | 'analyst' | 'academy'
  attributes: PlayerAttributes
  futweb_score: number
  position_fit: Record<string, number>
  confidence: number
  context?: 'training' | 'match' | 'tournament' | 'combine'
  offline_captured: boolean
}

export interface ClubProfile {
  id: string; user_id: string; slug: string
  name: string; short_name: string
  country: string; state?: string; city?: string
  league?: string; division?: string
  cac_number?: string            // Nigerian Corporate Affairs Commission
  nff_affiliation?: string       // NFF / state FA affiliation number
  stadium?: string
  founded_year?: number
  logo_url?: string
  verification_tier: VerificationTier
  verification_status: VerificationStatus
  created_at: string
}

/* ---------- Billing ---------- */
export type PlanInterval = 'monthly' | 'annual'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'cancelled' | 'expired' | 'paused'

export interface Plan {
  id: string; code: string; name: string
  audience: 'player' | 'club' | 'both'
  price_ngn: number; price_usd: number
  interval: PlanInterval
  player_seats: number      // -1 = unlimited
  staff_seats: number
  features: string[]
  featured?: boolean
  trial_days: number
}

export interface Subscription {
  id: string
  subscriber_type: 'player' | 'club'
  player_id?: string; club_id?: string
  plan_code: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  grace_ends_at?: string
  cancel_at_period_end: boolean
  flw_subscription_id?: string
  seats_used: number
}

/* ---------- Recruitment ---------- */
export type TrialStatus = 'draft' | 'pending_verification' | 'open' | 'closed' | 'cancelled'

export interface TrialPosting {
  id: string; club_id: string
  title: string; description: string
  positions: string[]; age_min: number; age_max: number
  location: string; trial_date: string
  /* Trust rule: FutWeb never allows a club to charge players for a trial. */
  fee_charged_to_player: number
  verified: boolean
  status: TrialStatus
  applicant_count: number
  created_at: string
}

export type ShortlistName = 'watching' | 'shortlisted' | 'trial_invited' | 'signed' | 'rejected'

export interface ScoutReport {
  id: string; player_id: string; author_id: string; club_id?: string
  rating: number                 // 1-5 stars for THIS club's need
  text: string
  recommendation: 'sign' | 'trial' | 'monitor' | 'pass'
  offline_captured: boolean
  created_at: string
}

/* ---------- Audit ---------- */
export interface AuditEvent {
  id: string; actor_id?: string; actor_role?: string
  action: string; entity_type: string; entity_id?: string
  metadata: Record<string, unknown>
  ip?: string; user_agent?: string
  created_at: string
}
