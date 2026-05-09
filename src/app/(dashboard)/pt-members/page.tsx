import { PageTitle } from '@/components/shared/page-title'
import { PtMembersLoader } from './loader'

export default async function PtMembersPage() {
  return (
    <div className="space-y-4">
      <PageTitle>PT 회원 리스트</PageTitle>
      <PtMembersLoader />
    </div>
  )
}
