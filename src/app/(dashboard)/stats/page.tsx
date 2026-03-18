import { getStats } from '@/actions/stats'
import { StatsView } from '@/components/stats/stats-view'

export default async function StatsPage() {
  const stats = await getStats()
  return <StatsView stats={stats} />
}
