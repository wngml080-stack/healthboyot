import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { MemberList } from '@/components/members/member-list'

interface Props {
  searchParams: Promise<{ search?: string }>
}

export default async function MembersPage({ searchParams }: Props) {
  const params = await searchParams
  const [members, staffList] = await Promise.all([
    getMembers({ search: params.search }),
    getStaffList(),
  ])
  const trainers = staffList
    .filter((s) => !['admin'].includes(s.role))
    .map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="space-y-4">
      <MemberList initialMembers={members} trainers={trainers} />
    </div>
  )
}
