'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OtCategoryBadge } from './ot-category-badge'
import { ChevronDown, ChevronUp, UserPlus, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateOtAssignment } from '@/actions/ot'
import { getExerciseStartDatesByMemberIds, getConsultationCard } from '@/actions/consultation'
import type { OtAssignmentWithDetails, Profile, ConsultationCard } from '@/types'

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
  const [startDates, setStartDates] = useState<Record<string, string | null>>({})
  const [cardCache, setCardCache] = useState<Record<string, ConsultationCard | null>>({})
  const [cardLoading, setCardLoading] = useState<Record<string, boolean>>({})

  // 각 회원의 상담카드에서 운동 시작일 배치 조회 (N+1 제거)
  useEffect(() => {
    const missing = Array.from(
      new Set(assignments.map((a) => a.member_id).filter((id) => startDates[id] === undefined))
    )
    if (!missing.length) return
    let cancelled = false
    getExerciseStartDatesByMemberIds(missing).then((map) => {
      if (cancelled) return
      setStartDates((prev) => {
        const next = { ...prev }
        for (const id of missing) next[id] = map[id] ?? null
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [assignments]) // eslint-disable-line react-hooks/exhaustive-deps

  // 펼침 시 상담카드 로딩
  useEffect(() => {
    if (!expandedId) return
    const memberId = assignments.find((a) => a.id === expandedId)?.member_id
    if (!memberId || memberId in cardCache) return
    setCardLoading((prev) => ({ ...prev, [memberId]: true }))
    getConsultationCard(memberId).then((card) => {
      setCardCache((prev) => ({ ...prev, [memberId]: card }))
      setCardLoading((prev) => ({ ...prev, [memberId]: false }))
      // 상담카드에 운동시작일이 있으면 startDates도 업데이트
      if (card?.exercise_start_date) {
        setStartDates((prev) => ({ ...prev, [memberId]: card.exercise_start_date }))
      }
    })
  }, [expandedId, assignments, cardCache])

  const handleAssign = async (assignmentId: string) => {
    if (!selectedPtTrainer && !selectedPptTrainer) return
    setLoading(true)
    const isSpecial = (v: string) => v === 'later' || v === 'urgent' || v === 'not_requested'
    const ptIsReal = selectedPtTrainer && !isSpecial(selectedPtTrainer)
    const pptIsReal = selectedPptTrainer && !isSpecial(selectedPptTrainer)
    const updates: import('@/actions/ot').UpdateOtAssignmentValues = {
      status: (ptIsReal || pptIsReal) ? '배정완료' : '신청대기',
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
          <div key={a.id} className="rounded-lg border border-gray-200 overflow-hidden">
            {/* 요약 행 */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : a.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">{a.member.name}</p>
                  {a.member.registration_source === '수기' && (
                    <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">수기</span>
                  )}
                  <OtCategoryBadge category={a.member.ot_category ?? a.ot_category} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  {a.member.phone ? a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}
                  {a.member.registered_at && (
                    <span className="ml-2 text-gray-400">· 등록 {a.member.registered_at > '1900-01-01' ? new Date(a.member.registered_at).toLocaleDateString('ko', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\.\s*$/, '') : '미상'}</span>
                  )}
                  {startDates[a.member_id] !== undefined && (
                    <span className={`ml-2 font-medium ${startDates[a.member_id] ? 'text-yellow-600' : 'text-gray-400'}`}>
                      · 시작 {startDates[a.member_id] ? new Date(startDates[a.member_id]! + 'T00:00:00').toLocaleDateString('ko', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\.\s*$/, '') : '미기재'}
                    </span>
                  )}
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
                  {startDates[a.member_id] && (
                    <div className="flex">
                      <span className="text-gray-500 w-20 shrink-0">운동시작일</span>
                      <span className="text-yellow-600 font-semibold flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(startDates[a.member_id]! + 'T00:00:00').toLocaleDateString('ko')}
                      </span>
                    </div>
                  )}
                  <DetailRow label="운동기간" value={a.member.duration_months ? String(a.member.duration_months) : null} />
                  <DetailRow label="종목" value={a.member.ot_category} />
                  <DetailRow label="상세정보" value={a.member.detail_info} />
                  <DetailRow label="특이사항" value={a.member.notes} />
                </div>

                {/* 상담카드 요약 */}
                {cardLoading[a.member_id] ? (
                  <div className="text-xs text-gray-400">상담카드 로딩 중...</div>
                ) : cardCache[a.member_id] && (() => {
                  const card = cardCache[a.member_id]!
                  const hasContent = card.exercise_goals?.length || card.medical_conditions?.length || card.exercise_experiences?.length || card.desired_body_type || card.body_correction_area || card.exercise_duration || card.age || card.occupation
                  if (!hasContent) return null
                  return (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-1.5">상담카드 요약</p>
                      <div className="space-y-1 text-sm">
                        {card.exercise_goals?.length > 0 && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">운동목표</span>
                            <span className="text-gray-900">{card.exercise_goals.join(', ')}{card.exercise_goal_detail ? ` (${card.exercise_goal_detail})` : ''}</span>
                          </div>
                        )}
                        {card.body_correction_area && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">교정부위</span>
                            <span className="text-gray-900">{card.body_correction_area}</span>
                          </div>
                        )}
                        {card.desired_body_type && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">원하는체형</span>
                            <span className="text-gray-900">{card.desired_body_type}</span>
                          </div>
                        )}
                        {card.exercise_experiences?.length > 0 && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">운동경력</span>
                            <span className="text-gray-900">{card.exercise_experiences.join(', ')}{card.exercise_duration ? ` · ${card.exercise_duration}` : ''}</span>
                          </div>
                        )}
                        {card.medical_conditions?.length > 0 && card.medical_conditions[0] !== '없음' && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">질환</span>
                            <span className="text-gray-900">{card.medical_conditions.join(', ')}{card.medical_detail ? ` (${card.medical_detail})` : ''}</span>
                          </div>
                        )}
                        {card.surgery_history && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">수술이력</span>
                            <span className="text-gray-900">{card.surgery_history}{card.surgery_detail ? ` (${card.surgery_detail})` : ''}</span>
                          </div>
                        )}
                        {(card.age || card.occupation) && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">{card.age && card.occupation ? '나이/직업' : card.age ? '나이' : '직업'}</span>
                            <span className="text-gray-900">{[card.age, card.occupation].filter(Boolean).join(' / ')}</span>
                          </div>
                        )}
                        {card.exercise_personality?.length > 0 && (
                          <div className="flex">
                            <span className="text-gray-500 w-20 shrink-0">운동성향</span>
                            <span className="text-gray-900">{card.exercise_personality.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

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
                          <SelectItem value="not_requested">미신청</SelectItem>
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
                          <SelectItem value="not_requested">미신청</SelectItem>
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
