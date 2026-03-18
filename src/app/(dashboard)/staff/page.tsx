import { getStaffList } from '@/actions/staff'
import { getCurrentProfile } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { StaffView } from '@/components/staff/staff-view'

export default async function StaffPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') redirect('/ot')

  const staffList = await getStaffList()

  return <StaffView staffList={staffList} />
}
