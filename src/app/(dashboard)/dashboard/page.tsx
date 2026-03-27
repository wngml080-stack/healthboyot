import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageTitle } from '@/components/shared/page-title'
import { Users, ClipboardList, CheckCircle, Clock } from 'lucide-react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS, DEMO_MEMBERS } from '@/lib/demo-data'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { MemberList } from '@/components/members/member-list'
import { PendingOtList } from '@/components/ot/pending-ot-list'
import type { OtAssignmentWithDetails } from '@/types'

async function getDashboardData() {
  if (isDemoMode()) {
    const pending = DEMO_OT_ASSIGNMENTS.filter((a) => a.status === '신청대기')
    const completed = DEMO_OT_ASSIGNMENTS.filter((a) => a.status === '완료')
    const allSessions = DEMO_OT_ASSIGNMENTS.flatMap((a) =>
      a.sessions
        .filter((s) => s.scheduled_at && !s.completed_at)
        .map((s) => ({ ...s, memberName: a.member.name, trainerName: a.pt_trainer?.name ?? '미배정' }))
    )
    const todaySessions = allSessions.filter((s) =>
      s.scheduled_at?.startsWith(new Date().toISOString().split('T')[0])
    )

    return {
      totalMembers: DEMO_MEMBERS.length,
      pendingCount: pending.length,
      completedThisWeek: completed.length,
      recentPending: pending,
      todaySessions,
    }
  }

  const supabase = await createClient()
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const [
    { count: totalMembers },
    { count: pendingCount },
    { count: completedThisWeek },
    { data: recentPending },
    { data: todaySessionsRaw },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('ot_assignments').select('*', { count: 'exact', head: true }).eq('status', '신청대기'),
    supabase.from('ot_assignments').select('*', { count: 'exact', head: true }).eq('status', '완료')
      .gte('updated_at', weekStart.toISOString()).lte('updated_at', weekEnd.toISOString()),
    supabase.from('ot_assignments').select(`
      *, member:members!inner(id, name, phone, ot_category, exercise_time, duration_months, detail_info, notes, registered_at, registration_source),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name)
    `).eq('status', '신청대기').order('created_at', { ascending: false }),
    supabase.from('ot_sessions').select(`
      *, ot_assignment:ot_assignments!inner(
        member:members!inner(name),
        pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name)
      )
    `).gte('scheduled_at', format(now, 'yyyy-MM-dd'))
      .lt('scheduled_at', format(new Date(now.getTime() + 86400000), 'yyyy-MM-dd'))
      .is('completed_at', null).order('scheduled_at'),
  ])

  return {
    totalMembers: totalMembers ?? 0,
    pendingCount: pendingCount ?? 0,
    completedThisWeek: completedThisWeek ?? 0,
    recentPending: (recentPending ?? []) as unknown as OtAssignmentWithDetails[],
    todaySessions: (todaySessionsRaw ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      scheduled_at: s.scheduled_at as string,
      session_number: s.session_number as number,
      memberName: ((s.ot_assignment as Record<string, unknown>)?.member as Record<string, string>)?.name ?? '',
      trainerName: ((s.ot_assignment as Record<string, unknown>)?.pt_trainer as Record<string, string>)?.name ?? '미배정',
    })),
  }
}

interface Props {
  searchParams: Promise<{ search?: string; trainer?: string; status?: string; from?: string; to?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams

  const [dashboardData, members, staffList] = await Promise.all([
    getDashboardData(),
    getMembers({
      search: params.search,
      trainer: params.trainer,
      status: params.status,
      from: params.from,
      to: params.to,
    }),
    getStaffList(),
  ])
  const trainers = staffList
    .filter((s) => !['admin'].includes(s.role))
    .map((s) => ({ id: s.id, name: s.name }))

  const { totalMembers, pendingCount, completedThisWeek, recentPending, todaySessions } = dashboardData
  const now = new Date()

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard title="전체 회원" value={totalMembers} icon={<Users className="h-4 w-4 text-gray-400" />} />
        <StatCard title="신청 대기" value={pendingCount} icon={<Clock className="h-4 w-4 text-yellow-500" />} highlight={pendingCount > 0} />
        <StatCard title="이번 주 완료" value={completedThisWeek} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <StatCard title="오늘 OT 예정" value={todaySessions.length} icon={<ClipboardList className="h-4 w-4 text-blue-500" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 신규 OT 대기 (전화번호 + 클릭시 상세) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-gray-900">신규 OT 대기</CardTitle>
            {pendingCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs">{pendingCount}건</Badge>
            )}
          </CardHeader>
          <CardContent>
            {recentPending.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">대기 중인 OT가 없습니다</p>
            ) : (
              <PendingOtList assignments={recentPending as OtAssignmentWithDetails[]} trainers={trainers} />
            )}
          </CardContent>
        </Card>

        {/* 전체 OT 일정 (모든 트레이너) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">
              전체 OT 일정 ({format(now, 'M월 d일 (EEE)', { locale: ko })})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySessions.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">오늘 예정된 OT가 없습니다</p>
            ) : (
              <div className="space-y-2">
                {todaySessions.map((s: { id: string; scheduled_at: string | null; session_number: number; memberName: string; trainerName: string }) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.memberName}</p>
                      <p className="text-xs text-gray-500">{s.session_number}차 OT · {s.trainerName}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {s.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '-'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 회원 리스트 */}
      <div>
        <div className="mb-3"><PageTitle>회원 목록</PageTitle></div>
        <MemberList initialMembers={members} trainers={trainers} />
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, highlight }: {
  title: string; value: number; icon: React.ReactNode; highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-yellow-400 bg-white' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{title}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}
