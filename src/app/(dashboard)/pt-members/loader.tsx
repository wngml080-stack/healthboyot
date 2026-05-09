'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { PtMemberList } from '@/components/pt-members/pt-member-list'
import type { PtMember } from '@/actions/pt-members'
import { fetchPtMembersClient, fetchTrainersForPtClient } from '@/lib/pt-members-client'
import { createClient } from '@/lib/supabase/client'

type CacheShape = { members: PtMember[]; trainers: { id: string; name: string }[]; month: string; ts: number }
let cache: CacheShape | null = null

// 외부에서 캐시 무효화 (삭제/생성/수정 후 호출 → 다음 마운트 시 fresh fetch)
export function invalidatePtMembersCache() {
  cache = null
}

// KST 기준 현재 월 'YYYY-MM'
function todayMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function PtMembersLoader() {
  const [data, setData] = useState<CacheShape | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const month = todayMonth()
      const [members, trainers] = await Promise.all([
        fetchPtMembersClient(undefined, month),
        fetchTrainersForPtClient(),
      ])
      if (cancelledRef.current) return
      const result = { members, trainers, month, ts: Date.now() }
      cache = result
      setData(result)
    } catch (err) {
      console.error('[PtMembersLoader] 로딩 실패:', err)
      if (cancelledRef.current) return
      setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    void fetchData()

    // 첫 로그인/세션 복원 시 데이터 비어있으면 재조회 (RLS 빈 결과 케이스)
    // TOKEN_REFRESHED는 1시간마다 자동 발생하므로 제외
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !cache) {
        void fetchData()
      }
    })

    return () => {
      cancelledRef.current = true
      subscription.unsubscribe()
    }
  }, [fetchData])

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <span className="text-sm">{error}</span>
        <button
          onClick={() => void fetchData()}
          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> 다시 시도
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">PT 회원 목록을 불러오는 중...</span>
      </div>
    )
  }

  return <PtMemberList initialMembers={data.members} trainers={data.trainers} initialMonth={data.month} />
}
