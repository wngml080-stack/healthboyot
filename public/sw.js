// 서비스 워커 해제 전용.
// 기존 iOS PWA가 오래된 app-shell/청크를 계속 잡고 있으면 React가 뜨기 전에도
// 실패할 수 있으므로, 새 SW가 활성화되는 순간 정적 reset 페이지로 보낸다.
const RESET_URL = '/reset.html?from=sw&ts='

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))

    await self.clients.claim()

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    await Promise.all(windows.map((client) => {
      if ('navigate' in client) {
        return client.navigate(RESET_URL + Date.now()).catch(() => undefined)
      }
      return undefined
    }))

    await self.registration.unregister()
  })())
})

// 활성화 직후의 과도기에도 캐시 응답을 절대 쓰지 않는다.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
