import { NextResponse, type NextRequest } from 'next/server'
import { isDemoMode, DEMO_COOKIE_NAME } from '@/lib/demo'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isDemoMode()) {
    const demoSession = request.cookies.get(DEMO_COOKIE_NAME)?.value

    if (!demoSession && !pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (demoSession && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/ot', request.url))
    }

    if (demoSession) {
      try {
        const profile = JSON.parse(demoSession)
        if (profile.role === 'fc' && pathname.startsWith('/ot')) {
          return NextResponse.redirect(new URL('/members', request.url))
        }
        if (profile.role !== 'admin' && pathname.startsWith('/stats')) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch {}
    }

    return NextResponse.next()
  }

  // 실제 Supabase 모드
  const { updateSession } = await import('@/lib/supabase/middleware')
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
