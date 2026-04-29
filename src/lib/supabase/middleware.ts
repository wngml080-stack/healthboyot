import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (토큰 리프레시 포함)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 비인증 사용자 → 로그인으로
  if (!user && !pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 인증된 사용자가 로그인 접근 시 → /ot으로
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ot'
    return NextResponse.redirect(url)
  }

  // 역할 기반 접근 제어
  if (user) {
    const role = user.user_metadata?.role as string | undefined

    if (role === 'fc' && pathname.startsWith('/ot')) {
      const url = request.nextUrl.clone()
      url.pathname = '/members'
      return NextResponse.redirect(url)
    }

    if (role !== 'admin' && role !== '관리자' && (pathname.startsWith('/stats') || pathname.startsWith('/schedules'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
