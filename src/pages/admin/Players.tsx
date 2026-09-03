import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Input, Select, Skeleton, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { cn, ageFrom } from '@/lib/utils'

interface PlayerRow {
  id: string; first_name: string; last_name: string; dob: string
  state_of_origin: string | null; position_primary: string
  managed_by_club_id: string | null; futweb_score: number | null
  confidence: number | null; visibility: string; is_minor: boolean
}

export default function AdminPlayers() {
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [clubNames, setClubNames] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: false })
      if (error) { toast({ tone: 'error', title: 'Could not load players', description: error.message }); setLoading(false); return }
      const rows = data ?? []
      const clubIds = [...new Set(rows.map(p => p.managed_by_club_id).filter(Boolean))] as string[]
      let names: Record<string, string> = {}
      if (clubIds.length) {
        const { data: clubs } = await supabase.from('clubs').select('id, name').in('id', clubIds)
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
