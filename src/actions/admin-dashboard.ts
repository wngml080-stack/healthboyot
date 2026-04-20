'use server'

import { createClient } from '@/lib/supabase/server'

export interface TrainerSummary {
  id: string
  name: string
  totalMembers: number      // 총 배정 회원
  activeMembers: number     // 진행중 (배정완료+진행중)
  completedMembers: number  // 완료
  rejectedMembers: number   // 거부
  otSessionsTotal: number   // 총 OT 수업 수
  otSessionsThisPeriod: number // 기간 내 OT 수업 수
  salesTargets: number      // 매출대상자
  ptConversions: number     // PT전환
  closingRate: number       // 클로징율 (%)
  registrationCredits: number      // 승인된 OT이외 인정건수
  pendingCredits: number           // 대기 인정건수
  registrationAmount: number       // 승인된 등록 금액 (원)
  inbodyCount: number       // 인바디 측정 건수
  noContact: number         // 연락두절
  closingFailed: number     // 클로징실패
  scheduleUndecided: number // 스케줄미확정
}

export interface AdminDashboardData {
  trainers: TrainerSummary[]
  totals: {
    totalMembers: number
    activeMembers: number
    completedMembers: number
    rejectedMembers: number
    otSessionsTotal: number
    otSessionsThisPeriod: number
    salesTargets: number
    ptConversions: number
    closingRate: number
    registrationCredits: number
    pendingCredits: number
    registrationAmount: number
    inbodyCount: number
    session1Done: number  // 1차 완료
    session2Done: number  // 2차 완료
    session3Done: number  // 3차 이상 완료
    noContact: number
    closingFailed: number
    scheduleUndecided: number
  }
  periodLabel: string
}

// offset: 0 = 현재, -1 = 이전, 1 = 다음
export async function getAdminDashboard(period: 'weekly' | 'monthly' = 'monthly', offset: number = 0): Promise<AdminDashboardData> {
  const supabase = await createClient()

  const now = new Date()
  let periodStart: Date
  let periodEnd: Date
  let periodLabel: string

  if (period === 'weekly') {
    const dayOfWeek = now.getDay()
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    thisMonday.setHours(0, 0, 0, 0)
    // offset 적용
    const targetMonday = new Date(thisMonday)
    targetMonday.setDate(thisMonday.getDate() + offset * 7)
    const targetSunday = new Date(targetMonday)
    targetSunday.setDate(targetMonday.getDate() + 6)
    targetSunday.setHours(23, 59, 59, 999)
    periodStart = targetMonday
    periodEnd = targetSunday
    const label = offset === 0 ? '금주' : offset === -1 ? '지난주' : offset === 1 ? '다음주' : `${offset > 0 ? '+' : ''}${offset}주`
    periodLabel = `${targetMonday.getMonth() + 1}/${targetMonday.getDate()} ~ ${targetSunday.getMonth() + 1}/${targetSunday.getDate()} (${label})`
  } else {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    periodStart = targetMonth
    periodEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999)
    periodLabel = `${targetMonth.getFullYear()}년 ${targetMonth.getMonth() + 1}월`
  }

  const periodStartIso = periodStart.toISOString()
  const periodEndIso = periodEnd.toISOString()

  // 병렬 조회
  const [assignRes, sessionRes, regRes, trainerRes, programRes] = await Promise.all([
    supabase.from('ot_assignments').select(`
      id, status, sales_status, is_sales_target, is_pt_conversion,
      pt_trainer_id, ppt_trainer_id, created_at,
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name)
    `).limit(1000),
    supabase.from('ot_sessions').select('id, ot_assignment_id, completed_at').not('completed_at', 'is', null),
    supabase.from('ot_registrations').select('id, trainer_id, ot_credit, registration_amount, approval_status, submitted_at'),
    supabase.from('profiles').select('id, name, role').order('name'),
    supabase.from('ot_programs').select('ot_assignment_id, sessions').limit(1000),
  ])

  const assignments = assignRes.data ?? []
  const sessions = sessionRes.data ?? []
  const registrations = regRes.data ?? []
  const allTrainers = trainerRes.data ?? []
  const programs = programRes.data ?? []

  // assignment → 폴더 트레이너 매핑 (PT 우선, 없으면 PPT)
  const assignmentTrainerMap = new Map<string, string>()
  for (const a of assignments) {
    const folderId = a.pt_trainer_id || a.ppt_trainer_id
    if (folderId) assignmentTrainerMap.set(a.id, folderId)
  }

  // 세션 카운트 맵
  const sessionCountByAssignment = new Map<string, number>()
  const periodSessionCountByAssignment = new Map<string, number>()
  for (const s of sessions) {
    sessionCountByAssignment.set(s.ot_assignment_id, (sessionCountByAssignment.get(s.ot_assignment_id) ?? 0) + 1)
    if (s.completed_at && s.completed_at >= periodStartIso && s.completed_at <= periodEndIso) {
      periodSessionCountByAssignment.set(s.ot_assignment_id, (periodSessionCountByAssignment.get(s.ot_assignment_id) ?? 0) + 1)
    }
  }

  // 인바디 카운트 — ot_programs의 sessions JSONB에서 inbody: true인 세션 수를 assignment → trainer로 매핑
  // 기간 필터: 세션의 date 필드가 기간 내인 것만 카운트
  const periodStartDate = periodStart.toISOString().split('T')[0] // YYYY-MM-DD
  const inbodyByTrainer = new Map<string, number>()
  for (const p of programs) {
    const folderId = assignmentTrainerMap.get(p.ot_assignment_id)
    if (!folderId) continue
    const pSessions = p.sessions as { inbody?: boolean; date?: string }[] | null
    if (!pSessions) continue
    const periodEndDate = periodEnd.toISOString().split('T')[0]
    const count = pSessions.filter((s) => s.inbody && s.date && s.date >= periodStartDate && s.date <= periodEndDate).length
    if (count > 0) inbodyByTrainer.set(folderId, (inbodyByTrainer.get(folderId) ?? 0) + count)
  }

  // 인정건수 맵 — trainer_id(폴더 주인) 기준, 기간 필터 적용
  const regByTrainer = new Map<string, { approved: number; pending: number; amount: number }>()
  for (const r of registrations) {
    // 기간 필터: 제출일이 기간 내인 것만 카운트
    if (r.submitted_at && (r.submitted_at < periodStartIso || r.submitted_at > periodEndIso)) continue
    const e = regByTrainer.get(r.trainer_id) ?? { approved: 0, pending: 0, amount: 0 }
    if (r.approval_status === '승인') {
      e.approved += r.ot_credit
      e.amount += r.registration_amount
    } else if (r.approval_status === '제출완료') {
      e.pending += r.ot_credit
    }
    regByTrainer.set(r.trainer_id, e)
  }

  // 트레이너별 집계
  const trainerMap = new Map<string, TrainerSummary>()
  for (const t of allTrainers) {
    const reg = regByTrainer.get(t.id) ?? { approved: 0, pending: 0, amount: 0 }
    trainerMap.set(t.id, {
      id: t.id,
      name: t.name,
      totalMembers: 0,
      activeMembers: 0,
      completedMembers: 0,
      rejectedMembers: 0,
      otSessionsTotal: 0,
      otSessionsThisPeriod: 0,
      salesTargets: 0,
      ptConversions: 0,
      closingRate: 0,
      registrationCredits: reg.approved,
      pendingCredits: reg.pending,
      registrationAmount: reg.amount,
      inbodyCount: inbodyByTrainer.get(t.id) ?? 0,
      noContact: 0,
      closingFailed: 0,
      scheduleUndecided: 0,
    })
  }

  for (const a of assignments) {
    // 폴더 기준: PT 트레이너 우선, 없으면 PPT 트레이너
    const folderId = a.pt_trainer_id || a.ppt_trainer_id
    if (!folderId) continue
    const t = trainerMap.get(folderId)
    if (!t) continue

    t.totalMembers++
    if (a.status === '진행중' || a.status === '배정완료') t.activeMembers++
    if (a.status === '완료') t.completedMembers++
    if (a.status === '거부') t.rejectedMembers++
    if (a.is_sales_target) t.salesTargets++
    if (a.is_pt_conversion) t.ptConversions++
    if (a.sales_status === '연락두절') t.noContact++
    if (a.sales_status === '클로징실패') t.closingFailed++
    if (a.sales_status === '스케줄미확정') t.scheduleUndecided++

    t.otSessionsTotal += sessionCountByAssignment.get(a.id) ?? 0
    t.otSessionsThisPeriod += periodSessionCountByAssignment.get(a.id) ?? 0
  }

  // 클로징율 계산
  for (const t of Array.from(trainerMap.values())) {
    t.closingRate = t.totalMembers > 0 ? Math.round((t.completedMembers / t.totalMembers) * 100) : 0
  }

  // 1차/2차/3차 완료 카운트 (assignment별 완료 세션 수 기준)
  let session1Done = 0, session2Done = 0, session3Done = 0
  let totalNoContact = 0, totalClosingFailed = 0, totalScheduleUndecided = 0
  for (const a of assignments) {
    const completedCount = sessionCountByAssignment.get(a.id) ?? 0
    if (completedCount === 1) session1Done++
    else if (completedCount === 2) session2Done++
    else if (completedCount >= 3) session3Done++
    if (a.sales_status === '연락두절') totalNoContact++
    if (a.sales_status === '클로징실패') totalClosingFailed++
    if (a.sales_status === '스케줄미확정') totalScheduleUndecided++
  }

  const trainers = Array.from(trainerMap.values())
    .filter((t) => t.totalMembers > 0 || t.registrationCredits > 0 || t.pendingCredits > 0)
    .sort((a, b) => b.totalMembers - a.totalMembers)

  const totals = {
    totalMembers: trainers.reduce((s, t) => s + t.totalMembers, 0),
    activeMembers: trainers.reduce((s, t) => s + t.activeMembers, 0),
    completedMembers: trainers.reduce((s, t) => s + t.completedMembers, 0),
    rejectedMembers: trainers.reduce((s, t) => s + t.rejectedMembers, 0),
    otSessionsTotal: trainers.reduce((s, t) => s + t.otSessionsTotal, 0),
    otSessionsThisPeriod: trainers.reduce((s, t) => s + t.otSessionsThisPeriod, 0),
    salesTargets: trainers.reduce((s, t) => s + t.salesTargets, 0),
    ptConversions: trainers.reduce((s, t) => s + t.ptConversions, 0),
    closingRate: 0,
    registrationCredits: trainers.reduce((s, t) => s + t.registrationCredits, 0),
    pendingCredits: trainers.reduce((s, t) => s + t.pendingCredits, 0),
    registrationAmount: trainers.reduce((s, t) => s + t.registrationAmount, 0),
    inbodyCount: trainers.reduce((s, t) => s + t.inbodyCount, 0),
    session1Done,
    session2Done,
    session3Done,
    noContact: totalNoContact,
    closingFailed: totalClosingFailed,
    scheduleUndecided: totalScheduleUndecided,
  }
  totals.closingRate = totals.totalMembers > 0 ? Math.round((totals.completedMembers / totals.totalMembers) * 100) : 0

  return { trainers, totals, periodLabel }
}
