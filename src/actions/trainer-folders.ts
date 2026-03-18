'use server'

import { isDemoMode } from '@/lib/demo'
import { DEMO_OT_ASSIGNMENTS } from '@/lib/demo-data'

export interface TrainerFolder {
  id: string
  name: string
  role: string
  color: string
  has_password: boolean
  stats: {
    inProgress: number
    pending: number
    completed: number
    total: number
  }
}

const FOLDER_COLORS = [
  'bg-purple-400',
  'bg-blue-500',
  'bg-yellow-500',
  'bg-emerald-400',
  'bg-teal-500',
  'bg-orange-400',
  'bg-red-400',
  'bg-pink-400',
]

export async function getTrainerFolders(): Promise<TrainerFolder[]> {
  if (isDemoMode()) {
    return getDemoFolders()
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // 모든 트레이너/관리자 조회
  const { data: trainers } = await supabase
    .from('profiles')
    .select('id, name, role, folder_password')
    .neq('role', 'admin')
    .order('name')

  if (!trainers || trainers.length === 0) return []

  // 모든 OT 배정 조회
  const { data: assignments } = await supabase
    .from('ot_assignments')
    .select('status, pt_trainer_id')

  const folders: TrainerFolder[] = trainers.map((t, i) => {
    const myAssignments = (assignments ?? []).filter(
      (a) => a.pt_trainer_id === t.id
    )

    return {
      id: t.id,
      name: t.name,
      role: t.role,
      color: FOLDER_COLORS[i % FOLDER_COLORS.length],
      has_password: !!t.folder_password,
      stats: {
        inProgress: myAssignments.filter((a) => a.status === '진행중').length,
        pending: myAssignments.filter((a) =>
          ['신청대기', '배정완료'].includes(a.status)
        ).length,
        completed: myAssignments.filter((a) => a.status === '완료').length,
        total: myAssignments.length,
      },
    }
  })

  // 미배정 건 추가
  const unassigned = (assignments ?? []).filter((a) => !a.pt_trainer_id)
  if (unassigned.length > 0) {
    folders.push({
      id: 'unassigned',
      name: '미배정',
      role: 'none',
      color: 'bg-gray-400',
      has_password: false,
      stats: {
        inProgress: unassigned.filter((a) => a.status === '진행중').length,
        pending: unassigned.filter((a) =>
          ['신청대기', '배정완료'].includes(a.status)
        ).length,
        completed: unassigned.filter((a) => a.status === '완료').length,
        total: unassigned.length,
      },
    })
  }

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

  const { createClient } = await import('@/lib/supabase/server')
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

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ folder_password: password })
    .eq('id', trainerId)

  if (error) return { error: error.message }
  return { success: true }
}
