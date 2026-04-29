'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, BarChart3, Loader2, ChevronDown } from 'lucide-react'
import { TrainerCardList } from './trainer-card-list'
import { WeeklyCalendar } from './weekly-calendar'
import { TrainerStats } from './trainer-stats'
import { getAllOtPrograms } from '@/actions/ot-program'
import { getOtRegistrationsByTrainer } from '@/actions/ot-registration'
import type { OtAssignmentWithDetails, OtProgram, Profile, OtRegistration } from '@/types'

const TABS = [
  { key: 'schedule', label: '스케줄', icon: CalendarDays },
  { key: 'members', label: '회원관리', icon: Users },
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
  }, [activeTab, searchParams, router, startTransition, statsData.loaded, trainerId])

  // 관리자: 트레이너 변경 시 페이지 이동
  const switchTrainer = useCallback((newTrainerId: string) => {
    if (newTrainerId === trainerId) return
    router.push(`/ot?trainer=${newTrainerId}&tab=${activeTab}`)
  }, [trainerId, activeTab, router])

  const trainerPrograms = statsData.programs.filter((p) => p.trainer_name === trainerName)

  return (
    <div className="space-y-3">
      {/* 관리자용 트레이너 선택 드롭다운 */}
      {isAdmin && trainerOptions && trainerOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={trainerId}
              onChange={(e) => switchTrainer(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-600 text-white rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
            >
              {trainerOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-500">담당자 변경</span>
        </div>
      )}

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
