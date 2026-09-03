import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Modal, Select, Skeleton, Textarea, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  fetchProfile,
  adminSuspendAccount,
  adminReinstateAccount,
  adminVerifyClub,
  adminSendMessage,
  type AdminProfileRow,
} from '@/lib/supabase/admin'

interface ClubRow {
  id: string; owner_id: string; name: string; short_name: string; league_code: string | null
  city: string | null; state_region: string | null; country: string
  entity_verified: boolean; entity_verified_at: string | null
  cac_number: string | null; nff_affiliation: string | null; website: string | null
  stadium: string | null; founded_year: number | null
  player_seats_used: number; staff_seats_used: number; created_at: string
  suspended_at: string | null; suspended_reason: string | null
}

export default function AdminClubs() {
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [q, setQ] = useState('')
  const [verified, setVerified] = useState('')

  // Detail modal state
  const [selected, setSelected] = useState<ClubRow | null>(null)
  const [owner, setOwner] = useState<AdminProfileRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [messageMode, setMessageMode] = useState(false)
  const [msgTitle, setMsgTitle] = useState('')
  const [msgBody, setMsgBody] = useState('')

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    let cancelled = false
    ;(async () => {
      const { data, error } = await client.from('clubs').select('*').order('created_at', { ascending: false })
      if (!cancelled) {
        if (error) toast({ tone: 'error', title: 'Could not load clubs', description: error.message })
        setClubs(data ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => clubs.filter(c =>
    (!q || c.name.toLowerCase().includes(q.toLowerCase())) &&
    (!verified || (verified === 'verified' ? c.entity_verified : !c.entity_verified))
  ), [clubs, q, verified])

  if (loading) return <Skeleton className="h-64 w-full" />

  async function openDetail(club: ClubRow) {
    setSelected(club)
    setOwner(null)
    setMessageMode(false)
    setMsgTitle('')
    setMsgBody('')
    setSuspendReason('')
    setDetailLoading(true)
    try {
      setOwner(await fetchProfile(club.owner_id))
    } catch {
      toast({ tone: 'error', title: 'Could not load owner', description: 'Fetching the club owner failed.' })
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

  const isSuspended = !!selected?.suspended_at

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="users" title="Clubs"
        subtitle={`${clubs.length} registered organisations`}
        actions={<Button variant="outline" icon="download">Export CSV</Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" icon="search" placeholder="Search clubs…" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="max-w-[200px]" value={verified} onChange={e => setVerified(e.target.value)}
          placeholder="All verification states"
          options={[{ value: 'verified', label: 'Verified' }, { value: 'unverified', label: 'Unverified' }]} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Club', 'League', 'Location', 'Verification', 'Players', 'Staff', 'Joined', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map(c => (
              <tr key={c.id} className="hover:bg-ink-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                      {c.short_name}
                    </span>
                    <span>
                      <span className="flex items-center gap-1.5 font-semibold">
                        {c.name}
                        {c.suspended_at && <Badge tone="red" size="sm">Suspended</Badge>}
                      </span>
                      <span className="block text-2xs text-ink-400">{c.cac_number ?? 'No CAC on file'}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{c.league_code?.toUpperCase() ?? '—'}</Badge></td>
                <td className="px-4 py-3 text-xs text-ink-600">{c.city ?? '—'}, {c.state_region ?? c.country ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={c.entity_verified ? 'trust' : 'gold'} size="sm" icon={c.entity_verified ? 'shield' : 'clock'}>
                    {c.entity_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                </td>
                <td className="tnum px-4 py-3">{c.player_seats_used}</td>
                <td className="tnum px-4 py-3">{c.staff_seats_used}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{formatDate(c.created_at, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" icon="more" onClick={() => void openDetail(c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} size="lg" title={`Club actions — ${selected?.name}`}
        description="View the organisation, then suspend, verify or message its account.">

        {detailLoading ? <Skeleton className="h-48 w-full" /> : (
          <div className="space-y-4">
            {isSuspended && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <strong>Suspended</strong> since {selected!.suspended_at ? new Date(selected!.suspended_at).toLocaleString() : ''}
                {selected?.suspended_reason ? <> — {selected.suspended_reason}</> : null}
              </div>
            )}

            <div className="grid gap-x-6 gap-y-2 rounded-xl border border-ink-100 bg-ink-50/50 p-4 text-xs sm:grid-cols-2">
              {[
                ['Club name', selected?.name],
                ['Short name', selected?.short_name],
                ['CAC number', selected?.cac_number],
                ['NFF / state FA', selected?.nff_affiliation],
                ['League', selected?.league_code?.toUpperCase()],
                ['Location', selected ? `${selected.city ?? ''}, ${selected.state_region ?? ''}, ${selected.country ?? ''}` : '—'],
                ['Founded', selected?.founded_year ? String(selected.founded_year) : '—'],
                ['Stadium', selected?.stadium],
                ['Website', selected?.website],
                ['Entity verified', selected ? (selected.entity_verified ? `Yes · ${selected.entity_verified_at ? new Date(selected.entity_verified_at).toLocaleDateString() : ''}` : 'No') : '—'],
                ['Players', selected ? String(selected.player_seats_used) : '—'],
                ['Staff seats', selected ? String(selected.staff_seats_used) : '—'],
                ['Owner', owner?.full_name ?? '—'],
                ['Owner email', owner?.email ?? '—'],
                ['Owner sub status', owner?.sub_status ?? '—'],
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
                onClick={() => void run(() => adminReinstateAccount('club', selected!.id), 'Club reinstated')}>
                Reinstate club
              </Button>
            ) : (
              <div className="rounded-xl border border-ink-100 p-3.5">
                <p className="text-xs font-bold">Suspend club</p>
                <p className="mt-0.5 text-2xs text-ink-500">Removes the club from discovery and blocks new postings.</p>
                <div className="mt-2 flex gap-2">
                  <Input placeholder="Reason (optional)" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
                  <Button variant="danger" icon="x-circle" disabled={busy}
                    onClick={() => void run(() => adminSuspendAccount('club', selected!.id, suspendReason), 'Club suspended')}>
                    Suspend
                  </Button>
                </div>
              </div>
            )}

            {/* Verify (entity) */}
            <div className="rounded-xl border border-ink-100 p-3.5">
              <p className="text-xs font-bold">Confirm entity verification</p>
              <p className="mt-0.5 text-2xs text-ink-500">
                Confirms CAC registration and NFF / state FA affiliation are genuine.
              </p>
              <Button className="mt-2" variant={selected?.entity_verified ? 'outline' : 'primary'} icon="shield" disabled={busy || !!selected?.entity_verified}
                onClick={() => void run(() => adminVerifyClub(selected!.id), 'Club verified as an entity')}>
                {selected?.entity_verified ? 'Already entity verified' : 'Verify club (entity)'}
              </Button>
            </div>

            {/* Message */}
            {!messageMode ? (
              <Button variant="outline" fullWidth icon="mail" onClick={() => setMessageMode(true)}>Message this club</Button>
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
                    onClick={() => void run(() => adminSendMessage(selected!.owner_id, msgTitle.trim(), msgBody.trim()), 'Message sent')}>
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
