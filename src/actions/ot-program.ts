'use server'

import { createClient } from '@/lib/supabase/server'
import { getConsultationCard } from './consultation'
import type { OtProgram, OtProgramSession, OtProgramApprovalStatus, OtProgramConsultationData, OtProgramInbodyData } from '@/types'

const emptySession = (): OtProgramSession => ({
  date: '', time: '',
  exercises: [
    { name: '', weight: '', sets: '' },
    { name: '', weight: '', sets: '' },
    { name: '', weight: '', sets: '' },
  ],
  tip: '', next_ot_date: '',
  cardio: { types: [], duration_min: '' },
  inbody: false,
  images: [],
  completed: false,
})

const emptyConsultation = (): OtProgramConsultationData => ({
  exercise_goals: [],
  exercise_goal_detail: null,
  body_correction_area: null,
  medical_conditions: [],
  medical_detail: null,
  surgery_detail: null,
  exercise_experiences: [],
  exercise_experience_history: null,
  exercise_duration: null,
  exercise_personality: [],
  desired_body_type: null,
})

const emptyInbody = (): OtProgramInbodyData => ({
  current_weight: '', target_weight: '',
  current_body_fat: '', target_body_fat: '',
  current_muscle_mass: '', target_muscle_mass: '',
  current_bmr: '', target_bmr: '',
})

function normalizeProgram(data: Record<string, unknown>): OtProgram {
  // sessions 배열이 비어있으면 레거시 session_1~3에서 마이그레이션
  let sessions = data.sessions as OtProgramSession[] | null
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    const s1 = data.session_1 as OtProgramSession | null
    const s2 = data.session_2 as OtProgramSession | null
    const s3 = data.session_3 as OtProgramSession | null
    sessions = []
    if (s1 && Object.keys(s1).length > 0) sessions.push({ ...emptySession(), ...s1 })
    if (s2 && Object.keys(s2).length > 0) sessions.push({ ...emptySession(), ...s2 })
    if (s3 && Object.keys(s3).length > 0) sessions.push({ ...emptySession(), ...s3 })
    if (sessions.length === 0) sessions = [emptySession()]
  } else {
    sessions = sessions.map((s) => ({ ...emptySession(), ...s }))
  }

  const consultation = data.consultation_data as OtProgramConsultationData | null
  const inbody = data.inbody_data as OtProgramInbodyData | null

  return {
    ...data,
    sessions,
    consultation_data: consultation && Object.keys(consultation).length > 0 ? consultation : emptyConsultation(),
    inbody_data: inbody && Object.keys(inbody).length > 0 ? inbody : emptyInbody(),
    images: (data.images as string[]) ?? [],
  } as OtProgram
}

export async function getOtProgram(assignmentId: string): Promise<OtProgram | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_programs')
    .select('*')
    .eq('ot_assignment_id', assignmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return normalizeProgram(data as Record<string, unknown>)
}

export async function upsertOtProgram(
  assignmentId: string,
  memberId: string,
  values: Partial<Omit<OtProgram, 'id' | 'ot_assignment_id' | 'member_id' | 'created_at' | 'updated_at' | 'created_by'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 상담카드 데이터 자동 연동 (비어있으면 항상 채우기)
  const hasConsultation = values.consultation_data &&
    (values.consultation_data.exercise_goals?.length > 0 || values.consultation_data.medical_conditions?.length > 0)
  if (!hasConsultation) {
    const card = await getConsultationCard(memberId)
    if (card) {
      values.consultation_data = {
        exercise_goals: card.exercise_goals ?? [],
        exercise_goal_detail: card.exercise_goal_detail ?? null,
        body_correction_area: card.body_correction_area ?? null,
        medical_conditions: card.medical_conditions ?? [],
        medical_detail: card.medical_detail,
        surgery_detail: card.surgery_detail,
        exercise_experiences: card.exercise_experiences ?? [],
        exercise_experience_history: card.exercise_experience_history ?? null,
        exercise_duration: card.exercise_duration,
        exercise_personality: card.exercise_personality ?? [],
        desired_body_type: card.desired_body_type,
      }
    }
  }

  // 기존 프로그램이 있으면 업데이트
  const existing = await getOtProgram(assignmentId)
  if (existing) {
    const { data, error } = await supabase
      .from('ot_programs')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return { error: error.message }
    return { data }
  }

  // 새로 생성
  const { data, error } = await supabase
    .from('ot_programs')
    .insert({
      ot_assignment_id: assignmentId,
      member_id: memberId,
      ...values,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function submitOtProgram(programId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('ot_programs')
    .update({
      approval_status: '제출완료',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function approveOtProgram(programId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ot_programs')
    .update({
      approval_status: '승인',
      approved_at: new Date().toISOString(),
      approved_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function rejectOtProgram(programId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ot_programs')
    .update({
      approval_status: '반려',
      approved_by: user?.id,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getPendingOtPrograms(): Promise<(OtProgram & { member_name?: string })[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_programs')
    .select('*, member:members!inner(name)')
    .eq('approval_status', '제출완료')
    .order('submitted_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const member = row.member as unknown as { name: string }
    const prog = normalizeProgram(row as Record<string, unknown>)
    return { ...prog, member_name: member?.name }
  })
}

export async function getAllOtPrograms(): Promise<(OtProgram & { member_name?: string })[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_programs')
    .select('*, member:members!inner(name)')
    .in('approval_status', ['제출완료', '승인', '반려'])
    .order('submitted_at', { ascending: false })
    .limit(100)

  if (error || !data) return []

  return data.map((row) => {
    const member = row.member as unknown as { name: string }
    const prog = normalizeProgram(row as Record<string, unknown>)
    return { ...prog, member_name: member?.name }
  })
}
