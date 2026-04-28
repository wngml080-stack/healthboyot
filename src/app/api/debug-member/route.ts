import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? ''
  const trainerId = req.nextUrl.searchParams.get('trainer') ?? ''

  const supabase = await createClient()

  // 해당 트레이너의 모든 배정 회원 조회
  const { data: assignments, error } = await supabase
    .from('ot_assignments')
    .select('id, status, is_excluded, pt_trainer_id, ppt_trainer_id, member:members!inner(name)')
    .or(`pt_trainer_id.eq.${trainerId},ppt_trainer_id.eq.${trainerId}`)

  if (error) return NextResponse.json({ error: error.message })

  // 이름 검색
  const matched = (assignments ?? []).filter((a: any) =>
    a.member?.name?.includes(name)
  )

  // 전체 이름 목록도 반환
  const allNames = (assignments ?? []).map((a: any) => ({
    name: a.member?.name,
    status: a.status,
    is_excluded: a.is_excluded,
    id: a.id,
  })).sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''))

  return NextResponse.json({
    total: assignments?.length ?? 0,
    matched,
    allNames,
  })
}
