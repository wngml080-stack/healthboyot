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
    periodAssigned: number // 당월/당주 배정인원
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

  // 병렬 조회 — DB 레벨에서 기간 필터 적용 + nested select로 쿼리 통합
  const [assignRes, regRes, trainerRes] = await Promise.all([
    // assignments + sessions + programs를 nested select로 한 번에 조회 (기간 필터 적용)
    supabase.from('ot_assignments').select(`
      id, status, sales_status, is_sales_target, is_pt_conversion,
      pt_trainer_id, ppt_trainer_id, created_at,
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(id, completed_at),
      programs:ot_programs(sessions)
    `)
      .gte('created_at', periodStartIso)
      .lte('created_at', periodEndIso),
    // registrations — 기간 필터 적용
    supabase.from('ot_registrations').select('id, trainer_id, ot_credit, registration_amount, approval_status, submitted_at')
      .gte('submitted_at', periodStartIso)
      .lte('submitted_at', periodEndIso),
    supabase.from('profiles').select('id, name, role, folder_order').eq('has_folder', true).order('folder_order', { ascending: true, nullsFirst: false }),
  ])

  const assignments = assignRes.data ?? []
  const registrations = regRes.data ?? []
  const allTrainers = trainerRes.data ?? []

  // assignment → 폴더 트레이너 매핑 (PT 우선, 없으면 PPT)
  const assignmentTrainerMap = new Map<string, string>()
  for (const a of assignments) {
    const folderId = a.pt_trainer_id || a.ppt_trainer_id
    if (folderId) assignmentTrainerMap.set(a.id, folderId)
  }

  // 세션 카운트 맵 — nested select에서 직접 계산
  const sessionCountByAssignment = new Map<string, number>()
  const periodSessionCountByAssignment = new Map<string, number>()
  for (const a of assignments) {
    const sessions = a.sessions as { id: string; completed_at: string | null }[] | null
    if (!sessions) continue
    const completedSessions = sessions.filter((s) => s.completed_at)
    sessionCountByAssignment.set(a.id, completedSessions.length)
    const periodSessions = completedSessions.filter((s) => s.completed_at! >= periodStartIso && s.completed_at! <= periodEndIso)
    periodSessionCountByAssignment.set(a.id, periodSessions.length)
  }

  // 인바디 카운트 — nested programs에서 직접 계산
  const periodStartDate = periodStart.toISOString().split('T')[0] // YYYY-MM-DD
  const periodEndDate = periodEnd.toISOString().split('T')[0]
  const inbodyByTrainer = new Map<string, number>()
  for (const a of assignments) {
    const folderId = a.pt_trainer_id || a.ppt_trainer_id
    if (!folderId) continue
    const programs = a.programs as { sessions: { inbody?: boolean; date?: string }[] | null }[] | null
    if (!programs) continue
    for (const p of programs) {
      const pSessions = p.sessions
      if (!pSessions) continue
      const count = pSessions.filter((s) => s.inbody && s.date && s.date >= periodStartDate && s.date <= periodEndDate).length
      if (count > 0) inbodyByTrainer.set(folderId, (inbodyByTrainer.get(folderId) ?? 0) + count)
    }
  }

  // 인정건수 맵 — trainer_id(폴더 주인) 기준 (이미 DB에서 기간 필터 적용됨)
  const regByTrainer = new Map<string, { approved: number; pending: number; amount: number }>()
  for (const r of registrations) {
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

  // ★ DB에서 이미 기간 필터 적용됨 — 추가 필터 불필요
  for (const a of assignments) {
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
    t.closingRate = t.activeMembers > 0 ? Math.round((t.ptConversions / t.activeMembers) * 100) : 0
  }

  // 기간 내 세션 완료 카운트 — 폴더 있는 트레이너의 배정만
  const folderTrainerIds = new Set(allTrainers.map(t => t.id))
  let session1Done = 0, session2Done = 0, session3Done = 0
  let totalNoContact = 0, totalClosingFailed = 0, totalScheduleUndecided = 0
  let periodAssignedCount = 0
  for (const a of assignments) {
    const folderId = a.pt_trainer_id || a.ppt_trainer_id
    if (!folderId || !folderTrainerIds.has(folderId)) continue
    periodAssignedCount++
    const periodDone = periodSessionCountByAssignment.get(a.id) ?? 0
    if (periodDone === 1) session1Done++
    else if (periodDone === 2) session2Done++
    else if (periodDone >= 3) session3Done++
    if (a.sales_status === '연락두절') totalNoContact++
    if (a.sales_status === '클로징실패') totalClosingFailed++
    if (a.sales_status === '스케줄미확정') totalScheduleUndecided++
  }
  const periodAssigned = periodAssignedCount

  // folder_order 매핑
  const orderMap = new Map<string, number>()
  for (const t of allTrainers) {
    orderMap.set(t.id, (t as unknown as { folder_order?: number }).folder_order ?? 999)
  }

  // 트레이너 폴더가 있는 역할만 표시 (admin, fc 제외하지 않음 - 폴더 있으면 모두 표시)
  const trainers = Array.from(trainerMap.values())
    .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))

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
    periodAssigned,
    session1Done,
    session2Done,
    session3Done,
    noContact: totalNoContact,
    closingFailed: totalClosingFailed,
    scheduleUndecided: totalScheduleUndecided,
  }
  totals.closingRate = totals.activeMembers > 0 ? Math.round((totals.ptConversions / totals.activeMembers) * 100) : 0

  return { trainers, totals, periodLabel }
}
