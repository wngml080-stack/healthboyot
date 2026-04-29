'use server'

import { cache } from 'react'
import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'
import { nowKst, toKstDateStr } from '@/lib/kst'
import { createClient } from '@/lib/supabase/server'

export interface TrainerFolder {
  id: string
  name: string
  role: string
  color: string
  has_password: boolean
  folder_order: number
  latestAssignmentDate: string | null // 가장 최근 배정일 (ISO string)
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
  '트레이너': 'bg-blue-500',
  fc: 'bg-emerald-500',
  admin: 'bg-yellow-500',
  '관리자': 'bg-yellow-500',
  '팀장': 'bg-yellow-500',
  '강사': 'bg-pink-500',
}

export const getTrainerFolders = cache(async (): Promise<TrainerFolder[]> => {
  if (isDemoMode()) {
    return getDemoFolders()
  }

  const supabase = await createClient()
  const todayStr = toKstDateStr(nowKst())

  // RPC 1회 호출로 모든 데이터 가져오기 (DB 내부에서 JOIN 처리)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_trainer_folders_data', { today_date: todayStr })

  if (rpcError || !rpcData) {
    console.error('[getTrainerFolders] RPC 실패, fallback:', rpcError?.message)
    // RPC 실패 시 기존 방식으로 폴백
    return getTrainerFoldersFallback(supabase, todayStr)
  }

  const { trainers, assignments, todaySchedules } = rpcData as {
    trainers: { id: string; name: string; role: string; folder_password: string | null; folder_order: number }[] | null
    assignments: { pt_trainer_id: string | null; ppt_trainer_id: string | null; is_sales_target: boolean; is_pt_conversion: boolean; created_at: string; member_id: string; member_name: string }[] | null
    todaySchedules: { trainer_id: string; member_name: string }[] | null
    allStaff: unknown
  }

  if (!trainers || trainers.length === 0) return []

  return buildFolders(trainers, assignments ?? [], todaySchedules ?? [])
})

/** 폴더 + 스태프 + 프로필을 1회 RPC로 반환 (folder-loader용) */
export async function getTrainerFoldersAll() {
  if (isDemoMode()) {
    const folders = getDemoFolders()
    return { folders, allStaff: [] as { id: string; name: string; role: string; is_approved: boolean }[], role: 'admin', userId: 'demo-admin-001' }
  }

  const supabase = await createClient()
  const todayStr = toKstDateStr(nowKst())

  // 1회 RPC로 폴더 + 스태프 + 사용자 정보 모두 반환
  const [{ data: rpcData, error: rpcError }, { data: { session } }] = await Promise.all([
    supabase.rpc('get_trainer_folders_data', { today_date: todayStr }),
    supabase.auth.getSession(),
  ])

  if (rpcError || !rpcData) {
    console.error('[getTrainerFoldersAll] RPC 실패:', rpcError?.message)
    // 폴백
    const folders = await getTrainerFoldersFallback(supabase, todayStr)
    const { data: staffData } = await supabase.from('profiles').select('id, name, role, is_approved').order('role').order('name')
    const userId = session?.user?.id
    const userProfile = (staffData ?? []).find((s) => s.id === userId)
    return { folders, allStaff: (staffData ?? []) as { id: string; name: string; role: string; is_approved: boolean }[], role: userProfile?.role ?? 'fc', userId }
  }

  const { trainers, assignments, todaySchedules, allStaff } = rpcData as {
    trainers: { id: string; name: string; role: string; folder_password: string | null; folder_order: number }[] | null
    assignments: { pt_trainer_id: string | null; ppt_trainer_id: string | null; is_sales_target: boolean; is_pt_conversion: boolean; created_at: string; member_id: string; member_name: string }[] | null
    todaySchedules: { trainer_id: string; member_name: string }[] | null
    allStaff: { id: string; name: string; role: string; is_approved: boolean }[] | null
  }

  const folders = (!trainers || trainers.length === 0) ? [] : buildFolders(trainers, assignments ?? [], todaySchedules ?? [])
  const staff = (allStaff ?? []) as { id: string; name: string; role: string; is_approved: boolean }[]
  const userId = session?.user?.id
  const userProfile = staff.find((s) => s.id === userId)

  return { folders, allStaff: staff, role: userProfile?.role ?? 'fc', userId }
}

/** RPC 실패 시 기존 방식으로 폴백 */
async function getTrainerFoldersFallback(supabase: Awaited<ReturnType<typeof createClient>>, todayStr: string): Promise<TrainerFolder[]> {
  const { data: trainers } = await supabase
    .from('profiles')
    .select('id, name, role, folder_password, folder_order')
    .neq('role', 'admin').eq('is_approved', true).eq('has_folder', true)
    .order('folder_order', { ascending: true }).order('name')

  if (!trainers || trainers.length === 0) return []
  const trainerIds = trainers.map((t) => t.id)

  const [{ data: assignments }, { data: todaySchedules }] = await Promise.all([
    supabase.from('ot_assignments')
      .select('status, pt_trainer_id, ppt_trainer_id, is_sales_target, is_pt_conversion, created_at, member:members!inner(id, name)')
      .or(`pt_trainer_id.in.(${trainerIds.join(',')}),ppt_trainer_id.in.(${trainerIds.join(',')})`)
      .limit(2000),
    supabase.from('trainer_schedules')
      .select('trainer_id, member_name')
      .eq('scheduled_date', todayStr).eq('schedule_type', 'OT')
      .in('trainer_id', trainerIds),
  ])

  const mapped = (assignments ?? []).map((a) => {
    const m = a.member as unknown as { id: string; name: string } | null
    return { ...a, member_id: m?.id ?? '', member_name: m?.name ?? '' }
  })

  return buildFolders(trainers, mapped, todaySchedules ?? [])
}

/** 공통: 폴더 데이터 가공 */
function buildFolders(
  trainers: { id: string; name: string; role: string; folder_password: string | null; folder_order: number }[],
  assignments: { pt_trainer_id: string | null; ppt_trainer_id: string | null; is_sales_target: boolean; is_pt_conversion: boolean; created_at: string; member_id: string; member_name: string }[],
  todaySchedules: { trainer_id: string; member_name: string }[],
): TrainerFolder[] {
  const assignmentsByTrainer = new Map<string, typeof assignments>()
  for (const a of assignments) {
    if (a.pt_trainer_id) {
      if (!assignmentsByTrainer.has(a.pt_trainer_id)) assignmentsByTrainer.set(a.pt_trainer_id, [])
      assignmentsByTrainer.get(a.pt_trainer_id)!.push(a)
    }
    if (a.ppt_trainer_id && a.ppt_trainer_id !== a.pt_trainer_id) {
      if (!assignmentsByTrainer.has(a.ppt_trainer_id)) assignmentsByTrainer.set(a.ppt_trainer_id, [])
      assignmentsByTrainer.get(a.ppt_trainer_id)!.push(a)
    }
  }

  const schedulesByTrainer = new Map<string, typeof todaySchedules>()
  for (const s of todaySchedules) {
    if (!schedulesByTrainer.has(s.trainer_id)) schedulesByTrainer.set(s.trainer_id, [])
    schedulesByTrainer.get(s.trainer_id)!.push(s)
  }

  return trainers.map((t) => {
    const myAssignments = assignmentsByTrainer.get(t.id) ?? []
    const myTodayOts = schedulesByTrainer.get(t.id) ?? []
    const todayMemberNames = new Set(myTodayOts.map((s) => s.member_name))
    const todaySalesTargetMemberIds = new Set<string>()
    for (const a of myAssignments) {
      if (todayMemberNames.has(a.member_name) && a.is_sales_target) todaySalesTargetMemberIds.add(a.member_id)
    }
    const latestDate = myAssignments.reduce<string | null>((l, a) => (!a.created_at ? l : !l || a.created_at > l ? a.created_at : l), null)

    return {
      id: t.id, name: t.name, role: t.role,
      color: ROLE_COLORS[t.role] ?? 'bg-gray-400',
      has_password: !!t.folder_password,
      folder_order: t.folder_order ?? 0,
      latestAssignmentDate: latestDate,
      stats: { inProgress: myTodayOts.length, pending: todaySalesTargetMemberIds.size, completed: myAssignments.filter((a) => a.is_pt_conversion).length, total: myAssignments.length },
    }
  })
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
      latestAssignmentDate: new Date().toISOString(),
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
      latestAssignmentDate: null,
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

  // 관리자 체크 + 폴더 비밀번호 병렬 조회
  const [{ data: currentUser }, { data: folderData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('folder_password').eq('id', trainerId).single(),
  ])

  if (currentUser?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.user.id)
      .single()
    if (profile?.role === 'admin' || profile?.role === '관리자') return true
  }

  if (!folderData?.folder_password) return true
  return folderData.folder_password === password
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

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('profiles').update({ folder_order: order2 }).eq('id', folderId1),
    supabase.from('profiles').update({ folder_order: order1 }).eq('id', folderId2),
  ])

  if (e1) return { error: e1.message }
  if (e2) return { error: e2.message }
  return { success: true }
}
