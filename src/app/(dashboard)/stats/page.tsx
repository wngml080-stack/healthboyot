import { Suspense } from 'react'
import { getStats } from '@/actions/stats'
import { getSalesTarget } from '@/actions/sales-target'
import { getAdminDashboard } from '@/actions/admin-dashboard'
import { getCurrentProfile } from '@/actions/auth'
import { StatsView } from '@/components/stats/stats-view'
import { AdminDashboard } from '@/components/stats/admin-dashboard'

export default async function StatsPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-gray-500">통계 로드 중...</div>}>
      <StatsContent />
    </Suspense>
  )
}

async function StatsContent() {
  const now = new Date()
  const [stats, target, dashboard, profile] = await Promise.all([
    getStats(),
    getSalesTarget(now.getFullYear(), now.getMonth() + 1),
    getAdminDashboard('monthly'),
    getCurrentProfile(),
  ])

  const isAdmin = profile && ['admin', '관리자'].includes(profile.role)

  return (
    <div className="space-y-8">
      {isAdmin && <AdminDashboard data={dashboard} initialPeriod="monthly" />}
      <StatsView stats={stats} target={target} />
    </div>
  )
}
