'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Users, BarChart3, FileText, CheckSquare, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import type { Profile } from '@/types'

const iconMap = {
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
  FileText,
  CheckSquare,
} as const

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(profile.role)
  )

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-white">
      {/* 로고 */}
      <div className="flex h-14 items-center px-4 font-bold text-lg">
        🏋️ 당산점 OT
      </div>

      <Separator />

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 p-2">
        {filteredItems.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Separator />

      {/* 유저 정보 */}
      <div className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {profile.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.name}</p>
            <p className="text-xs text-muted-foreground">
              {profile.role === 'admin' ? '관리자' : profile.role === 'trainer' ? '트레이너' : 'FC'}
            </p>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="icon" className="h-8 w-8" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  )
}
