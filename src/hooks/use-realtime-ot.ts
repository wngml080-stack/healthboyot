'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Supabase Realtime 변경 이벤트를 구독하고
 * router.refresh()로 서버 컴포넌트를 다시 렌더링한다.
 *
 * burst 이벤트 (예: 일괄 INSERT) 대응을 위해 500ms 디바운스로 묶어서 한 번만 refresh 한다.
 */
export function useRealtimeOT() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        router.refresh()
        refreshTimer = null
      }, 500)
    }

    const channel = supabase
      .channel('ot-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ot_assignments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ot_sessions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [router])
}
