'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { TopNav } from './top-nav'
import type { Profile } from '@/types'

// 프로필 캐시 — 메뉴 이동 시 재요청 방지 (클라이언트 전용, 마운트 후에만 사용)
let profileCache: { profile: Profile; ts: number } | null = null

export function TopNavWrapper() {
  const router = useRouter()
  // SSR/CSR 일치를 위해 항상 null로 시작 — 캐시는 useEffect에서만 적용
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    // 마운트 후 캐시 확인 (Date.now()는 클라이언트 시각이므로 SSR mismatch 없음)
    if (profileCache && Date.now() - profileCache.ts < 300000) {
      setProfile(profileCache.profile)
      return
    }
    getCurrentProfile()
      .then((p) => {
        if (!p) {
          router.replace('/login')
          return
        }
        profileCache = { profile: p, ts: Date.now() }
        setProfile(p)
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [router])

  if (!profile) {
    return <div className="h-[60px] bg-black border-b border-gray-800" />
  }

  return <TopNav profile={profile} />
}
