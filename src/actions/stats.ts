'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/server'

export interface StatsData {
  newSales: number
  renewSales: number
  totalSales: number
  weeklyData: { week: number; newSales: number; renewSales: number; expectedSales: number; actualSales: number; assignedCount: number; otSessionCount: number; ptConversionCount: number }[]
  otStatus: { total: number; inProgress: number; notStarted: number; scheduleUndecided: number; noContact: number; closingFailed: number; session1Done: number; session2Done: number; session3Done: number; salesTargets: number; ptConversions: number; closingRate: number }
  salesSummary: { 진행인원: number; 등록인원: number; 클로징율: number; 객단가: number }
  routeSales: { route: string; 등록매출: number; 진행인원: number; 등록인원: number; 클로징율: number; 객단가: number }[]
  trainerStats: { name: string; newSales: number; renewSales: number; totalSales: number; 등록인원: number; 클로징율: number; 배정인원: number; 플로팅: number; 총인원: number; PT전환자: number }[]
  dailyData: { day: string; count: number; sales: number }[]
  ageData: { ageGroup: string; count: number; percentage: number }[]
}

export async function getStats(period: 'weekly' | 'monthly' = 'monthly', offset: number = 0): Promise<StatsData> {
  if (isDemoMode()) return getDemoStats()

  const supabase = await createClient()

  // 기간 계산
  const now = new Date()
  let periodStart: Date
  let periodEnd: Date
  if (period === 'weekly') {
    const dayOfWeek = now.getDay()
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    thisMonday.setHours(0, 0, 0, 0)
    const targetMonday = new Date(thisMonday)
    targetMonday.setDate(thisMonday.getDate() + offset * 7)
    const targetSunday = new Date(targetMonday)
    targetSunday.setDate(targetMonday.getDate() + 6)
    targetSunday.setHours(23, 59, 59, 999)
    periodStart = targetMonday
    periodEnd = targetSunday
  } else {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    periodStart = targetMonth
    periodEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  const { data: assignments } = await supabase
    .from('ot_assignments')
    .select(`
      id, status, created_at, week_number,
      actual_sales, expected_sales, sales_status, contact_status,
      is_sales_target, is_pt_conversion, pt_trainer_id, ppt_trainer_id,
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(name),
      sessions:ot_sessions(completed_at, scheduled_at)
    `)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .limit(1000)

  if (!assignments || assignments.length === 0) return emptyStats()

  // 단일 순회로 모든 집계 수행
  let newSales = 0
  let completedCount = 0
  let salesTargetCount = 0
  let ptCount = 0

  const otStatus = { total: 0, inProgress: 0, notStarted: 0, scheduleUndecided: 0, noContact: 0, closingFailed: 0, session1Done: 0, session2Done: 0, session3Done: 0, salesTargets: 0, ptConversions: 0, closingRate: 0 }
  const weeklyAcc = [1, 2, 3, 4].map(() => ({ newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0, assignedCount: 0, otSessionCount: 0, ptConversionCount: 0 }))
  const trainerMap = new Map<string, { assigned: number; floating: number; total: number; pt: number; reg: number; sales: number }>()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayCounts = dayNames.map(() => ({ count: 0, sales: 0 }))

  for (const a of assignments) {
    const isCompleted = a.status === '완료'
    const actualSales = a.actual_sales ?? 0
    const salesOrContact = a.sales_status ?? a.contact_status
    const hasSessions = (a.sessions as { completed_at: string | null }[])?.some((s) => s.completed_at)

    // 전체 매출
    if (isCompleted) { newSales += actualSales; completedCount++ }
    if (a.is_sales_target) salesTargetCount++
    if (a.is_pt_conversion) ptCount++

    // OT 상태
    otStatus.total++
    const doneCount = (a.sessions as { completed_at: string | null }[])?.filter((s) => s.completed_at).length ?? 0
    const hasAnySession = (a.sessions as { completed_at: string | null; scheduled_at?: string }[])?.length > 0
    if (hasAnySession) otStatus.inProgress++
    else otStatus.notStarted++
    if (salesOrContact === '스케줄미확정') otStatus.scheduleUndecided++
    if (salesOrContact === '연락두절') otStatus.noContact++
    if (salesOrContact === '클로징실패') otStatus.closingFailed++
    if (a.is_sales_target) otStatus.salesTargets++
    if (a.is_pt_conversion) otStatus.ptConversions++
    // 차수별 완료
    if (doneCount === 1) otStatus.session1Done++
    else if (doneCount === 2) otStatus.session2Done++
    else if (doneCount >= 3) otStatus.session3Done++

    // 주차별
    const week = (a.week_number ?? autoWeek(a.created_at)) - 1
    if (week >= 0 && week < 4) {
      const w = weeklyAcc[week]
      w.assignedCount++
      w.expectedSales += a.expected_sales ?? 0
      if (isCompleted) { w.newSales += actualSales; w.actualSales += actualSales }
      if (hasSessions) w.otSessionCount++
      if (a.is_pt_conversion) w.ptConversionCount++
    }

    // 트레이너별 (PT 우선, 없으면 PPT → 폴더 기준)
    const tName = (a.pt_trainer as unknown as { name: string } | null)?.name
      ?? (a as unknown as { ppt_trainer?: { name: string } | null }).ppt_trainer?.name
      ?? '미배정'
    const e = trainerMap.get(tName) ?? { assigned: 0, floating: 0, total: 0, pt: 0, reg: 0, sales: 0 }
    e.total++
    if (a.pt_trainer_id) e.assigned++; else e.floating++
    if (a.is_pt_conversion) e.pt++
    if (isCompleted) { e.reg++; e.sales += actualSales }
    trainerMap.set(tName, e)

    // 요일별
    const dayIdx = new Date(a.created_at).getDay()
    dayCounts[dayIdx].count++
    if (isCompleted) dayCounts[dayIdx].sales += actualSales
  }

  // 클로징율: 진행회원 대비 PT전환
  otStatus.closingRate = otStatus.inProgress > 0 ? Math.round((otStatus.ptConversions / otStatus.inProgress) * 100) : 0
  const activeTotal = assignments.filter((a) => a.status !== '거부').length

  return {
    newSales, renewSales: 0, totalSales: newSales,
    weeklyData: weeklyAcc.map((w, i) => ({ week: i + 1, ...w })),
    otStatus,
    salesSummary: { 진행인원: salesTargetCount, 등록인원: ptCount, 클로징율: activeTotal > 0 ? Math.round((completedCount / activeTotal) * 100) : 0, 객단가: completedCount > 0 ? Math.round(newSales / completedCount) : 0 },
    routeSales: [],
    trainerStats: Array.from(trainerMap.entries()).map(([name, v]) => ({
      name, newSales: v.sales, renewSales: 0, totalSales: v.sales,
      등록인원: v.reg, 클로징율: v.total > 0 ? Math.round((v.reg / v.total) * 100) : 0,
      배정인원: v.assigned, 플로팅: v.floating, 총인원: v.total, PT전환자: v.pt,
    })),
    dailyData: dayNames.map((day, i) => ({ day, ...dayCounts[i] })),
    ageData: [],
  }
}

function autoWeek(c: string): number { const d = new Date(c).getDate(); if (d <= 7) return 1; if (d <= 14) return 2; if (d <= 21) return 3; return 4 }

function emptyStats(): StatsData {
  return {
    newSales: 0, renewSales: 0, totalSales: 0,
    weeklyData: [1,2,3,4].map(w => ({ week: w, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0, assignedCount: 0, otSessionCount: 0, ptConversionCount: 0 })),
    otStatus: { total: 0, inProgress: 0, notStarted: 0, scheduleUndecided: 0, noContact: 0, closingFailed: 0, session1Done: 0, session2Done: 0, session3Done: 0, salesTargets: 0, ptConversions: 0, closingRate: 0 },
    salesSummary: { 진행인원: 0, 등록인원: 0, 클로징율: 0, 객단가: 0 },
    routeSales: [], trainerStats: [],
    dailyData: ['일','월','화','수','목','금','토'].map(d => ({ day: d, count: 0, sales: 0 })),
    ageData: [],
  }
}

function getDemoStats(): StatsData {
  const a = DEMO_OT_ASSIGNMENTS
  return {
    newSales: 3300000, renewSales: 0, totalSales: 3300000,
    weeklyData: [
      { week: 1, newSales: 3300000, renewSales: 0, expectedSales: 7520000, actualSales: 3300000, assignedCount: 6, otSessionCount: 3, ptConversionCount: 1 },
      { week: 2, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0, assignedCount: 0, otSessionCount: 0, ptConversionCount: 0 },
      { week: 3, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0, assignedCount: 0, otSessionCount: 0, ptConversionCount: 0 },
      { week: 4, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0, assignedCount: 0, otSessionCount: 0, ptConversionCount: 0 },
    ],
    otStatus: { total: a.length, inProgress: a.filter(x => x.status === '진행중').length, notStarted: 0, scheduleUndecided: 0, noContact: 0, closingFailed: 0, session1Done: 0, session2Done: 0, session3Done: 0, salesTargets: 0, ptConversions: 0, closingRate: 0 },
    salesSummary: { 진행인원: a.length, 등록인원: 1, 클로징율: 12, 객단가: 3300000 },
    routeSales: [],
    trainerStats: [{ name: '박트레이너', newSales: 3300000, renewSales: 0, totalSales: 3300000, 등록인원: 1, 클로징율: 33, 배정인원: 4, 플로팅: 2, 총인원: 6, PT전환자: 1 }],
    dailyData: [
      { day: '일', count: 0, sales: 0 }, { day: '월', count: 2, sales: 1650000 },
      { day: '화', count: 1, sales: 0 }, { day: '수', count: 2, sales: 1650000 },
      { day: '목', count: 1, sales: 0 }, { day: '금', count: 2, sales: 0 },
      { day: '토', count: 0, sales: 0 },
    ],
    ageData: [],
  }
}
