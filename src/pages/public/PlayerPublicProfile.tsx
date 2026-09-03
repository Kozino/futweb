import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { Badge, Button, Card, Icon, ProgressBar } from '@/components/ui'
import { AttributeRadar } from '@/components/player/Radar'
import { AttributeBars, ConfidenceMeter, PositionFitBar, ScoreRing } from '@/components/player/Attributes'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { ATTRIBUTE_GROUPS, per90 } from '@/lib/ratings'
import { LEAGUES } from '@/lib/constants'

export default function PlayerPublicProfile() {
  const { slug } = useParams()
  const raw = useMemo(() => DEMO_PLAYERS.find(p => p.slug === slug) ?? DEMO_PLAYERS[0], [slug])
  const p = useMemo(() => enrichPlayer(raw), [raw])
  const group = p.score.group === 'GK' ? 'Goalkeeping' : p.score.group === 'DF' ? 'Defending' : p.score.group === 'MF' ? 'Mental' : 'Technical'
  const p90 = per90(p.matchStats)
  const photo = p.media.find(m => m.kind === 'photo' && m.url !== '#')?.url

  return (
    <div className="bg-ink-50/40">
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/hero-match.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-red-950/50" />
        <div className="fw-container relative py-8 sm:py-12">
          <Link to="/players" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-white"><Icon name="chevron-left" size={14} />Back to talent directory</Link>
          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4 sm:gap-5">
              {photo ? <img src={photo} alt={`${p.first_name} ${p.last_name}`} className="h-24 w-24 rounded-2xl object-cover ring-4 ring-white/10 sm:h-32 sm:w-32" /> :
                <div className="grid h-24 w-24 place-items-center rounded-2xl bg-white/10 text-2xl font-extrabold ring-4 ring-white/10 sm:h-32 sm:w-32 sm:text-3xl">{p.first_name[0]}{p.last_name[0]}</div>}
              <div>
                <div className="flex flex-wrap items-center gap-2"><Badge tone="trust" icon="check">Public CV</Badge>{p.availability === 'available' && <Badge tone="trust">Available</Badge>}</div>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{p.first_name} {p.last_name}</h1>
                <p className="mt-1 text-sm text-ink-300">{p.position_primary} · {p.age} yrs · {p.clubName} · {p.state_of_origin}, Nigeria</p>
              </div>
            </div>
            <div className="flex gap-2"><Link to="/register"><Button size="lg" iconRight="arrow-right">Register to shortlist</Button></Link><Link to="/clubs"><Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white">Browse clubs</Button></Link></div>
          </div>
        </div>
      </section>

      <main className="fw-container py-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <Card className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <div><p className="fw-label">FutWeb score</p><ScoreRing score={p.score.current} size={86} confidence={p.confidence.score} label={p.score.ratingTier} sublabel={`Potential ${p.score.potential}`} /></div>
                <div className="sm:col-span-2"><p className="fw-label">Player summary</p><p className="text-sm leading-relaxed text-ink-600">{p.bio}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Height', `${p.height_cm} cm`], ['Weight', `${p.weight_kg} kg`], ['Foot', p.foot], ['Nationality', `${p.nationality_flag} Nigeria`]].map(([l,v]) => <div key={l} className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">{l}</p><p className="mt-1 text-xs font-bold capitalize">{v}</p></div>)}</div></div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold">Attributes & position fit</h2><p className="text-xs text-ink-500">The same rating evidence available inside the player dashboard.</p></div><Badge tone="neutral">{group}</Badge></div>
              <div className="mt-5 grid items-center gap-5 lg:grid-cols-2"><AttributeRadar attributes={p.attributes} keys={[...ATTRIBUTE_GROUPS[group]]} size={270} /><div><p className="fw-label">Viable positions</p><div className="flex flex-wrap gap-1.5">{p.score.viablePositions.slice(0,10).map(pos => <Badge key={pos} size="sm" tone={pos === p.position_primary ? 'red' : 'neutral'}>{pos}</Badge>)}</div><div className="mt-5"><p className="fw-label">Position fit</p><PositionFitBar fit={p.score.positionFit as unknown as Record<string, number>} primary={p.position_primary} /></div><div className="mt-5"><ConfidenceMeter score={p.confidence.score} label={p.confidence.label} factors={p.confidence.factors} /></div></div></div>
              <div className="mt-5 border-t border-ink-100 pt-5"><AttributeBars attributes={p.attributes} highlightGroup={group} /></div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-extrabold">Career history</h2><p className="text-xs text-ink-500">Club, competition and contribution history.</p></div><Badge tone="blue" icon="shield">Verification shown</Badge></div>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-ink-100 text-2xs uppercase tracking-wider text-ink-400"><th className="pb-2">Club</th><th className="pb-2">Season</th><th className="pb-2">Competition</th><th className="pb-2">Apps</th><th className="pb-2">Goals</th><th className="pb-2">Assists</th><th className="pb-2">Status</th></tr></thead><tbody>{p.career.map(c => <tr key={c.id} className="border-b border-ink-50"><td className="py-3 font-bold">{c.club_name}</td><td className="py-3">{c.season}</td><td className="py-3">{LEAGUES.find(l => l.value === c.league)?.label ?? c.league}</td><td className="py-3 tnum">{c.appearances}</td><td className="py-3 tnum">{c.goals}</td><td className="py-3 tnum">{c.assists}</td><td className="py-3">{c.verified ? <Badge tone="trust" size="sm">Verified</Badge> : <Badge tone="neutral" size="sm">Unverified</Badge>}</td></tr>)}</tbody></table></div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div><h2 className="text-base font-extrabold">Performance contributions</h2><p className="text-xs text-ink-500">Season totals and per-90 context.</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Appearances', p.matchStats.appearances], ['Minutes', p.matchStats.minutes], ['Goals', p.matchStats.goals], ['Assists', p.matchStats.assists]].map(([l,v]) => <div key={l} className="rounded-xl bg-ink-50 p-3"><p className="text-2xs uppercase tracking-wider text-ink-400">{l}</p><p className="font-display text-2xl">{v}</p></div>)}</div>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2">{[['Goals / 90',p90.goals],['Assists / 90',p90.assists],['Pass accuracy',`${p90.passAccuracy}%`],['Duel success',`${p90.duelSuccess}%`],['Tackles / 90',p90.tackles],['Interceptions / 90',p90.interceptions]].map(([l,v]) => <div key={l} className="flex justify-between border-b border-ink-100 py-2.5"><span className="text-xs text-ink-600">{l}</span><span className="tnum text-xs font-bold">{v}</span></div>)}</div>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5"><h3 className="text-sm font-extrabold">Recruitment snapshot</h3><div className="mt-4 space-y-3">{[['Primary position',p.position_primary],['Secondary',p.position_secondary.join(', ') || '—'],['Availability',p.availability.replace('_',' ')],['Club',p.clubName],['Competition',LEAGUES.find(l => l.value === p.league)?.label ?? p.league]].map(([l,v]) => <div key={l} className="flex justify-between gap-3 border-b border-ink-100 pb-2.5"><span className="text-xs text-ink-500">{l}</span><span className="text-right text-xs font-bold capitalize">{v}</span></div>)}</div></Card>
            <Card className="p-5"><h3 className="text-sm font-extrabold">Data confidence</h3><p className="mt-1 text-xs text-ink-500">A number is more useful when clubs can see how much evidence supports it.</p><ProgressBar className="mt-4" value={p.confidence.score} tone={p.confidence.score >= 65 ? 'trust' : 'gold'} showLabel /><div className="mt-3 space-y-2">{p.confidence.factors.map(f => <div key={f.label} className="flex items-center justify-between text-xs"><span className="text-ink-600">{f.label}</span><span className="font-bold">{f.value}</span></div>)}</div></Card>
            <Card className="overflow-hidden"><div className="relative aspect-[16/9] bg-ink-900"><img src="/images/academy-training.jpg" alt="Football training" className="h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent" /><div className="absolute bottom-0 p-4 text-white"><p className="text-xs font-bold">Video-first CV</p><p className="mt-1 text-2xs text-white/70">Clubs can review highlights, full matches and media provenance.</p></div></div><div className="p-4"><Link to="/register"><Button fullWidth iconRight="arrow-right">Create an account to shortlist</Button></Link></div></Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
