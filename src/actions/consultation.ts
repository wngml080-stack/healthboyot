'use server'

import { createClient } from '@/lib/supabase/server'
import type { ConsultationCard } from '@/types'

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

export async function deleteConsultationCard(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('consultation_cards')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
