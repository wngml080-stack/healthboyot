import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  // 연결완료 상담카드 중 exercise_start_date가 있는 것 조회
  const { data: cards } = await supabase
    .from('consultation_cards')
    .select('id, member_id, exercise_start_date, member_name, member_phone, member_gender')
    .eq('status', '연결완료')
    .not('member_id', 'is', null)

  if (!cards || cards.length === 0) return NextResponse.json({ message: '동기화할 카드 없음' })

  let synced = 0
  for (const c of cards) {
    if (!c.member_id) continue
    const update: Record<string, unknown> = {}
    if (c.exercise_start_date) update.start_date = c.exercise_start_date
    if (c.member_name) update.name = c.member_name
    if (c.member_phone) update.phone = c.member_phone
    if (c.member_gender) update.gender = c.member_gender
    if (Object.keys(update).length > 0) {
      await supabase.from('members').update({ ...update, updated_at: new Date().toISOString() }).eq('id', c.member_id)
      synced++
    }
  }

  return NextResponse.json({ total_cards: cards.length, synced })
}
