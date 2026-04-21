'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Supabase Realtime 변경 이벤트를 구독하고
 * router.refresh()로 서버 컴포넌트를 다시 렌더링한다.
 *
 * 1초 디바운스 + 탭 비활성 시 구독 일시 중지로 불필요한 refresh 방지.
 */
export function useRealtimeOT() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isVisible = useRef(true)

  const scheduleRefresh = useCallback(() => {
    if (!isVisible.current) return
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      router.refresh()
      refreshTimer.current = null
    }, 1000)
  }, [router])

  useEffect(() => {
    const supabase = supabaseRef.current

    const channel = supabase
      .channel('ot-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ot_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ot_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ot_sessions' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ot_sessions' }, scheduleRefresh)
      .subscribe()

    // 탭 비활성 시 refresh 억제
    const handleVisibility = () => {
      isVisible.current = document.visibilityState === 'visible'
      if (isVisible.current) scheduleRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [scheduleRefresh])
}
