import { getMembers } from '@/actions/members'
import { MemberList } from '@/components/members/member-list'

interface Props {
  searchParams: Promise<{ search?: string }>
}

export default async function MembersPage({ searchParams }: Props) {
  const params = await searchParams
  const members = await getMembers({ search: params.search })

  return (
    <div className="space-y-4">
      <MemberList initialMembers={members} />
    </div>
  )
}
