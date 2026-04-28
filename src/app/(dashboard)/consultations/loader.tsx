'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ConsultationList } from '@/components/consultations/consultation-list'
import type { ConsultationCard, Member } from '@/types'

export function ConsultationsLoader() {
  const [data, setData] = useState<{
    cards: ConsultationCard[]
    members: Member[]
    staffList: { id: string; name: string }[]
  } | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    // 브라우저 → Supabase 직접 병렬 호출
    Promise.all([
      supabase.from('consultation_cards').select('*').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, name').in('role', ['trainer', 'admin', 'fc', '강사', '관리자', '팀장']).order('name'),
    ]).then(([cardsRes, membersRes, staffRes]) => {
      setData({
        cards: (cardsRes.data ?? []) as ConsultationCard[],
        members: (membersRes.data ?? []) as Member[],
        staffList: (staffRes.data ?? []).map((s) => ({ id: s.id, name: s.name })),
      })
    })
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
