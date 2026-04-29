import { NextResponse, type NextRequest } from 'next/server'

/**
 * JWT 페이로드를 직접 디코딩 (네트워크 호출 없음, Edge에서 빠름)
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Supabase 세션 쿠키에서 access_token을 추출
 */
function getAccessToken(request: NextRequest): string | null {
  // Supabase auth 쿠키 이름 패턴: sb-<project-ref>-auth-token
  const cookies = request.cookies.getAll()

  // base 쿠키 찾기 (chunked 쿠키도 지원)
  const authCookieName = cookies.find(c => c.name.includes('-auth-token') && !c.name.includes('.'))?.name
  if (!authCookieName) return null

  // chunked 쿠키 조합 (.0, .1, .2 ...)
  let value = ''
  const baseCookie = request.cookies.get(authCookieName)?.value
  if (baseCookie) {
    value = baseCookie
  } else {
    // chunked
    let i = 0
    while (true) {
      const chunk = request.cookies.get(`${authCookieName}.${i}`)?.value
      if (!chunk) break
      value += chunk
      i++
    }
  }

  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    return parsed.access_token || null
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const accessToken = getAccessToken(request)

  // JWT가 없으면 비인증
  if (!accessToken) {
    if (!pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  const payload = decodeJwtPayload(accessToken)

  // JWT 디코딩 실패 또는 만료
  if (!payload) {
    if (!pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // JWT 만료 확인 (exp는 초 단위)
  const exp = payload.exp as number | undefined
  if (exp && exp * 1000 < Date.now()) {
    // 만료된 토큰 → 로그인으로 (토큰 갱신은 클라이언트에서 처리)
    if (!pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // 인증된 사용자가 로그인 접근 시 → 대시보드로
  if (pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/ot'
    return NextResponse.redirect(url)
  }

  // 역할 기반 접근 제어 — JWT user_metadata에서 role 확인 (DB 조회 없음)
  const userMetadata = payload.user_metadata as Record<string, unknown> | undefined
  const role = userMetadata?.role as string | undefined

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

  return NextResponse.next()
}
