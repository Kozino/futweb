import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Skeleton, Stat, Tabs } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { useOffline } from '@/context/OfflineContext'
import { hasSupabase, supabase } from '@/lib/supabase'
import { relativeTime } from '@/lib/utils'

interface ReportRow {
  id: string
  player_name: string
  position: string | null
  age: number | null
  author_name: string
  rating: number
  text: string
  recommendation: 'sign' | 'trial' | 'monitor' | 'pass'
  offline: boolean
  created_at: string
}

export default function ClubReports() {
  const { club } = useClub()
  const { pending, syncNow, syncing, online } = useOffline()
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'offline'>('all')

  const clubId = club?.id

  const unsynced = useMemo(() => pending.filter(p => !p.synced), [pending])
  const offlineReports = useMemo(() => unsynced.filter(p => p.kind === 'report'), [unsynced])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const client = supabase!
        const { data: players } = await client.from('players').select('id, first_name, last_name, dob, position_primary').eq('managed_by_club_id', clubId)
        const playerIds = (players ?? []).map(p => p.id)
        if (!playerIds.length) { if (!cancelled) setReports([]); return }

        const { data } = await client
          .from('scout_reports')
          .select('id, player_id, author_id, rating, text, recommendation, created_at')
          .in('player_id', playerIds)
          .order('created_at', { ascending: false })
        const rows = data ?? []

        const pMap = new Map((players ?? []).map(p => [p.id, p]))
        const authorIds = [...new Set(rows.map(r => r.author_id).filter(Boolean))] as string[]
        const aMap = new Map<string, string>()
        if (authorIds.length) {
          const { data: authors } = await client.from('profiles').select('id, full_name').in('id', authorIds)
          ;(authors ?? []).forEach((a: { id: string; full_name: string }) => aMap.set(a.id, a.full_name))
        }

        const list: ReportRow[] = rows.map(r => {
          const pl = pMap.get(r.player_id)
          return {
            id: r.id,
            player_name: pl ? `${pl.first_name} ${pl.last_name}` : 'Player',
            position: pl?.position_primary ?? null,
            age: pl ? Math.floor((Date.now() - +new Date(pl.dob)) / (365.25 * 864e5)) : null,
            author_name: aMap.get(r.author_id) ?? 'Staff',
            rating: r.rating,
            text: r.text,
            recommendation: r.recommendation as ReportRow['recommendation'],
            offline: false,
            created_at: r.created_at,
          }
        })
        if (!cancelled) setReports(list)
      } catch { if (!cancelled) setReports([]) } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clubId])

  const avgRec = useMemo(() => reports.length
    ? (reports.reduce((s, r) => s + r.rating, 0) / reports.length).toFixed(1)
    : '—', [reports])

  const offlineAsReports: ReportRow[] = useMemo(() => offlineReports.map(q => ({
    id: q.localId,
    player_name: (q.payload.player_id as string)?.slice(0, 8) ?? 'Player',
    position: null,
    age: null,
    author_name: 'You (offline)',
    rating: Number(q.payload.stars) || 3,
    text: String(q.payload.note || q.payload.message || 'Offline scout report'),
    recommendation: (q.payload.recommendation as ReportRow['recommendation']) ?? 'trial',
    offline: true,
    created_at: q.createdAt,
  })), [offlineReports])

  const shown = tab === 'offline' ? offlineAsReports : [...reports, ...offlineAsReports]

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="doc" title="Scout reports"
        subtitle="Every assessment your staff file, including those captured offline."
        actions={
          unsynced.length > 0 && (
            <Button variant="outline" icon="refresh" loading={syncing} onClick={syncNow}>
              Sync {unsynced.length}
            </Button>
          )
        } />

      {!hasSupabase || !clubId ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to view scout reports.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Reports filed" value={reports.length} icon="doc" sub="On this club" />
            <Stat label="Captured offline" value={offlineReports.length} icon="offline" tone="gold"
              sub={online ? 'Awaiting sync' : 'Will sync when online'} />
            <Stat label="Avg rating" value={avgRec} icon="star" tone="trust" sub="Out of 5" />
          </div>

          <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[
            { value: 'all', label: 'All reports', count: shown.length },
            { value: 'offline', label: 'Offline captures', count: offlineReports.length },
          ]} />

          <div className="mt-4 space-y-3">
            {shown.length === 0 ? (
              <Card><EmptyState icon="doc" title="No reports yet"
                description="File a scout report from a player profile and it will appear here." /></Card>
            ) : shown.map(r => (
              <Card key={r.id} hover className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-2xs font-bold text-white">
                      {r.position ?? '•'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{r.player_name}</p>
                      <p className="text-2xs text-ink-500">{r.author_name} · {relativeTime(r.created_at)}{r.age != null ? ` · ${r.age} yrs` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.offline && <Badge tone="gold" icon="offline" size="sm">Offline capture</Badge>}
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Icon key={s} name="star-filled" size={12} filled className={s <= r.rating ? 'text-gold-400' : 'text-ink-200'} />
                      ))}
                    </span>
                    <Badge tone={r.recommendation === 'sign' ? 'trust' : r.recommendation === 'trial' ? 'blue' : r.recommendation === 'monitor' ? 'gold' : 'red'} size="sm">
                      {r.recommendation}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-700">{r.text}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
