import { PageTitle } from '@/components/shared/page-title'
import { MembersLoader } from './loader'

export const runtime = 'edge'

export default async function MembersPage() {
  return (
    <div className="space-y-4">
      <PageTitle>회원 관리</PageTitle>
      <MembersLoader />
    </div>
  )
}
