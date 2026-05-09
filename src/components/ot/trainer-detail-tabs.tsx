'use client'

import { useState, useCallback, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, BarChart3, Loader2, Dumbbell } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { TrainerCardList } from './trainer-card-list'
import { WeeklyCalendar } from './weekly-calendar'
import { TrainerStats } from './trainer-stats'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrationsByTrainer } from '@/actions/ot-registration'
import { fetchPtMembersClient } from '@/lib/pt-members-client'
import { PtMemberList } from '@/components/pt-members/pt-member-list'
import type { OtAssignmentWithDetails, OtProgram, Profile, OtRegistration } from '@/types'
import type { PtMember } from '@/actions/pt-members'

const TABS = [
  { key: 'schedule', label: '스케줄', icon: CalendarDays },
  { key: 'members', label: 'OT회원', icon: Users },
  { key: 'pt-members', label: 'PT회원', icon: Dumbbell },
  { key: 'stats', label: '통계표', icon: BarChart3 },
] as const

interface Props {
  trainerId: string
  trainerName: string
  initialTab: string
  assignments: OtAssignmentWithDetails[]
  trainers: { id: string; name: string }[]
  profile?: Profile
  initialSchedules: { member_name: string; schedule_type: string; scheduled_date: string; start_time: string }[]
  workStartTime: string | null
  workEndTime: string | null
  initialPrograms: OtProgram[]
  initialRegistrations: OtRegistration[]
  isAdmin?: boolean
  trainerOptions?: { id: string; name: string }[]
}

export function TrainerDetailTabs({
  trainerId, trainerName, initialTab, assignments, trainers,
  profile, initialSchedules, workStartTime, workEndTime,
  initialPrograms, initialRegistrations,
  isAdmin, trainerOptions,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [, startTransition] = useTransition()

  // 통계 데이터 — 처음 stats 탭 열 때 로딩
  const [statsData, setStatsData] = useState<{
    programs: OtProgram[]
    registrations: OtRegistration[]
    loaded: boolean
  }>({
    programs: initialPrograms,
    registrations: initialRegistrations,
    loaded: initialTab === 'stats',
  })
  const [statsLoading, setStatsLoading] = useState(false)

  // PT회원 데이터 — 처음 pt-members 탭 열 때 로딩 (현재 월만)
  const ptInitialMonth = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])
  const [ptData, setPtData] = useState<{ members: PtMember[]; loaded: boolean }>({ members: [], loaded: false })
  const [ptLoading, setPtLoading] = useState(false)

  const switchTab = useCallback((tabKey: string) => {
    if (tabKey === activeTab) return
    setActiveTab(tabKey)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabKey)
    startTransition(() => {
      router.replace(`/ot?${params.toString()}`, { scroll: false })
    })

    if (tabKey === 'stats' && !statsData.loaded) {
      setStatsLoading(true)
      Promise.all([
        getAllOtPrograms({ includeAll: true }),
        trainerId !== 'unassigned' && trainerId !== 'excluded'
          ? getOtRegistrationsByTrainer(trainerId)
          : Promise.resolve([]),
      ]).then(([programs, registrations]) => {
        setStatsData({ programs, registrations: registrations as OtRegistration[], loaded: true })
        setStatsLoading(false)
      })
    }

    if (tabKey === 'pt-members' && !ptData.loaded) {
      setPtLoading(true)
      fetchPtMembersClient(trainerId, ptInitialMonth).then((members) => {
        setPtData({ members, loaded: true })
        setPtLoading(false)
      }).catch((err) => {
        console.error('[TrainerDetailTabs] PT 회원 로드 실패:', err)
        setPtLoading(false)
      })
    }
  }, [activeTab, searchParams, router, startTransition, statsData.loaded, trainerId, ptData.loaded, ptInitialMonth])

  // 관리자: 트레이너 변경 시 페이지 이동
  const switchTrainer = useCallback((newTrainerId: string) => {
    if (newTrainerId === trainerId) return
    router.push(`/ot?trainer=${newTrainerId}&tab=${activeTab}`)
  }, [trainerId, activeTab, router])

  const trainerPrograms = statsData.programs.filter((p) => p.trainer_name === trainerName)

  return (
    <div className="space-y-3">
      {/* 헤더: 트레이너 관리 제목 + 트레이너 탭 바 + 알림벨 */}
      <div className="flex items-center gap-2">
        <h1 className="hidden sm:block text-lg font-bold text-white border-l-4 border-yellow-400 pl-2 shrink-0">트레이너 관리</h1>
        {trainerOptions && trainerOptions.length > 0 && (
          <div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 w-max">
              {(isAdmin ? trainerOptions : trainerOptions.filter((t) => t.id === trainerId)).map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTrainer(t.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    t.id === trainerId
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="shrink-0">
          <NotificationBell assignments={assignments} programs={trainerPrograms} />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* 탭 네비게이션 */}
        <nav className="w-full lg:w-44 lg:shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 md:py-2.5 text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {activeTab === 'members' && (
            <TrainerCardList
              assignments={assignments}
              trainers={trainers}
              trainerId={trainerId}
              trainerName={trainerName}
              profile={profile}
              initialSchedules={initialSchedules}
            />
          )}

          {activeTab === 'schedule' && (
            <WeeklyCalendar
              assignments={assignments}
              trainerId={trainerId}
              profile={profile}
              workStartTime={workStartTime}
              workEndTime={workEndTime}
            />
          )}

          {activeTab === 'pt-members' && (
            ptLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">PT 회원 로드 중...</span>
              </div>
            ) : (
              <PtMemberList
                initialMembers={ptData.members}
                trainers={[{ id: trainerId, name: trainerName }]}
                fixedTrainerId={trainerId}
                isAdmin={isAdmin}
                initialMonth={ptInitialMonth}
              />
            )
          )}

          {activeTab === 'stats' && (
            statsLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">통계 데이터 로드 중...</span>
              </div>
            ) : (
              <TrainerStats
                assignments={assignments}
                trainerName={trainerName}
                programs={trainerPrograms}
                registrations={statsData.registrations}
                trainerId={trainerId}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
