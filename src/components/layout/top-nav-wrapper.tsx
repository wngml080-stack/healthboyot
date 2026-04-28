'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { TopNav } from './top-nav'
import type { Profile } from '@/types'

export function TopNavWrapper() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (!p) {
        router.replace('/login')
        return
      }
      setProfile(p)
    })
  }, [router])

  if (!profile) {
    // 네비게이션 바 스켈레톤 — 높이만 확보
    return <div className="h-[60px] bg-black border-b border-gray-800" />
  }

  return <TopNav profile={profile} />
}
