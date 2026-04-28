import { PageTitle } from '@/components/shared/page-title'
import { ConsultationsLoader } from './loader'

export default function ConsultationsPage() {
  return (
    <div className="space-y-4">
      <PageTitle>상담카드 관리</PageTitle>
      <ConsultationsLoader />
    </div>
  )
}
