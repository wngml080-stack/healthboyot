'use server'

import { createClient } from '@/lib/supabase/server'
import type { ConsultationCard } from '@/types'

// 여러 회원의 exercise_start_date 배치 조회 (N+1 방지)
export async function getExerciseStartDatesByMemberIds(
  memberIds: string[]
): Promise<Record<string, string | null>> {
  if (!memberIds.length) return {}
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .select('member_id, exercise_start_date, created_at')
    .in('member_id', memberIds)
    .order('created_at', { ascending: false })

  if (error || !data) return {}

  // 회원당 가장 최근 카드의 exercise_start_date만 남김
  const result: Record<string, string | null> = {}
  for (const row of data as { member_id: string; exercise_start_date: string | null }[]) {
    if (!(row.member_id in result)) {
      result[row.member_id] = row.exercise_start_date ?? null
    }
  }
  return result
}

// 회원 ID로 상담카드 조회
export async function getConsultationCard(memberId: string): Promise<ConsultationCard | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as ConsultationCard
}

// 상담카드 ID로 조회
export async function getConsultationCardById(id: string): Promise<ConsultationCard | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as ConsultationCard
}

// 회원 연결된 상담카드 upsert (기존 방식)
export async function upsertConsultationCard(
  memberId: string,
  values: Partial<Omit<ConsultationCard, 'id' | 'member_id' | 'created_at' | 'updated_at' | 'created_by'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 회원 정보 동기화 — 상담카드에서 이름/번호/성별 변경 시 members 테이블도 업데이트
  const memberUpdate: Record<string, unknown> = {}
  if (values.member_name) memberUpdate.name = values.member_name
  if (values.member_phone) memberUpdate.phone = values.member_phone
  if (values.member_gender) memberUpdate.gender = values.member_gender
  if (Object.keys(memberUpdate).length > 0) {
    await supabase.from('members').update({ ...memberUpdate, updated_at: new Date().toISOString() }).eq('id', memberId)
  }

  const existing = await getConsultationCard(memberId)

  if (existing) {
    const { data, error } = await supabase
      .from('consultation_cards')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return { error: error.message }
    return { data }
  }

  const { data, error } = await supabase
    .from('consultation_cards')
    .insert({
      member_id: memberId,
      status: '연결완료',
      ...values,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 독립 상담카드 생성 (회원 없이)
export async function createStandaloneCard(
  values: {
    member_name: string
    member_phone: string
    member_gender?: string | null
  } & Partial<Omit<ConsultationCard, 'id' | 'member_id' | 'created_at' | 'updated_at' | 'created_by' | 'status'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('consultation_cards')
    .insert({
      ...values,
      member_id: null,
      status: '미연결',
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 독립 상담카드 업데이트
export async function updateStandaloneCard(
  id: string,
  values: Partial<Omit<ConsultationCard, 'id' | 'created_at' | 'updated_at' | 'created_by'>>
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 상담카드를 회원에 연결
export async function linkCardToMember(cardId: string, memberId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('consultation_cards')
    .update({
      member_id: memberId,
      status: '연결완료',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)

  if (error) return { error: error.message }
  return { success: true }
}

// 미연결 상담카드 목록
export async function getUnlinkedCards(): Promise<ConsultationCard[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .select('*')
    .eq('status', '미연결')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as ConsultationCard[]
}

// 전체 상담카드 목록 (미연결 + 연결완료)
export async function getAllCards(): Promise<ConsultationCard[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('consultation_cards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []
  return data as ConsultationCard[]
}

// 공개 폼에서 상담카드 업데이트 (로그인 불필요)
export async function updatePublicCard(cardId: string, values: Record<string, unknown>) {
  const supabase = await createClient()

  // Verify card exists and is in '미연결' status (security: only unfilled cards can be updated publicly)
  const { data: existing } = await supabase
    .from('consultation_cards')
    .select('id, status')
    .eq('id', cardId)
    .single()

  if (!existing) return { error: '상담카드를 찾을 수 없습니다' }
  if (existing.status !== '미연결') return { error: '이미 연결된 상담카드는 수정할 수 없습니다' }

  const { error } = await supabase
    .from('consultation_cards')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', cardId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteConsultationCard(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('consultation_cards')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
