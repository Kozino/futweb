import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Select, Skeleton, toast } from '@/components/ui'
import {
  listContactMessages, setContactMessageStatus,
  type ContactMessageRow, type ContactStatus,
} from '@/lib/supabase/contact'
import { formatDate, relativeTime } from '@/lib/utils'
import { hasSupabase } from '@/lib/supabase'

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_META: Record<ContactStatus, { label: string; tone: 'gold' | 'blue' | 'trust' | 'neutral' }> = {
  new: { label: 'New', tone: 'gold' },
  read: { label: 'Read', tone: 'blue' },
  replied: { label: 'Replied', tone: 'trust' },
  archived: { label: 'Archived', tone: 'neutral' },
}

const TOPIC_LABEL: Record<string, string> = {
  sales: 'Club onboarding & pricing',
  player: 'Player account help',
  trust: 'Trust & safety concern',
  press: 'Press & partnerships',
  other: 'Something else',
}

export default function ContactMessages() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ContactMessageRow[]>([])
  const [filter, setFilter] = useState('all')

  async function load() {
    if (!hasSupabase) { setLoading(false); return }
    setLoading(true)
    try {
      setRows(await listContactMessages())
    } catch (err) {
      toast({ tone: 'error', title: 'Could not load messages', description: err instanceof Error ? err.message : undefined })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function updateStatus(id: string, status: ContactStatus) {
    const prev = rows
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    try {
      await setContactMessageStatus(id, status)
      toast({ tone: 'success', title: 'Updated', description: `Marked ${STATUS_META[status].label.toLowerCase()}.` })
    } catch (err) {
      setRows(prev)
      toast({ tone: 'error', title: 'Update failed', description: err instanceof Error ? err.message : undefined })
    }
  }

  const filtered = useMemo(() => rows.filter(r => filter === 'all' || r.status === filter), [rows, filter])
  const counts = useMemo(() => ({ new: rows.filter(r => r.status === 'new').length, total: rows.length }), [rows])

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Admin console" icon="mail" title="Contact submissions"
        subtitle={`${counts.new} new of ${counts.total} total messages from the public contact form`} />

      <div className="mt-5 flex items-center justify-between">
        <Select className="max-w-[200px]" value={filter} onChange={e => setFilter(e.target.value)}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS]} />
        <Button variant="outline" size="sm" icon="refresh" onClick={() => void load()}>Refresh</Button>
      </div>

      {!hasSupabase ? (
        <Card className="mt-3">
          <EmptyState icon="mail" title="Supabase not configured"
            description="Connect Supabase to receive and manage contact form submissions here." />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="mt-3">
          <EmptyState icon="mail" title="No messages" description="Contact form submissions will appear here." />
        </Card>
      ) : (
        <div className="mt-3 space-y-3">
          {filtered.map(r => {
            const meta = STATUS_META[r.status]
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">{r.full_name}</p>
                      <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
                      <Badge tone="neutral" size="sm">{TOPIC_LABEL[r.topic] ?? r.topic}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <a className="text-red-500 underline" href={`mailto:${r.email}`}>{r.email}</a>
                      {r.organisation ? ` · ${r.organisation}` : ''} · sent {relativeTime(r.created_at)}
                    </p>
                  </div>
                  <Select className="max-w-[160px]" value={r.status}
                    onChange={e => void updateStatus(r.id, e.target.value as ContactStatus)}
                    options={STATUS_OPTIONS} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{r.message}</p>
                <p className="mt-2 text-2xs text-ink-300">submitted {formatDate(r.created_at)}</p>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
