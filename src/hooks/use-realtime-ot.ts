'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeOT() {
  const queryClient = useQueryClient()
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel('ot-realtime')
      // OT 배정 변경 → 목록만 갱신 (INSERT/UPDATE만)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ot_assignments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ot_assignments'] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ot_assignments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ot_assignments'] })
          queryClient.invalidateQueries({ queryKey: ['ot_detail'] })
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        }
      )
      // 회원 변경 → 회원 목록만 갱신
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'members' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['members'] })
        }
      )
      // OT 세션 변경 → 상세만 갱신
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ot_sessions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ot_detail'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
