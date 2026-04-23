'use server'

import { createClient } from '@/lib/supabase/server'
import { getConsultationCard } from './consultation'
import type { OtProgram, OtProgramSession, OtProgramConsultationData, OtProgramInbodyData } from '@/types'

const emptySession = (): OtProgramSession => ({
  date: '', time: '',
  exercises: [
    { name: '', weight: '', reps: '', sets: '' },
    { name: '', weight: '', reps: '', sets: '' },
    { name: '', weight: '', reps: '', sets: '' },
  ],
  tip: '', next_ot_date: '',
  cardio: { types: [], duration_min: '' },
  inbody: false,
  images: [],
  completed: false,
  approval_status: '작성중',
  submitted_at: null,
  approved_at: null,
  approved_by: null,
  rejection_reason: null,
  admin_feedback: null,
  plan: '',
  plan_detail: null,
  result_category: null,
  result_note: '',
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

// 상담카드 + OT 프로그램 한 번의 요청으로 병렬 조회 (카드 펼침 속도 개선)
export async function getAssignmentExpandData(
  memberId: string,
  assignmentId: string
): Promise<{ card: import('@/types').ConsultationCard | null; program: OtProgram | null }> {
  const supabase = await createClient()
  const [cardRes, programRes] = await Promise.all([
    supabase
      .from('consultation_cards')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ot_programs')
      .select('*')
      .eq('ot_assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const card = cardRes.error || !cardRes.data ? null : (cardRes.data as import('@/types').ConsultationCard)
  const program = programRes.error || !programRes.data ? null : normalizeProgram(programRes.data as Record<string, unknown>)
  return { card, program }
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

  // 세일즈 데이터를 세션에서 추출하여 assignment에 동기화
  const sessionsArr = values.sessions as OtProgramSession[] | undefined
  if (sessionsArr?.length) {
    // 가장 최근 세션에서 세일즈 데이터 추출 (뒤에서부터 찾기)
    const latestSales = [...sessionsArr].reverse().find((s) =>
      s.expected_amount || s.expected_sessions || s.closing_probability || s.sales_status || s.is_sales_target || s.is_pt_conversion
    )
    if (latestSales) {
      const assignmentUpdates: Record<string, unknown> = {}
      if (latestSales.expected_amount) assignmentUpdates.expected_amount = latestSales.expected_amount
      if (latestSales.expected_sessions) assignmentUpdates.expected_sessions = latestSales.expected_sessions
      if (latestSales.closing_probability) assignmentUpdates.closing_probability = latestSales.closing_probability
      if (latestSales.sales_status) {
        assignmentUpdates.sales_status = latestSales.sales_status === 'PT전환' ? '등록완료' : latestSales.sales_status
      }
      if (latestSales.is_sales_target) assignmentUpdates.is_sales_target = true
      // PT전환 상태이면 is_pt_conversion + actual_sales 동기화
      if (latestSales.sales_status === 'PT전환' || latestSales.is_pt_conversion) {
        assignmentUpdates.is_pt_conversion = true
        if (latestSales.pt_sales_amount) assignmentUpdates.actual_sales = latestSales.pt_sales_amount
        if (latestSales.expected_sessions) assignmentUpdates.expected_sessions = latestSales.expected_sessions
      }
      if (latestSales.sales_note) assignmentUpdates.notes = latestSales.sales_note

      if (Object.keys(assignmentUpdates).length > 0) {
        await supabase.from('ot_assignments').update(assignmentUpdates).eq('id', assignmentId)
      }
    }
  }

  // result_category 변경 시 ot_assignments 상태 연동
  if (sessionsArr?.length) {
    const assignmentUpdatesFromResult: Record<string, unknown> = {}
    for (const s of sessionsArr) {
      if (!s.result_category) continue
      switch (s.result_category) {
        case '노쇼':
        case '차감노쇼':
          assignmentUpdatesFromResult.status = '노쇼'
          break
        case '거부자':
          assignmentUpdatesFromResult.status = '거부'
          assignmentUpdatesFromResult.sales_status = 'OT거부자'
          break
        case '수업완료':
        case '서비스수업':
          // 모든 세션이 완료 계열이면 '완료'
          if (sessionsArr.every((ss) => ['수업완료', '서비스수업'].includes(ss.result_category ?? ''))) {
            assignmentUpdatesFromResult.status = '완료'
          }
          break
      }
    }
    if (Object.keys(assignmentUpdatesFromResult).length > 0) {
      await supabase.from('ot_assignments').update(assignmentUpdatesFromResult).eq('id', assignmentId)
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

function rollupStatus(sessions: OtProgramSession[]): OtProgram['approval_status'] {
  const relevant = sessions.filter((s) => s.approval_status && s.approval_status !== '작성중')
  if (relevant.length === 0) return '작성중'
  if (sessions.every((s) => s.approval_status === '승인')) return '승인'
  if (relevant.some((s) => s.approval_status === '제출완료')) return '제출완료'
  if (relevant.every((s) => s.approval_status === '반려')) return '반려'
  return '제출완료'
}

async function updateSessionApproval(
  programId: string,
  sessionIdx: number,
  patch: Partial<OtProgramSession>,
) {
  const supabase = await createClient()
  const { data: existing, error: readErr } = await supabase
    .from('ot_programs')
    .select('*')
    .eq('id', programId)
    .single()
  if (readErr || !existing) return { error: readErr?.message ?? '프로그램을 찾을 수 없습니다.' }

  const current = normalizeProgram(existing as Record<string, unknown>)
  const sessions = [...current.sessions]
  if (!sessions[sessionIdx]) return { error: '세션을 찾을 수 없습니다.' }
  sessions[sessionIdx] = { ...sessions[sessionIdx], ...patch }

  const nextStatus = rollupStatus(sessions)
  const updates: Record<string, unknown> = {
    sessions,
    approval_status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === '승인' && !current.approved_at) {
    updates.approved_at = new Date().toISOString()
  }

  const { error } = await supabase.from('ot_programs').update(updates).eq('id', programId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function submitOtSession(programId: string, sessionIdx: number) {
  return updateSessionApproval(programId, sessionIdx, {
    approval_status: '제출완료',
    submitted_at: new Date().toISOString(),
    rejection_reason: null,
  })
}

export async function upsertOtSessionByAssignment(
  assignmentId: string,
  memberId: string,
  sessionIdx: number,
  patch: Partial<OtProgramSession>,
) {
  const supabase = await createClient()

  const existing = await getOtProgram(assignmentId)
  if (!existing) {
    const initialSessions: OtProgramSession[] = []
    while (initialSessions.length <= sessionIdx) initialSessions.push(emptySession())
    initialSessions[sessionIdx] = { ...initialSessions[sessionIdx], ...patch }
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('ot_programs')
      .insert({
        ot_assignment_id: assignmentId,
        member_id: memberId,
        sessions: initialSessions,
        created_by: user?.id,
      })
      .select()
      .single()
    if (error) return { error: error.message }
    return { data }
  }

  const sessions = [...existing.sessions]
  while (sessions.length <= sessionIdx) sessions.push(emptySession())
  sessions[sessionIdx] = { ...sessions[sessionIdx], ...patch }

  const { error } = await supabase
    .from('ot_programs')
    .update({ sessions, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function saveSessionSignatureInPerson(
  programId: string,
  sessionIdx: number,
  signatureDataUrl: string,
  signerName: string,
) {
  if (!signatureDataUrl.startsWith('data:image/')) {
    return { error: '유효하지 않은 서명 이미지' }
  }
  return updateSessionApproval(programId, sessionIdx, {
    signature_url: signatureDataUrl,
    signer_name: signerName,
    signed_at: new Date().toISOString(),
  })
}

export async function unsubmitOtSession(programId: string, sessionIdx: number) {
  return updateSessionApproval(programId, sessionIdx, {
    approval_status: '작성중',
    submitted_at: null,
    approved_at: null,
    approved_by: null,
    rejection_reason: null,
  })
}

export async function approveOtSession(programId: string, sessionIdx: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return updateSessionApproval(programId, sessionIdx, {
    approval_status: '승인',
    approved_at: new Date().toISOString(),
    approved_by: user?.id ?? null,
    rejection_reason: null,
  })
}

export async function rejectOtSession(programId: string, sessionIdx: number, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return updateSessionApproval(programId, sessionIdx, {
    approval_status: '반려',
    approved_by: user?.id ?? null,
    rejection_reason: reason,
  })
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

export async function getAllOtPrograms(options?: { includeAll?: boolean }): Promise<(OtProgram & { member_name?: string })[]> {
  const supabase = await createClient()

  // 목록/통계용: 무거운 JSON 컬럼 제외 (consultation_data, inbody_data, images, session_1~3)
  const lightSelect = `
    id, ot_assignment_id, member_id, trainer_name, sessions, approval_status,
    athletic_goal, total_sets_per_day, recommended_days_per_week,
    exercise_duration_min, target_heart_rate, member_start_date, member_end_date,
    submitted_at, approved_at, approved_by, rejection_reason, share_token,
    created_at, updated_at, created_by,
    member:members!inner(name)
  `

  let query = supabase
    .from('ot_programs')
    .select(lightSelect)

  if (!options?.includeAll) {
    query = query.in('approval_status', ['제출완료', '승인', '반려'])
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error || !data) return []

  return data.map((row) => {
    const member = row.member as unknown as { name: string }
    const prog = normalizeProgram(row as Record<string, unknown>)
    return { ...prog, member_name: member?.name }
  })
}
