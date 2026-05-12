// 서비스 워커 해제 전용.
// 기존 PWA에 남아 있는 registration만 조용히 제거한다.
// 클라이언트를 reset 페이지로 강제 이동시키면 iOS PWA에서 매 실행마다
// "앱 초기화"가 반복될 수 있으므로 자동 navigation은 하지 않는다.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))

    await self.clients.claim()
    await self.registration.unregister()
  })())
})

// 활성화 직후의 과도기에도 캐시 응답을 절대 쓰지 않는다.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
