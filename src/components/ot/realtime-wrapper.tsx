'use client'

import { useRealtimeOT } from '@/hooks/use-realtime-ot'
import { isDemoMode } from '@/lib/demo'

export function RealtimeWrapper({ children }: { children: React.ReactNode }) {
  // 데모 모드에서는 Realtime 비활성화
  if (!isDemoMode()) {
    return <RealtimeEnabled>{children}</RealtimeEnabled>
  }
  return <>{children}</>
}

function RealtimeEnabled({ children }: { children: React.ReactNode }) {
  useRealtimeOT()
  return <>{children}</>
}
