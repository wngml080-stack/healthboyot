import { TopNavWrapper } from '@/components/layout/top-nav-wrapper'
import { RealtimeWrapper } from '@/components/ot/realtime-wrapper'


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNavWrapper />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <RealtimeWrapper>{children}</RealtimeWrapper>
        </div>
      </main>
    </div>
  )
}
