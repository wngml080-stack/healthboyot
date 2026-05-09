'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { getPtMembers, getTrainersForPt } from '@/actions/pt-members'
import { PtMemberList } from '@/components/pt-members/pt-member-list'
import type { PtMember } from '@/actions/pt-members'

let cache: { members: PtMember[]; trainers: { id: string; name: string }[]; ts: number } | null = null

// 외부에서 캐시 무효화 (삭제/생성/수정 후 호출 → 다음 마운트 시 fresh fetch)
export function invalidatePtMembersCache() {
  cache = null
}

const MAX_RETRIES = 3

export function PtMembersLoader() {
  const [data, setData] = useState(cache)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const [members, trainers] = await Promise.all([getPtMembers(), getTrainersForPt()])
      if (cancelledRef.current) return
      // trainers가 비면 인증 미준비 가능성 — 재시도
      if (trainers.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 400 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
        return
      }
      const result = { members, trainers, ts: Date.now() }
      cache = result
      retryCountRef.current = 0
      setData(result)
    } catch (err) {
      console.error('[PtMembersLoader] 로딩 실패:', err)
      if (cancelledRef.current) return
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 400 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
      } else {
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    void fetchData()

    // 탭 복귀 시 데이터가 비어있으면 재조회 (세션 복원 누락 대비)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cache) {
        retryCountRef.current = 0
        void fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelledRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchData])

  const handleManualRetry = () => {
    retryCountRef.current = 0
    setError(null)
    void fetchData()
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <span className="text-sm">{error}</span>
        <button
          onClick={handleManualRetry}
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

  return <PtMemberList initialMembers={data.members} trainers={data.trainers} />
}
