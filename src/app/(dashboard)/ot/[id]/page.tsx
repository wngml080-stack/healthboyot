import { notFound } from 'next/navigation'
import { getOtAssignment } from '@/actions/ot'
import { getCurrentProfile } from '@/actions/auth'
import { OtDetailView } from '@/components/ot/ot-detail-view'
import { TrainerSubNav } from '@/components/ot/trainer-sub-nav'
import { PageTitle } from '@/components/shared/page-title'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OtDetailPage({ params }: Props) {
  const { id } = await params
  const [assignment, profile] = await Promise.all([
    getOtAssignment(id),
    getCurrentProfile(),
  ])

  if (!assignment || !profile) notFound()

  const trainerId = assignment.pt_trainer_id ?? 'unassigned'
  const trainerName = assignment.pt_trainer?.name ?? '미배정'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/ot?trainer=${trainerId}&tab=members`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {trainerName}
        </Link>
        <PageTitle>{assignment.member.name}</PageTitle>
      </div>

      <div className="flex gap-6">
        <TrainerSubNav trainerId={trainerId} />
        <div className="flex-1 min-w-0">
          <OtDetailView assignment={assignment} profile={profile} />
        </div>
      </div>
    </div>
  )
}
