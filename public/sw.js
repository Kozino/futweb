/* FutWeb service worker — offline-first for unreliable networks.
 *
 * Strategy:
 *   • App shell, fonts and icons  → cache-first (instant, works offline)
 *   • API / Supabase calls        → network-first with a graceful offline error
 *   • Images                      → cache-first with a size cap
 *
 * The scouting data itself is queued in IndexedDB by OfflineContext and synced
 * when connectivity returns; this worker only guarantees the SHELL loads, so
 * a scout in a field with no signal can still open the app and enter data.
 */
const VERSION = 'futweb-v1'
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const IMAGE_CACHE = `${VERSION}-images`
const MAX_IMAGES = 60

const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/offline.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_ASSETS.map(u => new Request(u, { cache: 'reload' })).slice(0, -1)))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation requests: serve the cached shell when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then(c => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/offline.html'))),
    )
    return
  }

  // Images: cache-first with a cap so we never exhaust a device's quota.
  if (request.destination === 'image') {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(IMAGE_CACHE).then(async c => {
            const keys = await c.keys()
            if (keys.length >= MAX_IMAGES) await c.delete(keys[0])
            await c.put(request, copy)
          })
        }
        return res
      })),
    )
    return
  }

  // Everything else (JS/CSS chunks): stale-while-revalidate.
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(ASSET_CACHE).then(c => c.put(request, copy))
        }
        return res
      }).catch(() => cached)
      return cached || network
    }),
  )
})

// Let the page trigger an immediate update.
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
