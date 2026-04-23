import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession()은 JWT만 확인 (서버 왕복 없음 = 빠름)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname

  // 비인증 사용자 → 로그인으로 리다이렉트
  if (!session && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 인증된 사용자가 로그인 접근 시 → 대시보드로
  if (session && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ot'
    return NextResponse.redirect(url)
  }

  // 역할 기반 접근 제어 — DB에서 실시간 role 확인 (관리자 권한 변경 즉시 반영)
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_approved')
      .eq('id', session.user.id)
      .single()

    const role = profile?.role as string | undefined

    // 승인되지 않은 사용자 차단 (admin 제외)
    if (profile && !profile.is_approved && role !== 'admin' && role !== '관리자') {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (role) {
      if (role === 'fc' && pathname.startsWith('/ot')) {
        const url = request.nextUrl.clone()
        url.pathname = '/members'
        return NextResponse.redirect(url)
      }

      if (role !== 'admin' && role !== '관리자' && pathname.startsWith('/stats')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
