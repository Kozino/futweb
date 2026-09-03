import { useState } from 'react'
import { Button, Card, Input, Select, Textarea, toast } from '@/components/ui'
import { Icon } from '@/components/ui'

export default function Contact() {
  const [sent, setSent] = useState(false)
  const [topic, setTopic] = useState('sales')

  if (sent) {
    return (
      <div className="fw-container py-24">
        <Card className="mx-auto max-w-md p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-trust-50 text-trust-600">
            <Icon name="check-circle" size={26} />
          </span>
          <h2 className="mt-4 text-lg font-bold">Message received</h2>
          <p className="mt-1.5 text-sm text-ink-600">
            We reply to every message within one working day. Urgent trust and safety matters are
            reviewed same-day.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => setSent(false)}>Send another</Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b border-ink-100 bg-ink-900 text-white">
        <div className="absolute" />
        <div className="fw-container py-14">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Talk to us</h1>
          <p className="mt-3 max-w-xl text-ink-300">
            Clubs onboarding a squad, players with a question, or someone who wants to report
            something — this reaches a human.
          </p>
        </div>
      </section>

      <section className="fw-container grid gap-6 py-12 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <form onSubmit={e => { e.preventDefault(); setSent(true); toast({ tone: 'success', title: 'Message sent' }) }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full name" required placeholder="Chidi Okonkwo" />
              <Input label="Email" type="email" required placeholder="you@example.com" icon="mail" />
              <Select label="What is this about?" value={topic} onChange={e => setTopic(e.target.value)} options={[
                { value: 'sales', label: 'Club onboarding & pricing' },
                { value: 'player', label: 'Player account help' },
                { value: 'trust', label: 'Trust & safety concern' },
                { value: 'press', label: 'Press & partnerships' },
                { value: 'other', label: 'Something else' },
              ]} />
              <Input label="Organisation" placeholder="Club or academy name" icon="building" />
            </div>
            <Textarea className="mt-4" label="Message" required maxChars={1000}
              placeholder="Tell us what you need — squads, trials, verification, anything." />
            <Button type="submit" className="mt-5" size="lg" iconRight="arrow-right">Send message</Button>
          </form>
        </Card>

        <div className="space-y-4">
          {[
            { icon: 'mail' as const, t: 'Email', d: 'hello@futweb.app', sub: 'Sales: clubs@futweb.app' },
            { icon: 'phone' as const, t: 'Phone', d: '+234 700 FUTWEB', sub: 'Mon–Fri, 9am–6pm WAT' },
            { icon: 'map' as const, t: 'Lagos', d: 'Yaba, Lagos State', sub: 'Registration: RC-000000' },
            { icon: 'alert' as const, t: 'Report a scam', d: 'Priority review queue', sub: 'Escalates to NFF / EFCC where warranted' },
          ].map(c => (
            <Card key={c.t} className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                  <Icon name={c.icon} size={16} />
                </span>
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{c.t}</p>
                  <p className="text-sm font-semibold text-ink-900">{c.d}</p>
                  <p className="text-xs text-ink-500">{c.sub}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
