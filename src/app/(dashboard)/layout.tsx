import { TopNavWrapper } from '@/components/layout/top-nav-wrapper'
import { RealtimeWrapper } from '@/components/ot/realtime-wrapper'

// Edge Runtime: cold start 200ms → ~5ms, 서울 엣지에서 실행
export const runtime = 'edge'

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
