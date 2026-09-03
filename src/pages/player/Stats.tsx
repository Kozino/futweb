import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Card,
  CardHeader,
  Select,
  Stat,
} from '@/components/ui'
import { usePlayer } from '@/context/PlayerContext'

interface MatchStatsRow {
  id?: string
  player_id: string
  season: string
  competition?: string | null
  appearances?: number | null
  minutes?: number | null
  goals?: number | null
  assists?: number | null
  shots?: number | null
  shots_on_target?: number | null
  pass_attempts?: number | null
  passes_completed?: number | null
  duels?: number | null
  duels_won?: number | null
  tackles?: number | null
  interceptions?: number | null
  fouls_committed?: number | null
  yellow_cards?: number | null
  red_cards?: number | null
  clean_sheets?: number | null
  goals_conceded?: number | null
  saves?: number | null
}

function numberValue(value: number | null | undefined) {
  return value ?? 0
}

function per90(value: number, minutes: number) {
  if (minutes <= 0) return 0
  return Number(((value / minutes) * 90).toFixed(2))
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return Number(((value / total) * 100).toFixed(1))
}

function aggregateStats(rows: MatchStatsRow[]): MatchStatsRow {
  return rows.reduce(
    (total, row) => ({
      player_id: row.player_id,
      season: row.season,
      appearances:
        numberValue(total.appearances) + numberValue(row.appearances),
      minutes: numberValue(total.minutes) + numberValue(row.minutes),
      goals: numberValue(total.goals) + numberValue(row.goals),
      assists: numberValue(total.assists) + numberValue(row.assists),
      shots: numberValue(total.shots) + numberValue(row.shots),
      shots_on_target:
        numberValue(total.shots_on_target) +
        numberValue(row.shots_on_target),
      pass_attempts:
        numberValue(total.pass_attempts) + numberValue(row.pass_attempts),
      passes_completed:
        numberValue(total.passes_completed) +
        numberValue(row.passes_completed),
      duels: numberValue(total.duels) + numberValue(row.duels),
      duels_won: numberValue(total.duels_won) + numberValue(row.duels_won),
      tackles: numberValue(total.tackles) + numberValue(row.tackles),
      interceptions:
        numberValue(total.interceptions) +
        numberValue(row.interceptions),
      fouls_committed:
        numberValue(total.fouls_committed) +
        numberValue(row.fouls_committed),
      yellow_cards:
        numberValue(total.yellow_cards) + numberValue(row.yellow_cards),
      red_cards:
        numberValue(total.red_cards) + numberValue(row.red_cards),
      clean_sheets:
        numberValue(total.clean_sheets) + numberValue(row.clean_sheets),
      goals_conceded:
        numberValue(total.goals_conceded) +
        numberValue(row.goals_conceded),
      saves: numberValue(total.saves) + numberValue(row.saves),
    }),
    {
      player_id: '',
      season: '',
      appearances: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      shots_on_target: 0,
      pass_attempts: 0,
      passes_completed: 0,
      duels: 0,
      duels_won: 0,
      tackles: 0,
      interceptions: 0,
      fouls_committed: 0,
      yellow_cards: 0,
      red_cards: 0,
      clean_sheets: 0,
      goals_conceded: 0,
      saves: 0,
    } as MatchStatsRow,
  )
}

export default function PlayerStats() {
  const { player, stats, loading } = usePlayer()

  const rows = stats as MatchStatsRow[]

  const seasons = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map(row => row.season)
          .filter((season): season is string => Boolean(season)),
      ),
    ).sort((a, b) => b.localeCompare(a))
  }, [rows])

  const [selectedSeason, setSelectedSeason] = useState('')

  const season =
    selectedSeason && seasons.includes(selectedSeason)
      ? selectedSeason
      : seasons[0] ?? ''

  const seasonRows = useMemo(
    () => rows.filter(row => row.season === season),
    [rows, season],
  )

  const current = useMemo(
    () => aggregateStats(seasonRows),
    [seasonRows],
  )

  const minutes = numberValue(current.minutes)
  const goals = numberValue(current.goals)
  const assists = numberValue(current.assists)
  const shots = numberValue(current.shots)
  const shotsOnTarget = numberValue(current.shots_on_target)
  const passAttempts = numberValue(current.pass_attempts)
  const passesCompleted = numberValue(current.passes_completed)
  const duels = numberValue(current.duels)
  const duelsWon = numberValue(current.duels_won)
  const tackles = numberValue(current.tackles)
  const interceptions = numberValue(current.interceptions)

  const goalsPer90 = per90(goals, minutes)
  const assistsPer90 = per90(assists, minutes)
  const shotsPer90 = per90(shots, minutes)
  const tacklesPer90 = per90(tackles, minutes)
  const interceptionsPer90 = per90(interceptions, minutes)

  const passAccuracy = percentage(passesCompleted, passAttempts)
  const conversionRate = percentage(goals, shots)
  const duelSuccess = percentage(duelsWon, duels)

  const minutesPerGoal =
    goals > 0 && minutes > 0 ? Math.round(minutes / goals) : null

  const seasonTimeline = useMemo(() => {
    return seasons
      .slice()
      .reverse()
      .map(seasonName => {
        const seasonRows = rows.filter(row => row.season === seasonName)
        const aggregate = aggregateStats(seasonRows)

        const seasonMinutes = numberValue(aggregate.minutes)
        const seasonGoals = numberValue(aggregate.goals)
        const seasonAssists = numberValue(aggregate.assists)

        return {
          season: seasonName,
          goals: seasonGoals,
          assists: seasonAssists,
          goalsPer90: per90(seasonGoals, seasonMinutes),
          assistsPer90: per90(seasonAssists, seasonMinutes),
        }
      })
  }, [rows, seasons])

  const per90Chart = [
    { metric: 'Goals', value: goalsPer90 },
    { metric: 'Assists', value: assistsPer90 },
    { metric: 'Shots', value: shotsPer90 },
    { metric: 'Tackles', value: tacklesPer90 },
    { metric: 'Interc.', value: interceptionsPer90 },
  ]

  if (loading) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="chart"
          title="Performance"
          subtitle="Match statistics and your development over time."
        />

        <Card className="p-6">
          <p className="text-sm text-ink-500">Loading your statistics…</p>
        </Card>
      </div>
    )
  }

  if (!player) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="chart"
          title="Performance"
          subtitle="Match statistics and your development over time."
        />

        <Card className="p-6">
          <h2 className="text-base font-bold text-ink-900">
            Player profile not found
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Complete your player profile before viewing performance data.
          </p>
        </Card>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader
          breadcrumb="Player workspace"
          icon="chart"
          title="Performance"
          subtitle="Match statistics and your development over time."
        />

        <Card className="p-6">
          <CardHeader
            title="No statistics yet"
            subtitle="Your verified or submitted season statistics will appear here once they are recorded."
          />

          <div className="mt-4 rounded-xl border border-dashed border-ink-200 bg-ink-50 p-6 text-center">
            <p className="text-sm font-semibold text-ink-800">
              No performance records are available.
            </p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-ink-500">
              FutWeb is connected to your real player record. There is no demo
              data being shown here.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        icon="chart"
        title="Performance"
        subtitle="Match statistics and your development over time."
        actions={
          <Select
            className="w-36"
            value={season}
            onChange={event => setSelectedSeason(event.target.value)}
            options={seasons.map(item => ({
              value: item,
              label: item,
            }))}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Appearances"
          value={numberValue(current.appearances)}
          icon="calendar"
          sub={`${minutes} minutes`}
        />

        <Stat
          label="Goals"
          value={goals}
          icon="target"
          tone="red"
          sub={`${goalsPer90} per 90`}
        />

        <Stat
          label="Assists"
          value={assists}
          icon="share"
          sub={`${assistsPer90} per 90`}
        />

        <Stat
          label="Pass accuracy"
          value={`${passAccuracy}%`}
          icon="trending"
          tone="trust"
          sub={`${passAttempts} attempts`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader
            title="Per-90 output"
            subtitle="Normalised by minutes played"
          />

          <div className="px-2 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={per90Chart}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E4E8F1"
                  vertical={false}
                />
                <XAxis
                  dataKey="metric"
                  tick={{ fontSize: 11, fill: '#6B7896' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A0BC' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(228,0,43,0.05)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E4E8F1',
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#E4002B"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader
            title="Season development"
            subtitle="Goals and assists across your recorded seasons"
          />

          <div className="px-2 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={seasonTimeline}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E4E8F1"
                  vertical={false}
                />
                <XAxis
                  dataKey="season"
                  tick={{ fontSize: 11, fill: '#6B7896' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A0BC' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E4E8F1',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="goals"
                  name="Goals"
                  stroke="#E4002B"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#E4002B' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="assists"
                  name="Assists"
                  stroke="#94A0BC"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="Full statistics"
          subtitle={`${season} · ${player.first_name} ${player.last_name}`}
          action={
            <Badge
              tone={
                player.visibility === 'public'
                  ? 'trust'
                  : 'neutral'
              }
            >
              {current.competition || 'Season aggregate'}
            </Badge>
          }
        />

        <div className="grid gap-x-8 gap-y-0 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Appearances', numberValue(current.appearances)],
            ['Minutes played', minutes],
            ['Goals', goals],
            ['Assists', assists],
            ['Shots', shots],
            ['Shots on target', shotsOnTarget],
            ['Conversion rate', `${conversionRate}%`],
            ['Minutes per goal', minutesPerGoal ?? '—'],
            ['Pass accuracy', `${passAccuracy}%`],
            ['Duels won', `${duelSuccess}%`],
            ['Tackles', tackles],
            ['Interceptions', interceptions],
            ['Fouls committed', numberValue(current.fouls_committed)],
            ['Yellow cards', numberValue(current.yellow_cards)],
            ['Red cards', numberValue(current.red_cards)],
            ['Clean sheets', numberValue(current.clean_sheets)],
            ['Goals conceded', numberValue(current.goals_conceded)],
            ['Saves', numberValue(current.saves)],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between border-b border-ink-100 py-2.5 last:border-0"
            >
              <span className="text-xs text-ink-600">
                {String(label)}
              </span>
              <span className="tnum text-sm font-bold">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
