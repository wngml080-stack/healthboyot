'use server'

import { createClient } from '@/lib/supabase/server'

export interface PtMember {
  id: string
  trainer_id: string
  name: string
  phone: string | null
  total_sessions: number
  completed_sessions: number
  monthly_sessions: number
  status: string
  start_date: string | null
  valid_until: string | null
  notes: string | null
  data_month: string | null  // 데이터 귀속 월 'YYYY-MM'
  created_at: string
  updated_at: string
  trainer_name?: string
  // 페이롤 양식 필드
  previous_remaining: number
  category: string | null
  registration_amount: number
  sessions_added: number
  sessions_in: number
  sessions_out: number
  sessions_group_purchase: number  // 공구 (공동구매)
  sessions_bachal: number          // 바챌
  handover_to: string | null
  handover_sessions: number
  special_sales: number
  refund_amount: number
  refund_sessions: number
}

export type PtMemberInput = {
  trainer_id: string
  name: string
  status?: string
  notes?: string | null
  data_month?: string | null  // 'YYYY-MM' — 미지정 시 현재 월
  previous_remaining?: number
  category?: string | null
  registration_amount?: number
  sessions_added?: number
  sessions_in?: number
  sessions_out?: number
  sessions_group_purchase?: number
  sessions_bachal?: number
  handover_to?: string | null
  handover_sessions?: number
  special_sales?: number
  refund_amount?: number
  refund_sessions?: number
}

export type PtSessionCategory = 'IN' | 'OUT' | 'GROUP_PURCHASE' | 'BACHAL'

// KST 기준 현재 월 'YYYY-MM'
function currentDataMonth(): string {
  const now = new Date()
  const kstOffset = 9 * 60 // 분
  const kst = new Date(now.getTime() + (kstOffset - now.getTimezoneOffset()) * 60 * 1000)
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}`
}

// total/completed/monthly_sessions는 페이롤 필드에서 자동 파생되므로 한 곳에서만 계산.
// weekly-calendar 등 다른 컴포넌트가 total_sessions/completed_sessions를 읽기 때문에 컬럼은 유지.
function buildRow(values: PtMemberInput) {
  const previous_remaining = values.previous_remaining ?? 0
  const sessions_added = values.sessions_added ?? 0
  const sessions_in = values.sessions_in ?? 0
  const sessions_out = values.sessions_out ?? 0
  const sessions_group_purchase = values.sessions_group_purchase ?? 0
  const sessions_bachal = values.sessions_bachal ?? 0
  const handover_sessions = values.handover_sessions ?? 0
  const refund_sessions = values.refund_sessions ?? 0
  // 진행 세션 = IN + OUT + 공구 + 바챌
  const completed_sessions = sessions_in + sessions_out + sessions_group_purchase + sessions_bachal

  return {
    trainer_id: values.trainer_id,
    name: values.name.trim(),
    status: values.status || '진행중',
    notes: values.notes || null,
    data_month: values.data_month ?? currentDataMonth(),
    previous_remaining,
    category: values.category || null,
    registration_amount: values.registration_amount ?? 0,
    sessions_added,
    sessions_in,
    sessions_out,
    sessions_group_purchase,
    sessions_bachal,
    handover_to: values.handover_to || null,
    handover_sessions,
    special_sales: values.special_sales ?? 0,
    refund_amount: values.refund_amount ?? 0,
    refund_sessions,
    total_sessions: previous_remaining + sessions_added + handover_sessions + refund_sessions,
    completed_sessions,
    monthly_sessions: completed_sessions,
  }
}

export async function getPtMembers(trainerId?: string, dataMonth?: string): Promise<PtMember[]> {
  const supabase = await createClient()
  let query = supabase
    .from('pt_members')
    .select('*, profiles!pt_members_trainer_id_fkey(name)')
    .order('status', { ascending: true })
    .order('name', { ascending: true })

  if (trainerId) query = query.eq('trainer_id', trainerId)
  if (dataMonth) query = query.eq('data_month', dataMonth)

  const { data, error } = await query
  if (error) { console.error('getPtMembers error:', error.message); return [] }

  return (data ?? []).map((d: Record<string, unknown>) => {
    const profile = d.profiles as { name: string } | null
    const { profiles: _, ...rest } = d
    return { ...rest, trainer_name: profile?.name ?? '' } as unknown as PtMember
  })
}

export async function createPtMember(values: PtMemberInput) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pt_members')
    .insert(buildRow(values))
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

// 같은 트레이너 + 같은 이름 + 같은 월이 있으면 덮어쓰기, 없으면 신규 등록
// → 4월 데이터와 5월 데이터는 별도 row로 저장됨
export async function upsertPtMember(values: PtMemberInput) {
  const supabase = await createClient()
  const trimmedName = values.name.trim()
  const month = values.data_month ?? currentDataMonth()

  const { data: existing } = await supabase
    .from('pt_members')
    .select('id')
    .eq('trainer_id', values.trainer_id)
    .eq('name', trimmedName)
    .eq('data_month', month)
    .limit(1)
    .single()

  const row = { ...buildRow({ ...values, data_month: month }), updated_at: new Date().toISOString() }

  if (existing) {
    const { error } = await supabase.from('pt_members').update(row).eq('id', existing.id)
    if (error) return { error: error.message }
    return { data: { ...row, id: existing.id }, updated: true }
  }
  const { data, error } = await supabase.from('pt_members').insert(row).select().single()
  if (error) return { error: error.message }
  return { data, updated: false }
}

export async function updatePtMember(id: string, values: PtMemberInput) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pt_members')
    .update({ ...buildRow(values), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deletePtMember(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('pt_members').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deletePtMembers(ids: string[]) {
  const supabase = await createClient()
  const { error } = await supabase.from('pt_members').delete().in('id', ids)
  if (error) return { error: error.message }
  return { success: true }
}

// PT 스케줄 생성/삭제/이동 시 호출 — 해당 월 pt_members 4 카테고리 카운트 증감
// delta: +1 (스케줄 생성), -1 (스케줄 삭제)
// 매칭 row 없으면 누락 처리 — 회원 이름 반환
export async function adjustPtMemberSessions(
  trainerId: string, name: string, month: string,
  category: PtSessionCategory, delta: number,
) {
  if (!name.trim() || !month) return { skipped: true as const }
  const supabase = await createClient()
  const { data: row } = await supabase
    .from('pt_members')
    .select('id, sessions_in, sessions_out, sessions_group_purchase, sessions_bachal')
    .eq('trainer_id', trainerId)
    .eq('name', name.trim())
    .eq('data_month', month)
    .limit(1)
    .single()

  if (!row) return { skipped: true as const, missingName: name.trim() }

  let newIn = row.sessions_in
  let newOut = row.sessions_out
  let newGP = row.sessions_group_purchase ?? 0
  let newBachal = row.sessions_bachal ?? 0
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (category === 'IN') { newIn = Math.max(0, newIn + delta); updates.sessions_in = newIn }
  else if (category === 'OUT') { newOut = Math.max(0, newOut + delta); updates.sessions_out = newOut }
  else if (category === 'GROUP_PURCHASE') { newGP = Math.max(0, newGP + delta); updates.sessions_group_purchase = newGP }
  else if (category === 'BACHAL') { newBachal = Math.max(0, newBachal + delta); updates.sessions_bachal = newBachal }

  const completed = newIn + newOut + newGP + newBachal
  updates.completed_sessions = completed
  updates.monthly_sessions = completed

  const { error } = await supabase.from('pt_members').update(updates).eq('id', row.id)
  if (error) return { error: error.message }
  return { success: true as const }
}

// 당월(KST 기준 현재 월) PT/PPT/바챌 스케줄을 집계해서 pt_members 4 카테고리 카운트에 반영 (백업)
// 기존 sessions_in/out/gp/bachal 값을 덮어씀 — 스케줄을 source of truth로
// 매칭 row 없는 회원은 skippedNames에 담아 반환 → UI에서 누구인지 표시
export async function backfillCurrentMonthPtSessions(trainerId?: string) {
  const supabase = await createClient()
  const month = currentDataMonth() // 'YYYY-MM'
  const fromDate = `${month}-01`
  const [yyyy, mm] = month.split('-').map(Number)
  // 다음 달 1일 (exclusive)
  const next = new Date(yyyy, mm, 1)
  const toDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`

  let q = supabase
    .from('trainer_schedules')
    .select('trainer_id, schedule_type, member_name, scheduled_date, note')
    .in('schedule_type', ['PT', 'PPT', '바챌'])
    .gte('scheduled_date', fromDate)
    .lt('scheduled_date', toDate)
  if (trainerId) q = q.eq('trainer_id', trainerId)
  const { data: schedules, error: fetchErr } = await q
  if (fetchErr) return { error: fetchErr.message }
  if (!schedules || schedules.length === 0) {
    return { success: true as const, month, updated: 0, skippedNames: [] as string[] }
  }

  // (trainer_id, name) 별 카테고리 카운트 (모두 당월)
  type CategoryCount = { trainer_id: string; name: string; in: number; out: number; gp: number; bachal: number }
  const counts = new Map<string, CategoryCount>()
  for (const s of schedules) {
    if (!s.member_name?.trim()) continue
    const note = s.note ?? ''
    const key = `${s.trainer_id}|${s.member_name.trim()}`
    if (!counts.has(key)) counts.set(key, { trainer_id: s.trainer_id, name: s.member_name.trim(), in: 0, out: 0, gp: 0, bachal: 0 })
    const c = counts.get(key)!
    if (s.schedule_type === '바챌') c.bachal++
    else {
      const isGP = note.includes('[공동구매]')
      const isOut = note.startsWith('[OUT]') && !isGP
      if (isGP) c.gp++
      else if (isOut) c.out++
      else c.in++
    }
  }

  // 각 그룹별 pt_members 업데이트 (없으면 누락 회원명 수집)
  let updated = 0
  const skippedNames: string[] = []
  for (const c of Array.from(counts.values())) {
    const { data: row } = await supabase
      .from('pt_members')
      .select('id')
      .eq('trainer_id', c.trainer_id)
      .eq('name', c.name)
      .eq('data_month', month)
      .limit(1)
      .single()
    if (!row) { skippedNames.push(c.name); continue }
    const completed = c.in + c.out + c.gp + c.bachal
    const { error } = await supabase.from('pt_members').update({
      sessions_in: c.in,
      sessions_out: c.out,
      sessions_group_purchase: c.gp,
      sessions_bachal: c.bachal,
      completed_sessions: completed,
      monthly_sessions: completed,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    if (error) { skippedNames.push(`${c.name}(저장실패)`); continue }
    updated++
  }
  return { success: true as const, month, updated, skippedNames }
}

// 전월 페이롤을 당월(또는 지정 월)로 이월:
// - 전월 회원 각자의 "남은세션"(prev_remaining + sessions_added + handover + refund - 진행세션)을
//   당월 row의 previous_remaining으로 복사
// - 그 외 카운터(sessions_added/in/out/공구/바챌/handover/refund/registration_amount/special_sales)는 0으로 초기화
// - 구분(category)은 '기존'으로 셋팅
// - 이미 당월 row가 있으면 previous_remaining만 갱신 (사용자가 입력한 다른 값 보존)
export async function carryOverPreviousMonthPayroll(trainerId: string, targetMonth?: string) {
  const supabase = await createClient()
  const target = targetMonth || currentDataMonth()
  // 전월 계산 (YYYY-MM)
  const [yyyy, mm] = target.split('-').map(Number)
  const prevDate = new Date(yyyy, mm - 2, 1) // mm는 1-base, mm-1이 현재월의 0-base, mm-2가 전월
  const prev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  // 전월 회원 조회 (id 포함 — 만료 마킹 시 사용)
  const { data: prevMembers, error: prevErr } = await supabase
    .from('pt_members')
    .select('id, name, previous_remaining, sessions_added, sessions_in, sessions_out, sessions_group_purchase, sessions_bachal, handover_sessions, refund_sessions, status')
    .eq('trainer_id', trainerId)
    .eq('data_month', prev)
  if (prevErr) return { error: prevErr.message }
  if (!prevMembers || prevMembers.length === 0) {
    return { success: true as const, prev, target, created: 0, updated: 0 }
  }

  // 당월 기존 row 조회 (이름 매칭용)
  const { data: existingTarget } = await supabase
    .from('pt_members')
    .select('id, name')
    .eq('trainer_id', trainerId)
    .eq('data_month', target)
  const existingByName = new Map((existingTarget ?? []).map((r) => [r.name, r.id]))

  let created = 0, updated = 0, expired = 0, skipped = 0, removedFromTarget = 0
  const skippedEmptyName: Array<{ id: string }> = []
  const insertErrors: string[] = []
  for (const m of prevMembers) {
    // 이름이 비어있는 row는 carryover 대상에서 제외 (방어적)
    const memberName = (m.name ?? '').trim()
    if (!memberName) {
      skippedEmptyName.push({ id: m.id })
      skipped++
      continue
    }

    // 이미 전월에 만료/완료된 회원은 이월 대상 제외
    // → 당월에 row가 잘못 들어가 있다면 삭제 (5월에 4월 만료자가 보이지 않게)
    if (m.status === '만료' || m.status === '완료') {
      const stale = existingByName.get(memberName)
      if (stale) {
        await supabase.from('pt_members').delete().eq('id', stale)
        removedFromTarget++
      }
      skipped++
      continue
    }

    // 전월 남은세션 = previous_remaining + sessions_added + handover + refund - 진행
    const prevProgress = (m.sessions_in ?? 0) + (m.sessions_out ?? 0) + (m.sessions_group_purchase ?? 0) + (m.sessions_bachal ?? 0)
    const prevRemaining = (m.previous_remaining ?? 0) + (m.sessions_added ?? 0) + (m.handover_sessions ?? 0) + (m.refund_sessions ?? 0) - prevProgress

    // 남은세션 0 이하 → 전월 row를 '만료'로 마킹, 당월에 잘못 들어간 row 있으면 삭제
    if (prevRemaining <= 0) {
      await supabase
        .from('pt_members')
        .update({ status: '만료', updated_at: new Date().toISOString() })
        .eq('id', m.id)
      const stale = existingByName.get(memberName)
      if (stale) {
        await supabase.from('pt_members').delete().eq('id', stale)
        removedFromTarget++
      }
      expired++
      continue
    }

    const existingId = existingByName.get(memberName)
    if (existingId) {
      const { error } = await supabase
        .from('pt_members')
        .update({ previous_remaining: prevRemaining, status: '진행중', updated_at: new Date().toISOString() })
        .eq('id', existingId)
      if (!error) updated++
      else insertErrors.push(`${memberName}: ${error.message}`)
    } else {
      const row = buildRow({
        trainer_id: trainerId,
        name: memberName,
        status: '진행중',
        data_month: target,
        previous_remaining: prevRemaining,
        category: '전월기존',
      })
      const { error } = await supabase.from('pt_members').insert(row)
      if (!error) created++
      else insertErrors.push(`${memberName}: ${error.message}`)
    }
  }

  // 이름 비어있는 전월 row 정리 — 다음 carryover에서도 같은 garbage 안 만들도록 즉시 삭제
  if (skippedEmptyName.length > 0) {
    await supabase.from('pt_members').delete().in('id', skippedEmptyName.map((x) => x.id))
  }
  return {
    success: true as const,
    prev, target,
    created, updated, expired, skipped, removedFromTarget,
    cleanedEmptyName: skippedEmptyName.length,
    errors: insertErrors,
  }
}

// 5월 1일 이후 PT/PPT 스케줄을 집계해 각 PT 회원의 sessions_in/sessions_out에 반영.
// 바챌은 별도 카테고리(IN/OUT 무관)이므로 집계에서 제외.
export async function backfillPtSessionsFromMay(trainerId: string) {
  const supabase = await createClient()
  const year = new Date().getFullYear()
  const fromDate = `${year}-05-01`

  const { data: schedules, error: schedErr } = await supabase
    .from('trainer_schedules')
    .select('member_name, schedule_type, note')
    .eq('trainer_id', trainerId)
    .in('schedule_type', ['PT', 'PPT'])
    .gte('scheduled_date', fromDate)
  if (schedErr) return { error: schedErr.message }

  // 회원별 IN/OUT 카운트 집계 ([OUT] tag → OUT, 그 외 → IN)
  const counts = new Map<string, { in: number; out: number }>()
  for (const s of schedules ?? []) {
    const name = (s.member_name ?? '').trim()
    if (!name) continue
    const note = String(s.note ?? '')
    const isOut = note.startsWith('[OUT]')
    const cur = counts.get(name) ?? { in: 0, out: 0 }
    if (isOut) cur.out++; else cur.in++
    counts.set(name, cur)
  }

  // 같은 트레이너의 PT 회원 매칭 후 업데이트
  const { data: members, error: memErr } = await supabase
    .from('pt_members')
    .select('id, name')
    .eq('trainer_id', trainerId)
  if (memErr) return { error: memErr.message }

  let updated = 0, skipped = 0
  for (const [name, c] of Array.from(counts.entries())) {
    const target = (members ?? []).find((m) => m.name === name)
    if (!target) { skipped++; continue }
    const { error } = await supabase
      .from('pt_members')
      .update({
        sessions_in: c.in,
        sessions_out: c.out,
        completed_sessions: c.in + c.out,
        monthly_sessions: c.in + c.out,
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id)
    if (!error) updated++
  }
  return { updated, skipped }
}

// 빈 이름 row 일괄 삭제 (carryover 이전 garbage 정리용)
export async function cleanupEmptyNamePtMembers(trainerId?: string) {
  const supabase = await createClient()
  let q = supabase.from('pt_members').select('id, name').or('name.is.null,name.eq.')
  if (trainerId) q = q.eq('trainer_id', trainerId)
  const { data, error } = await q
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { success: true as const, deleted: 0 }
  const ids = data.map((r) => r.id)
  const { error: delErr } = await supabase.from('pt_members').delete().in('id', ids)
  if (delErr) return { error: delErr.message }
  return { success: true as const, deleted: ids.length }
}

export async function getTrainersForPt(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles').select('id, name')
    .in('role', ['trainer', '강사', '팀장', 'admin', '관리자'])
    .eq('is_approved', true).order('name')
  return (data ?? []) as { id: string; name: string }[]
}
