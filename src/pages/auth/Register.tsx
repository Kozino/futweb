import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Icon, Input, Select, Badge, ProgressBar, type IconName } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { runValidators, validators, cn } from '@/lib/utils'
import type { AccountType } from '@/types'
import { Logo } from '@/components/layout/Logo'

type Step = 'type' | 'account' | 'details' | 'verify'

const ACCOUNT_TYPES: { value: AccountType; icon: IconName; title: string; blurb: string; bullets: string[] }[] = [
  {
    value: 'player', icon: 'user', title: 'I am a player',
    blurb: 'Build a verified digital CV that scouts can actually find.',
    bullets: ['32-attribute profile', 'Video-first highlights', 'WhatsApp share card', 'Verified trial invitations'],
  },
  {
    value: 'club', icon: 'building', title: 'I represent a club',
    blurb: 'Manage your squad, discover talent and run verified trials.',
    bullets: ['Squad & staff management', 'Offline scouting capture', 'Discovery search', 'Verified trial postings'],
  },
]

export default function Register() {
  const [params] = useSearchParams()
  const initial = params.get('as') === 'club' ? 'club' : params.get('as') === 'player' ? 'player' : null
  const [step, setStep] = useState<Step>(initial ? 'account' : 'type')
  const [type, setType] = useState<AccountType | null>(initial as AccountType | null)
  const nav = useNavigate()
  const { signUp } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '', confirm: '',
    clubName: '', clubShort: '', country: 'Nigeria', state: '', league: '',
    position: '', dob: '', foot: 'right', height: '', weight: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const stepIndex = { type: 0, account: 1, details: 2, verify: 3 }[step]

  function validateAccount() {
    const e: Record<string, string> = {}
    const r = (k: keyof typeof form, ...rules: ((v: string) => true | string)[]) => {
      const msg = runValidators(form[k], rules)
      if (msg) e[k] = msg
    }
    r('fullName', validators.required, validators.minLen(2))
    r('email', validators.required, validators.email)
    if (form.phone) r('phone', validators.phoneNG)
    r('password', validators.required, validators.password)
    r('confirm', validators.required, validators.match(form.password))
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateDetails() {
    const e: Record<string, string> = {}
    if (type === 'club') {
      if (runValidators(form.clubName, [validators.required])) e.clubName = 'Club name is required'
      if (runValidators(form.state, [validators.required])) e.state = 'Select a state or region'
    } else {
      if (!form.dob) e.dob = 'Date of birth is required'
      if (runValidators(form.position, [validators.required])) e.position = 'Select your main position'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

 async function submit() {
  setLoading(true)

  const { error } = await signUp({
    email: form.email,
    password: form.password,
    accountType: type!,
    fullName: form.fullName,
    clubName: type === 'club' ? form.clubName : undefined,
    phone: form.phone,

    playerDetails: type === 'player'
      ? {
          dob: form.dob,
          position: form.position,
          foot: form.foot,
          height: form.height,
          weight: form.weight,
          nationality: form.country,
          stateOfOrigin: form.state,
        }
      : undefined,

    clubDetails: type === 'club'
      ? {
          shortName: form.clubShort,
          country: form.country,
          stateRegion: form.state,
          leagueCode: form.league,
        }
      : undefined,
  })

  setLoading(false)

  if (error) {
    setErrors({ email: error })
    return
  }

  nav(type === 'club' ? '/onboarding/club' : '/onboarding/player')
}
  return (
    <div className="min-h-screen bg-ink-50/60">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-ink-100 bg-white">
          <div className="fw-container flex h-16 items-center justify-between">
            <Link to="/"><Logo size={28} wordmark /></Link>
            <p className="text-sm text-ink-500">
              Already registered? <Link to="/login" className="font-semibold text-red-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-4 py-10">
          <div className="w-full max-w-lg">
            <div className="mb-6">
              <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-400">
                {['Account type', 'Credentials', 'Details', 'Verify'].map((s, i) => (
                  <span key={s} className={cn(i <= stepIndex ? 'text-red-600' : '')}>{s}</span>
                ))}
              </div>
              <ProgressBar className="mt-2" value={(stepIndex + 1) * 25} />
            </div>

            <Card className="p-6 sm:p-8">
              {step === 'type' && (
                <div className="animate-fade-in">
                  <h1 className="text-2xl font-extrabold tracking-tight">Join FutWeb</h1>
                  <p className="mt-1.5 text-sm text-ink-600">Which describes you? You can add the other later.</p>

                  <div className="mt-6 space-y-3">
                    {ACCOUNT_TYPES.map(t => (
                      <button key={t.value} onClick={() => { setType(t.value); setStep('account') }}
                        className="group flex w-full items-start gap-4 rounded-2xl border-2 border-ink-100 p-4 text-left transition-all hover:border-red-300 hover:bg-red-50/40">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white transition-colors group-hover:bg-red-500">
                          <Icon name={t.icon} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-ink-900">{t.title}</span>
                          <span className="block text-xs text-ink-500">{t.blurb}</span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {t.bullets.map(b => (
                              <span key={b} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-2xs font-medium text-ink-600">{b}</span>
                            ))}
                          </span>
                        </span>
                        <Icon name="chevron-right" size={18} className="mt-1 shrink-0 text-ink-300 group-hover:text-red-500" />
                      </button>
                    ))}
                  </div>

                  <p className="mt-5 text-center text-xs text-ink-500">
                    Agents and intermediaries: register as a club, then add your representation details during verification.
                  </p>
                </div>
              )}

              {step === 'account' && (
                <form className="animate-fade-in" onSubmit={e => { e.preventDefault(); if (validateAccount()) setStep('details') }}>
                  <button type="button" onClick={() => setStep('type')} className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
                    <Icon name="chevron-left" size={14} />Back
                  </button>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {type === 'club' ? 'Create your club account' : 'Create your player account'}
                  </h1>
                  <p className="mt-1.5 text-sm text-ink-600">
                    {type === 'club' ? 'Use an official club email if you have one — it speeds up verification.'
                                     : 'Use an email you check often. Trial invitations arrive here.'}
                  </p>

                  <div className="mt-6 space-y-4">
                    <Input label={type === 'club' ? 'Your full name' : 'Full name'} required icon="user"
                      placeholder={type === 'club' ? 'Ibrahim Danjuma' : 'Chidi Okonkwo'}
                      value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
                    <Input label="Email address" required type="email" icon="mail" placeholder="you@example.com"
                      value={form.email} onChange={set('email')} error={errors.email} />
                    <Input label="Phone number" icon="phone" placeholder="+234 801 234 5678"
                      value={form.phone} onChange={set('phone')} error={errors.phone}
                      hint="Nigerian and international numbers. Used for verification, never sold." />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input label="Password" required type="password" icon="lock" placeholder="At least 10 characters"
                        value={form.password} onChange={set('password')} error={errors.password} />
                      <Input label="Confirm password" required type="password" icon="lock"
                        value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
                    </div>
                  </div>

                  <Button type="submit" fullWidth size="lg" className="mt-6" iconRight="arrow-right">Continue</Button>
                  <p className="mt-3 text-center text-2xs text-ink-400">
                    By continuing you agree to our Terms and Privacy Notice (NDPA 2023).
                  </p>
                </form>
              )}

              {step === 'details' && (
                <form className="animate-fade-in" onSubmit={e => { e.preventDefault(); if (validateDetails()) setStep('verify') }}>
                  <button type="button" onClick={() => setStep('account')} className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
                    <Icon name="chevron-left" size={14} />Back
                  </button>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {type === 'club' ? 'Tell us about your club' : 'Tell us about you'}
                  </h1>
                  <p className="mt-1.5 text-sm text-ink-600">
                    {type === 'club' ? 'These details are checked during verification. Accuracy now saves time later.'
                                     : 'This seeds your CV. You can refine every attribute after signup.'}
                  </p>

                  <div className="mt-6 space-y-4">
                    {type === 'club' ? (
                      <>
                        <Input label="Official club name" required icon="building" placeholder="Rivers United FC"
                          value={form.clubName} onChange={set('clubName')} error={errors.clubName} />
                        <Input label="Short name / initials" placeholder="RIV" value={form.clubShort} onChange={set('clubShort')} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Select label="Country" value={form.country} onChange={set('country')}
                            options={[{ value: 'Nigeria', label: 'Nigeria' }, { value: 'Ghana', label: 'Ghana' }, { value: 'Other', label: 'Other' }]} />
                          <Select label="State / Region" required value={form.state} onChange={set('state')} error={errors.state}
                            options={[{ value: '', label: 'Select…' }, { value: 'Lagos', label: 'Lagos' }, { value: 'Rivers', label: 'Rivers' }, { value: 'Kano', label: 'Kano' }, { value: 'FCT - Abuja', label: 'FCT - Abuja' }, { value: 'Abia', label: 'Abia' }, { value: 'Other', label: 'Other' }]} />
                        </div>
                        <Select label="Primary competition" value={form.league} onChange={set('league')}
                          placeholder="Select…"
                          options={[
                            { value: 'npfl', label: 'NPFL' }, { value: 'nnl', label: 'NNL' },
                            { value: 'nlo', label: 'NLO' }, { value: 'nwfl', label: 'NWFL' },
                            { value: 'state_fa', label: 'State FA League' }, { value: 'academy', label: 'Academy / Grassroots' },
                          ]} />
                        <div className="rounded-xl border border-trust-200 bg-trust-50 p-3.5">
                          <p className="flex items-start gap-2 text-xs text-trust-800">
                            <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
                            Next you will add your CAC number and NFF or state FA affiliation.
                            Clubs that complete verification get far higher response rates from players.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Date of birth" required type="date" icon="calendar"
                            value={form.dob} onChange={set('dob')} error={errors.dob}
                            hint="Under 18 requires guardian consent" />
                          <Select label="Main position" required value={form.position} onChange={set('position')} error={errors.position}
                            placeholder="Select…"
                            options={['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF']
                              .map(p => ({ value: p, label: p }))} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Select label="Preferred foot" value={form.foot} onChange={set('foot')}
                            options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }, { value: 'both', label: 'Both' }]} />
                          <Input label="Height (cm)" type="number" placeholder="180" value={form.height} onChange={set('height')} />
                          <Input label="Weight (kg)" type="number" placeholder="75" value={form.weight} onChange={set('weight')} />
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                          <p className="flex items-start gap-2 text-xs text-blue-800">
                            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                            Players under 18 will be asked for a guardian's name and phone.
                            Every club message is copied to them, and no arrangement can be made
                            with a minor directly.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <Button type="submit" fullWidth size="lg" className="mt-6" iconRight="arrow-right">Continue</Button>
                </form>
              )}

              {step === 'verify' && (
                <div className="animate-fade-in">
                  <button type="button" onClick={() => setStep('details')} className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800">
                    <Icon name="chevron-left" size={14} />Back
                  </button>
                  <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
                  <p className="mt-1.5 text-sm text-ink-600">
                    You will start on a 14-day trial. No card required — you choose a plan
                    before the trial ends.
                  </p>

                  <div className="mt-5 space-y-2.5 rounded-xl border border-ink-100 bg-ink-50/70 p-4">
                    {[
                      { icon: 'check' as IconName, t: 'Full access for 14 days', d: 'Every feature, every dashboard.' },
                      { icon: 'card' as IconName, t: 'No card required today', d: 'Add billing when you are ready.' },
                      { icon: 'shield' as IconName, t: 'Cancel anytime', d: 'One click, no phone calls.' },
                    ].map(x => (
                      <div key={x.t} className="flex items-start gap-2.5">
                        <Icon name={x.icon} size={15} className="mt-0.5 shrink-0 text-trust-600" />
                        <div>
                          <p className="text-xs font-bold text-ink-900">{x.t}</p>
                          <p className="text-2xs text-ink-500">{x.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {errors.email && (
                    <p className="mt-3 text-xs font-medium text-red-600">{errors.email}</p>
                  )}

                  <Button fullWidth size="lg" className="mt-6" loading={loading} onClick={submit} iconRight="arrow-right">
                    Create account
                  </Button>
                  <p className="mt-3 text-center text-2xs text-ink-400">
                    We will email a confirmation link to <strong>{form.email || 'your address'}</strong>.
                  </p>
                </div>
              )}
            </Card>

            <div className="mt-5 flex items-center justify-center gap-2">
              <Badge tone="trust" icon="lock">NDPA 2023 compliant</Badge>
              <Badge tone="neutral" icon="shield">FIFA Art.19 aligned</Badge>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
