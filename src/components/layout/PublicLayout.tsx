import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { Button, Icon } from '@/components/ui'
import { DEMO_MODE_ENABLED, useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const LINKS = [
  { label: 'For Players', to: '/for-players' },
  { label: 'For Clubs', to: '/for-clubs' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Trust & Safety', to: '/trust' },
  { label: 'Find Talent', to: '/players' },
]

export function PublicLayout() {
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { setMenu(false) }, [pathname])

  const dashboard = user?.role === 'admin' ? '/admin' : user?.accountType === 'club' ? '/club' : '/player'

  return (
    <div className="min-h-screen bg-white">
      <header className={cn('sticky top-0 z-40 transition-all duration-200',
        scrolled ? 'border-b border-ink-100 bg-white/92 backdrop-blur-md' : 'bg-transparent')}>
        <div className="fw-container flex h-16 items-center gap-6">
          <Link to="/"><Logo size={30} wordmark /></Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {LINKS.map(l => (
              <Link key={l.to} to={l.to}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <Button size="sm" onClick={() => window.location.assign(dashboard)} iconRight="arrow-right">
                Go to dashboard
              </Button>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" iconRight="arrow-right">Get started</Button>
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setMenu(m => !m)} className="ml-auto rounded-lg p-2 hover:bg-ink-100 md:hidden">
            <Icon name={menu ? 'x' : 'menu'} size={20} />
          </button>
        </div>

        {menu && (
          <div className="animate-fade-in border-t border-ink-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col">
              {LINKS.map(l => (
                <Link key={l.to} to={l.to} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3">
              <Link to="/login"><Button variant="outline" fullWidth size="sm">Sign in</Button></Link>
              <Link to="/register"><Button fullWidth size="sm">Get started</Button></Link>
            </div>
          </div>
        )}
      </header>

      <Outlet />

      <footer className="border-t border-ink-100 bg-ink-900 text-ink-300">
        <div className="fw-container py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Logo size={32} wordmark tone="light" />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
                Africa-native football intelligence. Verified identities, digital CVs,
                and offline scouting for clubs and players who were never meant to be
                invisible.
              </p>
              <div className="mt-4 flex gap-2">
                {['Lagos', 'Abuja', 'Port Harcourt', 'Kano'].map(c => (
                  <span key={c} className="rounded-full bg-white/5 px-2.5 py-1 text-2xs font-semibold text-ink-400">{c}</span>
                ))}
              </div>
            </div>
            {[
              { title: 'Product', links: [['For Players', '/for-players'], ['For Clubs', '/for-clubs'], ['Pricing', '/pricing'], ['Attribute Model', '/ratings']] },
              { title: 'Trust', links: [['Trust & Safety', '/trust'], ['Verification', '/trust#verification'], ['Report a Scam', '/report'], ['Minor Protection', '/trust#minors']] },
              { title: 'Company', links: [['About', '/about'], ['Careers', '/about#careers'], ['Contact', '/contact'], ['Status', '/about#status']] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-bold uppercase tracking-widest text-white">{col.title}</h4>
                <ul className="mt-3 space-y-2">
                  {col.links.map(([label, to]) => (
                    <li key={to}>
                      <Link to={to} className="text-sm text-ink-400 transition-colors hover:text-white">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} FutWeb Technologies. Built in Nigeria, for the game.</p>
            <div className="flex flex-wrap items-center gap-4">
              <span>NDPA 2023 compliant</span>
              <span>·</span>
              <span>FIFA Art.19 aligned</span>
              <span>·</span>
              {DEMO_MODE_ENABLED && <span className="rounded bg-gold-400/15 px-1.5 py-0.5 font-semibold text-gold-300">Demo mode</span>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
