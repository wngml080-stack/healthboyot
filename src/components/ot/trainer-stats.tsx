'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, Target, CheckCircle2, Circle, Trash2, Plus, Camera, X } from 'lucide-react'
import { format, startOfWeek, endOfWeek, addDays, addWeeks } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { OtAssignmentWithDetails, OtProgram } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainerName: string
  programs: (OtProgram & { member_name?: string })[]
}

interface CellData { sessionNumber: number; completed: boolean; pastDue: boolean; approved: boolean; time?: string }

function toManwon(v: number): number { return v >= 10000 ? Math.round(v / 10000) : v }
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function getDayLabel(y: number, m: number, d: number) { return ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()] }
function isWeekend(y: number, m: number, d: number) { const dow = new Date(y, m - 1, d).getDay(); return dow === 0 || dow === 6 }

// 주간/일일 목표 (localStorage)
interface GoalItem { id: string; text: string; done: boolean }
interface WeeklyGoals { weekly: GoalItem[]; daily: Record<string, GoalItem[]> }
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

function useGoals(key: string) {
  const [goals, setGoals] = useState<WeeklyGoals>({ weekly: [], daily: {} })
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setGoals(JSON.parse(s)) } catch {} }, [key])
  const save = useCallback((g: WeeklyGoals) => { setGoals(g); localStorage.setItem(key, JSON.stringify(g)) }, [key])
  return {
    goals,
    addWeekly: (t: string) => save({ ...goals, weekly: [...goals.weekly, { id: crypto.randomUUID(), text: t, done: false }] }),
    addDaily: (dk: string, t: string) => { const items = goals.daily[dk] ?? []; save({ ...goals, daily: { ...goals.daily, [dk]: [...items, { id: crypto.randomUUID(), text: t, done: false }] } }) },
    toggleWeekly: (id: string) => save({ ...goals, weekly: goals.weekly.map((g) => g.id === id ? { ...g, done: !g.done } : g) }),
    toggleDaily: (dk: string, id: string) => save({ ...goals, daily: { ...goals.daily, [dk]: (goals.daily[dk] ?? []).map((g) => g.id === id ? { ...g, done: !g.done } : g) } }),
    removeWeekly: (id: string) => save({ ...goals, weekly: goals.weekly.filter((g) => g.id !== id) }),
    removeDaily: (dk: string, id: string) => save({ ...goals, daily: { ...goals.daily, [dk]: (goals.daily[dk] ?? []).filter((g) => g.id !== id) } }),
  }
}

// 차주 매출대상자 수동 입력 (localStorage)
interface CustomTarget { id: string; name: string; expectedAmount: number }
function useCustomTargets(key: string) {
  const [targets, setTargets] = useState<CustomTarget[]>([])
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setTargets(JSON.parse(s)) } catch {} }, [key])
  const save = (t: CustomTarget[]) => { setTargets(t); localStorage.setItem(key, JSON.stringify(t)) }
  return {
    targets,
    add: (name: string, amount: number) => save([...targets, { id: crypto.randomUUID(), name, expectedAmount: amount }]),
    remove: (id: string) => save(targets.filter((t) => t.id !== id)),
  }
}

export function TrainerStats({ assignments, trainerName, programs }: Props) {
  const now = new Date()
  const captureRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('weekly')

  // 월별 상태
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const daysInMonth = getDaysInMonth(year, month)
  const todayDate = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month

  // 주별 상태
  const [weekOffset, setWeekOffset] = useState(0)
  const selectedWeekStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), weekOffset)
  const selectedWeekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i))

  const prevPeriod = () => { if (viewMode === 'monthly') { if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1) } else setWeekOffset(weekOffset - 1) }
  const nextPeriod = () => { if (viewMode === 'monthly') { if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1) } else setWeekOffset(weekOffset + 1) }

  // 목표 (차주 목표달성용)
  const goalWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekKey = `trainer-goals-${trainerName}-${format(goalWeekStart, 'yyyy-MM-dd')}`
  const { goals, addWeekly, addDaily, toggleWeekly, toggleDaily, removeWeekly, removeDaily } = useGoals(weekKey)
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('')
  const [newDailyGoals, setNewDailyGoals] = useState<Record<string, string>>({})

  // 차주 매출대상자 수동 입력
  const nextWeekStart = addWeeks(goalWeekStart, 1)
  const customTargetKey = `next-targets-${trainerName}-${format(nextWeekStart, 'yyyy-MM-dd')}`
  const { targets: customTargets, add: addCustomTarget, remove: removeCustomTarget } = useCustomTargets(customTargetKey)
  const [newTargetName, setNewTargetName] = useState('')
  const [newTargetAmount, setNewTargetAmount] = useState('')

  // 이미지 저장
  const handleCapture = async () => {
    if (!captureRef.current) return
    setCapturing(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      captureRef.current.style.padding = '24px'
      const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: '#1a1a2e', useCORS: true })
      captureRef.current.style.padding = ''
      const link = document.createElement('a')
      link.download = `${trainerName}_통계표_${viewMode === 'monthly' ? `${year}년${month}월` : format(selectedWeekStart, 'yyyy-MM-dd')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch { alert('이미지 저장에 실패했습니다') }
    setCapturing(false)
  }

  // 데이터 매핑
  const { memberRows, dailyTotals, columns, summary, periodSummary, inbodyRows, nextWeekTargets } = useMemo(() => {
    const nowTime = Date.now()
    const programMap = new Map<string, OtProgram>()
    for (const p of programs) programMap.set(p.ot_assignment_id, p)

    // 기간 결정
    let dateRange: { start: Date; end: Date }
    if (viewMode === 'monthly') {
      dateRange = { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59) }
    } else {
      dateRange = { start: selectedWeekStart, end: selectedWeekEnd }
    }

    const cols: { date: Date; day: number; label: string; isToday: boolean; isWknd: boolean }[] = []
    if (viewMode === 'monthly') {
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month - 1, d)
        cols.push({ date: dt, day: d, label: `${d}`, isToday: isCurrentMonth && d === todayDate, isWknd: isWeekend(year, month, d) })
      }
    } else {
      for (const dt of weekDays) {
        const isToday = format(dt, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
        cols.push({ date: dt, day: dt.getDate(), label: `${dt.getMonth() + 1}/${dt.getDate()} ${getDayLabel(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())}`, isToday, isWknd: dt.getDay() === 0 || dt.getDay() === 6 })
      }
    }

    const rows = assignments
      .filter((a) => !['거부'].includes(a.status))
      .map((a) => {
        const cells: Record<string, CellData> = {}
        let totalCompleted = 0; let totalScheduled = 0
        const prog = programMap.get(a.id)

        for (const s of a.sessions ?? []) {
          const dateStr = s.scheduled_at ?? s.completed_at
          if (!dateStr) continue
          const d = new Date(dateStr)
          if (d < dateRange.start || d > dateRange.end) continue
          const key = format(d, 'yyyy-MM-dd')
          const completed = !!s.completed_at
          const pastDue = !completed && new Date(s.scheduled_at ?? '').getTime() < nowTime
          const progSession = prog?.sessions?.[s.session_number - 1]
          const timeStr = (s.scheduled_at ?? s.completed_at) ? format(new Date(s.scheduled_at ?? s.completed_at!), 'HH:mm') : undefined
          cells[key] = { sessionNumber: s.session_number, completed, pastDue, approved: progSession?.approval_status === '승인', time: timeStr }
          if (completed) totalCompleted++; else totalScheduled++
        }

        return {
          id: a.id, name: a.member.name, status: a.status,
          isPtConversion: a.is_pt_conversion, isSalesTarget: a.is_sales_target,
          actualSales: toManwon(a.actual_sales ?? 0), expectedAmount: toManwon(a.expected_amount ?? a.expected_sales ?? 0),
          cells, totalCompleted, totalScheduled,
          totalSessions: totalCompleted + totalScheduled,
        }
      })
      .sort((a, b) => b.totalSessions - a.totalSessions || a.name.localeCompare(b.name))

    const totals: Record<string, number> = {}
    for (const col of cols) {
      const key = format(col.date, 'yyyy-MM-dd')
      totals[key] = rows.reduce((sum, r) => sum + (r.cells[key] ? 1 : 0), 0)
    }

    const totalOt = rows.reduce((s, r) => s + r.totalSessions, 0)
    const totalCompleted = rows.reduce((s, r) => s + r.totalCompleted, 0)
    const totalScheduled = rows.reduce((s, r) => s + r.totalScheduled, 0)
    const registered = assignments.filter((a) => a.status === '완료').length

    // 선택 기간 내 활동이 있는 회원 기준 통계
    const activeRows = rows.filter((r) => r.totalSessions > 0)
    const periodStats = {
      activeMembers: activeRows.length,
      totalOt,
      totalCompleted,
      totalScheduled,
      ptConversions: activeRows.filter((r) => r.isPtConversion).length,
      salesTargets: activeRows.filter((r) => r.isSalesTarget).length,
      totalActualSales: activeRows.reduce((s, r) => s + r.actualSales, 0),
      totalExpectedSales: activeRows.reduce((s, r) => s + r.expectedAmount, 0),
    }

    // 인바디 (전체 — 월 필터 없이 프로그램 기반)
    const inbody: { name: string; session: number; date: string; hasImages: boolean }[] = []
    for (const a of assignments) {
      const prog = programMap.get(a.id)
      if (!prog?.sessions) continue
      prog.sessions.forEach((s, i) => {
        if (!s.inbody) return
        const ot = a.sessions?.find((os) => os.session_number === i + 1)
        const dateStr = ot?.completed_at ?? ot?.scheduled_at ?? ''
        inbody.push({
          name: a.member.name, session: i + 1,
          date: dateStr ? format(new Date(dateStr), 'M/d', { locale: ko }) : '-',
          hasImages: (s.inbody_images?.length ?? 0) > 0,
        })
      })
    }

    // 다음주 매출대상자 (스케줄 유무와 관계없이 모든 매출대상자 표시)
    const nws = addDays(goalWeekStart, 7); const nwe = addDays(nws, 6)
    const nextTargets = assignments
      .filter((a) => a.is_sales_target && a.status !== '완료')
      .map((a) => {
        const ns = a.sessions?.find((s) => s.scheduled_at && !s.completed_at && new Date(s.scheduled_at) >= nws && new Date(s.scheduled_at) <= nwe)
        return { id: a.id, name: a.member.name, expectedAmount: toManwon(a.expected_amount ?? a.expected_sales ?? 0), session: ns, isCustom: false }
      })

    return {
      memberRows: rows, dailyTotals: totals, columns: cols,
      summary: {
        totalMembers: assignments.length, totalOt, totalCompleted, totalScheduled,
        ptConversions: rows.filter((r) => r.isPtConversion).length,
        salesTargets: rows.filter((r) => r.isSalesTarget).length,
        totalActualSales: rows.reduce((s, r) => s + r.actualSales, 0),
        totalExpectedSales: rows.reduce((s, r) => s + r.expectedAmount, 0),
        registered, closingRate: assignments.length > 0 ? Math.round((registered / assignments.length) * 100) : 0,
        rejected: assignments.filter((a) => a.status === '거부').length,
        noContact: assignments.filter((a) => a.sales_status === '연락두절').length,
        closingFailed: assignments.filter((a) => a.sales_status === '클로징실패').length,
        scheduleUndecided: assignments.filter((a) => a.sales_status === '스케줄미확정').length,
      },
      periodSummary: periodStats,
      inbodyRows: inbody, nextWeekTargets: nextTargets,
    }
  }, [assignments, programs, year, month, daysInMonth, isCurrentMonth, todayDate, viewMode, selectedWeekStart, selectedWeekEnd, weekDays, goalWeekStart, now])

  const grandTotal = memberRows.reduce((s, r) => s + r.totalSessions, 0)
  const periodLabel = viewMode === 'monthly'
    ? `${year}년 ${month}월`
    : `${format(selectedWeekStart, 'M/d')} ~ ${format(selectedWeekEnd, 'M/d')}`

  // 차주 라벨
  const nextWeekLabel = `${format(nextWeekStart, 'M/d')} ~ ${format(addDays(nextWeekStart, 6), 'M/d')}`

  // 전체 차주 대상자 (자동 + 수동)
  const allNextTargets = [
    ...nextWeekTargets,
    ...customTargets.map((t) => ({ id: t.id, name: t.name, expectedAmount: t.expectedAmount, session: undefined as any, isCustom: true })),
  ]
  const totalNextExpected = allNextTargets.reduce((s, t) => s + t.expectedAmount, 0)

  return (
    <div ref={captureRef} className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">{trainerName} 통계표</h2>
          <div className="flex bg-white/10 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('monthly')} className={`px-3 py-1 text-xs font-bold ${viewMode === 'monthly' ? 'bg-yellow-400 text-black' : 'text-white/70 hover:text-white'}`}>월별</button>
            <button onClick={() => setViewMode('weekly')} className={`px-3 py-1 text-xs font-bold ${viewMode === 'weekly' ? 'bg-yellow-400 text-black' : 'text-white/70 hover:text-white'}`}>주차별</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={handleCapture} disabled={capturing}>
            <Camera className="h-3 w-3 mr-1" />{capturing ? '저장 중...' : '이미지 저장'}
          </Button>
          <button onClick={prevPeriod} className="p-1.5 rounded-lg hover:bg-white/10 text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-bold text-white min-w-[120px] text-center">{periodLabel}</span>
          <button onClick={nextPeriod} className="p-1.5 rounded-lg hover:bg-white/10 text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* ① 요약 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <SummaryCard label="총 OT" value={summary.totalOt} sub={`${summary.totalMembers}명`} color="text-gray-900" />
        <SummaryCard label="완료" value={summary.totalCompleted} color="text-emerald-600" />
        <SummaryCard label="예정" value={summary.totalScheduled} color="text-blue-600" />
        <SummaryCard label="PT전환" value={summary.ptConversions} color="text-purple-600" />
        <SummaryCard label="등록매출" value={summary.totalActualSales ? `${summary.totalActualSales.toLocaleString()}만` : '-'} color="text-green-700" />
      </div>

      {/* ② 일자별 OT 그리드 */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="sticky left-0 z-10 bg-gray-900 px-1 py-1 text-center font-bold whitespace-nowrap w-[90px] min-w-[90px]">회원명</th>
                  {columns.map((col, ci) => (
                    <th key={ci} className={`px-0 py-1 text-center font-medium ${viewMode === 'weekly' ? 'w-[60px] min-w-[60px]' : 'w-[22px] min-w-[22px]'} ${col.isToday ? 'bg-yellow-500 text-black' : col.isWknd ? 'bg-gray-700' : ''}`}>
                      <div className="leading-none">{col.label}</div>
                    </th>
                  ))}
                  <th className="px-1 py-1 text-center font-bold bg-gray-800 w-[28px] min-w-[28px]">계</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.length === 0 ? (
                  <tr><td colSpan={columns.length + 2} className="py-6 text-center text-xs text-gray-400">해당 기간에 OT 데이터가 없습니다</td></tr>
                ) : memberRows.map((row) => {
                  const hasSession = row.totalSessions > 0
                  return (
                    <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${!hasSession ? 'opacity-60' : ''}`}>
                      <td className={`sticky left-0 z-10 bg-white border-r border-gray-200 px-1 text-center font-medium text-gray-900 whitespace-nowrap text-[10px] ${hasSession ? 'py-1' : 'py-[1px]'}`}>
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="truncate max-w-[50px]">{row.name}</span>
                          {row.isPtConversion && <Badge className="bg-purple-500 text-white text-[7px] px-0.5 py-0 leading-tight rounded-sm">PT전환</Badge>}
                          {row.isSalesTarget && !row.isPtConversion && <Badge className="bg-blue-500 text-white text-[7px] px-0.5 py-0 leading-tight rounded-sm">매출대상</Badge>}
                        </div>
                      </td>
                      {columns.map((col, ci) => {
                        const key = format(col.date, 'yyyy-MM-dd')
                        const cell = row.cells[key]
                        if (!cell) return <td key={ci} className={`px-0 ${hasSession ? 'py-1' : 'py-[1px]'} text-center ${col.isToday ? 'bg-yellow-50' : col.isWknd ? 'bg-gray-50/70' : ''}`} />
                        const bg = cell.completed && cell.approved ? 'bg-amber-500 text-white' : cell.completed ? 'bg-emerald-500 text-white' : cell.pastDue ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
                        return (
                          <td key={ci} className={`px-0 py-1 text-center ${col.isToday ? 'bg-yellow-50' : ''}`}>
                            {viewMode === 'weekly' ? (
                              <div className={`inline-flex flex-col items-center justify-center rounded-sm px-1 py-0.5 ${bg}`}>
                                <span className="text-[9px] font-bold leading-none">{cell.time ?? ''}</span>
                                <span className="text-[8px] leading-none opacity-80">{cell.sessionNumber}차</span>
                              </div>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-[16px] h-[16px] rounded-sm text-[8px] font-bold ${bg}`} title={`${cell.sessionNumber}차`}>{cell.sessionNumber}</span>
                            )}
                          </td>
                        )
                      })}
                      <td className={`px-1 ${hasSession ? 'py-1' : 'py-[1px]'} text-center font-bold text-gray-900 bg-gray-50 border-l border-gray-200 text-[10px]`}>{row.totalSessions}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td className="sticky left-0 z-10 bg-gray-100 border-r border-gray-200 px-1 py-1 text-center text-gray-900 text-[10px]">합계</td>
                  {columns.map((col, ci) => {
                    const key = format(col.date, 'yyyy-MM-dd')
                    return <td key={ci} className={`px-0 py-1 text-center text-gray-900 text-[10px] ${col.isToday ? 'bg-yellow-100' : ''}`}>{dailyTotals[key] || ''}</td>
                  })}
                  <td className="px-1 py-1 text-center text-gray-900 bg-gray-200 border-l border-gray-300 text-[10px]">{grandTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-2 py-1.5 bg-gray-50 border-t border-gray-200 text-[9px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 완료</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 완료+승인</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 예정</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> 변경필요</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /> 오늘</span>
          </div>
        </CardContent>
      </Card>

      {/* ③ 인바디 통계 */}
      <Card>
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-sm text-gray-900">📊 인바디 측정 현황 (전체)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {inbodyRows.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">인바디 측정 기록이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-purple-50">
                    <th className="px-3 py-1.5 text-center font-bold text-purple-800">회원명</th>
                    <th className="px-3 py-1.5 text-center font-bold text-purple-800">차수</th>
                    <th className="px-3 py-1.5 text-center font-bold text-purple-800">측정일</th>
                    <th className="px-3 py-1.5 text-center font-bold text-purple-800">이미지</th>
                  </tr>
                </thead>
                <tbody>
                  {inbodyRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 text-center font-medium text-gray-900">{r.name}</td>
                      <td className="px-3 py-1.5 text-center">{r.session}차</td>
                      <td className="px-3 py-1.5 text-center text-gray-600">{r.date}</td>
                      <td className="px-3 py-1.5 text-center">{r.hasImages ? <Badge className="bg-purple-100 text-purple-700 text-[10px]">업로드됨</Badge> : <span className="text-gray-400">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ④ 다음주 매출대상자 */}
      <Card>
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-900">🎯 다음주 매출대상자 ({nextWeekLabel})</CardTitle>
            {totalNextExpected > 0 && <Badge className="bg-pink-100 text-pink-700 text-[10px]">예상 총 {totalNextExpected.toLocaleString()}만</Badge>}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          {allNextTargets.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">다음주 매출대상자가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {allNextTargets.map((t, i) => (
                <div key={t.id || i} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{t.name}</span>
                    {t.session ? (
                      <span className="text-[10px] text-blue-600">{t.session.session_number}차 · {format(new Date(t.session.scheduled_at!), 'M/d (EEE) HH:mm', { locale: ko })}</span>
                    ) : !t.isCustom ? (
                      <span className="text-[10px] text-gray-400">스케줄 미정</span>
                    ) : (
                      <Badge className="bg-gray-200 text-gray-600 text-[8px]">수동 입력</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.expectedAmount > 0 && <Badge className="bg-blue-600 text-white text-[10px]">예상 {t.expectedAmount.toLocaleString()}만</Badge>}
                    {t.isCustom && (
                      <button onClick={() => removeCustomTarget(t.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* 수동 추가 */}
          <div className="flex gap-2 items-center pt-1 border-t border-gray-100">
            <Input
              value={newTargetName}
              onChange={(e) => setNewTargetName(e.target.value)}
              placeholder="이름"
              className="text-xs h-8 bg-white flex-1"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={newTargetAmount}
              onChange={(e) => setNewTargetAmount(e.target.value)}
              placeholder="예상 (만원)"
              className="text-xs h-8 bg-white w-24"
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              disabled={!newTargetName.trim()}
              onClick={() => {
                addCustomTarget(newTargetName.trim(), Number(newTargetAmount) || 0)
                setNewTargetName('')
                setNewTargetAmount('')
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />추가
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ⑤ OT 현황 + 매출 (선택 기간 기준) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900">OT 현황</h3>
              <span className="text-[10px] text-gray-400">{periodLabel}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="총 인원" value={summary.totalMembers} color="bg-gray-100 text-gray-800" />
              <StatPill label="진행중" value={summary.totalMembers - summary.rejected - summary.registered} color="bg-green-100 text-green-800" />
              <StatPill label="등록완료" value={summary.registered} color="bg-blue-100 text-blue-800" />
              <StatPill label="거부자" value={summary.rejected} color="bg-orange-100 text-orange-800" />
              <StatPill label="연락두절" value={summary.noContact} color="bg-gray-100 text-gray-800" />
              <StatPill label="클로징실패" value={summary.closingFailed} color="bg-red-100 text-red-800" />
              <StatPill label="스케줄미확정" value={summary.scheduleUndecided} color="bg-yellow-100 text-yellow-800" />
              <StatPill label="매출대상자" value={summary.salesTargets} color="bg-indigo-100 text-indigo-800" />
              <StatPill label="PT전환" value={summary.ptConversions} color="bg-purple-100 text-purple-800" />
              <StatPill label="클로징율" value={`${summary.closingRate}%`} color="bg-pink-100 text-pink-800" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900">매출 요약</h3>
              <span className="text-[10px] text-gray-400">
                {periodSummary.activeMembers > 0 ? `${periodSummary.activeMembers}명 활동` : ''}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">예상 매출</span>
              <span className="text-lg font-bold text-pink-600">{periodSummary.totalExpectedSales ? `${periodSummary.totalExpectedSales.toLocaleString()}만` : '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">등록 매출</span>
              <span className="text-lg font-bold text-green-700">{periodSummary.totalActualSales ? `${periodSummary.totalActualSales.toLocaleString()}만` : '-'}</span>
            </div>
            {periodSummary.totalExpectedSales > 0 && (
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>달성율</span><span>{Math.round((periodSummary.totalActualSales / periodSummary.totalExpectedSales) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((periodSummary.totalActualSales / periodSummary.totalExpectedSales) * 100))}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ⑥ 차주 목표달성을 위한 To Do List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900 flex items-center gap-2"><Target className="h-4 w-4 text-yellow-500" />차주 목표달성을 위한 To Do List</CardTitle>
          <p className="text-[10px] text-gray-400 mt-0.5">다음주 ({nextWeekLabel}) 목표를 위해 이번 주에 해야 할 일</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">주간 목표</p>
            <div className="space-y-1.5">
              {goals.weekly.map((g) => (
                <div key={g.id} className="flex items-center gap-2 group">
                  <button onClick={() => toggleWeekly(g.id)} className="shrink-0">{g.done ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-gray-300" />}</button>
                  <span className={`text-sm flex-1 ${g.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{g.text}</span>
                  <button onClick={() => removeWeekly(g.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input value={newWeeklyGoal} onChange={(e) => setNewWeeklyGoal(e.target.value)} placeholder="주간 목표 입력..." className="text-sm bg-white"
                onKeyDown={(e) => { if (e.key === 'Enter' && newWeeklyGoal.trim()) { addWeekly(newWeeklyGoal.trim()); setNewWeeklyGoal('') } }} />
              <Button variant="outline" size="sm" className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
                disabled={!newWeeklyGoal.trim()} onClick={() => { addWeekly(newWeeklyGoal.trim()); setNewWeeklyGoal('') }}><Plus className="h-4 w-4" /></Button>
            </div>
            {goals.weekly.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.round((goals.weekly.filter((g) => g.done).length / goals.weekly.length) * 100)}%` }} />
                </div>
                <span className="text-xs text-gray-500 shrink-0">{goals.weekly.filter((g) => g.done).length}/{goals.weekly.length}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">일일 목표</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {DAY_KEYS.map((dk, i) => {
                const dayDate = addDays(goalWeekStart, i)
                const isToday = format(dayDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
                const dayItems = goals.daily[dk] ?? []
                const doneCount = dayItems.filter((g) => g.done).length
                return (
                  <div key={dk} className={`rounded-lg border p-2 ${isToday ? 'border-yellow-400 bg-yellow-50/50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold ${isToday ? 'text-yellow-700' : 'text-gray-600'}`}>{DAY_LABELS[i]} ({format(dayDate, 'M/d')}){isToday && <span className="ml-1 text-yellow-500">TODAY</span>}</span>
                      {dayItems.length > 0 && <span className="text-[9px] text-gray-400">{doneCount}/{dayItems.length}</span>}
                    </div>
                    <div className="space-y-1">
                      {dayItems.map((g) => (
                        <div key={g.id} className="flex items-center gap-1 group">
                          <button onClick={() => toggleDaily(dk, g.id)} className="shrink-0">{g.done ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5 text-gray-300" />}</button>
                          <span className={`text-[10px] flex-1 ${g.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{g.text}</span>
                          <button onClick={() => removeDaily(dk, g.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="h-2.5 w-2.5 text-red-400" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Input value={newDailyGoals[dk] ?? ''} onChange={(e) => setNewDailyGoals({ ...newDailyGoals, [dk]: e.target.value })}
                        placeholder="추가..." className="text-[10px] h-6 bg-white"
                        onKeyDown={(e) => { if (e.key === 'Enter' && (newDailyGoals[dk] ?? '').trim()) { addDaily(dk, newDailyGoals[dk].trim()); setNewDailyGoals({ ...newDailyGoals, [dk]: '' }) } }} />
                      <Button variant="outline" size="sm" className="shrink-0 h-6 w-6 p-0 bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
                        disabled={!(newDailyGoals[dk] ?? '').trim()} onClick={() => { addDaily(dk, newDailyGoals[dk].trim()); setNewDailyGoals({ ...newDailyGoals, [dk]: '' }) }}><Plus className="h-2.5 w-2.5" /></Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <Card className="bg-white">
      <CardContent className="pt-3 pb-3 px-3 text-center">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">{label}</p>
        <p className={`text-xl font-black mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${color}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}
