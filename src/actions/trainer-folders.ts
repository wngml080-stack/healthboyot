'use server'

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

  const trainerIds = trainers.map((t) => t.id)

  // KST 기준 오늘
  const todayStr = toKstDateStr(nowKst())

  // 배정 + 오늘 스케줄 + 제외회원 수 병렬 조회 (3쿼리 → 2쿼리로 축소 가능하지만 병렬이라 차이 미미)
  const [{ data: assignments }, { data: todaySchedules }, { count: excludedCount }] = await Promise.all([
    supabase
      .from('ot_assignments')
      .select('status, pt_trainer_id, ppt_trainer_id, is_sales_target, is_pt_conversion, created_at, member:members!inner(id, name)')
      .or(`pt_trainer_id.in.(${trainerIds.join(',')}),ppt_trainer_id.in.(${trainerIds.join(',')})`),
    supabase
      .from('trainer_schedules')
      .select('trainer_id, member_name')
      .eq('scheduled_date', todayStr)
      .eq('schedule_type', 'OT')
      .in('trainer_id', trainerIds),
    supabase
      .from('ot_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('is_excluded', true),
  ])

  // 트레이너별 assignment 미리 인덱싱 (O(N) → O(1) 조회)
  const allAssignments = assignments ?? []
  const assignmentsByTrainer = new Map<string, (typeof allAssignments)>()
  for (const a of allAssignments) {
    if (a.pt_trainer_id) {
      if (!assignmentsByTrainer.has(a.pt_trainer_id)) assignmentsByTrainer.set(a.pt_trainer_id, [])
      assignmentsByTrainer.get(a.pt_trainer_id)!.push(a)
    }
    if (a.ppt_trainer_id && a.ppt_trainer_id !== a.pt_trainer_id) {
      if (!assignmentsByTrainer.has(a.ppt_trainer_id)) assignmentsByTrainer.set(a.ppt_trainer_id, [])
      assignmentsByTrainer.get(a.ppt_trainer_id)!.push(a)
    }
  }

  // 오늘 스케줄 트레이너별 인덱싱
  const allSchedules = todaySchedules ?? []
  const schedulesByTrainer = new Map<string, (typeof allSchedules)>()
  for (const s of allSchedules) {
    if (!schedulesByTrainer.has(s.trainer_id)) schedulesByTrainer.set(s.trainer_id, [])
    schedulesByTrainer.get(s.trainer_id)!.push(s)
  }

  const folders: TrainerFolder[] = trainers.map((t) => {
    const myAssignments = assignmentsByTrainer.get(t.id) ?? []

    // 오늘 이 트레이너의 OT 수업
    const myTodayOts = schedulesByTrainer.get(t.id) ?? []
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

    // 가장 최근 배정일
    const latestDate = myAssignments.reduce<string | null>((latest, a) => {
      if (!a.created_at) return latest
      return !latest || a.created_at > latest ? a.created_at : latest
    }, null)

    return {
      id: t.id,
      name: t.name,
      role: t.role,
      color: ROLE_COLORS[t.role] ?? 'bg-gray-400',
      has_password: !!t.folder_password,
      folder_order: t.folder_order ?? 0,
      latestAssignmentDate: latestDate,
      stats: {
        inProgress: myTodayOts.length, // 금일 OT 수업 개수
        pending: todaySalesTargetMemberIds.size, // 금일 매출대상자
        completed: myAssignments.filter((a) => a.is_pt_conversion).length, // PT전환
        total: myAssignments.length, // 전체 회원 (수기 포함)
      },
    }
  })

  // "제외회원" 폴더 — count만 사용 (head: true로 데이터 안 받아옴)
  folders.push({
    id: 'excluded',
    name: '제외회원',
    role: 'trainer',
    color: 'bg-red-400',
    has_password: false,
    folder_order: 9999,
    latestAssignmentDate: null,
    stats: {
      inProgress: 0,
      pending: 0,
      completed: 0,
      total: excludedCount ?? 0,
    },
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
