'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/server'
import type { OtAssignmentWithDetails, OtStatus } from '@/types'

export async function getOtAssignments(params?: {
  status?: OtStatus
  trainerId?: string
}): Promise<OtAssignmentWithDetails[]> {
  if (isDemoMode()) {
    let result = DEMO_OT_ASSIGNMENTS
    if (params?.status) result = result.filter((a) => a.status === params.status)
    if (params?.trainerId) result = result.filter((a) => a.pt_trainer_id === params.trainerId || a.ppt_trainer_id === params.trainerId)
    return result
  }

  const supabase = await createClient()

  let query = supabase
    .from('ot_assignments')
    .select(`
      id, member_id, status, ot_category, pt_trainer_id, ppt_trainer_id,
      assigned_by, notes, registration_type, registration_route,
      expected_sales, actual_sales, week_number, membership_start_date,
      contact_status, sales_status, expected_amount, expected_sessions,
      closing_probability, closing_fail_reason, sales_note,
      is_sales_target, is_pt_conversion, pt_assign_status, ppt_assign_status,
      created_at, updated_at,
      member:members!inner(id, name, phone, ot_category, exercise_time, duration_months, detail_info, notes, registered_at, registration_source, is_existing_member, gender, start_date, is_completed),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(id, session_number, scheduled_at, completed_at, feedback, exercise_content, trainer_tip, cardio_type, cardio_duration)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (params?.status) {
    query = query.eq('status', params.status)
  }
  if (params?.trainerId) {
    query = query.or(`pt_trainer_id.eq.${params.trainerId},ppt_trainer_id.eq.${params.trainerId}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[getOtAssignments] DB Error:', error.message, error.details, error.hint)
    throw new Error(error.message)
  }
  return (data as unknown as OtAssignmentWithDetails[]) ?? []
}

export async function getOtAssignment(id: string): Promise<OtAssignmentWithDetails | null> {
  if (isDemoMode()) {
    return DEMO_OT_ASSIGNMENTS.find((a) => a.id === id) ?? null
  }

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateOtAssignment(id: string, values: Record<string, any>) {
  if (isDemoMode()) {
    return { success: true }
  }

  const supabase = await createClient()

  // 변경 전 데이터 조회 (로그용)
  const { data: before } = await supabase
    .from('ot_assignments')
    .select('status, sales_status, is_sales_target, is_pt_conversion, member:members!inner(name), pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name)')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('ot_assignments')
    .update(values)
    .eq('id', id)

  if (error) {
    console.error('updateOtAssignment error:', error.message, 'id:', id, 'values:', values)
    return { error: error.message }
  }

  // ── 로그 기록 ──
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const memberName = (before?.member as unknown as { name: string })?.name ?? ''
    const trainerName = (before?.pt_trainer as unknown as { name: string } | null)?.name ?? ''
    const changes: string[] = []

    if (values.status && values.status !== before?.status) {
      changes.push(`상태: ${before?.status} → ${values.status}`)
    }
    if (values.sales_status && values.sales_status !== before?.sales_status) {
      changes.push(`세일즈: ${before?.sales_status ?? '미설정'} → ${values.sales_status}`)
    }
    if (values.is_sales_target !== undefined && values.is_sales_target !== before?.is_sales_target) {
      changes.push(values.is_sales_target ? '매출대상 지정' : '매출대상 해제')
    }
    if (values.is_pt_conversion !== undefined && values.is_pt_conversion !== before?.is_pt_conversion) {
      changes.push(values.is_pt_conversion ? 'PT전환 지정' : 'PT전환 해제')
    }

    if (changes.length > 0) {
      await supabase.from('change_logs').insert({
        target_type: 'ot_assignment',
        target_id: id,
        action: changes.join(', '),
        note: `${memberName} 회원 — ${trainerName} 담당`,
        changed_by: session?.user?.id ?? null,
      })
    }
  } catch {}

  return { success: true }
}

export async function upsertOtSession(values: {
  ot_assignment_id: string
  session_number: number
  scheduled_at?: string | null
  completed_at?: string | null
  feedback?: string | null
  exercise_content?: string | null
  trainer_tip?: string | null
  cardio_type?: string[] | null
  cardio_duration?: number | null
  duration?: number
}) {
  if (isDemoMode()) {
    return { success: true }
  }

  const supabase = await createClient()

  // duration은 trainer_schedules용 — ot_sessions에는 보내지 않음
  const { duration: scheduleDuration, ...sessionValues } = values
  const durationMin = scheduleDuration ?? 30

  // 1. 세션 upsert + assignment 데이터 한 번에 조회 (병렬)
  const [upsertResult, assignResult, authResult] = await Promise.all([
    supabase.from('ot_sessions').upsert(sessionValues, { onConflict: 'ot_assignment_id,session_number' }),
    supabase.from('ot_assignments')
      .select('status, pt_trainer_id, ppt_trainer_id, member:members!inner(name, phone), pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name), ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(name)')
      .eq('id', values.ot_assignment_id)
      .single(),
    supabase.auth.getSession(),
  ])

  if (upsertResult.error) return { error: upsertResult.error.message }

  const assignData = assignResult.data
  const userId = authResult.data?.session?.user?.id ?? null

  // 2. 로그 기록 + 알림 + 상태 전환 (assignData 재사용)
  if (assignData) {
    const member = assignData.member as unknown as { name: string; phone: string }
    const ptName = (assignData.pt_trainer as unknown as { name: string } | null)?.name
    const pptName = (assignData.ppt_trainer as unknown as { name: string } | null)?.name
    const trainerLabel = [ptName, pptName].filter(Boolean).join('/')

    // 로그 기록
    try {
      let action = ''
      let note = ''
      if (values.completed_at) {
        action = `${values.session_number}차 OT 완료`
        note = `${member.name} 회원 — ${trainerLabel} 담당`
      } else if (values.scheduled_at && !values.completed_at) {
        const date = new Date(values.scheduled_at)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        action = `${values.session_number}차 OT 일정 등록`
        note = `${member.name} 회원 — ${dateStr} / ${trainerLabel} 담당`
      } else if (values.completed_at === null) {
        action = `${values.session_number}차 OT 완료 취소`
        note = `${member.name} 회원 — ${trainerLabel} 담당`
      }

      if (action) {
        await supabase.from('change_logs').insert({
          target_type: 'ot_session', target_id: values.ot_assignment_id,
          action, note, changed_by: userId,
        })
      }
    } catch {}

    // 알림 발송
    try {
      if (values.scheduled_at && !values.completed_at) {
        const { notifyScheduleConfirmed } = await import('./notify')
        await notifyScheduleConfirmed({
          memberName: member.name, memberPhone: member.phone,
          trainerName: ptName ?? '담당자', sessionNumber: values.session_number,
          scheduledAt: values.scheduled_at,
        })
      }
      if (values.completed_at && values.session_number === 3) {
        const { notifyOtCompleted } = await import('./notify')
        await notifyOtCompleted({ memberName: member.name, memberPhone: member.phone })
      }
    } catch {}

    // 자동 상태 전환 + trainer_schedules 동기화 (병렬)
    const statusPromises: PromiseLike<unknown>[] = []

    if (values.scheduled_at && !values.completed_at) {
      // 일정 저장 → 진행중
      if (['신청대기', '배정완료'].includes(assignData.status)) {
        statusPromises.push(
          supabase.from('ot_assignments').update({ status: '진행중' }).eq('id', values.ot_assignment_id).then() as Promise<unknown>
        )
      }

      // trainer_schedules 동기화 (PT + PPT 둘 다 생성)
      const trainerIds = [assignData.pt_trainer_id, assignData.ppt_trainer_id].filter(Boolean) as string[]
      if (trainerIds.length > 0) {
        const scheduledDate = new Date(values.scheduled_at)
        const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`
        const timeStr = `${String(scheduledDate.getHours()).padStart(2, '0')}:${String(scheduledDate.getMinutes()).padStart(2, '0')}`

        for (const tid of trainerIds) {
          statusPromises.push(
            supabase.from('trainer_schedules').delete()
              .eq('trainer_id', tid).eq('member_name', member.name)
              .eq('schedule_type', 'OT').eq('scheduled_date', dateStr)
              .then(() =>
                supabase.from('trainer_schedules').insert({
                  trainer_id: tid, schedule_type: 'OT', member_name: member.name,
                  scheduled_date: dateStr, start_time: timeStr, duration: durationMin,
                })
              )
          )
        }
      }
    }

    if (values.completed_at) {
      // 세션 완료 수 확인 → 3개 이상이면 자동 완료
      statusPromises.push(
        supabase.from('ot_sessions').select('completed_at').eq('ot_assignment_id', values.ot_assignment_id)
          .then(({ data: sessions }) => {
            const completedCount = sessions?.filter((s) => s.completed_at).length ?? 0
            if (completedCount >= 3) {
              return supabase.from('ot_assignments').update({ status: '완료' }).eq('id', values.ot_assignment_id)
            }
          })
      )
    }

    await Promise.all(statusPromises)
  }

  return { success: true }
}

export async function changeTrainer(
  assignmentId: string,
  field: 'pt_trainer_id' | 'ppt_trainer_id',
  newTrainerId: string | null,
  oldTrainerName: string,
  newTrainerName: string,
  memberName: string,
) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // 1. trainer_id 변경
  const { error } = await supabase
    .from('ot_assignments')
    .update({
      [field]: newTrainerId,
      [field === 'pt_trainer_id' ? 'pt_assign_status' : 'ppt_assign_status']: newTrainerId ? 'assigned' : 'none',
    })
    .eq('id', assignmentId)

  if (error) return { error: error.message }

  // 2. 로그 기록
  await supabase.from('change_logs').insert({
    target_type: 'ot_assignment',
    target_id: assignmentId,
    action: field === 'pt_trainer_id' ? 'PT 담당 변경' : 'PPT 담당 변경',
    old_value: oldTrainerName,
    new_value: newTrainerName,
    note: `${memberName} 회원 — 히스토리 포함 이동`,
    changed_by: session?.user?.id ?? null,
  })

  return { success: true }
}

export async function deleteOtSession(assignmentId: string, sessionNumber: number) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { error } = await supabase
    .from('ot_sessions')
    .delete()
    .eq('ot_assignment_id', assignmentId)
    .eq('session_number', sessionNumber)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getTrainers() {
  if (isDemoMode()) {
    return [
      { id: 'demo-trainer-001', name: '박트레이너', role: 'trainer' as const },
      { id: 'demo-admin-001', name: '김팀장', role: 'admin' as const },
    ]
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['trainer', 'admin'])
    .order('name')

  if (error) return []
  return data
}
