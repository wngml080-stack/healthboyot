import { Suspense } from 'react'
import { getOtAssignments } from '@/actions/ot'
import { getTrainerFolders } from '@/actions/trainer-folders'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrationsByTrainer } from '@/actions/ot-registration'
import { getTrainerScheduleSlots } from '@/actions/schedule'
import dynamic from 'next/dynamic'
import { TrainerSubNav } from '@/components/ot/trainer-sub-nav'
const TrainerCardList = dynamic(() => import('@/components/ot/trainer-card-list').then((m) => m.TrainerCardList), {
  loading: () => <div className="py-10 text-center text-sm text-gray-500">회원 목록 로드 중...</div>,
})
const TrainerFolderGrid = dynamic(() => import('@/components/ot/trainer-folder-grid').then((m) => m.TrainerFolderGrid), {
  loading: () => <div className="py-10 text-center text-sm text-gray-500">폴더 로드 중...</div>,
})
const TrainerStats = dynamic(() => import('@/components/ot/trainer-stats').then((m) => m.TrainerStats), {
  loading: () => <div className="py-10 text-center text-sm text-gray-500">통계 로드 중...</div>,
})
const WeeklyCalendar = dynamic(() => import('@/components/ot/weekly-calendar').then((m) => m.WeeklyCalendar), {
  loading: () => <div className="py-10 text-center text-sm text-gray-500">캘린더 로드 중...</div>,
})
import { PageTitle } from '@/components/shared/page-title'
import { NotificationBell } from '@/components/ot/notification-bell'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface OtPageProps {
  searchParams: Promise<{ trainer?: string; tab?: string }>
}

export default async function OtPage({ searchParams }: OtPageProps) {
  const params = await searchParams
  const trainerId = params.trainer
  const tab = params.tab ?? 'members'

  // 폴더 뷰
  if (!trainerId) {
    return (
      <Suspense fallback={<FolderViewSkeleton />}>
        <FolderView />
      </Suspense>
    )
  }

  // 트레이너 상세 — 쉘 먼저 표시, 콘텐츠는 스트리밍
  return (
    <Suspense fallback={<TrainerDetailSkeleton />}>
      <TrainerDetailView trainerId={trainerId} tab={tab} />
    </Suspense>
  )
}

// ─── 폴더 뷰 ─────────────────────────────────────────────
async function FolderView() {
  const [folders, staffList, profile] = await Promise.all([
    getTrainerFolders(),
    getStaffList(),
    getCurrentProfile(),
  ])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle>트레이너 관리</PageTitle>
        {profile?.role === 'admin' && (
          <Link
            href="/ot/recover"
            className="text-xs text-orange-600 hover:text-orange-700 underline"
          >
            OT 세션 복구
          </Link>
        )}
      </div>
      <TrainerFolderGrid
        folders={folders}
        allStaff={staffList.map((s) => ({ id: s.id, name: s.name, role: s.role, is_approved: s.is_approved }))}
        currentUserRole={profile?.role ?? 'fc'}
        currentUserId={profile?.id}
      />
    </div>
  )
}

function FolderViewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
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
      trainerId !== 'unassigned'
        ? getTrainerScheduleSlots(trainerId)
        : Promise.resolve([]),
      tab === 'stats' && trainerId !== 'unassigned'
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

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <TrainerSubNav trainerId={trainerId} />
        <div className="flex-1 min-w-0">
          {tab === 'members' && (
            <TrainerCardList
              assignments={trainerAssignments}
              trainers={allTrainers}
              trainerId={trainerId}
              trainerName={trainerName}
              profile={profile ?? undefined}
              initialSchedules={scheduleSlots}
            />
          )}

          {tab === 'schedule' && (
            <WeeklyCalendar assignments={trainerAssignments} trainerId={trainerId} profile={profile ?? undefined} />
          )}

          {tab === 'stats' && (
            <TrainerStats assignments={trainerAssignments} trainerName={trainerName} programs={trainerPrograms} registrations={trainerRegistrations} trainerId={trainerId} />
          )}
        </div>
      </div>
    </div>
  )
}

function TrainerDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="w-full md:w-44 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-9 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
