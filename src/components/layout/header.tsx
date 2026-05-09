'use client'

import { usePathname } from 'next/navigation'
import { MobileSidebar } from './mobile-sidebar'
import type { Profile } from '@/types'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'OT회원',
  '/ot': '트레이너 관리',
  '/members': '회원 관리',
  '/staff': '직원 관리',
  '/stats': '통계·보고서',
}

interface HeaderProps {
  profile?: Profile | null
}

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname()

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1] ?? ''

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-white px-4 md:px-6">
      {profile && <MobileSidebar profile={profile} />}
      {title && (
        <h1 className="flex items-center gap-2 text-xl font-bold text-white">
          <span className="w-1 h-6 bg-yellow-500 rounded-sm" />
          {title}
        </h1>
      )}
    </header>
  )
}
