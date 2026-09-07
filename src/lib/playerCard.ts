import type { PlayerProfileRow } from '@/lib/supabase/players'
import type { PlayerAttributesRow } from '@/lib/supabase/attributes'
import { PLAYER_ATTRIBUTE_KEYS } from '@/lib/supabase/attributes'
import type { PlayerAttributes } from '@/types'
import type { ShareCardData } from '@/components/player/ShareCard'

export interface ShareCardSource {
  player: PlayerProfileRow | null
  attributes: PlayerAttributesRow | null
  /** Latest club name from the player's career (optional). */
  clubName?: string | null
  /** Whether the player is verified (drives the badge on the card). */
  verified?: boolean
}

/** Best-known club name across the player's career entries (most recent season first). */
export function latestClubName(career: Array<Record<string, unknown>>): string | null {
  for (const c of career) {
    const n = c.club_name
    if (typeof n === 'string' && n.trim()) return n.trim()
  }
  return null
}

/** Map the stored attribute row (nullable columns) into a 0–99 PlayerAttributes map. */
export function attributesFromRow(row: PlayerAttributesRow | null): PlayerAttributes {
  const out = {} as PlayerAttributes
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const value = row?.[key]
    out[key] =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(99, value))
        : 50
  }
  return out
}

export function ageFromDob(dob?: string | null): number {
  if (!dob) return 0
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return 0
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return Math.max(0, age)
}

/**
 * Build a canvas-ready ShareCardData from the signed-in player's own data.
 * Falls back gracefully (empty club, zero measurements, default attributes) so
 * the card still renders even for a lightly-filled profile.
 */
export function buildShareCardData(source: ShareCardSource): ShareCardData | null {
  const { player } = source
  if (!player) return null

  return {
    name: `${player.first_name} ${player.last_name}`.trim() || 'Footballer',
    position: player.position_primary || 'Player',
    age: ageFromDob(player.dob),
    club: source.clubName?.trim() || '',
    nationality: player.nationality || 'Nigeria',
    foot: player.foot === 'both' ? 'Both' : player.foot === 'left' ? 'Left' : 'Right',
    height: player.height_cm ?? 0,
    weight: player.weight_kg ?? 0,
    score: player.futweb_score ?? 0,
    potential: player.potential ?? 0,
    confidence: player.confidence ?? 0,
    attributes: attributesFromRow(source.attributes),
    verified: Boolean(source.verified),
  }
}
