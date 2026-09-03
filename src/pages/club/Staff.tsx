import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, Badge, Button, Card, EmptyState, Icon, Input, Modal, Select, Skeleton, toast } from '@/components/ui'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { hasSupabase, supabase } from '@/lib/supabase'

const ROLES = [
  { value: 'club_admin', label: 'Administrator', desc: 'Full access including billing and staff management' },
  { value: 'club_staff', label: 'Coach / Staff', desc: 'Manage squad, file reports, view analytics' },
  { value: 'scout', label: 'Scout', desc: 'Capture ratings and reports. Cannot see billing or staff' },
]

interface Member {
  userId: string
  orgId: string | null
  name: string
  email: string
  role: string
  isOwner: boolean
  lastSeen?: string
}

export default function Staff() {
  const { club } = useClub()
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('scout')
  const [saving, setSaving] = useState(false)

  const clubId = club?.id
  const isOwner = !!club && !!user && club.owner_id === user.id
  const isClubAdmin = isOwner || members.some(m => m.userId === user?.id && m.role === 'club_admin')
  const canManage = hasSupabase && !!clubId && isClubAdmin

  const load = async () => {
    if (!hasSupabase || !clubId) { setLoading(false); return }
    const client = supabase!
    const { data: orgRows, error: orgErr } = await client
      .from('org_members').select('id, user_id, role, accepted_at, revoked_at, invited_at')
      .eq('club_id', clubId).is('revoked_at', null)
    if (orgErr) throw orgErr

    const ids = new Set<string>((orgRows ?? []).map(r => r.user_id))
    if (club?.owner_id) ids.add(club.owner_id)
    let profs: Array<{ id: string; full_name: string; email: string; last_seen_at: string | null }> = []
    if (ids.size) {
      const { data } = await client.from('profiles').select('id, full_name, email, last_seen_at').in('id', [...ids])
      profs = data ?? []
    }
    const profMap = new Map(profs.map(p => [p.id, p]))

    const list: Member[] = (orgRows ?? []).filter(r => r.accepted_at || r.user_id === club?.owner_id).map(r => {
      const p = profMap.get(r.user_id)
      return {
        userId: r.user_id,
        orgId: r.id,
        name: p?.full_name ?? 'User',
        email: p?.email ?? '',
        role: r.role,
        isOwner: r.user_id === club?.owner_id,
        lastSeen: p?.last_seen_at ?? undefined,
      }
    })
    // Owner should always appear as club_admin if they are not yet an org member.
    if (club?.owner_id && !list.some(m => m.userId === club.owner_id)) {
      const p = profMap.get(club.owner_id)
      list.unshift({ userId: club.owner_id, orgId: null, name: p?.full_name ?? 'Owner', email: p?.email ?? '', role: 'club_admin', isOwner: true, lastSeen: p?.last_seen_at ?? undefined })
    }
    setMembers(list)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try { if (!cancelled) await load() } catch (err) {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load staff', description: err instanceof Error ? err.message : 'Please try again.' })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId])

  const seatsLabel = useMemo(() => {
    const total = members.length
    const plan = user?.planCode
    return `${total} seat${total === 1 ? '' : 's'} · plan: ${plan ?? 'free'}`
  }, [members, user?.planCode])

  async function changeRole(m: Member, nextRole: string) {
    if (!m.orgId) return
    setLoading(true)
    try {
      const { error } = await supabase!.from('org_members').update({ role: nextRole }).eq('id', m.orgId)
      if (error) throw error
      setMembers(ms => ms.map(x => x.userId === m.userId ? { ...x, role: nextRole } : x))
      toast({ tone: 'success', title: 'Role updated', description: 'The change has been logged.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not update role', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setLoading(false) }
  }

  async function revoke(m: Member) {
    if (!m.orgId) return
    setLoading(true)
    try {
      const { error } = await supabase!.from('org_members').update({ revoked_at: new Date().toISOString() }).eq('id', m.orgId)
      if (error) throw error
      setMembers(ms => ms.filter(x => x.userId !== m.userId))
      toast({ tone: 'success', title: 'Access revoked', description: `${m.name} can no longer access this club.` })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not revoke', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setLoading(false) }
  }

  async function sendInvite() {
    if (!clubId || !user) return
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { toast({ tone: 'error', title: 'Email required' }); return }
    setSaving(true)
    try {
      const { data: found, error: fErr } = await supabase!.from('profiles').select('id').eq('email', trimmed).maybeSingle()
      if (fErr) throw fErr
      if (!found) {
        toast({ tone: 'error', title: 'No account with that email', description: 'The person must register on FutWeb before you can add them.' })
        return
      }
      const existing = members.find(m => m.userId === found.id)
      if (existing) { toast({ tone: 'info', title: 'Already a member', description: `${existing.name} is already in your club.` }); setInvite(false); setEmail(''); return }

      const { error } = await supabase!.from('org_members').insert({
        club_id: clubId, user_id: found.id, role, invited_by: user.id, accepted_at: new Date().toISOString(),
      })
      if (error) throw error
      await load()
      setInvite(false)
      setEmail('')
      setRole('scout')
      toast({ tone: 'success', title: 'Staff added', description: 'They now have access with the selected role.' })
    } catch (err) {
      toast({ tone: 'error', title: 'Could not add staff', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSaving(false) }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="shield" title="Staff & permissions"
        subtitle={seatsLabel}
        actions={<Button icon="plus" onClick={() => setInvite(true)} disabled={!canManage}>Add staff</Button>} />

      {!hasSupabase || !clubId ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          Connect the club to a Supabase project to manage staff & permissions.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            {members.length === 0 ? (
              <div className="p-8"><EmptyState icon="users" title="No staff yet"
                description="Add coaches and scouts so every action is attributed to a named account." /></div>
            ) : (
              <div className="divide-y divide-ink-100">
                {members.map(m => (
                  <div key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <Avatar name={m.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{m.name}</p>
                        {m.isOwner && <Badge tone="gold" size="sm">Owner</Badge>}
                      </div>
                      <p className="truncate text-2xs text-ink-500">{m.email}</p>
                    </div>
                    {m.isOwner ? (
                      <Badge tone="neutral" size="sm">Administrator</Badge>
                    ) : (
                      <>
                        <Select className="w-40" value={m.role} disabled={!canManage}
                          onChange={e => void changeRole(m, e.target.value)}
                          options={ROLES.map(r => ({ value: r.value, label: r.label }))} />
                        {canManage && (
                          <Button size="sm" variant="ghost" icon="trash" className="text-red-500"
                            onClick={() => void revoke(m)} />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-bold">What each role can do</h3>
              <div className="mt-3 space-y-3">
                {ROLES.map(r => (
                  <div key={r.value} className="rounded-xl border border-ink-100 p-3">
                    <p className="text-xs font-bold">{r.label}</p>
                    <p className="mt-0.5 text-2xs text-ink-500">{r.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
            {!isClubAdmin && (
              <Card className="p-5">
                <p className="flex items-center gap-2 text-xs text-ink-500">
                  <Icon name="lock" size={14} /> Only an Administrator can manage staff.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      <Modal open={invite} onClose={() => setInvite(false)} size="md" title="Add a staff member"
        description="The person must already have a FutWeb account with this email.">
        <div className="space-y-4">
          <Input label="Account email" type="email" placeholder="coach@club.ng" value={email} onChange={e => setEmail(e.target.value)} />
          <Select label="Role" value={role} onChange={e => setRole(e.target.value)}
            options={ROLES.filter(r => r.value !== 'club_admin' || members.length === 0).map(r => ({ value: r.value, label: `${r.label} — ${r.desc}` }))} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setInvite(false)}>Cancel</Button>
          <Button icon="plus" loading={saving} disabled={!email.trim()} onClick={() => void sendInvite()}>Add staff</Button>
        </div>
      </Modal>
    </div>
  )
}
