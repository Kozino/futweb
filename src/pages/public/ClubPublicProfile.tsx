import { Link, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { Badge, Button, Card, Icon } from '@/components/ui'
import { DEMO_CLUBS, DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { LEAGUES } from '@/lib/constants'

export default function ClubPublicProfile() {
  const { slug } = useParams()
  const club = useMemo(() => DEMO_CLUBS.find(c => c.slug === slug) ?? DEMO_CLUBS[0], [slug])
  const players = useMemo(
    () => DEMO_PLAYERS
      .filter(p => p.clubName === club.name || (club.name === 'Enyimba International FC' && p.clubName === 'Enyimba FC'))
      .filter(p => p.visibility === 'public')
      .map(enrichPlayer),
    [club.name],
  )

  return (
    <div className="bg-ink-50/40">
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/pitch-aerial.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-red-950/40" />
        <div className="fw-container relative py-9 sm:py-12">
          <Link to="/clubs" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-white">
            <Icon name="chevron-left" size={14} />Back to clubs
          </Link>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-xl font-extrabold ring-4 ring-white/10">{club.short_name}</div>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="trust" icon="shield">Verified club</Badge>
                  <Badge tone="neutral">Trust {club.trust}</Badge>
                </div>
                <h1 className="mt-2 text-3xl font-extrabold">{club.name}</h1>
                <p className="mt-1 text-sm text-ink-300">{club.city}, {club.state} · {LEAGUES.find(l => l.value === club.league)?.label ?? club.league}</p>
              </div>
            </div>
            <Link to="/register"><Button size="lg" iconRight="arrow-right">Register to contact</Button></Link>
          </div>
        </div>
      </section>

      <main className="fw-container py-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-extrabold">Club profile</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Founded', club.founded_year ?? '—'],
                  ['Stadium', club.stadium ?? '—'],
                  ['Location', `${club.city ?? '—'}, ${club.state ?? club.country}`],
                  ['Competition', LEAGUES.find(l => l.value === club.league)?.label ?? club.league ?? '—'],
                  ['CAC number', club.cac_number ?? 'Verified record'],
                  ['NFF affiliation', club.nff_affiliation ?? 'Verified record'],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-ink-50 p-3">
                    <p className="text-2xs uppercase tracking-wider text-ink-400">{l}</p>
                    <p className="mt-1 text-xs font-bold">{v}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold">Public player roster</h2>
                  <p className="text-xs text-ink-500">Players currently visible in the open directory.</p>
                </div>
                <Badge tone="neutral">{players.length}</Badge>
              </div>
              <div className="mt-4 divide-y divide-ink-100">
                {players.length ? players.map(p => (
                  <Link key={p.id} to={`/players/${p.slug}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-ink-50">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink-900 text-xs font-bold text-white">{p.first_name[0]}{p.last_name[0]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{p.first_name} {p.last_name}</p>
                      <p className="text-2xs text-ink-500">{p.position_primary} · {p.age} yrs · Score {p.score.current}</p>
                    </div>
                    <Icon name="chevron-right" size={15} className="text-ink-300" />
                  </Link>
                )) : (
                  <p className="py-8 text-center text-xs text-ink-500">No public player profiles from this club yet.</p>
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-extrabold">Why this matters</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">Public club pages give players and overseas recruiters a quick way to confirm who they are dealing with before starting a conversation.</p>
              <div className="mt-4 space-y-2 text-xs text-ink-700">
                <div className="flex gap-2"><Icon name="shield" size={14} className="text-trust-500" />Entity verification on record</div>
                <div className="flex gap-2"><Icon name="users" size={14} className="text-red-500" />Public roster discovery</div>
                <div className="flex gap-2"><Icon name="target" size={14} className="text-red-500" />Verified trials can be reviewed after sign-in</div>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <img src="/images/boots-ball.jpg" alt="Football boots and ball" className="aspect-[4/3] w-full object-cover" />
              <div className="p-4">
                <p className="text-xs font-bold">Looking for talent?</p>
                <p className="mt-1 text-2xs text-ink-500">Use the public directory first. Register when you are ready to shortlist or contact.</p>
                <Link to="/players" className="mt-3 block"><Button fullWidth variant="outline" size="sm" iconRight="arrow-right">Find players</Button></Link>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
