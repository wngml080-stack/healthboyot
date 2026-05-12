'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Supabase Realtime 변경 이벤트를 구독하고
 * router.refresh()로 서버 컴포넌트를 다시 렌더링한다.
 *
 * 3초 디바운스 + 탭 비활성 시 구독 일시 중지로 모바일 성능 보호.
 */
export function useRealtimeOT() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isVisible = useRef(true)
  const pendingRefresh = useRef(false)

  const scheduleRefresh = useCallback(() => {
    if (!isVisible.current) {
      // 탭이 비활성이면 대기 표시만 하고, 복귀 시 한 번만 refresh
      pendingRefresh.current = true
      return
    }
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      router.refresh()
      refreshTimer.current = null
      pendingRefresh.current = false
    }, 1000) // 1초 디바운스 — 다른 디바이스 변경을 빠르게 반영하면서 연속 이벤트는 병합
  }, [router])

  useEffect(() => {
    const supabase = supabaseRef.current

    // 모든 핵심 테이블의 INSERT/UPDATE/DELETE를 wildcard로 listen — PC ↔ 모바일 즉시 동기화
    const channel = supabase
      .channel('ot-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ot_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ot_sessions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_schedules' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pt_members' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ot_programs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, scheduleRefresh)
      .subscribe()

    // 탭 비활성 시 refresh 억제, 복귀 시 대기 중이면 한 번만 refresh
    const handleVisibility = () => {
      isVisible.current = document.visibilityState === 'visible'
      if (isVisible.current && pendingRefresh.current) {
        scheduleRefresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [scheduleRefresh])
}
