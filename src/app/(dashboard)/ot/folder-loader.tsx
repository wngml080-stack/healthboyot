'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { getTrainerFoldersAll } from '@/actions/trainer-folders'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// 메모리 캐시 — 재방문 시 즉시 표시
let folderCache: {
  folders: TrainerFolder[]
  allStaff: Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
  role: string
  userId?: string
  timestamp: number
} | null = null

const MAX_RETRIES = 3

export function FolderLoader() {
  const [data, setData] = useState(folderCache && Date.now() - folderCache.timestamp < 60000 ? folderCache : null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const result = await getTrainerFoldersAll()
      if (cancelledRef.current) return
      // 폴더+스태프 모두 비면 인증 미준비 가능성 — 재시도
      if (result.folders.length === 0 && result.allStaff.length === 0 && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 400 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
        return
      }
      const cached = {
        ...result,
        allStaff: result.allStaff as Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[],
        timestamp: Date.now(),
      }
      folderCache = cached
      retryCountRef.current = 0
      setData(cached)
    } catch (err) {
      console.error('[FolderLoader] 로딩 실패:', err)
      if (cancelledRef.current) return
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 400 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void fetchData() }, delay)
      } else {
        setError(err instanceof Error ? err.message : '폴더를 불러오지 못했습니다')
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    // 캐시가 충분히 신선하면 fetch 생략, 아니면 백그라운드에서 갱신
    if (!data || Date.now() - (folderCache?.timestamp ?? 0) >= 30000) {
      void fetchData()
    }

    // 탭 복귀 시 데이터가 비어있으면 재조회
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !folderCache) {
        retryCountRef.current = 0
        void fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // 첫 로그인/세션 복원 시 데이터 비어있으면 재조회 — TOKEN_REFRESHED는 제외
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !folderCache) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <span className="text-sm">폴더를 불러오는 중...</span>
      </div>
    )
  }

  return (
    <>
      {(data.role === 'admin' || data.role === '관리자') && (
        <div className="flex justify-end -mt-2">
          <Link href="/ot/recover" className="text-xs text-orange-600 hover:text-orange-700 underline">OT 세션 복구</Link>
        </div>
      )}
      <TrainerFolderGrid folders={data.folders} allStaff={data.allStaff} currentUserRole={data.role} currentUserId={data.userId} />
    </>
  )
}
