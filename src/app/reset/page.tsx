'use client'

import { useEffect, useState } from 'react'

export default function ResetPage() {
  const [status, setStatus] = useState('초기화 준비 중...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let mounted = true
    const log = (msg: string) => { if (mounted) setStatus(msg) }

    const run = async () => {
      try {
        log('Service Worker 해제 중...')
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          for (const r of regs) {
            try { await r.unregister() } catch {}
          }
        }

        log('모든 캐시 삭제 중...')
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys()
          for (const k of keys) {
            try { await caches.delete(k) } catch {}
          }
        }

        log('로컬 저장소 초기화 중...')
        try {
          const keep = ['sb-nwyxawtqpdqbsqkpjucu-auth-token']
          const allKeys = Object.keys(localStorage)
          for (const k of allKeys) {
            if (!keep.some((kept) => k.includes(kept))) {
              try { localStorage.removeItem(k) } catch {}
            }
          }
          sessionStorage.clear()
        } catch {}

        log('완료 — 3초 후 메인 페이지로 이동')
        await new Promise((r) => setTimeout(r, 3000))
        if (mounted) {
          setDone(true)
          location.replace('/ot?_reset=' + Date.now())
        }
      } catch (e) {
        log('오류: ' + (e instanceof Error ? e.message : String(e)))
      }
    }

    run()
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#facc15' }}>앱 초기화 중</h1>
        <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '1.5rem' }}>
          옛 캐시 및 Service Worker를 제거하고 있습니다.<br />
          잠시만 기다려주세요.
        </p>
        <div style={{ background: '#1f1f1f', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#fff', margin: 0 }}>{status}</p>
        </div>
        {done && (
          <a
            href="/ot"
            style={{ display: 'inline-block', padding: '0.6rem 1.5rem', background: '#facc15', color: '#000', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            메인으로 이동
          </a>
        )}
      </div>
    </div>
  )
}
