import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtAssignment } from '@/actions/ot'
import { PageTitle } from '@/components/shared/page-title'
import { ApprovalList } from '@/components/approvals/approval-list'
import { redirect } from 'next/navigation'

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/ot')
  }

  const isAdmin = ['admin', '관리자'].includes(profile.role)
  const allPrograms = await getAllOtPrograms()

  // 트레이너는 자기 담당 프로그램만 표시
  const programs = isAdmin
    ? allPrograms
    : allPrograms.filter((p) => p.trainer_name === profile.name)

  return (
    <div className="space-y-4">
      <PageTitle>OT 승인</PageTitle>
      <ApprovalList programs={programs} profile={profile} />
    </div>
  )
}
