import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { ScheduleOverview } from '@/components/schedule/schedule-overview'

export default async function SchedulesPage() {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/login')

  // 관리자/admin만 접근 가능
  if (!['admin', '관리자'].includes(profile.role)) {
    redirect('/ot')
  }

  return <ScheduleOverview />
}
