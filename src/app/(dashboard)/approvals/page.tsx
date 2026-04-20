import { Suspense } from 'react'
import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrations } from '@/actions/ot-registration'
import { PageTitle } from '@/components/shared/page-title'
import { ApprovalList } from '@/components/approvals/approval-list'
import { redirect } from 'next/navigation'

export default async function ApprovalsPage() {
  return (
    <div className="space-y-4">
      <PageTitle>OT 승인</PageTitle>
      <Suspense fallback={<ApprovalsSkeleton />}>
        <ApprovalsContent />
      </Suspense>
    </div>
  )
}

async function ApprovalsContent() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/ot')
  }

  const isAdmin = ['admin', '관리자'].includes(profile.role)
  const [allPrograms, allRegistrations] = await Promise.all([
    getAllOtPrograms(),
    getOtRegistrations(),
  ])

  const programs = isAdmin
    ? allPrograms
    : allPrograms.filter((p) => p.trainer_name === profile.name)

  const registrations = isAdmin
    ? allRegistrations
    : allRegistrations.filter((r) => r.trainer_id === profile.id)

  return <ApprovalList programs={programs} profile={profile} registrations={registrations} />
}

function ApprovalsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1].map((col) => (
        <div key={col} className="space-y-3">
          <div className="h-6 w-32 bg-gray-700/40 rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
