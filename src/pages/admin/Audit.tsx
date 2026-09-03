import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Input, Select, toast } from '@/components/ui'
import { DEMO_AUDIT } from '@/data/mock'
import { relativeTime } from '@/lib/utils'

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
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const rows = useMemo(() => DEMO_AUDIT.filter(e =>
    (!q || e.action.includes(q.toLowerCase()) || e.actor_role.includes(q.toLowerCase())) &&
    (!role || e.actor_role === role)), [q, role])

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
              {['Action', 'Actor', 'Role', 'Entity', 'IP', 'When', ''].map(h => (
                <th key={h} className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 font-mono">
            {rows.map(e => (
              <tr key={e.id} className="hover:bg-ink-50">
                <td className="px-4 py-2.5">
                  <Badge tone={ACTION_TONE[e.action] ?? 'neutral'} size="sm">{e.action}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs">{e.actor_id}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.actor_role}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.entity_type}:{e.entity_id.slice(0, 8)}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">{e.ip}</td>
                <td className="px-4 py-2.5 text-xs text-ink-400">{relativeTime(e.created_at)}</td>
                <td className="px-4 py-2.5">
                  <button className="rounded p-1 text-ink-300 hover:bg-ink-100 hover:text-ink-700">
                    <Icon name="external" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['Append-only by design', 'A database trigger rejects UPDATE and DELETE on this table. Only INSERT succeeds.'],
          ['Retention', 'Events are retained for seven years, then archived to cold storage.'],
          ['Access', 'Only admin roles can read this log, and every read is itself logged.'],
        ].map(([t, d]) => (
          <Card key={t} className="p-4">
            <p className="text-xs font-bold">{t}</p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-600">{d}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
