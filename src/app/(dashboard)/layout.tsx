import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/actions/auth'
import { TopNav } from '@/components/layout/top-nav'
import { RealtimeWrapper } from '@/components/ot/realtime-wrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav profile={profile} />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <RealtimeWrapper>{children}</RealtimeWrapper>
        </div>
      </main>
    </div>
  )
}
