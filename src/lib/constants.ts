import type { Plan } from '@/types'

/* ------------------------------------------------------------------ *
 * Subscription plans
 * Pricing is deliberately Africa-anchored: competitors charge €250–€20,000
 * per year in hard currency, which excludes the entire Nigerian market.
 * Annual plans are discounted ~2 months — intentional, because Nigerian
 * academies budget seasonally, not monthly.
 * ------------------------------------------------------------------ */
export const PLANS: Plan[] = [
  {
    id: 'p_scout', code: 'player_scout', name: 'Scout', audience: 'player',
    price_ngn: 0, price_usd: 0, interval: 'monthly',
    player_seats: 1, staff_seats: 0, trial_days: 0,
    features: [
      'Basic digital CV (stats + photo)',
      'Public profile link',
      'Visible in club search',
      'FutWeb Score (self-rated, low confidence)',
    ],
  },
  {
    id: 'p_pro', code: 'player_pro', name: 'Pro', audience: 'player',
    price_ngn: 3500, price_usd: 4, interval: 'monthly',
    player_seats: 1, staff_seats: 0, trial_days: 14, featured: true,
    features: [
      'Everything in Scout',
      'Full 32-attribute radar + position fit',
      'Up to 10 highlight videos (video-first CV)',
      'Shareable WhatsApp/PNG player card',
      'Coach-verified ratings (raises your confidence score)',
      'Verified trial invitations — no agent fees, ever',
      'Scout view analytics: who looked at your profile',
    ],
  },
  {
    id: 'p_elite', code: 'player_elite', name: 'Elite', audience: 'player',
    price_ngn: 9500, price_usd: 11, interval: 'monthly',
    player_seats: 1, staff_seats: 0, trial_days: 14,
    features: [
      'Everything in Pro',
      'Unlimited video + full-match uploads',
      'Career development timeline & projection',
      'Priority placement in club discovery',
      'Verified badge eligibility (ID + liveness)',
      'Direct club messaging, guardian-copied if under 18',
      'PDF scouting dossier export',
    ],
  },
  {
    id: 'c_academy', code: 'club_academy', name: 'Academy', audience: 'club',
    price_ngn: 25000, price_usd: 22, interval: 'monthly',
    player_seats: 50, staff_seats: 3, trial_days: 14,
    features: [
      'Up to 50 player profiles',
      '3 staff accounts (coach / scout / admin roles)',
      'Squad rating & attribute tracking',
      'Offline scouting capture (works with no network)',
      'Shortlists & internal scout reports',
      'Player development timeline',
    ],
  },
  {
    id: 'c_pro_club', code: 'club_pro', name: 'Pro Club', audience: 'club',
    price_ngn: 75000, price_usd: 65, interval: 'monthly',
    player_seats: 250, staff_seats: 10, trial_days: 14, featured: true,
    features: [
      'Up to 250 player profiles',
      '10 staff accounts with granular RBAC',
      'Everything in Academy',
      'Discovery search across the full FutWeb index',
      'Verified trial postings (players see you are real)',
      'Match stats ingestion & per-90 analytics',
      'Compare up to 4 players side by side',
      'Audit log export (compliance-ready)',
    ],
  },
  {
    id: 'c_enterprise', code: 'club_enterprise', name: 'Federation', audience: 'club',
    price_ngn: 300000, price_usd: 260, interval: 'monthly',
    player_seats: -1, staff_seats: -1, trial_days: 30,
    features: [
      'Unlimited players & staff',
      'Everything in Pro Club',
      'Multi-academy / group structure',
      'SSO, custom roles & data residency options',
      'API access + webhook streams',
      'Dedicated onboarding & NFF compliance support',
      'Custom SLA & named account manager',
    ],
  },
]

export const ANNUAL_DISCOUNT_MONTHS = 2

export function annualPrice(p: Plan) {
  return Math.round((p.price_ngn * 12 * (12 - ANNUAL_DISCOUNT_MONTHS)) / 12)
}
export function annualPriceUsd(p: Plan) {
  return Math.round((p.price_usd * 12 * (12 - ANNUAL_DISCOUNT_MONTHS)) / 12)
}

/* ------------------------------------------------------------------ *
 * Nigerian / African competition context — incumbents barely cover
 * the NPFL, let alone state FA leagues and grassroots tournaments.
 * ------------------------------------------------------------------ */
export const LEAGUES = [
  { value: 'npfl', label: 'NPFL — Nigeria Professional Football League', tier: 1 },
  { value: 'nnl', label: 'NNL — Nigeria National League', tier: 2 },
  { value: 'nlo', label: 'NLO — Nationwide League One', tier: 3 },
  { value: 'nwfl', label: 'NWFL — Nigeria Women Football League', tier: 1 },
  { value: 'state_fa', label: 'State FA League', tier: 4 },
  { value: 'academy', label: 'Academy / Grassroots', tier: 5 },
  { value: 'school', label: 'School / University (NUGA, NISSA)', tier: 5 },
  { value: 'street', label: 'Street / Unattached', tier: 6 },
  { value: 'ghl', label: 'Ghana Premier League', tier: 1 },
  { value: 'other_africa', label: 'Other African League', tier: 2 },
  { value: 'europe_lower', label: 'European Lower Division', tier: 2 },
  { value: 'europe_top', label: 'European Top Division', tier: 1 },
  { value: 'other', label: 'Other / International', tier: 3 },
] as const

export const NAV_BY_ROLE = {
  player: [
    { label: 'Dashboard', to: '/player', icon: 'grid' },
    { label: 'My CV', to: '/player/profile', icon: 'user' },
    { label: 'Attributes', to: '/player/attributes', icon: 'radar' },
    { label: 'Performance', to: '/player/stats', icon: 'chart' },
    { label: 'Media', to: '/player/media', icon: 'video' },
    { label: 'Trials & Offers', to: '/player/trials', icon: 'target' },
    { label: 'Verification', to: '/player/verify', icon: 'shield' },
    { label: 'Billing', to: '/billing', icon: 'card' },
  ],
  club: [
    { label: 'Dashboard', to: '/club', icon: 'grid' },
    { label: 'Squad', to: '/club/squad', icon: 'users' },
    { label: 'Discovery', to: '/club/discovery', icon: 'search' },
    { label: 'Shortlists', to: '/club/shortlists', icon: 'list' },
    { label: 'Trials', to: '/club/trials', icon: 'target' },
    { label: 'Reports', to: '/club/reports', icon: 'doc' },
    { label: 'Staff', to: '/club/staff', icon: 'shield' },
    { label: 'Verification', to: '/club/verify', icon: 'building' },
    { label: 'Billing', to: '/billing', icon: 'card' },
  ],
  admin: [
    { label: 'Overview', to: '/admin', icon: 'grid' },
    { label: 'Clubs', to: '/admin/clubs', icon: 'users' },
    { label: 'Players', to: '/admin/players', icon: 'user' },
    { label: 'Verification Queue', to: '/admin/verification', icon: 'shield' },
    { label: 'Subscriptions', to: '/admin/subscriptions', icon: 'card' },
    { label: 'Disputes', to: '/admin/disputes', icon: 'alert' },
    { label: 'Audit Log', to: '/admin/audit', icon: 'doc' },
  ],
} as const
