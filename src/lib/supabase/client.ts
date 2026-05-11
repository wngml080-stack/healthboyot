'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 모듈 레벨 싱글톤 — 같은 브라우저 탭 안에서는 단 하나의 GoTrueClient만 유지.
// 여러 인스턴스가 동시에 같은 cookie storage에서 세션을 비동기 복원하면
// 첫 query가 anon으로 나가 RLS가 빈 결과를 돌려주는 race가 발생함.
// (Supabase 공식 경고: "Multiple GoTrueClient instances detected...")
let browserClient: SupabaseClient | null = null
let sessionReadyPromise: Promise<void> | null = null

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}

// 세션 in-memory 복원 완료를 보장하는 Promise.
// 두 신호를 race:
//   1. INITIAL_SESSION 이벤트 (GoTrueClient initialize 완료 시 발화)
//   2. getSession() resolve (이미 메모리에 있거나, initialize 후 반환)
// 5초 안전망 타임아웃으로 무한 대기 차단.
export function waitForSupabaseReady(): Promise<void> {
  if (sessionReadyPromise) return sessionReadyPromise
  sessionReadyPromise = new Promise<void>((resolve) => {
    const client = createClient()
    let resolved = false
    const done = () => {
      if (resolved) return
      resolved = true
      try { subscription.unsubscribe() } catch {}
      clearTimeout(timeout)
      resolve()
    }
    // 1) INITIAL_SESSION 이벤트 대기 (initialize 완료 신호)
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') done()
    })
    // 2) getSession() — initialize 끝나면 resolve (이미 끝났으면 즉시)
    client.auth.getSession().then(done).catch(done)
    // 3) 안전망: 5초 후 강제 해제 (네트워크 문제 등으로 무한 대기 차단)
    const timeout = setTimeout(done, 5000)
  })
  return sessionReadyPromise
}
