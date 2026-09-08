import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button, Icon, Skeleton } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { usePlayer } from '@/context/PlayerContext'
import { FeatureGate, UpgradeCard } from '@/components/plan/FeatureGate'
import { attributesFromRow, ageFromDob } from '@/lib/playerCard'
import { per90, ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from '@/lib/ratings'

type GroupKey = keyof typeof ATTRIBUTE_GROUPS

function groupAverage(attrs: Record<string, number | undefined>, group: GroupKey): number | null {
  const keys = ATTRIBUTE_GROUPS[group]
  const nums = keys
    .map(k => attrs[k])
    .filter((v): v is number => typeof v === 'number')
  if (!nums.length) return null
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
}

function seasonStatsRows(stats: Array<Record<string, unknown>>) {
  const rows: Array<{
    season: string; competition: string | null
    apps: number; minutes: number; goals: number; assists: number
    shots: number; sot: number; yellows: number; reds: number
  }> = []
  const totals = { apps: 0, minutes: 0, goals: 0, assists: 0, shots: 0, sot: 0 }
  for (const s of stats) {
    const row = {
      season: String(s.season ?? '—'),
      competition: s.competition ? String(s.competition) : null,
      apps: Number(s.appearances) || 0,
      minutes: Number(s.minutes) || 0,
      goals: Number(s.goals) || 0,
      assists: Number(s.assists) || 0,
      shots: Number(s.shots) || 0,
      sot: Number(s.shots_on_target) || 0,
      yellows: Number(s.yellow_cards) || 0,
      reds: Number(s.red_cards) || 0,
    }
    rows.push(row)
    totals.apps += row.apps; totals.minutes += row.minutes
    totals.goals += row.goals; totals.assists += row.assists
    totals.shots += row.shots; totals.sot += row.sot
  }
  return { rows, totals }
}

export default function PlayerDossier() {
  const { user } = useAuth()
  const { player, attributes, career, stats, loading } = usePlayer()

  // Save as PDF via the browser's print dialog (offers "Save as PDF").
  const triggerPrint = () => window.print()

  const attrs = useMemo(
    () => attributesFromRow(attributes as never),
    [attributes],
  ) as Record<string, number | undefined>

  const avgByGroup = useMemo(() => {
    const out = {} as Record<string, number | null>
    ;(Object.keys(ATTRIBUTE_GROUPS) as GroupKey[]).forEach(g => { out[g] = groupAverage(attrs, g) })
    return out
  }, [attrs])

  const topAttrs = useMemo(() => {
    return Object.entries(attrs)
      .filter(([, v]) => typeof v === 'number')
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 10)
      .map(([k, v]) => ({ key: k, label: ATTRIBUTE_LABELS[k] ?? k, value: v as number }))
  }, [attrs])

  const match = useMemo(() => {
    if (!player) return null
    const { rows, totals } = seasonStatsRows(stats)
    const p90 = per90(totals as never)
    return { rows, totals, p90 }
  }, [player, stats])

  const careerList = useMemo(
    () => (career as Array<Record<string, unknown>>).slice(0, 20),
    [career],
  )

  const isVerified = Boolean(user && user.verificationTier !== 'unverified')

  if (loading && !player) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50/60 p-6">
        <Skeleton className="h-96 w-full max-w-3xl" />
      </div>
    )
  }

  return (
    <FeatureGate
      feature="pdf_dossier"
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ink-50/60 p-6">
          <div className="w-full max-w-xl">
            <UpgradeCard feature="pdf_dossier"
              title="PDF scouting dossier"
              description="Export your full profile — attributes, radar, career and match stats — as a clean PDF. Included with Elite." />
          </div>
        </div>
      }
    >
      {player ? (
        <div className="min-h-screen bg-ink-50/60">
          {/* Print toolbar (hidden when printing) */}
          <div className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Icon name="doc" size={16} className="text-red-500" />
              Scouting dossier
            </div>
            <div className="flex items-center gap-2">
              <Link to="/player/profile">
                <Button variant="ghost" size="sm" icon="arrow-right">Back</Button>
              </Link>
              <Button size="sm" icon="download" onClick={triggerPrint}>Save as PDF</Button>
            </div>
          </div>

          {/* Dossier body */}
          <div className="print-area mx-auto max-w-3xl px-4 py-8 sm:px-6">
            {/* Header */}
            <div className="dossier bg-ink-950 p-6 text-white preserve-ink">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar
                    name={`${player.first_name} ${player.last_name}`}
                    src={player.avatar_url ?? undefined}
                    size={84}
                    ring="ring-2 ring-white/15"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">FutWeb</p>
                    <p className="mt-2 truncate font-display text-3xl leading-tight tracking-wide">
                      {(player.first_name + ' ' + player.last_name).toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      {player.position_primary} · {ageFromDob(player.dob)} years · {player.nationality}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-2xs text-white/50">Score</p>
                    <p className="font-display text-xl">{player.futweb_score ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-2xs text-white/50">Potential</p>
                    <p className="font-display text-xl text-gold-300">{player.potential ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <p className="text-2xs text-white/50">Confidence</p>
                    <p className="font-display text-xl text-emerald-300">{player.confidence ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="dossier space-y-5 bg-white p-6 pt-0 preserve-ink">
              {/* Identity facts */}
              <section className="grid grid-cols-2 gap-x-6 gap-y-3 pt-6 text-sm sm:grid-cols-3">
                {[
                  ['Date of birth', player.dob ? new Date(player.dob).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                  ['Position', player.position_primary],
                  ['Secondary', player.position_secondary?.join(', ') || '—'],
                  ['Foot', player.foot === 'both' ? 'Both' : `${player.foot} foot`],
                  ['Height', player.height_cm ? `${player.height_cm} cm` : '—'],
                  ['Weight', player.weight_kg ? `${player.weight_kg} kg` : '—'],
                  ['Nationality', player.nationality],
                  ['Availability', player.availability?.replace('_', ' ')],
                  ['Status', isVerified ? 'Verified' : 'Unverified'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                    <p className="mt-0.5 font-semibold text-ink-800">{value}</p>
                  </div>
                ))}
              </section>

              {player.bio ? (
                <section>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-400">Profile</h3>
                  <p className="text-sm leading-relaxed text-ink-700">{player.bio}</p>
                </section>
              ) : null}

              {/* Top attributes */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Key attributes</h3>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {topAttrs.map(a => (
                    <div key={a.key} className="flex items-center justify-between gap-3 border-b border-ink-100 pb-1.5">
                      <span className="text-xs font-medium text-ink-700">{a.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${a.value}%` }} />
                        </div>
                        <span className="w-6 text-right text-xs font-bold text-ink-900">{a.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Attribute group averages */}
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Attribute groups</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(Object.keys(ATTRIBUTE_GROUPS) as GroupKey[]).map(g => (
                    <div key={g} className="rounded-xl border border-ink-100 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{g}</p>
                      <p className="mt-1 font-display text-2xl text-ink-900">{avgByGroup[g] ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Career history */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Career history</h3>
                {careerList.length === 0 ? (
                  <p className="text-sm text-ink-400">No club history recorded yet.</p>
                ) : (
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        <th className="py-1.5">Club</th>
                        <th className="py-1.5">Season</th>
                        <th className="py-1.5 text-center">Apps</th>
                        <th className="py-1.5 text-center">Goals</th>
                        <th className="py-1.5 text-center">Assists</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careerList.map((c, i) => (
                        <tr key={i} className="border-t border-ink-100">
                          <td className="py-1.5 font-semibold text-ink-800">{String(c.club_name)}</td>
                          <td className="py-1.5 text-ink-600">{String(c.season)}</td>
                          <td className="py-1.5 text-center text-ink-700">{Number(c.appearances) || 0}</td>
                          <td className="py-1.5 text-center text-ink-700">{Number(c.goals) || 0}</td>
                          <td className="py-1.5 text-center text-ink-700">{Number(c.assists) || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Match statistics */}
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Match statistics</h3>
                {match && match.totals.minutes > 0 && (
                  <div className="mb-3 grid grid-cols-4 gap-3">
                    {[
                      ['Apps', match.totals.apps],
                      ['Goals', match.totals.goals],
                      ['G + A', match.totals.goals + match.totals.assists],
                      ['Goals /90', match.p90.goals],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="rounded-xl bg-ink-50 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{l}</p>
                        <p className="mt-0.5 font-display text-xl text-ink-900">{v}</p>
                      </div>
                    ))}
                  </div>
                )}

                {match && match.rows.length === 0 ? (
                  <p className="text-sm text-ink-400">No match statistics recorded yet.</p>
                ) : match ? (
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        <th className="py-1.5">Season</th>
                        <th className="py-1.5">Competition</th>
                        <th className="py-1.5 text-center">Apps</th>
                        <th className="py-1.5 text-center">Min</th>
                        <th className="py-1.5 text-center">Gls</th>
                        <th className="py-1.5 text-center">Ast</th>
                        <th className="py-1.5 text-center">Shot %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.rows.map((r, i) => (
                        <tr key={i} className="border-t border-ink-100">
                          <td className="py-1.5 font-semibold text-ink-800">{r.season}</td>
                          <td className="py-1.5 text-ink-600">{r.competition ?? '—'}</td>
                          <td className="py-1.5 text-center text-ink-700">{r.apps}</td>
                          <td className="py-1.5 text-center text-ink-700">{r.minutes}</td>
                          <td className="py-1.5 text-center text-ink-700">{r.goals}</td>
                          <td className="py-1.5 text-center text-ink-700">{r.assists}</td>
                          <td className="py-1.5 text-center text-ink-700">{r.shots ? Math.round((r.sot / r.shots) * 100) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </section>

              <p className="pt-2 text-[9px] text-ink-300">
                Generated {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · FutWeb.
                Availability: {player.availability?.replace('_', ' ')} · Contact the player via FutWeb to arrange a trial.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-screen place-items-center bg-ink-50/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card">
            <Icon name="user" size={28} className="mx-auto text-ink-300" />
            <p className="mt-3 text-sm font-bold text-ink-800">No player profile yet</p>
            <p className="mt-1 text-xs text-ink-500">Complete your player onboarding to generate a dossier.</p>
            <Link to="/player/profile"><Button className="mt-4" size="sm" icon="arrow-right">Open My CV</Button></Link>
          </div>
        </div>
      )}
    </FeatureGate>
  )
}
