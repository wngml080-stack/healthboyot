'use client'

import { useState, useEffect, useCallback, useMemo, useTransition, memo, useRef } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, User, Clock, Filter, Search, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { type TrainerDaySchedule, type ScheduleOverviewItem, getAllTrainerSchedulesByDate } from '@/actions/schedule-overview'
import { getOtProgram, getOtProgramByMemberId } from '@/actions/ot-program'
import type { OtProgram } from '@/types'
import { cn } from '@/lib/utils'

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  OT: { bg: 'bg-blue-100/70', border: 'border-l-blue-400', text: 'text-blue-800' },
  PT: { bg: 'bg-slate-200/70', border: 'border-l-slate-400', text: 'text-slate-800' },
  PPT: { bg: 'bg-purple-100/70', border: 'border-l-purple-400', text: 'text-purple-800' },
  '바챌': { bg: 'bg-green-100/70', border: 'border-l-green-400', text: 'text-green-800' },
  '식사': { bg: 'bg-fuchsia-100/70', border: 'border-l-fuchsia-400', text: 'text-fuchsia-800' },
  '홍보': { bg: 'bg-pink-100/70', border: 'border-l-pink-400', text: 'text-pink-800' },
  '간부회의': { bg: 'bg-stone-200/70', border: 'border-l-stone-500', text: 'text-stone-800' },
  '팀회의': { bg: 'bg-lime-100/70', border: 'border-l-lime-400', text: 'text-lime-800' },
  '전체회의': { bg: 'bg-amber-100/70', border: 'border-l-amber-400', text: 'text-amber-800' },
  '간담회': { bg: 'bg-sky-100/70', border: 'border-l-sky-400', text: 'text-sky-800' },
  '당직': { bg: 'bg-rose-100/70', border: 'border-l-rose-400', text: 'text-rose-800' },
  '대외활동': { bg: 'bg-teal-100/70', border: 'border-l-teal-400', text: 'text-teal-800' },
  '유급휴식': { bg: 'bg-cyan-100/70', border: 'border-l-cyan-400', text: 'text-cyan-800' },
  '기타': { bg: 'bg-neutral-200/70', border: 'border-l-neutral-400', text: 'text-neutral-800' },
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  OT: 'bg-blue-100/70 border-blue-300 text-blue-900',
  PT: 'bg-slate-200/70 border-slate-400 text-slate-800',
  PPT: 'bg-purple-100/70 border-purple-300 text-purple-900',
  '바챌': 'bg-green-100/70 border-green-300 text-green-900',
  '식사': 'bg-fuchsia-100/70 border-fuchsia-300 text-fuchsia-900',
  '홍보': 'bg-pink-100/70 border-pink-300 text-pink-900',
  '간부회의': 'bg-stone-200/70 border-stone-400 text-stone-900',
  '팀회의': 'bg-lime-100/70 border-lime-300 text-lime-900',
  '전체회의': 'bg-amber-100/70 border-amber-300 text-amber-900',
  '간담회': 'bg-sky-100/70 border-sky-300 text-sky-900',
  '당직': 'bg-rose-100/70 border-rose-300 text-rose-900',
  '대외활동': 'bg-teal-100/70 border-teal-300 text-teal-900',
  '유급휴식': 'bg-cyan-100/70 border-cyan-300 text-cyan-900',
  '기타': 'bg-neutral-200/70 border-neutral-400 text-neutral-800',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500',
  '관리자': 'bg-red-500',
  '팀장': 'bg-amber-500',
  trainer: 'bg-blue-500',
  '강사': 'bg-pink-500',
  fc: 'bg-purple-500',
}

function formatTime(time: string): string {
  return time.slice(0, 5)
}

function endTime(start: string, duration: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + duration
  const eh = Math.floor(total / 60)
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const ROW_HEIGHT = 48 // px per 30min slot
const START_HOUR = 6
const START_MINUTES = START_HOUR * 60

const HOURS = Array.from({ length: 19 }, (_, i) => i + START_HOUR)

export function ScheduleOverview() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<TrainerDaySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'timeline'>('timeline')
  const [memberSearch, setMemberSearch] = useState('')

  // OT 프로그램 팝업
  const [programDialog, setProgramDialog] = useState<{
    open: boolean
    schedule: ScheduleOverviewItem | null
    program: OtProgram | null
    loading: boolean
  }>({ open: false, schedule: null, program: null, loading: false })

  const isMountedRef = useRef(true)
  const dataRef = useRef<TrainerDaySchedule[]>([])
  useEffect(() => () => { isMountedRef.current = false }, [])
  useEffect(() => { dataRef.current = data }, [data])

  const load = useCallback(async (targetDate: string) => {
    console.log('[ScheduleOverview] fetch 시작', targetDate, 'attempt=', retryCountRef.current)
    // 서버 액션 사용 — 서버측 supabase 클라이언트는 cookie를 동기 조회해
    // browser GoTrueClient의 세션 비동기 복원 race를 회피한다.
    const result = await getAllTrainerSchedulesByDate(targetDate)
    console.log('[ScheduleOverview] fetch 결과', { trainers: result.length, schedules: result.reduce((sum, t) => sum + t.schedules.length, 0) })
    // 트레이너가 비어있으면 RLS/auth 이슈 가능성 → outer retry
    if (result.length === 0) throw new Error('트레이너 데이터가 비었습니다 (인증/RLS 일시 이슈 가능성)')

    if (!isMountedRef.current) return
    startTransition(() => {
      setData(result)
      setLoading(false)
      // 첫 로드 시 오종민을 기본 선택
      setSelectedTrainer((prev) => {
        if (prev !== null) return prev
        const ojm = result.find((t) => t.trainer_name === '오종민')
        return ojm?.trainer_id ?? null
      })
    })
  }, [])

  const MAX_RETRIES = 5

  const tryLoad = useCallback(async (targetDate: string) => {
    setLoading(true)
    setLoadError(null)
    try {
      await load(targetDate)
      retryCountRef.current = 0
    } catch (err) {
      console.warn('[ScheduleOverview] 로딩 실패 (재시도', retryCountRef.current + 1, '/', MAX_RETRIES, '):', err)
      if (!isMountedRef.current) return
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1
        const delay = 250 * retryCountRef.current
        retryTimerRef.current = setTimeout(() => { void tryLoad(targetDate) }, delay)
      } else {
        setLoading(false)
        setLoadError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다')
      }
    }
  }, [load])

  useEffect(() => {
    retryCountRef.current = 0
    // 마운트/날짜 변경 시 즉시 fetch — 서버 액션이 cookie 기반이라 race 없음
    void tryLoad(date)

    // 탭 복귀 시 데이터가 비어있으면 재조회
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && dataRef.current.length === 0) {
        retryCountRef.current = 0
        void tryLoad(date)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [date, tryLoad])

  const handleManualRetry = () => {
    retryCountRef.current = 0
    void tryLoad(date)
  }

  const prev = () => setDate((d) => format(subDays(new Date(d), 1), 'yyyy-MM-dd'))
  const next = () => setDate((d) => format(addDays(new Date(d), 1), 'yyyy-MM-dd'))
  const goToday = () => setDate(format(new Date(), 'yyyy-MM-dd'))

  const dateObj = useMemo(() => new Date(date + 'T00:00:00'), [date])
  const dayOfWeek = format(dateObj, 'EEEE', { locale: ko })
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

  const displayed = useMemo(() => {
    const byTrainer = selectedTrainer ? data.filter((t) => t.trainer_id === selectedTrainer) : data
    const q = memberSearch.trim().toLowerCase()
    if (!q) return byTrainer
    // 회원명 부분 일치하는 스케줄만 남기고, 매칭 결과가 없는 트레이너는 제외
    return byTrainer
      .map((t) => ({
        ...t,
        schedules: t.schedules.filter((s) => (s.member_name ?? '').toLowerCase().includes(q)),
      }))
      .filter((t) => t.schedules.length > 0)
  }, [data, selectedTrainer, memberSearch])

  // 스케줄 클릭 -> OT 프로그램 조회 (병렬)
  const handleScheduleClick = useCallback(async (schedule: ScheduleOverviewItem) => {
    setProgramDialog({ open: true, schedule, program: null, loading: true })

    // assignment_id와 member_id 둘 다 있으면 병렬 조회
    const promises: Promise<OtProgram | null>[] = []
    if (schedule.ot_assignment_id) {
      promises.push(getOtProgram(schedule.ot_assignment_id))
    }
    if (schedule.member_id) {
      promises.push(getOtProgramByMemberId(schedule.member_id))
    }

    if (promises.length === 0) {
      setProgramDialog((prev) => ({ ...prev, loading: false }))
      return
    }

    const results = await Promise.all(promises)
    const program = results.find((r) => r !== null) ?? null
    setProgramDialog((prev) => ({ ...prev, program, loading: false }))
  }, [])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-white">
            <Calendar className="h-5 w-5 text-yellow-500" />
            스케줄 총괄
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">트레이너별 일일 스케줄을 한눈에 확인합니다</p>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('timeline')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'timeline' ? 'bg-yellow-400 shadow text-black' : 'text-gray-300 hover:text-white'
            )}
          >
            타임라인
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'all' ? 'bg-yellow-400 shadow text-black' : 'text-gray-300 hover:text-white'
            )}
          >
            카드뷰
          </button>
        </div>
      </div>

      {/* 날짜 네비게이션 */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
        <Button variant="ghost" size="icon" onClick={prev} className="h-9 w-9 text-gray-300 hover:text-white hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <button onClick={goToday} className="px-3 py-1 bg-yellow-400 text-black text-xs font-bold rounded-lg hover:bg-yellow-500 transition-colors">
            오늘
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{format(dateObj, 'M월 d일', { locale: ko })}</div>
            <div className={cn('text-xs font-medium', isWeekend ? 'text-red-400' : 'text-gray-400')}>{dayOfWeek}</div>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="text-xs sm:text-sm border border-white/20 bg-white/10 text-white rounded-lg px-2 py-1 w-[120px] sm:w-[140px]"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={next} className="h-9 w-9 text-gray-300 hover:text-white hover:bg-white/10">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* 회원 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="회원 검색..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder:text-gray-300 placeholder:font-medium text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/40 focus:border-yellow-400/40"
        />
      </div>

      {/* 트레이너 필터 칩 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-gray-500 shrink-0" />
        <button
          onClick={() => setSelectedTrainer(null)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            !selectedTrainer ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white/5 text-gray-300 border-white/20 hover:border-white/40'
          )}
        >
          전체 ({data.length})
        </button>
        {data.map((t) => (
          <button
            key={t.trainer_id}
            onClick={() => setSelectedTrainer(selectedTrainer === t.trainer_id ? null : t.trainer_id)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              selectedTrainer === t.trainer_id ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white/5 text-gray-300 border-white/20 hover:border-white/40'
            )}
          >
            {t.trainer_name}
            {t.schedules.length > 0 && <span className="ml-1 text-[10px] opacity-70">({t.schedules.length})</span>}
          </button>
        ))}
      </div>

      {loading && data.length === 0 && !loadError && <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>}
      {loadError && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
          <AlertCircle className="h-6 w-6 text-red-400" />
          <span className="text-sm">{loadError}</span>
          <button
            onClick={handleManualRetry}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> 다시 시도
          </button>
        </div>
      )}

      {/* 타임라인뷰 */}
      {!(loading && data.length === 0) && viewMode === 'timeline' && (
        <div className={cn('bg-white rounded-xl border overflow-x-auto transition-opacity', loading && 'opacity-50')}>
          {/* 헤더 */}
          <div className="flex border-b bg-gray-50 sticky top-0 z-20">
            <div className="w-14 shrink-0 px-2 py-3 text-[11px] font-bold text-gray-500 sticky left-0 bg-gray-50 z-30 border-r text-center">
              시간
            </div>
            {displayed.map((t) => (
              <div key={t.trainer_id} className="flex-1 min-w-[140px] text-center text-xs font-bold text-gray-700 px-2 py-3 border-r last:border-r-0">
                <div className="flex items-center justify-center gap-1.5">
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', ROLE_COLORS[t.role] ?? 'bg-gray-400')} />
                  {t.trainer_name}
                  {t.schedules.length > 0 && (
                    <span className="text-[10px] text-gray-400 font-normal">({t.schedules.length})</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 타임라인 바디 */}
          <div className="flex">
            {/* 시간 열 */}
            <div className="w-14 shrink-0 sticky left-0 bg-white z-10 border-r">
              {HOURS.map((hour) => (
                <div key={hour} style={{ height: ROW_HEIGHT * 2 }}>
                  <div className="border-b border-gray-200 px-1 flex items-start pt-1 justify-center" style={{ height: ROW_HEIGHT }}>
                    <span className="text-[11px] text-gray-500 font-mono font-semibold">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="border-b border-gray-100" style={{ height: ROW_HEIGHT }} />
                </div>
              ))}
            </div>

            {/* 트레이너 열 */}
            {displayed.map((t) => (
              <div key={t.trainer_id} className="flex-1 min-w-[140px] relative border-r last:border-r-0">
                {/* 시간 격자 */}
                {HOURS.map((hour) => (
                  <div key={hour} style={{ height: ROW_HEIGHT * 2 }}>
                    <div className="border-b border-gray-200" style={{ height: ROW_HEIGHT }} />
                    <div className="border-b border-gray-100" style={{ height: ROW_HEIGHT }} />
                  </div>
                ))}

                {/* 스케줄 블록 */}
                {t.schedules.map((s) => {
                  const startMin = timeToMinutes(s.start_time)
                  const offsetMin = startMin - START_MINUTES
                  if (offsetMin < 0) return null
                  const top = (offsetMin / 30) * ROW_HEIGHT
                  const height = Math.max((s.duration / 30) * ROW_HEIGHT, ROW_HEIGHT)
                  const colors = TYPE_COLORS[s.schedule_type] ?? TYPE_COLORS['기타']
                  const isOtType = ['OT', 'PT', 'PPT'].includes(s.schedule_type)
                  const isClickable = isOtType && !!(s.ot_assignment_id || s.member_id)
                  const isShort = s.duration <= 30

                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'absolute left-1.5 right-1.5 rounded-lg border-l-[3px] shadow-sm overflow-hidden',
                        colors.bg, colors.border,
                        isClickable && 'cursor-pointer hover:shadow-lg hover:brightness-95 active:scale-[0.98] transition-all',
                        !isClickable && 'transition-shadow',
                      )}
                      style={{ top: top + 1, height: height - 2 }}
                      onClick={() => isClickable && handleScheduleClick(s)}
                    >
                      <div className={cn('px-2 h-full flex', isShort ? 'items-center gap-1' : 'flex-col justify-center gap-0.5 py-1')}>
                        <div className="flex items-center gap-1 min-w-0">
                          {s.is_sales_target && <span className="text-red-500 text-[11px] shrink-0">★</span>}
                          <span className={cn('text-[11px] font-bold', colors.text)}>{s.schedule_type}</span>
                        </div>
                        {s.member_name && (
                          <span className={cn('text-[11px] font-medium truncate', colors.text, isShort && 'flex-1')}>
                            {s.member_name}
                          </span>
                        )}
                        {!isShort && (
                          <span className="text-[10px] text-gray-500">
                            {formatTime(s.start_time)}~{endTime(s.start_time, s.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 카드뷰 */}
      {!(loading && data.length === 0) && viewMode === 'all' && (
        <div className="space-y-3">
          {displayed.map((trainer) => (
            <TrainerCard key={trainer.trainer_id} trainer={trainer} onScheduleClick={handleScheduleClick} />
          ))}
          {displayed.length === 0 && (
            <div className="py-20 text-center text-sm text-gray-400">해당 날짜에 등록된 트레이너가 없습니다</div>
          )}
        </div>
      )}

      {/* 요약 바 */}
      {data.length > 0 && <SummaryBar data={displayed} />}

      {/* OT 프로그램 팝업 */}
      <Dialog open={programDialog.open} onOpenChange={(open) => !open && setProgramDialog({ open: false, schedule: null, program: null, loading: false })}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {programDialog.schedule?.member_name} - OT 프로그램
              {programDialog.schedule?.is_sales_target && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">★ 매출대상자</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {programDialog.schedule && (
                <>{programDialog.schedule.schedule_type} | {formatTime(programDialog.schedule.start_time)}~{endTime(programDialog.schedule.start_time, programDialog.schedule.duration)} ({programDialog.schedule.duration}분)</>
              )}
            </DialogDescription>
          </DialogHeader>

          {programDialog.loading && <div className="py-10 text-center text-sm text-gray-400">프로그램 불러오는 중...</div>}
          {!programDialog.loading && !programDialog.program && <div className="py-10 text-center text-sm text-gray-400">등록된 OT 프로그램이 없습니다</div>}
          {!programDialog.loading && programDialog.program && <ProgramSummary program={programDialog.program} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProgramSummary({ program }: { program: OtProgram }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        {program.trainer_name && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 font-medium">담당 트레이너</div>
            <div className="font-bold">{program.trainer_name}</div>
          </div>
        )}
        {program.athletic_goal && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 font-medium">운동 목표</div>
            <div className="font-bold">{program.athletic_goal}</div>
          </div>
        )}
        {program.recommended_days_per_week && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 font-medium">주 권장 횟수</div>
            <div className="font-bold">{program.recommended_days_per_week}회</div>
          </div>
        )}
        {program.exercise_duration_min && (
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <div className="text-[10px] text-gray-400 font-medium">운동 시간</div>
            <div className="font-bold">{program.exercise_duration_min}분</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">승인 상태:</span>
        <span className={cn(
          'px-2 py-0.5 rounded-full text-[10px] font-bold',
          program.approval_status === '승인' && 'bg-green-100 text-green-700',
          program.approval_status === '반려' && 'bg-red-100 text-red-700',
          program.approval_status === '제출완료' && 'bg-blue-100 text-blue-700',
          program.approval_status === '작성중' && 'bg-gray-100 text-gray-600',
        )}>
          {program.approval_status}
        </span>
      </div>

      {program.sessions.map((session, idx) => {
        const exercises = session.exercises?.filter((e) => e.name) ?? []
        if (exercises.length === 0 && !session.tip && !session.plan) return null
        return (
          <div key={idx} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-bold">{idx + 1}차 OT{session.date && ` (${session.date})`}</span>
              {session.result_category && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold',
                  session.result_category === '매출대상' && 'bg-red-100 text-red-700',
                  session.result_category === '등록완료' && 'bg-green-100 text-green-700',
                  session.result_category === '수업완료' && 'bg-blue-100 text-blue-700',
                  (!['매출대상', '등록완료', '수업완료'].includes(session.result_category ?? '')) && 'bg-gray-100 text-gray-600',
                )}>
                  {session.result_category}
                </span>
              )}
            </div>
            {session.plan && (
              <div className="px-3 py-2 border-b bg-yellow-50">
                <div className="text-[10px] text-yellow-700 font-bold mb-0.5">플랜</div>
                <div className="text-xs text-yellow-900">{session.plan}</div>
              </div>
            )}
            {exercises.length > 0 && (
              <div className="divide-y">
                {exercises.map((ex, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-center gap-3 text-xs">
                    <span className="text-gray-400 w-4">{i + 1}</span>
                    <span className="font-medium flex-1">{ex.name}</span>
                    {ex.weight && <span className="text-gray-500">{ex.weight}kg</span>}
                    {ex.reps && <span className="text-gray-500">{ex.reps}회</span>}
                    {ex.sets && <span className="text-gray-500">{ex.sets}세트</span>}
                  </div>
                ))}
              </div>
            )}
            {session.tip && (
              <div className="px-3 py-2 border-t bg-blue-50">
                <div className="text-[10px] text-blue-700 font-bold mb-0.5">트레이너 팁</div>
                <div className="text-xs text-blue-900">{session.tip}</div>
              </div>
            )}
            {session.cardio?.types?.length > 0 && (
              <div className="px-3 py-2 border-t bg-green-50">
                <div className="text-[10px] text-green-700 font-bold mb-0.5">유산소</div>
                <div className="text-xs text-green-900">{session.cardio.types.join(', ')}{session.cardio.duration_min && ` (${session.cardio.duration_min}분)`}</div>
              </div>
            )}
          </div>
        )
      })}

      {program.inbody_data && program.inbody_data.current_weight && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b"><span className="text-xs font-bold">인바디</span></div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {[
              { label: '체중', current: program.inbody_data.current_weight, target: program.inbody_data.target_weight, unit: 'kg' },
              { label: '체지방', current: program.inbody_data.current_body_fat, target: program.inbody_data.target_body_fat, unit: '%' },
              { label: '골격근량', current: program.inbody_data.current_muscle_mass, target: program.inbody_data.target_muscle_mass, unit: 'kg' },
              { label: '기초대사량', current: program.inbody_data.current_bmr, target: program.inbody_data.target_bmr, unit: 'kcal' },
            ].filter((r) => r.current).map((row) => (
              <div key={row.label} className="bg-white px-3 py-2">
                <div className="text-[10px] text-gray-400">{row.label}</div>
                <div className="text-xs">
                  <span className="font-bold">{row.current}</span>
                  {row.target && <span className="text-gray-400"> → {row.target}</span>}
                  <span className="text-gray-400 ml-0.5">{row.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const TrainerCard = memo(function TrainerCard({ trainer, onScheduleClick }: { trainer: TrainerDaySchedule; onScheduleClick: (s: ScheduleOverviewItem) => void }) {
  const hasSchedules = trainer.schedules.length > 0
  const otCount = trainer.schedules.filter((s) => s.schedule_type === 'OT').length
  const ptCount = trainer.schedules.filter((s) => s.schedule_type === 'PT').length
  const pptCount = trainer.schedules.filter((s) => s.schedule_type === 'PPT').length
  const baChalCount = trainer.schedules.filter((s) => s.schedule_type === '바챌').length
  const otherCount = trainer.schedules.length - otCount - ptCount - pptCount - baChalCount
  const salesCount = trainer.schedules.filter((s) => s.is_sales_target).length

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className={cn('w-3 h-3 rounded-full', ROLE_COLORS[trainer.role] ?? 'bg-gray-400')} />
          <span className="font-bold text-sm text-gray-900">{trainer.trainer_name}</span>
          <span className="text-xs text-gray-500">{trainer.schedules.length}건</span>
        </div>
        <div className="flex gap-1.5">
          {salesCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full flex items-center gap-0.5">
              ★ 매출 {salesCount}
            </span>
          )}
          {otCount > 0 && <span className="px-2 py-0.5 bg-blue-100/80 text-blue-800 text-[10px] font-bold rounded-full">OT {otCount}</span>}
          {ptCount > 0 && <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 text-[10px] font-bold rounded-full">PT {ptCount}</span>}
          {pptCount > 0 && <span className="px-2 py-0.5 bg-purple-100/80 text-purple-800 text-[10px] font-bold rounded-full">PPT {pptCount}</span>}
          {baChalCount > 0 && <span className="px-2 py-0.5 bg-green-100/80 text-green-800 text-[10px] font-bold rounded-full">바챌 {baChalCount}</span>}
          {otherCount > 0 && <span className="px-2 py-0.5 bg-gray-100/80 text-gray-600 text-[10px] font-bold rounded-full">기타 {otherCount}</span>}
        </div>
      </div>
      {hasSchedules ? (
        <div className="divide-y divide-gray-100">
          {trainer.schedules.map((s) => {
            const isOtType = ['OT', 'PT', 'PPT'].includes(s.schedule_type)
            const isClickable = isOtType && !!(s.ot_assignment_id || s.member_id)
            return (
              <div
                key={s.id}
                className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', isClickable ? 'hover:bg-yellow-50 cursor-pointer' : 'hover:bg-gray-50')}
                onClick={() => isClickable && onScheduleClick(s)}
              >
                <div className="text-xs text-gray-600 font-mono w-[90px] shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(s.start_time)}~{endTime(s.start_time, s.duration)}
                </div>
                <span className={cn('px-2 py-0.5 rounded text-[11px] font-bold border shrink-0', TYPE_BADGE_COLORS[s.schedule_type] ?? TYPE_BADGE_COLORS['기타'])}>
                  {s.schedule_type}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                  <User className="h-3 w-3 text-gray-400" />
                  {s.member_name || '-'}
                </span>
                {s.is_sales_target && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                    ★ 매출대상
                  </span>
                )}
                {s.note && <span className="text-xs text-gray-500 truncate ml-auto hidden sm:block max-w-[200px]">{s.note}</span>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-xs text-gray-400">등록된 스케줄이 없습니다</div>
      )}
    </div>
  )
})

const SummaryBar = memo(function SummaryBar({ data }: { data: TrainerDaySchedule[] }) {
  const all = data.flatMap((t) => t.schedules)
  const typeCount = new Map<string, number>()
  for (const s of all) typeCount.set(s.schedule_type, (typeCount.get(s.schedule_type) ?? 0) + 1)
  const entries = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])
  const salesCount = all.filter((s) => s.is_sales_target).length

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-bold text-gray-400">
          총 {all.length}건 | {data.filter((t) => t.schedules.length > 0).length}명 활동
          {salesCount > 0 && <span className="text-red-400 ml-2">| 매출대상 {salesCount}명</span>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {entries.map(([type, count]) => (
            <span key={type} className={cn('px-2 py-0.5 rounded text-[10px] font-bold border', TYPE_BADGE_COLORS[type] ?? TYPE_BADGE_COLORS['기타'])}>
              {type} {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
})
