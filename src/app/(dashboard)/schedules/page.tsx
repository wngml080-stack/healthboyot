import { PageTitle } from '@/components/shared/page-title'
import { ScheduleOverview } from '@/components/schedule/schedule-overview'

export const runtime = 'edge'

export default function SchedulesPage() {
  return (
    <div className="space-y-4">
      <PageTitle>스케줄 총괄</PageTitle>
      <ScheduleOverview />
    </div>
  )
}
