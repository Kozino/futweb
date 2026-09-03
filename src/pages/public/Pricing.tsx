import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Icon, Tabs, Toggle } from '@/components/ui'
import { PLANS, annualPrice, annualPriceUsd, ANNUAL_DISCOUNT_MONTHS } from '@/lib/constants'
import { cn, formatNGN, formatUSD } from '@/lib/utils'

export default function Pricing() {
  const [tab, setTab] = useState<'player' | 'club'>('player')
  const [annual, setAnnual] = useState(false)
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN')

  const plans = PLANS.filter(p => p.audience === tab || p.audience === 'both')
  const fmt = (n: number) => (currency === 'NGN' ? formatNGN(n) : formatUSD(n))

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-[100px]" />
        <div className="fw-container relative py-14 text-center">
          <Badge tone="red">Pricing</Badge>
          <h1 className="mx-auto mt-4 max-w-2xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
            Priced in naira, because that is what you earn in.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-ink-300">
            Legacy scouting tools start near €250 a year and climb into five figures.
            FutWeb starts at the price of a matchday ticket.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Toggle checked={annual} onChange={setAnnual} label={`Annual billing — save ${ANNUAL_DISCOUNT_MONTHS} months`} />
            <div className="flex rounded-xl border border-white/15 bg-white/5 p-0.5">
              {(['NGN', 'USD'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={cn('rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors',
                    currency === c ? 'bg-white text-ink-900' : 'text-ink-300 hover:text-white')}>
                  {c === 'NGN' ? '₦ Naira' : '$ US Dollar'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="fw-container py-12">
        <Tabs
          className="mx-auto max-w-xs"
          value={tab}
          onChange={setTab}
          tabs={[{ value: 'player', label: 'Players', icon: 'user' }, { value: 'club', label: 'Clubs & Academies', icon: 'building' }]}
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map(p => {
            const price = p.price_ngn === 0 ? 0 : annual
              ? (currency === 'NGN' ? annualPrice(p) : annualPriceUsd(p))
              : (currency === 'NGN' ? p.price_ngn : p.price_usd)

            return (
              <Card key={p.id} hover className={cn('flex flex-col p-6', p.featured && 'relative ring-2 ring-red-500')}>
                {p.featured && (
                  <span className="absolute -top-3 left-6">
                    <Badge tone="red" icon="star-filled">Most popular</Badge>
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  {price === 0
                    ? <span className="font-display text-4xl">Free</span>
                    : <>
                        <span className="font-display text-4xl">{fmt(price)}</span>
                        <span className="text-sm text-ink-500">/{annual ? 'year' : 'month'}</span>
                      </>}
                </div>
                <p className="mt-1 h-4 text-xs text-ink-500">
                  {price > 0 && p.trial_days > 0 ? `${p.trial_days}-day free trial` : ''}
                </p>

                {tab === 'club' && (
                  <div className="mt-3 flex gap-2 text-2xs">
                    <span className="rounded-lg bg-ink-100 px-2 py-1 font-semibold text-ink-600">
                      {p.player_seats === -1 ? 'Unlimited players' : `Up to ${p.player_seats} players`}
                    </span>
                    <span className="rounded-lg bg-ink-100 px-2 py-1 font-semibold text-ink-600">
                      {p.staff_seats === -1 ? 'Unlimited staff' : `${p.staff_seats} staff`}
                    </span>
                  </div>
                )}

                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-700">
                      <Icon name="check" size={14} className="mt-0.5 shrink-0 text-trust-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/register" className="mt-6 block">
                  <Button fullWidth variant={p.featured ? 'primary' : 'outline'}
                    iconRight={price === 0 ? undefined : 'arrow-right'}>
                    {price === 0 ? 'Start free' : 'Start 14-day trial'}
                  </Button>
                </Link>
              </Card>
            )
          })}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: 'card' as const, t: 'Flutterwave, local-first', d: 'Pay by card, bank transfer or USSD in naira. International cards and USD billing supported for clubs abroad.' },
            { icon: 'shield' as const, t: 'Never charged twice', d: 'Subscriptions are idempotent. Webhook replays are deduplicated, so a dropped network can not bill you twice.' },
            { icon: 'x-circle' as const, t: 'Cancel in one click', d: 'No phone calls, no retention maze. Cancel from billing and keep access until the period ends.' },
          ].map(f => (
            <div key={f.t} className="rounded-2xl border border-ink-100 bg-ink-50/60 p-5">
              <Icon name={f.icon} size={18} className="text-red-500" />
              <h4 className="mt-2.5 text-sm font-bold">{f.t}</h4>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
