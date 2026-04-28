'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import { nowKst, toKstDateStr } from '@/lib/kst'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'
import Link from 'next/link'

const ROLE_COLORS: Record<string, string> = {
  trainer: 'bg-blue-500', '트레이너': 'bg-blue-500',
  fc: 'bg-emerald-500', admin: 'bg-yellow-500',
  '관리자': 'bg-yellow-500', '팀장': 'bg-yellow-500', '강사': 'bg-pink-500',
}

export function FolderLoader() {
  const [data, setData] = useState<{
    folders: TrainerFolder[]
    allStaff: Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
    role: string
    userId?: string
  } | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    const todayStr = toKstDateStr(nowKst())

    // 브라우저 → Supabase 직접 병렬 호출 (서버 경유 없음)
    Promise.all([
      supabase.from('profiles')
        .select('id, name, role, folder_password, folder_order')
        .neq('role', 'admin').eq('is_approved', true).eq('has_folder', true)
        .order('folder_order', { ascending: true }).order('name'),
      supabase.from('profiles')
        .select('id, name, role, is_approved')
        .order('role').order('name'),
      supabase.auth.getUser(),
      supabase.from('ot_assignments')
        .select('status, pt_trainer_id, ppt_trainer_id, is_sales_target, is_pt_conversion, created_at, member:members!inner(id, name)')
        .eq('is_excluded', false)
        .limit(2000),
      supabase.from('trainer_schedules')
        .select('trainer_id, member_name')
        .eq('scheduled_date', todayStr).eq('schedule_type', 'OT'),
    ]).then(([trainersRes, staffRes, authRes, assignRes, schedRes]) => {
      const trainers = trainersRes.data ?? []
      const allStaff = (staffRes.data ?? []) as Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
      const userId = authRes.data?.user?.id
      const assignments = assignRes.data ?? []
      const todaySchedules = schedRes.data ?? []

      // 유저 프로필
      const userProfile = allStaff.find((s) => s.id === userId)
      const role = userProfile?.role ?? 'fc'

      // 트레이너별 인덱싱
      const trainerIds = trainers.map((t) => t.id)
      const myAssignments = assignments.filter((a) =>
        (a.pt_trainer_id && trainerIds.includes(a.pt_trainer_id)) ||
        (a.ppt_trainer_id && trainerIds.includes(a.ppt_trainer_id))
      )
      const assignmentsByTrainer = new Map<string, typeof myAssignments>()
      for (const a of myAssignments) {
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

      const folders: TrainerFolder[] = trainers.map((t) => {
        const ta = assignmentsByTrainer.get(t.id) ?? []
        const myOts = schedulesByTrainer.get(t.id) ?? []
        const todayNames = new Set(myOts.map((s) => s.member_name))
        const salesIds = new Set<string>()
        for (const a of ta) {
          const m = a.member as unknown as { id: string; name: string } | null
          if (m && todayNames.has(m.name) && a.is_sales_target) salesIds.add(m.id)
        }
        const latestDate = ta.reduce<string | null>((l, a) => (!a.created_at ? l : !l || a.created_at > l ? a.created_at : l), null)
        return {
          id: t.id, name: t.name, role: t.role,
          color: ROLE_COLORS[t.role] ?? 'bg-gray-400',
          has_password: !!t.folder_password,
          folder_order: t.folder_order ?? 0,
          latestAssignmentDate: latestDate,
          stats: { inProgress: myOts.length, pending: salesIds.size, completed: ta.filter((a) => a.is_pt_conversion).length, total: ta.length },
        }
      })

      setData({ folders, allStaff, role, userId })
    })
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">폴더를 불러오는 중...</span>
      </div>
    )
  }

  return (
    <>
      {(data.role === 'admin' || data.role === '관리자') && (
        <div className="flex justify-end -mt-2">
          <Link href="/ot/recover" className="text-xs text-orange-600 hover:text-orange-700 underline">OT 세션 복구</Link>
        </div>
      )}
      <TrainerFolderGrid folders={data.folders} allStaff={data.allStaff} currentUserRole={data.role} currentUserId={data.userId} />
    </>
  )
}
