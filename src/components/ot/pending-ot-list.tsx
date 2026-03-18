'use client'

import { useState } from 'react'
import { OtCategoryBadge } from './ot-category-badge'
import { OtStatusBadge } from './ot-status-badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
}

export function PendingOtList({ assignments }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {assignments.map((a) => {
        const isExpanded = expandedId === a.id
        return (
          <div key={a.id} className="rounded-md border border-gray-200 overflow-hidden">
            {/* 요약 행 */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : a.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">{a.member.name}</p>
                  <OtCategoryBadge category={a.member.ot_category ?? a.ot_category} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  {a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <OtStatusBadge status={a.status} />
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* 상세 정보 */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-2 text-sm">
                <DetailRow label="등록일" value={a.member.registered_at} />
                <DetailRow label="운동시간" value={a.member.exercise_time} />
                <DetailRow label="운동기간" value={a.member.duration_months ? `${a.member.duration_months}개월` : null} />
                <DetailRow label="종목" value={a.member.ot_category} />
                <DetailRow label="상세정보" value={a.member.detail_info} />
                <DetailRow label="특이사항" value={a.member.notes} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex">
      <span className="text-gray-500 w-20 shrink-0">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}
