import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Icon, Input, Badge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/layout/Logo'
import { DEMO_MODE_ENABLED } from '@/context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, demoLogin } = useAuth()
  const nav = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error); return }
    nav('/app')
  }

  const demo = (role: 'player' | 'club' | 'admin') => {
    demoLogin(role)
    nav('/app')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/"><Logo size={28} wordmark /></Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-ink-600">Sign in to your FutWeb workspace.</p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  <Icon name="alert" size={15} className="shrink-0" />{error}
                </div>
              )}
              <Input label="Email" type="email" required icon="mail" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              <Input label="Password" type={show ? 'text' : 'password'} required icon="lock"
                placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                suffix={
                  <button type="button" onClick={() => setShow(s => !s)} className="text-ink-400 hover:text-ink-700">
                    <Icon name={show ? 'eye-off' : 'eye'} size={16} />
                  </button>
                } />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-ink-300 text-red-500 focus:ring-red-500" />
                  Keep me signed in
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-red-600 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" fullWidth size="lg" loading={loading} iconRight="arrow-right">Sign in</Button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-600">
              New to FutWeb?{' '}
              <Link to="/register" className="font-semibold text-red-600 hover:underline">Create an account</Link>
            </p>

            {DEMO_MODE_ENABLED && (
              <div className="mt-8 rounded-2xl border border-dashed border-ink-200 bg-ink-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Badge tone="gold" size="sm">Demo mode</Badge>
                  <span className="text-2xs text-ink-500">No database connected — explore instantly</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {([
                    ['player', 'Explore player dashboard', 'user'],
                    ['club', 'Explore club dashboard', 'building'],
                    ['admin', 'Explore admin console', 'shield'],
                  ] as const).map(([role, label, icon]) => (
                    <button key={role} onClick={() => demo(role)}
                      className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-ink-700 transition-all hover:border-red-300 hover:text-red-600">
                      <Icon name={icon} size={15} />
                      {label}
                      <Icon name="arrow-right" size={14} className="ml-auto" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pitch panel */}
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div className="absolute inset-0 bg-pitch bg-pitch opacity-60" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-red-600/25 blur-[110px]" />
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-trust-500/12 blur-[100px]" />

        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-balance text-3xl font-extrabold leading-tight tracking-tight">
            Every player deserves to be findable. Every club deserves to know who is real.
          </h2>
          <div className="mt-8 space-y-4">
            {[
              { t: 'Zero-fee trial guarantee', d: 'Clubs may never charge a player for a trial. Enforced in the product.' },
              { t: 'Eight-point verification', d: 'CAC, NFF affiliation, NIN/BVN, liveness and references — all visible.' },
              { t: 'Offline scouting capture', d: 'Rate players with no signal. Sync happens when you reconnect.' },
            ].map(x => (
              <div key={x.t} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-trust-400/20 text-trust-300">
                  <Icon name="check" size={13} />
                </span>
                <div>
                  <p className="text-sm font-bold">{x.t}</p>
                  <p className="text-xs text-ink-400">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
