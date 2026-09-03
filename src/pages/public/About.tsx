import { Badge, Card, Icon, type IconName } from '@/components/ui'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

const VALUES = [
  { icon: 'shield' as IconName, t: 'Trust is the product', d: 'In a market where families lose thousands to phantom trials, verification is not a feature. It is the thing we sell.' },
  { icon: 'globe' as IconName, t: 'Built here, not adapted here', d: 'We did not take European software and translate the currency. The data model starts with the NPFL and state FA leagues.' },
  { icon: 'zap' as IconName, t: 'Assume the worst network', d: 'One bar of 3G on a dusty pitch is the default case, not the edge case. Every screen is designed for it.' },
  { icon: 'eye' as IconName, t: 'Show your working', d: 'Ratings, trust scores and pricing are published and explainable. A scout should be able to disagree with our model — openly.' },
]

export default function About() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="fw-container relative py-14">
          <Badge tone="red">About</Badge>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            We are building the infrastructure<br />Nigerian football never had.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink-300">
            FutWeb exists because talent in this country is abundant and record-keeping is not.
            Millions of players train every week with no verifiable trace of what they can do —
            and no safe way to prove it to anyone who matters.
          </p>
        </div>
      </section>

      <section className="fw-container py-14">
        <div className="grid gap-4 md:grid-cols-2">
          {VALUES.map(v => (
            <Card key={v.t} hover className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500">
                <Icon name={v.icon} size={19} />
              </span>
              <h3 className="mt-3.5 text-sm font-bold">{v.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{v.d}</p>
            </Card>
          ))}
        </div>

        <div id="careers" className="mt-12 grid gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-bold">Careers</h2>
            <p className="mt-2 text-sm text-ink-600">
              We hire for judgement and obsession, not pedigree. If you have shipped software
              people depend on, or you know Nigerian football from the inside, we want to talk.
            </p>
            <div className="mt-4 space-y-2">
              {['Senior Frontend Engineer — Lagos / Remote', 'Backend Engineer (Postgres, Edge Functions) — Remote', 'Football Data Analyst — Lagos', 'Trust & Safety Reviewer — Abuja'].map(r => (
                <div key={r} className="flex items-center justify-between rounded-xl border border-ink-100 px-3.5 py-2.5">
                  <span className="text-sm text-ink-700">{r}</span>
                  <Icon name="arrow-right" size={15} className="shrink-0 text-ink-300" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 id="status" className="text-lg font-bold">Platform status</h2>
            <p className="mt-2 text-sm text-ink-600">
              FutWeb runs on Supabase for data and authentication, with billing through Flutterwave
              and static delivery via a global CDN. Status and incident history are public.
            </p>
            <div className="mt-4 space-y-2">
              {[['Web application', 'Operational'], ['Supabase database', 'Operational'], ['Flutterwave billing', 'Operational'], ['Media processing', 'Degraded — uploads delayed']].map(([s, st]) => (
                <div key={s} className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0">
                  <span className="text-sm text-ink-700">{s}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${st.startsWith('Operational') ? 'text-trust-600' : 'text-amber-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.startsWith('Operational') ? 'bg-trust-500' : 'bg-amber-500'}`} />
                    {st}
                  </span>
                </div>
              ))}
            </div>
            <Link to="/contact" className="mt-5 inline-block">
              <Button size="sm" variant="outline" iconRight="arrow-right">Contact us</Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  )
}
