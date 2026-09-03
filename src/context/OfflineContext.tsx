import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { openDB, type IDBPDatabase } from 'idb'
import { uuid } from '@/lib/utils'

/**
 * Offline-first capture — FutWeb's wedge against Wyscout/InStat.
 *
 * Reality: a scout at a dusty pitch in Katsina or a state FA tournament in
 * Makurdi has 1–2 bars of 3G, if any. Incumbents assume fibre. If the form
 * loses the network mid-entry, the assessment is lost and the player is lost.
 *
 * Here, every rating/report write lands in IndexedDB first and is flushed to
 * the server when connectivity returns. Nothing a scout types is ever lost.
 */

export type QueueKind = 'rating' | 'report' | 'trial'

export interface QueuedWrite {
  localId: string
  kind: QueueKind
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError?: string
  synced: boolean
}

const DB_NAME = 'futweb-offline'
const STORE = 'queue'

interface OfflineState {
  online: boolean
  pending: QueuedWrite[]
  syncing: boolean
  lastSyncedAt: string | null
  enqueue: (kind: QueueKind, payload: Record<string, unknown>) => Promise<string>
  syncNow: () => Promise<void>
  clearSynced: () => Promise<void>
  /** User preference: reduce payloads on metered/slow connections. */
  dataSaver: boolean
  toggleDataSaver: () => void
}

const OfflineContext = createContext<OfflineState | null>(null)

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'localId' })
        s.createIndex('synced', 'synced')
      }
    },
  })
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pending, setPending] = useState<QueuedWrite[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [dataSaver, setDataSaver] = useState(
    () => localStorage.getItem('futweb.datasaver') === '1',
  )

  const refresh = useCallback(async () => {
    try {
      const db = await getDB()
      const all = (await db.getAll(STORE)) as QueuedWrite[]
      setPending(all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
    } catch { /* IndexedDB unavailable (private mode) — degrade gracefully */ }
  }, [])

  useEffect(() => {
    const on = () => { setOnline(true); void syncNow() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Flush opportunistically when the tab regains focus.
  useEffect(() => {
    const onFocus = () => { if (navigator.onLine) void syncNow() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enqueue = useCallback(async (kind: QueueKind, payload: Record<string, unknown>) => {
    const item: QueuedWrite = {
      localId: uuid(), kind, payload, createdAt: new Date().toISOString(), attempts: 0, synced: false,
    }
    try {
      const db = await getDB()
      await db.put(STORE, item)
      await refresh()
    } catch {
      // Fallback: keep it in memory so the UI still reflects unsynced work.
      setPending(p => [item, ...p])
    }
    return item.localId
  }, [refresh])

  const syncNow = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const db = await getDB()
      const items = (await db.getAll(STORE)) as QueuedWrite[]
      for (const item of items.filter(i => !i.synced)) {
        try {
          // Demo mode: simulate a round-trip. In production this POSTs to the
          // Supabase-backed sync endpoint, which re-verifies auth and RLS.
          await new Promise(r => setTimeout(r, 320))
          await db.put(STORE, { ...item, synced: true })
        } catch (e) {
          await db.put(STORE, { ...item, attempts: item.attempts + 1, lastError: String(e) })
        }
      }
      setLastSyncedAt(new Date().toISOString())
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [syncing, refresh])

  const clearSynced = useCallback(async () => {
    try {
      const db = await getDB()
      const items = (await db.getAll(STORE)) as QueuedWrite[]
      for (const i of items.filter(i => i.synced)) await db.delete(STORE, i.localId)
      await refresh()
    } catch { /* noop */ }
  }, [refresh])

  const toggleDataSaver = useCallback(() => {
    setDataSaver(prev => {
      const next = !prev
      localStorage.setItem('futweb.datasaver', next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <OfflineContext.Provider value={{ online, pending, syncing, lastSyncedAt, enqueue, syncNow, clearSynced, dataSaver, toggleDataSaver }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  const ctx = useContext(OfflineContext)
  if (!ctx) throw new Error('useOffline must be used inside <OfflineProvider>')
  return ctx
}
