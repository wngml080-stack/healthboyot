'use server'

import { createClient } from '@/lib/supabase/server'

export interface TrainerSchedule {
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
  created_at: string
}

// 충돌 검사용 슬롯만 (가벼운 SELECT). 카드 리스트 client-side waterfall 제거용.
export interface TrainerScheduleSlot {
  member_name: string
  schedule_type: string
  scheduled_date: string
  start_time: string
}

export async function getTrainerScheduleSlots(trainerId: string): Promise<TrainerScheduleSlot[]> {
  const supabase = await createClient()
  // 오늘 기준 ±2주만 조회 (충돌 검사용이라 과거 전체가 불필요)
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('trainer_schedules')
    .select('member_name, schedule_type, scheduled_date, start_time')
    .eq('trainer_id', trainerId)
    .gte('scheduled_date', from)
    .lte('scheduled_date', to)

  if (error) return []
  return (data ?? []) as TrainerScheduleSlot[]
}

export async function getTrainerSchedules(trainerId: string, weekStart: string, weekEnd: string): Promise<TrainerSchedule[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('trainer_schedules')
    .select('*')
    .eq('trainer_id', trainerId)
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd)
    .order('scheduled_date')
    .order('start_time')

  if (error) return []
  return data as TrainerSchedule[]
}

// 트레이너의 모든 진행중 PT 회원 — 월별 분리 row 전부 (캘린더 블록의 라이브 회차 lookup용)
export async function getTrainerActivePtMembers(trainerId: string): Promise<{
  id: string
  name: string
  phone: string | null
  total_sessions: number
  completed_sessions: number
  data_month: string | null
}[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pt_members')
    .select('id, name, phone, total_sessions, completed_sessions, data_month')
    .eq('trainer_id', trainerId)
    .eq('status', '진행중')
    .order('data_month', { ascending: false })
    .order('name')
  if (error) { console.error('getTrainerActivePtMembers error:', error.message); return [] }
  return data ?? []
}

// 트레이너의 모든 PT/PPT/바챌 스케줄 — 회차 번호 자동 부여용 (날짜 무제한)
export async function getTrainerPtClassSchedules(trainerId: string): Promise<{
  id: string
  member_name: string
  schedule_type: string
  scheduled_date: string
  start_time: string
}[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trainer_schedules')
    .select('id, member_name, schedule_type, scheduled_date, start_time')
    .eq('trainer_id', trainerId)
    .in('schedule_type', ['PT', 'PPT', '바챌'])
  if (error) { console.error('getTrainerPtClassSchedules error:', error.message); return [] }
  return data ?? []
}

export async function createSchedule(values: {
  trainer_id: string
  schedule_type: string
  member_name: string
  scheduled_date: string
  start_time: string
  duration: number
  note?: string | null
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('trainer_schedules')
    .insert({
      trainer_id: values.trainer_id,
      schedule_type: values.schedule_type,
      member_name: values.member_name,
      scheduled_date: values.scheduled_date,
      start_time: values.start_time,
      duration: values.duration,
      note: values.note || null,
    })

  if (error) {
    console.error('createSchedule error:', error.message)
    return { error: error.message }
  }
  return { success: true }
}

export async function deleteSchedule(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('trainer_schedules')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
