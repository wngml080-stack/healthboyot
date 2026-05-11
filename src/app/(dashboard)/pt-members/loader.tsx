'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { PtMemberList } from '@/components/pt-members/pt-member-list'
import type { PtMember } from '@/actions/pt-members'
import { fetchPtMembersClient, fetchTrainersForPtClient } from '@/lib/pt-members-client'
import { createClient, waitForSupabaseReady } from '@/lib/supabase/client'

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

interface LoaderProps {
  initialMembers?: PtMember[]
  initialTrainers?: { id: string; name: string }[]
  initialMonth?: string
}

export function PtMembersLoader({ initialMembers, initialTrainers, initialMonth }: LoaderProps = {}) {
  // 서버에서 받아온 초기 데이터를 즉시 표시 (마운트 후 fetch 왕복 1회 제거)
  const seeded: CacheShape | null = initialMembers && initialTrainers && initialMonth
    ? { members: initialMembers, trainers: initialTrainers, month: initialMonth, ts: Date.now() }
    : null
  if (seeded && !cache) cache = seeded
  const [data, setData] = useState<CacheShape | null>(seeded ?? cache)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 서버에서 초기 데이터 받았으면 첫 마운트 fetch 스킵
  const skipInitialFetchRef = useRef(!!seeded)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      console.log('[PtMembersLoader] fetch 시작 attempt=', retryCountRef.current, 'ts=', new Date().toISOString())
      // 세션 복원 완료 보장 — 싱글톤 클라이언트 + 공유 Promise로 race 차단
      await waitForSupabaseReady()

      const month = todayMonth()
      const [members, trainers] = await Promise.all([
        fetchPtMembersClient(undefined, month),
        fetchTrainersForPtClient(),
      ])
      if (cancelledRef.current) return
      console.log('[PtMembersLoader] fetch 결과', {
        trainers: trainers.length,
        members: members.length,
        month,
        attempt: retryCountRef.current,
      })

      // 빈 결과 재시도 정책:
      // - trainers 비어있음 → RLS/auth 일시 실패 가능성 → 재시도
      // - members만 비어있음 → 정상 케이스(해당 월 데이터 없음)일 수 있지만 첫 fetch는 한 번 의심
      const shouldRetry = trainers.length === 0
        || (members.length === 0 && retryCountRef.current === 0)
      if (shouldRetry && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 300 * retryCountRef.current
        console.warn('[PtMembersLoader] 빈 결과 재시도', retryCountRef.current, '/', MAX_RETRIES,
          { reason: trainers.length === 0 ? 'no trainers' : 'no members on first try' })
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
        const delay = 300 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
      } else {
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    retryCountRef.current = 0
    // 서버에서 초기 데이터를 받았으면 첫 마운트 fetch 스킵 — 즉시 화면 표시
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
    } else {
      void fetchData()
    }

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
