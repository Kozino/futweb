import { supabase } from '@/lib/supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export interface ClubAuditRow {
  id: number
  action: string
  actor_name: string
  actor_role: string
  metadata: Record<string, unknown>
  created_at: string
}

/** Read this club's own audit feed (newest first). */
export async function getClubAuditLog(clubId: string, limit = 200): Promise<ClubAuditRow[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('club_audit_log', {
    p_club_id: clubId,
    p_limit: limit,
  })
  if (error) throw error
  return (data as ClubAuditRow[] | null) ?? []
}

/** Human label for an audit action code. */
export function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    'trial.posted': 'Trial posted',
    'trial.status_changed': 'Trial status changed',
    'staff.added': 'Staff member added',
    'staff.role_changed': 'Staff role changed',
    'staff.removed': 'Staff member removed',
    'scout_report.created': 'Scout report added',
    'verification.club.verified': 'Club verified',
    'club.updated': 'Club profile updated',
    'trial.posting.verified': 'Trial approved',
    'trial.posting.rejected': 'Trial rejected',
    'account.suspended': 'Account suspended',
    'account.reinstated': 'Account reinstated',
  }
  return map[action] ?? action.replace(/[._]/g, ' ')
}

/** Serialise the audit feed to CSV for download. */
export function clubAuditToCsv(rows: ClubAuditRow[]): string {
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['time', 'action', 'actor', 'role', 'details']
  const lines = rows.map(r => [
    r.created_at,
    auditActionLabel(r.action),
    r.actor_name,
    r.actor_role,
    JSON.stringify(r.metadata ?? {}),
  ].map(esc).join(','))
  return [header.join(','), ...lines].join('\n')
}
