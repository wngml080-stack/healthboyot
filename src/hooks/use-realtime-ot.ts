'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeOT() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('ot-realtime')
      // OT 배정 변경 → 목록 갱신
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ot_assignments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ot_assignments'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }
      )
      // 회원 변경 → 회원 목록 갱신
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['members'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }
      )
      // OT 세션 변경 → 상세/목록 갱신
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ot_sessions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ot_assignments'] })
          queryClient.invalidateQueries({ queryKey: ['ot_detail'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])
}
