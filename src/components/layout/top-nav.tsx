'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogOut, Menu, X, User } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { NAV_ITEMS, MENU_ACCESS } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Profile } from '@/types'

interface Props {
  profile: Profile
}

export function TopNav({ profile }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showNoAccess, setShowNoAccess] = useState(false)

  const handleMenuClick = (href: string, e: React.MouseEvent) => {
    const allowedRoles = MENU_ACCESS[href]
    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      e.preventDefault()
      setShowNoAccess(true)
    }
  }

  return (
    <>
      <nav className="bg-black text-white">
        <div className="h-1 bg-yellow-500" />

        <div className="flex items-center justify-between px-6 h-14">
          <Link href="/ot" className="text-lg font-black tracking-wider italic">
            HEALTHBOYGYM
          </Link>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              const hasAccess = MENU_ACCESS[item.href]?.includes(profile.role) ?? true
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleMenuClick(item.href, e)}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-yellow-400'
                      : hasAccess
                        ? 'text-gray-300 hover:text-yellow-400'
                        : 'text-gray-500 hover:text-gray-400'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          {/* 유저 + 로그아웃 */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <User className="h-4 w-4" />
              <span>{profile.name}</span>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/10 h-8 px-2">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            className="md:hidden text-gray-300"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 px-6 py-3 space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    handleMenuClick(item.href, e)
                    setMobileOpen(false)
                  }}
                  className={cn(
                    'block py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-yellow-400' : 'text-gray-300'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-gray-400">{profile.name}</span>
              <form action={signOut}>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8 px-2">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </nav>

      {/* 권한 없음 팝업 */}
      <Dialog open={showNoAccess} onOpenChange={setShowNoAccess}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>접근 권한 없음</DialogTitle>
            <DialogDescription>해당 메뉴에 대한 권한이 없습니다.</DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowNoAccess(false)} className="mx-auto">
            확인
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
