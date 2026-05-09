'use server'

import { cache } from 'react'
import { isDemoMode } from '@/lib/demo'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/types'

// cache()로 같은 요청 내 중복 호출 방지 (layout + page에서 각각 호출해도 1번만 실행)
export const getStaffList = cache(async (): Promise<Profile[]> => {
  if (isDemoMode()) {
    return [
      { id: 'demo-admin-001', name: '김팀장', email: 'admin@demo.com', role: 'admin', avatar_url: null, folder_password: null, is_approved: true, work_start_time: '09:00', work_end_time: '18:00', created_at: '', updated_at: '' } as Profile,
      { id: 'demo-trainer-001', name: '박트레이너', email: 'trainer@demo.com', role: 'trainer', avatar_url: null, folder_password: null, is_approved: true, work_start_time: '10:00', work_end_time: '19:00', created_at: '', updated_at: '' } as Profile,
      { id: 'demo-fc-001', name: '이FC', email: 'fc@demo.com', role: 'fc', avatar_url: null, folder_password: null, is_approved: false, work_start_time: null, work_end_time: null, created_at: '', updated_at: '' } as Profile,
    ]
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, is_approved, has_folder, folder_order, folder_password, work_start_time, work_end_time, team_leader_id, created_at, updated_at')
    .order('role')
    .order('name')

  if (error) {
    console.error('[getStaffList] DB Error:', error.message, error.details, error.hint)
    throw new Error(error.message)
  }
  // folder_password를 클라이언트에 노출하지 않음
  return (data ?? []).map(({ folder_password: _, ...rest }) => ({ ...rest, folder_password: null })) as Profile[]
})

export async function createStaff(values: {
  email: string
  password: string
  name: string
  role: Role
}) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // signUp으로 유저 생성 (트리거가 profiles 자동 생성)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: { data: { name: values.name, role: values.role } },
  })

  if (signUpError) return { error: signUpError.message }

  // 트리거 후 role 보정 (트리거가 metadata role을 못 읽을 경우 대비)
  if (signUpData.user) {
    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: signUpData.user.id,
      name: values.name,
      email: values.email,
      role: values.role,
      is_approved: false,
    })
    if (upsertError) return { error: upsertError.message }
  }

  return { success: true }
}

export async function updateStaff(id: string, values: {
  name?: string
  role?: Role
  folder_password?: string | null
  is_approved?: boolean
  work_start_time?: string | null
  work_end_time?: string | null
  team_leader_id?: string | null
}) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteStaff(id: string) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // profiles에서 삭제 (auth.users는 Supabase 대시보드에서 관리)
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
