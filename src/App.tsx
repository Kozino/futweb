import { useEffect, useState, type ReactNode } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { PublicLayout } from '@/components/layout/PublicLayout'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { Toaster, Skeleton, Button, Card, Icon, ProgressBar, Input } from '@/components/ui'

import { completePlayerOnboarding } from '@/lib/supabase/players'
import { supabase, DEMO_MODE } from '@/lib/supabase'

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

/* Account */
import Billing from '@/pages/billing/Billing'
import Settings from '@/pages/Settings'


/* ------------------------------------------------------------------ *
 * Route guards
 * ------------------------------------------------------------------ */

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()

  if (loading) return <FullPageLoader />

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: loc.pathname }}
        replace
      />
    )
  }

  return <>{children}</>
}


/**
 * Subscription gate.
 *
 * This is only the UX layer.
 * Supabase RLS remains the actual security boundary.
 */
function RequireSubscription({ children }: { children: ReactNode }) {
  const { user, hasAccess } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!hasAccess) {
    return (
      <AppShellRoute>
        <Paywall
          reason={
            user.subStatus === 'expired' ||
            user.subStatus === 'cancelled'
              ? 'expired'
              : 'subscription'
          }
        />
      </AppShellRoute>
    )
  }

  return <>{children}</>
}


function RequireRole({
  role,
  children,
}: {
  role: 'admin' | 'club' | 'player'
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = user.role === 'admin'
  const isClub =
    user.role === 'admin' ||
    user.accountType === 'club'

  const allowed =
    role === 'admin'
      ? isAdmin
      : role === 'club'
        ? isClub
        : user.accountType === 'player' || isAdmin

  if (!allowed) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}


/**
 * Wrap content in the application shell without nesting
 * the main application routes themselves.
 */
function AppShellRoute({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="*"
          element={<>{children}</>}
        />
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


/* ------------------------------------------------------------------ *
 * Smart redirect
 * ------------------------------------------------------------------ */

function SmartRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullPageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.onboardingComplete) {
    return (
      <Navigate
        to={
          user.accountType === 'club'
            ? '/onboarding/club'
            : '/onboarding/player'
        }
        replace
      />
    )
  }

  return (
    <Navigate
      to={
        user.role === 'admin'
          ? '/admin'
          : user.accountType === 'club'
            ? '/club'
            : '/player'
      }
      replace
    />
  )
}


/* ------------------------------------------------------------------ *
 * Real player onboarding
 * ------------------------------------------------------------------ */

function Onboarding() {
  const { type } = useParams()
  const nav = useNavigate()
  const { user, updateUser } = useAuth()

  const isClub = type === 'club'

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [playerData, setPlayerData] = useState<{
    dob: string
    position: string
    foot: 'left' | 'right' | 'both'
    height: string
    weight: string
    nationality: string
    stateOfOrigin: string
  } | null>(null)

  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianConsent, setGuardianConsent] = useState(false)

  const steps = isClub
    ? [
        'Club details',
        'Verification',
        'Invite staff',
        'Choose a plan',
      ]
    : [
        'Your position',
        'Add video',
        'Verify identity',
        'Choose a plan',
      ]


  /* -------------------------------------------------------------- *
   * Load player registration data from Supabase Auth metadata
   * -------------------------------------------------------------- */

  useEffect(() => {
    if (isClub || DEMO_MODE || !supabase) {
      return
    }

    let cancelled = false

    async function loadRegistrationData() {
      const { data, error: authError } =
        await supabase!.auth.getUser()

      if (cancelled) {
        return
      }

      if (authError || !data.user) {
        setError(
          'Your authentication session could not be loaded. Please sign in again.',
        )
        return
      }

      const metadata = data.user.user_metadata ?? {}
      const details = metadata.player_details

      if (!details) {
        setError(
          'Your player registration details were not found. Please return to registration and try again.',
        )
        return
      }

      setPlayerData({
        dob: details.dob ?? '',
        position: details.position ?? '',
        foot:
          details.foot === 'left' ||
          details.foot === 'both'
            ? details.foot
            : 'right',
        height: details.height ?? '',
        weight: details.weight ?? '',
        nationality:
          details.nationality ?? 'Nigeria',
        stateOfOrigin:
          details.stateOfOrigin ?? '',
      })
    }

    void loadRegistrationData()

    return () => {
      cancelled = true
    }
  }, [isClub])


  /* -------------------------------------------------------------- *
   * Determine minor status in the UI.
   *
   * The database remains authoritative.
   * This is only for showing guardian fields before submission.
   * -------------------------------------------------------------- */

  const isMinor = Boolean(
    playerData?.dob &&
      new Date(playerData.dob) >
        new Date(
          new Date().setFullYear(
            new Date().getFullYear() - 18,
          ),
        ),
  )


  /* -------------------------------------------------------------- *
   * Complete real player onboarding
   * -------------------------------------------------------------- */

  async function finishPlayerOnboarding() {
    if (!user) {
      return
    }

    /* Demo Mode keeps its existing local behaviour. */
    if (DEMO_MODE || !supabase) {
      updateUser({
        onboardingComplete: true,
      })

      nav('/player')
      return
    }

    if (!playerData) {
      setError(
        'Your player details are not available. Please return to registration.',
      )
      return
    }

    if (!playerData.dob) {
      setError('Date of birth is required.')
      return
    }

    if (!playerData.position.trim()) {
      setError('Primary position is required.')
      return
    }

    if (isMinor && !guardianName.trim()) {
      setError(
        'Guardian name is required for players under 18.',
      )
      return
    }

    if (isMinor && !guardianConsent) {
      setError(
        'Guardian consent is required for players under 18.',
      )
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nameParts = user.fullName
        .trim()
        .split(/\s+/)

      const firstName =
        nameParts[0] || user.fullName

      const lastName =
        nameParts.slice(1).join(' ') ||
        user.fullName

      const created =
        await completePlayerOnboarding({
          firstName,
          lastName,
          dob: playerData.dob,
          positionPrimary:
            playerData.position,
          foot: playerData.foot,
          heightCm:
            playerData.height
              ? Number(playerData.height)
              : null,
          weightKg:
            playerData.weight
              ? Number(playerData.weight)
              : null,
          nationality:
            playerData.nationality,
          stateOfOrigin:
            playerData.stateOfOrigin || null,

          guardianName:
            isMinor
              ? guardianName.trim()
              : null,

          guardianPhone:
            isMinor
              ? guardianPhone.trim() || null
              : null,

          guardianEmail:
            isMinor
              ? guardianEmail.trim() || null
              : null,

         guardianConsent: isMinor
  ? guardianConsent
  : false,
        })

      if (!created) {
        throw new Error(
          'Player profile could not be created.',
        )
      }

      updateUser({
        onboardingComplete: true,
        playerId: created.id,
      })

      nav('/player')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete onboarding.',
      )
    } finally {
      setSaving(false)
    }
  }


  function finish() {
    if (isClub) {
      /*
       * Club onboarding will be converted to the real
       * clubs/org_members flow in the club data-layer batch.
       */
      updateUser({
        onboardingComplete: true,
      })

      nav('/club')
      return
    }

    void finishPlayerOnboarding()
  }


  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-ink-400">
          {steps.map((stepName, index) => (
            <span
              key={stepName}
              className={
                index <= step
                  ? 'text-red-600'
                  : ''
              }
            >
              {stepName}
            </span>
          ))}
        </div>

        <ProgressBar
          className="mt-2"
          value={
            ((step + 1) / steps.length) *
            100
          }
        />
      </div>


      <Card className="p-8">
        {/* Header */}
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-500">
            <Icon
              name={
                isClub
                  ? 'building'
                  : 'user'
              }
              size={26}
            />
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {steps[step]}
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
            {step === 0 &&
              (isClub
                ? 'Confirm your club details and continue to verification.'
                : 'Your registration details are ready. We will create your real FutWeb player profile when onboarding is complete.')}

            {step === 1 &&
              (isClub
                ? 'Upload your registration documents during verification.'
                : 'Add your best football footage after your player profile has been created.')}

            {step === 2 &&
              (isClub
                ? 'Invite coaches and scouts with scoped access.'
                : 'Identity verification can be completed after your player profile is created.')}

            {step === 3 &&
              'Your account is ready. Continue to your FutWeb dashboard.'}
          </p>
        </div>


        {/* Player registration details */}
        {!isClub &&
          step === 0 &&
          playerData && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">
                  Registration details
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-2xs text-ink-400">
                      Position
                    </p>
                    <p className="text-sm font-bold">
                      {playerData.position}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs text-ink-400">
                      Date of birth
                    </p>
                    <p className="text-sm font-bold">
                      {playerData.dob}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs text-ink-400">
                      Preferred foot
                    </p>
                    <p className="text-sm font-bold capitalize">
                      {playerData.foot}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs text-ink-400">
                      Height
                    </p>
                    <p className="text-sm font-bold">
                      {playerData.height
                        ? `${playerData.height} cm`
                        : '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs text-ink-400">
                      Weight
                    </p>
                    <p className="text-sm font-bold">
                      {playerData.weight
                        ? `${playerData.weight} kg`
                        : '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs text-ink-400">
                      Nationality
                    </p>
                    <p className="text-sm font-bold">
                      {playerData.nationality}
                    </p>
                  </div>
                </div>
              </div>


              {/* Guardian section */}
              {isMinor && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-900">
                    Guardian information required
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-blue-800">
                    Players under 18 need guardian
                    information and consent before their
                    profile can be created.
                  </p>

                  <div className="mt-4 space-y-3">
                    <Input
                      label="Guardian name"
                      required
                      value={guardianName}
                      onChange={event => {
                        setGuardianName(
                          event.target.value,
                        )
                        setError(null)
                      }}
                    />

                    <Input
                      label="Guardian phone"
                      value={guardianPhone}
                      onChange={event =>
                        setGuardianPhone(
                          event.target.value,
                        )
                      }
                    />

                    <Input
                      label="Guardian email"
                      type="email"
                      value={guardianEmail}
                      onChange={event =>
                        setGuardianEmail(
                          event.target.value,
                        )
                      }
                    />

                    <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-white p-3">
                      <input
                        type="checkbox"
                        checked={guardianConsent}
                        onChange={event => {
                          setGuardianConsent(
                            event.target.checked,
                          )
                          setError(null)
                        }}
                        className="mt-0.5"
                      />

                      <span className="text-xs leading-relaxed text-ink-700">
                        I confirm that the guardian has
                        provided consent for this player
                        to use FutWeb.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}


        {/* Loading registration data */}
        {!isClub &&
          step === 0 &&
          !playerData &&
          !error && (
            <div className="mt-6 rounded-xl bg-ink-50 p-5 text-center">
              <p className="text-sm text-ink-500">
                Loading your registration details…
              </p>
            </div>
          )}


        {/* Error */}
        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5">
            <p className="text-xs font-semibold leading-relaxed text-red-700">
              {error}
            </p>
          </div>
        )}


        {/* Navigation */}
        <div className="mt-7 flex justify-center gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setError(null)
                setStep(current => current - 1)
              }}
            >
              Back
            </Button>
          )}

          {step < steps.length - 1 ? (
            <Button
              iconRight="arrow-right"
              onClick={() => {
                setError(null)
                setStep(current => current + 1)
              }}
              disabled={
                !isClub &&
                step === 0 &&
                !playerData
              }
            >
              Continue
            </Button>
          ) : (
            <Button
              iconRight="arrow-right"
              loading={saving}
              onClick={finish}
            >
              Go to my dashboard
            </Button>
          )}
        </div>


        {/* Finish immediately */}
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setError(null)

            if (isClub) {
              updateUser({
                onboardingComplete: true,
              })

              nav('/club')
              return
            }

            void finishPlayerOnboarding()
          }}
          className="mt-4 block w-full text-xs font-semibold text-ink-400 hover:text-ink-700 disabled:opacity-50"
        >
          {isClub
            ? 'Skip for now'
            : 'Finish player setup'}
        </button>
      </Card>
    </div>
  )
}


/* ------------------------------------------------------------------ *
 * Application
 * ------------------------------------------------------------------ */

export default function App() {
  return (
    <>
      <Routes>
        {/* ---------------------------------------------------------- *
         * Public marketing site
         * ---------------------------------------------------------- */}

        <Route element={<PublicLayout />}>
          <Route
            path="/"
            element={<Landing />}
          />

          <Route
            path="/pricing"
            element={<Pricing />}
          />

          <Route
            path="/for-players"
            element={<ForPlayers />}
          />

          <Route
            path="/for-clubs"
            element={<ForClubs />}
          />

          <Route
            path="/trust"
            element={<TrustPage />}
          />

          <Route
            path="/ratings"
            element={<Ratings />}
          />

          <Route
            path="/about"
            element={<About />}
          />

          <Route
            path="/contact"
            element={<Contact />}
          />

          <Route
            path="/report"
            element={<Report />}
          />

          <Route
            path="/players"
            element={<TalentDirectory />}
          />

          <Route
            path="/players/:slug"
            element={<PlayerPublicProfile />}
          />

          <Route
            path="/clubs"
            element={<TalentDirectory />}
          />

          <Route
            path="/clubs/:slug"
            element={<ClubPublicProfile />}
          />
        </Route>


        {/* ---------------------------------------------------------- *
         * Authentication
         * ---------------------------------------------------------- */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/forgot-password"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
          path="/auth/callback"
          element={<SmartRedirect />}
        />

        <Route
          path="/app"
          element={<SmartRedirect />}
        />


        {/* ---------------------------------------------------------- *
         * Onboarding
         * ---------------------------------------------------------- */}

        <Route
          path="/onboarding/:type"
          element={
            <RequireAuth>
              <AppShellRoute>
                <Onboarding />
              </AppShellRoute>
            </RequireAuth>
          }
        />


        {/* ---------------------------------------------------------- *
         * Application workspace
         * ---------------------------------------------------------- */}

        <Route element={<AppShell />}>
          {/* Player */}

          <Route
            path="/player"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerDashboard />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/profile"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerProfile />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/attributes"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerAttributes />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/stats"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerStats />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/media"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerMedia />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/trials"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerTrials />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/player/verify"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <PlayerVerify />
                </RequireSubscription>
              </RequireAuth>
            }
          />


          {/* Club */}

          <Route
            path="/club"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <ClubDashboard />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/squad"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <Squad />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/discovery"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <Discovery />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/player/:id"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <PlayerDetail />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/shortlists"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <Shortlists />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/trials"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <ClubTrials />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/reports"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <ClubReports />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/club/staff"
            element={
              <RequireAuth>
                <RequireRole role="club">
                  <RequireSubscription>
                    <Staff />
                  </RequireSubscription>
                </RequireRole>
              </RequireAuth>
            }
          />


          {/* Admin */}

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <AdminDashboard />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/clubs"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <AdminClubs />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/players"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <AdminPlayers />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/verification"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <Verification />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/subscriptions"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <Subscriptions />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/disputes"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <Disputes />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/audit"
            element={
              <RequireAuth>
                <RequireRole role="admin">
                  <Audit />
                </RequireRole>
              </RequireAuth>
            }
          />


          {/* Account */}

          <Route
            path="/billing"
            element={
              <RequireAuth>
                <Billing />
              </RequireAuth>
            }
          />

          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <Billing />
              </RequireAuth>
            }
          />

          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
        </Route>


        {/* Catch-all */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>

      <Toaster />
    </>
  )
}
