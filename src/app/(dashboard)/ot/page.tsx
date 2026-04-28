import { Suspense } from 'react'
import { getOtAssignments } from '@/actions/ot'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrationsByTrainer } from '@/actions/ot-registration'
import { getTrainerScheduleSlots } from '@/actions/schedule'
import { TrainerDetailTabs } from '@/components/ot/trainer-detail-tabs'
import { FolderLoader } from './folder-loader'
import { PageTitle } from '@/components/shared/page-title'
import { NotificationBell } from '@/components/ot/notification-bell'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface OtPageProps {
  searchParams: Promise<{ trainer?: string; tab?: string }>
}

export default async function OtPage({ searchParams }: OtPageProps) {
  const params = await searchParams
  const trainerId = params.trainer
  const tab = params.tab ?? 'schedule'

  // 폴더 뷰 — 제목 즉시, 데이터는 클라이언트에서 로딩
  if (!trainerId) {
    return (
      <div className="space-y-4">
        <PageTitle>트레이너 관리</PageTitle>
        <FolderLoader />
      </div>
    )
  }

  // 트레이너 상세 — 쉘 먼저 표시, 콘텐츠는 스트리밍
  return (
    <Suspense fallback={<TrainerDetailSkeleton />}>
      <TrainerDetailView trainerId={trainerId} tab={tab} />
    </Suspense>
  )
}

// ─── 트레이너 상세 뷰 ────────────────────────────────────
async function TrainerDetailView({ trainerId, tab }: { trainerId: string; tab: string }) {
  let trainerAssignments: Awaited<ReturnType<typeof getOtAssignments>> = []
  let staffList: Awaited<ReturnType<typeof getStaffList>> = []
  let profile: Awaited<ReturnType<typeof getCurrentProfile>> = null
  let allPrograms: Awaited<ReturnType<typeof getAllOtPrograms>> = []
  let scheduleSlots: Awaited<ReturnType<typeof getTrainerScheduleSlots>> = []
  let trainerRegistrations: Awaited<ReturnType<typeof getOtRegistrationsByTrainer>> = []

  try {
    const results = await Promise.all([
      getOtAssignments({ trainerId }),
      getCurrentProfile(),
      getStaffList(),
      tab === 'stats'
        ? getAllOtPrograms({ includeAll: true })
        : Promise.resolve([]),
      trainerId !== 'unassigned' && trainerId !== 'excluded'
        ? getTrainerScheduleSlots(trainerId)
        : Promise.resolve([]),
      tab === 'stats' && trainerId !== 'unassigned' && trainerId !== 'excluded'
        ? getOtRegistrationsByTrainer(trainerId)
        : Promise.resolve([]),
    ])
    trainerAssignments = results[0]
    profile = results[1]
    staffList = results[2]
    allPrograms = results[3]
    scheduleSlots = results[4]
    trainerRegistrations = results[5]
  } catch (err) {
    console.error('[OtPage] Error loading trainer data:', err)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/ot" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            전체 목록
          </Link>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium">데이터를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-sm text-red-500 mt-1">{err instanceof Error ? err.message : '알 수 없는 오류'}</p>
        </div>
      </div>
    )
  }

  const allTrainers = staffList
    .filter((s) => !['admin'].includes(s.role))
    .map((s) => ({ id: s.id, name: s.name }))

  const trainerName = trainerId === 'unassigned'
    ? '미배정'
    : trainerId === 'excluded'
      ? '제외회원'
      : staffList.find((s) => s.id === trainerId)?.name ?? '트레이너'

  const myRole = profile ? (() => {
    const isPT = trainerAssignments.some((a) => a.pt_trainer_id === profile.id)
    const isPPT = trainerAssignments.some((a) => a.ppt_trainer_id === profile.id)
    if (isPT && isPPT) return 'PT / PPT 담당'
    if (isPT) return 'PT 담당'
    if (isPPT) return 'PPT 담당'
    if (profile.role === 'admin') return '관리자'
    return ''
  })() : ''

  const trainerPrograms = allPrograms.filter((p) => p.trainer_name === trainerName)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/ot" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          전체 목록
        </Link>
        <div>
          <PageTitle>{trainerName}</PageTitle>
          {myRole && <p className="text-xs text-blue-500 font-medium">{myRole}</p>}
        </div>
        <div className="ml-auto">
          <NotificationBell assignments={trainerAssignments} programs={trainerPrograms} />
        </div>
      </div>

      <TrainerDetailTabs
        trainerId={trainerId}
        trainerName={trainerName}
        initialTab={tab}
        assignments={trainerAssignments}
        trainers={allTrainers}
        profile={profile ?? undefined}
        initialSchedules={scheduleSlots}
        workStartTime={staffList.find((s) => s.id === trainerId)?.work_start_time ?? null}
        workEndTime={staffList.find((s) => s.id === trainerId)?.work_end_time ?? null}
        initialPrograms={trainerPrograms}
        initialRegistrations={trainerRegistrations}
      />
    </div>
  )
}

function TrainerDetailSkeleton() {
  return <div className="flex items-center justify-center py-20 text-muted-foreground gap-3"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">데이터를 불러오는 중...</span></div>
}
