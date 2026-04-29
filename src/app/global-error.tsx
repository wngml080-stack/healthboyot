'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body style={{ backgroundColor: '#111', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>문제가 발생했습니다</h2>
          <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem' }}>
            {error.message || '알 수 없는 오류'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => reset()}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#facc15', color: '#000', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              다시 시도
            </button>
            <button
              onClick={() => {
                // SW 캐시 초기화 후 새로고침
                if ('caches' in window) {
                  caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name))
                  })
                }
                window.location.reload()
              }}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              캐시 초기화
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
