import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const results: string[] = []

  // 1. 트레이너 ID 조회
  const { data: staff } = await supabase.from('profiles').select('id, name')
  const ojm = staff?.find(s => s.name === '오종민')
  const ycw = staff?.find(s => s.name === '유창욱')
  results.push(`오종민: ${ojm?.id ?? 'NOT FOUND'}, 유창욱: ${ycw?.id ?? 'NOT FOUND'}`)

  // 2. 제외된 회원 조회
  const { data: excluded } = await supabase
    .from('ot_assignments')
    .select('id, member_id, pt_trainer_id, ppt_trainer_id, is_excluded, status, sales_status, member:members!inner(name)')
    .eq('is_excluded', true)

  results.push(`제외 회원 수: ${excluded?.length ?? 0}`)
  for (const a of excluded ?? []) {
    const name = (a.member as unknown as { name: string }).name
    results.push(`  - ${name} (assign: ${a.id}, pt: ${a.pt_trainer_id}, ppt: ${a.ppt_trainer_id})`)
  }

  // 3. 최아인, 장승혁 → 오종민 폴더로 복구
  if (ojm) {
    for (const a of excluded ?? []) {
      const name = (a.member as unknown as { name: string }).name
      if (name === '최아인' || name === '장승혁') {
        await supabase.from('ot_assignments').update({
          is_excluded: false,
          excluded_reason: null,
          excluded_at: null,
          status: '배정완료',
          sales_status: 'OT진행중',
        }).eq('id', a.id)
        results.push(`복구 완료: ${name} → 오종민 폴더`)
      }
    }
  }

  // 4. 김송희, 오종인 → 유창욱 폴더로 복구
  if (ycw) {
    for (const a of excluded ?? []) {
      const name = (a.member as unknown as { name: string }).name
      if (name === '김송희' || name === '오종인') {
        await supabase.from('ot_assignments').update({
          is_excluded: false,
          excluded_reason: null,
          excluded_at: null,
          status: '배정완료',
          sales_status: 'OT진행중',
          pt_trainer_id: ycw.id,
        }).eq('id', a.id)
        results.push(`복구 완료: ${name} → 유창욱 폴더`)
      }
    }
  }

  // 5. 김윤지 중복 확인 및 삭제
  const { data: yunjiMembers } = await supabase
    .from('members')
    .select('id, name, phone, created_at')
    .ilike('name', '%윤지%')

  results.push(`윤지 검색: ${JSON.stringify(yunjiMembers)}`)

  // 오종민 폴더에서 김윤지 배정 중복 확인
  if (ojm) {
    const { data: yunjiAssigns } = await supabase
      .from('ot_assignments')
      .select('id, member_id, created_at, member:members!inner(name, phone)')
      .or(`pt_trainer_id.eq.${ojm.id},ppt_trainer_id.eq.${ojm.id}`)

    const yunjiList = (yunjiAssigns ?? []).filter(a => (a.member as unknown as { name: string }).name.includes('윤지'))
    results.push(`오종민 폴더 윤지 배정: ${yunjiList.length}건`)
    for (const y of yunjiList) {
      const m = y.member as unknown as { name: string; phone: string }
      results.push(`  - ${m.name} (assign: ${y.id}, member: ${y.member_id}, phone: ${m.phone}, created: ${y.created_at})`)
    }

    if (yunjiList.length > 1) {
      // 나중에 생성된 것 삭제
      const sorted = [...yunjiList].sort((a, b) => a.created_at.localeCompare(b.created_at))
      const toDelete = sorted[sorted.length - 1]

      // 관련 데이터 삭제
      await supabase.from('ot_sessions').delete().eq('ot_assignment_id', toDelete.id)
      await supabase.from('ot_programs').delete().eq('ot_assignment_id', toDelete.id)
      await supabase.from('ot_assignments').delete().eq('id', toDelete.id)
      // member도 중복이면 삭제
      const { data: remainAssigns } = await supabase
        .from('ot_assignments')
        .select('id')
        .eq('member_id', toDelete.member_id)
      if (!remainAssigns || remainAssigns.length === 0) {
        await supabase.from('members').delete().eq('id', toDelete.member_id)
        results.push(`중복 member 삭제: ${toDelete.member_id}`)
      }
      results.push(`중복 배정 삭제: ${(toDelete.member as unknown as { name: string }).name} (${toDelete.id})`)
    }
  }

  return NextResponse.json({ results })
}
