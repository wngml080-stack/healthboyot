'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OtCategoryBadge } from './ot-category-badge'
import { ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateOtAssignment } from '@/actions/ot'
import type { OtAssignmentWithDetails, Profile } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainers?: Pick<Profile, 'id' | 'name'>[]
}

export function PendingOtList({ assignments, trainers = [] }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedPtTrainer, setSelectedPtTrainer] = useState('')
  const [selectedPptTrainer, setSelectedPptTrainer] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAssign = async (assignmentId: string) => {
    if (!selectedPtTrainer && !selectedPptTrainer) return
    setLoading(true)
    const isSpecial = (v: string) => v === 'later' || v === 'urgent'
    const updates: Record<string, string | null> = {
      status: '배정완료',
    }
    if (selectedPtTrainer) {
      updates.pt_trainer_id = isSpecial(selectedPtTrainer) ? null : selectedPtTrainer
      updates.pt_assign_status = isSpecial(selectedPtTrainer) ? selectedPtTrainer : 'assigned'
    }
    if (selectedPptTrainer) {
      updates.ppt_trainer_id = isSpecial(selectedPptTrainer) ? null : selectedPptTrainer
      updates.ppt_assign_status = isSpecial(selectedPptTrainer) ? selectedPptTrainer : 'assigned'
    }
    await updateOtAssignment(assignmentId, updates)
    setAssigningId(null)
    setSelectedPtTrainer('')
    setSelectedPptTrainer('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {assignments.map((a) => {
        const isExpanded = expandedId === a.id
        const isAssigning = assigningId === a.id

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
                  {a.member.registration_source === '수기' && (
                    <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300">수기</span>
                  )}
                  <OtCategoryBadge category={a.member.ot_category ?? a.ot_category} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  {a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </button>

            {/* 상세 + 빠른 배정 */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-3">
                <div className="space-y-1.5 text-sm">
                  <DetailRow label="등록일" value={a.member.registered_at} />
                  <DetailRow label="운동시간" value={a.member.exercise_time} />
                  <DetailRow label="운동기간" value={a.member.duration_months ? String(a.member.duration_months) : null} />
                  <DetailRow label="종목" value={a.member.ot_category} />
                  <DetailRow label="상세정보" value={a.member.detail_info} />
                  <DetailRow label="특이사항" value={a.member.notes} />
                </div>

                {/* 빠른 배정 */}
                {!isAssigning ? (
                  <Button
                    size="sm"
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
                    onClick={(e) => { e.stopPropagation(); setAssigningId(a.id) }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    트레이너 배정
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 w-10 shrink-0">PT</span>
                      <Select value={selectedPtTrainer} onValueChange={setSelectedPtTrainer}>
                        <SelectTrigger className="flex-1 h-8 text-sm bg-white text-gray-900 border-gray-300">
                          <SelectValue placeholder="PT 담당 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="later">추후배정</SelectItem>
                          <SelectItem value="urgent">긴급요청</SelectItem>
                          {trainers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-purple-600 w-10 shrink-0">PPT</span>
                      <Select value={selectedPptTrainer} onValueChange={setSelectedPptTrainer}>
                        <SelectTrigger className="flex-1 h-8 text-sm bg-white text-gray-900 border-gray-300">
                          <SelectValue placeholder="PPT 담당 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="later">추후배정</SelectItem>
                          <SelectItem value="urgent">긴급요청</SelectItem>
                          {trainers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 h-8"
                        onClick={() => handleAssign(a.id)}
                        disabled={loading || (!selectedPtTrainer && !selectedPptTrainer)}
                      >
                        {loading ? '배정 중...' : '배정'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 bg-gray-100 text-gray-700"
                        onClick={() => setAssigningId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                )}
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
