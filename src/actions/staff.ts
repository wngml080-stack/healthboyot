'use server'

import { isDemoMode } from '@/lib/demo'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Role } from '@/types'

export async function getStaffList(): Promise<Profile[]> {
  if (isDemoMode()) {
    return [
      { id: 'demo-admin-001', name: '김팀장', email: 'admin@demo.com', role: 'admin', avatar_url: null, folder_password: null, is_approved: true, created_at: '', updated_at: '' },
      { id: 'demo-trainer-001', name: '박트레이너', email: 'trainer@demo.com', role: 'trainer', avatar_url: null, folder_password: '1234', is_approved: true, created_at: '', updated_at: '' },
      { id: 'demo-fc-001', name: '이FC', email: 'fc@demo.com', role: 'fc', avatar_url: null, folder_password: null, is_approved: false, created_at: '', updated_at: '' },
    ]
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, avatar_url, folder_password, is_approved, has_folder, folder_order, created_at, updated_at')
    .order('role')
    .order('name')

  if (error) {
    console.error('[getStaffList] DB Error:', error.message, error.details, error.hint)
    throw new Error(error.message)
  }
  return data ?? []
}

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
