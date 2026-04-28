'use server'

import { createClient } from '@/lib/supabase/server'
import type { ConsultationCard } from '@/types'

// 여러 회원의 시작일 배치 조회 (N+1 방지)
// 1순위: 연결된 상담카드의 exercise_start_date
// 2순위: members.start_date (fallback)
// 3순위: members.registered_at (최후 fallback)
export async function getExerciseStartDatesByMemberIds(
  memberIds: string[]
): Promise<Record<string, string | null>> {
  if (!memberIds.length) return {}
  const supabase = await createClient()

  // 상담카드 + 회원 정보를 병렬 조회
  const [{ data: linkedCards }, { data: members }] = await Promise.all([
    supabase
      .from('consultation_cards')
      .select('member_id, exercise_start_date, created_at')
      .in('member_id', memberIds)
      .not('exercise_start_date', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('members')
      .select('id, start_date')
      .in('id', memberIds),
  ])

  const result: Record<string, string | null> = {}

  // 1) 연결된 상담카드에서 exercise_start_date
  if (linkedCards) {
    for (const row of linkedCards as { member_id: string; exercise_start_date: string | null }[]) {
      if (!(row.member_id in result) && row.exercise_start_date) {
        result[row.member_id] = row.exercise_start_date
      }
    }
  }

  // 2) 상담카드에 없으면 members.start_date fallback
  if (members) {
    for (const m of members as { id: string; start_date: string | null }[]) {
      if (!(m.id in result) && m.start_date) {
        result[m.id] = m.start_date
      }
    }
  }

  // 나머지는 null
  for (const id of memberIds) {
    if (!(id in result)) result[id] = null
  }

  return result
}

// 회원 ID로 상담카드 조회 (없으면 이름/전화번호로 미연결 카드 매칭)
export async function getConsultationCard(memberId: string): Promise<ConsultationCard | null> {
  const supabase = await createClient()

  // 연결된 카드 + 회원정보를 병렬 조회
  const [{ data: linked }, { data: member }] = await Promise.all([
    supabase
      .from('consultation_cards')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('members')
      .select('name, phone')
      .eq('id', memberId)
      .single(),
  ])

  if (linked) return linked as ConsultationCard

  // 연결된 카드 없으면 이름/전화번호로 미연결 카드 매칭
  if (!member) return null
  const conditions: string[] = []
  if (member.name) conditions.push(`member_name.eq.${member.name}`)
  if (member.phone) conditions.push(`member_phone.eq.${member.phone}`)
  if (!conditions.length) return null

  const { data: unlinked } = await supabase
    .from('consultation_cards')
    .select('*')
    .is('member_id', null)
    .or(conditions.join(','))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!unlinked) return null
  return unlinked as ConsultationCard
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

  // 회원 정보 동기화 + 기존 카드 조회를 병렬 실행
  const memberUpdate: Record<string, unknown> = {}
  if (values.member_name) memberUpdate.name = values.member_name
  if (values.member_phone) memberUpdate.phone = values.member_phone
  if (values.member_gender) memberUpdate.gender = values.member_gender
  if (values.exercise_start_date) memberUpdate.start_date = values.exercise_start_date
  if (values.exercise_time_preference) memberUpdate.exercise_time = values.exercise_time_preference

  const [, existing] = await Promise.all([
    Object.keys(memberUpdate).length > 0
      ? supabase.from('members').update({ ...memberUpdate, updated_at: new Date().toISOString() }).eq('id', memberId)
      : Promise.resolve(),
    getConsultationCard(memberId),
  ])

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

  // 회원 연결된 카드면 운동시간 동기화
  if (data?.member_id && values.exercise_time_preference) {
    await supabase.from('members').update({
      exercise_time: values.exercise_time_preference,
      updated_at: new Date().toISOString(),
    }).eq('id', data.member_id)
  }

  return { data }
}

// 상담카드를 회원에 연결
export async function linkCardToMember(cardId: string, memberId: string) {
  const supabase = await createClient()

  // 카드 데이터 조회 → 회원 정보 동기화
  const { data: card } = await supabase.from('consultation_cards').select('exercise_start_date, exercise_time_preference, member_name, member_phone, member_gender').eq('id', cardId).single()

  const { error } = await supabase
    .from('consultation_cards')
    .update({
      member_id: memberId,
      status: '연결완료',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)

  if (error) return { error: error.message }

  // 상담카드의 운동시작일/이름/번호를 회원에 동기화
  if (card) {
    const memberUpdate: Record<string, unknown> = {}
    if (card.exercise_start_date) memberUpdate.start_date = card.exercise_start_date
    if (card.exercise_time_preference) memberUpdate.exercise_time = card.exercise_time_preference
    if (card.member_name) memberUpdate.name = card.member_name
    if (card.member_phone) memberUpdate.phone = card.member_phone
    if (card.member_gender) memberUpdate.gender = card.member_gender
    if (Object.keys(memberUpdate).length > 0) {
      await supabase.from('members').update({ ...memberUpdate, updated_at: new Date().toISOString() }).eq('id', memberId)
    }
  }

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
