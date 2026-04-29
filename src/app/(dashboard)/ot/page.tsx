import { Suspense } from 'react'
import { getOtAssignments } from '@/actions/ot'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrationsByTrainer } from '@/actions/ot-registration'
import { getTrainerScheduleSlots } from '@/actions/schedule'
import { TrainerDetailTabs } from '@/components/ot/trainer-detail-tabs'
import { Loader2 } from 'lucide-react'
import { redirect } from 'next/navigation'

interface OtPageProps {
  searchParams: Promise<{ trainer?: string; tab?: string }>
}

export default async function OtPage({ searchParams }: OtPageProps) {
  const params = await searchParams
  let trainerId = params.trainer
  const tab = params.tab ?? 'schedule'

  // trainerId가 없으면 → 역할별 자동 진입
  if (!trainerId) {
    const profile = await getCurrentProfile()
    if (!profile) redirect('/login')

    const isAdmin = ['admin', '관리자'].includes(profile.role)

    if (!isAdmin) {
      // 트레이너/FC → 바로 자기 스케줄로 이동
      redirect(`/ot?trainer=${profile.id}&tab=schedule`)
    }

    // 관리자 → 첫 번째 트레이너로 자동 진입
    const staffList = await getStaffList()
    const firstTrainer = staffList.find((s) =>
      ['trainer', '강사', '팀장'].includes(s.role) && s.is_approved
    )
    trainerId = firstTrainer?.id ?? 'unassigned'
    redirect(`/ot?trainer=${trainerId}&tab=schedule`)
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium">데이터를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-sm text-red-500 mt-1">{err instanceof Error ? err.message : '알 수 없는 오류'}</p>
        </div>
      </div>
    )
  }

  const isAdmin = profile && ['admin', '관리자'].includes(profile.role)

  const allTrainers = staffList
    .filter((s) => !['admin'].includes(s.role))
    .map((s) => ({ id: s.id, name: s.name }))

  // 관리자용 탭 옵션: 트레이너 (지정 순서) + 미배정
  const TRAINER_ORDER = ['오종민', '정가윤', '박규민', '김석현', '유창욱', '구은솔']
  const trainerList = staffList
    .filter((s) => ['trainer', '강사', '팀장'].includes(s.role) && s.is_approved)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => {
      const ai = TRAINER_ORDER.indexOf(a.name)
      const bi = TRAINER_ORDER.indexOf(b.name)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.name.localeCompare(b.name)
    })
  const trainerOptions = [
    ...trainerList,
    { id: 'unassigned', name: '미배정' },
  ]

  const trainerName = trainerId === 'unassigned'
    ? '미배정'
    : trainerId === 'excluded'
      ? '제외회원'
      : staffList.find((s) => s.id === trainerId)?.name ?? '트레이너'

  const trainerPrograms = allPrograms.filter((p) => p.trainer_name === trainerName)

  return (
    <div className="space-y-4">
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
        isAdmin={!!isAdmin}
        trainerOptions={trainerOptions}
      />
    </div>
  )
}

function TrainerDetailSkeleton() {
  return <div className="flex items-center justify-center py-20 text-muted-foreground gap-3"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm">데이터를 불러오는 중...</span></div>
}
