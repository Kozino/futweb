import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Select, toast } from '@/components/ui'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { cn } from '@/lib/utils'

export default function AdminPlayers() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const rows = useMemo(() => DEMO_PLAYERS.map(enrichPlayer)
    .filter(p => (!q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()))
      && (!filter || (filter === 'minor' ? p.is_minor : filter === 'lowconf' ? p.confidence.score < 45 : true))), [q, filter])

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="user" title="Players"
        subtitle={`${rows.length} player profiles on the platform`}
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
              {['Player', 'Pos', 'Age', 'Club', 'Score', 'Confidence', 'Visibility', 'Status', ''].map(h => (
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
                      <span className="block text-2xs text-ink-400">{p.state_of_origin}</span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{p.position_primary}</Badge></td>
                <td className="tnum px-4 py-3">{p.age}</td>
                <td className="px-4 py-3 text-xs text-ink-600">{p.clubName}</td>
                <td className="tnum px-4 py-3 font-bold text-red-600">{p.score.current}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-bold',
                    p.confidence.score >= 65 ? 'text-trust-600' : p.confidence.score >= 40 ? 'text-gold-600' : 'text-red-500')}>
                    {p.confidence.score}%
                  </span>
                </td>
                <td className="px-4 py-3"><Badge tone="neutral" size="sm">{p.visibility.replace('_', ' ')}</Badge></td>
                <td className="px-4 py-3"><Badge tone="trust" size="sm">Active</Badge></td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" icon="more"
                    onClick={() => toast({ tone: 'info', title: 'Player actions', description: 'Suspend, verify or message this account.' })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
