import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Modal, Skeleton, Tabs, Textarea, toast } from '@/components/ui'
import { AttributeRadar } from '@/components/player/Radar'
import { AttributeBars, ConfidenceMeter, PositionFitBar, ScoreRing } from '@/components/player/Attributes'
import { MinorProtectionNotice } from '@/components/trust'
import { ATTRIBUTE_GROUPS, per90 } from '@/lib/ratings'
import { useOffline } from '@/context/OfflineContext'
import { useAuth } from '@/context/AuthContext'
import { hasSupabase, supabase } from '@/lib/supabase'
import { getPlayerDetail, type EnrichedPlayer } from '@/lib/supabase/workspace'
import { cn, formatDate } from '@/lib/utils'

export default function PlayerDetail() {
  const { id } = useParams()
  const { online, enqueue } = useOffline()
  const { user } = useAuth()

  const [player, setPlayer] = useState<EnrichedPlayer | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<'attributes' | 'stats' | 'media' | 'reports'>('attributes')
  const [reportOpen, setReportOpen] = useState(false)
  const [recommendation, setRecommendation] = useState<'sign' | 'trial' | 'monitor' | 'pass'>('trial')
  const [stars, setStars] = useState(3)
  const [note, setNote] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !id) { setLoading(false); return }
      try {
        const p = await getPlayerDetail(id)
        if (!cancelled) setPlayer(p)
      } catch { if (!cancelled) toast({ tone: 'error', title: 'Could not load player' }) }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  async function submitReport() {
    if (!player) return
    if (!note.trim()) {
      toast({ tone: 'error', title: 'Add some notes', description: 'Write what you saw before submitting.' })
      return
    }
    try {
      if (online && hasSupabase && supabase && user) {
        const { error } = await supabase.from('scout_reports').insert({
          player_id: player.id,
          author_id: user.id,
          rating: stars,
          recommendation,
          text: note.trim(),
        })
        if (error) throw error
        toast({ tone: 'success', title: 'Report saved', description: 'Visible to your staff immediately.' })
      } else {
        await enqueue('report', {
          player_id: player.id, recommendation, stars, note,
          captured_at: new Date().toISOString()})
        toast({
          tone: 'info',
          title: 'Report saved on this device',
          description: 'It will sync when you reconnect.'})
      }
    } catch (err) {
      toast({ tone: 'error', title: 'Could not save report', description: err instanceof Error ? err.message : 'Please try again.' })
    }
    setReportOpen(false); setNote('')
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  if (!player) {
    return (
      <div>
        <PageHeader breadcrumb="Player profile" title="Player not found" icon="user" />
        <Card className="mt-5 p-8"><EmptyState icon="user" title="Player not found"
          description="This player may not be visible to your club or may not exist."
          action={<Link to="/club/discovery"><Button icon="search">Back to discovery</Button></Link>} /></Card>
      </div>
    )
  }

  const p90 = per90(player.matchStats)

  return (
    <div>
      <Link to="/club/discovery" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
        <Icon name="chevron-left" size={14} />Back to discovery
      </Link>

      <PageHeader breadcrumb="Player profile" title={`${player.first_name} ${player.last_name}`}
        subtitle={`${player.position_primary} · ${player.age} yrs · ${player.clubName ?? 'Unattached'} · ${player.state_of_origin ?? '—'}`}
        actions={<Button icon="doc" onClick={() => setReportOpen(true)}>Scout report</Button>} />

      {player.is_minor && <div className="mb-4"><MinorProtectionNotice guardianName={player.guardian_name ?? undefined} /></div>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Card className="overflow-hidden">
            <Tabs value={tab} onChange={setTab} tabs={[
              { value: 'attributes', label: 'Attributes', icon: 'radar' },
              { value: 'stats', label: 'Statistics', icon: 'chart' },
              { value: 'media', label: 'Media', icon: 'video' },
              { value: 'reports', label: 'Reports', icon: 'doc' },
            ]} />

            {tab === 'attributes' && (
              <div className="grid gap-6 p-5 sm:grid-cols-2">
                <AttributeRadar attributes={player.attributes}
                  keys={[...ATTRIBUTE_GROUPS[player.score.group === 'GK' ? 'Goalkeeping' : player.score.group === 'DF' ? 'Defending' : player.score.group === 'MF' ? 'Mental' : 'Technical']]}
                  size={270} />
                <div>
                  <p className="mb-3 text-2xs font-bold uppercase tracking-widest text-ink-400">Position fit</p>
                  <PositionFitBar fit={player.score.positionFit as unknown as Record<string, number>} primary={player.position_primary} />
                  <div className="mt-4">
                    <p className="mb-1.5 text-2xs font-bold uppercase tracking-widest text-ink-400">Viable at</p>
                    <div className="flex flex-wrap gap-1.5">
                      {player.score.viablePositions.slice(0, 10).map(p => <Badge key={p} tone="neutral" size="sm">{p}</Badge>)}
                    </div>
                  </div>
                  <div className="mt-5">
                    <ConfidenceMeter score={player.confidence.score} label={player.confidence.label} factors={player.confidence.factors} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <AttributeBars attributes={player.attributes} highlightGroup={
                    player.score.group === 'GK' ? 'Goalkeeping' : player.score.group === 'DF' ? 'Defending' : player.score.group === 'MF' ? 'Mental' : 'Technical'
                  } />
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-4">
                  {[['Apps', player.matchStats.appearances], ['Goals', player.matchStats.goals],
                    ['Assists', player.matchStats.assists], ['Minutes', player.matchStats.minutes]].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-ink-50 p-3 text-center">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                      <p className="tnum font-display text-2xl">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-x-8 gap-y-0 sm:grid-cols-2">
                  {[['Goals per 90', p90.goals], ['Assists per 90', p90.assists], ['Shot accuracy', `${p90.shotAccuracy}%`],
                    ['Conversion', `${p90.conversion}%`], ['Pass accuracy', `${p90.passAccuracy}%`],
                    ['Duel success', `${p90.duelSuccess}%`], ['Tackles per 90', p90.tackles],
                    ['Interceptions per 90', p90.interceptions], ['Minutes per goal', p90.minutesPerGoal ?? '—'],
                    ['Yellow cards', player.matchStats.yellow_cards], ['Red cards', player.matchStats.red_cards],
                    ['Fouls committed', player.matchStats.fouls_committed]].map(([l, v]) => (
                    <div key={l} className="flex items-center justify-between border-b border-ink-100 py-2.5">
                      <span className="text-xs text-ink-600">{l}</span>
                      <span className="tnum text-sm font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'media' && (
              player.media.length === 0
                ? <div className="p-8"><EmptyState icon="video" title="No media yet"
                    description="This player has not uploaded any highlight clips or photos." /></div>
                : <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {player.media.map(m => (
                      <div key={m.id} className="overflow-hidden rounded-xl border border-ink-100">
                        <div className="relative aspect-video bg-ink-900">
                          {m.url ? (
                            m.kind === 'photo'
                              ? <img src={m.url} alt={m.title} className="h-full w-full object-cover" />
                              : <video src={m.url} controls preload="metadata" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/40"><Icon name="video" size={22} /></div>
                          )}
                          {m.verified && (
                            <span className="absolute left-2 top-2 rounded bg-trust-400 px-1.5 py-0.5 text-[9px] font-bold text-white">VERIFIED</span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate text-xs font-bold">{m.title}</p>
                          <p className="text-2xs text-ink-500">{m.recorded_location ?? 'Location not set'} · {formatDate(m.recorded_at ?? '')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {tab === 'reports' && (
              <div className="p-8"><EmptyState icon="doc" title="No scout reports yet"
                description="Your staff can file a report from the button above." /></div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">FutWeb Score</h3>
            <ScoreRing score={player.score.current} size={84} confidence={player.confidence.score}
              label={player.score.ratingTier} sublabel={`Potential ${player.score.potential}`} />
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
              {[['Height', `${player.height_cm} cm`], ['Weight', `${player.weight_kg} kg`],
                ['Foot', player.foot], ['Nationality', player.nationality]].map(([l, v]) => (
                <div key={l}>
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l}</p>
                  <p className="text-sm font-bold capitalize">{v}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">Development</h3>
            <div className="space-y-2.5">
              {player.ratingSnapshots.length === 0
                ? <p className="text-xs text-ink-500">No rating history yet.</p>
                : player.ratingSnapshots.slice(-5).map(s => (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-2xs text-ink-400">{formatDate(s.recorded_at, { month: 'short', year: '2-digit' })}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${s.futweb_score}%` }} />
                      </div>
                      <span className="tnum w-6 text-right text-xs font-bold">{s.futweb_score}</span>
                      <span className="w-16 truncate text-2xs text-ink-400">{s.rated_by}</span>
                    </div>
                  ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">Career history</h3>
            <div className="space-y-2.5">
              {player.career.length === 0
                ? <p className="text-xs text-ink-500">No career entries recorded.</p>
                : player.career.map(c => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{c.club_name}</p>
                        <p className="text-2xs text-ink-500">{c.season} · {c.appearances} apps · {c.goals} goals</p>
                      </div>
                      {c.verified ? <Badge tone="trust" size="sm">Verified</Badge> : <Badge tone="neutral" size="sm">Unverified</Badge>}
                    </div>
                  ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Scout report"
        description={online ? 'Saved to your club workspace.' : 'You are offline — this will be saved on your device and synced later.'}
        footer={
          <>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button icon={online ? 'check' : 'offline'} onClick={submitReport}>
              {online ? 'Submit report' : 'Save offline'}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <p className="fw-label">Recommendation</p>
            <div className="grid grid-cols-4 gap-2">
              {(['sign', 'trial', 'monitor', 'pass'] as const).map(r => (
                <button key={r} onClick={() => setRecommendation(r)}
                  className={cn('rounded-xl border-2 px-2 py-2.5 text-xs font-bold capitalize transition-all',
                    recommendation === r
                      ? r === 'sign' ? 'border-trust-400 bg-trust-50 text-trust-700'
                        : r === 'trial' ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : r === 'monitor' ? 'border-gold-400 bg-gold-50 text-gold-700'
                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-ink-200 text-ink-500 hover:border-ink-300')}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="fw-label">Fit for our needs</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setStars(s)} className="p-0.5">
                  <Icon name="star-filled" size={26} filled className={s <= stars ? 'text-gold-400' : 'text-ink-200'} />
                </button>
              ))}
            </div>
          </div>

          <Textarea label="Notes" value={note} onChange={e => setNote(e.target.value)} maxChars={1200}
            placeholder="What did you see? Strengths, concerns, what you would want to watch again." />

          {!online && (
            <div className="flex items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 p-3">
              <Icon name="offline" size={15} className="mt-0.5 shrink-0 text-gold-600" />
              <p className="text-2xs text-gold-800">
                No connection detected. This report will be stored on your device and uploaded
                automatically the next time you are online. Nothing will be lost.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
