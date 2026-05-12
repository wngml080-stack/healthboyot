import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // /reset 또는 /reset.html로 진입하는 모든 요청 → /ot로 강제 redirect
  // 옛 PWA가 옛 manifest의 start_url(/reset 계열)로 진입해도 매번 메인으로 이동, auth 토큰 유지
  if (pathname === '/reset' || pathname.startsWith('/reset.html') || pathname.startsWith('/reset?') || pathname.startsWith('/reset/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ot'
    url.search = ''
    return NextResponse.redirect(url)
  }

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

  // 세션 확인 (쿠키만 읽음 — 네트워크 호출 없음, Disk IO 절약)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 비인증 사용자 → 로그인으로 (단, 진단/리셋용 페이지는 예외 — 캐시 문제 디버깅용)
  const PUBLIC_PATHS = ['/login', '/debug-errors', '/reset']
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (!session && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 인증된 사용자가 로그인 접근 시 → /ot으로
  if (session && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ot'
    return NextResponse.redirect(url)
  }

  // 역할 기반 접근 제어
  if (session) {
    const role = session.user.user_metadata?.role as string | undefined

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
