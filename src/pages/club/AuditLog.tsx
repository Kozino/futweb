import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, Card, EmptyState, Skeleton, toast } from '@/components/ui'
import { UpgradeCard } from '@/components/plan/FeatureGate'
import { useClub } from '@/context/ClubContext'
import { useAuth } from '@/context/AuthContext'
import { hasFeature } from '@/lib/entitlements'
import { hasSupabase } from '@/lib/supabase'
import {
  getClubAuditLog,
  clubAuditToCsv,
  auditActionLabel,
  type ClubAuditRow,
} from '@/lib/supabase/audit'
import { formatDate, relativeTime } from '@/lib/utils'

export default function ClubAuditLog() {
  const { club } = useClub()
  const { user } = useAuth()

  const [rows, setRows] = useState<ClubAuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const entitled = hasFeature(user, 'audit_export')
  const clubId = club?.id

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!hasSupabase || !clubId) { setLoading(false); return }
      try {
        const data = await getClubAuditLog(clubId)
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) toast({ tone: 'error', title: 'Could not load audit log', description: 'Ensure the audit migration is applied, then retry.' })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clubId])

  const summary = useMemo(() => {
    const by = new Map<string, number>()
    for (const r of rows) by.set(r.action, (by.get(r.action) ?? 0) + 1)
    return by
  }, [rows])

  function doExport() {
    setExporting(true)
    try {
      const csv = clubAuditToCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `futweb-club-audit-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ tone: 'success', title: 'Audit log exported', description: `${rows.length} events written to CSV.` })
    } catch {
      toast({ tone: 'error', title: 'Export failed', description: 'Try again shortly.' })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Club workspace" icon="doc"
        title="Audit log"
        subtitle="A compliance-ready record of activity within your club."
        actions={
          entitled && rows.length > 0 ? (
            <Button icon="download" loading={exporting} onClick={doExport}>Export CSV</Button>
          ) : undefined
        }
      />

      {!entitled ? (
        <div className="mt-5">
          <UpgradeCard feature="audit_export"
            title="Audit log & export"
            description="Record and export your club's activity for compliance. Included with Pro Club." />
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-5">
          <EmptyState icon="doc" title="No activity recorded yet"
            description="Actions like posting a trial, adding staff, or writing a scout report will appear here automatically." />
        </Card>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {[...summary.entries()].slice(0, 8).map(([action, count]) => (
              <Badge key={action} tone="neutral" size="sm">{auditActionLabel(action)} · {count}</Badge>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-2xs font-bold uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Event</th>
                    <th className="px-5 py-3">Actor</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-ink-100 align-top">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-500">
                        <p title={formatDate(r.created_at)}>{relativeTime(r.created_at)}</p>
                        <p className="text-2xs text-ink-300">{formatDate(r.created_at)}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="font-semibold text-ink-800">{auditActionLabel(r.action)}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-600">
                        {r.actor_name}
                        <p className="text-2xs text-ink-400">{r.actor_role}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="line-clamp-2 text-xs text-ink-600">{JSON.stringify(r.metadata)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/60 px-5 py-3">
              <p className="text-2xs text-ink-500">Append-only · cannot be edited or deleted</p>
              <span className="text-2xs font-semibold text-ink-600">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
