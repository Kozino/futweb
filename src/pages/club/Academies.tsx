import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Icon, Input, Modal, Skeleton, toast } from '@/components/ui'
import { UpgradeCard } from '@/components/plan/FeatureGate'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { entitlementsFor } from '@/lib/entitlements'
import { hasSupabase } from '@/lib/supabase'
import {
  getFederationChildren, linkAcademy, unlinkAcademy, getAcademySquad,
  type AcademyChild, type AcademyPlayer,
} from '@/lib/supabase/federation'
import { cn } from '@/lib/utils'

export default function Academies() {
  const { club } = useClub()
  const { user } = useAuth()

  const [children, setChildren] = useState<AcademyChild[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [childId, setChildId] = useState('')

  const [expanded, setExpanded] = useState<string | null>(null)
  const [squad, setSquad] = useState<AcademyPlayer[]>([])
  const [squadLoading, setSquadLoading] = useState(false)

  const parentId = club?.id
  const level = entitlementsFor(user).level
  const isFederation = level >= 2 || user?.role === 'admin'

  async function load() {
    if (!hasSupabase || !parentId) { setLoading(false); return }
    try {
      setChildren(await getFederationChildren(parentId))
    } catch {
      toast({ tone: 'error', title: 'Could not load academies', description: 'Ensure the Federation migration is applied.' })
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [parentId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addAcademy() {
    const id = childId.trim()
    if (!parentId || !id) return
    setBusy(true)
    try {
      await linkAcademy(parentId, id)
      setOpen(false); setChildId('')
      await load()
      toast({ tone: 'success', title: 'Academy added', description: 'It is now part of your group.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not add academy', description: err instanceof Error ? err.message : 'Check the club id and try again.' })
    } finally { setBusy(false) }
  }

  async function removeAcademy(child: AcademyChild) {
    if (!parentId) return
    setBusy(true)
    try {
      await unlinkAcademy(parentId, child.id)
      await load()
      toast({ tone: 'info', title: 'Academy removed', description: `${child.name} is no longer in your group.` })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not remove', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setBusy(false) }
  }

  async function toggleSquad(child: AcademyChild) {
    if (expanded === child.id) { setExpanded(null); setSquad([]); return }
    setExpanded(child.id); setSquadLoading(true)
    try {
      setSquad(await getAcademySquad(child.id))
    } catch {
      toast({ tone: 'error', title: 'Could not load squad' })
      setSquad([])
    } finally { setSquadLoading(false) }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="building"
        title="Academies & group"
        subtitle="Manage the academies that make up your federation group."
        actions={
          isFederation ? (
            <Button icon="plus" onClick={() => setOpen(true)}>Add academy</Button>
          ) : undefined
        }
      />

      {!isFederation ? (
        <div className="mt-5">
          <UpgradeCard
            title="Available on Federation"
            description="Manage a group of academies under one organisation. This capability is part of the Federation plan."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {children.length === 0 ? (
              <Card className="p-8">
                <EmptyState icon="building" title="No academies yet"
                  description="Add academies to your group to oversee their players and activity from one place."
                  action={isFederation ? <Button icon="plus" onClick={() => setOpen(true)}>Add first academy</Button> : undefined}
                />
              </Card>
            ) : children.map(c => (
              <Card key={c.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-900 font-display text-sm font-bold text-white">
                      {(c.short_name || c.name).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink-900">{c.name}</p>
                        {c.entity_verified
                          ? <Badge tone="trust" icon="shield" size="sm">Verified</Badge>
                          : <Badge tone="gold" size="sm">Unverified</Badge>}
                      </div>
                      <p className="text-2xs text-ink-500">{c.state_region || 'Nigeria'} · {c.short_name || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-center">
                      <span className="block font-display text-lg text-ink-900">{c.player_count}</span>
                      <span className="text-2xs text-ink-400">Players</span>
                    </span>
                    <span className="text-center">
                      <span className="block font-display text-lg text-ink-900">{c.staff_count}</span>
                      <span className="text-2xs text-ink-400">Staff</span>
                    </span>
                    <Button size="sm" variant="ghost" icon={expanded === c.id ? 'chevron-down' : 'chevron-right'}
                      onClick={() => void toggleSquad(c)}>
                      Squad
                    </Button>
                    <Button size="sm" variant="ghost" icon="trash" className="text-red-500"
                      onClick={() => void removeAcademy(c)}>Remove</Button>
                  </div>
                </div>

                {expanded === c.id && (
                  <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-3">
                    {squadLoading ? <Skeleton className="h-16 w-full" /> : squad.length === 0 ? (
                      <p className="text-xs text-ink-500">No players registered to this academy yet.</p>
                    ) : (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {squad.map(p => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-ink-800">{p.first_name} {p.last_name}</p>
                              <p className="text-2xs text-ink-500">{p.position_primary} · {p.age} yrs</p>
                            </div>
                            <span className={cn('font-display text-sm', (p.futweb_score ?? 0) >= 70 ? 'text-trust-600' : 'text-ink-700')}>
                              {p.futweb_score ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-bold">How the group works</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                Academies keep their own ownership, staff and billing. As the Federation you
                can add academies to your group and oversee their players in one place.
                Each academy remains independently managed.
              </p>
            </Card>
            <Card className="border-dashed p-5">
              <p className="text-sm font-bold text-ink-900">Need SSO, data residency or dedicated support?</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Custom roles, SSO, API/webhook streams, data residency, a named account manager and
                NFF compliance onboarding are arranged via your enterprise agreement.
              </p>
              <Link to="/federation/apply">
                <Button size="sm" className="mt-3" icon="arrow-right">Request enterprise access</Button>
              </Link>
            </Card>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add an academy"
        description="Enter the club id of the academy you want to add to your group."
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button icon="plus" loading={busy} disabled={!childId.trim()} onClick={() => void addAcademy()}>Add academy</Button>
        </>}>
        <div className="space-y-3">
          <Input label="Academy club id" value={childId} onChange={e => setChildId(e.target.value)}
            placeholder="Paste the club's id (from its settings or support)" />
          <p className="flex items-start gap-1.5 text-xs text-ink-400">
            <Icon name="info" size={13} className="mt-0.5 shrink-0" />
            The club id is the UUID of the academy's club record. You can find it in the club's
            dashboard URL or from support.
          </p>
        </div>
      </Modal>
    </div>
  )
}
