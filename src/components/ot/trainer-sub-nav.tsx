'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Users, CalendarDays, BarChart3, Loader2 } from 'lucide-react'

interface Props {
  trainerId: string
}

const TABS = [
  { key: 'schedule', label: '스케줄', icon: CalendarDays },
  { key: 'members', label: 'OT회원', icon: Users },
  { key: 'stats', label: '통계표', icon: BarChart3 },
]

export function TrainerSubNav({ trainerId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') ?? 'schedule'
  const [isPending, startTransition] = useTransition()
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null)

  useEffect(() => {
    setOptimisticTab(null)
  }, [currentTab])

  const visibleTab = optimisticTab ?? currentTab

  return (
    <nav className="w-full lg:w-44 lg:shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = visibleTab === tab.key
        const isLoadingThis = isPending && optimisticTab === tab.key
        const params = new URLSearchParams()
        params.set('trainer', trainerId)
        params.set('tab', tab.key)
        const href = `/ot?${params.toString()}`

        return (
          <Link
            key={tab.key}
            href={href}
            prefetch
            scroll={false}
            onClick={(e) => {
              if (tab.key === currentTab) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              setOptimisticTab(tab.key)
              startTransition(() => {
                router.push(href, { scroll: false })
              })
            }}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 md:py-2.5 text-sm font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-yellow-400 text-black shadow-sm'
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
            )}
          >
            {isLoadingThis ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
