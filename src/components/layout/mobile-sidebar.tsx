'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, LayoutDashboard, ClipboardList, Users, BarChart3, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { signOut } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import type { Profile } from '@/types'

const iconMap = {
  LayoutDashboard,
  ClipboardList,
  Users,
  BarChart3,
} as const

interface Props {
  profile: Profile
}

export function MobileSidebar({ profile }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(profile.role)
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <div className="flex h-14 items-center px-4 font-bold text-lg">
          당산점 OT
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {filteredItems.map((item) => {
            const Icon = iconMap[item.icon]
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
        <div className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {profile.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
            </div>
            <form action={signOut}>
              <Button variant="ghost" size="icon" className="h-8 w-8" type="submit">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
