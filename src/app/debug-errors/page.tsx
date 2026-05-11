'use client'

import { useState, useEffect } from 'react'

interface ErrorLogEntry {
  t: string
  prefix: string
  msg: string
  stack: string
  extra: unknown
  url: string
}

export default function DebugErrorsPage() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([])
  const [meta, setMeta] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('__error_log')
      const arr = raw ? (JSON.parse(raw) as ErrorLogEntry[]) : []
      setErrors(arr)
    } catch {}

    setMeta({
      userAgent: navigator.userAgent,
      'window.innerWidth': String(window.innerWidth),
      'window.innerHeight': String(window.innerHeight),
      'devicePixelRatio': String(window.devicePixelRatio),
      buildId: document.documentElement.getAttribute('data-build') || 'unknown',
      buildIdStored: localStorage.getItem('__build_id') || '(없음)',
      hasServiceWorker: 'serviceWorker' in navigator ? 'yes' : 'no',
      hasLocalStorage: 'localStorage' in window ? 'yes' : 'no',
      cookieEnabled: String(navigator.cookieEnabled),
      currentTime: new Date().toISOString(),
      currentURL: location.href,
    })
  }, [])

  const fullReport = () => {
    const lines: string[] = []
    lines.push('=== 환경 정보 ===')
    for (const [k, v] of Object.entries(meta)) {
      lines.push(`${k}: ${v}`)
    }
    lines.push('')
    lines.push(`=== 에러 로그 ${errors.length}개 ===`)
    errors.forEach((e, i) => {
      lines.push('')
      lines.push(`[${i + 1}] ${e.prefix} @ ${e.t}`)
      lines.push(`URL: ${e.url}`)
      lines.push(`MSG: ${e.msg}`)
      if (e.stack) lines.push(`STACK:\n${e.stack}`)
      if (e.extra) lines.push(`EXTRA: ${JSON.stringify(e.extra)}`)
    })
    return lines.join('\n')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullReport())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = fullReport()
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClear = () => {
    if (!confirm('에러 로그를 모두 지울까요?')) return
    try { localStorage.removeItem('__error_log') } catch {}
    setErrors([])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>에러 진단 페이지</h1>
      <p style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '1rem' }}>
        이 페이지의 정보를 캡처하거나 복사해서 보내주세요.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleCopy}
          style={{ padding: '0.5rem 1rem', background: '#facc15', color: '#000', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}
        >
          {copied ? '복사됨 ✓' : '전체 정보 복사'}
        </button>
        <button
          onClick={handleClear}
          style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem' }}
        >
          에러 로그 지우기
        </button>
        <a
          href="/ot"
          style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block' }}
        >
          /ot 접속
        </a>
        <a
          href="/dashboard"
          style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-block' }}
        >
          /dashboard 접속
        </a>
      </div>

      <section style={{ background: '#1f1f1f', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.5rem' }}>환경 정보</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.25rem', fontSize: '0.7rem' }}>
          {Object.entries(meta).map(([k, v]) => (
            <div key={k} style={{ borderBottom: '1px solid #2a2a2a', paddingBottom: '0.25rem', wordBreak: 'break-all' }}>
              <span style={{ color: '#999' }}>{k}:</span>{' '}
              <span style={{ color: '#fff' }}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
          에러 로그 ({errors.length}개)
        </h2>
        {errors.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#666', padding: '1rem', textAlign: 'center', background: '#1f1f1f', borderRadius: '0.5rem' }}>
            에러 없음
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {errors.map((e, i) => (
              <div key={i} style={{ background: '#1f1f1f', padding: '0.6rem', borderRadius: '0.4rem', borderLeft: '3px solid #dc2626' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 600 }}>
                    [{i + 1}] {e.prefix}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: '#666' }}>{e.t.slice(11, 19)}</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#999', marginBottom: '0.25rem', wordBreak: 'break-all' }}>
                  URL: {e.url}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                  {e.msg}
                </div>
                {e.stack && (
                  <details>
                    <summary style={{ fontSize: '0.6rem', color: '#666', cursor: 'pointer' }}>stack ({e.stack.split('\n').length} lines)</summary>
                    <pre style={{ fontSize: '0.55rem', color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '0.3rem', maxHeight: '200px', overflow: 'auto' }}>
                      {e.stack}
                    </pre>
                  </details>
                )}
                {!!e.extra && (
                  <details>
                    <summary style={{ fontSize: '0.6rem', color: '#666', cursor: 'pointer' }}>extra</summary>
                    <pre style={{ fontSize: '0.55rem', color: '#777', whiteSpace: 'pre-wrap', marginTop: '0.3rem' }}>
                      {JSON.stringify(e.extra, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
