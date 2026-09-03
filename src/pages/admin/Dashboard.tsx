import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Icon, ProgressBar, Skeleton, Stat } from '@/components/ui'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatNGN, relativeTime } from '@/lib/utils'

interface AuditRow { id: number; action: string; actor_role: string; created_at: string }
interface ClubRow { id: string; name: string; short_name: string; state_region: string | null; entity_verified: boolean }

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [clubCount, setClubCount] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [pendingClubs, setPendingClubs] = useState<ClubRow[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [openDisputes, setOpenDisputes] = useState(0)
  const [mrr, setMrr] = useState(0)
  const [activeSubs, setActiveSubs] = useState(0)
  const [audit, setAudit] = useState<AuditRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [
        clubsCountRes, playersCountRes, pendingClubsRes,
        disputesRes, subsRes, auditRes,
      ] = await Promise.all([
        supabase.from('clubs').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('clubs').select('id, name, short_name, state_region, entity_verified')
          .eq('entity_verified', false).order('created_at', { ascending: false }).limit(4),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('subscriptions').select('plan_code, status'),
        supabase.from('audit_log').select('id, action, actor_role, created_at')
          .order('created_at', { ascending: false }).limit(5),
      ])
      if (cancelled) return

      setClubCount(clubsCountRes.count ?? 0)
      setPlayerCount(playersCountRes.count ?? 0)
      setPendingClubs(pendingClubsRes.data ?? [])
      setPendingCount(pendingClubsRes.data?.length ?? 0)
      setOpenDisputes(disputesRes.count ?? 0)
      setAudit(auditRes.data ?? [])

      const subs = subsRes.data ?? []
      const active = subs.filter(s => s.status === 'active' || s.status === 'trialing')
      setActiveSubs(active.length)
      if (active.length) {
        const codes = [...new Set(active.map(s => s.plan_code))]
        const { data: plans } = await supabase.from('plans').select('code, price_ngn').in('code', codes)
        const priceByCode = Object.fromEntries((plans ?? []).map(p => [p.code, p.price_ngn]))
        setMrr(active.reduce((sum, s) => sum + (priceByCode[s.plan_code] ?? 0), 0))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Admin console" title="Platform overview"
        subtitle="Everything happening across FutWeb, in real time."
        actions={
          <>
            <Link to="/admin/verification"><Button variant="outline" icon="shield">
              Verification queue
              {pendingCount > 0 && <Badge tone="red" size="sm" className="ml-1.5">{pendingCount}</Badge>}
            </Button></Link>
            <Link to="/admin/audit"><Button icon="doc">Audit log</Button></Link>
          </>
        } />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={formatNGN(mrr, { compact: true })} icon="card" tone="trust" sub={`${activeSubs} paid subscriptions`} />
        <Stat label="Registered clubs" value={clubCount} icon="building" sub={`${pendingCount} awaiting review`} />
        <Stat label="Registered players" value={playerCount} icon="users" />
        <Stat label="Open disputes" value={openDisputes} icon="alert" tone="red" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Verification queue" action={<Badge tone="red" size="sm">{pendingCount} pending</Badge>} />
          <div className="divide-y divide-ink-100">
            {pendingClubs.length === 0 && <p className="px-5 py-6 text-xs text-ink-400">No clubs awaiting review.</p>}
            {pendingClubs.map(c => (
              <Link key={c.id} to="/admin/verification" className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                  {c.short_name}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{c.name}</p>
                  <p className="text-2xs text-ink-500">{c.state_region ?? '—'}</p>
                </div>
                <Badge tone="gold" size="sm">pending</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent audit events" />
          <div className="divide-y divide-ink-100">
            {audit.length === 0 && <p className="px-5 py-6 text-xs text-ink-400">No events yet.</p>}
            {audit.map(e => (
              <div key={e.id} className="flex items-center gap-2.5 px-5 py-2.5">
                <Icon name="doc" size={13} className="shrink-0 text-ink-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-2xs font-semibold text-ink-800">{e.action}</p>
                  <p className="truncate text-2xs text-ink-400">{e.actor_role} · {relativeTime(e.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
