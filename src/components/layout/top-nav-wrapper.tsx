'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TopNav } from './top-nav'
import type { Profile } from '@/types'

export function TopNavWrapper() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    // 브라우저 → Supabase 직접 호출 (서버 경유 없음)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.replace('/login')
        return
      }
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => {
          if (data) setProfile(data as Profile)
          else router.replace('/login')
        })
    })
  }, [router])

  if (!profile) {
    return <div className="h-[60px] bg-black border-b border-gray-800" />
  }

  return <TopNav profile={profile} />
}
