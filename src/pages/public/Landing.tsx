import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Icon, Badge, type IconName } from '@/components/ui'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/context/AuthContext'
import { PLANS } from '@/lib/constants'
import { formatNGN } from '@/lib/utils'
import { computeTrustScore } from '@/lib/ratings'
import { VerificationBadge } from '@/components/trust'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'

/* ------------------------------------------------------------------ */
const HERO_STATS = [
  { value: '3.1M', label: 'Players in Nigerian academies with no verifiable record' },
  { value: '£4.3k–£8.6k', label: 'Average amount a family loses to one fake trial agent' },
  { value: '€250+', label: 'Cheapest annual entry to legacy European scouting tools' },
  { value: '0', label: 'Scouting platforms built offline-first for African pitches' },
]

const PROBLEMS: { icon: IconName; title: string; body: string; source: string }[] = [
  {
    icon: 'alert',
    title: 'Fake agents are an industry',
    body: 'Fake agents impersonate real ones, sell phantom trials and disappear. Families sell land to pay. Players end up stranded abroad with no club and no way home.',
    source: 'FIFPRO / Drogba, 2023',
  },
  {
    icon: 'card',
    title: 'Priced in euros for a naira market',
    body: 'Legacy platforms start around €250 a year and climb into five figures. For a state-league academy in Katsina, that is not a price. It is a wall.',
    source: 'Wyscout packaging, 2024',
  },
  {
    icon: 'offline',
    title: 'Built for fibre, used on 3G',
    body: 'Scouting software assumes a stable connection. The pitches where Nigerian talent actually plays have one or two bars, or none at all. Assessments get lost.',
    source: 'Field reality',
  },
  {
    icon: 'chart',
    title: 'Numbers without context',
    body: 'A raw "72 dribbling" tells a scout nothing. Not whether it is good for that position, not whether it is good for a 17-year-old, not whether anyone credible verified it.',
    source: 'Category-wide gap',
  },
]

const SOLUTIONS = [
  {
    icon: 'shield' as IconName, tag: 'Trust layer',
    title: 'Every club earns a machine-readable trust score',
    body: 'CAC registration, NFF or state FA affiliation, NIN/BVN identity, liveness check and confirmed references — each one a discrete, publicly visible check. Players see exactly who is real before they hand over a CV, let alone money. Trial postings that demand a fee from players are rejected by policy.',
    points: ['8 discrete verification checks', 'Zero-fee trial guarantee, enforced', 'Immutable audit trail on every action'],
  },
  {
    icon: 'offline' as IconName, tag: 'Offline-first',
    title: 'Scouting that survives a dead network',
    body: 'Every rating and report a scout enters is written to the device first, then flushed when a connection appears. Work done at a tournament in Makurdi is never lost to a dropped bar. A data-saver mode cuts payloads for metered connections.',
    points: ['IndexedDB write-behind queue', 'Automatic background sync', 'Data-saver mode for metered networks'],
  },
  {
    icon: 'globe' as IconName, tag: 'Africa-native',
    title: 'A data model that knows the NPFL exists',
    body: 'NPFL, NNL, NLO, NWFL, state FA leagues, academies and grassroots tournaments are first-class citizens — not an afterthought behind 150 European leagues. Video-first CVs, because a 40-second highlight clip travels further in this market than a spreadsheet of per-90s.',
    points: ['Nigerian leagues modelled natively', 'Video-first player CVs', 'WhatsApp-ready share cards'],
  },
  {
    icon: 'radar' as IconName, tag: 'Decision-grade ratings',
    title: 'Ratings that answer the three real questions',
    body: 'Good for this position? Good for his age? Can I trust the number? Every FutWeb Score is position-weighted, age-adjusted and confidence-discounted, so an uncorroborated self-rating can never masquerade as verified evidence.',
    points: ['Position-fit weighting across 4 groups', 'Age-curve projection to positional prime', 'Confidence regression toward the mean'],
  },
]

const STEPS = [
  { n: '01', title: 'Create your profile', body: 'Player or club — pick your path. Players build a CV with attributes, video and match data. Clubs register with CAC and NFF details.' },
  { n: '02', title: 'Get verified', body: 'Identity, entity and liveness checks raise your trust score. Verified clubs surface first to players; verified players rank higher in discovery.' },
  { n: '03', title: 'Choose a plan', body: 'Start on a 14-day trial. Pay in naira or dollars via Flutterwave — cards, bank transfer or USSD.' },
  { n: '04', title: 'Get seen, or find talent', body: 'Players share a CV card on WhatsApp. Clubs search, shortlist, capture scout reports offline and invite to verified trials.' },
]

const FAQS = [
  { q: 'Do players ever pay to attend a trial?', a: 'Never. It is a hard product rule, not a guideline: a trial posting on FutWeb may not charge players. Postings that attempt it are blocked and logged, and the club\'s trust score takes the hit.' },
  { q: 'How is the FutWeb Score different from other ratings?', a: 'Three adjustments the incumbents do not make. It is weighted for the position the player actually plays, adjusted for where they sit on the age-development curve, and discounted by how much independent evidence backs it.' },
  { q: 'What happens if I lose network while scouting?', a: 'Nothing is lost. Ratings and reports are written to your device and queued, then synced automatically when you reconnect. You will see a banner telling you exactly how many records are pending.' },
  { q: 'How do you protect under-18 players?', a: 'Minors require a registered guardian with verified consent. Every club message to a minor is copied to the guardian, and direct trial or transfer arrangements with minors are blocked, in line with FIFA Article 19 and the Nigeria Data Protection Act 2023.' },
  { q: 'Can I export my data?', a: 'Yes. Players can export their full record as a PDF dossier or a machine-readable file at any time, and request erasure under NDPA 2023.' },
]

/* ------------------------------------------------------------------ */
export default function Landing() {
  const { demoLogin } = useAuth()
  const navigate = useNavigate()
  const featured = PLANS.filter(p => p.price_ngn > 0 && p.featured).slice(0, 2)
  const spotlight = enrichPlayer(DEMO_PLAYERS[0])

  const trustDemo = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: true,
    videoVerified: true, referencesVerified: true, paymentVerified: true,
    tenureDays: 400, disputesUpheld: 0,
  })

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-45" style={{ backgroundImage: "url('/images/hero-match.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/45" />
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-red-600/25 blur-[110px]" />
        <div className="absolute -bottom-52 right-0 h-[420px] w-[420px] rounded-full bg-trust-500/12 blur-[110px]" />

        <div className="fw-container relative py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-200 backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-trust-400" />
                Built in Nigeria · NDPA 2023 compliant · FIFA Art.19 aligned
              </span>

              <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                African talent is not<br />hard to find.<br />
                <span className="text-red-400">It is hard to verify.</span>
              </h1>

              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-300 sm:text-lg">
                FutWeb turns footballers into verified, data-rich digital CVs — and gives clubs
                scouting software that finally works on a Nigerian network. Identity you can check,
                ratings you can trust, trials that never cost a player a naira.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button size="xl" iconRight="arrow-right">Create your profile</Button>
                </Link>
                <Link to="/pricing">
                  <Button size="xl" variant="outline" className="border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/10">
                    See pricing
                  </Button>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-400">
                {['No card required', '14-day trial', 'Pay in NGN or USD', 'Cancel anytime'].map(t => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Icon name="check" size={13} className="text-trust-400" />{t}
                  </span>
                ))}
              </div>
            </div>

            {/* Spotlight card */}
            <div className="animate-fade-up [animation-delay:120ms]">
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-widest text-ink-400">Live profile</span>
                  <VerificationBadge trust={trustDemo} size="sm" showScore />
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 font-display text-xl">
                    {spotlight.first_name[0]}{spotlight.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-2xl tracking-wide">{spotlight.first_name} {spotlight.last_name}</p>
                    <p className="text-xs text-ink-400">{spotlight.position_primary} · {spotlight.age} yrs · {spotlight.nationality} {spotlight.nationality_flag}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { l: 'Score', v: spotlight.score.current, c: 'text-red-400' },
                    { l: 'Potential', v: spotlight.score.potential, c: 'text-gold-300' },
                    { l: 'Confidence', v: `${spotlight.confidence.score}%`, c: 'text-ink-200' },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                      <p className="text-2xs font-bold uppercase tracking-wider text-ink-500">{s.l}</p>
                      <p className={`tnum mt-0.5 font-display text-2xl ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {Object.entries(spotlight.attributes)
                    .filter(([k]) => ['finishing', 'acceleration', 'dribbling', 'passing', 'composure'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2.5">
                        <span className="w-20 shrink-0 text-2xs font-medium capitalize text-ink-400">
                          {k.replace(/_/g, ' ')}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400"
                            style={{ width: `${v as number}%` }} />
                        </div>
                        <span className="tnum w-5 text-right text-2xs font-bold">{v as number}</span>
                      </div>
                    ))}
                </div>

                <div className="mt-5 rounded-xl border border-trust-400/25 bg-trust-400/10 p-3">
                  <p className="flex items-center gap-1.5 text-2xs font-bold text-trust-300">
                    <Icon name="shield" size={12} /> Verified trial invitation
                  </p>
                  <p className="mt-1 text-2xs text-trust-200/70">
                    Rivers United FC · Gold verified · Fee to player: ₦0
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stat band */}
          <div className="mt-16 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {HERO_STATS.map(s => (
              <div key={s.label}>
                <p className="font-display text-3xl text-red-400">{s.value}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PUBLIC DIRECTORY ================= */}
      <section className="border-b border-ink-100 bg-white py-12 sm:py-16">
        <div className="fw-container">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Badge tone="trust" icon="search">Open to everyone</Badge>
              <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                Let clubs discover players before they ever register.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-ink-600">
                Non-registered visitors can search public player CVs and verified club pages by name, club, position, competition or location. Registration only becomes necessary when a recruiter wants to shortlist or contact someone.
              </p>
              <form className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); const q = new FormData(e.currentTarget).get('q')?.toString().trim(); navigate(q ? `/players?q=${encodeURIComponent(q)}` : '/players') }}>
                <div className="relative flex-1">
                  <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input name="q" className="fw-input h-11 pl-9" placeholder="Search player name, club, position or state…" aria-label="Search public players" />
                </div>
                <Button type="submit" iconRight="arrow-right">Search</Button>
              </form>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/players" className="text-xs font-bold text-red-600 hover:underline">Browse all players →</Link>
                <Link to="/clubs" className="text-xs font-bold text-ink-600 hover:text-ink-900 hover:underline">Browse verified clubs →</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <img src="/images/academy-training.jpg" alt="Football academy training" className="h-44 w-full rounded-2xl object-cover" />
              <img src="/images/boots-ball.jpg" alt="Football boots and ball" className="mt-8 h-44 w-full rounded-2xl object-cover" />
              <div className="col-span-2 overflow-hidden rounded-2xl border border-ink-100 bg-ink-900 p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold">Public player CV</p><p className="mt-1 text-2xs text-ink-400">Position · club · contributions · career · ratings · verification</p></div>
                  <Icon name="arrow-right" size={20} className="text-red-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROBLEM ================= */}
      <section className="border-b border-ink-100 bg-ink-50/60 py-16 sm:py-20">
        <div className="fw-container">
          <div className="max-w-2xl">
            <Badge tone="red" icon="alert">The gap</Badge>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              The global platforms were never built for this market.
            </h2>
            <p className="mt-3 text-pretty text-ink-600">
              We studied the incumbents — Wyscout, InStat, TransferRoom, Playerhunter — and read
              what their users actually complain about. Then we inverted every one of them.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {PROBLEMS.map(p => (
              <Card key={p.title} className="p-5" hover>
                <div className="flex items-start gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500">
                    <Icon name={p.icon} size={19} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-ink-900">{p.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{p.body}</p>
                    <p className="mt-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">{p.source}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOLUTION ================= */}
      <section className="py-16 sm:py-20">
        <div className="fw-container">
          <div className="max-w-2xl">
            <Badge tone="trust" icon="check-circle">Our answer</Badge>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Four things we do that nobody else does.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {SOLUTIONS.map(s => (
              <Card key={s.title} className="flex flex-col p-6" hover>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-white">
                    <Icon name={s.icon} size={17} />
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-widest text-red-500">{s.tag}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold leading-snug text-ink-900">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{s.body}</p>
                <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-4">
                  {s.points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-xs font-medium text-ink-700">
                      <Icon name="check" size={13} className="shrink-0 text-trust-500" />{p}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="border-y border-ink-100 bg-ink-900 py-16 text-white sm:py-20">
        <div className="fw-container">
          <h2 className="max-w-xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            From unregistered to verified in four steps.
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(s => (
              <div key={s.n} className="relative">
                <span className="font-display text-5xl text-white/10">{s.n}</span>
                <h3 className="mt-2 text-base font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PRICING TEASER ================= */}
      <section className="py-16 sm:py-20">
        <div className="fw-container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <Badge tone="gold" icon="card">Pricing</Badge>
              <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
                Priced for the market we serve.
              </h2>
              <p className="mt-3 text-ink-600">
                Pay in naira via Flutterwave — card, bank transfer or USSD. Annual plans get two months free.
              </p>
            </div>
            <Link to="/pricing"><Button variant="outline" iconRight="arrow-right">All plans</Button></Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {featured.map(p => (
              <Card key={p.id} className="flex flex-col p-6" hover>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <p className="text-xs text-ink-500">{p.audience === 'club' ? 'For clubs & academies' : 'For individual players'}</p>
                  </div>
                  <Badge tone="red">Popular</Badge>
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl">{formatNGN(p.price_ngn)}</span>
                  <span className="text-sm text-ink-500">/month</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.features.slice(0, 5).map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                      <Icon name="check" size={14} className="mt-0.5 shrink-0 text-trust-500" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="mt-6 block">
                  <Button fullWidth iconRight="arrow-right">Start 14-day trial</Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="border-t border-ink-100 bg-ink-50/60 py-16 sm:py-20">
        <div className="fw-container max-w-3xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Straight answers</h2>
          <div className="mt-8 divide-y divide-ink-200 overflow-hidden rounded-2xl border border-ink-200 bg-white">
            {FAQS.map(f => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-ink-900 hover:bg-ink-50">
                  {f.q}
                  <Icon name="chevron-down" size={16} className="shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-ink-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FOOTBALL VISUALS ================= */}
      <section className="border-t border-ink-100 bg-ink-50/60 py-10 sm:py-14">
        <div className="fw-container">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="group relative overflow-hidden rounded-2xl"><img src="/images/academy-training.jpg" alt="Football training session" className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/85 to-transparent p-4"><p className="text-sm font-bold text-white">Train. Perform. Get seen.</p></div></div>
            <div className="group relative overflow-hidden rounded-2xl"><img src="/images/hero-match.jpg" alt="Football match under stadium lights" className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/85 to-transparent p-4"><p className="text-sm font-bold text-white">From local pitch to bigger stages.</p></div></div>
            <div className="group relative overflow-hidden rounded-2xl"><img src="/images/pitch-aerial.jpg" alt="Packed football stadium" className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/85 to-transparent p-4"><p className="text-sm font-bold text-white">Give scouts a clear view of the game.</p></div></div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden bg-ink-900 py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-red-600/25 blur-[100px]" />
        <div className="fw-container relative text-center">
          <Logo size={44} className="mx-auto" />
          <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Every player deserves to be findable. Every club deserves to know who is real.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button size="xl" iconRight="arrow-right">Create your profile</Button></Link>
            <Link to="/for-clubs"><Button size="xl" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              I'm a club
            </Button></Link>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {(['player', 'club', 'admin'] as const).map(r => (
              <button key={r} onClick={() => demoLogin(r)}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-ink-300 backdrop-blur transition-colors hover:bg-white/10 hover:text-white">
                Explore {r === 'admin' ? 'admin' : r} dashboard →
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
