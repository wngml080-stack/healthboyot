'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getStats } from '@/actions/stats'
import { getSalesTarget } from '@/actions/sales-target'
import { getAdminDashboard } from '@/actions/admin-dashboard'
import { getCurrentProfile } from '@/actions/auth'
import { StatsView } from '@/components/stats/stats-view'
import { AdminDashboard } from '@/components/stats/admin-dashboard'
import type { StatsData } from '@/actions/stats'
import type { SalesTarget } from '@/actions/sales-target'
import type { AdminDashboardData } from '@/actions/admin-dashboard'

export function StatsLoader() {
  const [data, setData] = useState<{
    stats: StatsData
    target: SalesTarget | null
    dashboard: AdminDashboardData
    isAdmin: boolean
  } | null>(null)

  useEffect(() => {
    const now = new Date()
    Promise.all([
      getStats('monthly', 0),
      getSalesTarget(now.getFullYear(), now.getMonth() + 1),
      getAdminDashboard('monthly'),
      getCurrentProfile(),
    ]).then(([stats, target, dashboard, profile]) => {
      setData({
        stats,
        target,
        dashboard,
        isAdmin: !!profile && ['admin', '관리자'].includes(profile.role),
      })
    })
  }, [])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">통계를 불러오는 중...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {data.isAdmin && <AdminDashboard data={data.dashboard} initialPeriod="monthly" />}
      <StatsView stats={data.stats} target={data.target} />
    </div>
  )
}
