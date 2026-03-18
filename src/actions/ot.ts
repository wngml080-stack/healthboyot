'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import type { OtAssignmentWithDetails, OtStatus } from '@/types'

export async function getOtAssignments(params?: {
  status?: OtStatus
}): Promise<OtAssignmentWithDetails[]> {
  if (isDemoMode()) {
    if (!params?.status) return DEMO_OT_ASSIGNMENTS
    return DEMO_OT_ASSIGNMENTS.filter((a) => a.status === params.status)
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  let query = supabase
    .from('ot_assignments')
    .select(`
      *,
      member:members!inner(*),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(*)
    `)
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as unknown as OtAssignmentWithDetails[]) ?? []
}

export async function getOtAssignment(id: string): Promise<OtAssignmentWithDetails | null> {
  if (isDemoMode()) {
    return DEMO_OT_ASSIGNMENTS.find((a) => a.id === id) ?? null
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_assignments')
    .select(`
      *,
      member:members!inner(*),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(*)
    `)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as OtAssignmentWithDetails
}

export async function updateOtAssignment(
  id: string,
  values: {
    status?: OtStatus
    pt_trainer_id?: string | null
    ppt_trainer_id?: string | null
    notes?: string | null
  }
) {
  if (isDemoMode()) {
    return { success: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('ot_assignments')
    .update({ ...values, assigned_by: user?.id })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function upsertOtSession(values: {
  ot_assignment_id: string
  session_number: number
  scheduled_at?: string | null
  completed_at?: string | null
  feedback?: string | null
}) {
  if (isDemoMode()) {
    return { success: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { error } = await supabase
    .from('ot_sessions')
    .upsert(values, { onConflict: 'ot_assignment_id,session_number' })

  if (error) return { error: error.message }

  // ── 자동 상태 전환 ──
  // 일정 저장 → 진행중
  if (values.scheduled_at && !values.completed_at) {
    await supabase
      .from('ot_assignments')
      .update({ status: '진행중' })
      .eq('id', values.ot_assignment_id)
      .in('status', ['신청대기', '배정완료'])
  }

  // 완료 처리 시 → 세션 완료 개수 확인
  if (values.completed_at) {
    const { data: sessions } = await supabase
      .from('ot_sessions')
      .select('session_number, completed_at')
      .eq('ot_assignment_id', values.ot_assignment_id)

    const completedCount = sessions?.filter((s) => s.completed_at).length ?? 0

    if (completedCount >= 3) {
      // 3차 완료 → 자동으로 완료 상태
      await supabase
        .from('ot_assignments')
        .update({ status: '완료' })
        .eq('id', values.ot_assignment_id)
    }
  }

  return { success: true }
}

export async function getTrainers() {
  if (isDemoMode()) {
    return [
      { id: 'demo-trainer-001', name: '박트레이너', role: 'trainer' as const },
      { id: 'demo-admin-001', name: '김팀장', role: 'admin' as const },
    ]
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['trainer', 'admin'])
    .order('name')

  if (error) return []
  return data
}
