import { Suspense } from 'react'
import { getMembers } from '@/actions/members'
import { getStaffList } from '@/actions/staff'
import { MemberList } from '@/components/members/member-list'
import { PageTitle } from '@/components/shared/page-title'
import { Loader2 } from 'lucide-react'

interface Props {
  searchParams: Promise<{ search?: string }>
}

export default async function MembersPage({ searchParams }: Props) {
  const params = await searchParams

  return (
    <div className="space-y-4">
      <PageTitle>회원 관리</PageTitle>
      <Suspense fallback={<DataSkeleton />}>
        <MembersData search={params.search} />
      </Suspense>
    </div>
  )
}

async function MembersData({ search }: { search?: string }) {
  const [members, staffList] = await Promise.all([
    getMembers({ search }),
    getStaffList(),
  ])
  const trainers = staffList
    .filter((s) => !['admin'].includes(s.role))
    .map((s) => ({ id: s.id, name: s.name }))

  return <MemberList initialMembers={members} trainers={trainers} />
}

function DataSkeleton() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">회원 목록을 불러오는 중...</span>
    </div>
  )
}
