import { PageTitle } from '@/components/shared/page-title'
import { PtMembersLoader } from './loader'
import { getPtMembers, getTrainersForPt } from '@/actions/pt-members'

// KST 기준 현재 월
function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function PtMembersPage() {
  const month = currentMonth()
  // 서버에서 미리 fetch — 클라이언트 마운트 후 fetch 1회 왕복 제거 (~200-500ms)
  const [members, trainers] = await Promise.all([
    getPtMembers(undefined, month),
    getTrainersForPt(),
  ])
  return (
    <div className="space-y-4">
      <PageTitle>PT 회원 리스트</PageTitle>
      <PtMembersLoader initialMembers={members} initialTrainers={trainers} initialMonth={month} />
    </div>
  )
}
