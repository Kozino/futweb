import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, Icon, Modal, Select, Tabs, toast } from '@/components/ui'
import { AttributeBars, ConfidenceMeter, PositionFitBar, ScoreRing } from '@/components/player/Attributes'
import { AttributeRadar } from '@/components/player/Radar'
import { useOffline } from '@/context/OfflineContext'
import { DEMO_PLAYERS, enrichPlayer } from '@/data/mock'
import { ATTRIBUTE_GROUPS, POSITION_LIST, computeFutWebScore } from '@/lib/ratings'
import type { PlayerAttributes } from '@/types'
import { ageFrom } from '@/lib/ratings'

const GROUP_NAMES = ['Technical', 'Physical', 'Mental', 'Defending', 'Goalkeeping'] as const

export default function PlayerAttributes() {
  const { online, enqueue } = useOffline()
  const me = useMemo(() => enrichPlayer(DEMO_PLAYERS[0]), [])
  const [attrs, setAttrs] = useState<PlayerAttributes>(me.attributes)
  const [group, setGroup] = useState<(typeof GROUP_NAMES)[number]>('Technical')
  const [requestOpen, setRequestOpen] = useState(false)
  const [position, setPosition] = useState(me.position_primary)
  const [saving, setSaving] = useState(false)

  const score = useMemo(
    () => computeFutWebScore({ attributes: attrs, position, age: ageFrom(me.dob), confidence: me.confidence.score }),
    [attrs, position, me.dob, me.confidence.score],
  )

  const update = (k: string, v: number) => setAttrs(a => ({ ...a, [k]: v }))

  async function save() {
    setSaving(true)
    // Write locally first — works with or without a network.
    await enqueue('rating', { player_id: me.id, attributes: attrs, context: 'training' })
    if (online) await new Promise(r => setTimeout(r, 500))
    setSaving(false)
    toast({
      tone: online ? 'success' : 'info',
      title: online ? 'Ratings saved' : 'Saved on this device',
      description: online
        ? 'Your attribute profile has been updated.'
        : 'It will sync automatically when you reconnect.'})
  }

  return (
    <div>
      <PageHeader breadcrumb="Player workspace" icon="radar" title="Attributes"
        subtitle="Your 32-attribute profile. Self-ratings are marked as such — verified coach ratings carry far more weight with clubs."
        actions={
          <>
            <Button variant="outline" icon="shield" onClick={() => setRequestOpen(true)}>
              Request a coach rating
            </Button>
            <Button icon={online ? 'check' : 'offline'} loading={saving} onClick={save}>
              {online ? 'Save ratings' : 'Save offline'}
            </Button>
          </>
        } />

      {!online && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-xs font-semibold text-gold-700">
          <Icon name="offline" size={15} />
          You are offline. Edits are stored on this device and sync automatically when you reconnect.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Attribute editor</h3>
                <p className="text-xs text-ink-500">Drag to adjust. 50 is a competent senior player.</p>
              </div>
              <Select className="w-36" value={position} onChange={e => setPosition(e.target.value)}
                options={[...POSITION_LIST].map(p => ({ value: p, label: p }))} />
            </div>

            <Tabs value={group} onChange={setGroup}
              tabs={GROUP_NAMES.map(g => ({ value: g, label: g }))} />

            <div className="mt-5 space-y-3.5">
              {ATTRIBUTE_GROUPS[group].map(k => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-semibold capitalize text-ink-700">
                    {k.replace(/_/g, ' ')}
                  </span>
                  <input type="range" min={20} max={99} value={attrs[k] ?? 50}
                    onChange={e => update(k, Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-100 accent-red-500" />
                  <span className="tnum w-8 shrink-0 text-right text-sm font-bold text-ink-900">{attrs[k]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-bold">Full profile</h3>
            <AttributeBars attributes={attrs} highlightGroup={group} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold">Live score</h3>
            <ScoreRing score={score.current} size={84} confidence={me.confidence.score}
              label={score.ratingTier} sublabel={`Potential ${score.potential}`} />
            <div className="mt-4">
              <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-ink-400">Position fit</p>
              <PositionFitBar fit={score.positionFit as unknown as Record<string, number>} primary={position} />
            </div>
            {score.viablePositions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-2xs font-bold uppercase tracking-widest text-ink-400">Also viable at</p>
                <div className="flex flex-wrap gap-1.5">
                  {score.viablePositions.slice(0, 8).map(p => (
                    <Badge key={p} tone="neutral" size="sm">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <AttributeRadar attributes={attrs} keys={[...ATTRIBUTE_GROUPS[group]]} size={240} />
          </Card>

          <Card className="p-5">
            <ConfidenceMeter score={me.confidence.score} label={me.confidence.label} factors={me.confidence.factors} />
            <div className="mt-4 rounded-xl bg-ink-50 p-3.5">
              <p className="text-2xs leading-relaxed text-ink-600">
                Self-ratings are regressed toward the population mean. Ask a coach, academy or scout
                to rate you — each verified rating raises your confidence and your visibility in
                club discovery.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} size="sm"
        title="Request a verified rating"
        description="Send a signed link to a coach, academy director or scout. Their rating appears with a verified badge."
        footer={
          <>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button icon="mail" onClick={() => { setRequestOpen(false); toast({ tone: 'success', title: 'Request sent', description: 'They will receive a secure rating link.' }) }}>
              Send request
            </Button>
          </>
        }>
        <div className="space-y-4">
          <input className="fw-input" placeholder="Coach or scout name" />
          <input className="fw-input" placeholder="Email or WhatsApp number" />
          <select className="fw-input">
            <option>Their role: Head coach</option>
            <option>Their role: Assistant coach</option>
            <option>Their role: Academy director</option>
            <option>Their role: Scout</option>
          </select>
          <div className="rounded-xl bg-trust-50 p-3.5">
            <p className="flex items-start gap-2 text-2xs text-trust-800">
              <Icon name="shield" size={13} className="mt-0.5 shrink-0" />
              The link is single-use and expires in 14 days. Ratings are attributed to the verifier,
              so inflated scores are traceable.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
