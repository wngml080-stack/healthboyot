import { NextResponse, type NextRequest } from 'next/server'
import { isDemoMode, DEMO_COOKIE_NAME } from '@/lib/demo'
import { updateSession } from '@/lib/supabase/middleware'

// HTML 응답에 캐시 무효화 헤더 추가
// 모바일 사파리가 옛 HTML(=옛 청크 hash)을 캐시해 새 배포 후에도 stale chunk를 받는 문제 방지
function addNoStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
  return res
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isDemoMode()) {
    const demoSession = request.cookies.get(DEMO_COOKIE_NAME)?.value

    if (!demoSession && !pathname.startsWith('/login')) {
      return addNoStore(NextResponse.redirect(new URL('/login', request.url)))
    }

    if (demoSession && pathname.startsWith('/login')) {
      return addNoStore(NextResponse.redirect(new URL('/ot', request.url)))
    }

    if (demoSession) {
      try {
        const profile = JSON.parse(demoSession)
        if (profile.role === 'fc' && pathname.startsWith('/ot')) {
          return addNoStore(NextResponse.redirect(new URL('/members', request.url)))
        }
        if (profile.role !== 'admin' && profile.role !== '관리자' && (pathname.startsWith('/stats') || pathname.startsWith('/schedules'))) {
          return addNoStore(NextResponse.redirect(new URL('/dashboard', request.url)))
        }
      } catch (err) {
        console.error('[middleware] demo session parse 실패:', err)
      }
    }

    return addNoStore(NextResponse.next())
  }

  // 실제 Supabase 모드
  return addNoStore(await updateSession(request))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|form|sign|healthboy|manifest\\.json|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|json|woff|woff2|ttf|eot)$).*)',
  ],
}
