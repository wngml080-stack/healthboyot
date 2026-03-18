'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isDemoMode, DEMO_ACCOUNTS, DEMO_COOKIE_NAME } from '@/lib/demo'
import type { Profile } from '@/types'

export async function signIn(formData: { email: string; password: string }) {
  if (isDemoMode()) {
    const account = DEMO_ACCOUNTS[formData.email]
    if (!account || account.password !== formData.password) {
      return { error: '이메일 또는 비밀번호가 올바르지 않습니다' }
    }

    const cookieStore = await cookies()
    cookieStore.set(DEMO_COOKIE_NAME, JSON.stringify(account.profile), {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24,
    })

    redirect('/ot')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { error, data } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    return { error: error.message }
  }

  // 승인 여부 확인
  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, role')
      .eq('id', data.user.id)
      .single()

    // admin은 항상 승인
    if (profile && !profile.is_approved && profile.role !== 'admin') {
      await supabase.auth.signOut()
      return { error: 'NOT_APPROVED' }
    }
  }

  redirect('/ot')
}

export async function signUp(formData: { email: string; password: string; name: string }) {
  if (isDemoMode()) {
    return { success: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { error, data } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        name: formData.name,
        password: formData.password, // 폴더 비밀번호로 사용
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // 트리거가 안 됐을 경우 수동으로 profiles 생성
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      name: formData.name,
      role: 'fc',
      is_approved: false,
      folder_password: formData.password,
    })
  }

  // 가입 후 바로 로그아웃 (승인 전까지 접근 불가)
  await supabase.auth.signOut()

  return { success: true }
}

export async function signOut() {
  if (isDemoMode()) {
    const cookieStore = await cookies()
    cookieStore.delete(DEMO_COOKIE_NAME)
    redirect('/login')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    const cookieStore = await cookies()
    const session = cookieStore.get(DEMO_COOKIE_NAME)?.value
    if (!session) return null
    try {
      return JSON.parse(session) as Profile
    } catch {
      return null
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}
