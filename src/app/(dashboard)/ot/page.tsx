import { getOtAssignments } from '@/actions/ot'
import { getTrainerFolders } from '@/actions/trainer-folders'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getTrainerScheduleSlots } from '@/actions/schedule'
import { TrainerCardList } from '@/components/ot/trainer-card-list'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import { TrainerSubNav } from '@/components/ot/trainer-sub-nav'
import { OtSummaryCards } from '@/components/ot/ot-summary-cards'
import { WeeklyReport } from '@/components/ot/weekly-report'
import { WeeklyCalendar } from '@/components/ot/weekly-calendar'
import { ApprovalList } from '@/components/approvals/approval-list'
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

  // 트레이너 데이터 — 필요한 모든 fetch를 단일 Promise.all로 묶어서 waterfall 제거
  let trainerAssignments: Awaited<ReturnType<typeof getOtAssignments>> = []
  let staffList: Awaited<ReturnType<typeof getStaffList>> = []
  let profile: Awaited<ReturnType<typeof getCurrentProfile>> = null
  let allPrograms: Awaited<ReturnType<typeof getAllOtPrograms>> = []
  let scheduleSlots: Awaited<ReturnType<typeof getTrainerScheduleSlots>> = []

  try {
    const results = await Promise.all([
      getOtAssignments({ trainerId }),
      getCurrentProfile(),
      getStaffList(),
      getAllOtPrograms(),
      trainerId !== 'unassigned'
        ? getTrainerScheduleSlots(trainerId)
        : Promise.resolve([]),
    ])
    trainerAssignments = results[0]
    profile = results[1]
    staffList = results[2]
    allPrograms = results[3]
    scheduleSlots = results[4]
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

  // 현재 유저의 역할 판별 (이 폴더에서 PT인지 PPT인지)
  const myRole = profile ? (() => {
    const isPT = trainerAssignments.some((a) => a.pt_trainer_id === profile.id)
    const isPPT = trainerAssignments.some((a) => a.ppt_trainer_id === profile.id)
    if (isPT && isPPT) return 'PT / PPT 담당'
    if (isPT) return 'PT 담당'
    if (isPPT) return 'PPT 담당'
    if (profile.role === 'admin') return '관리자'
    return ''
  })() : ''

  // 트레이너 프로그램 데이터 (알림 + 승인탭 공용) — 위 Promise.all에서 이미 받음
  const trainerPrograms = allPrograms.filter((p) => p.trainer_name === trainerName)

  return (
    <div className="space-y-4">
      {/* 상단 */}
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

      {/* 좌측 메뉴 + 콘텐츠 */}
      <div className="flex gap-6">
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
            <WeeklyCalendar assignments={trainerAssignments} trainerId={trainerId} />
          )}

          {tab === 'approvals' && profile && (
            <ApprovalList programs={trainerPrograms} profile={profile} />
          )}

          {tab === 'stats' && (
            <div className="space-y-6">
              <WeeklyReport assignments={trainerAssignments} trainerName={trainerName} />
              <OtSummaryCards assignments={trainerAssignments} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
