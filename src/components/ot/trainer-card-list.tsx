'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CheckCircle, User, AlertTriangle, BarChart3, CalendarDays, Pencil, Plus, Undo2, UserPlus } from 'lucide-react'
import { upsertOtSession, updateOtAssignment } from '@/actions/ot'
import { quickRegisterMember } from '@/actions/members'
import type { OtAssignmentWithDetails, SalesStatus, Profile } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainers?: Pick<Profile, 'id' | 'name'>[]
  trainerId?: string
}

const SALES_STATUSES: { value: SalesStatus; label: string; color: string }[] = [
  { value: 'OT진행중', label: '진행중', color: 'bg-green-100 text-green-700' },
  { value: 'OT거부자', label: '거부자', color: 'bg-orange-100 text-orange-700' },
  { value: '등록완료', label: '등록완료', color: 'bg-blue-100 text-blue-700' },
  { value: '스케줄미확정', label: '스케줄미확정', color: 'bg-yellow-100 text-yellow-700' },
  { value: '연락두절', label: '연락두절', color: 'bg-gray-100 text-gray-700' },
  { value: '클로징실패', label: '클로징실패', color: 'bg-red-100 text-red-700' },
]
const PROBABILITY_OPTIONS = [20, 40, 60, 80, 100]

const getSalesColor = (status: string) =>
  SALES_STATUSES.find((s) => s.value === status)?.color ?? 'bg-gray-100 text-gray-700'

const TIME_SLOTS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
const CARDIO_OPTIONS = ['러닝머신', '싸이클', '스텝퍼']
const CARDIO_DURATIONS = [10, 15, 20, 30]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TrainerCardList({ assignments, trainers = [], trainerId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const today = new Date().toISOString().split('T')[0]

  // 필터
  const [filter, setFilter] = useState<string>('전체')
  const FILTERS = ['전체', '1차', '2차', '3차', '거부', '연락두절', '스케줄미확정', '클로징실패', '등록완료', '매출대상', 'PT전환']

  // 펼침
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 완료 바텀시트
  const [completeTarget, setCompleteTarget] = useState<{
    assignment: OtAssignmentWithDetails
    sessionNumber: number
  } | null>(null)
  const [exercises, setExercises] = useState<{ name: string; sets: number; reps: number }[]>([{ name: '', sets: 3, reps: 12 }])
  const [trainerTip, setTrainerTip] = useState('')
  const [cardioType, setCardioType] = useState<string[]>([])
  const [cardioDuration, setCardioDuration] = useState<number | null>(null)
  const [nextDate, setNextDate] = useState('')
  const [nextTime, setNextTime] = useState('')
  const [completeLoading, setCompleteLoading] = useState(false)
  const [completeResult, setCompleteResult] = useState<string>('')
  const [completeFailReason, setCompleteFailReason] = useState('')

  // 인라인 스케줄 편집
  const [scheduleEdit, setScheduleEdit] = useState<{ assignmentId: string; sessionNumber: number; date: string; time: string; feedback?: string } | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  // 완료된 세션 수정 모드
  const [editingCompletedSession, setEditingCompletedSession] = useState<{ assignmentId: string; sessionNumber: number } | null>(null)

  // 회원 추가
  const [showAddMember, setShowAddMember] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addAssignDate, setAddAssignDate] = useState('')
  const [addDateUnknown, setAddDateUnknown] = useState(false)
  const [addCategory, setAddCategory] = useState('')
  const [addTrainingType, setAddTrainingType] = useState('')
  const [addDuration, setAddDuration] = useState('')
  const [addExerciseTime, setAddExerciseTime] = useState('')
  const [addExerciseGoal, setAddExerciseGoal] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // 회원 퀵뷰
  const [quickViewTarget, setQuickViewTarget] = useState<OtAssignmentWithDetails | null>(null)

  // 세일즈 편집
  const [salesTarget, setSalesTarget] = useState<OtAssignmentWithDetails | null>(null)
  const [salesStatus, setSalesStatus] = useState<SalesStatus>('OT진행중')
  const [expectedAmount, setExpectedAmount] = useState(0)
  const [expectedSessions, setExpectedSessions] = useState(0)
  const [closingProb, setClosingProb] = useState(0)
  const [failReason, setFailReason] = useState('')
  const [salesNote, setSalesNote] = useState('')
  const [salesLoading, setSalesLoading] = useState(false)
  const [isSalesTarget, setIsSalesTarget] = useState(false)
  const [isPtConversion, setIsPtConversion] = useState(false)
  const [ptSalesAmount, setPtSalesAmount] = useState(0)
  const [ptSalesCount, setPtSalesCount] = useState(0)

  const openSalesEdit = (a: OtAssignmentWithDetails) => {
    setSalesTarget(a)
    setSalesStatus((a.sales_status as SalesStatus) || 'OT진행중')
    setExpectedAmount(a.expected_amount || 0)
    setExpectedSessions(a.expected_sessions || 0)
    setClosingProb(a.closing_probability || 0)
    setFailReason(a.closing_fail_reason || '')
    setSalesNote(a.sales_note || '')
    setPtSalesAmount(a.actual_sales ?? 0)
    setPtSalesCount(0)
    setIsSalesTarget(a.is_sales_target || false)
    setIsPtConversion(a.is_pt_conversion || false)
  }

  const handleSalesSave = async () => {
    if (!salesTarget) return
    setSalesLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {
        sales_status: salesStatus,
        expected_amount: expectedAmount,
        expected_sessions: expectedSessions,
        closing_probability: closingProb,
        closing_fail_reason: salesStatus === '클로징실패' ? failReason : null,
        sales_note: salesNote || null,
        is_sales_target: isSalesTarget,
        is_pt_conversion: isPtConversion,
      }
      // PT전환이면 상태도 완료 + notes에 PT 전환 희망 추가
      if (isPtConversion && !salesTarget.is_pt_conversion) {
        updates.status = '완료'
        updates.notes = ((salesTarget.notes ?? '') + ' PT 전환 희망').trim()
        if (ptSalesAmount > 0) updates.actual_sales = ptSalesAmount
      }
      // PT전환 해제하면 notes에서 제거
      if (!isPtConversion && salesTarget.is_pt_conversion) {
        updates.notes = (salesTarget.notes ?? '').replace(/PT 전환 희망/g, '').trim() || null
      }
      console.log('세일즈 저장:', salesTarget.id, updates)
      const result = await updateOtAssignment(salesTarget.id, updates)
      if (result && 'error' in result) {
        console.error('세일즈 저장 실패:', result.error)
        alert('저장에 실패했습니다: ' + result.error)
        setSalesLoading(false)
        return
      }
      setSalesTarget(null)
      setSalesLoading(false)
      startTransition(() => router.refresh())
    } catch (err) {
      console.error('세일즈 저장 에러:', err)
      alert('저장 중 오류가 발생했습니다.')
      setSalesLoading(false)
    }
  }

  // 필터 카운트를 한 번에 계산 (useMemo로 캐시)
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { '전체': assignments.length }
    for (const a of assignments) {
      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
      if (done === 0 && !['거부','추후결정'].includes(a.status)) counts['1차'] = (counts['1차'] ?? 0) + 1
      if (done === 1) counts['2차'] = (counts['2차'] ?? 0) + 1
      if (done === 2) counts['3차'] = (counts['3차'] ?? 0) + 1
      if (a.status === '거부') counts['거부'] = (counts['거부'] ?? 0) + 1
      if (a.sales_status === '연락두절') counts['연락두절'] = (counts['연락두절'] ?? 0) + 1
      if (a.sales_status === '스케줄미확정') counts['스케줄미확정'] = (counts['스케줄미확정'] ?? 0) + 1
      if (a.sales_status === '클로징실패') counts['클로징실패'] = (counts['클로징실패'] ?? 0) + 1
      if (a.sales_status === '등록완료' || a.status === '완료') counts['등록완료'] = (counts['등록완료'] ?? 0) + 1
      if (a.is_sales_target) counts['매출대상'] = (counts['매출대상'] ?? 0) + 1
      if (a.is_pt_conversion) counts['PT전환'] = (counts['PT전환'] ?? 0) + 1
    }
    return counts
  }, [assignments])

  // 필터링된 회원
  const filteredMembers = useMemo(() => {
    if (filter === '전체') return assignments
    return assignments.filter((a) => {
      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
      if (filter === '1차') return done === 0 && !['거부','추후결정'].includes(a.status)
      if (filter === '2차') return done === 1
      if (filter === '3차') return done === 2
      if (filter === '거부') return a.status === '거부'
      if (filter === '연락두절') return a.sales_status === '연락두절'
      if (filter === '스케줄미확정') return a.sales_status === '스케줄미확정'
      if (filter === '클로징실패') return a.sales_status === '클로징실패'
      if (filter === '등록완료') return a.sales_status === '등록완료' || a.status === '완료'
      if (filter === '매출대상') return a.is_sales_target
      if (filter === 'PT전환') return a.is_pt_conversion
      return true
    })
  }, [assignments, filter])

  const getNextSessionNumber = (a: OtAssignmentWithDetails): number => {
    const completed = a.sessions?.filter((s) => s.completed_at).length ?? 0
    return completed + 1
  }

  const handleCompleteOpen = (a: OtAssignmentWithDetails, sessionNumber: number) => {
    setCompleteTarget({ assignment: a, sessionNumber })
    setExercises([{ name: '', sets: 3, reps: 12 }])
    setTrainerTip('')
    setCardioType([])
    setCardioDuration(null)
    setNextDate('')
    setNextTime('')
    setCompleteResult('')
    setCompleteFailReason('')
  }

  const handleCompleteSubmit = async () => {
    if (!completeTarget) return
    setCompleteLoading(true)

    const { assignment, sessionNumber } = completeTarget

    // exercises를 텍스트로 변환
    const exerciseText = exercises
      .filter((e) => e.name.trim())
      .map((e) => `${e.name} ${e.sets}x${e.reps}`)
      .join(', ')

    // 현재 세션 완료 처리
    await upsertOtSession({
      ot_assignment_id: assignment.id,
      session_number: sessionNumber,
      scheduled_at: assignment.sessions.find((s) => s.session_number === sessionNumber)?.scheduled_at ?? new Date().toISOString(),
      completed_at: new Date().toISOString(),
      exercise_content: exerciseText || null,
      trainer_tip: trainerTip || null,
      cardio_type: cardioType.length > 0 ? cardioType : null,
      cardio_duration: cardioDuration,
    })

    // 다음 세션 일정 저장
    if (nextDate && nextTime) {
      await upsertOtSession({
        ot_assignment_id: assignment.id,
        session_number: sessionNumber + 1,
        scheduled_at: `${nextDate}T${nextTime}:00`,
      })
    }

    // 결과 분류 저장
    if (completeResult) {
      const updateData: Record<string, unknown> = {}
      if (completeResult === '매출대상') {
        updateData.is_sales_target = true
        updateData.sales_status = 'OT진행중'
      } else if (completeResult === '거부자') {
        updateData.sales_status = 'OT거부자'
        updateData.status = '거부'
      } else if (completeResult === '클로징실패') {
        updateData.sales_status = '클로징실패'
        updateData.closing_fail_reason = completeFailReason || null
      } else if (completeResult === '등록완료') {
        updateData.sales_status = '등록완료'
      }
      if (Object.keys(updateData).length > 0) {
        await updateOtAssignment(assignment.id, updateData)
      }
    }

    setCompleteTarget(null)
    setCompleteLoading(false)
    startTransition(() => router.refresh())
  }

  const toggleCardio = (type: string) => {
    setCardioType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const getProgressInfo = (a: OtAssignmentWithDetails) => {
    const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
    if (a.status === '거부') return { label: '거부', color: 'bg-red-100 text-red-700' }
    if (a.status === '추후결정') return { label: '추후결정', color: 'bg-orange-100 text-orange-700' }
    if (a.status === '완료') return { label: '완료', color: 'bg-green-100 text-green-700' }
    if (done >= 3) return { label: `${done}차완료`, color: 'bg-green-100 text-green-700' }
    if (done === 2) return { label: '2차완료', color: 'bg-indigo-100 text-indigo-700' }
    if (done === 1) return { label: '1차완료', color: 'bg-blue-100 text-blue-700' }
    return { label: '대기', color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <>
      <div className="space-y-4">
        {/* 필터 + 회원추가 */}
        <div className="flex flex-wrap gap-2 items-center">
          {trainerId && (
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs mr-2"
              onClick={() => { setAddName(''); setAddPhone(''); setAddAssignDate(''); setAddDateUnknown(false); setAddCategory(''); setAddTrainingType(''); setAddDuration(''); setAddExerciseTime(''); setAddExerciseGoal(''); setAddNotes(''); setShowAddMember(true) }}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />회원 추가
            </Button>
          )}
          {FILTERS.map((f) => {
            const count = filterCounts[f] ?? 0
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-yellow-400 text-black'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f} {count > 0 && <span className="ml-1 text-[10px]">{count}</span>}
              </button>
            )
          })}
        </div>

        {/* 전체 회원 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">
              전체 회원 ({filteredMembers.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">해당 조건의 회원이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((a) => {
                  const progress = getProgressInfo(a)
                  const nextSession = getNextSessionNumber(a)
                  const nextScheduled = a.sessions?.find((s) => s.session_number === nextSession && s.scheduled_at && !s.completed_at)

                  const isExpanded = expandedId === a.id

                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-200 overflow-hidden"
                    >
                      <div className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{a.member.name}</span>
                          {a.member.registration_source === '수기' && (
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300">수기</span>
                          )}
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${progress.color}`}>
                            {progress.label}
                          </Badge>
                          <button onClick={(e) => { e.stopPropagation(); openSalesEdit(a) }} className="cursor-pointer">
                            <Badge variant="outline" className={`text-[10px] px-1.5 ${getSalesColor(a.sales_status || 'OT진행중')}`}>
                              {SALES_STATUSES.find((s) => s.value === (a.sales_status || 'OT진행중'))?.label ?? a.sales_status}
                            </Badge>
                          </button>
                          {a.is_sales_target && (
                            <Badge className="text-[10px] px-1.5 bg-red-500 text-white border-red-500 font-bold">★ 매출대상</Badge>
                          )}
                          {a.is_pt_conversion && (
                            <Badge variant="outline" className="text-[10px] px-1.5 bg-purple-50 text-purple-600 border-purple-300">PT전환</Badge>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <span>배정날짜 : {a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd') : '-'}</span>
                        </div>
                      </div>
                      {/* 기본 정보 */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>등록 {a.member.registered_at}</span>
                        {a.member.ot_category && <span>{a.member.ot_category}</span>}
                        {a.member.exercise_time && <span className="text-blue-600">{a.member.exercise_time}</span>}
                        {a.member.phone && <span>번호) {a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>}
                        {a.expected_amount > 0 && <span className="text-green-600 font-medium">예상 {a.expected_amount.toLocaleString()}만원{a.expected_sessions ? ` (${a.expected_sessions}회)` : ''}</span>}
                        {nextScheduled && <span>OT일정: {nextSession}차 {format(new Date(nextScheduled.scheduled_at!), 'M/d HH:mm')}</span>}
                      </div>
                      </div>

                      {/* 펼침: 상세 + OT 세션 */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                          {/* 상세 정보 */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div><p className="text-xs text-gray-500">연락처</p><p className="font-medium">{a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p></div>
                            <div><p className="text-xs text-gray-500">성별</p><p className="font-medium">{a.member.gender ?? '-'}</p></div>
                            <div><p className="text-xs text-gray-500">운동기간</p><p className="font-medium">{a.member.duration_months ?? '-'}</p></div>
                            <div><p className="text-xs text-gray-500">PT담당</p><p className="font-medium">{a.pt_trainer?.name ?? '미배정'}</p></div>
                          </div>
                          {a.member.detail_info && (
                            <div><p className="text-xs text-gray-500">상세정보</p><p className="text-sm text-gray-900 mt-0.5">{a.member.detail_info}</p></div>
                          )}
                          {a.member.notes && (
                            <div><p className="text-xs text-gray-500">특이사항</p><p className="text-sm text-gray-900 mt-0.5">{a.member.notes}</p></div>
                          )}

                          {/* OT 일정 - 스크린샷처럼 1차/2차/3차 카드형 일정표 */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <p className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <CalendarDays className="h-5 w-5" />
                              OT 일정
                            </p>
                            <div className="grid gap-4 md:grid-cols-3">
                              {Array.from({ length: Math.max(3, ...(a.sessions?.map(ss => ss.session_number) ?? [0]), scheduleEdit?.assignmentId === a.id ? scheduleEdit.sessionNumber : 0) }, (_, i) => i + 1).map((num) => {
                                const s = a.sessions?.find((ss) => ss.session_number === num)
                                const isDone = !!s?.completed_at
                                const isScheduled = !!s?.scheduled_at && !s?.completed_at
                                const isEditingCompleted = editingCompletedSession?.assignmentId === a.id && editingCompletedSession?.sessionNumber === num
                                const isEditingThis = scheduleEdit?.assignmentId === a.id && scheduleEdit?.sessionNumber === num
                                const localDate = isEditingThis ? scheduleEdit!.date : (s?.scheduled_at ? format(new Date(s.scheduled_at), 'yyyy-MM-dd') : '')
                                const localTime = isEditingThis ? scheduleEdit!.time : (s?.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '')
                                const localFeedback = isEditingThis ? scheduleEdit?.feedback ?? (s?.feedback ?? '') : (s?.feedback ?? '')

                                return (
                                  <div key={num} className={`rounded-xl border-2 p-4 space-y-3 ${
                                    isDone && !isEditingCompleted ? 'bg-green-50 border-green-400'
                                    : isScheduled ? 'bg-blue-50 border-blue-400'
                                    : 'bg-white border-gray-300'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <p className="text-lg font-black text-gray-900">{num}차 OT</p>
                                      {isDone && !isEditingCompleted && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs text-gray-500 hover:text-gray-700"
                                          onClick={() => {
                                            setEditingCompletedSession({ assignmentId: a.id, sessionNumber: num })
                                            setScheduleEdit({ assignmentId: a.id, sessionNumber: num, date: localDate, time: localTime, feedback: localFeedback })
                                          }}
                                        >
                                          <Pencil className="h-3 w-3 mr-1" />수정
                                        </Button>
                                      )}
                                      {isEditingCompleted && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs text-gray-500 hover:text-gray-700"
                                          onClick={() => {
                                            setEditingCompletedSession(null)
                                            setScheduleEdit(null)
                                          }}
                                        >
                                          취소
                                        </Button>
                                      )}
                                    </div>

                                    {isDone && !isEditingCompleted ? (
                                      <div className="rounded-lg bg-green-100 border border-green-300 p-3 text-center">
                                        <p className="text-sm font-bold text-green-800">
                                          {s?.scheduled_at ? format(new Date(s.scheduled_at), 'M/d (EEE) HH:mm', { locale: ko }) : '완료'}
                                        </p>
                                        <Badge className="mt-1 bg-green-500 text-white text-xs">완료</Badge>
                                        {s?.feedback && <p className="mt-2 text-xs text-gray-600">{s.feedback}</p>}
                                      </div>
                                    ) : (
                                      <>
                                        {/* 날짜 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                            <CalendarDays className="h-3 w-3" /> 날짜
                                          </p>
                                          <Input
                                            type="date"
                                            value={localDate}
                                            onChange={(e) => setScheduleEdit({ assignmentId: a.id, sessionNumber: num, date: e.target.value, time: localTime, feedback: localFeedback })}
                                            className="h-9 text-sm bg-white border-gray-300"
                                          />
                                        </div>

                                        {/* 시간 버튼 그리드 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            시간
                                          </p>
                                          <div className="grid grid-cols-4 gap-1.5">
                                            {TIME_SLOTS.map((slot) => (
                                              <button
                                                key={slot}
                                                type="button"
                                                className={`rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                                                  localTime === slot
                                                    ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                                onClick={() => setScheduleEdit({ assignmentId: a.id, sessionNumber: num, date: localDate, time: slot, feedback: localFeedback })}
                                              >
                                                {slot}
                                              </button>
                                            ))}
                                          </div>
                                          {a.member.exercise_time && (
                                            <p className="text-[11px] text-blue-600 mt-1">회원 희망: {a.member.exercise_time}</p>
                                          )}
                                        </div>

                                        {/* 피드백 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600">피드백</p>
                                          <textarea
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y min-h-[60px]"
                                            placeholder="회원 피드백을 입력하세요"
                                            value={localFeedback}
                                            onChange={(e) => setScheduleEdit({ assignmentId: a.id, sessionNumber: num, date: localDate, time: localTime, feedback: e.target.value })}
                                          />
                                        </div>

                                        {/* 버튼 영역 */}
                                        <div className="space-y-2">
                                          {/* 일정 저장/수정 */}
                                          <Button
                                            size="sm"
                                            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                                            onClick={() => {
                                              if (!localDate || !localTime) return
                                              setScheduleLoading(true)
                                              const sessionData: Parameters<typeof upsertOtSession>[0] = {
                                                ot_assignment_id: a.id,
                                                session_number: num,
                                                scheduled_at: new Date(`${localDate}T${localTime}:00`).toISOString(),
                                                feedback: localFeedback || null,
                                              }
                                              // 완료된 세션 수정 시 completed_at 유지
                                              if (isEditingCompleted && s?.completed_at) {
                                                sessionData.completed_at = s.completed_at
                                              }
                                              upsertOtSession(sessionData).then(() => {
                                                setScheduleEdit(null)
                                                setEditingCompletedSession(null)
                                                setScheduleLoading(false)
                                                startTransition(() => router.refresh())
                                              })
                                            }}
                                            disabled={scheduleLoading || !localDate || !localTime}
                                          >
                                            {isEditingCompleted ? '수정 저장' : isScheduled ? '일정 수정' : '일정 저장'}
                                          </Button>

                                          {/* 개별 세션 완료 버튼 */}
                                          {(isScheduled || (isEditingThis && localDate && localTime)) && !isEditingCompleted && (
                                            <Button
                                              size="sm"
                                              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                                              onClick={() => handleCompleteOpen(a, num)}
                                            >
                                              <CheckCircle className="h-4 w-4 mr-1" />{num}차 완료 처리
                                            </Button>
                                          )}

                                          {/* 완료 취소 버튼 */}
                                          {isEditingCompleted && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                              onClick={() => {
                                                if (!confirm(`${num}차 OT 완료를 취소하시겠습니까?`)) return
                                                setScheduleLoading(true)
                                                upsertOtSession({
                                                  ot_assignment_id: a.id,
                                                  session_number: num,
                                                  scheduled_at: s?.scheduled_at ?? new Date().toISOString(),
                                                  completed_at: null,
                                                }).then(() => {
                                                  setEditingCompletedSession(null)
                                                  setScheduleEdit(null)
                                                  setScheduleLoading(false)
                                                  startTransition(() => router.refresh())
                                                })
                                              }}
                                              disabled={scheduleLoading}
                                            >
                                              <Undo2 className="h-4 w-4 mr-1" />완료 취소
                                            </Button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            {/* 세션 추가 버튼 */}
                            {a.status !== '거부' && (
                              <button
                                type="button"
                                className="mt-3 w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-yellow-400 hover:text-yellow-600 transition-colors flex items-center justify-center gap-1"
                                onClick={() => {
                                  const maxSession = Math.max(3, ...(a.sessions?.map(s => s.session_number) ?? [0]))
                                  const newNum = maxSession + 1
                                  setScheduleEdit({ assignmentId: a.id, sessionNumber: newNum, date: '', time: '', feedback: '' })
                                }}
                              >
                                <Plus className="h-4 w-4" /> 세션 추가 ({Math.max(3, ...(a.sessions?.map(s => s.session_number) ?? [0])) + 1}차)
                              </button>
                            )}
                          </div>

                          {/* 퀵 액션 */}
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={(e) => { e.stopPropagation(); openSalesEdit(a) }}>
                              <BarChart3 className="h-4 w-4 mr-1" />세일즈 관리
                            </Button>
                            <Button size="sm" variant="outline" className="text-white bg-gray-800 border-gray-700" onClick={(e) => { e.stopPropagation(); router.push(`/ot/${a.id}`) }}>
                              상세 페이지
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 완료 처리 바텀시트 */}
      <Dialog open={!!completeTarget} onOpenChange={() => setCompleteTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {completeTarget?.assignment.member.name} {completeTarget?.sessionNumber}차 OT 완료
            </DialogTitle>
            <DialogDescription>OT 기록을 입력해주세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 운동 내용 */}
            <div className="space-y-2">
              <Label>운동 내용</Label>
              <div className="space-y-2">
                {exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="종목명"
                      value={ex.name}
                      onChange={(e) => {
                        const next = [...exercises]
                        next[i] = { ...next[i], name: e.target.value }
                        setExercises(next)
                      }}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <select
                        className="w-14 rounded-md border border-gray-300 bg-white px-1 py-2 text-sm text-center"
                        value={ex.sets}
                        onChange={(e) => {
                          const next = [...exercises]
                          next[i] = { ...next[i], sets: Number(e.target.value) }
                          setExercises(next)
                        }}
                      >
                        {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-xs text-gray-500">세트</span>
                      <select
                        className="w-16 rounded-md border border-gray-300 bg-white px-1 py-2 text-sm text-center"
                        value={ex.reps}
                        onChange={(e) => {
                          const next = [...exercises]
                          next[i] = { ...next[i], reps: Number(e.target.value) }
                          setExercises(next)
                        }}
                      >
                        {[5,6,8,10,12,15,20,25,30].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-xs text-gray-500">개</span>
                    </div>
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                        onClick={() => setExercises(exercises.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="w-full rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:border-yellow-400 hover:text-yellow-600 transition-colors"
                  onClick={() => setExercises([...exercises, { name: '', sets: 3, reps: 12 }])}
                >
                  + 종목 추가
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="space-y-2">
              <Label>Tip / 메모</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="예: 무릎 안쪽으로 모이는 경향, 호흡 교정 필요"
                value={trainerTip}
                onChange={(e) => setTrainerTip(e.target.value)}
              />
            </div>

            {/* 유산소 */}
            <div className="space-y-2">
              <Label>유산소</Label>
              <div className="flex gap-2">
                {CARDIO_OPTIONS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      cardioType.includes(type)
                        ? 'bg-yellow-400 text-black border-yellow-400'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleCardio(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {cardioType.length > 0 && (
                <div className="flex gap-2">
                  {CARDIO_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        cardioDuration === d
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => setCardioDuration(d)}
                    >
                      {d}분
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 다음 OT 일정 */}
            {completeTarget && (
              <div className="space-y-2">
                <Label>다음 OT 일정 ({completeTarget.sessionNumber + 1}차)</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    min={today}
                    className="flex-1"
                  />
                  <select
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                  >
                    <option value="">시간 선택</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* 결과 분류 */}
            <div className="space-y-2">
              <Label>결과 분류 <span className="text-xs text-gray-400">(선택)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: '매출대상', label: '매출대상', color: 'bg-yellow-400 text-black border-yellow-400' },
                  { value: '등록완료', label: '등록완료', color: 'bg-blue-500 text-white border-blue-500' },
                  { value: '클로징실패', label: '클로징실패', color: 'bg-red-500 text-white border-red-500' },
                  { value: '거부자', label: '거부자', color: 'bg-orange-500 text-white border-orange-500' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      completeResult === opt.value
                        ? opt.color
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setCompleteResult(completeResult === opt.value ? '' : opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {completeResult === '클로징실패' && (
                <Input
                  placeholder="실패 사유 (선택)"
                  value={completeFailReason}
                  onChange={(e) => setCompleteFailReason(e.target.value)}
                />
              )}
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCompleteSubmit}
              disabled={completeLoading}
            >
              {completeLoading ? '저장 중...' : '완료 저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원 정보 퀵뷰 */}
      <Dialog open={!!quickViewTarget} onOpenChange={() => setQuickViewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {quickViewTarget?.member.name}
            </DialogTitle>
            <DialogDescription>회원 정보</DialogDescription>
          </DialogHeader>
          {quickViewTarget && (
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">연락처</p>
                  <p className="font-medium text-gray-900">{quickViewTarget.member.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500">성별</p>
                  <p className="font-medium text-gray-900">{quickViewTarget.member.gender ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">종목</p>
                  <p className="font-medium text-gray-900">{quickViewTarget.member.ot_category ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">운동시간</p>
                  <p className="font-medium text-blue-600">{quickViewTarget.member.exercise_time ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">운동기간</p>
                  <p className="font-medium text-gray-900">
                    {quickViewTarget.member.duration_months ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">등록일</p>
                  <p className="font-medium text-gray-900">{quickViewTarget.member.registered_at}</p>
                </div>
              </div>

              {/* 부상/특이사항 */}
              {(quickViewTarget.member.injury_tags?.length > 0 || quickViewTarget.member.notes) && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-700 flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    주의사항
                  </p>
                  {quickViewTarget.member.injury_tags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-1">
                      {quickViewTarget.member.injury_tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] border-red-300 text-red-700">{tag}</Badge>
                      ))}
                    </div>
                  )}
                  {quickViewTarget.member.notes && (
                    <p className="text-sm text-red-800">{quickViewTarget.member.notes}</p>
                  )}
                </div>
              )}

              {/* 상세 정보 */}
              {quickViewTarget.member.detail_info && (
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">상세정보</p>
                  <p className="text-sm text-gray-900">{quickViewTarget.member.detail_info}</p>
                </div>
              )}

              {/* 이전 OT 기록 */}
              {quickViewTarget.sessions?.filter((s) => s.completed_at).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">이전 OT 기록</p>
                  <div className="space-y-2">
                    {quickViewTarget.sessions
                      .filter((s) => s.completed_at)
                      .sort((a, b) => a.session_number - b.session_number)
                      .map((s) => (
                        <div key={s.id} className="rounded-md border border-green-100 bg-green-50/50 p-2">
                          <p className="text-xs font-medium text-green-700">
                            {s.session_number}차 OT — {s.completed_at ? format(new Date(s.completed_at), 'M/d') : ''}
                          </p>
                          {s.exercise_content && <p className="text-xs text-gray-700 mt-1">{s.exercise_content}</p>}
                          {s.trainer_tip && <p className="text-xs text-blue-600 mt-1">tip: {s.trainer_tip}</p>}
                          {s.feedback && <p className="text-xs text-gray-500 mt-1">{s.feedback}</p>}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => {
                  setQuickViewTarget(null)
                  router.push(`/ot/${quickViewTarget.id}`)
                }}
              >
                상세 페이지로 이동
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 세일즈 편집 바텀시트 */}
      <Dialog open={!!salesTarget} onOpenChange={() => setSalesTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              {salesTarget?.member.name} 세일즈 관리
            </DialogTitle>
            <DialogDescription>OT 현황과 매출 정보를 입력하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 매출대상자 / PT전환 */}
            <div className="flex gap-3">
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors ${
                  isSalesTarget
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}
                onClick={() => setIsSalesTarget(!isSalesTarget)}
              >
                매출대상자
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors ${
                  isPtConversion
                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}
                onClick={() => setIsPtConversion(!isPtConversion)}
              >
                PT전환
              </button>
            </div>

            {/* PT전환 매출 입력 */}
            {isPtConversion && (
              <div className="space-y-2 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3">
                <p className="text-xs font-bold text-purple-700">PT 등록 매출</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">등록 금액</Label>
                    <div className="flex items-center gap-1">
                      <Input type="number" value={ptSalesAmount || ''} onChange={(e) => setPtSalesAmount(Number(e.target.value))} placeholder="0" className="h-8 text-sm" />
                      <span className="text-xs text-gray-500 shrink-0">만원</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-gray-500">등록 횟수</Label>
                    <div className="flex items-center gap-1">
                      <Input type="number" value={ptSalesCount || ''} onChange={(e) => setPtSalesCount(Number(e.target.value))} placeholder="0" className="h-8 text-sm" />
                      <span className="text-xs text-gray-500 shrink-0">회</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 담당 현황 (읽기전용) */}
            {salesTarget && (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500">담당 현황</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-center">
                    <p className="text-[10px] text-blue-500">PT 담당</p>
                    <p className="text-sm font-bold text-blue-700">{salesTarget.pt_trainer?.name ?? '미배정'}</p>
                  </div>
                  <div className="rounded-md bg-purple-50 border border-purple-200 p-2 text-center">
                    <p className="text-[10px] text-purple-500">PPT 담당</p>
                    <p className="text-sm font-bold text-purple-700">{salesTarget.ppt_trainer?.name ?? '미배정'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 상태 선택 */}
            <div className="space-y-2">
              <Label>상태</Label>
              <div className="grid grid-cols-3 gap-2">
                {SALES_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      salesStatus === s.value
                        ? `${s.color} border-current font-bold ring-2 ring-offset-1 ring-current`
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSalesStatus(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 예상 매출 */}
            <div className="space-y-2">
              <Label>예상 매출</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={expectedAmount || ''}
                  onChange={(e) => setExpectedAmount(Number(e.target.value))}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 font-medium">만원</span>
              </div>
            </div>

            {/* 예상 회수 */}
            <div className="space-y-2">
              <Label>예상 회수</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={expectedSessions || ''}
                  onChange={(e) => setExpectedSessions(Number(e.target.value))}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-sm text-gray-500 font-medium">회</span>
              </div>
            </div>

            {/* 클로징 확률 */}
            <div className="space-y-2">
              <Label>클로징 확률</Label>
              <div className="flex gap-2">
                {PROBABILITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
                      closingProb === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setClosingProb(p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* 클로징 실패 사유 */}
            {salesStatus === '클로징실패' && (
              <div className="space-y-2">
                <Label>실패 사유</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="클로징 실패 사유를 입력하세요"
                  value={failReason}
                  onChange={(e) => setFailReason(e.target.value)}
                />
              </div>
            )}

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="세일즈 관련 메모"
                value={salesNote}
                onChange={(e) => setSalesNote(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSalesSave}
              disabled={salesLoading}
            >
              {salesLoading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원 추가 다이얼로그 */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              회원 추가
            </DialogTitle>
            <DialogDescription>새 회원을 등록하고 이 트레이너에 배정합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 이름 * */}
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="회원 이름" />
            </div>
            {/* 전화번호 * */}
            <div className="space-y-2">
              <Label>전화번호 *</Label>
              <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="01012345678" />
            </div>
            {/* 배정날짜 * */}
            <div className="space-y-2">
              <Label>배정날짜 *</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={addAssignDate}
                  onChange={(e) => setAddAssignDate(e.target.value)}
                  disabled={addDateUnknown}
                  className={`flex-1 ${addDateUnknown ? 'opacity-50' : ''}`}
                />
                <button
                  type="button"
                  className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    addDateUnknown
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => { setAddDateUnknown(!addDateUnknown); if (!addDateUnknown) setAddAssignDate('') }}
                >
                  모름
                </button>
              </div>
            </div>
            {/* 종목 * */}
            <div className="space-y-2">
              <Label>종목 *</Label>
              <div className="flex gap-2">
                {['헬스', '필라', '헬스,필라'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      addCategory === cat
                        ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setAddCategory(addCategory === cat ? '' : cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* PT / PPT */}
            <div className="space-y-2">
              <Label>PT / PPT</Label>
              <div className="flex gap-2">
                {['PT', 'PPT', 'PT,PPT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      addTrainingType === t
                        ? 'bg-blue-500 text-white border-blue-500 font-bold'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setAddTrainingType(addTrainingType === t ? '' : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* 운동기간 */}
            <div className="space-y-2">
              <Label>운동기간</Label>
              <Input value={addDuration} onChange={(e) => setAddDuration(e.target.value)} placeholder="예: 3개월, 6개월" />
            </div>
            {/* 운동 희망시간 */}
            <div className="space-y-2">
              <Label>운동 희망시간</Label>
              <Input value={addExerciseTime} onChange={(e) => setAddExerciseTime(e.target.value)} placeholder="예: 평일 18시 이후" />
            </div>
            {/* 운동목적 */}
            <div className="space-y-2">
              <Label>운동목적</Label>
              <Input value={addExerciseGoal} onChange={(e) => setAddExerciseGoal(e.target.value)} placeholder="예: 다이어트, 체력증진, 재활" />
            </div>
            {/* 특이사항 */}
            <div className="space-y-2">
              <Label>특이사항</Label>
              <textarea
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="부상 이력, 주의사항 등"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={addLoading || !addName || !addPhone || !addCategory || (!addDateUnknown && !addAssignDate)}
              onClick={async () => {
                const phone = addPhone.replace(/[^0-9]/g, '')
                if (phone.length < 10 || phone.length > 11) {
                  alert('올바른 전화번호를 입력해주세요 (10~11자리)')
                  return
                }
                setAddLoading(true)
                const result = await quickRegisterMember({
                  name: addName,
                  phone,
                  trainerId: trainerId!,
                  registered_at: addDateUnknown ? undefined : addAssignDate || undefined,
                  ot_category: addCategory || null,
                  training_type: addTrainingType || undefined,
                  duration_months: addDuration || null,
                  exercise_time: addExerciseTime || null,
                  exercise_goal: addExerciseGoal || undefined,
                  notes: addNotes || null,
                })
                if (result.error) {
                  alert('등록 실패: ' + result.error)
                } else {
                  if (result.existingMember) {
                    alert(`${result.existingMember.name}님은 이미 등록된 회원입니다. 기존 회원으로 연결했습니다.`)
                  }
                  setShowAddMember(false)
                  setAddName(''); setAddPhone(''); setAddAssignDate(''); setAddDateUnknown(false)
                  setAddCategory(''); setAddTrainingType(''); setAddDuration('')
                  setAddExerciseTime(''); setAddExerciseGoal(''); setAddNotes('')
                  router.refresh()
                }
                setAddLoading(false)
              }}
            >
              {addLoading ? '등록 중...' : '회원 등록'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
