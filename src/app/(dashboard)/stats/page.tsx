import { Suspense } from 'react'
import { getStats } from '@/actions/stats'
import { getSalesTarget } from '@/actions/sales-target'
import { getAdminDashboard } from '@/actions/admin-dashboard'
import { getCurrentProfile } from '@/actions/auth'
import { StatsView } from '@/components/stats/stats-view'
import { AdminDashboard } from '@/components/stats/admin-dashboard'
import { PageTitle } from '@/components/shared/page-title'
import { Loader2 } from 'lucide-react'

export default async function StatsPage() {
  return (
    <div className="space-y-4">
      <PageTitle>통계</PageTitle>
      <Suspense fallback={<DataSkeleton />}>
        <StatsContent />
      </Suspense>
    </div>
  )
}

async function StatsContent() {
  const now = new Date()
  const [stats, target, dashboard, profile] = await Promise.all([
    getStats('monthly', 0),
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

function DataSkeleton() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">통계를 불러오는 중...</span>
    </div>
  )
}
