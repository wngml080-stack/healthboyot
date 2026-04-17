import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() { return run() }
export async function POST() { return run() }

async function run() {
  const supabase = await createClient()

  // 관리자 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', '관리자'].includes(profile.role)) {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const results: Record<string, string> = {}

  // 1. trainer_schedules 삭제
  const r1 = await supabase.from('trainer_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  results.trainer_schedules = r1.error ? `ERROR: ${r1.error.message}` : 'OK'

  // 2. ot_programs 삭제
  const r2 = await supabase.from('ot_programs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  results.ot_programs = r2.error ? `ERROR: ${r2.error.message}` : 'OK'

  // 3. ot_sessions 삭제
  const r3 = await supabase.from('ot_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  results.ot_sessions = r3.error ? `ERROR: ${r3.error.message}` : 'OK'

  // 4. consultation_cards 삭제
  const r4 = await supabase.from('consultation_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  results.consultation_cards = r4.error ? `ERROR: ${r4.error.message}` : 'OK'

  // 5. change_logs 삭제
  const r5 = await supabase.from('change_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  results.change_logs = r5.error ? `ERROR: ${r5.error.message}` : 'OK'

  // 6. ot_assignments 세일즈 필드 초기화
  const r6 = await supabase.from('ot_assignments').update({
    sales_status: null,
    expected_amount: 0,
    expected_sessions: 0,
    expected_sales: 0,
    actual_sales: 0,
    closing_probability: 0,
    closing_fail_reason: null,
    sales_note: null,
    is_sales_target: false,
    is_pt_conversion: false,
    contact_status: '',
  }).neq('id', '00000000-0000-0000-0000-000000000000')
  results.ot_assignments_sales_reset = r6.error ? `ERROR: ${r6.error.message}` : 'OK'

  // 7. 진행중 → 배정완료로 리셋
  const r7 = await supabase.from('ot_assignments').update({ status: '배정완료' }).eq('status', '진행중')
  results.ot_assignments_status_reset = r7.error ? `ERROR: ${r7.error.message}` : 'OK'

  // 8. 완료 상태는 유지 (같은 회원에 활성 배정이 있으면 unique 제약 위반)
  // 대신 완료 배정의 세일즈 필드도 초기화
  const r8 = await supabase.from('ot_assignments').update({
    sales_status: null,
    expected_amount: 0,
    expected_sessions: 0,
    expected_sales: 0,
    actual_sales: 0,
    closing_probability: 0,
    closing_fail_reason: null,
    sales_note: null,
    is_sales_target: false,
    is_pt_conversion: false,
    contact_status: '',
  }).eq('status', '완료')
  results.ot_assignments_completed_sales_reset = r8.error ? `ERROR: ${r8.error.message}` : 'OK'

  // 검증
  const [s1, s2, s3, s4, s5] = await Promise.all([
    supabase.from('ot_sessions').select('id', { count: 'exact', head: true }),
    supabase.from('ot_programs').select('id', { count: 'exact', head: true }),
    supabase.from('trainer_schedules').select('id', { count: 'exact', head: true }),
    supabase.from('consultation_cards').select('id', { count: 'exact', head: true }),
    supabase.from('ot_assignments').select('id, is_sales_target, status', { count: 'exact' }),
  ])

  return NextResponse.json({
    results,
    verification: {
      ot_sessions: s1.count,
      ot_programs: s2.count,
      trainer_schedules: s3.count,
      consultation_cards: s4.count,
      ot_assignments_count: s5.count,
      ot_assignments_sample: s5.data?.slice(0, 3),
    },
  })
}
