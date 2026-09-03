import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Modal, Select, Skeleton, Textarea, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ageFrom } from '@/lib/ratings'
import {
  fetchProfile,
  adminSuspendAccount,
  adminReinstateAccount,
  adminVerifyProfile,
  adminSendMessage,
  type AdminProfileRow,
} from '@/lib/supabase/admin'

interface PlayerRow {
  id: string; user_id: string; first_name: string; last_name: string; dob: string
  state_of_origin: string | null; position_primary: string; nationality: string
  managed_by_club_id: string | null; futweb_score: number | null
  confidence: number | null; visibility: string; is_minor: boolean
  created_at: string; updated_at: string
}

export default function AdminPlayers() {
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [clubNames, setClubNames] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')

  // Detail modal state
  const [selected, setSelected] = useState<PlayerRow | null>(null)
  const [profile, setProfile] = useState<AdminProfileRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [verifyTier, setVerifyTier] = useState<'identity' | 'entity' | 'gold'>('identity')
  const [messageMode, setMessageMode] = useState(false)
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    let cancelled = false
    ;(async () => {
      const { data, error } = await client.from('players').select('*').order('created_at', { ascending: false })
      if (error) { toast({ tone: 'error', title: 'Could not load players', description: error.message }); setLoading(false); return }
      const rows = data ?? []
      const clubIds = [...new Set(rows.map(p => p.managed_by_club_id).filter(Boolean))] as string[]
      let names: Record<string, string> = {}
      if (clubIds.length) {
        const { data: clubs } = await client.from('clubs').select('id, name').in('id', clubIds)
        names = Object.fromEntries((clubs ?? []).map(c => [c.id, c.name]))
      }
      if (!cancelled) { setPlayers(rows); setClubNames(names); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => players.filter(p =>
    (!q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())) &&
    (!filter || (filter === 'minor' ? p.is_minor : filter === 'lowconf' ? (p.confidence ?? 0) < 45 : true))
  ), [players, q, filter])

  if (loading) return <Skeleton className="h-64 w-full" />

  async function openDetail(player: PlayerRow) {
    setSelected(player)
    setProfile(null)
    setMessageMode(false)
    setMsgTitle('')
    setMsgBody('')
    setSuspendReason('')
    setDetailLoading(true)
    try {
      setProfile(await fetchProfile(player.user_id))
    } catch {
      toast({ tone: 'error', title: 'Could not load account', description: 'Fetching the profile failed.' })
    } finally {
      setDetailLoading(false)
    }
  }

  async function run(fn: () => Promise<void>, okTitle: string) {
    setBusy(true)
    try { await fn(); toast({ tone: 'success', title: okTitle }); await openDetail(selected!) }
    catch (err) { toast({ tone: 'error', title: 'Action failed', description: err instanceof Error ? err.message : 'Please try again.' }) }
    finally { setBusy(false) }
  }

  const isSuspended = !!profile?.suspended_at

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="user" title="Players"
        subtitle={`${players.length} player profiles on the platform`}
        actions={<Button variant="outline" icon="download">Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" icon="search" placeholder="Search players…" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="max-w-[220px]" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="All players"
          options={[{ value: 'minor', label: 'Under 18 only' }, { value: 'lowconf', label: 'Low confidence ratings' }]} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Player', 'Pos', 'Age', 'Club', 'Score', 'Confidence', 'Visibility', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(p => (
              <tr key={p.id} className="hover:bg-ink-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-2xs font-bold text-white">
                      {p.first_name[0]}{p.last_name[0]}
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 font-semibold">
                        {p.first_name} {p.last_name}
                        {p.is_minor && <Badge tone="blue" size="sm">U18</Badge>}
                      </span>
                      <span className="block text-2xs text-ink-400">{p.state_of_origin ?? '—'}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{p.position_primary}</Badge></td>
                <td className="tnum px-4 py-3">{ageFrom(p.dob)}</td>
                <td className="px-4 py-3 text-xs text-ink-600">{p.managed_by_club_id ? clubNames[p.managed_by_club_id] ?? '—' : 'Unattached'}</td>
                <td className="tnum px-4 py-3 font-bold text-red-600">{p.futweb_score ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-bold',
                    (p.confidence ?? 0) >= 65 ? 'text-trust-600' : (p.confidence ?? 0) >= 40 ? 'text-gold-600' : 'text-red-500')}>
                    {p.confidence ?? 0}%
                  </span>
                </td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{p.visibility.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" icon="more" onClick={() => void openDetail(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg" title={`Player actions — ${selected?.first_name} ${selected?.last_name}`}
        description="View the account, then suspend, verify or message it.">

        {detailLoading ? <Skeleton className="h-48 w-full" /> : (
          <div className="space-y-4">
            {profile?.suspended_at && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <strong>Suspended</strong> since {new Date(profile.suspended_at).toLocaleString()}
                {profile.suspended_reason ? <> — {profile.suspended_reason}</> : null}
              </div>
            )}

            <div className="grid gap-x-6 gap-y-2 rounded-xl border border-ink-100 bg-ink-50/50 p-4 text-xs sm:grid-cols-2">
              {[
                ['Name', profile?.full_name ?? `${selected?.first_name} ${selected?.last_name}`],
                ['Email', profile?.email ?? '—'],
                ['Phone', profile?.phone ?? '—'],
                ['Account type', profile?.account_type ?? 'player'],
                ['Position', selected?.position_primary],
                ['Age', selected ? String(ageFrom(selected.dob)) : '—'],
                ['Nationality', selected?.nationality],
                ['Club', selected?.managed_by_club_id ? clubNames[selected.managed_by_club_id] : 'Unattached'],
                ['FutWeb Score', selected?.futweb_score != null ? String(selected.futweb_score) : '—'],
                ['Visibility', selected?.visibility.replace('_', ' ')],
                ['Sub status', profile?.sub_status ?? '—'],
                ['Plan', profile?.plan_code ?? '—'],
                ['Verification', profile ? `${profile.verification_tier} · ${profile.verification_status}` : '—'],
                ['Trust score', profile?.trust_score != null ? `${profile.trust_score}/100` : '—'],
                ['Disputes upheld', profile ? String(profile.disputes_upheld) : '0'],
                ['Joined', selected ? new Date(selected.created_at).toLocaleDateString() : '—'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3">
                  <span className="text-ink-400">{l}</span>
                  <span className="text-right font-semibold capitalize">{v || '—'}</span>
                </div>
              ))}
            </div>

            {/* Suspend / Reinstate */}
            {isSuspended ? (
              <Button variant="outline" fullWidth icon="check" disabled={busy}
                onClick={() => void run(() => adminReinstateAccount('profile', selected!.user_id), 'Account reinstated')}>
                Reinstate account
              </Button>
            ) : (
              <div className="rounded-xl border border-ink-100 p-3.5">
                <p className="text-xs font-bold">Suspend account</p>
                <p className="mt-0.5 text-2xs text-ink-500">Blocks the profile and surfaces it as suspended across the platform.</p>
                <div className="mt-2 flex gap-2">
                  <Input placeholder="Reason (optional)" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
                  <Button variant="danger" icon="x-circle" disabled={busy}
                    onClick={() => void run(() => adminSuspendAccount('profile', selected!.user_id, suspendReason), 'Account suspended')}>
                    Suspend
                  </Button>
                </div>
              </div>
            )}

            {/* Verify */}
            <div className="rounded-xl border border-ink-100 p-3.5">
              <p className="text-xs font-bold">Mark identity verified</p>
              <p className="mt-0.5 text-2xs text-ink-500">Escalate to a verification tier once documents are confirmed.</p>
              <div className="mt-2 flex gap-2">
                <Select value={verifyTier} onChange={e => setVerifyTier(e.target.value as 'identity' | 'entity' | 'gold')}
                  options={[
                    { value: 'identity', label: 'Identity verified (+20)' },
                    { value: 'gold', label: 'Gold (identity + liveness)' },
                    { value: 'entity', label: 'Entity' },
                  ]} />
                <Button variant="primary" icon="shield" disabled={busy}
                  onClick={() => void run(() => adminVerifyProfile(selected!.user_id, verifyTier), 'Account verified')}>
                  Verify
                </Button>
              </div>
            </div>

            {/* Message */}
            {!messageMode ? (
              <Button variant="outline" fullWidth icon="mail" onClick={() => setMessageMode(true)}>Message this user</Button>
            ) : (
              <div className="rounded-xl border border-ink-100 p-3.5">
                <p className="text-xs font-bold">Send a platform message</p>
                <div className="mt-2 space-y-2">
                  <Input placeholder="Subject" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} />
                  <Textarea placeholder="Message…" value={msgBody} onChange={e => setMsgBody(e.target.value)} maxChars={2000} />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setMessageMode(false)}>Cancel</Button>
                  <Button size="sm" icon="mail" disabled={busy || !msgTitle.trim()}
                    onClick={() => void run(() => adminSendMessage(selected!.user_id, msgTitle.trim(), msgBody.trim()), 'Message sent')}>
                    Send message
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
