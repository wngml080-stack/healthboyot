import { getOtAssignments } from '@/actions/ot'
import { getTrainerFolders } from '@/actions/trainer-folders'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { TrainerOtTable } from '@/components/ot/trainer-ot-table'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import { OtSummaryCards } from '@/components/ot/ot-summary-cards'
import { TrainerSubNav } from '@/components/ot/trainer-sub-nav'
import { PageTitle } from '@/components/shared/page-title'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationBell } from '@/components/ot/notification-bell'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Link from 'next/link'

interface OtPageProps {
  searchParams: Promise<{ trainer?: string; tab?: string; week?: string }>
}

export default async function OtPage({ searchParams }: OtPageProps) {
  const params = await searchParams
  const trainerId = params.trainer
  const tab = params.tab ?? 'members'
  const weekFilter = params.week ? parseInt(params.week) : null

  // 폴더 뷰
  if (!trainerId) {
    const [folders, staffList, profile] = await Promise.all([
      getTrainerFolders(),
      getStaffList(),
      getCurrentProfile(),
    ])
    return (
      <div className="space-y-4">
        <PageTitle>트레이너 관리</PageTitle>
        <TrainerFolderGrid
          folders={folders}
          allStaff={staffList.map((s) => ({ id: s.id, name: s.name, role: s.role }))}
          currentUserRole={profile?.role ?? 'fc'}
        />
      </div>
    )
  }

  // 트레이너 데이터
  const allAssignments = await getOtAssignments()
  const trainerAssignments = trainerId === 'unassigned'
    ? allAssignments.filter((a) => !a.pt_trainer_id)
    : allAssignments.filter((a) => a.pt_trainer_id === trainerId)

  const activeAssignments = trainerAssignments.filter(
    (a) => !['신청대기', '배정완료'].includes(a.status)
  )

  const trainerName = trainerId === 'unassigned'
    ? '미배정'
    : trainerAssignments[0]?.pt_trainer?.name ?? '트레이너'

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center gap-3">
        <Link href="/ot" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          전체 목록
        </Link>
        <PageTitle>{trainerName}</PageTitle>
        <div className="ml-auto">
          <NotificationBell assignments={activeAssignments} />
        </div>
      </div>

      {/* 좌측 보조메뉴 + 우측 콘텐츠 */}
      <div className="flex gap-6">
        <TrainerSubNav trainerId={trainerId} />

        <div className="flex-1 min-w-0 space-y-6">
          {tab === 'members' && (
            <MembersTab
              assignments={activeAssignments}
              trainerId={trainerId}
              weekFilter={weekFilter}
            />
          )}

          {tab === 'schedule' && (
            <ScheduleTab assignments={activeAssignments} />
          )}

          {tab === 'stats' && (
            <StatsTab assignments={activeAssignments} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── 회원관리 탭 ──
function MembersTab({
  assignments,
  trainerId,
  weekFilter,
}: {
  assignments: import('@/types').OtAssignmentWithDetails[]
  trainerId: string
  weekFilter: number | null
}) {
  const filtered = weekFilter
    ? assignments.filter((a) => (a.week_number ?? getAutoWeek(a.created_at)) === weekFilter)
    : assignments

  const currentWeek = weekFilter ?? 0

  return (
    <>
      {/* 주차별 탭 */}
      <div>
        <div className="flex gap-2 mb-4">
          {[
            { label: '전체', value: 0 },
            { label: '1주차', value: 1 },
            { label: '2주차', value: 2 },
            { label: '3주차', value: 3 },
            { label: '4주차', value: 4 },
          ].map((tab) => (
            <Link
              key={tab.value}
              href={`/ot?trainer=${trainerId}&tab=members${tab.value ? `&week=${tab.value}` : ''}`}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentWeek === tab.value
                  ? 'bg-yellow-400 text-black'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <TrainerOtTable assignments={filtered} />
      </div>
    </>
  )
}

// ── 스케줄 탭 ──
function ScheduleTab({
  assignments,
}: {
  assignments: import('@/types').OtAssignmentWithDetails[]
}) {
  const today = new Date().toISOString().split('T')[0]

  // 이번 주 전체 일정
  const allSessions = assignments.flatMap((a) =>
    a.sessions
      .filter((s) => s.scheduled_at)
      .map((s) => ({
        ...s,
        memberName: a.member.name,
        isToday: s.scheduled_at?.startsWith(today),
      }))
  ).sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))

  const todaySessions = allSessions.filter((s) => s.isToday && !s.completed_at)
  const upcomingSessions = allSessions.filter((s) => !s.isToday && !s.completed_at && (s.scheduled_at ?? '') > today)
  const completedSessions = allSessions.filter((s) => s.completed_at)

  return (
    <div className="space-y-6">
      {/* 오늘 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">
            오늘의 OT ({format(new Date(), 'M월 d일 (EEE)', { locale: ko })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">오늘 예정된 OT가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {todaySessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.memberName}</p>
                    <p className="text-xs text-gray-500">{s.session_number}차 OT</p>
                  </div>
                  <p className="text-lg font-bold text-yellow-600">
                    {s.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 예정 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">예정된 OT</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">예정된 OT가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.memberName}</p>
                    <p className="text-xs text-gray-500">{s.session_number}차 OT</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {s.scheduled_at ? format(new Date(s.scheduled_at), 'M/d (EEE)', { locale: ko }) : '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 완료 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">완료된 OT ({completedSessions.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {completedSessions.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 text-center">완료된 OT가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {completedSessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-green-100 bg-green-50/50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.memberName}</p>
                    <p className="text-xs text-gray-500">{s.session_number}차 OT</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600 font-medium">
                      {s.completed_at ? format(new Date(s.completed_at), 'M/d 완료', { locale: ko }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── 통계표 탭 ──
function StatsTab({
  assignments,
}: {
  assignments: import('@/types').OtAssignmentWithDetails[]
}) {
  return <OtSummaryCards assignments={assignments} />
}

function getAutoWeek(createdAt: string): number {
  const d = new Date(createdAt).getDate()
  if (d <= 7) return 1; if (d <= 14) return 2; if (d <= 21) return 3; return 4
}
