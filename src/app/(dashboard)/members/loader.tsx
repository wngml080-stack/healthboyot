'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { MemberList } from '@/components/members/member-list'
import type { Member } from '@/types'

export function MembersLoader() {
  const [data, setData] = useState<{
    members: Member[]
    trainers: { id: string; name: string }[]
  } | null>(null)

  useEffect(() => {
    Promise.all([getMembers(), getStaffList()]).then(([members, staff]) => {
      setData({
        members: members as Member[],
        trainers: staff
          .filter((s) => !['admin'].includes(s.role))
          .map((s) => ({ id: s.id, name: s.name })),
      })
    })
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
