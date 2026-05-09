'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getPtMembers, getTrainersForPt } from '@/actions/pt-members'
import { PtMemberList } from '@/components/pt-members/pt-member-list'
import type { PtMember } from '@/actions/pt-members'

let cache: { members: PtMember[]; trainers: { id: string; name: string }[]; ts: number } | null = null

// 외부에서 캐시 무효화 (삭제/생성/수정 후 호출 → 다음 마운트 시 fresh fetch)
export function invalidatePtMembersCache() {
  cache = null
}

export function PtMembersLoader() {
  // 캐시는 즉시 표시 용도로만 사용하고, 항상 백그라운드에서 fresh fetch로 갱신
  const [data, setData] = useState(cache)

  useEffect(() => {
    let cancelled = false
    Promise.all([getPtMembers(), getTrainersForPt()]).then(([members, trainers]) => {
      if (cancelled) return
      const result = { members, trainers, ts: Date.now() }
      cache = result
      setData(result)
    }).catch((err) => console.error('[PtMembersLoader] 로딩 실패:', err))
    return () => { cancelled = true }
  }, [])

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
