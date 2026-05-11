'use client'

// 과거에는 브라우저 supabase 클라이언트로 직접 쿼리했으나,
// createBrowserClient 인스턴스마다 별도로 세션을 비동기 복원해 첫 query가 anon으로
// 나가 RLS가 빈 결과를 반환하는 race가 빈번했음. (특히 hard refresh 시)
// → 서버 액션으로 우회. 서버 측 supabase 클라이언트는 cookie를 동기 조회해 안전함.
import { getPtMembers, getTrainersForPt } from '@/actions/pt-members'
import type { PtMember } from '@/actions/pt-members'

export async function fetchPtMembersClient(trainerId?: string, dataMonth?: string): Promise<PtMember[]> {
  return getPtMembers(trainerId, dataMonth)
}

export async function fetchTrainersForPtClient(): Promise<{ id: string; name: string }[]> {
  return getTrainersForPt()
}
