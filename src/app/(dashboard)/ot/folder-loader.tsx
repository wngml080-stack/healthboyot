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

// 메모리 캐시 — 같은 세션 내 재방문 시 즉시 표시
let folderCache: {
  folders: TrainerFolder[]
  allStaff: Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[]
  role: string
  userId?: string
  timestamp: number
} | null = null

export function FolderLoader() {
  const [data, setData] = useState(folderCache && Date.now() - folderCache.timestamp < 60000 ? folderCache : null)

  useEffect(() => {
    // 캐시가 1분 이내면 백그라운드 갱신만
    const isFresh = data && Date.now() - (folderCache?.timestamp ?? 0) < 30000
    if (isFresh) return

    Promise.all([getTrainerFolders(), getStaffList(), getCurrentProfile()]).then(
      ([folders, staff, profile]) => {
        const result = {
          folders,
          allStaff: staff as Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[],
          role: profile?.role ?? 'fc',
          userId: profile?.id,
          timestamp: Date.now(),
        }
        folderCache = result
        setData(result)
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
