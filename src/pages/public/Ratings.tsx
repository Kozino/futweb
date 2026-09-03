import { useMemo, useState } from 'react'
import { Badge, Card, Icon, Select, Tabs } from '@/components/ui'
import { ATTRIBUTE_GROUPS, POSITION_WEIGHTS, groupForPosition } from '@/lib/ratings'
import { POSITION_LIST } from '@/lib/ratings'
import { cn } from '@/lib/utils'

export default function Ratings() {
  const [pos, setPos] = useState('ST')
  const group = groupForPosition(pos)
  const weights = useMemo(
    () => Object.entries(POSITION_WEIGHTS[group]).sort((a, b) => (b[1] as number) - (a[1] as number)),
    [group],
  )
  const [tab, setTab] = useState<'weights' | 'age' | 'confidence'>('weights')

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-50" />
        <div className="fw-container relative py-14">
          <Badge tone="gold">Methodology</Badge>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            A rating is not a number.<br />It is an answer to three questions.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink-300">
            Every other platform hands you a raw attribute and leaves you to interpret it. FutWeb
            publishes the model, because a scout should be able to argue with the number — not
            just accept it.
          </p>
        </div>
      </section>

      <section className="fw-container py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { n: '01', t: 'Is he good for that position?', d: 'Attributes are weighted by position group. A centre-back is not punished for a low crossing score, and a striker is not rewarded for it.' },
            { n: '02', t: 'Is he good for his age?', d: 'Development curves differ by position — goalkeepers peak latest, forwards earliest. We project toward the positional prime rather than comparing a 17-year-old to a 27-year-old.' },
            { n: '03', t: 'Can I trust this number?', d: 'An uncorroborated self-rating is regressed toward the population mean. The more independent, verified evidence behind a rating, the less it is discounted.' },
          ].map(x => (
            <Card key={x.n} className="p-5">
              <span className="font-display text-4xl text-red-500/25">{x.n}</span>
              <h3 className="mt-2 text-sm font-bold leading-snug">{x.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{x.d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'weights', label: 'Position weighting' },
            { value: 'age', label: 'Age curve' },
            { value: 'confidence', label: 'Confidence model' },
          ]} />

          {tab === 'weights' && (
            <Card className="mt-5 p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold">Weighting for {pos}</h3>
                  <p className="text-xs text-ink-500">Weights are per position group ({group}) and always sum to 1.0.</p>
                </div>
                <Select
                  className="w-40" value={pos}
                  onChange={e => setPos(e.target.value)}
                  options={[...POSITION_LIST].map(p => ({ value: p, label: p }))}
                />
              </div>

              <div className="mt-6 space-y-2.5">
                {weights.map(([k, w]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs font-semibold capitalize text-ink-700">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${(w as number) * 100 * 6}%` }} />
                    </div>
                    <span className="tnum w-12 shrink-0 text-right text-xs font-bold">{((w as number) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3 border-t border-ink-100 pt-5 sm:grid-cols-2">
                {Object.entries(ATTRIBUTE_GROUPS).map(([g, keys]) => (
                  <div key={g}>
                    <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">{g}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {keys.map(k => (
                        <span key={k} className={cn('rounded-md px-2 py-1 text-2xs font-medium capitalize',
                          weights.some(([w]) => w === k) ? 'bg-red-50 text-red-700' : 'bg-ink-100 text-ink-500')}>
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'age' && (
            <Card className="mt-5 p-6">
              <h3 className="text-base font-bold">Development curve by position</h3>
              <p className="mt-1 text-xs text-ink-500">
                Peak age varies by role. We model the gap between a player's current age and their
                positional prime, then project — with a cap so a 14-year-old's projection stays sane.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left">
                      {['Position group', 'Typical peak age', 'Development rate', 'Projection cap'].map(h => (
                        <th key={h} className="pb-2 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {[{ g: 'Goalkeeper', p: 29 }, { g: 'Defender', p: 28 }, { g: 'Midfielder', p: 27 }, { g: 'Forward', p: 26 }].map(r => (
                      <tr key={r.g}>
                        <td className="py-2.5 font-semibold">{r.g}</td>
                        <td className="tnum py-2.5 text-ink-600">{r.p}</td>
                        <td className="tnum py-2.5 text-ink-600">5.5% per year of gap</td>
                        <td className="tnum py-2.5 text-ink-600">12 years</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 rounded-xl bg-ink-50 p-4">
                <p className="text-xs font-semibold text-ink-700">Worked example</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">
                  An 18-year-old centre-back rated 62 sits nine years from a defender's peak of 28.
                  Projected peak: 62 × (1 + 9 × 0.055) ≈ <strong>93</strong>, which the model caps
                  and tempers through confidence. The projection is a ceiling, not a promise — and it
                  is always shown alongside the confidence score that produced it.
                </p>
              </div>
            </Card>
          )}

          {tab === 'confidence' && (
            <Card className="mt-5 p-6">
              <h3 className="text-base font-bold">Confidence weighting</h3>
              <p className="mt-1 text-xs text-ink-500">
                Six factors contribute 100 points. A rating with no corroboration is regressed up to
                30% toward the population mean of 50 — so an inflated self-assessment cannot pass as evidence.
              </p>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left">
                      {['Signal', 'Threshold', 'Points'].map(h => (
                        <th key={h} className="pb-2 text-2xs font-bold uppercase tracking-wider text-ink-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {[
                      ['Multiple observations', '3+ ratings on file', 25],
                      ['Independent raters', '2+ distinct sources', 25],
                      ['Verified raters', '1+ verified coach or scout', 20],
                      ['Live match observation', '3+ matches observed', 15],
                      ['Video evidence', 'Verified highlight footage', 8],
                      ['Official match stats', 'Federation data linked', 7],
                    ].map(([a, b, c]) => (
                      <tr key={a as string}>
                        <td className="py-2.5 font-semibold">{a as string}</td>
                        <td className="py-2.5 text-ink-600">{b as string}</td>
                        <td className="tnum py-2.5 font-bold text-red-600">{c as number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-trust-200 bg-trust-50 p-4">
                <Icon name="info" size={16} className="mt-0.5 shrink-0 text-trust-600" />
                <p className="text-xs leading-relaxed text-trust-800">
                  A self-rated profile with one clip might score 15/100 confidence, pulling a claimed
                  85 down to roughly 72. A coach-verified profile with six observations scores above
                  85 and is barely discounted at all. This is the mechanism that makes FutWeb ratings
                  worth a club's time.
                </p>
              </div>
            </Card>
          )}
        </div>
      </section>
    </div>
  )
}
