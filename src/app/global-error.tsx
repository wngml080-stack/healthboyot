'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

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
            {error.stack && (
              <pre style={{ fontSize: '0.6rem', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflow: 'auto', marginTop: '0.5rem', marginBottom: 0 }}>
                {error.stack.split('\n').slice(0, 8).join('\n')}
              </pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
        </div>
      </body>
    </html>
  )
}
