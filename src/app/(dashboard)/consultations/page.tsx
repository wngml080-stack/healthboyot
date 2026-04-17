import { getCurrentProfile } from '@/actions/auth'
import { getAllCards } from '@/actions/consultation'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { PageTitle } from '@/components/shared/page-title'
import { ConsultationList } from '@/components/consultations/consultation-list'
import { redirect } from 'next/navigation'

export default async function ConsultationsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [cards, membersData, staff] = await Promise.all([
    getAllCards(),
    getMembers(),
    getStaffList(),
  ])

  const staffList = staff.map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="space-y-4">
      <PageTitle>상담카드 관리</PageTitle>
      <ConsultationList cards={cards} members={membersData} staffList={staffList} />
    </div>
  )
}
