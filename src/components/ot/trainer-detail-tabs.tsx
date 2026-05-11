'use client'

import { useState, useCallback, useTransition, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, BarChart3, Loader2, Dumbbell } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { TrainerCardList } from './trainer-card-list'
// SSR/CSR 시각 차이로 인한 hydration mismatch (#310/#419) 방지 — client only 로드
const WeeklyCalendar = dynamic(() => import('./weekly-calendar').then((m) => ({ default: m.WeeklyCalendar })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>,
})
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
  initialPtMembers?: PtMember[]
  initialPtMonth?: string
  isAdmin?: boolean
  trainerOptions?: { id: string; name: string }[]
}

export function TrainerDetailTabs({
  trainerId, trainerName, initialTab, assignments, trainers,
  profile, initialSchedules, workStartTime, workEndTime,
  initialPrograms, initialRegistrations,
  initialPtMembers, initialPtMonth,
  isAdmin, trainerOptions,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [, startTransition] = useTransition()
  const isPseudoTrainer = trainerId === 'unassigned' || trainerId === 'excluded'

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

  // PT회원 데이터 — 서버에서 초기 fetch가 됐으면 즉시 표시, 아니면 마운트 useEffect에서 로딩
  const ptInitialMonth = useMemo(() => {
    if (initialPtMonth) return initialPtMonth
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [initialPtMonth])
  const hasInitialPtMembers = !!initialPtMembers && initialTab === 'pt-members'
  const [ptData, setPtData] = useState<{ members: PtMember[]; loaded: boolean }>({
    members: initialPtMembers ?? [],
    loaded: hasInitialPtMembers,
  })
  const [ptLoading, setPtLoading] = useState(false)

  // 초기 마운트 + trainerId 변경 시 활성 탭 데이터 로딩.
  // (switchTab은 사용자가 탭을 클릭할 때만 발화되므로, 하드 새로고침으로
  // `?tab=pt-members`인 채로 진입하면 switchTab이 한 번도 안 불려서
  // ptData가 빈 채로 PtMemberList가 렌더되던 버그를 막는다.)
  // ref를 null로 초기화해서 첫 마운트도 trainerChanged로 인식 → fetch 발화.
  const prevTrainerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevTrainerIdRef.current === trainerId) return
    const isInitialMount = prevTrainerIdRef.current === null
    prevTrainerIdRef.current = trainerId
    // 트레이너 변경 시에만 캐시 무효화 (초기 마운트는 그대로)
    if (!isInitialMount) {
      setPtData({ members: [], loaded: false })
      setStatsData((prev) => ({ ...prev, loaded: false }))
    }

    // 초기 마운트에 서버에서 받아온 PT 회원 데이터가 있으면 fetch 스킵
    const hasServerPrefetched = isInitialMount && hasInitialPtMembers
    if (activeTab === 'pt-members' && !isPseudoTrainer && !hasServerPrefetched) {
      console.log('[TrainerDetailTabs] PT 회원 로딩', { trainerId, ptInitialMonth, isInitialMount })
      setPtLoading(true)
      fetchPtMembersClient(trainerId, ptInitialMonth).then((members) => {
        console.log('[TrainerDetailTabs] PT 회원 로드 완료', { count: members.length })
        setPtData({ members, loaded: true })
      }).catch((err) => {
        console.error('[TrainerDetailTabs] PT 회원 로딩 실패:', err)
      }).finally(() => setPtLoading(false))
    }
  }, [trainerId, activeTab, ptInitialMonth, isPseudoTrainer, hasInitialPtMembers])

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
        !isPseudoTrainer
          ? getOtRegistrationsByTrainer(trainerId)
          : Promise.resolve([]),
      ]).then(([programs, registrations]) => {
        setStatsData({ programs, registrations: registrations as OtRegistration[], loaded: true })
        setStatsLoading(false)
      })
    }

    if (tabKey === 'pt-members' && isPseudoTrainer) {
      setPtData({ members: [], loaded: true })
      setPtLoading(false)
      return
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
  }, [activeTab, searchParams, router, startTransition, statsData.loaded, trainerId, ptData.loaded, ptInitialMonth, isPseudoTrainer])

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
            isPseudoTrainer ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-400">
                {trainerName}에는 PT 회원 목록이 없습니다.
              </div>
            ) : ptLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">PT 회원 로드 중...</span>
              </div>
            ) : (
              <PtMemberList
                key={trainerId}
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
