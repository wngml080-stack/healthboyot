'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_MEMBERS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Member, OtAssignmentWithDetails } from '@/types'
import type { MemberWithOt } from '@/components/members/member-list'
import type { MemberFormValues } from '@/lib/validators'

export async function getMembers(filters?: {
  search?: string
  trainer?: string
  status?: string
  from?: string
  to?: string
}): Promise<MemberWithOt[]> {
  if (isDemoMode()) {
    const demoWithOt: MemberWithOt[] = DEMO_MEMBERS.map((m) => ({ ...m, assignment: null }))
    if (!filters?.search) return demoWithOt
    const q = filters.search.toLowerCase()
    return demoWithOt.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q)
    )
  }

  const supabase = await createClient()

  // 트레이너/상태 필터가 있으면 ot_assignments를 JOIN
  if (filters?.trainer || filters?.status) {
    let query = supabase
      .from('ot_assignments')
      .select(`
        id, status, ot_category, pt_trainer_id, ppt_trainer_id, sales_status, contact_status,
        is_sales_target, is_pt_conversion, notes, pt_assign_status, ppt_assign_status, created_at,
        member:members!inner(id, name, phone, gender, ot_category, exercise_time, duration_months, detail_info, notes, registered_at, registration_source, is_existing_member, is_renewal, is_completed, start_date),
        pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
        ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
        sessions:ot_sessions(id, session_number, scheduled_at, completed_at)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filters.trainer && filters.trainer !== 'all') {
      if (filters.trainer === 'unassigned') {
        query = query.is('pt_trainer_id', null).is('ppt_trainer_id', null)
      } else {
        query = query.or(`pt_trainer_id.eq.${filters.trainer},ppt_trainer_id.eq.${filters.trainer}`)
      }
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'watchlist') {
        // watchlist 컬럼 미존재 시 빈 결과
      } else {
        query = query.eq('status', filters.status)
      }
    }

    if (filters.from) {
      query = query.gte('created_at', filters.from)
    }
    if (filters.to) {
      query = query.lte('created_at', filters.to + 'T23:59:59Z')
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`, { referencedTable: 'members' })
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)

    // member + OT 정보 추출 (중복 제거)
    const seen = new Set<string>()
    const members: MemberWithOt[] = []
    for (const row of (data ?? []) as unknown as OtAssignmentWithDetails[]) {
      const m = row.member
      if (!seen.has(m.id)) {
        seen.add(m.id)
        members.push({ ...m, assignment: row })
      }
    }
    return members
  }

  // 기본 조회: members 기준으로 조회하여 중복 없이 가져옴
  let query = supabase
    .from('members')
    .select(`
      id, name, phone, gender, ot_category, exercise_time, duration_months,
      detail_info, notes, registered_at, registration_source, is_existing_member,
      is_renewal, is_completed, start_date, created_at, created_by,
      creator:profiles!members_created_by_fkey(name, role),
      consultation_card:consultation_cards(exercise_time_preference, exercise_start_date, exercise_goals, exercise_goal_detail, body_correction_area, desired_body_type, exercise_experiences, exercise_duration, medical_conditions, medical_detail, surgery_history, surgery_detail, age, occupation, exercise_personality),
      assignment:ot_assignments(
        id, status, ot_category, pt_trainer_id, ppt_trainer_id,
        sales_status, contact_status, is_sales_target, is_pt_conversion,
        is_excluded, excluded_reason,
        notes, pt_assign_status, ppt_assign_status, created_at,
        pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
        ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
        sessions:ot_sessions(id, session_number, scheduled_at, completed_at)
      )
    `)
    .order('registered_at', { ascending: false })
    .limit(200)

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
  }
  if (filters?.from) {
    query = query.gte('registered_at', filters.from)
  }
  if (filters?.to) {
    query = query.lte('registered_at', filters.to)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // 미연결 상담카드(member_id=null)도 이름/전화번호로 매칭해서 lookup
  // → 카드가 회원 등록 후 자동 링크되지 않는 경우 대비
  const memberRows = (data ?? []) as Record<string, unknown>[]
  const namesForMatch: string[] = []
  const phonesForMatch: string[] = []
  for (const m of memberRows) {
    const cards = m.consultation_card as Record<string, unknown>[] | null
    if (cards && cards.length > 0) continue  // 이미 링크된 카드 있음
    const name = m.name as string | null
    const phone = m.phone as string | null
    if (name) namesForMatch.push(name)
    if (phone) phonesForMatch.push(phone)
  }

  let unlinkedByKey: Map<string, Record<string, unknown>> = new Map()
  if (namesForMatch.length > 0 || phonesForMatch.length > 0) {
    const orParts: string[] = []
    if (namesForMatch.length > 0) orParts.push(`member_name.in.(${namesForMatch.map((n) => `"${n}"`).join(',')})`)
    if (phonesForMatch.length > 0) orParts.push(`member_phone.in.(${phonesForMatch.map((p) => `"${p}"`).join(',')})`)
    const { data: unlinkedCards } = await supabase
      .from('consultation_cards')
      .select('member_name, member_phone, exercise_time_preference, exercise_start_date, exercise_goals, exercise_goal_detail, body_correction_area, desired_body_type, exercise_experiences, exercise_duration, medical_conditions, medical_detail, surgery_history, surgery_detail, age, occupation, exercise_personality, created_at')
      .is('member_id', null)
      .or(orParts.join(','))
      .order('created_at', { ascending: false })
    // (name, phone) 중 어느 하나로라도 매칭 — phone 우선, 없으면 name
    for (const c of (unlinkedCards ?? []) as Record<string, unknown>[]) {
      const phone = c.member_phone as string | null
      const name = c.member_name as string | null
      if (phone) {
        const key = `phone:${phone}`
        if (!unlinkedByKey.has(key)) unlinkedByKey.set(key, c)
      }
      if (name) {
        const key = `name:${name}`
        if (!unlinkedByKey.has(key)) unlinkedByKey.set(key, c)
      }
    }
  }

  // 각 회원에 대해 최신 OT 배정을 연결
  const members: MemberWithOt[] = memberRows.map((raw) => {
    const assignments = raw.assignment as OtAssignmentWithDetails[] | null
    // 가장 최근 배정을 선택
    const latest = assignments?.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0] ?? null
    const creator = raw.creator as { name: string; role: string } | null
    const creatorName = (creator && creator.role !== 'admin') ? creator.name : null
    // 상담카드: 1) 링크된 카드 우선, 2) 없으면 phone/name 매칭된 미연결 카드
    const cards = raw.consultation_card as Record<string, unknown>[] | null
    let latestCard: Record<string, unknown> | null = cards?.[0] ?? null
    if (!latestCard) {
      const phone = raw.phone as string | null
      const name = raw.name as string | null
      latestCard = (phone && unlinkedByKey.get(`phone:${phone}`))
        || (name && unlinkedByKey.get(`name:${name}`))
        || null
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { assignment: _rawAssignment, creator: _rawCreator, consultation_card: _rawCard, ...member } = raw as Record<string, unknown> & { assignment: unknown; creator: unknown; consultation_card: unknown }
    // 운동시간/시작일은 상담카드만 신뢰 — 없으면 비워둠 (members 테이블 값 무시)
    member.exercise_time = (latestCard?.exercise_time_preference as string | null) ?? null
    member.start_date = (latestCard?.exercise_start_date as string | null) ?? null
    // 상담카드 요약 데이터
    const cardSummary = latestCard ? {
      exercise_goals: latestCard.exercise_goals as string[] | undefined,
      exercise_goal_detail: latestCard.exercise_goal_detail as string | null,
      body_correction_area: latestCard.body_correction_area as string | null,
      desired_body_type: latestCard.desired_body_type as string | null,
      exercise_experiences: latestCard.exercise_experiences as string[] | undefined,
      exercise_duration: latestCard.exercise_duration as string | null,
      medical_conditions: latestCard.medical_conditions as string[] | undefined,
      medical_detail: latestCard.medical_detail as string | null,
      surgery_history: latestCard.surgery_history as string | null,
      surgery_detail: latestCard.surgery_detail as string | null,
      age: latestCard.age as string | null,
      occupation: latestCard.occupation as string | null,
      exercise_personality: latestCard.exercise_personality as string[] | undefined,
    } : null
    return { ...member, assignment: latest, creator_name: creatorName, card_summary: cardSummary } as MemberWithOt
  })
  return members
}

export async function getMember(id: string): Promise<Member | null> {
  if (isDemoMode()) {
    return DEMO_MEMBERS.find((m) => m.id === id) ?? null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

export async function createMember(values: MemberFormValues) {
  if (isDemoMode()) {
    return { data: { id: 'demo-new', ...values } }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // 운동시간은 상담카드 연결 시 가져오므로 자동 등록 시 빈값
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { exercise_time: _skipTime, ...memberValues } = values as Record<string, unknown>
  const { data, error } = await supabase
    .from('members')
    .insert({ ...memberValues, exercise_time: null, created_by: user?.id, registration_source: '자동' })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function updateMember(id: string, values: Partial<MemberFormValues>) {
  if (isDemoMode()) {
    return { data: { id, ...values } }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .update(values)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function toggleMemberCompleted(id: string, current: boolean) {
  if (isDemoMode()) {
    return { success: true }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('members')
    .update({ is_completed: !current })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteMember(id: string) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // ot_assignments(member_id), ot_sessions(ot_assignment_id) 모두 ON DELETE CASCADE 이므로
  // members 한 번만 삭제하면 연관 데이터까지 자동 삭제됨
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/ot')
  revalidatePath('/members')
  revalidatePath('/dashboard')
  return { success: true }
}

// ── 회원 검색 (이름 또는 전화번호) ──
export async function searchMembers(query: string): Promise<Member[]> {
  if (!query || query.length < 2) return []

  if (isDemoMode()) {
    const q = query.toLowerCase()
    return DEMO_MEMBERS.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q)
    ).slice(0, 10)
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order('registered_at', { ascending: false })
    .limit(10)

  if (error) return []
  return data ?? []
}

// ── 전화번호 중복 체크 ──
export async function checkPhoneDuplicate(phone: string): Promise<Member | null> {
  if (isDemoMode()) {
    return DEMO_MEMBERS.find((m) => m.phone === phone) ?? null
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  return data ?? null
}

// ── 간편 회원 등록 + OT 배정 ──
// phone은 옵셔널 (PT는 회원명만으로도 등록 가능)
// force: true로 설정하면 전화번호 중복(다른 트레이너 배정)이어도 강제 진행
export async function quickRegisterMember(values: {
  name: string
  phone?: string  // 옵셔널
  trainerId: string
  trainerRole?: 'pt' | 'ppt'
  isExistingMember?: boolean
  registered_at?: string
  ot_category?: string | null
  training_type?: string
  duration_months?: string | null
  exercise_time?: string | null
  exercise_goal?: string
  notes?: string | null
  registration_source?: string
  // PT 가입 정보 (옵셔널) — 총 등록 횟수, 현재까지 진행한 횟수
  expected_sessions?: number
  actual_sessions?: number
  force?: boolean  // 전화번호 중복 무시하고 강제 진행
}) {
  if (isDemoMode()) {
    return { data: { memberId: 'demo-new', assignmentId: 'demo-assign' } }
  }

  const supabase = await createClient()

  // detail_info 조합: PT/PPT + 운동목적
  const detailParts: string[] = []
  if (values.training_type) detailParts.push(values.training_type)
  if (values.exercise_goal) detailParts.push(values.exercise_goal)
  const detailInfo = detailParts.length > 0 ? detailParts.join(' / ') : null

  // trainerId가 빈 문자열이나 'none'이면 미배정
  const trainerId = (values.trainerId && values.trainerId !== 'none') ? values.trainerId : null
  const isPpt = values.trainerRole === 'ppt'
  const assignStatus = trainerId ? '배정완료' : '신청대기'

  // 1. 전화번호가 있으면 중복 체크 (없으면 항상 신규)
  const phone = values.phone?.trim() || null
  const existing = phone ? await checkPhoneDuplicate(phone) : null
  // PT 가입 정보 (옵셔널) — 0이거나 undefined면 default 사용
  const expectedSessions = values.expected_sessions && values.expected_sessions > 0
    ? values.expected_sessions
    : undefined
  const actualSessions = values.actual_sessions && values.actual_sessions > 0
    ? values.actual_sessions
    : undefined

  if (existing) {
    // 기존 회원 — 활성 배정이 있는지 확인 (트레이너 이름까지 같이 조회)
    const { data: activeAssignment } = await supabase
      .from('ot_assignments')
      .select(`
        id, pt_trainer_id, ppt_trainer_id,
        pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(name),
        ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(name)
      `)
      .eq('member_id', existing.id)
      .not('status', 'in', '("완료","거부")')
      .maybeSingle()

    if (activeAssignment) {
      // force=false (기본): 다른 트레이너 배정 중이면 차단하고 안내
      if (!values.force) {
        const ptName = (activeAssignment.pt_trainer as unknown as { name: string } | null)?.name
        const pptName = (activeAssignment.ppt_trainer as unknown as { name: string } | null)?.name
        const trainerNames = [ptName && `PT ${ptName}`, pptName && `PPT ${pptName}`].filter(Boolean).join(', ')
        return {
          duplicate: true as const,
          existingMember: existing,
          assignedTrainerNames: trainerNames || '미배정 상태',
          message: trainerNames
            ? `${existing.name} (${existing.phone}) 회원은 이미 ${trainerNames} 트레이너에게 배정되어 있습니다.`
            : `${existing.name} (${existing.phone}) 회원이 이미 등록되어 있습니다 (현재 미배정 상태).`,
        }
      }
      // force=true: 트레이너 업데이트로 진행
      const updateData: Record<string, unknown> = {}
      if (isPpt) {
        updateData.ppt_trainer_id = trainerId
        updateData.ppt_assign_status = trainerId ? 'assigned' : 'none'
      } else {
        updateData.pt_trainer_id = trainerId
        updateData.pt_assign_status = trainerId ? 'assigned' : 'none'
      }
      updateData.status = '배정완료'

      const { error: updateErr } = await supabase
        .from('ot_assignments')
        .update(updateData)
        .eq('id', activeAssignment.id)

      if (updateErr) return { error: updateErr.message }
      return { data: { memberId: existing.id, assignmentId: activeAssignment.id }, existingMember: existing }
    }

    // 활성 배정 없으면 새로 생성
    const { data: assignment, error: assignErr } = await supabase
      .from('ot_assignments')
      .insert({
        member_id: existing.id,
        status: assignStatus,
        pt_trainer_id: isPpt ? null : trainerId,
        ppt_trainer_id: isPpt ? trainerId : null,
        pt_assign_status: isPpt ? 'none' : (trainerId ? 'assigned' : 'none'),
        ppt_assign_status: isPpt ? (trainerId ? 'assigned' : 'none') : 'none',
        ...(expectedSessions ? { expected_sessions: expectedSessions } : {}),
        ...(actualSessions ? { actual_sessions: actualSessions } : {}),
      })
      .select('id')
      .single()

    if (assignErr) return { error: assignErr.message }
    return { data: { memberId: existing.id, assignmentId: assignment.id }, existingMember: existing }
  }

  // 2. 신규 회원 등록
  const { data: { user } } = await supabase.auth.getUser()

  const memberData: Record<string, unknown> = {
    name: values.name,
    phone: phone,
    sports: values.ot_category ? [values.ot_category] : [],
    ot_category: values.ot_category || null,
    duration_months: values.duration_months || null,
    exercise_time: values.exercise_time || null,
    detail_info: detailInfo,
    notes: values.notes || null,
    injury_tags: [],
    created_by: user?.id,
    is_existing_member: values.isExistingMember ?? false,
    registration_source: values.registration_source || '수기',
  }
  if (values.registered_at) {
    memberData.registered_at = values.registered_at
  }

  const { data: member, error: memberErr } = await supabase
    .from('members')
    .insert(memberData)
    .select('id')
    .single()

  if (memberErr) return { error: memberErr.message }

  // 3. OT 배정
  const { data: assignment, error: assignErr } = await supabase
    .from('ot_assignments')
    .insert({
      member_id: member.id,
      status: assignStatus,
      pt_trainer_id: isPpt ? null : trainerId,
      ppt_trainer_id: isPpt ? trainerId : null,
      pt_assign_status: isPpt ? 'none' : (trainerId ? 'assigned' : 'none'),
      ppt_assign_status: isPpt ? (trainerId ? 'assigned' : 'none') : 'none',
      ...(expectedSessions ? { expected_sessions: expectedSessions } : {}),
      ...(actualSessions ? { actual_sessions: actualSessions } : {}),
    })
    .select('id')
    .single()

  if (assignErr) return { error: assignErr.message }
  return { data: { memberId: member.id, assignmentId: assignment.id } }
}
