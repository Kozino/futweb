import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Stat, Tabs} from '@/components/ui'
import { useOffline } from '@/context/OfflineContext'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { useMemo, useState } from 'react'

export default function ClubReports() {
  const [tab, setTab] = useState<'all' | 'offline'>('all')
  const { pending, syncNow, syncing, online } = useOffline()
  const players = useMemo(() => DEMO_PLAYERS.slice(0, 6).map(enrichPlayer), [])

  const reports = [
    { id: '1', player: players[0], who: 'Scout M. Danjuma', when: '3 days ago', rec: 'trial' as const, stars: 4, offline: false,
      text: 'Reads the game well beyond his years. Left foot is a genuine weapon in the final third.' },
    { id: '2', player: players[1], who: 'Coach A. Bello', when: '1 week ago', rec: 'monitor' as const, stars: 3, offline: true,
      text: 'Captured at the Kano state tournament with no signal. Synced on return to network.' },
    { id: '3', player: players[2], who: 'Analyst K. Obi', when: '2 weeks ago', rec: 'sign' as const, stars: 5, offline: false,
      text: 'Dominant in the air, organises the line, comfortable on the ball. Ready for the step up.' },
  ]

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="doc" title="Scout reports"
        subtitle="Every assessment your staff file, including those captured offline."
        actions={
          pending.filter(p => !p.synced).length > 0 && (
            <Button variant="outline" icon="refresh" loading={syncing} onClick={syncNow}>
              Sync {pending.filter(p => !p.synced).length}
            </Button>
          )
        } />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Reports filed" value={reports.length} icon="doc" sub="Last 30 days" />
        <Stat label="Captured offline" value={pending.filter(p => !p.synced).length} icon="offline" tone="gold"
          sub={online ? 'Awaiting sync' : 'Will sync when online'} />
        <Stat label="Avg recommendation" value="3.8" icon="star" tone="trust" sub="Out of 5" />
      </div>

      <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[
        { value: 'all', label: 'All reports', count: reports.length },
        { value: 'offline', label: 'Offline captures', count: pending.filter(p => !p.synced).length },
      ]} />

      <div className="mt-4 space-y-3">
        {reports.filter(r => tab === 'all' || r.offline).map(r => (
          <Card key={r.id} hover className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-2xs font-bold text-white">
                  {r.player.position_primary}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.player.first_name} {r.player.last_name}</p>
                  <p className="text-2xs text-ink-500">{r.who} · {r.when} · {r.player.age} yrs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.offline && <Badge tone="gold" icon="offline" size="sm">Offline capture</Badge>}
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Icon key={s} name="star-filled" size={12} filled className={s <= r.stars ? 'text-gold-400' : 'text-ink-200'} />
                  ))}
                </span>
                <Badge tone={r.rec === 'sign' ? 'trust' : r.rec === 'trial' ? 'blue' : r.rec === 'monitor' ? 'gold' : 'red'} size="sm">
                  {r.rec}
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-700">{r.text}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
