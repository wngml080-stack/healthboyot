import { PageTitle } from '@/components/shared/page-title'
import { StatsLoader } from './loader'

export default async function StatsPage() {
  return (
    <div className="space-y-4">
      <PageTitle>통계</PageTitle>
      <StatsLoader />
    </div>
  )
}
