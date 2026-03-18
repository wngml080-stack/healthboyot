'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, BarChart3 } from 'lucide-react'

interface Props {
  trainerId: string
}

const TABS = [
  { key: 'members', label: '회원관리', icon: Users },
  { key: 'schedule', label: '스케줄', icon: CalendarDays },
  { key: 'stats', label: '통계표', icon: BarChart3 },
]

export function TrainerSubNav({ trainerId }: Props) {
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') ?? 'members'

  return (
    <nav className="w-44 shrink-0 space-y-1">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = currentTab === tab.key
        const params = new URLSearchParams()
        params.set('trainer', trainerId)
        params.set('tab', tab.key)

        return (
          <Link
            key={tab.key}
            href={`/ot?${params.toString()}`}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-yellow-400 text-black shadow-sm'
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
