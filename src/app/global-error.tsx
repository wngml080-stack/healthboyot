'use client'

import { useEffect, useState } from 'react'

const RECOVERY_FLAG = '__ge_recovered_v2'

async function purgeAndHardReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const ks = await caches.keys()
      await Promise.all(ks.map((k) => caches.delete(k)))
    }
  } catch {}
  // 캐시 우회 — 새 URL로 인식시켜 fresh HTML 받기
  const u = new URL(window.location.href)
  u.searchParams.set('_cb', Date.now().toString())
  window.location.replace(u.toString())
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    console.error('[GlobalError]', error)
    // 세션당 1회만 자동 강제 새로고침 (옛 HTML/chunks 캐시 무효화)
    try {
      if (!sessionStorage.getItem(RECOVERY_FLAG)) {
        sessionStorage.setItem(RECOVERY_FLAG, '1')
        purgeAndHardReload()
        return
      }
    } catch {}
    setExhausted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 자동 복구 시도 중 — 검정 화면
  if (!exhausted) {
    return (
      <html lang="ko">
        <body style={{ backgroundColor: '#111', margin: 0 }}>
          <div style={{ minHeight: '100vh' }} />
        </body>
      </html>
    )
  }

  // 자동 복구 실패 — 사용자 수동 조작 안내
  return (
    <html lang="ko">
      <body style={{ backgroundColor: '#111', color: '#fff', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '1.5rem', textAlign: 'center', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', fontWeight: 500 }}>잠시 후 다시 시도해주세요</h2>
          <div style={{ width: '100%', maxWidth: '420px', padding: '0.75rem', background: '#7f1d1d33', borderRadius: '0.5rem', marginBottom: '1.25rem', textAlign: 'left' }}>
            <p style={{ fontSize: '0.75rem', color: '#fca5a5', wordBreak: 'break-word', margin: 0, lineHeight: 1.5 }}>
              <strong>에러:</strong> {error.message || '(no message)'}
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.65rem', color: '#999', margin: '0.4rem 0 0 0' }}>digest: {error.digest}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                try { sessionStorage.removeItem(RECOVERY_FLAG) } catch {}
                purgeAndHardReload()
              }}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#facc15', color: '#000', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              강제 새로고침
            </button>
            <button
              onClick={() => { window.location.href = '/login' }}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              로그인으로
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
