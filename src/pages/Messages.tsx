import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar, Badge, Button, Card, EmptyState, Input, Skeleton, toast } from '@/components/ui'
import { UpgradeCard } from '@/components/plan/FeatureGate'
import { useAuth } from '@/context/AuthContext'
import { useClub } from '@/context/ClubContext'
import { hasFeature } from '@/lib/entitlements'
import { hasSupabase } from '@/lib/supabase'
import {
  sendMessage, markConversationRead,
  getMyConversations, getConversationMessages, messageTime,
  type ConversationSummary, type Message,
} from '@/lib/supabase/messaging'
import { cn } from '@/lib/utils'

export default function Messages() {
  const { user } = useAuth()
  const { club } = useClub()
  const [params] = useSearchParams()

  const isClubUser = user?.accountType === 'club' && user.role !== 'admin'
  const isPlayerUser = user?.accountType === 'player' || user?.role === 'admin'
  const clubVerified = Boolean(club?.entity_verified)

  // Entitlement: messaging is sold to players (Elite). Clubs use it when they
  // are entity-verified (an entitled player is always required server-side).
  const playerEntitled = hasFeature(user, 'direct_messaging')

  const [convos, setConvos] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadList(selectId?: string | null) {
    if (!hasSupabase) { setLoading(false); return }
    try {
      const list = await getMyConversations()
      setConvos(list)
      let target = selectId ?? params.get('conv')
      if (target && !list.some(c => c.id === target)) target = null
      if (target) {
        setActiveId(target)
        await loadThread(target)
      }
    } catch {
      toast({ tone: 'error', title: 'Could not load conversations' })
    } finally { setLoading(false) }
  }

  async function loadThread(convId: string) {
    if (!hasSupabase) return
    try {
      const ms = await getConversationMessages(convId)
      setMsgs(ms)
      setActiveId(convId)
      void markConversationRead(convId).catch(() => {})
      // refresh unread badge
      setConvos(cs => cs.map(c => c.id === convId ? { ...c, unread: 0 } : c))
    } catch {
      toast({ tone: 'error', title: 'Could not load conversation' })
    }
  }

  useEffect(() => { void loadList() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeId) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, activeId])

  const active = useMemo(() => convos.find(c => c.id === activeId) ?? null, [convos, activeId])

  const canUse =
    (isPlayerUser && playerEntitled) ||
    (isClubUser && clubVerified)

  async function submit() {
    const body = draft.trim()
    if (!body || !activeId || sending) return
    setSending(true)
    try {
      await sendMessage(activeId, body)
      setDraft('')
      await loadThread(activeId)
    } catch (err) {
      toast({ tone: 'error', title: 'Could not send', description: err instanceof Error ? err.message : 'Please try again.' })
    } finally { setSending(false) }
  }

  if (loading) return <Skeleton className="h-96 w-full" />

  return (
    <div>
      <PageHeader breadcrumb="Workspace" icon="chat" title="Messages"
        subtitle="Private conversations with clubs and players. Participant-only and secure."
        actions={active && <Badge tone="trust" size="sm" icon="online">Live</Badge>}
      />

      {!canUse ? (
        <div className="mt-5">
          {isPlayerUser ? (
            <UpgradeCard feature="direct_messaging"
              title="Direct club messaging"
              description="Message entity-verified clubs directly about trials and opportunities. Included with Elite."
            />
          ) : (
            <div className="rounded-2xl border border-gold-200 bg-gold-50 p-5">
              <p className="text-sm font-bold text-ink-800">Verify your club to message players</p>
              <p className="mt-1 text-xs text-ink-600">Only entity-verified clubs can message players. Complete verification to get started.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <Card className="overflow-hidden">
            <div className="border-b border-ink-100 p-3">
              <Input className="max-w-full" icon="search" placeholder="Search…" />
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {convos.length === 0 ? (
                <EmptyState icon="chat" title="No conversations yet"
                  description={isPlayerUser
                    ? 'Message a verified club from any open trial to start chatting.'
                    : 'Open a player profile and choose "Message" to start chatting.'} />
              ) : convos.map(c => (
                <button key={c.id} onClick={() => void loadThread(c.id)}
                  className={cn('flex w-full items-center gap-3 border-b border-ink-50 px-3 py-3 text-left transition-colors hover:bg-ink-50',
                    activeId === c.id && 'bg-ink-50')}>
                  <Avatar name={c.other_name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-ink-800">{c.other_name}</p>
                      {c.last_message_at && <span className="shrink-0 text-2xs text-ink-400">{messageTime(c.last_message_at)}</span>}
                    </div>
                    <p className="truncate text-xs text-ink-500">{c.last_message || 'No messages yet'}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{c.unread}</span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Thread */}
          <Card className="flex flex-col overflow-hidden" >
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-10">
                <EmptyState icon="chat" title="Select a conversation"
                  description="Choose a conversation on the left, or message a verified club/player from their profile." />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-ink-100 p-4">
                  <Avatar name={active.other_name} size={38} />
                  <div>
                    <p className="text-sm font-bold text-ink-900">{active.other_name}</p>
                    <p className="text-2xs text-ink-500">
                      {active.other_role === 'club' ? 'Entity-verified club' : 'Player'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '55vh', minHeight: '320px' }}>
                  {msgs.length === 0 && (
                    <p className="text-center text-xs text-ink-400">No messages yet. Say hello.</p>
                  )}
                  {msgs.map(m => {
                    const mine = m.sender_id === user?.id
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                          mine ? 'rounded-br-sm bg-ink-900 text-white' : 'rounded-bl-sm bg-ink-100 text-ink-800')}>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                          <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-white/50' : 'text-ink-400')}>
                            {messageTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-ink-100 p-3">
                  <div className="flex items-end gap-2">
                    <Input value={draft} onChange={e => setDraft(e.target.value)}
                      placeholder="Write a message…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }} />
                    <Button icon="send" loading={sending} disabled={!draft.trim()} onClick={() => void submit()}>Send</Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
