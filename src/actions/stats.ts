'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'

export interface StatsData {
  newSales: number
  renewSales: number
  totalSales: number
  weeklyData: { week: number; newSales: number; renewSales: number; expectedSales: number; actualSales: number }[]
  otStatus: { inProgress: number; rejected: number; registered: number; scheduleUndecided: number; noContact: number; closingFailed: number }
  salesSummary: { 진행인원: number; 등록인원: number; 클로징율: number; 객단가: number }
  routeSales: { route: string; 등록매출: number; 진행인원: number; 등록인원: number; 클로징율: number; 객단가: number }[]
  trainerStats: { name: string; newSales: number; renewSales: number; totalSales: number; 등록인원: number; 클로징율: number }[]
}

export async function getStats(): Promise<StatsData> {
  if (isDemoMode()) return getDemoStats()

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: assignments } = await supabase
    .from('ot_assignments')
    .select(`*, member:members!inner(name, ot_category), pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name)`)

  if (!assignments || assignments.length === 0) return emptyStats()

  const completed = assignments.filter((a) => a.status === '완료')
  const newSales = completed.reduce((s, a) => s + (a.actual_sales ?? 0), 0)

  const weeklyData = [1, 2, 3, 4].map((week) => {
    const wa = assignments.filter((a) => (a.week_number ?? autoWeek(a.created_at)) === week)
    const wc = wa.filter((a) => a.status === '완료')
    return { week, newSales: wc.reduce((s, a) => s + (a.actual_sales ?? 0), 0), renewSales: 0, expectedSales: wa.reduce((s, a) => s + (a.expected_sales ?? 0), 0), actualSales: wc.reduce((s, a) => s + (a.actual_sales ?? 0), 0) }
  })

  const otStatus = {
    inProgress: assignments.filter((a) => ['진행중', '배정완료'].includes(a.status)).length,
    rejected: assignments.filter((a) => a.status === '거부').length,
    registered: completed.length,
    scheduleUndecided: assignments.filter((a) => a.contact_status === '스케줄미확정').length,
    noContact: assignments.filter((a) => a.contact_status === '연락두절').length,
    closingFailed: assignments.filter((a) => a.contact_status === '클로싱실패').length,
  }

  const tc = assignments.length
  const rc = completed.length
  const routeMap = new Map<string, { sales: number; p: number; r: number }>()
  for (const a of assignments) {
    const route = a.registration_route ?? '기타'
    const e = routeMap.get(route) ?? { sales: 0, p: 0, r: 0 }
    e.p++
    if (a.status === '완료') { e.r++; e.sales += a.actual_sales ?? 0 }
    routeMap.set(route, e)
  }

  const trainerMap = new Map<string, { n: number; t: number; r: number; c: number }>()
  for (const a of assignments) {
    const name = (a.pt_trainer as { name: string } | null)?.name ?? '미배정'
    const e = trainerMap.get(name) ?? { n: 0, t: 0, r: 0, c: 0 }
    e.c++
    if (a.status === '완료') { e.n += a.actual_sales ?? 0; e.t += a.actual_sales ?? 0; e.r++ }
    trainerMap.set(name, e)
  }

  return {
    newSales, renewSales: 0, totalSales: newSales, weeklyData, otStatus,
    salesSummary: { 진행인원: tc, 등록인원: rc, 클로징율: tc > 0 ? Math.round((rc / tc) * 100) : 0, 객단가: rc > 0 ? Math.round(newSales / rc) : 0 },
    routeSales: Array.from(routeMap.entries()).map(([route, v]) => ({ route, 등록매출: v.sales, 진행인원: v.p, 등록인원: v.r, 클로징율: v.p > 0 ? Math.round((v.r / v.p) * 100) : 0, 객단가: v.r > 0 ? Math.round(v.sales / v.r) : 0 })),
    trainerStats: Array.from(trainerMap.entries()).map(([name, v]) => ({ name, newSales: v.n, renewSales: 0, totalSales: v.t, 등록인원: v.r, 클로징율: v.c > 0 ? Math.round((v.r / v.c) * 100) : 0 })),
  }
}

function autoWeek(c: string): number { const d = new Date(c).getDate(); if (d <= 7) return 1; if (d <= 14) return 2; if (d <= 21) return 3; return 4 }

function emptyStats(): StatsData {
  return { newSales: 0, renewSales: 0, totalSales: 0, weeklyData: [1,2,3,4].map(w => ({ week: w, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0 })), otStatus: { inProgress: 0, rejected: 0, registered: 0, scheduleUndecided: 0, noContact: 0, closingFailed: 0 }, salesSummary: { 진행인원: 0, 등록인원: 0, 클로징율: 0, 객단가: 0 }, routeSales: [], trainerStats: [] }
}

function getDemoStats(): StatsData {
  const a = DEMO_OT_ASSIGNMENTS
  return {
    newSales: 3300000, renewSales: 3300000, totalSales: 6600000,
    weeklyData: [
      { week: 1, newSales: 5610000, renewSales: 2310000, expectedSales: 7520000, actualSales: 6600000 },
      { week: 2, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0 },
      { week: 3, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0 },
      { week: 4, newSales: 0, renewSales: 0, expectedSales: 0, actualSales: 0 },
    ],
    otStatus: { inProgress: a.filter(x => x.status === '진행중').length, rejected: a.filter(x => x.status === '거부').length, registered: a.filter(x => x.status === '완료').length, scheduleUndecided: 0, noContact: 0, closingFailed: 0 },
    salesSummary: { 진행인원: a.length, 등록인원: 1, 클로징율: 12, 객단가: 3300000 },
    routeSales: [
      { route: 'SPT', 등록매출: 0, 진행인원: 0, 등록인원: 0, 클로징율: 0, 객단가: 0 },
      { route: 'TM', 등록매출: 0, 진행인원: 1, 등록인원: 0, 클로징율: 0, 객단가: 0 },
      { route: '배정', 등록매출: 3300000, 진행인원: 1, 등록인원: 1, 클로징율: 100, 객단가: 3300000 },
      { route: '지인소개', 등록매출: 0, 진행인원: 0, 등록인원: 0, 클로징율: 0, 객단가: 0 },
    ],
    trainerStats: [{ name: '박트레이너', newSales: 3300000, renewSales: 3300000, totalSales: 6600000, 등록인원: 1, 클로징율: 33 }],
  }
}
