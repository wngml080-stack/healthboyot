const CACHE_NAME = 'healthboy-v2'

// 설치 시 기본 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/manifest.json'])
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
  // http/https 이외의 스킴 (chrome-extension:// 등)은 무시
  if (!event.request.url.startsWith('http')) {
    return
  }

  // API 요청이나 POST 등은 캐싱하지 않음
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('supabase')
  ) {
    return
  }

  // HTML 네비게이션 요청은 항상 네트워크에서 가져옴 (캐시 불일치 방지)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response('오프라인 상태입니다. 네트워크를 확인해주세요.', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        )
      )
    )
    return
  }

  // 정적 리소스만 캐싱 (JS, CSS, 이미지, 폰트)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response('Offline', { status: 503 })
        )
      )
  )
})
