import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtAssignment } from '@/actions/ot'
import { PageTitle } from '@/components/shared/page-title'
import { ApprovalList } from '@/components/approvals/approval-list'
import { redirect } from 'next/navigation'

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile()
  if (!profile || !['admin', '관리자'].includes(profile.role)) {
    redirect('/ot')
  }

  const programs = await getAllOtPrograms()

  return (
    <div className="space-y-4">
      <PageTitle>OT 프로그램 승인</PageTitle>
      <ApprovalList programs={programs} profile={profile} />
    </div>
  )
}
