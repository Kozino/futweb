import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Modal, Tabs, Textarea, toast } from '@/components/ui'
import { AttributeRadar } from '@/components/player/Radar'
import { AttributeBars, ConfidenceMeter, PositionFitBar, ScoreRing } from '@/components/player/Attributes'
import { MinorProtectionNotice } from '@/components/trust'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { ATTRIBUTE_GROUPS, per90 } from '@/lib/ratings'
import { useOffline } from '@/context/OfflineContext'
import { cn, formatDate } from '@/lib/utils'

export default function PlayerDetail() {
  const { id } = useParams()
  const player = useMemo(() => {
    const p = DEMO_PLAYERS.find(x => x.id === id) ?? DEMO_PLAYERS[0]
    return enrichPlayer(p)
  }, [id])

  const [tab, setTab] = useState<'attributes' | 'stats' | 'media' | 'reports'>('attributes')
  const [reportOpen, setReportOpen] = useState(false)
  const [recommendation, setRecommendation] = useState<'sign' | 'trial' | 'monitor' | 'pass'>('trial')
  const [stars, setStars] = useState(3)
  const [note, setNote] = useState('')
  const { online, enqueue } = useOffline()
  const p90 = per90(player.matchStats)

  async function submitReport() {
    await enqueue('report', {
      player_id: player.id, recommendation, stars, note,
      captured_at: new Date().toISOString()})
    setReportOpen(false); setNote('')
    toast({
      tone: online ? 'success' : 'info',
      title: online ? 'Report saved' : 'Report saved on this device',
      description: online ? 'Visible to your staff immediately.' : 'It will sync when you reconnect.'})
  }

  return (
    <div>
      <Link to="/club/discovery" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
        <Icon name="chevron-left" size={14} />Back to discovery
      </Link>

      <PageHeader breadcrumb="Player profile" title={`${player.first_name} ${player.last_name}`}
        subtitle={`${player.position_primary} · ${player.age} yrs · ${player.clubName} · ${player.state_of_origin}`}
        actions={
          <>
            <Button variant="outline" icon="list">Shortlist</Button>
            <Button variant="outline" icon="target">Invite to trial</Button>
            <Button icon="doc" onClick={() => setReportOpen(true)}>Scout report</Button>
          </>
        } />

      {player.is_minor && <div className="mb-4"><MinorProtectionNotice guardianName={player.guardian_name} /></div>}

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
                    <div key={l as string} className="rounded-xl bg-ink-50 p-3 text-center">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{l as string}</p>
                      <p className="tnum font-display text-2xl">{v as number}</p>
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
                    <div key={l as string} className="flex items-center justify-between border-b border-ink-100 py-2.5">
                      <span className="text-xs text-ink-600">{l as string}</span>
                      <span className="tnum text-sm font-bold">{v as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'media' && (
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {player.media.map(m => (
                  <div key={m.id} className="overflow-hidden rounded-xl border border-ink-100">
                    <div className="relative aspect-video bg-ink-900">
                      <div className="absolute inset-0 bg-pitch bg-pitch opacity-40" />
                      <div className="grid h-full w-full place-items-center text-white/40"><Icon name="video" size={22} /></div>
                      {m.verified && (
                        <span className="absolute left-2 top-2 rounded bg-trust-400 px-1.5 py-0.5 text-[9px] font-bold text-white">VERIFIED</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-xs font-bold">{m.title}</p>
                      <p className="text-2xs text-ink-500">{m.recorded_location} · {formatDate(m.recorded_at!)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'reports' && (
              <div className="divide-y divide-ink-100">
                {[
                  { who: 'Scout M. Danjuma', when: '3 days ago', rec: 'trial', stars: 4,
                    text: 'Strong in transition, reads the game well for his age. Left foot is a real weapon. Would like to see him against a more physical side before committing.' },
                  { who: 'Coach A. Bello', when: '2 weeks ago', rec: 'monitor', stars: 3,
                    text: 'Raw but the physical profile is excellent. Needs work on decision-making in the final third. Worth tracking through the season.' },
                ].map(r => (
                  <div key={r.who} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{r.who}</p>
                        <p className="text-2xs text-ink-400">{r.when}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Icon key={s} name="star-filled" size={13} filled
                              className={s <= r.stars ? 'text-gold-400' : 'text-ink-200'} />
                          ))}
                        </span>
                        <Badge tone={r.rec === 'sign' ? 'trust' : r.rec === 'trial' ? 'blue' : r.rec === 'monitor' ? 'gold' : 'red'} size="sm">
                          {r.rec}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">{r.text}</p>
                  </div>
                ))}
              </div>
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
              {player.ratingSnapshots.slice(-5).map(s => (
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
              {player.career.map(c => (
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
