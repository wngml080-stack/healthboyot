// HTML network-first SW — iOS PWA standalone 모드에서 옛 HTML 캐시로 React 에러 #310 발생 방지.
// 매 페이지 요청마다 네트워크에서 HTML을 받아 fresh chunks 참조 보장.
// 이전 unregister-only SW를 대체.

const CACHE = 'app-shell-v1'

self.addEventListener('install', (event) => {
  // 즉시 새 SW로 교체 — 이전 버전 대기 안 함
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 옛 캐시 모두 제거 (이름이 다른 cache 모두 정리)
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // 외부 도메인은 패스
  if (url.origin !== self.location.origin) return

  const accept = req.headers.get('accept') || ''
  const isHtml = req.mode === 'navigate' || accept.includes('text/html')

  if (isHtml) {
    // HTML은 항상 네트워크 우선 — 옛 HTML이 캐시에 박혀 있어도 fresh fetch
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => {
        // 네트워크 실패 시에만 캐시 fallback
        return caches.match(req).then((res) => res || new Response('Offline', { status: 503 }))
      })
    )
    return
  }

  // _next/static 의 hashed chunks: 캐시 우선 (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
      })
    )
    return
  }

  // 그 외는 default fetch
})
