import { getStats } from '@/actions/stats'
import { getSalesTarget } from '@/actions/sales-target'
import { StatsView } from '@/components/stats/stats-view'

export default async function StatsPage() {
  const now = new Date()
  const [stats, target] = await Promise.all([
    getStats(),
    getSalesTarget(now.getFullYear(), now.getMonth() + 1),
  ])

  return <StatsView stats={stats} target={target} />
}
