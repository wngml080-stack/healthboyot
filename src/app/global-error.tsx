'use client'

import { useEffect, useState } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="ko">
      <body style={{ backgroundColor: '#111', color: '#fff', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: 500 }}>잠시 후 다시 시도해주세요</h2>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
            <button
              onClick={() => reset()}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#facc15', color: '#000', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              다시 시도
            </button>
            <button
              onClick={() => { window.location.href = '/login' }}
              style={{ padding: '0.625rem 1.5rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              로그인으로
            </button>
          </div>
          <button
            onClick={() => setShowDetail(!showDetail)}
            style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showDetail ? '에러 숨기기' : '에러 보기'}
          </button>
          {showDetail && (
            <div style={{ marginTop: '0.75rem', maxWidth: '90%', padding: '0.75rem', background: '#1f1f1f', borderRadius: '0.5rem', textAlign: 'left' }}>
              <p style={{ fontSize: '0.7rem', color: '#f87171', wordBreak: 'break-word', margin: '0 0 0.5rem 0' }}>
                {error.message || '(no message)'}
              </p>
              {error.digest && (
                <p style={{ fontSize: '0.65rem', color: '#888', margin: 0 }}>digest: {error.digest}</p>
              )}
              {error.stack && (
                <pre style={{ fontSize: '0.6rem', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflow: 'auto', marginTop: '0.5rem' }}>
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </body>
    </html>
  )
}
