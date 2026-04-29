'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { isDemoMode, DEMO_ACCOUNTS, DEMO_COOKIE_NAME } from '@/lib/demo'
import { createClient } from '@/lib/supabase/server'
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

  console.log('[signIn] start:', formData.email)
  const supabase = await createClient()
  console.log('[signIn] supabase client created')

  const { error, data } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })
  console.log('[signIn] auth result:', error ? `ERROR: ${error.message}` : `OK: ${data.user?.email}`)

  if (error) {
    return { error: error.message }
  }

  // 승인 여부 확인 — 에러나도 로그인은 진행
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, role')
      .eq('id', data.user!.id)
      .single()
    console.log('[signIn] profile:', profile?.role, 'approved:', profile?.is_approved)

    if (profile && !profile.is_approved && profile.role !== 'admin' && profile.role !== '관리자') {
      await supabase.auth.signOut()
      return { error: 'NOT_APPROVED' }
    }

    const currentRole = data.user!.user_metadata?.role as string | undefined
    if (profile?.role && currentRole !== profile.role) {
      await supabase.auth.updateUser({ data: { role: profile.role } })
      console.log('[signIn] role updated:', profile.role)
    }
  } catch (err) {
    console.error('[signIn] profile check error:', err)
  }

  console.log('[signIn] redirecting to /ot')
  redirect('/ot')
}

export async function signUp(formData: { email: string; password: string; name: string }) {
  if (isDemoMode()) {
    return { success: true }
  }

  const supabase = await createClient()

  const { error, data } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        name: formData.name,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // 가입 후 관리자 승인 필요 — is_approved: false로 생성
  // 승인 전까지 로그인 불가 (signIn에서 차단)
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      name: formData.name,
      email: formData.email,
      role: 'trainer',
      is_approved: false,
    })
  }

  // 가입 후 바로 로그아웃 → 관리자 승인 후 로그인 가능
  await supabase.auth.signOut()

  return { success: true }
}

export async function signOut() {
  if (isDemoMode()) {
    const cookieStore = await cookies()
    cookieStore.delete(DEMO_COOKIE_NAME)
    redirect('/login')
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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

  const supabase = await createClient()

  // getSession()은 JWT만 확인 (서버 왕복 없음)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return data
})
