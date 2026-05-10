'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { DebugErrorBoundary } from './debug-error-boundary'

const VERSION_CHECK_KEY = '__build_id_v1'
const VERSION_RELOAD_KEY = '__build_reload_done'

// 옛 HTML이 캐시에 박혀 옛 chunks를 로드하면 React 에러 (#310 등)가 난다.
// 마운트 시 서버에 현재 빌드 ID를 물어보고 stored 값과 다르면 한 번만 강제 새로고침.
async function checkBuildVersion() {
  try {
    const res = await fetch('/api/build-id', { cache: 'no-store' })
    if (!res.ok) return
    const { buildId } = await res.json() as { buildId: string }
    const stored = localStorage.getItem(VERSION_CHECK_KEY)
    if (stored && stored !== buildId) {
      // 빌드 ID가 바뀌었음 → stale HTML 가능성 → 한 번만 강제 새로고침
      if (!sessionStorage.getItem(VERSION_RELOAD_KEY)) {
        sessionStorage.setItem(VERSION_RELOAD_KEY, '1')
        localStorage.setItem(VERSION_CHECK_KEY, buildId)
        const u = new URL(window.location.href)
        u.searchParams.set('_v', buildId)
        window.location.replace(u.toString())
        return
      }
    }
    localStorage.setItem(VERSION_CHECK_KEY, buildId)
  } catch {}
}

export function Providers({ children }: { children: React.ReactNode }) {
  // 옛 SW 해제 (새 SW 도입했다 #310 재발해 다시 unregister-only로 롤백)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      })
    }
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
    }
    // stale HTML 감지
    checkBuildVersion()
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5분 — 모바일 탭 전환 시 불필요한 재요청 방지
            refetchOnWindowFocus: false, // 포커스 복귀 시 자동 재요청 비활성화 (실시간 구독이 대체)
          },
        },
      })
  )

  return (
    <DebugErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </DebugErrorBoundary>
  )
}
