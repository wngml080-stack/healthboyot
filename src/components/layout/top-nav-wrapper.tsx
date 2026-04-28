'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { TopNav } from './top-nav'
import type { Profile } from '@/types'

// 프로필 캐시 — 메뉴 이동 시 재요청 방지
let profileCache: { profile: Profile; ts: number } | null = null

export function TopNavWrapper() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(
    profileCache && Date.now() - profileCache.ts < 300000 ? profileCache.profile : null
  )

  useEffect(() => {
    if (profile) return
    getCurrentProfile().then((p) => {
      if (!p) {
        router.replace('/login')
        return
      }
      profileCache = { profile: p, ts: Date.now() }
      setProfile(p)
    })
  }, [router, profile])

  if (!profile) {
    return <div className="h-[60px] bg-black border-b border-gray-800" />
  }

  return <TopNav profile={profile} />
}
