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

const MAX_RETRIES = 5

export function PtMembersLoader() {
  const [data, setData] = useState<CacheShape | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      console.log('[PtMembersLoader] fetch 시작', 'attempt=', retryCountRef.current)
      // 토큰 자동 리프레시 트리거 (만료 케이스 회피)
      const supabase = createClient()
      await supabase.auth.getSession()

      const month = todayMonth()
      const [members, trainers] = await Promise.all([
        fetchPtMembersClient(undefined, month),
        fetchTrainersForPtClient(),
      ])
      if (cancelledRef.current) return
      console.log('[PtMembersLoader] fetch 결과', { trainers: trainers.length, members: members.length })

      // RLS/토큰 일시 실패로 빈 trainers를 받으면 자동 재시도
      if (trainers.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 250 * retryCountRef.current
        console.warn('[PtMembersLoader] trainers 비어있음 — 재시도', retryCountRef.current, '/', MAX_RETRIES)
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
        return
      }

      const result = { members, trainers, month, ts: Date.now() }
      if (trainers.length > 0) cache = result
      retryCountRef.current = 0
      setData(result)
    } catch (err) {
      console.warn('[PtMembersLoader] 로딩 실패 (재시도', retryCountRef.current + 1, '/', MAX_RETRIES, '):', err)
      if (cancelledRef.current) return
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 250 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
      } else {
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    retryCountRef.current = 0
    // 마운트 시 즉시 fetch — 빈 trainers/실패면 retry 루프 진입
    void fetchData()

    // 탭 복귀 시 데이터가 비어있으면 재조회
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cache) {
        retryCountRef.current = 0
        void fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // INITIAL_SESSION/SIGNED_IN 이벤트 시 cache 비어있으면 재조회 (보조 트리거)
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelledRef.current) return
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !cache) {
        retryCountRef.current = 0
        void fetchData()
      }
    })

    return () => {
      cancelledRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      subscription.unsubscribe()
    }
  }, [fetchData])

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <span className="text-sm">{error}</span>
        <button
          onClick={() => { retryCountRef.current = 0; void fetchData() }}
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
