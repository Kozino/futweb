import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { Toaster } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import type { ReactNode } from 'react'

/* Public */
import Landing from '@/pages/public/Landing'
import Pricing from '@/pages/public/Pricing'
import ForPlayers from '@/pages/public/ForPlayers'
import ForClubs from '@/pages/public/ForClubs'
import TrustPage from '@/pages/public/Trust'
import Ratings from '@/pages/public/Ratings'
import About from '@/pages/public/About'
import Contact from '@/pages/public/Contact'
import Report from '@/pages/public/Report'
import TalentDirectory from '@/pages/public/TalentDirectory'
import PlayerPublicProfile from '@/pages/public/PlayerPublicProfile'
import ClubPublicProfile from '@/pages/public/ClubPublicProfile'

/* Auth */
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import { Paywall } from '@/pages/auth/Paywall'

/* Player */
import PlayerDashboard from '@/pages/player/Dashboard'
import PlayerProfile from '@/pages/player/Profile'
import PlayerAttributes from '@/pages/player/Attributes'
import PlayerStats from '@/pages/player/Stats'
import PlayerMedia from '@/pages/player/Media'
import PlayerTrials from '@/pages/player/Trials'
import PlayerVerify from '@/pages/player/Verify'

/* Club */
import ClubDashboard from '@/pages/club/Dashboard'
import Squad from '@/pages/club/Squad'
import Discovery from '@/pages/club/Discovery'
import Shortlists from '@/pages/club/Shortlists'
import ClubTrials from '@/pages/club/Trials'
import ClubReports from '@/pages/club/Reports'
import Staff from '@/pages/club/Staff'
import PlayerDetail from '@/pages/club/PlayerDetail'

/* Admin */
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminClubs from '@/pages/admin/Clubs'
import AdminPlayers from '@/pages/admin/Players'
import Verification from '@/pages/admin/Verification'
import Subscriptions from '@/pages/admin/Subscriptions'
import Disputes from '@/pages/admin/Disputes'
import Audit from '@/pages/admin/Audit'

import Billing from '@/pages/billing/Billing'
import Settings from '@/pages/Settings'

/* ------------------------------------------------------------------ *
 * Route guards
 * ------------------------------------------------------------------ */

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}

/** The subscription gate. Access to product surfaces requires an active,
 *  trialling or grace subscription — this is enforced server-side by RLS too;
 *  this guard is the UX layer, not the security boundary. */
function RequireSubscription({ children }: { children: ReactNode }) {
  const { user, hasAccess } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!hasAccess) return <AppShellRoute><Paywall reason={user.subStatus === 'expired' || user.subStatus === 'cancelled' ? 'expired' : 'subscription'} /></AppShellRoute>
  return <>{children}</>
}

function RequireRole({ role, children }: { role: 'admin' | 'club' | 'player'; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const isAdmin = user.role === 'admin'
  const isClub = user.role === 'admin' || user.accountType === 'club'
  const allowed =
    role === 'admin' ? isAdmin :
    role === 'club' ? isClub :
    user.accountType === 'player' || isAdmin
  if (!allowed) return <Navigate to="/app" replace />
  return <>{children}</>
}

/** Wraps content in the app chrome without re-nesting routes. */
function AppShellRoute({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="*" element={<>{children}</>} />
      </Route>
    </Routes>
  )
}

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50/60">
      <div className="w-full max-w-md space-y-3 px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

function SmartRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!user.onboardingComplete) {
    return <Navigate to={user.accountType === 'club' ? '/onboarding/club' : '/onboarding/player'} replace />
  }
  return <Navigate to={user.role === 'admin' ? '/admin' : user.accountType === 'club' ? '/club' : '/player'} replace />
}

/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <>
      <Routes>
        {/* ---- Public marketing site ---- */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/for-players" element={<ForPlayers />} />
          <Route path="/for-clubs" element={<ForClubs />} />
          <Route path="/trust" element={<TrustPage />} />
          <Route path="/ratings" element={<Ratings />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/report" element={<Report />} />
          <Route path="/players" element={<TalentDirectory />} />
          <Route path="/players/:slug" element={<PlayerPublicProfile />} />
          <Route path="/clubs" element={<TalentDirectory />} />
          <Route path="/clubs/:slug" element={<ClubPublicProfile />} />
        </Route>

        {/* ---- Auth ---- */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<SmartRedirect />} />
        <Route path="/app" element={<SmartRedirect />} />

        {/* ---- Onboarding (authenticated, pre-subscription) ---- */}
        <Route path="/onboarding/:type" element={
          <RequireAuth><AppShellRoute><Onboarding /></AppShellRoute></RequireAuth>
        } />

        {/* ---- Player workspace ---- */}
        <Route element={<AppShell />}>
          <Route path="/player" element={<RequireAuth><RequireSubscription><PlayerDashboard /></RequireSubscription></RequireAuth>} />
          <Route path="/player/profile" element={<RequireAuth><RequireSubscription><PlayerProfile /></RequireSubscription></RequireAuth>} />
          <Route path="/player/attributes" element={<RequireAuth><RequireSubscription><PlayerAttributes /></RequireSubscription></RequireAuth>} />
          <Route path="/player/stats" element={<RequireAuth><RequireSubscription><PlayerStats /></RequireSubscription></RequireAuth>} />
          <Route path="/player/media" element={<RequireAuth><RequireSubscription><PlayerMedia /></RequireSubscription></RequireAuth>} />
          <Route path="/player/trials" element={<RequireAuth><RequireSubscription><PlayerTrials /></RequireSubscription></RequireAuth>} />
          <Route path="/player/verify" element={<RequireAuth><RequireSubscription><PlayerVerify /></RequireSubscription></RequireAuth>} />

          {/* ---- Club workspace ---- */}
          <Route path="/club" element={<RequireAuth><RequireRole role="club"><RequireSubscription><ClubDashboard /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/squad" element={<RequireAuth><RequireRole role="club"><RequireSubscription><Squad /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/discovery" element={<RequireAuth><RequireRole role="club"><RequireSubscription><Discovery /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/player/:id" element={<RequireAuth><RequireRole role="club"><RequireSubscription><PlayerDetail /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/shortlists" element={<RequireAuth><RequireRole role="club"><RequireSubscription><Shortlists /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/trials" element={<RequireAuth><RequireRole role="club"><RequireSubscription><ClubTrials /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/reports" element={<RequireAuth><RequireRole role="club"><RequireSubscription><ClubReports /></RequireSubscription></RequireRole></RequireAuth>} />
          <Route path="/club/staff" element={<RequireAuth><RequireRole role="club"><RequireSubscription><Staff /></RequireSubscription></RequireRole></RequireAuth>} />

          {/* ---- Admin console ---- */}
          <Route path="/admin" element={<RequireAuth><RequireRole role="admin"><AdminDashboard /></RequireRole></RequireAuth>} />
          <Route path="/admin/clubs" element={<RequireAuth><RequireRole role="admin"><AdminClubs /></RequireRole></RequireAuth>} />
          <Route path="/admin/players" element={<RequireAuth><RequireRole role="admin"><AdminPlayers /></RequireRole></RequireAuth>} />
          <Route path="/admin/verification" element={<RequireAuth><RequireRole role="admin"><Verification /></RequireRole></RequireAuth>} />
          <Route path="/admin/subscriptions" element={<RequireAuth><RequireRole role="admin"><Subscriptions /></RequireRole></RequireAuth>} />
          <Route path="/admin/disputes" element={<RequireAuth><RequireRole role="admin"><Disputes /></RequireRole></RequireAuth>} />
          <Route path="/admin/audit" element={<RequireAuth><RequireRole role="admin"><Audit /></RequireRole></RequireAuth>} />

          {/* ---- Account ---- */}
          <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><Billing /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

/* Small inline onboarding so the post-registration step is real, not a stub. */
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Icon, ProgressBar } from '@/components/ui'
import { useState as useOnbState } from 'react'

function Onboarding() {
  const { type } = useParams()
  const nav = useNavigate()
  const { updateUser } = useAuth()
  const [step, setStep] = useOnbState(0)
  const isClub = type === 'club'

  const steps = isClub
    ? ['Club details', 'Verification', 'Invite staff', 'Choose a plan']
    : ['Your position', 'Add video', 'Verify identity', 'Choose a plan']

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-400">
          {steps.map((s, i) => <span key={s} className={i <= step ? 'text-red-600' : ''}>{s}</span>)}
        </div>
        <ProgressBar className="mt-2" value={((step + 1) / steps.length) * 100} />
      </div>

      <Card className="p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-500">
          <Icon name={isClub ? 'building' : 'user'} size={26} />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{steps[step]}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
          {step === 0 && (isClub
            ? 'Confirm your CAC number and NFF or state FA affiliation. Clubs that complete this get far more replies from players.'
            : 'Confirm your main position and physical profile. These drive your position-fit scoring.')}
          {step === 1 && (isClub
            ? 'Upload your registration documents. Our team reviews them, usually within one working day.'
            : 'A highlight reel is the most persuasive thing on your CV. Even 60 seconds of good footage helps.')}
          {step === 2 && (isClub
            ? 'Invite coaches and scouts. Each gets scoped access, and every action is attributed to them.'
            : 'Verify with NIN, BVN or passport plus a short liveness check. Verified players get materially more club views.')}
          {step === 3 && 'Pick a plan. You are on a 14-day trial, and nothing is charged until you subscribe.'}
        </p>

        <div className="mt-7 flex justify-center gap-3">
          {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
          {step < steps.length - 1
            ? <Button iconRight="arrow-right" onClick={() => setStep(s => s + 1)}>Continue</Button>
            : <Button iconRight="arrow-right" onClick={() => {
                updateUser({ onboardingComplete: true })
                nav(isClub ? '/club' : '/player')
              }}>Go to my dashboard</Button>}
        </div>
        <button onClick={() => { updateUser({ onboardingComplete: true }); nav(isClub ? '/club' : '/player') }}
          className="mt-4 text-xs font-semibold text-ink-400 hover:text-ink-700">
          Skip for now
        </button>
      </Card>
    </div>
  )
}
