'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_MEMBERS } from '@/lib/demo-data'
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
      (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q)
    )
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // 트레이너/상태 필터가 있으면 ot_assignments를 JOIN
  if (filters?.trainer || filters?.status) {
    let query = supabase
      .from('ot_assignments')
      .select('*, member:members!inner(*)')
      .order('created_at', { ascending: false })

    if (filters.trainer && filters.trainer !== 'all') {
      if (filters.trainer === 'unassigned') {
        query = query.is('pt_trainer_id', null)
      } else {
        query = query.eq('pt_trainer_id', filters.trainer)
      }
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
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

  // 기본 조회 (OT 배정 정보 JOIN)
  let query = supabase
    .from('ot_assignments')
    .select(`
      *,
      member:members!inner(*),
      pt_trainer:profiles!ot_assignments_pt_trainer_id_fkey(id, name),
      ppt_trainer:profiles!ot_assignments_ppt_trainer_id_fkey(id, name),
      sessions:ot_sessions(*)
    `)
    .order('created_at', { ascending: false })

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`, { referencedTable: 'members' })
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from)
  }
  if (filters?.to) {
    query = query.lte('created_at', filters.to + 'T23:59:59Z')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

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

export async function getMember(id: string): Promise<Member | null> {
  if (isDemoMode()) {
    return DEMO_MEMBERS.find((m) => m.id === id) ?? null
  }

  const { createClient } = await import('@/lib/supabase/server')
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

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('members')
    .insert({ ...values, created_by: user?.id })
    .select()
    .single()

  if (error) return { error: error.message }
  return { data }
}

export async function updateMember(id: string, values: Partial<MemberFormValues>) {
  if (isDemoMode()) {
    return { data: { id, ...values } }
  }

  const { createClient } = await import('@/lib/supabase/server')
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

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { error } = await supabase
    .from('members')
    .update({ is_completed: !current })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}
