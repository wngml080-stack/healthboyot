'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { MemberList } from '@/components/members/member-list'
import type { Member } from '@/types'

// 메모리 캐시 — 재방문 시 즉시 표시
let cache: { members: Member[]; trainers: { id: string; name: string }[]; ts: number } | null = null

export function MembersLoader() {
  const [data, setData] = useState(cache && Date.now() - cache.ts < 60000 ? cache : null)

  useEffect(() => {
    if (data && Date.now() - (cache?.ts ?? 0) < 30000) return
    Promise.all([getMembers(), getStaffList()]).then(([members, staff]) => {
      const result = {
        members: members as Member[],
        trainers: staff.filter((s) => !['admin'].includes(s.role)).map((s) => ({ id: s.id, name: s.name })),
        ts: Date.now(),
      }
      cache = result
      setData(result)
    }).catch((err) => console.error('[MembersLoader] 로딩 실패:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">회원 목록을 불러오는 중...</span>
      </div>
    )
  }

  return <MemberList initialMembers={data.members} trainers={data.trainers} />
}
