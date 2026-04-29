'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getTrainerFoldersAll } from '@/actions/trainer-folders'
import { TrainerFolderGrid } from '@/components/ot/trainer-folder-grid'
import type { TrainerFolder } from '@/actions/trainer-folders'
import type { Profile } from '@/types'
import Link from 'next/link'

// 메모리 캐시 — 재방문 시 즉시 표시
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
    if (data && Date.now() - (folderCache?.timestamp ?? 0) < 30000) return

    // 서버 액션 1회로 폴더+스태프+프로필 모두 로딩 (이전: 3회)
    getTrainerFoldersAll().then((result) => {
      const cached = {
        ...result,
        allStaff: result.allStaff as Pick<Profile, 'id' | 'name' | 'role' | 'is_approved'>[],
        timestamp: Date.now(),
      }
      folderCache = cached
      setData(cached)
    })
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
