'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/server'

export interface TrainerFolder {
  id: string
  name: string
  role: string
  color: string
  has_password: boolean
  folder_order: number
  stats: {
    inProgress: number
    pending: number
    completed: number
    total: number
  }
}

// 직무별 색상
const ROLE_COLORS: Record<string, string> = {
  trainer: 'bg-blue-500',
  fc: 'bg-emerald-500',
  admin: 'bg-yellow-500',
}

export async function getTrainerFolders(): Promise<TrainerFolder[]> {
  if (isDemoMode()) {
    return getDemoFolders()
  }

  const supabase = await createClient()

  // 승인 + 폴더 활성화된 직원만 조회 (순서대로)
  const { data: trainers } = await supabase
    .from('profiles')
    .select('id, name, role, folder_password, folder_order')
    .neq('role', 'admin')
    .eq('is_approved', true)
    .eq('has_folder', true)
    .order('folder_order', { ascending: true })
    .order('name')

  if (!trainers || trainers.length === 0) return []

  // 해당 트레이너들의 배정만 조회 (PT 또는 PPT 담당) — 수기 회원 포함 전체 카운트
  const trainerIds = trainers.map((t) => t.id)
  const { data: assignments } = await supabase
    .from('ot_assignments')
    .select('status, pt_trainer_id, ppt_trainer_id, is_sales_target, is_pt_conversion, member:members!inner(id, name, registration_source)')
    .or(`pt_trainer_id.in.(${trainerIds.join(',')}),ppt_trainer_id.in.(${trainerIds.join(',')})`)

  // 오늘의 OT 수업 (trainer_schedules에서 오늘 schedule_type='OT' 행)
  // KST 기준 오늘 — 서버가 UTC라서 KST offset 적용
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayStr = `${nowKst.getUTCFullYear()}-${String(nowKst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowKst.getUTCDate()).padStart(2, '0')}`
  const { data: todaySchedules } = await supabase
    .from('trainer_schedules')
    .select('trainer_id, member_name')
    .eq('scheduled_date', todayStr)
    .eq('schedule_type', 'OT')
    .in('trainer_id', trainerIds)

  const folders: TrainerFolder[] = trainers.map((t) => {
    // 트레이너 본인 담당 회원 전체 (수기 포함)
    const myAssignments = (assignments ?? []).filter((a) => {
      return a.pt_trainer_id === t.id || a.ppt_trainer_id === t.id
    })

    // 오늘 이 트레이너의 OT 수업
    const myTodayOts = (todaySchedules ?? []).filter((s) => s.trainer_id === t.id)
    // 오늘 OT 수업이 잡힌 회원 이름 set
    const todayMemberNames = new Set(myTodayOts.map((s) => s.member_name))
    // 오늘 OT 수업 회원 중 매출대상자 카운트 (회원 단위 unique)
    const todaySalesTargetMemberIds = new Set<string>()
    for (const a of myAssignments) {
      const member = a.member as unknown as { id: string; name: string } | null
      if (!member) continue
      if (todayMemberNames.has(member.name) && a.is_sales_target) {
        todaySalesTargetMemberIds.add(member.id)
      }
    }

    return {
      id: t.id,
      name: t.name,
      role: t.role,
      color: ROLE_COLORS[t.role] ?? 'bg-gray-400',
      has_password: !!t.folder_password,
      folder_order: t.folder_order ?? 0,
      stats: {
        inProgress: myTodayOts.length, // 금일 OT 수업 개수
        pending: todaySalesTargetMemberIds.size, // 금일 매출대상자
        completed: myAssignments.filter((a) => a.is_pt_conversion).length, // PT전환
        total: myAssignments.length, // 전체 회원 (수기 포함)
      },
    }
  })

  return folders
}

function getDemoFolders(): TrainerFolder[] {
  const assignments = DEMO_OT_ASSIGNMENTS

  const trainerAssignments = assignments.filter(
    (a) => a.pt_trainer_id === 'demo-trainer-001'
  )
  const unassigned = assignments.filter((a) => !a.pt_trainer_id)

  return [
    {
      id: 'demo-trainer-001',
      name: '박트레이너',
      role: 'trainer',
      color: 'bg-blue-500',
      has_password: true,
      folder_order: 1,
      stats: {
        inProgress: trainerAssignments.filter((a) => a.status === '진행중').length,
        pending: trainerAssignments.filter((a) =>
          ['신청대기', '배정완료'].includes(a.status)
        ).length,
        completed: trainerAssignments.filter((a) => a.status === '완료').length,
        total: trainerAssignments.length,
      },
    },
    {
      id: 'unassigned',
      name: '미배정',
      role: 'none',
      color: 'bg-gray-400',
      has_password: false,
      folder_order: 2,
      stats: {
        inProgress: unassigned.filter((a) => a.status === '진행중').length,
        pending: unassigned.filter((a) =>
          ['신청대기', '배정완료'].includes(a.status)
        ).length,
        completed: unassigned.filter((a) => a.status === '완료').length,
        total: unassigned.length,
      },
    },
  ]
}

// ── 폴더 비밀번호 ──
export async function verifyFolderPassword(trainerId: string, password: string): Promise<boolean> {
  if (isDemoMode()) {
    return password === '1234' // 데모 비밀번호
  }

  const supabase = await createClient()

  // 관리자 통합 비밀번호 체크
  const { data: currentUser } = await supabase.auth.getUser()
  if (currentUser?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.user.id)
      .single()
    if (profile?.role === 'admin') return true // 관리자는 모든 폴더 접근
  }

  // 트레이너 폴더 비밀번호 체크
  const { data } = await supabase
    .from('profiles')
    .select('folder_password')
    .eq('id', trainerId)
    .single()

  if (!data?.folder_password) return true // 비밀번호 미설정 시 접근 허용
  return data.folder_password === password
}

export async function setFolderPassword(trainerId: string, password: string) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ folder_password: password })
    .eq('id', trainerId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function createFolder(trainerId: string, password?: string) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  // 현재 최대 순서 + 1
  const { data: maxOrder } = await supabase
    .from('profiles')
    .select('folder_order')
    .eq('has_folder', true)
    .order('folder_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxOrder?.folder_order ?? 0) + 1

  const updateData: Record<string, unknown> = { has_folder: true, folder_order: nextOrder }
  if (password) updateData.folder_password = password

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', trainerId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteFolder(trainerId: string) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ has_folder: false, folder_order: 0 })
    .eq('id', trainerId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function swapFolderOrder(folderId1: string, order1: number, folderId2: string, order2: number) {
  if (isDemoMode()) return { success: true }

  const supabase = await createClient()

  const { error: e1 } = await supabase
    .from('profiles')
    .update({ folder_order: order2 })
    .eq('id', folderId1)

  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase
    .from('profiles')
    .update({ folder_order: order1 })
    .eq('id', folderId2)

  if (e2) return { error: e2.message }

  return { success: true }
}
