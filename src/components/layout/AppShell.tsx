import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { Avatar, Icon, Tooltip, type IconName } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useOffline } from '@/context/OfflineContext'
import { supabase, hasSupabase } from '@/lib/supabase'
import { NAV_BY_ROLE } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Link as RLink } from 'react-router-dom'

function OfflineBanner() {
  const { online, pending, syncing, syncNow } = useOffline()
  const unsynced = pending.filter(p => !p.synced).length

  if (online && unsynced === 0) return null
  return (
    <div className={cn('flex items-center gap-2.5 px-4 py-2 text-xs font-semibold',
      online ? 'bg-gold-100 text-gold-700' : 'bg-ink-900 text-white')}>
      <Icon name={online ? 'refresh' : 'offline'} size={14} className={cn(syncing && 'animate-spin')} />
      {!online ? (
        <span>You are offline. Anything you enter is saved on this device and syncs automatically.</span>
      ) : (
        <>
          <span>{unsynced} record{unsynced === 1 ? '' : 's'} captured offline, ready to sync.</span>
          <button onClick={syncNow} disabled={syncing}
            className="ml-auto rounded-lg bg-ink-900 px-2.5 py-1 text-white hover:bg-ink-850 disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </>
      )}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const role = user?.role === 'admin' ? 'admin' : user?.accountType === 'club' ? 'club' : 'player'
  const items = NAV_BY_ROLE[role] as unknown as { label: string; to: string; icon: string }[]

  return (
    <div className="flex h-full flex-col bg-ink-900 text-ink-200">
      <div className="flex h-[60px] items-center px-5">
        <Link to="/" onClick={onNavigate}><Logo size={28} wordmark tone="light" /></Link>
      </div>

      <nav className="fw-scroll on-dark flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/club' || item.to === '/player' || item.to === '/admin'}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
              isActive ? 'bg-red-500 text-white shadow-glow-red' : 'text-ink-300 hover:bg-white/5 hover:text-white')}>
            {({ isActive }) => (
              <>
                <Icon name={item.icon as IconName} size={17} className={cn(isActive ? 'text-white' : 'text-ink-400 group-hover:text-ink-200')} />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <TrialMeter />
      </div>
    </div>
  )
}

function TrialMeter() {
  const { user } = useAuth()
  if (!user || user.role === 'admin') return null
  if (user.subStatus === 'active') {
    return (
      <div className="rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-2">
          <Icon name="check-circle" size={15} className="text-trust-400" />
          <span className="text-xs font-bold text-white">Active subscription</span>
        </div>
        <p className="mt-1 text-2xs text-ink-400">{user.planCode?.replace(/_/g, ' ')}</p>
      </div>
    )
  }
  if (user.subStatus === 'trialing' && user.trialEndsAt) {
    const days = Math.max(0, Math.ceil((+new Date(user.trialEndsAt) - Date.now()) / 86400000))
    return (
      <RLink to="/billing"
        className="block rounded-xl border border-gold-400/30 bg-gold-400/10 p-3 transition-colors hover:bg-gold-400/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-gold-300">Free trial</span>
          <span className="tnum text-xs font-bold text-white">{days}d left</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gold-400" style={{ width: `${(days / 14) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-2xs text-gold-200/70">Subscribe to keep full access →</p>
      </RLink>
    )
  }
  return (
    <RLink to="/billing" className="block rounded-xl bg-red-500 p-3 text-center text-xs font-bold text-white hover:bg-red-600">
      Subscription expired — renew
    </RLink>
  )
}

interface NotifRow {
  id: string; kind: string; title: string; body: string | null; link: string | null
  read_at: string | null; created_at: string
}

function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifRow[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!hasSupabase || !supabase || !user) { setUnread(0); return () => { cancelled = true } }
    ;(async () => {
      try {
        const { data } = await supabase.from('notifications').select('id').eq('user_id', user.id).is('read_at', null)
        if (!cancelled) setUnread(data?.length ?? 0)
      } catch { /* non-fatal */ }
    })()
    return () => { cancelled = true }
  }, [user])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || !supabase || !user) return
    setLoading(true)
    try {
      const { data } = await supabase.from('notifications')
        .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      setItems((data ?? []) as NotifRow[])
      if (data?.length) {
        const unreadIds = data.filter(n => !n.read_at).map(n => n.id)
        if (unreadIds.length) {
          await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
          setUnread(0)
        }
      }
    } catch { /* non-fatal */ } finally { setLoading(false) }
  }

  return (
    <div className="relative">
      <button onClick={() => void toggle()} className="relative rounded-lg p-2 text-ink-500 hover:bg-ink-100">
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-hover">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
              <p className="text-sm font-bold text-ink-900">Notifications</p>
              {loading && <span className="text-2xs text-ink-400">Loading…</span>}
            </div>
            <div className="fw-scroll max-h-[340px] overflow-y-auto p-1.5">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-ink-400">You’re all caught up.</p>
              ) : items.map(n => (
                <div key={n.id} className="rounded-lg px-3 py-2.5 hover:bg-ink-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ink-900">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-ink-400">{formatDate(n.created_at, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-2xs leading-relaxed text-ink-600">{n.body}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, signOut } = useAuth()
  const { online } = useOffline()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur-md">
      <button onClick={onMenu} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden">
        <Icon name="menu" size={19} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink-400">
          {user?.accountType === 'club' ? user.clubName : 'Player workspace'}
        </p>
      </div>

      <Tooltip content={online ? 'Connected' : 'Offline — entries are saved locally'}>
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg',
          online ? 'text-trust-600' : 'bg-ink-100 text-ink-500')}>
          <Icon name={online ? 'online' : 'offline'} size={16} />
        </span>
      </Tooltip>

      <NotificationsBell />

      <div className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-ink-100">
          <Avatar name={user?.fullName ?? '?'} size={30} />
          <Icon name="chevron-down" size={14} className="text-ink-400" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 z-50 w-56 animate-scale-in overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-hover">
              <div className="border-b border-ink-100 px-3.5 py-3">
                <p className="truncate text-sm font-bold text-ink-900">{user?.fullName}</p>
                <p className="truncate text-xs text-ink-500">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button onClick={() => { setOpen(false); nav('/settings') }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-700 hover:bg-ink-100">
                  <Icon name="settings" size={15} />Settings
                </button>
                <button onClick={async () => { setOpen(false); await signOut(); nav('/') }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Icon name="logout" size={15} />Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <div className="flex min-h-screen bg-ink-50/60">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/50" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-[270px] animate-slide-in-right shadow-2xl">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <OfflineBanner />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1240px] animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
