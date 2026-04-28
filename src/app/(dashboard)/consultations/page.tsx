import { getCurrentProfile } from '@/actions/auth'
import { PageTitle } from '@/components/shared/page-title'
import { redirect } from 'next/navigation'
import { ConsultationsLoader } from './loader'

export default async function ConsultationsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="space-y-4">
      <PageTitle>상담카드 관리</PageTitle>
      <ConsultationsLoader />
    </div>
  )
}
