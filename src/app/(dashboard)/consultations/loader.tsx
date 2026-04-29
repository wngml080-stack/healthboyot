'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getAllCards } from '@/actions/consultation'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { ConsultationList } from '@/components/consultations/consultation-list'
import type { ConsultationCard, Member } from '@/types'

// 메모리 캐시 — 재방문 시 즉시 표시
let cache: { cards: ConsultationCard[]; members: Member[]; staffList: { id: string; name: string }[]; ts: number } | null = null

export function ConsultationsLoader() {
  const [data, setData] = useState(cache && Date.now() - cache.ts < 60000 ? cache : null)

  useEffect(() => {
    if (data && Date.now() - (cache?.ts ?? 0) < 30000) return
    Promise.all([getAllCards(), getMembers(), getStaffList()]).then(
      ([cards, members, staff]) => {
        const result = {
          cards: cards as ConsultationCard[],
          members: members as Member[],
          staffList: staff.map((s) => ({ id: s.id, name: s.name })),
          ts: Date.now(),
        }
        cache = result
        setData(result)
      }
    ).catch((err) => console.error('[ConsultationsLoader] 로딩 실패:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">상담카드를 불러오는 중...</span>
      </div>
    )
  }

  return <ConsultationList cards={data.cards} members={data.members} staffList={data.staffList} />
}
