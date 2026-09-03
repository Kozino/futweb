import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, CardHeader, Icon, ProgressBar, Stat, toast, type IconName } from '@/components/ui'
import { AttributeRadar } from '@/components/player/Radar'
import { ScoreRing, PositionFitBar } from '@/components/player/Attributes'
import { ShareCardModal, useShareCard } from '@/components/player/ShareCard'
import { useAuth } from '@/context/AuthContext'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { ATTRIBUTE_GROUPS } from '@/lib/ratings'
import { cn } from '@/lib/utils'

export default function PlayerDashboard() {
  const { user } = useAuth()
  const me = useMemo(() => enrichPlayer(DEMO_PLAYERS[0]), [])
  const [shareOpen, setShareOpen] = useState(false)
  const { download, busy } = useShareCard()

  const radarKeys = ATTRIBUTE_GROUPS[me.score.group === 'GK' ? 'Goalkeeping' : me.score.group === 'DF' ? 'Defending' : me.score.group === 'MF' ? 'Mental' : 'Technical']

  const checklist = [
    { label: 'Complete your profile', done: true, to: '/player/profile' },
    { label: 'Add highlight video', done: me.media.some(m => m.kind === 'highlight'), to: '/player/media' },
    { label: 'Verify your identity', done: user?.verificationTier !== 'unverified', to: '/player/verify' },
    { label: 'Add match statistics', done: true, to: '/player/stats' },
    { label: 'Get a coach rating', done: me.confidence.score >= 65, to: '/player/attributes' },
  ]
  const completed = checklist.filter(c => c.done).length

  return (
    <div>
      <PageHeader
        breadcrumb="Player workspace"
        title={`Welcome back, ${(user?.fullName ?? me.first_name).split(' ')[0]}`}
        subtitle="Here is how your profile is performing with clubs right now."
        actions={
          <>
            <Button variant="outline" icon="share" loading={busy}
              onClick={() => download({
                name: `${me.first_name} ${me.last_name}`, position: me.position_primary, age: me.age,
                club: me.clubName, nationality: me.nationality, foot: me.foot,
                height: me.height_cm, weight: me.weight_kg,
                score: me.score.current, potential: me.score.potential,
                confidence: me.confidence.score, attributes: me.attributes, verified: true,
              })}>
              Share card
            </Button>
            <Link to="/player/profile"><Button icon="edit">Edit CV</Button></Link>
          </>
        }
      />

      {/* Profile strength */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Profile strength</h2>
            <p className="text-xs text-ink-500">
              {completed} of {checklist.length} complete · Verified profiles get up to 3× more club views
            </p>
          </div>
          <span className="font-display text-3xl text-red-500">{Math.round((completed / checklist.length) * 100)}%</span>
        </div>
        <ProgressBar className="mt-3" value={(completed / checklist.length) * 100} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map(c => (
            <Link key={c.label} to={c.to}
              className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-ink-50">
              <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full',
                c.done ? 'bg-trust-400 text-white' : 'border-2 border-dashed border-ink-300')}>
                {c.done && <Icon name="check" size={11} strokeWidth={3.5} />}
              </span>
              <span className={cn('text-xs font-medium', c.done ? 'text-ink-400 line-through' : 'text-ink-800')}>
                {c.label}
              </span>
              {!c.done && <Icon name="arrow-right" size={13} className="ml-auto shrink-0 text-ink-300" />}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Score card */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-ink-500">Your FutWeb Score</p>
              <div className="mt-3 flex items-center gap-4">
                <ScoreRing score={me.score.current} size={92} confidence={me.confidence.score} />
                <div className="space-y-1.5">
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-ink-400">Potential</p>
                    <p className="tnum font-display text-xl text-gold-500">{me.score.potential}</p>
                  </div>
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-ink-400">Tier</p>
                    <Badge tone={me.score.current >= 72 ? 'trust' : 'gold'}>{me.score.ratingTier}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-ink-400">Position fit</p>
            <PositionFitBar fit={me.score.positionFit as unknown as Record<string, number>} primary={me.position_primary} />
          </div>

          <div className="mt-5 rounded-xl bg-ink-50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-700">Data confidence</span>
              <span className="text-xs font-bold">{me.confidence.label}</span>
            </div>
            <ProgressBar className="mt-2" value={me.confidence.score}
              tone={me.confidence.score >= 65 ? 'trust' : 'gold'} />
            <p className="mt-2 text-2xs leading-relaxed text-ink-500">
              {me.confidence.score < 65
                ? 'Ask a coach or academy to rate you. Verified ratings raise your confidence and your visibility.'
                : 'Strong evidence base. Clubs can rely on these numbers.'}
            </p>
          </div>
        </Card>

        {/* Radar */}
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Attribute profile"
            subtitle={`${me.score.group} key attributes · ${me.position_primary}`}
            action={
              <select className="rounded-lg border border-ink-200 px-2 py-1.5 text-xs font-semibold">
                <option>Technical</option><option>Physical</option><option>Mental</option>
                <option>Defending</option><option>Goalkeeping</option>
              </select>
            } />
          <div className="px-2 pt-2">
            <AttributeRadar attributes={me.attributes} keys={[...radarKeys]} size={300} />
          </div>
        </Card>
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Profile views" value={me.viewCount} icon="eye" trend={18} sub="Last 30 days" />
        <Stat label="Shortlisted by" value={me.shortlistCount} icon="list" trend={7} sub="Clubs watching you" />
        <Stat label="Trials invited" value={2} icon="target" tone="trust" sub="1 awaiting response" />
        <Stat label="Video plays" value={483} icon="video" trend={24} sub="Across all clips" />
      </div>

      {/* Activity + trials */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent activity" subtitle="Who has been looking at your profile" />
          <div className="divide-y divide-ink-100">
            {[
              { icon: 'eye' as IconName, t: 'Rivers United FC viewed your profile', d: '2 hours ago', tone: 'text-blue-500' },
              { icon: 'list' as IconName, t: 'Added to a shortlist by Kano Pillars', d: 'Yesterday', tone: 'text-trust-500' },
              { icon: 'target' as IconName, t: 'Trial invitation — Enyimba GK assessment', d: '3 days ago', tone: 'text-red-500' },
              { icon: 'chart' as IconName, t: 'Coach A. Bello added a match rating', d: '1 week ago', tone: 'text-gold-500' },
            ].map(a => (
              <div key={a.t} className="flex items-center gap-3 px-5 py-3">
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100', a.tone)}>
                  <Icon name={a.icon} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink-900">{a.t}</p>
                  <p className="text-2xs text-ink-400">{a.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Open trial invitations"
            action={<Link to="/player/trials"><Button size="sm" variant="ghost">All</Button></Link>} />
          <div className="divide-y divide-ink-100">
            {[
              { club: 'Rivers United FC', role: 'U23 Attacking Players', date: 'in 21 days', verified: true, trust: 94 },
              { club: 'Enyimba International', role: 'Goalkeeper Assessment', date: 'in 35 days', verified: true, trust: 96 },
            ].map(t => (
              <div key={t.club} className="flex items-center gap-3 px-5 py-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-2xs font-bold text-white">
                  {t.club.split(' ')[0][0]}{t.club.split(' ')[1]?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink-900">{t.club}</p>
                  <p className="truncate text-2xs text-ink-500">{t.role} · {t.date}</p>
                </div>
                <Badge tone="trust" icon="shield" size="sm">Verified</Badge>
                <Button size="sm" variant="outline" onClick={() => toast({ tone: 'success', title: 'Application sent', description: `${t.club} has been notified.` })}>
                  Apply
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-100 bg-trust-50/60 px-5 py-3">
            <p className="flex items-center gap-1.5 text-2xs font-semibold text-trust-700">
              <Icon name="shield" size={12} />
              Both invitations are from verified clubs and charge no fee.
            </p>
          </div>
        </Card>
      </div>

      <ShareCardModal
        open={shareOpen} onClose={() => setShareOpen(false)}
        profileUrl={`https://futweb.app/p/${me.slug}`}
        data={{
          name: `${me.first_name} ${me.last_name}`, position: me.position_primary, age: me.age,
          club: me.clubName, nationality: me.nationality, foot: me.foot,
          height: me.height_cm, weight: me.weight_kg,
          score: me.score.current, potential: me.score.potential,
          confidence: me.confidence.score, attributes: me.attributes, verified: true,
        }}
      />
    </div>
  )
}
