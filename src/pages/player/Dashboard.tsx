import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  ProgressBar,
  Stat,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { usePlayer } from '@/context/PlayerContext'
import { cn } from '@/lib/utils'

type ApplicationRow = {
  id: string
  trial_id: string
  player_id: string
  message: string | null
  status: string
  created_at: string
}

type MatchStatRow = {
  id: string
  season: string
  competition: string | null
  appearances: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  shots: number | null
  shots_on_target: number | null
  yellow_cards: number | null
  red_cards: number | null
  clean_sheets: number | null
}

function getAge(dob: string) {
  const birthDate = new Date(`${dob}T00:00:00`)

  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()

  let age = today.getFullYear() - birthDate.getFullYear()

  const monthDifference = today.getMonth() - birthDate.getMonth()

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() < birthDate.getDate()
    )
  ) {
    age -= 1
  }

  return age
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ')
}

function calculateCompleteness(player: {
  first_name: string
  last_name: string
  dob: string
  nationality: string
  position_primary: string
  foot: string
  height_cm: number | null
  weight_kg: number | null
  bio: string | null
}) {
  const checks = [
    Boolean(player.first_name),
    Boolean(player.last_name),
    Boolean(player.dob),
    Boolean(player.nationality),
    Boolean(player.position_primary),
    Boolean(player.foot),
    Boolean(player.height_cm),
    Boolean(player.weight_kg),
    Boolean(player.bio),
  ]

  const completed = checks.filter(Boolean).length

  return Math.round((completed / checks.length) * 100)
}

export default function PlayerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const {
    player,
    attributes,
    stats,
    career,
    applications,
    loading,
    error,
    refresh,
  } = usePlayer()

  const typedStats = useMemo(
    () => stats as MatchStatRow[],
    [stats],
  )

  const typedApplications = useMemo(
    () => applications as ApplicationRow[],
    [applications],
  )

  const age = useMemo(
    () => player ? getAge(player.dob) : null,
    [player],
  )

  const completeness = useMemo(
    () => player ? calculateCompleteness(player) : 0,
    [player],
  )

  const recentStats = useMemo(
    () => typedStats.slice(0, 3),
    [typedStats],
  )

  const activeApplications = useMemo(
    () =>
      typedApplications.filter(
        application =>
          application.status !== 'rejected' &&
          application.status !== 'withdrawn',
      ),
    [typedApplications],
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="fw-card h-24 animate-pulse bg-ink-50" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="fw-card h-48 animate-pulse bg-ink-50" />
          <div className="fw-card h-48 animate-pulse bg-ink-50 lg:col-span-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="fw-card h-28 animate-pulse bg-ink-50" />
          <div className="fw-card h-28 animate-pulse bg-ink-50" />
          <div className="fw-card h-28 animate-pulse bg-ink-50" />
          <div className="fw-card h-28 animate-pulse bg-ink-50" />
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          title="Complete your player profile"
          subtitle="Your account is authenticated, but your player profile has not been created yet."
        />

        <Card className="p-6">
          <div className="flex flex-col items-center py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-ink-100">
              <Icon name="user" size={24} />
            </div>

            <h2 className="mt-4 text-base font-bold text-ink-900">
              Your player profile is not ready
            </h2>

            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">
              Complete player onboarding to create your real FutWeb player
              record. Once created, your profile, statistics, attributes and
              recruitment activity will appear here.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button
                onClick={() => navigate('/onboarding/player')}
              >
                Complete onboarding
              </Button>

              <Button
                variant="outline"
                onClick={() => void refresh()}
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const fullName = `${player.first_name} ${player.last_name}`.trim()
  const initials = getInitials(player.first_name, player.last_name)

  const confidence = player.confidence ?? 0
  const score = player.futweb_score
  const potential = player.potential

  const checklist = [
    {
      label: 'Complete your profile',
      done: completeness >= 100,
      to: '/player/profile',
    },
    {
      label: 'Add highlight media',
      done: false,
      to: '/player/media',
    },
    {
      label: 'Verify your identity',
      done: user?.verificationTier !== 'unverified',
      to: '/player/verify',
    },
    {
      label: 'Add match statistics',
      done: typedStats.length > 0,
      to: '/player/stats',
    },
    {
      label: 'Add player ratings',
      done: Boolean(attributes),
      to: '/player/attributes',
    },
  ]

  const completedChecklist = checklist.filter(
    item => item.done,
  ).length

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        title={`Welcome back, ${player.first_name}`}
        subtitle="Keep your football profile current and make it easier for clubs to evaluate you."
        actions={
          <>
            <Link to="/player/profile">
              <Button variant="outline" icon="edit">
                Edit profile
              </Button>
            </Link>

            <Link to="/player/trials">
              <Button icon="search">
                Find trials
              </Button>
            </Link>
          </>
        }
      />

      {/* Player identity */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-ink-900 text-lg font-bold text-white">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold text-ink-900">
                  {fullName}
                </h2>

                {player.is_minor && (
                  <Badge tone="warn" size="sm">
                    Minor
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                <span>{player.position_primary}</span>

                {age !== null && (
                  <span>{age} years</span>
                )}

                {player.nationality && (
                  <span>{player.nationality}</span>
                )}

                <span>
                  {player.foot === 'both'
                    ? 'Both feet'
                    : `${player.foot} foot`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-ink-50 px-4 py-3 text-center">
              <p className="text-2xs uppercase tracking-wide text-ink-400">
                Score
              </p>
              <p className="tnum mt-1 font-display text-2xl text-ink-900">
                {score ?? '—'}
              </p>
            </div>

            <div className="rounded-xl bg-ink-50 px-4 py-3 text-center">
              <p className="text-2xs uppercase tracking-wide text-ink-400">
                Potential
              </p>
              <p className="tnum mt-1 font-display text-2xl text-gold-500">
                {potential ?? '—'}
              </p>
            </div>

            <div className="rounded-xl bg-ink-50 px-4 py-3 text-center">
              <p className="text-2xs uppercase tracking-wide text-ink-400">
                Confidence
              </p>
              <p className="tnum mt-1 font-display text-2xl text-trust-500">
                {confidence}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-600">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  player.visibility === 'public'
                    ? 'bg-trust-500'
                    : player.visibility === 'verified_only'
                      ? 'bg-gold-500'
                      : 'bg-ink-300',
                )}
              />

              {player.visibility === 'public'
                ? 'Public profile'
                : player.visibility === 'verified_only'
                  ? 'Verified clubs only'
                  : 'Private profile'}
            </span>

            <Link
              to="/player/profile"
              className="text-xs font-semibold text-red-500 hover:text-red-600"
            >
              Manage visibility
            </Link>
          </div>
        </div>
      </Card>

      {/* Profile strength */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink-900">
              Profile strength
            </h2>

            <p className="text-xs text-ink-500">
              {completedChecklist} of {checklist.length} recommended items
              complete
            </p>
          </div>

          <span className="font-display text-3xl text-red-500">
            {completeness}%
          </span>
        </div>

        <ProgressBar
          className="mt-3"
          value={completeness}
        />

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map(item => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-ink-50"
            >
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-full',
                  item.done
                    ? 'bg-trust-400 text-white'
                    : 'border-2 border-dashed border-ink-300',
                )}
              >
                {item.done && (
                  <Icon
                    name="check"
                    size={11}
                    strokeWidth={3.5}
                  />
                )}
              </span>

              <span
                className={cn(
                  'text-xs font-medium',
                  item.done
                    ? 'text-ink-400 line-through'
                    : 'text-ink-800',
                )}
              >
                {item.label}
              </span>

              {!item.done && (
                <Icon
                  name="arrow-right"
                  size={13}
                  className="ml-auto shrink-0 text-ink-300"
                />
              )}
            </Link>
          ))}
        </div>
      </Card>

      {/* Core football data */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold text-ink-500">
            FutWeb Score
          </p>

          <div className="mt-4 flex items-end gap-3">
            <span className="font-display text-5xl leading-none text-ink-900">
              {score ?? '—'}
            </span>

            {score !== null && (
              <Badge
                tone={score >= 72 ? 'trust' : 'gold'}
                size="sm"
              >
                {score >= 72 ? 'Strong' : 'Developing'}
              </Badge>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-widest text-ink-400">
                Data confidence
              </span>

              <span className="tnum text-xs font-bold text-ink-700">
                {confidence}
              </span>
            </div>

            <ProgressBar
              value={confidence}
              tone={confidence >= 65 ? 'trust' : 'gold'}
            />
          </div>

          <p className="mt-3 text-2xs leading-relaxed text-ink-500">
            {confidence >= 65
              ? 'Your profile has a strong supporting evidence base.'
              : 'Add verified ratings and performance evidence to improve confidence.'}
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <CardHeader
            title="Playing profile"
            subtitle="The football information clubs see on your profile."
            action={
              <Link to="/player/profile">
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              </Link>
            }
          />

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3">
            <InfoItem
              label="Primary position"
              value={player.position_primary}
            />

            <InfoItem
              label="Secondary positions"
              value={
                player.position_secondary.length > 0
                  ? player.position_secondary.join(', ')
                  : 'None added'
              }
            />

            <InfoItem
              label="Preferred foot"
              value={
                player.foot === 'both'
                  ? 'Both'
                  : `${player.foot} foot`
              }
            />

            <InfoItem
              label="Height"
              value={
                player.height_cm
                  ? `${player.height_cm} cm`
                  : 'Not provided'
              }
            />

            <InfoItem
              label="Weight"
              value={
                player.weight_kg
                  ? `${player.weight_kg} kg`
                  : 'Not provided'
              }
            />

            <InfoItem
              label="Availability"
              value={formatAvailability(player.availability)}
            />
          </div>
        </Card>
      </div>

      {/* Statistics */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Seasons"
          value={typedStats.length}
          icon="chart"
          sub="Recorded in FutWeb"
        />

        <Stat
          label="Appearances"
          value={typedStats.reduce(
            (total, row) => total + (row.appearances ?? 0),
            0,
          )}
          icon="target"
          sub="Across recorded seasons"
        />

        <Stat
          label="Goals"
          value={typedStats.reduce(
            (total, row) => total + (row.goals ?? 0),
            0,
          )}
          icon="star"
          sub="Recorded goals"
        />

        <Stat
          label="Applications"
          value={activeApplications.length}
          icon="list"
          sub="Active recruitment activity"
        />
      </div>

      {/* Recent stats + applications */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent performance"
            subtitle="Your latest recorded match statistics."
            action={
              <Link to="/player/stats">
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              </Link>
            }
          />

          {recentStats.length === 0 ? (
            <EmptyState
              title="No statistics yet"
              description="Add your first season statistics to start building your performance record."
              action="Add statistics"
              to="/player/stats"
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {recentStats.map(row => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink-900">
                      {row.season}
                    </p>

                    <p className="mt-0.5 truncate text-2xs text-ink-500">
                      {row.competition || 'Competition not specified'}
                    </p>
                  </div>

                  <div className="grid shrink-0 grid-cols-3 gap-4 text-right">
                    <MiniStat
                      label="Apps"
                      value={row.appearances ?? 0}
                    />

                    <MiniStat
                      label="Goals"
                      value={row.goals ?? 0}
                    />

                    <MiniStat
                      label="Assists"
                      value={row.assists ?? 0}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Trial applications"
            subtitle="Your current recruitment activity."
            action={
              <Link to="/player/trials">
                <Button size="sm" variant="ghost">
                  Browse
                </Button>
              </Link>
            }
          />

          {typedApplications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Browse open verified trials and apply directly from FutWeb."
              action="Find trials"
              to="/player/trials"
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {typedApplications.slice(0, 5).map(application => (
                <div
                  key={application.id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100">
                    <Icon name="target" size={15} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink-900">
                      Trial application
                    </p>

                    <p className="mt-0.5 text-2xs text-ink-400">
                      Applied {formatDate(application.created_at)}
                    </p>
                  </div>

                  <Badge
                    tone={
                      application.status === 'accepted'
                        ? 'trust'
                        : application.status === 'rejected'
                          ? 'red'
                          : 'neutral'
                    }
                    size="sm"
                  >
                    {formatStatus(application.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-ink-100 bg-ink-50/60 px-5 py-3">
            <p className="flex items-center gap-1.5 text-2xs font-semibold text-ink-500">
              <Icon name="shield" size={12} />
              FutWeb trial applications are stored against your real player
              profile.
            </p>
          </div>
        </Card>
      </div>

      {/* Career */}
      <Card className="mt-4">
        <CardHeader
          title="Career history"
          subtitle="Your recorded football career."
          action={
            <Link to="/player/profile">
              <Button size="sm" variant="ghost">
                Manage
              </Button>
            </Link>
          }
        />

        {career.length === 0 ? (
          <EmptyState
            title="No career entries yet"
            description="Add your clubs, competitions and seasons to build a complete football history."
            action="Update profile"
            to="/player/profile"
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {career.slice(0, 5).map((entry, index) => {
              const row = entry as {
                id?: string
                club_name?: string | null
                season?: string | null
                competition?: string | null
                appearances?: number | null
                goals?: number | null
                assists?: number | null
              }

              return (
                <div
                  key={row.id ?? `${row.club_name}-${row.season}-${index}`}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div>
                    <p className="text-xs font-semibold text-ink-900">
                      {row.club_name || 'Club not specified'}
                    </p>

                    <p className="mt-0.5 text-2xs text-ink-500">
                      {row.season || 'Season not specified'}
                      {row.competition
                        ? ` · ${row.competition}`
                        : ''}
                    </p>
                  </div>

                  <MiniStat
                    label="Apps"
                    value={row.appearances ?? 0}
                  />

                  <MiniStat
                    label="Goals"
                    value={row.goals ?? 0}
                  />

                  <MiniStat
                    label="Assists"
                    value={row.assists ?? 0}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Minor protection */}
      {player.is_minor && (
        <Card className="mt-4 border border-gold-200 bg-gold-50/40 p-5">
          <div className="flex gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-100">
              <Icon name="shield" size={17} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-ink-900">
                Minor-player protection is active
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-ink-600">
                Your account has additional safeguarding controls. Profile
                visibility and recruitment access are subject to FutWeb's
                minor-player protection rules.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-2xs font-bold uppercase tracking-widest text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-xs font-semibold text-ink-800">
        {value}
      </p>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="text-right">
      <p className="text-2xs text-ink-400">
        {label}
      </p>

      <p className="tnum mt-0.5 text-xs font-bold text-ink-800">
        {value}
      </p>
    </div>
  )
}

function EmptyState({
  title,
  description,
  action,
  to,
}: {
  title: string
  description: string
  action: string
  to: string
}) {
  return (
    <div className="px-5 py-8 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-ink-100">
        <Icon name="arrow-right" size={15} />
      </div>

      <h3 className="mt-3 text-xs font-bold text-ink-800">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-2xs leading-relaxed text-ink-500">
        {description}
      </p>

      <Link to={to}>
        <Button
          className="mt-4"
          size="sm"
          variant="outline"
        >
          {action}
        </Button>
      </Link>
    </div>
  )
}

function formatAvailability(
  value:
    | 'available'
    | 'trial_only'
    | 'under_contract'
    | 'not_looking',
) {
  switch (value) {
    case 'available':
      return 'Available'

    case 'trial_only':
      return 'Trial opportunities'

    case 'under_contract':
      return 'Under contract'

    case 'not_looking':
      return 'Not looking'

    default:
      return value
  }
}

