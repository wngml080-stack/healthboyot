import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { RecoverPanel } from '@/components/ot/recover-panel'
import { PageTitle } from '@/components/shared/page-title'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function OtRecoverPage() {
  const profile = await getCurrentProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== '관리자')) {
    redirect('/ot')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/ot" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          OT 관리로
        </Link>
        <PageTitle>OT 세션 복구</PageTitle>
      </div>
      <RecoverPanel />
    </div>
  )
}
