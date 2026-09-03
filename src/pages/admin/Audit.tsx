import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Input, Select, Skeleton, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { relativeTime } from '@/lib/utils'

interface AuditRow {
  id: number; actor_id: string | null; actor_role: string; action: string
  entity_type: string | null; entity_id: string | null; ip: string | null; created_at: string
}

const ACTION_TONE: Record<string, 'neutral' | 'trust' | 'red' | 'gold' | 'blue'> = {
  'club.verification.approved': 'trust',
  'subscription.created': 'blue',
  'dispute.opened': 'red',
  'scout_report.created': 'neutral',
  'payment.succeeded': 'trust',
  'user.login': 'neutral',
  'trial.posting.verified': 'trust',
}

export default function Audit() {
  const [loading, setLoading] = useState(true)
  const [rowsAll, setRowsAll] = useState<AuditRow[]>([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('audit_log').select('*')
        .order('created_at', { ascending: false }).limit(200)
      if (!cancelled) {
        if (error) toast({ tone: 'error', title: 'Could not load audit log', description: error.message })
        setRowsAll(data ?? [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(() => rowsAll.filter(e =>
    (!q || e.action.toLowerCase().includes(q.toLowerCase()) || e.actor_role.toLowerCase().includes(q.toLowerCase())) &&
    (!role || e.actor_role === role)
  ), [rowsAll, q, role])

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="doc" title="Audit log"
        subtitle="Append-only. Rows cannot be updated or deleted, even by a database administrator."
        actions={<Button variant="outline" icon="download"
          onClick={() => toast({ tone: 'success', title: 'Export started', description: 'You will receive a signed CSV when it is ready.' })}>
          Export
        </Button>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input className="max-w-xs" icon="search" placeholder="Search actions…" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="max-w-[200px]" value={role} onChange={e => setRole(e.target.value)} placeholder="All roles"
          options={[
            { value: 'admin', label: 'Admin' }, { value: 'club_admin', label: 'Club admin' },
            { value: 'player', label: 'Player' }, { value: 'scout', label: 'Scout' },
          ]} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              {['Action', 'Actor', 'Role', 'Entity', 'IP', 'When'].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 font-mono">
            {rows.map(e => (
              <tr key={e.id} className="hover:bg-ink-50">
                <td className="px-4 py-2.5"><Badge tone={ACTION_TONE[e.action] ?? 'neutral'} size="sm">{e.action}</Badge></td>
                <td className="px-4 py-2.5 text-xs">{e.actor_id ? e.actor_id.slice(0, 8) : 'system'}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.actor_role}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.entity_type ?? '—'}{e.entity_id ? `:${e.entity_id.slice(0, 8)}` : ''}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.ip ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-ink-400">{relativeTime(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
