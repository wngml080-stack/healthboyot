'use server'

import { isDemoMode } from '@/lib/demo'
import type { Profile, Role } from '@/types'

export async function getStaffList(): Promise<Profile[]> {
  if (isDemoMode()) {
    return [
      { id: 'demo-admin-001', name: '김팀장', role: 'admin', avatar_url: null, folder_password: null, is_approved: true, created_at: '', updated_at: '' },
      { id: 'demo-trainer-001', name: '박트레이너', role: 'trainer', avatar_url: null, folder_password: '1234', is_approved: true, created_at: '', updated_at: '' },
      { id: 'demo-fc-001', name: '이FC', role: 'fc', avatar_url: null, folder_password: null, is_approved: false, created_at: '', updated_at: '' },
    ]
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('role')
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createStaff(values: {
  email: string
  password: string
  name: string
  role: Role
}) {
  if (isDemoMode()) return { success: true }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // Supabase Auth에 유저 생성
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
    user_metadata: { name: values.name, role: values.role },
  })

  if (authError) {
    // admin API 없으면 일반 signUp 시도
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { name: values.name, role: values.role } },
    })

    if (signUpError) return { error: signUpError.message }

    // profiles에 직접 upsert
    if (signUpData.user) {
      await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        name: values.name,
        role: values.role,
      })
    }

    return { success: true }
  }

  // profiles 업데이트 (트리거가 안 되었을 경우 대비)
  if (authData.user) {
    await supabase.from('profiles').upsert({
      id: authData.user.id,
      name: values.name,
      role: values.role,
    })
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

  const { createClient } = await import('@/lib/supabase/server')
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

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // profiles에서 삭제 (auth.users는 Supabase 대시보드에서 관리)
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
