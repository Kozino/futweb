import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Icon, Input, Textarea, toast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { hasSupabase } from '@/lib/supabase'
import { submitEnterpriseRequest } from '@/lib/supabase/federation'

const OPTIONS = [
  { key: 'sso', label: 'SSO / SAML / OIDC' },
  { key: 'data_residency', label: 'Data residency' },
  { key: 'api_webhooks', label: 'API access & webhook streams' },
  { key: 'custom_roles', label: 'Custom roles & RBAC' },
  { key: 'sla_nam', label: 'Custom SLA & named account manager' },
  { key: 'nff_onboarding', label: 'Dedicated onboarding & NFF compliance' },
  { key: 'multi_academy', label: 'Multi-academy / group structure' },
]

export default function FederationApply() {
  const { user } = useAuth()
  const [org, setOrg] = useState(user?.clubName ?? '')
  const [name, setName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [needs, setNeeds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  function toggleNeed(k: string) {
    setNeeds(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }

  async function submit() {
    if (!hasSupabase) return
    if (!org.trim() || !email.trim()) {
      toast({ tone: 'error', title: 'Complete the required fields', description: 'Organisation and contact email are required.' })
      return
    }
    setBusy(true)
    try {
      await submitEnterpriseRequest({
        organisation: org.trim(),
        contactName: name.trim() || '—',
        contactEmail: email.trim(),
        contactPhone: phone.trim() || undefined,
        needs: needs.join(', '),
        message: message.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not submit', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50/60 px-4 py-10">
      <div className="w-full max-w-xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
          <Icon name="chevron-left" size={14} />Back
        </Link>

        <Card className="p-6 sm:p-8">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-trust-50 text-trust-600">
                <Icon name="check-circle" size={26} />
              </span>
              <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Request received</h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
                Thanks — our team will contact {email.trim()} about Federation access for{' '}
                {org.trim()}. Enterprise items (SSO, data residency, SLA, account manager and
                more) are arranged individually.
              </p>
              <Link to="/"><Button className="mt-5" size="sm">Back to home</Button></Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-ink-900">Request Federation / Enterprise access</h1>
              <p className="mt-1 text-sm text-ink-500">
                The Federation tier includes multi-academy group management. Enterprise capabilities
                (SSO, data residency, API/webhooks, custom roles, SLA, named account manager and NFF
                onboarding) are tailored to your organisation.
              </p>

              <div className="mt-6 space-y-4">
                <Input label="Organisation *" value={org} onChange={e => setOrg(e.target.value)} placeholder="e.g. Rivers State Football Association" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Contact name" value={name} onChange={e => setName(e.target.value)} />
                  <Input label="Contact phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+234 …" />
                </div>
                <Input label="Contact email *" type="email" value={email} onChange={e => setEmail(e.target.value)} />

                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-700">What do you need? (select all that apply)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OPTIONS.map(o => {
                      const on = needs.includes(o.key)
                      return (
                        <button key={o.key} type="button" onClick={() => toggleNeed(o.key)}
                          className={on
                            ? 'rounded-lg bg-ink-900 px-2.5 py-1 text-2xs font-bold text-white'
                            : 'rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-2xs font-semibold text-ink-600 hover:bg-ink-50'}>
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Textarea label="Tell us about your organisation" value={message} maxChars={1000}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="How many clubs/academies do you oversee? What are you trying to achieve?" />

                <div className="flex items-center justify-end gap-2">
                  <Link to="/"><Button variant="outline">Cancel</Button></Link>
                  <Button icon="send" loading={busy} onClick={() => void submit()}>Submit request</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
