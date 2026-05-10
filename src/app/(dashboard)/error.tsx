'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
    if (typeof window !== 'undefined') {
      try { (window as unknown as { __lastDashError: unknown }).__lastDashError = error } catch {}
    }
  }, [error])

  return (
    <div style={{
      padding: '1.5rem',
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1e3a8a', // 파란 배경 — dashboard error.tsx가 잡았는지 확인용
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', color: '#fde68a', marginBottom: '0.5rem', fontFamily: 'monospace' }}>[DASHBOARD_ERROR_BOUNDARY]</p>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>잠시 후 다시 시도해주세요</h2>
        <div style={{ background: '#7f1d1d33', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'left', marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#fca5a5', wordBreak: 'break-word', margin: 0 }}>
            <strong>에러:</strong> {error.message || '(no message)'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.65rem', color: '#999', margin: '0.4rem 0 0 0' }}>digest: {error.digest}</p>
          )}
          {error.stack && (
            <pre style={{ fontSize: '0.6rem', color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflow: 'auto', marginTop: '0.5rem', marginBottom: 0 }}>
              {error.stack.split('\n').slice(0, 10).join('\n')}
            </pre>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={reset} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#facc15', color: '#000', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}>다시 시도</button>
          <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}>새로고침</button>
        </div>
      </div>
    </div>
  )
}
