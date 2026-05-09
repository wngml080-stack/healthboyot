'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { MemberTimeline } from './member-timeline'
import type { OtAssignmentWithDetails, Profile } from '@/types'

interface Props {
  assignment: OtAssignmentWithDetails
  profile: Profile
}

export function OtDetailView({ assignment }: Props) {
  const router = useRouter()

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          OT회원으로 돌아가기
        </button>
        <h2 className="text-lg font-bold text-gray-900">{assignment.member.name} · 로그기록</h2>
      </div>

      <MemberTimeline assignment={assignment} />
    </div>
  )
}
