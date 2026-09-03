import { Badge, Card, Icon, type IconName } from '@/components/ui'
import { NoFeeGuarantee, MinorProtectionNotice, TrustPanel } from '@/components/trust'
import { computeTrustScore } from '@/lib/ratings'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

const PILLARS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'building', title: 'Entity verification', body: 'Clubs submit a CAC registration number and an NFF or state FA affiliation. We confirm the entity exists and that the person registering is authorised to act for it.' },
  { icon: 'user', title: 'Identity verification', body: 'Account holders verify against NIN, BVN or passport. A short liveness check defeats the impersonation that makes fake-agent scams work.' },
  { icon: 'shield', title: 'Zero-fee trial policy', body: 'A club may never charge a player to attend a trial. Postings that demand payment are blocked before they go live, and the attempt is logged against the account.' },
  { icon: 'eye', title: 'Guardian visibility for minors', body: 'Every message a club sends to an under-18 player is copied to the registered guardian. Direct trial or transfer arrangements with minors are blocked.' },
  { icon: 'doc', title: 'Immutable audit trail', body: 'Every material action — verification decisions, rating submissions, access grants — is appended to a tamper-evident log. Updates and deletes are rejected at the database level.' },
  { icon: 'alert', title: 'Report and escalate', body: 'Players can report a suspicious approach in two taps. Reports route to a human reviewer and, where warranted, to the NFF and the EFCC.' },
]

export default function TrustPage() {
  const good = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: true,
    videoVerified: true, referencesVerified: true, paymentVerified: true, tenureDays: 400, disputesUpheld: 0})
  const partial = computeTrustScore({
    emailVerified: true, phoneVerified: true, identityVerified: true, entityVerified: false,
    videoVerified: false, referencesVerified: false, paymentVerified: true, tenureDays: 45, disputesUpheld: 0})
  const bad = computeTrustScore({
    emailVerified: true, phoneVerified: false, identityVerified: false, entityVerified: false,
    videoVerified: false, referencesVerified: false, paymentVerified: false, tenureDays: 3, disputesUpheld: 1})

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-trust-500/15 blur-[100px]" />
        <div className="fw-container relative py-14">
          <Badge tone="trust" icon="shield">Trust & safety</Badge>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Fake agents are the biggest threat in Nigerian football. So we built against them.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink-300">
            Families have lost between £4,300 and £8,600 to a single phantom trial. Didier Drogba
            called the trade what it is: human trafficking. FutWeb does not merely warn players
            about it — the platform is architected so it cannot easily happen here.
          </p>
        </div>
      </section>

      <section className="fw-container py-12">
        <div className="grid gap-4 lg:grid-cols-2">
          {PILLARS.map(p => (
            <Card key={p.title} hover className="p-5">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-trust-50 text-trust-600">
                  <Icon name={p.icon} size={19} />
                </span>
                <div>
                  <h3 className="text-sm font-bold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{p.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section id="verification" className="border-y border-ink-100 bg-ink-50/60 py-14">
        <div className="fw-container">
          <h2 className="text-3xl font-extrabold tracking-tight">What a trust score looks like</h2>
          <p className="mt-2 max-w-2xl text-ink-600">
            Every club and agent carries a score out of 100, assembled from eight discrete checks.
            Players see it everywhere the club appears — before they reply, let alone pay.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              { t: good, name: 'Rivers United FC', note: 'A registered NPFL club with full documentation.' },
              { t: partial, name: 'Golden Boot Academy', note: 'Real, but affiliation not yet confirmed.' },
              { t: bad, name: 'Unverified account', note: 'Three days old, no documentation, one upheld dispute.' },
            ].map(x => (
              <div key={x.name}>
                <TrustPanel trust={x.t} entityName={x.name} />
                <p className="mt-2 px-1 text-xs text-ink-500">{x.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fw-container py-14">
        <div className="grid gap-4 lg:grid-cols-2">
          <div id="minors">
            <h2 className="text-2xl font-extrabold tracking-tight">Protecting under-18s</h2>
            <p className="mt-2 text-sm text-ink-600">
              FIFA Article 19 exists to stop minors being moved across borders for football. The
              Nigeria Data Protection Act 2023 governs how their data is handled. FutWeb enforces both
              in the product, not just in the policy document.
            </p>
            <div className="mt-4 space-y-3">
              <MinorProtectionNotice guardianName="Mr. Okonkwo" />
              <NoFeeGuarantee />
              <NoFeeGuarantee variant="warning" />
              <NoFeeGuarantee variant="danger" />
            </div>
          </div>

          <Card className="p-6">
            <h3 className="text-base font-bold">If someone asks you for money</h3>
            <ol className="mt-4 space-y-3">
              {[
                'Do not pay. A legitimate club never charges a player for a trial.',
                'Check the trust badge on their profile. If it says Unverified, treat every claim as unproven.',
                'Report the account from the profile page. Reports go to a human reviewer.',
                'Where money has changed hands, escalate to the NFF and the EFCC. We will supply the audit trail.',
              ].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-50 text-xs font-bold text-red-600">{i + 1}</span>
                  <span className="text-sm text-ink-700">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl bg-ink-50 p-4">
              <p className="text-xs font-semibold text-ink-700">Report a suspicious approach</p>
              <p className="mt-1 text-xs text-ink-500">Our team reviews every report, usually within one working day.</p>
              <Link to="/report" className="mt-3 inline-block">
                <Button size="sm" variant="dark" iconRight="arrow-right">Open a report</Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
