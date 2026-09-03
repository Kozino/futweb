import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon, type IconName } from '@/components/ui'
import { ShareCardPreview } from '@/components/player/ShareCard'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { NoFeeGuarantee } from '@/components/trust'

const STEPS = [
  { icon: 'user' as IconName, t: 'Build a CV that actually says something', d: 'Thirty-two attributes across technical, physical, mental and defensive categories, plus height, weight, foot and position. Not a photo and a phone number.' },
  { icon: 'video' as IconName, t: 'Lead with video, not adjectives', d: 'Upload highlights and full matches. Every clip carries provenance — when and where it was recorded — so nobody passes off borrowed footage.' },
  { icon: 'share' as IconName, t: 'Share where the game actually happens', d: 'Export a crisp card built for WhatsApp and Instagram. A forwarded image gets watched; a link gets ignored.' },
  { icon: 'shield' as IconName, t: 'Know exactly who is messaging you', d: 'Every club carries a trust score built from CAC, NFF affiliation, identity and liveness checks. If they are unverified, you see it first.' },
  { icon: 'target' as IconName, t: 'Trials that never cost you money', d: 'Verified trial invitations arrive straight to your dashboard. Charging a player for a trial is against platform policy, full stop.' },
  { icon: 'chart' as IconName, t: 'Watch your own development', d: 'A timeline of every rating, with a projection toward your positional prime. See the curve, not just the number.' },
]

export default function ForPlayers() {
  const me = enrichPlayer(DEMO_PLAYERS[0])
  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-red-600/20 blur-[110px]" />
        <div className="fw-container relative grid items-center gap-10 py-14 lg:grid-cols-2">
          <div>
            <Badge tone="red">For players</Badge>
            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              You are good enough.<br /><span className="text-red-400">You are just not findable.</span>
            </h1>
            <p className="mt-4 max-w-lg text-pretty text-ink-300">
              Scouts cannot sign a player they have never seen. FutWeb turns you into a verified,
              data-rich digital CV — one you can put in a scout's WhatsApp in ten seconds.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register?as=player"><Button size="xl" iconRight="arrow-right">Create my CV — free</Button></Link>
              <Link to="/pricing"><Button size="xl" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">See plans</Button></Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[300px]">
            <ShareCardPreview
              avatarUrl={undefined}
              data={{
                name: `${me.first_name} ${me.last_name}`,
                position: me.position_primary,
                age: me.age,
                club: me.clubName,
                nationality: 'Nigeria',
                foot: me.foot,
                height: me.height_cm,
                weight: me.weight_kg,
                score: me.score.current,
                potential: me.score.potential,
                confidence: me.confidence.score,
                attributes: me.attributes,
                verified: true,
              }}
            />
            <p className="mt-3 text-center text-xs text-ink-500">Your share card — one tap, straight to WhatsApp</p>
          </div>
        </div>
      </section>

      <section className="fw-container py-14">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(s => (
            <Card key={s.t} hover className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500">
                <Icon name={s.icon} size={19} />
              </span>
              <h3 className="mt-3.5 text-sm font-bold leading-snug">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="p-6">
            <h3 className="text-lg font-bold">What a FutWeb CV contains</h3>
            <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {[
                '32 scored attributes', 'Position-fit across GK/DF/MF/FW', 'Highlight & full-match video',
                'Match statistics, per-90', 'Career history with verification', 'Physical profile & testing data',
                'Confidence score on every rating', 'Development timeline & projection', 'Guardian details (under 18)',
                'Availability & contract status', 'Shareable card & PDF dossier', 'Scout view analytics',
              ].map(f => (
                <span key={f} className="flex items-center gap-2 text-sm text-ink-700">
                  <Icon name="check" size={14} className="shrink-0 text-trust-500" />{f}
                </span>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            <NoFeeGuarantee />
            <Card className="p-5">
              <h3 className="text-sm font-bold">Under 18?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                Your guardian registers consent and is copied on every club message. No trial or
                transfer arrangement can be made with you directly — that is FIFA Article 19, and
                we enforce it in code.
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-bold">Does it cost anything to start?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                No. The Scout plan is free forever. Upgrade when you want verified ratings, video
                uploads and the shareable card — from ₦3,500 a month, with a 14-day trial.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
