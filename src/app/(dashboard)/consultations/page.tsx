import { Suspense } from 'react'
import { getCurrentProfile } from '@/actions/auth'
import { getAllCards } from '@/actions/consultation'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { PageTitle } from '@/components/shared/page-title'
import { ConsultationList } from '@/components/consultations/consultation-list'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default async function ConsultationsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="space-y-4">
      <PageTitle>상담카드 관리</PageTitle>
      <Suspense fallback={<DataSkeleton />}>
        <ConsultationsData />
      </Suspense>
    </div>
  )
}

async function ConsultationsData() {
  const [cards, membersData, staff] = await Promise.all([
    getAllCards(),
    getMembers(),
    getStaffList(),
  ])
  const staffList = staff.map((s) => ({ id: s.id, name: s.name }))

  return <ConsultationList cards={cards} members={membersData} staffList={staffList} />
}

function DataSkeleton() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">상담카드를 불러오는 중...</span>
    </div>
  )
}
