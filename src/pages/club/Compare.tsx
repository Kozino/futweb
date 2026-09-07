import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Input, Skeleton, toast } from '@/components/ui'
import { UpgradeCard } from '@/components/plan/FeatureGate'
import { AttributeRadar } from '@/components/player/Radar'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { hasFeature } from '@/lib/entitlements'
import { hasSupabase } from '@/lib/supabase'
import { getClubSquad, getDiscoverablePlayers, type EnrichedPlayer } from '@/lib/supabase/workspace'
import { per90, ATTRIBUTE_GROUPS } from '@/lib/ratings'
import { cn } from '@/lib/utils'
import type { PlayerAttributes } from '@/types'

const MAX = 4

type GroupKey = keyof typeof ATTRIBUTE_GROUPS

/** Average attribute value for one group (only the attributes a position scores). */
function groupAverage(attrs: PlayerAttributes, group: string): number | null {
  const keys = ATTRIBUTE_GROUPS[group as GroupKey] ?? []
  const vals = keys.map(k => attrs[k as keyof PlayerAttributes])
  const numbers = vals.filter((v): v is number => typeof v === 'number')
  if (!numbers.length) return null
  return Math.round((numbers.reduce((s, n) => s + n, 0) / numbers.length) * 10) / 10
}

export default function Compare() {
  const { club } = useClub()
  const { user } = useAuth()

  const [pool, setPool] = useState<EnrichedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [q, setQ] = useState('')

  const entitled = hasFeature(user, 'comparison')
  const clubId = club?.id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const [squad, discovery] = await Promise.all([
          getClubSquad(clubId).catch(() => [] as EnrichedPlayer[]),
          getDiscoverablePlayers().catch(() => [] as EnrichedPlayer[]),
        ])
        const seen = new Set<string>()
        const merged: EnrichedPlayer[] = []
        for (const p of [...squad, ...discovery]) {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p) }
        }
        if (!cancelled) setPool(merged)
      } catch {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load players', description: 'Try again shortly.' })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clubId])

  const byId = useMemo(() => {
    const m = new Map<string, EnrichedPlayer>()
    pool.forEach(p => m.set(p.id, p))
    return m
  }, [pool])

  const selected = useMemo(
    () => selectedIds.map(id => byId.get(id)).filter(Boolean) as EnrichedPlayer[],
    [selectedIds, byId],
  )

  const candidates = useMemo(() => {
    const inSelected = new Set(selectedIds)
    const term = q.trim().toLowerCase()
    return pool.filter(p => {
      if (inSelected.has(p.id)) return false
      if (!term) return true
      return `${p.first_name} ${p.last_name}`.toLowerCase().includes(term)
        || (p.clubName ?? '').toLowerCase().includes(term)
        || (p.position_primary ?? '').toLowerCase().includes(term)
    }).slice(0, 20)
  }, [pool, q, selectedIds])

  function toggle(p: EnrichedPlayer) {
    setSelectedIds(prev => {
      if (prev.includes(p.id)) return prev.filter(id => id !== p.id)
      if (prev.length >= MAX) {
        toast({ tone: 'warning', title: `${MAX} player limit`, description: `Compare at most ${MAX} players at once. Remove one to add another.` })
        return prev
      }
      return [...prev, p.id]
    })
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="chart"
        title="Compare players"
        subtitle="Put up to four players side by side across their score, attributes and per-90 output."
        actions={selected.length > 1 ? (
          <Button variant="outline" icon="x" onClick={() => setSelectedIds([])}>Clear</Button>
        ) : undefined}
      />

      {!entitled ? (
        <div className="mt-5">
          <UpgradeCard feature="comparison"
            title="Side-by-side player comparison"
            description="Head-to-head attribute and per-90 comparison for up to 4 players is included with Pro Club." />
        </div>
      ) : (
        <>
          {/* Selection */}
          <Card className="mb-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-5">
              <div>
                <h3 className="text-sm font-bold">Select players</h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  Chosen {selected.length}/{MAX} · from your squad and the players you can discover
                </p>
              </div>
              <Input className="max-w-xs" icon="search" placeholder="Search name, club or position…"
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="p-5">
              {selected.length < 2 ? (
                <div className="mb-4 rounded-xl border border-gold-200 bg-gold-50 p-4">
                  <p className="text-xs font-semibold text-ink-700">
                    Add at least 2 players to start comparing ({selected.length}/{MAX}).
                  </p>
                </div>
              ) : null}

              {candidates.length === 0 ? (
                <EmptyState icon="user" title="No players to add"
                  description={q ? 'No players match your search.' : 'Add players to your squad or make them discoverable to compare.'} />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {candidates.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => toggle(p)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-left transition-colors hover:border-ink-200 hover:bg-ink-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-800">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="truncate text-2xs text-ink-500">
                          {p.position_primary} · {p.age} yrs · {p.score.ratingTier} · score {p.score.current}
                        </p>
                      </div>
                      <Icon name="plus" size={15} className="shrink-0 text-ink-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-400">Comparing</span>
              {selected.map(p => (
                <span key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-semibold text-ink-700">
                  {p.first_name} {p.last_name}
                  <button onClick={() => toggle(p)} className="text-ink-400 hover:text-red-500" aria-label="Remove">
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Comparison results */}
          {selected.length >= 2 ? (
            <CompareGrid players={selected} />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-sm font-bold text-ink-700">Compare {selected.length}/2 chosen</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
                Add a second player to unlock the side-by-side view of score, attribute groups and per-90 stats.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function CompareGrid({ players }: { players: EnrichedPlayer[] }) {
  const groupKeys = Object.keys(ATTRIBUTE_GROUPS) as GroupKey[]

  return (
    <div className="space-y-5">
      {/* Overview */}
      <Card className="overflow-x-auto p-5">
        <p className="fw-label mb-3">Head-to-head</p>
        <div className="min-w-[640px]">
          <div className="grid gap-2" style={{ gridTemplateColumns: `140px repeat(${players.length}, minmax(120px,1fr))` }}>
            {players.map(p => (
              <div key={p.id} className="rounded-xl bg-ink-50 p-3 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-ink-900 font-display text-sm text-white">
                  {`${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`}
                </div>
                <p className="mt-2 text-xs font-bold leading-tight text-ink-900">{p.first_name} {p.last_name}</p>
                <p className="text-2xs text-ink-500">{p.position_primary} · {p.age} · {p.nationality}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {p.score.viablePositions.slice(0, 3).map(pos => (
                    <Badge key={pos} tone="neutral" size="sm">{pos}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Radars */}
      <Card className="overflow-x-auto p-5">
        <p className="fw-label mb-3">Attribute radar</p>
        <div className="flex min-w-[400px] gap-2">
          {players.map(p => {
            const keys = [...ATTRIBUTE_GROUPS[p.position_primary === 'GK' ? 'Goalkeeping' : 'Technical']]
            return (
              <div key={p.id} className="flex-1 text-center">
                <AttributeRadar attributes={p.attributes} keys={keys} size={210} showLabels={false} />
                <p className="mt-1 text-2xs font-semibold text-ink-600">{p.first_name} {p.last_name}</p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Attribute group averages */}
      <Card className="overflow-hidden">
        <p className="p-5 pb-0 text-sm font-bold">Attribute groups</p>
        <div className="overflow-x-auto p-5 pt-3">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left text-2xs font-bold uppercase tracking-wider text-ink-400" />
                {players.map(p => (
                  <th key={p.id} className="px-2 py-2 text-center text-2xs font-bold uppercase tracking-wider text-ink-400">
                    {p.first_name} {p.last_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupKeys.map(g => {
                const best = Math.max(...players.map(p => groupAverage(p.attributes, g) ?? -1))
                return (
                  <tr key={g}>
                    <td className="px-2 py-2 text-xs font-semibold text-ink-600">{g}</td>
                    {players.map(p => {
                      const v = groupAverage(p.attributes, g)
                      const isBest = v !== null && v >= best && v > 0
                      return (
                        <td key={p.id}
                          className={cn('px-2 py-2 text-center text-xs font-bold',
                            isBest ? 'text-trust-600' : 'text-ink-700')}>
                          {v === null ? '—' : v}
                          {isBest && <span className="ml-1 text-[9px] font-black text-trust-500">▲</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Per-90 comparison */}
      <Card className="overflow-hidden">
        <p className="p-5 pb-0 text-sm font-bold">Per-90 output</p>
        <div className="overflow-x-auto p-5 pt-3">
          <Per90Table players={players} />
        </div>
      </Card>
    </div>
  )
}

function Per90Table({ players }: { players: EnrichedPlayer[] }) {
  const rows: { label: string; get: (p: EnrichedPlayer) => number | string | null }[] = [
    { label: 'Goals', get: p => per90(p.matchStats).goals },
    { label: 'Assists', get: p => per90(p.matchStats).assists },
    { label: 'Goals + assists', get: p => per90(p.matchStats).goalsPlusAssists },
    { label: 'Shots /90', get: p => per90(p.matchStats).shots },
    { label: 'Shot accuracy', get: p => per90(p.matchStats).shotAccuracy ? `${per90(p.matchStats).shotAccuracy}%` : '—' },
    { label: 'Pass accuracy', get: p => per90(p.matchStats).passAccuracy ? `${per90(p.matchStats).passAccuracy}%` : '—' },
    { label: 'Duel success', get: p => per90(p.matchStats).duelSuccess ? `${per90(p.matchStats).duelSuccess}%` : '—' },
    { label: 'Tackles /90', get: p => per90(p.matchStats).tackles },
    { label: 'Interceptions /90', get: p => per90(p.matchStats).interceptions },
    { label: 'Minutes / goal', get: p => per90(p.matchStats).minutesPerGoal ?? '—' },
  ]

  return (
    <table className="w-full min-w-[520px] border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th className="px-2 py-2 text-left text-2xs font-bold uppercase tracking-wider text-ink-400" />
          {players.map(p => (
            <th key={p.id} className="px-2 py-2 text-center text-2xs font-bold uppercase tracking-wider text-ink-400">
              {p.first_name} {p.last_name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label}>
            <td className="px-2 py-1.5 text-xs font-semibold text-ink-600">{r.label}</td>
            {players.map(p => {
              const v = r.get(p)
              const numeric = typeof v === 'number'
              return (
                <td key={p.id}
                  className={cn('px-2 py-1.5 text-center text-xs font-bold',
                    numeric && v !== 0 ? 'text-ink-900' : 'text-ink-400')}>
                  {v === 0 ? '—' : v}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
