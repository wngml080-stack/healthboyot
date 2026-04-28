'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getAllCards } from '@/actions/consultation'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { ConsultationList } from '@/components/consultations/consultation-list'
import type { ConsultationCard, Member } from '@/types'

export function ConsultationsLoader() {
  const [data, setData] = useState<{
    cards: ConsultationCard[]
    members: Member[]
    staffList: { id: string; name: string }[]
  } | null>(null)

  useEffect(() => {
    Promise.all([getAllCards(), getMembers(), getStaffList()]).then(
      ([cards, members, staff]) => {
        setData({
          cards: cards as ConsultationCard[],
          members: members as Member[],
          staffList: staff.map((s) => ({ id: s.id, name: s.name })),
        })
      }
    )
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
