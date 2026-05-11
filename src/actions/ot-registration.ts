'use server'

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validators'
import type { OtRegistration, OtRegistrationWithTrainer } from '@/types'

// 트레이너가 인정건수 제출
// folder_trainer_id: 해당 트레이너 폴더의 주인 (관리자가 대신 등록해도 폴더 주인에게 귀속)
export async function submitOtRegistration(values: {
  member_name: string
  membership_type: string
  registration_amount: number
  ot_credit: number
  folder_trainer_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  // 폴더 트레이너 ID가 지정되면 해당 트레이너에게 귀속, 아니면 본인
  const trainerId = values.folder_trainer_id || user.id

  const { data, error } = await supabase
    .from('ot_registrations')
    .insert({
      trainer_id: trainerId,
      member_name: values.member_name,
      membership_type: values.membership_type,
      registration_amount: values.registration_amount,
      ot_credit: values.ot_credit,
      approval_status: '제출완료',
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 전체 인정건수 목록 (관리자: 전체, 트레이너: 본인만)
export async function getOtRegistrations(): Promise<OtRegistrationWithTrainer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_registrations')
    .select('*, trainer:profiles!ot_registrations_trainer_id_fkey(id, name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []
  return data as unknown as OtRegistrationWithTrainer[]
}

// 트레이너별 인정건수 (통계용)
export async function getOtRegistrationsByTrainer(trainerId: string): Promise<OtRegistration[]> {
  if (!isUuid(trainerId)) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_registrations')
    .select('*')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as OtRegistration[]
}

// 관리자: 승인
export async function approveOtRegistration(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ot_registrations')
    .update({
      approval_status: '승인',
      approved_at: new Date().toISOString(),
      approved_by: user?.id ?? null,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

// 관리자: 반려
export async function rejectOtRegistration(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ot_registrations')
    .update({
      approval_status: '반려',
      approved_by: user?.id ?? null,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

// 삭제
export async function deleteOtRegistration(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('ot_registrations').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
