'use server'

import { createClient } from '@/lib/supabase/server'

export interface ScheduleOverviewItem {
  id: string
  trainer_id: string
  schedule_type: string
  member_name: string
  member_id: string | null
  ot_session_id: string | null
  scheduled_date: string
  start_time: string
  duration: number
  note: string | null
  is_sales_target: boolean
  is_pt_conversion: boolean
  ot_assignment_id: string | null
  sales_status: string | null
  result_category: string | null
}

export interface TrainerDaySchedule {
  trainer_id: string
  trainer_name: string
  role: string
  folder_order: number
  schedules: ScheduleOverviewItem[]
}

/** 특정 날짜의 전체 트레이너 스케줄을 폴더 순서대로 조회 */
export async function getAllTrainerSchedulesByDate(date: string): Promise<TrainerDaySchedule[]> {
  const supabase = await createClient()

  // 1) 트레이너 + 스케줄 병렬 조회
  const [trainersRes, schedulesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role, folder_order')
      .eq('is_approved', true)
      .eq('has_folder', true)
      .order('folder_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('trainer_schedules')
      .select('id, trainer_id, schedule_type, member_name, member_id, ot_session_id, scheduled_date, start_time, duration, note')
      .eq('scheduled_date', date)
      .order('start_time', { ascending: true }),
  ])

  const trainers = trainersRes.data
  const schedules = schedulesRes.data
  if (!trainers || !schedules) return []

  // 2) assignment 정보를 위한 ID 수집
  const otSessionIds = schedules.filter((s) => s.ot_session_id).map((s) => s.ot_session_id as string)
  const memberIdsForFallback = Array.from(new Set(
    schedules
      .filter((s) => ['OT', 'PT', 'PPT'].includes(s.schedule_type) && !s.ot_session_id && s.member_id)
      .map((s) => s.member_id)
      .filter(Boolean)
  )) as string[]

  // 3) ot_sessions + member fallback 병렬 조회
  const [sessionsRes, memberAssignmentsRes] = await Promise.all([
    otSessionIds.length > 0
      ? supabase.from('ot_sessions').select('id, ot_assignment_id').in('id', otSessionIds)
      : Promise.resolve({ data: null }),
    memberIdsForFallback.length > 0
      ? supabase.from('ot_assignments').select('id, member_id, is_sales_target, is_pt_conversion, sales_status').in('member_id', memberIdsForFallback).not('status', 'in', '("완료","거부")').order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
  ])

  // 4) session → assignment 매핑이 필요하면 assignments 조회
  const sessionData = sessionsRes.data ?? []
  const assignmentIds = Array.from(new Set(sessionData.map((s) => s.ot_assignment_id)))

  let assignmentsData: { id: string; is_sales_target: boolean; is_pt_conversion: boolean; sales_status: string }[] = []
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from('ot_assignments')
      .select('id, is_sales_target, is_pt_conversion, sales_status')
      .in('id', assignmentIds)
    assignmentsData = data ?? []
  }

  // 5) 맵 구성
  const assignmentMap = new Map<string, { is_sales_target: boolean; is_pt_conversion: boolean; sales_status: string }>()
  for (const a of assignmentsData) {
    assignmentMap.set(a.id, { is_sales_target: a.is_sales_target, is_pt_conversion: a.is_pt_conversion, sales_status: a.sales_status })
  }

  // sessionId → assignment info
  const sessionAssignmentMap = new Map<string, { assignment_id: string; is_sales_target: boolean; is_pt_conversion: boolean; sales_status: string }>()
  for (const sd of sessionData) {
    const aInfo = assignmentMap.get(sd.ot_assignment_id)
    if (aInfo) {
      sessionAssignmentMap.set(sd.id, { assignment_id: sd.ot_assignment_id, ...aInfo })
    }
  }

  // memberId → assignment info (fallback)
  const memberAssignmentMap = new Map<string, { assignment_id: string; is_sales_target: boolean; is_pt_conversion: boolean; sales_status: string }>()
  for (const a of (memberAssignmentsRes.data ?? [])) {
    if (!memberAssignmentMap.has(a.member_id)) {
      memberAssignmentMap.set(a.member_id, {
        assignment_id: a.id,
        is_sales_target: a.is_sales_target,
        is_pt_conversion: a.is_pt_conversion,
        sales_status: a.sales_status,
      })
    }
  }

  // 6) 트레이너별로 그룹핑
  const scheduleMap = new Map<string, ScheduleOverviewItem[]>()
  for (const s of schedules) {
    const fromSession = s.ot_session_id ? sessionAssignmentMap.get(s.ot_session_id) : null
    const fromMember = s.member_id ? memberAssignmentMap.get(s.member_id) : null
    const aInfo = fromSession ?? fromMember ?? null

    const item: ScheduleOverviewItem = {
      id: s.id,
      trainer_id: s.trainer_id,
      schedule_type: s.schedule_type,
      member_name: s.member_name,
      member_id: s.member_id,
      ot_session_id: s.ot_session_id,
      scheduled_date: s.scheduled_date,
      start_time: s.start_time,
      duration: s.duration,
      note: s.note,
      is_sales_target: aInfo?.is_sales_target ?? false,
      is_pt_conversion: aInfo?.is_pt_conversion ?? false,
      ot_assignment_id: aInfo?.assignment_id ?? null,
      sales_status: aInfo?.sales_status ?? null,
      result_category: null,
    }

    const list = scheduleMap.get(s.trainer_id) ?? []
    list.push(item)
    scheduleMap.set(s.trainer_id, list)
  }

  return trainers.map((t) => ({
    trainer_id: t.id,
    trainer_name: t.name,
    role: t.role,
    folder_order: t.folder_order ?? 0,
    schedules: scheduleMap.get(t.id) ?? [],
  }))
}
