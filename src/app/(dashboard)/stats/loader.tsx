'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getStatsAll } from '@/actions/stats-all'
import { StatsView } from '@/components/stats/stats-view'
import { AdminDashboard } from '@/components/stats/admin-dashboard'
import type { StatsAllResult } from '@/actions/stats-all'

export function StatsLoader() {
  const [data, setData] = useState<StatsAllResult | null>(null)

  useEffect(() => {
    getStatsAll('monthly', 0)
      .then(setData)
      .catch((err) => console.error('[StatsLoader] 로딩 실패:', err))
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
