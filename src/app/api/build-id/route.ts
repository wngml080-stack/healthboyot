import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 클라이언트가 자기 빌드 ID와 서버 빌드 ID를 비교해 stale 캐시 감지에 사용
export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
    || process.env.VERCEL_DEPLOYMENT_ID
    || 'dev'
  return NextResponse.json(
    { buildId },
    { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
  )
}
