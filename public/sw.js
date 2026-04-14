const CACHE_NAME = 'healthboy-v1'

// 설치 시 기본 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/ot', '/dashboard', '/manifest.json'])
    )
  )
  self.skipWaiting()
})

// 활성화 시 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// 네트워크 우선 전략 (실시간 데이터가 중요한 관리 시스템)
self.addEventListener('fetch', (event) => {
  // API 요청이나 POST 등은 캐싱하지 않음
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답을 캐시에 저장
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // 네비게이션 요청이면 오프라인 페이지 대신 캐시된 /ot 반환
          if (event.request.mode === 'navigate') {
            return caches.match('/ot')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
