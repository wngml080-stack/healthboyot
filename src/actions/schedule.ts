'use server'

import { createClient } from '@/lib/supabase/server'

export interface TrainerSchedule {
  id: string
  trainer_id: string
  schedule_type: string
  member_name: string
  ot_session_id: string | null
  scheduled_date: string
  start_time: string
  duration: number
  note: string | null
  created_at: string
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
