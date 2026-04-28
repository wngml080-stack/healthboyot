'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getTrainerFolders } from '@/actions/trainer-folders'
import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'
import Link from 'next/link'

export function FolderLoader() {
  const [data, setData] = useState<{
    folders: TrainerFolder[]
    allStaff: Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
    role: string
    userId?: string
  } | null>(null)

  useEffect(() => {
    Promise.all([getTrainerFolders(), getStaffList(), getCurrentProfile()]).then(
      ([folders, staff, profile]) => {
        setData({
          folders,
          allStaff: staff as Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[],
          role: profile?.role ?? 'fc',
          userId: profile?.id,
        })
      }
    )
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
          <Link href="/ot/recover" className="text-xs text-orange-600 hover:text-orange-700 underline">
            OT 세션 복구
          </Link>
        </div>
      )}
      <TrainerFolderGrid
        folders={data.folders}
        allStaff={data.allStaff}
        currentUserRole={data.role}
        currentUserId={data.userId}
      />
    </>
  )
}
