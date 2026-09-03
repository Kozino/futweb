import { useState } from 'react'
import { Button, Card, Input, Select, Textarea, toast, Badge, Icon } from '@/components/ui'

const TYPES = [
  { value: 'fee', label: 'Asked me to pay for a trial or contract' },
  { value: 'impersonation', label: 'Someone is impersonating a real club or agent' },
  { value: 'phantom', label: 'Promised a trial that did not exist' },
  { value: 'minor', label: 'Approached an under-18 player directly' },
  { value: 'documents', label: 'Asked for my passport or documents' },
  { value: 'other', label: 'Something else' },
]

export default function Report() {
  const [type, setType] = useState('fee')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="fw-container py-20">
        <Card className="mx-auto max-w-lg p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Icon name="shield" size={24} />
          </span>
          <h2 className="mt-4 text-lg font-bold">Report filed — reference FW-{Math.random().toString(36).slice(2, 8).toUpperCase()}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            A human reviewer will look at this, usually within one working day. If money has changed
            hands, contact the EFCC and the NFF as well — and quote this reference. We will supply
            the audit trail for the account involved.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Card className="p-3.5">
              <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">EFCC</p>
              <p className="mt-0.5 text-xs text-ink-700">No. 5 Fomella Street, Wuse II, Abuja</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">NFF</p>
              <p className="mt-0.5 text-xs text-ink-700">Report unlicensed agents to the federation</p>
            </Card>
          </div>
          <Button className="mt-6" variant="outline" onClick={() => setDone(false)}>File another report</Button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <section className="border-b border-ink-100 bg-red-600 text-white">
        <div className="fw-container py-14">
          <Badge tone="dark" className="bg-white/15 text-white">Priority queue</Badge>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Report a suspicious approach
          </h1>
          <p className="mt-3 max-w-xl text-red-50">
            A legitimate club will never ask you to pay for a trial. If someone has, report them —
            it protects the next player as much as it protects you.
          </p>
        </div>
      </section>

      <section className="fw-container max-w-2xl py-12">
        <Card className="p-6">
          <form onSubmit={e => { e.preventDefault(); setDone(true); toast({ tone: 'success', title: 'Report submitted' }) }}>
            <Select label="What happened?" value={type} onChange={e => setType(e.target.value)} options={TYPES} required />
            <Input className="mt-4" label="Who approached you?" placeholder="Name, club or account" icon="user" required />
            <Input className="mt-4" label="Where did they contact you?" placeholder="WhatsApp number, Instagram handle, email" icon="phone" />
            <Input className="mt-4" label="Amount demanded (₦), if any" placeholder="0" inputMode="numeric" icon="card" />
            <Textarea className="mt-4" label="Tell us what happened" maxChars={1200} required
              placeholder="Include dates, what was promised, and anything they sent you." />
            <div className="mt-5 rounded-xl bg-ink-50 p-3.5">
              <p className="flex items-start gap-2 text-xs text-ink-600">
                <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
                Reports are confidential. The account you report is not notified, and your identity
                is withheld unless you choose to pursue a formal complaint.
              </p>
            </div>
            <Button type="submit" className="mt-5" size="lg" variant="danger" icon="alert">Submit report</Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
