import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon, type IconName } from '@/components/ui'
import { DEMO_PLAYERS, DEMO_CLUBS } from '@/data/mock'
import { enrichPlayer } from '@/data/mock'
import { VerificationBadge } from '@/components/trust'
import { computeTrustScore } from '@/lib/ratings'
import { per90 } from '@/lib/ratings'

const FEATURES: { icon: IconName; t: string; d: string }[] = [
  { icon: 'search', t: 'Discovery across the whole index', d: 'Filter by position, age, league, availability and attribute thresholds. See position-fit and confidence before you open a profile.' },
  { icon: 'offline', t: 'Offline scouting capture', d: 'Rate a player at a rural pitch with no signal. Everything is written to the device and synced when you reconnect.' },
  { icon: 'users', t: 'Squad management with roles', d: 'Coaches, scouts and analysts get their own logins with scoped permissions. Nothing is shared by accident.' },
  { icon: 'doc', t: 'Scout reports & shortlists', d: 'Structured reports with a recommendation — sign, trial, monitor or pass. Shortlists move players through your pipeline.' },
  { icon: 'shield', t: 'Get verified, get better players', d: 'Verified clubs surface first. Players can see you are real, so the good ones actually reply to you.' },
  { icon: 'chart', t: 'Per-90 analytics & comparison', d: 'Feed in match data and get per-90 output, conversion and duel success. Compare up to four players side by side.' },
]

export default function ForClubs() {
  const prospects = DEMO_PLAYERS.slice(0, 5).map(enrichPlayer)
  const club = DEMO_CLUBS[0]
  const trust = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: true,
    videoVerified: true, referencesVerified: true, paymentVerified: true, tenureDays: 400, disputesUpheld: 0,
  })

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-red-600/20 blur-[110px]" />
        <div className="fw-container relative py-14">
          <Badge tone="red">For clubs & academies</Badge>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            The best player in your state is<br />probably <span className="text-red-400">not in your database.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink-300">
            Nigerian clubs scout by word of mouth and WhatsApp referrals, because the global tools
            cost more than the entire recruitment budget. FutWeb gives you professional-grade
            recruitment software at a price a state-league academy can actually pay.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register?as=club"><Button size="xl" iconRight="arrow-right">Register your club</Button></Link>
            <Link to="/pricing"><Button size="xl" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">See club plans</Button></Link>
          </div>
        </div>
      </section>

      <section className="fw-container py-14">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <Card key={f.t} hover className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500">
                <Icon name={f.icon} size={19} />
              </span>
              <h3 className="mt-3.5 text-sm font-bold leading-snug">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Why verification helps you</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Players have been burned. They ignore approaches from accounts they cannot verify,
              which means unverified clubs lose the very players they want. Earning a Gold badge
              is the single highest-leverage thing a Nigerian club can do to improve reply rates.
            </p>
            <div className="mt-4 space-y-3">
              {[
                { t: 'Unverified', d: 'Most players will not respond.', tone: 'text-ink-500' },
                { t: 'Identity verified', d: 'Some responses. Serious enquiries only.', tone: 'text-blue-600' },
                { t: 'Entity verified', d: 'Strong responses. Players trust the paperwork.', tone: 'text-trust-600' },
                { t: 'Gold verified', d: 'Priority placement in discovery. Best reply rates.', tone: 'text-gold-600' },
              ].map(r => (
                <div key={r.t} className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0">
                  <div>
                    <p className={`text-xs font-bold ${r.tone}`}>{r.t}</p>
                    <p className="text-2xs text-ink-500">{r.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-ink-50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-600">Example — {club.name}</span>
                <VerificationBadge trust={trust} size="sm" showScore />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h3 className="text-sm font-bold">Discovery preview</h3>
              <Badge tone="neutral">5 matches</Badge>
            </div>
            <div className="divide-y divide-ink-100">
              {prospects.map(p => {
                const p90 = per90(p.matchStats)
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white">
                      {p.position_primary}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.first_name} {p.last_name}</p>
                      <p className="text-2xs text-ink-500">{p.age} yrs · {p.clubName} · {p.state_of_origin}</p>
                    </div>
                    <div className="hidden gap-4 text-right sm:flex">
                      <div><p className="tnum text-xs font-bold">{p90.goals}</p><p className="text-2xs text-ink-400">G/90</p></div>
                      <div><p className="tnum text-xs font-bold">{p90.assists}</p><p className="text-2xs text-ink-400">A/90</p></div>
                    </div>
                    <div className="w-10 text-right">
                      <p className="tnum font-display text-lg text-red-500">{p.score.current}</p>
                      <p className="text-2xs text-ink-400">{p.confidence.score}% conf</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
