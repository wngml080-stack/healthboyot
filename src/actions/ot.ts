'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import { toKstShortStr, toKstDateStr, toKstTimeStr } from '@/lib/kst'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/validators'
import type { OtAssignmentWithDetails, OtStatus, SalesStatus } from '@/types'

/** updateOtAssignment에 전달 가능한 필드 화이트리스트 */
export interface UpdateOtAssignmentValues {
  status?: OtStatus
  notes?: string | null
  pt_trainer_id?: string | null
  ppt_trainer_id?: string | null
  pt_assign_status?: string | null
  ppt_assign_status?: string | null
  is_excluded?: boolean
  excluded_reason?: string | null
  excluded_at?: string | null
  is_watchlist?: boolean
  watchlist_reason?: string | null
  sales_status?: SalesStatus | string | null
  sales_note?: string | null
  is_sales_target?: boolean
  is_pt_conversion?: boolean
  expected_amount?: number
  expected_sessions?: number
  expected_sales?: number
  actual_sales?: number
  closing_probability?: number
  closing_fail_reason?: string | null
  assigned_at?: string | null
}

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
      is_excluded, excluded_reason, excluded_at, assigned_at,
      created_at, updated_at,
      member:members!inner(id, name, phone, ot_category, exercise_time, duration_months, detail_info, notes, registered_at, registration_source, is_existing_member, gender, start_date, is_completed),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(id, session_number, scheduled_at, completed_at)
    `)
    .order('created_at', { ascending: false })

  if (params?.status) {
    query = query.eq('status', params.status)
  }
  if (params?.trainerId) {
    if (params.trainerId === 'unassigned') {
      query = query.is('pt_trainer_id', null).is('ppt_trainer_id', null)
    } else if (params.trainerId === 'excluded') {
      query = query.eq('is_excluded', true)
    } else if (isUuid(params.trainerId)) {
      query = query.or(`pt_trainer_id.eq.${params.trainerId},ppt_trainer_id.eq.${params.trainerId}`)
    } else {
      return []
    }
  }

  const { data, error } = await query.returns<OtAssignmentWithDetails[]>()
  if (error) {
    console.error('[getOtAssignments] DB Error:', error.message, error.details, error.hint)
    throw new Error(error.message)
  }
  return data ?? []
}

export async function getOtAssignment(id: string): Promise<OtAssignmentWithDetails | null> {
  if (isDemoMode()) {
    return DEMO_OT_ASSIGNMENTS.find((a) => a.id === id) ?? null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ot_assignments')
    .select(`
      id, member_id, status, ot_category, pt_trainer_id, ppt_trainer_id,
      assigned_by, notes, registration_type, registration_route,
      expected_sales, actual_sales, week_number, membership_start_date,
      contact_status, sales_status, expected_amount, expected_sessions,
      closing_probability, closing_fail_reason, sales_note,
      is_sales_target, is_pt_conversion, pt_assign_status, ppt_assign_status,
      is_excluded, excluded_reason, excluded_at, assigned_at,
      created_at, updated_at,
      member:members!inner(id, name, phone, gender, sports, ot_category, exercise_time, duration_months, injury_tags, detail_info, notes, registered_at, registration_source, is_existing_member, start_date, is_completed),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(id, ot_assignment_id, session_number, scheduled_at, completed_at, feedback, exercise_content, trainer_tip, cardio_type, cardio_duration, created_at, updated_at)
    `)
    .eq('id', id)
    .returns<OtAssignmentWithDetails[]>()
    .single()

  if (error) return null
  return data as OtAssignmentWithDetails
}

export async function updateOtAssignment(id: string, values: UpdateOtAssignmentValues) {
  if (isDemoMode()) {
    return { success: true }
  }

  const supabase = await createClient()

  // 변경 전 데이터를 먼저 조회한 뒤 업데이트 (race condition 방지)
  const { data: before } = await supabase
    .from('ot_assignments')
    .select('status, sales_status, is_sales_target, is_pt_conversion, member:members!inner(name), pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name)')
    .eq('id', id)
    .single()

  // 담당자 변경 시 assigned_at 자동 기록
  const updateValues = { ...values }
  if (values.pt_trainer_id !== undefined || values.ppt_trainer_id !== undefined) {
    if (!updateValues.assigned_at) updateValues.assigned_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('ot_assignments')
    .update(updateValues)
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
  } catch (err) {
    console.error('updateOtAssignment: change_logs insert 실패', err)
  }

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
  // upsert에 select().single()을 붙여 새/기존 세션 id를 받아서 trainer_schedules 매핑에 사용
  const [upsertResult, assignResult, authResult] = await Promise.all([
    supabase.from('ot_sessions')
      .upsert(sessionValues, { onConflict: 'ot_assignment_id,session_number' })
      .select('id')
      .single(),
    supabase.from('ot_assignments')
      .select('status, pt_trainer_id, ppt_trainer_id, member_id, member:members!inner(name, phone), pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name), ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(name)')
      .eq('id', values.ot_assignment_id)
      .single(),
    supabase.auth.getSession(),
  ])

  if (upsertResult.error) return { error: upsertResult.error.message }

  const assignData = assignResult.data
  const sessionId = upsertResult.data?.id as string | undefined
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
        action = `${values.session_number}차 OT 일정 등록`
        note = `${member.name} 회원 — ${toKstShortStr(values.scheduled_at)} / ${trainerLabel} 담당`
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
    } catch (err) {
      console.error('[upsertOtSession] change_log 실패:', err)
    }

    // 자동 상태 전환 + trainer_schedules 동기화 (병렬)
    const statusPromises: PromiseLike<unknown>[] = []

    if (values.scheduled_at) {
      // 일정 저장 → 진행중 (완료 처리가 아닌 경우에만 상태 전환)
      if (!values.completed_at && ['신청대기', '배정완료'].includes(assignData.status)) {
        statusPromises.push(
          supabase.from('ot_assignments').update({ status: '진행중' }).eq('id', values.ot_assignment_id).then() as Promise<unknown>
        )
      }

      // trainer_schedules 동기화 (PT + PPT 둘 다 생성)
      const trainerIds = [assignData.pt_trainer_id, assignData.ppt_trainer_id].filter(Boolean) as string[]
      if (trainerIds.length > 0) {
        const dateStr = toKstDateStr(values.scheduled_at)
        const timeStr = toKstTimeStr(values.scheduled_at)
        const memberId = (assignData as { member_id?: string }).member_id ?? null

        for (const tid of trainerIds) {
          // ot_session_id로 정확 매칭이 가능하면 그걸로 삭제 (정확).
          // session_id가 없는 경우(이전 데이터 호환)에는 member_name + 같은 날짜 기준 fallback.
          statusPromises.push(
            (sessionId
              ? supabase.from('trainer_schedules').delete()
                  .eq('trainer_id', tid).eq('ot_session_id', sessionId)
              : supabase.from('trainer_schedules').delete()
                  .eq('trainer_id', tid).eq('member_name', member.name)
                  .eq('schedule_type', 'OT').eq('scheduled_date', dateStr)
            )
              .then(() =>
                supabase.from('trainer_schedules').insert({
                  trainer_id: tid, schedule_type: 'OT', member_name: member.name,
                  member_id: memberId, ot_session_id: sessionId ?? null,
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

  // 프로그램 JSON의 sessions 날짜/시간/duration 동기화
  if (values.scheduled_at) {
    try {
      const dateStr = toKstDateStr(values.scheduled_at)
      const timeStr = toKstTimeStr(values.scheduled_at)
      const emptySession = { date: '', time: '', class_duration: durationMin, exercises: [], tip: '', plan: '', next_ot_date: '', cardio: { types: [], duration_min: '' }, inbody: false, images: [], completed: false, approval_status: '작성중', result_category: null, result_note: '' }

      const { data: prog } = await supabase
        .from('ot_programs')
        .select('id, sessions')
        .eq('ot_assignment_id', values.ot_assignment_id)
        .maybeSingle()

      if (prog && Array.isArray(prog.sessions)) {
        const idx = values.session_number - 1
        const updated = [...prog.sessions]
        // 세션 배열이 부족하면 빈 세션으로 채우기
        while (updated.length <= idx) {
          updated.push({ ...emptySession })
        }
        updated[idx] = { ...updated[idx], date: dateStr, time: timeStr, class_duration: durationMin }
        await supabase.from('ot_programs').update({ sessions: updated }).eq('id', prog.id)
      } else if (!prog) {
        // 프로그램이 없으면 자동 생성
        const member = assignData?.member as unknown as { name: string } | undefined
        const ptName = (assignData?.pt_trainer as unknown as { name: string } | null)?.name ?? ''
        const idx = values.session_number - 1
        const sessions = Array.from({ length: idx + 1 }, (_, i) =>
          i === idx
            ? { ...emptySession, date: dateStr, time: timeStr, class_duration: durationMin }
            : { ...emptySession }
        )
        await supabase.from('ot_programs').insert({
          ot_assignment_id: values.ot_assignment_id,
          member_id: (assignData as { member_id?: string })?.member_id ?? null,
          trainer_name: ptName,
          sessions,
          approval_status: '작성중',
        })
      }
    } catch (err) { console.error('[upsertOtSession] program sync:', err) }
  }

  return { success: true }
}

/**
 * 캘린더에서 OT 일정을 드래그로 옮길 때 호출되는 server action.
 * - ot_sessions.scheduled_at 업데이트
 * - 같은 ot_session_id에 묶인 모든 trainer_schedules 행(예: PT/PPT 양쪽) 업데이트
 *
 * server에서 실행되므로 client RLS 한계(다른 트레이너 row UPDATE 거부)를 우회.
 * 단, 호출자 권한 확인은 RLS가 ot_sessions UPDATE에서 처리 (admin 또는 PT/PPT 본인만).
 *
 * 입력:
 *   ot_session_id    — 옮길 OT 세션
 *   newScheduledAtIso — KST를 ISO 문자열로 (예: "2026-04-07T18:00:00+09:00" 변환 후 toISOString)
 *   newDateStr       — "YYYY-MM-DD" (KST 기준)
 *   newTimeStr       — "HH:mm" (KST 기준)
 */
export async function moveOtSchedule(params: {
  ot_session_id: string
  newScheduledAtIso: string
  newDateStr: string
  newTimeStr: string
  newDuration?: number
}) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // 1. ot_sessions 업데이트 — 권한은 RLS가 검증 (PT/PPT 본인 또는 admin만 UPDATE 가능)
  // 완료된 세션은 옮기지 못하도록 추가 가드
  const { data: existingSession, error: fetchErr } = await supabase
    .from('ot_sessions')
    .select('id, completed_at, ot_assignment_id')
    .eq('id', params.ot_session_id)
    .single()

  if (fetchErr || !existingSession) {
    return { error: '세션을 찾을 수 없습니다' }
  }
  // 완료된 세션도 수정 허용 (추후 제한 예정)

  // 2. 세션 업데이트
  const { error: sessionErr } = await supabase
    .from('ot_sessions')
    .update({ scheduled_at: params.newScheduledAtIso })
    .eq('id', params.ot_session_id)

  if (sessionErr) return { error: 'OT 세션 업데이트 실패: ' + sessionErr.message }

  // 3. trainer_schedules — RLS가 trainer_id=auth.uid()만 허용하므로 개별 업데이트
  const { data: tsRows } = await supabase
    .from('trainer_schedules')
    .select('id')
    .eq('ot_session_id', params.ot_session_id)

  for (const row of tsRows ?? []) {
    const tsUpdate: Record<string, unknown> = { scheduled_date: params.newDateStr, start_time: params.newTimeStr }
    if (params.newDuration) tsUpdate.duration = params.newDuration
    await supabase
      .from('trainer_schedules')
      .update(tsUpdate)
      .eq('id', row.id)
  }

  // 4. 프로그램 JSON의 sessions 날짜/시간도 동기화
  try {
    const { data: otSession } = await supabase
      .from('ot_sessions')
      .select('session_number')
      .eq('id', params.ot_session_id)
      .single()

    if (otSession) {
      const { data: prog } = await supabase
        .from('ot_programs')
        .select('id, sessions')
        .eq('ot_assignment_id', existingSession.ot_assignment_id)
        .single()

      if (prog && Array.isArray(prog.sessions)) {
        const idx = otSession.session_number - 1
        if (idx >= 0 && idx < prog.sessions.length) {
          const updated = [...prog.sessions]
          const patch: Record<string, unknown> = { date: params.newDateStr, time: params.newTimeStr }
          if (params.newDuration) patch.class_duration = params.newDuration
          updated[idx] = { ...updated[idx], ...patch }
          await supabase.from('ot_programs').update({ sessions: updated }).eq('id', prog.id)
        }
      }
    }
  } catch (err) { console.error('[moveOtSchedule] program sync 실패:', err) }

  // 5. 변경 로그
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('change_logs').insert({
      target_type: 'ot_session',
      target_id: existingSession.ot_assignment_id,
      action: 'OT 일정 이동',
      note: `→ ${params.newDateStr} ${params.newTimeStr}`,
      changed_by: session?.user?.id ?? null,
    })
  } catch (err) { console.error('[moveOtSchedule] change_log 실패:', err) }

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

  // trainer_id 변경 + auth + 로그 기록 병렬
  const [{ error }, authResult] = await Promise.all([
    supabase
      .from('ot_assignments')
      .update({
        [field]: newTrainerId,
        [field === 'pt_trainer_id' ? 'pt_assign_status' : 'ppt_assign_status']: newTrainerId ? 'assigned' : 'none',
      })
      .eq('id', assignmentId),
    supabase.auth.getSession(),
  ])

  if (error) return { error: error.message }

  try {
    await supabase.from('change_logs').insert({
      target_type: 'ot_assignment',
      target_id: assignmentId,
      action: field === 'pt_trainer_id' ? 'PT 담당 변경' : 'PPT 담당 변경',
      old_value: oldTrainerName,
      new_value: newTrainerName,
      note: `${memberName} 회원 — 히스토리 포함 이동`,
      changed_by: authResult.data?.session?.user?.id ?? null,
    })
  } catch (err) {
    console.error('[changeTrainer] change_log 실패:', err)
  }

  return { success: true }
}

export async function deleteOtSession(assignmentId: string, sessionNumber: number) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // 1) 해당 세션 + 이후 세션 모두 조회
  const { data: allSessions } = await supabase
    .from('ot_sessions')
    .select('id, session_number')
    .eq('ot_assignment_id', assignmentId)
    .order('session_number')

  const target = allSessions?.find((s) => s.session_number === sessionNumber)
  if (!target) return { error: '세션을 찾을 수 없습니다' }

  // 2) 해당 세션의 trainer_schedules 삭제
  await supabase.from('trainer_schedules').delete().eq('ot_session_id', target.id)

  // 3) 해당 세션 삭제
  const { error } = await supabase
    .from('ot_sessions')
    .delete()
    .eq('id', target.id)
  if (error) return { error: error.message }

  // 4) 이후 세션 번호를 앞으로 당기기 (N+1→N, N+2→N+1, ...)
  const laterSessions = (allSessions ?? []).filter((s) => s.session_number > sessionNumber).sort((a, b) => a.session_number - b.session_number)
  for (const s of laterSessions) {
    await supabase.from('ot_sessions').update({ session_number: s.session_number - 1 }).eq('id', s.id)
  }

  // 5) 프로그램 세션 배열도 재정렬 (해당 인덱스 제거)
  const { data: program } = await supabase
    .from('ot_programs')
    .select('id, sessions')
    .eq('ot_assignment_id', assignmentId)
    .single()

  if (program?.sessions && Array.isArray(program.sessions)) {
    const sessions = [...program.sessions]
    if (sessions.length >= sessionNumber) {
      sessions.splice(sessionNumber - 1, 1) // 해당 인덱스 제거
      await supabase.from('ot_programs').update({
        sessions,
        updated_at: new Date().toISOString(),
      }).eq('id', program.id)
    }
  }

  return { success: true }
}

// 세션 번호 재정렬 + 프로그램 동기화 (데이터 꼬임 복구)
export async function repairSessionNumbers(assignmentId: string) {
  if (isDemoMode()) return { success: true, message: '데모 모드' }

  const supabase = await createClient()

  // 1) 현재 ot_sessions 조회
  const { data: sessions } = await supabase
    .from('ot_sessions')
    .select('id, session_number, scheduled_at, completed_at')
    .eq('ot_assignment_id', assignmentId)
    .order('session_number')

  const sessionCount = sessions?.length ?? 0

  // 2) 날짜(scheduled_at) 순으로 정렬한 뒤 session_number 재부여
  //    날짜가 없는 세션은 뒤로 보냄
  const fixes: string[] = []
  if (sessions) {
    const sorted = [...sessions].sort((a, b) => {
      if (!a.scheduled_at && !b.scheduled_at) return a.session_number - b.session_number
      if (!a.scheduled_at) return 1
      if (!b.scheduled_at) return -1
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    })

    // 충돌 방지: 먼저 임시 번호(100+i)로 변경 후 최종 번호 부여
    const needsReorder = sorted.some((s, i) => s.session_number !== i + 1)
    if (needsReorder) {
      for (let i = 0; i < sorted.length; i++) {
        await supabase.from('ot_sessions').update({ session_number: 100 + i }).eq('id', sorted[i].id)
      }
      for (let i = 0; i < sorted.length; i++) {
        const expected = i + 1
        if (sorted[i].session_number !== expected) {
          fixes.push(`${sorted[i].session_number}차 → ${expected}차 (날짜순 정렬)`)
        }
        await supabase.from('ot_sessions').update({ session_number: expected }).eq('id', sorted[i].id)
      }
    }

    // sessions 배열도 정렬 결과로 교체 (이후 프로그램 동기화에 사용)
    sessions.length = 0
    sorted.forEach((s, i) => { sessions.push({ ...s, session_number: i + 1 }) })
  }

  // 3) 프로그램 세션 배열 동기화
  const { data: program } = await supabase
    .from('ot_programs')
    .select('id, sessions')
    .eq('ot_assignment_id', assignmentId)
    .single()

  if (program?.sessions && Array.isArray(program.sessions)) {
    let progSessions = [...program.sessions] as Record<string, unknown>[]
    let changed = false

    // 날짜순 재정렬이 일어났으면 프로그램 세션 배열도 같은 순서로 재배치
    if (sessions && fixes.some((f) => f.includes('날짜순 정렬'))) {
      // sessions는 이미 날짜순으로 정렬된 상태 — 원래 session_number(정렬 전)를 기반으로 프로그램 배열 재배치
      // sorted 배열의 원래 session_number는 fixes에서 추출
      const reordered: Record<string, unknown>[] = []
      for (let i = 0; i < sessions.length; i++) {
        // 해당 세션의 ot_sessions scheduled_at를 프로그램 date/time으로 동기화
        const sess = sessions[i]
        // 기존 프로그램 세션 중 날짜가 일치하는 것을 매칭, 없으면 인덱스 기반
        let matchIdx = -1
        if (sess.scheduled_at) {
          const dateStr = sess.scheduled_at.slice(0, 10)
          matchIdx = progSessions.findIndex((p) => (p.date as string)?.startsWith(dateStr))
        }
        if (matchIdx >= 0) {
          reordered.push(progSessions[matchIdx])
        } else if (i < progSessions.length) {
          reordered.push(progSessions[i])
        }
      }
      if (reordered.length > 0) {
        progSessions = reordered
        fixes.push('프로그램 세션 배열도 날짜순 재배치')
        changed = true
      }
    }

    // 초과분 제거
    const targetCount = Math.max(sessionCount, 1)
    if (progSessions.length > targetCount) {
      progSessions.length = targetCount
      fixes.push(`프로그램 세션 → ${targetCount}개로 정리`)
      changed = true
    }

    // 4) trainer_schedules 날짜/시간을 프로그램에 강제 동기화
    // 회원 이름 조회
    const { data: assignment } = await supabase
      .from('ot_assignments')
      .select('member:members!inner(name), pt_trainer_id, ppt_trainer_id')
      .eq('id', assignmentId)
      .single()
    const memberName = (assignment?.member as unknown as { name: string })?.name
    const trainerIds = [
      (assignment as unknown as { pt_trainer_id: string | null })?.pt_trainer_id,
      (assignment as unknown as { ppt_trainer_id: string | null })?.ppt_trainer_id,
    ].filter(Boolean)

    // 해당 회원의 OT 스케줄 전체 조회 (ot_session_id 또는 이름으로)
    if (memberName && trainerIds.length > 0) {
      const { data: allTs } = await supabase
        .from('trainer_schedules')
        .select('scheduled_date, start_time, duration, ot_session_id')
        .eq('schedule_type', 'OT')
        .eq('member_name', memberName)
        .in('trainer_id', trainerIds)
        .order('scheduled_date')

      const tsList = allTs ?? []

      if (sessions) {
        for (const s of sessions) {
          const idx = s.session_number - 1
          if (idx < 0 || idx >= progSessions.length) continue

          // ot_session_id로 매칭 시도, 없으면 날짜로 매칭
          let tsRow = tsList.find((t) => t.ot_session_id === s.id)
          if (!tsRow && s.scheduled_at) {
            const sDate = s.scheduled_at.slice(0, 10)
            tsRow = tsList.find((t) => t.scheduled_date === sDate)
          }

          if (tsRow) {
            const progDate = progSessions[idx].date as string | undefined
            const progTime = progSessions[idx].time as string | undefined
            const tsDate = tsRow.scheduled_date
            const tsTime = tsRow.start_time?.slice(0, 5)

            if (progDate !== tsDate || progTime !== tsTime) {
              fixes.push(`${s.session_number}차: ${progDate ?? '-'} ${progTime ?? '-'} → ${tsDate} ${tsTime}`)
              progSessions[idx] = { ...progSessions[idx], date: tsDate, time: tsTime }
              changed = true
            }

            // ot_sessions.scheduled_at도 trainer_schedules에 맞춤
            const correctAt = new Date(`${tsDate}T${tsTime}:00+09:00`).toISOString()
            if (s.scheduled_at !== correctAt) {
              await supabase.from('ot_sessions').update({ scheduled_at: correctAt }).eq('id', s.id)
              fixes.push(`${s.session_number}차 ot_session → ${tsDate} ${tsTime}`)
            }
          }
        }
      }
    }

    if (changed) {
      await supabase.from('ot_programs').update({
        sessions: progSessions,
        updated_at: new Date().toISOString(),
      }).eq('id', program.id)
    }
  }

  return { success: true, message: fixes.length > 0 ? fixes.join(', ') : '이상 없음' }
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
