'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MemberList } from '@/components/members/member-list'
import type { Member } from '@/types'

export function MembersLoader() {
  const [data, setData] = useState<{
    members: Member[]
    trainers: { id: string; name: string }[]
  } | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    // 브라우저 → Supabase 직접 병렬 호출
    Promise.all([
      supabase.from('members').select('*, assignment:ot_assignments(id, status, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status, is_excluded, ot_category, sales_status, is_sales_target, is_pt_conversion, pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name), ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name))').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, name, role').in('role', ['trainer', 'fc', '강사', '팀장']).order('name'),
    ]).then(([membersRes, staffRes]) => {
      setData({
        members: (membersRes.data ?? []) as unknown as Member[],
        trainers: (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.name })),
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
