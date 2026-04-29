'use client'

import { useState, useMemo, useTransition, useCallback, useEffect, useRef } from 'react'
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
import { CheckCircle, User, AlertTriangle, BarChart3, CalendarDays, ClipboardList, Pencil, Plus, Undo2, UserPlus, Target, HeartPulse, Dumbbell, Phone, Download, Ban } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { upsertOtSession, updateOtAssignment, deleteOtSession } from '@/actions/ot'
import { getOtProgram, getAssignmentExpandData, batchGetOtPrograms, approveOtSession } from '@/actions/ot-program'
import { quickRegisterMember } from '@/actions/members'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import type { OtProgramFormRef } from './ot-program-form'
const OtProgramForm = dynamic(() => import('./ot-program-form').then((m) => m.OtProgramForm), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-gray-500">프로그램 로드 중...</div>,
}) as unknown as typeof import('./ot-program-form').OtProgramForm
import type { OtAssignmentWithDetails, SalesStatus, Profile, OtProgram } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainers?: Pick<Profile, 'id' | 'name'>[]
  trainerId?: string
  trainerName?: string
  profile?: Profile
  initialSchedules?: { member_name: string; schedule_type: string; scheduled_date: string; start_time: string }[]
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

const TIME_SLOTS = [
  '06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00',
]
const CARDIO_OPTIONS = ['러닝머신', '싸이클', '스텝퍼']
const CARDIO_DURATIONS = [10, 15, 20, 30]
function toManwon(v: number): number { return v >= 10000 ? Math.round(v / 10000) : v }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TrainerCardList({ assignments, trainers = [], trainerId, trainerName = '', profile, initialSchedules }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [today, setToday] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0])
    setMounted(true)
  }, [])

  // trainer_schedules에서 해당 트레이너의 전체 스케줄 로드
  // 첫 마운트 시점에는 서버에서 받은 initialSchedules를 사용 → client-side waterfall 제거
  const [trainerSchedules, setTrainerSchedules] = useState<{ member_name: string; schedule_type: string; scheduled_date: string; start_time: string }[]>(initialSchedules ?? [])
  const [scheduleRefresh, setScheduleRefresh] = useState(0)
  const refreshSchedules = useCallback(() => setScheduleRefresh((n) => n + 1), [])
  // initialSchedules가 있으면 첫 fetch 스킵 (refresh 트리거 시에만 다시 로드)
  const initialFetchSkippedRef = useRef(!!initialSchedules)
  useEffect(() => {
    if (!trainerId) return
    if (initialFetchSkippedRef.current) {
      initialFetchSkippedRef.current = false
      return
    }
    const supabase = createClient()
    supabase.from('trainer_schedules')
      .select('member_name, schedule_type, scheduled_date, start_time')
      .eq('trainer_id', trainerId)
      .then(({ data }: { data: { member_name: string; schedule_type: string; scheduled_date: string; start_time: string }[] | null }) => setTrainerSchedules(data ?? []))
  }, [trainerId, scheduleRefresh])

  // 날짜별 예약된 시간 슬롯 조회
  const getBookedSlots = useCallback((date: string, excludeMemberName?: string) => {
    const booked = new Map<string, string>()
    if (!date) return booked
    for (const s of trainerSchedules) {
      if (s.scheduled_date !== date) continue
      if (s.member_name === excludeMemberName && s.schedule_type === 'OT') continue
      const label = s.schedule_type === 'OT' ? `${s.member_name} OT` : `${s.member_name} ${s.schedule_type}`
      booked.set(s.start_time, label)
    }
    return booked
  }, [trainerSchedules])

  // 필터
  const [filter, setFilter] = useState<string>('미진행')
  const FILTERS = ['미진행', '1차', '2차', '3차', '4차+', '연락두절', '스케줄미확정', '수업후 거부', '거부/제외']

  // 펼침
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<Record<string, { card: import('@/types').ConsultationCard | null; program: OtProgram | null } | 'loading'>>({})

  // 피드백 데이터 + 승인필요 set + 승인상태 맵
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { session: number; feedback: string }[]>>({})
  const [feedbackPopup, setFeedbackPopup] = useState<{ name: string; feedbacks: { session: number; feedback: string }[] } | null>(null)
  const [needApprovalSet, setNeedApprovalSet] = useState<Set<string>>(new Set())
  const [approvalMap, setApprovalMap] = useState<Record<string, { session: number; status: string; approved_at?: string | null; admin_feedback?: string | null }[]>>({})

  // assignments ID 안정화 (참조 동일성 유지)
  const assignmentIdKey = useMemo(() => assignments.map((a) => a.id).join(','), [assignments])

  useEffect(() => {
    if (!trainerId || !assignmentIdKey) return
    const ids = assignmentIdKey.split(',').filter(Boolean)
    if (ids.length === 0) return

    // 프로그램 전체 데이터를 1회 배치 조회 → 피드백/승인 정보 추출 + expandedData 프리캐시
    batchGetOtPrograms(ids).then((programMap) => {
      const map: Record<string, { session: number; feedback: string }[]> = {}
      const approvalNeeded = new Set<string>()
      const approvals: Record<string, { session: number; status: string; approved_at?: string | null }[]> = {}

      for (const [aid, prog] of Object.entries(programMap)) {
        const sessions = prog.sessions
        if (!sessions) continue
        const feedbacks = sessions
          .map((s, i) => ({ session: i + 1, feedback: (s as unknown as { admin_feedback?: string }).admin_feedback ?? '' }))
          .filter((f) => f.feedback)
        if (feedbacks.length > 0) map[aid] = feedbacks
        // 수업완료 판단: 프로그램 completed 또는 ot_sessions.completed_at
        const assign = assignments.find((a) => a.id === aid)
        const otSessions = assign?.sessions ?? []
        const hasUnapproved = sessions.some((s, i) => {
          const isCompleted = s.completed || !!otSessions.find((os) => os.session_number === i + 1 && os.completed_at)
          return isCompleted && s.approval_status !== '승인'
        })
        if (hasUnapproved) approvalNeeded.add(aid)
        const approvalEntries = sessions
          .map((s, i) => ({ session: i + 1, status: s.approval_status ?? '', approved_at: s.approved_at, admin_feedback: s.admin_feedback }))
          .filter((e) => e.status)
        if (approvalEntries.length > 0) approvals[aid] = approvalEntries
      }
      setFeedbackMap(map)
      setNeedApprovalSet(approvalNeeded)
      setApprovalMap(approvals)

      // expandedData에 프로그램 프리캐시 → 팝업 열 때 네트워크 요청 불필요
      setExpandedData((prev) => {
        const next = { ...prev }
        for (const [aid, prog] of Object.entries(programMap)) {
          if (!next[aid] || next[aid] === 'loading') {
            next[aid] = { card: null, program: prog }
          } else {
            next[aid] = { ...next[aid] as { card: unknown; program: unknown }, program: prog } as typeof next[string]
          }
        }
        return next
      })
    })
  }, [trainerId, assignmentIdKey])

  const loadExpandedData = async (memberId: string, assignmentId: string) => {
    const cached = expandedData[assignmentId]
    // 프리캐시에 프로그램만 있고 상담카드가 없으면 → 상담카드만 추가 로딩
    if (cached && cached !== 'loading' && cached.card) return
    if (cached && cached !== 'loading' && !cached.card) {
      const { card } = await getAssignmentExpandData(memberId, assignmentId)
      setExpandedData((p) => {
        const prev = p[assignmentId]
        if (!prev || prev === 'loading') return { ...p, [assignmentId]: { card, program: null } }
        return { ...p, [assignmentId]: { ...prev, card } }
      })
      return
    }
    setExpandedData((p) => ({ ...p, [assignmentId]: 'loading' }))
    const { card, program } = await getAssignmentExpandData(memberId, assignmentId)
    setExpandedData((p) => ({ ...p, [assignmentId]: { card, program } }))
  }

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
  const [completeActualSales] = useState<string>('')
  const [completeProgramData, setCompleteProgramData] = useState<OtProgram | null>(null)
  const [completeProgramLoading, setCompleteProgramLoading] = useState(false)
  const programFormRef = useRef<OtProgramFormRef>(null)

  // 제외회원 처리
  const [excludeTarget, setExcludeTarget] = useState<OtAssignmentWithDetails | null>(null)
  const [excludeReason, setExcludeReason] = useState('')
  const [excludeLoading, setExcludeLoading] = useState(false)
  const isAdmin = profile?.role === 'admin' || profile?.role === '관리자'

  const handleExclude = async () => {
    if (!excludeTarget || !excludeReason.trim()) return
    setExcludeLoading(true)
    await updateOtAssignment(excludeTarget.id, {
      is_excluded: true,
      excluded_reason: excludeReason.trim(),
      excluded_at: new Date().toISOString(),
    })
    setExcludeTarget(null)
    setExcludeReason('')
    setExcludeLoading(false)
    router.refresh()
  }

  const handleRestore = async (a: OtAssignmentWithDetails) => {
    if (!confirm(`${a.member.name}님을 제외 목록에서 복구하시겠습니까?`)) return
    await updateOtAssignment(a.id, {
      is_excluded: false,
      excluded_reason: null,
      excluded_at: null,
    })
    router.refresh()
  }

  // 인라인 스케줄 편집
  const [scheduleEdit, setScheduleEdit] = useState<{ assignmentId: string; sessionNumber: number; date: string; time: string; feedback?: string; duration: number } | null>(null)
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
  const [addRole, setAddRole] = useState<'pt' | 'ppt'>('pt')
  const [addIsFloating, setAddIsFloating] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  // 세일즈 낙관적 UI 오버라이드
  const [salesOverrides, setSalesOverrides] = useState<Record<string, { is_sales_target?: boolean; is_pt_conversion?: boolean; sales_status?: string }>>({})

  // 특이사항 수정 모드
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  // 미진행 사유 (거부/연락두절/스케줄미확정)
  const [quickStatusTarget, setQuickStatusTarget] = useState<string | null>(null)
  const [quickStatusValue, setQuickStatusValue] = useState<string>('')
  const [quickStatusReason, setQuickStatusReason] = useState('')
  const [quickStatusLoading, setQuickStatusLoading] = useState(false)
  // 낙관적 UI: 미진행 처리 후 즉시 목록에서 숨김
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  // 회원 퀵뷰
  const [quickViewTarget, setQuickViewTarget] = useState<OtAssignmentWithDetails | null>(null)

  // 상담카드 상세 보기
  const [cardDetailTarget, setCardDetailTarget] = useState<import('@/types').ConsultationCard | null>(null)

  // 일정만 잡기 (완료 처리 없이)
  const [scheduleOnlyTarget, setScheduleOnlyTarget] = useState<{ assignment: OtAssignmentWithDetails; sessionNumber: number } | null>(null)
  const [scheduleOnlyDate, setScheduleOnlyDate] = useState('')
  const [scheduleOnlyTime, setScheduleOnlyTime] = useState('')
  const [scheduleOnlyDuration, setScheduleOnlyDuration] = useState<30 | 50>(30)
  const [scheduleOnlyLoading, setScheduleOnlyLoading] = useState(false)

  const openScheduleOnly = (a: OtAssignmentWithDetails, sessionNumber: number) => {
    setScheduleOnlyTarget({ assignment: a, sessionNumber })
    setScheduleOnlyDuration(30)
    const existing = a.sessions?.find((s) => s.session_number === sessionNumber)
    if (existing?.scheduled_at) {
      const d = new Date(existing.scheduled_at)
      setScheduleOnlyDate(format(d, 'yyyy-MM-dd'))
      setScheduleOnlyTime(format(d, 'HH:mm'))
    } else {
      setScheduleOnlyDate('')
      setScheduleOnlyTime('')
    }
  }

  const handleScheduleOnlySave = async () => {
    if (!scheduleOnlyTarget || !scheduleOnlyDate || !scheduleOnlyTime) return
    setScheduleOnlyLoading(true)
    try {
      const { assignment, sessionNumber } = scheduleOnlyTarget
      // upsertOtSession이 ot_sessions + trainer_schedules(PT/PPT 모두) + 상태 전환까지 처리
      const result = await upsertOtSession({
        ot_assignment_id: assignment.id,
        session_number: sessionNumber,
        scheduled_at: new Date(`${scheduleOnlyDate}T${scheduleOnlyTime}:00+09:00`).toISOString(),
        duration: scheduleOnlyDuration,
      })
      if (result && 'error' in result && result.error) {
        alert('일정 저장 실패: ' + result.error)
      } else {
        setScheduleOnlyTarget(null)
        startTransition(() => router.refresh())
      }
    } catch (err) {
      console.error('일정 저장 실패:', err)
      alert('일정 저장 중 오류가 발생했습니다.')
    } finally {
      setScheduleOnlyLoading(false)
    }
  }

  // 상담카드 연결 (배정된 회원용)
  const [linkCardTarget, setLinkCardTarget] = useState<OtAssignmentWithDetails | null>(null)
  const [unlinkedCards, setUnlinkedCards] = useState<import('@/types').ConsultationCard[]>([])
  const [unlinkedLoading, setUnlinkedLoading] = useState(false)
  const [linkCardSelectedId, setLinkCardSelectedId] = useState<string>('')
  const [linkCardSaving, setLinkCardSaving] = useState(false)

  const openLinkCard = async (a: OtAssignmentWithDetails) => {
    setLinkCardTarget(a)
    setLinkCardSelectedId('')
    setUnlinkedLoading(true)
    const { getUnlinkedCards } = await import('@/actions/consultation')
    const list = await getUnlinkedCards()
    setUnlinkedCards(list)
    setUnlinkedLoading(false)
  }

  const handleLinkCardSave = async () => {
    if (!linkCardTarget || !linkCardSelectedId) return
    setLinkCardSaving(true)
    const { linkCardToMember } = await import('@/actions/consultation')
    const res = await linkCardToMember(linkCardSelectedId, linkCardTarget.member_id)
    setLinkCardSaving(false)
    if ('error' in res && res.error) {
      alert('연결 실패: ' + res.error)
      return
    }
    // 펼침 캐시 무효화 → 재조회 트리거
    setExpandedData((p) => {
      const next = { ...p }
      delete next[linkCardTarget.id]
      return next
    })
    await loadExpandedData(linkCardTarget.member_id, linkCardTarget.id)
    setLinkCardTarget(null)
    startTransition(() => router.refresh())
  }

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

  const handleSalesSave = async () => {
    if (!salesTarget) return
    setSalesLoading(true)
    try {
      const updates: import('@/actions/ot').UpdateOtAssignmentValues = {
        sales_status: salesStatus,
        expected_amount: expectedAmount,
        expected_sessions: expectedSessions,
        closing_probability: closingProb,
        closing_fail_reason: salesStatus === '클로징실패' ? failReason : null,
        sales_note: salesNote || null,
        is_sales_target: isSalesTarget,
        is_pt_conversion: isPtConversion,
      }
      if (isPtConversion && !salesTarget.is_pt_conversion) {
        updates.status = '완료'
        updates.notes = ((salesTarget.notes ?? '') + ' PT 전환 희망').trim()
        if (ptSalesAmount > 0) updates.actual_sales = ptSalesAmount
      }
      if (!isPtConversion && salesTarget.is_pt_conversion) {
        updates.notes = (salesTarget.notes ?? '').replace(/PT 전환 희망/g, '').trim() || null
      }
      const result = await updateOtAssignment(salesTarget.id, updates)
      if (result && 'error' in result) {
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
      if (trainerId && trainerId !== 'unassigned') {
        if (a.pt_trainer_id === trainerId) counts['PT'] = (counts['PT'] ?? 0) + 1
        if (a.ppt_trainer_id === trainerId) counts['PPT'] = (counts['PPT'] ?? 0) + 1
      }
      const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0
      const hasAny = done > 0 || scheduled > 0
      if (!hasAny && !['거부','추후결정'].includes(a.status) && !['연락두절','스케줄미확정','OT거부자','수업후거부'].includes(a.sales_status) && !a.is_excluded) counts['미진행'] = (counts['미진행'] ?? 0) + 1
      // 필터 로직과 동일하게 맞춤
      const isInactiveStatus = ['연락두절','스케줄미확정','OT거부자','수업후거부'].includes(a.sales_status) || a.is_excluded || ['거부','추후결정'].includes(a.status) || a.is_pt_conversion
      if (!isInactiveStatus && ((done === 0 && scheduled > 0) || (done === 1 && scheduled === 0))) counts['1차'] = (counts['1차'] ?? 0) + 1
      if (!isInactiveStatus && ((done === 1 && scheduled > 0) || (done === 2 && scheduled === 0))) counts['2차'] = (counts['2차'] ?? 0) + 1
      if (!isInactiveStatus && ((done === 2 && scheduled > 0) || (done === 3 && scheduled === 0))) counts['3차'] = (counts['3차'] ?? 0) + 1
      if (!isInactiveStatus && ((done >= 3 && scheduled > 0) || done >= 4)) counts['4차+'] = (counts['4차+'] ?? 0) + 1
      // 수업상태변경: 스케줄 확정됐는데 수업일이 지났는데 완료 처리 안 됨
      const pastScheduled = (a.sessions ?? []).filter((s) => s.scheduled_at && !s.completed_at && new Date(s.scheduled_at) < new Date()).length
      if (pastScheduled > 0) counts['수업상태변경'] = (counts['수업상태변경'] ?? 0) + 1
      // 승인필요: 수업 완료됐는데 프로그램 승인 안 된 회원
      if (needApprovalSet.has(a.id)) counts['승인필요'] = (counts['승인필요'] ?? 0) + 1
      if (a.status === '거부' || a.is_excluded) counts['거부/제외'] = (counts['거부/제외'] ?? 0) + 1
      if (a.sales_status === '연락두절') counts['연락두절'] = (counts['연락두절'] ?? 0) + 1
      if (a.sales_status === '스케줄미확정') counts['스케줄미확정'] = (counts['스케줄미확정'] ?? 0) + 1
      if (a.sales_status === '수업후거부') counts['수업후 거부'] = (counts['수업후 거부'] ?? 0) + 1
      if (a.is_sales_target) counts['매출대상'] = (counts['매출대상'] ?? 0) + 1
      if (a.is_pt_conversion) counts['PT전환'] = (counts['PT전환'] ?? 0) + 1
      if (a.sales_status === '클로징실패') counts['클로징실패'] = (counts['클로징실패'] ?? 0) + 1
    }
    return counts
  }, [assignments, trainerId, needApprovalSet])

  // 회원관리 탭은 배정된 모든 회원 표시 (수기 등록 포함), 낙관적 숨김 적용
  const otOnlyAssignments = useMemo(() => assignments.filter((a) => !hiddenIds.has(a.id)), [assignments, hiddenIds])

  // 필터링된 회원
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('전체')
  const filteredMembers = useMemo(() => {
    const base = filter === '전체' ? otOnlyAssignments : otOnlyAssignments.filter((a) => {
      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
      const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0
      if (filter === 'PT') return a.pt_trainer_id === trainerId
      if (filter === 'PPT') return a.ppt_trainer_id === trainerId
      if (filter === '미진행') return done === 0 && scheduled === 0 && !['거부','추후결정'].includes(a.status) && !['연락두절','스케줄미확정','OT거부자','수업후거부'].includes(a.sales_status) && !a.is_excluded
      const isInactiveStatus = ['연락두절','스케줄미확정','OT거부자','수업후거부'].includes(a.sales_status) || a.is_excluded || ['거부','추후결정'].includes(a.status) || a.is_pt_conversion
      if (filter === '1차') return !isInactiveStatus && ((done === 0 && scheduled > 0) || (done === 1 && scheduled === 0))
      if (filter === '2차') return !isInactiveStatus && ((done === 1 && scheduled > 0) || (done === 2 && scheduled === 0))
      if (filter === '3차') return !isInactiveStatus && ((done === 2 && scheduled > 0) || (done === 3 && scheduled === 0))
      if (filter === '4차+') return !isInactiveStatus && ((done >= 3 && scheduled > 0) || done >= 4)
      if (filter === '수업상태변경') {
        const pastSch = (a.sessions ?? []).filter((s) => s.scheduled_at && !s.completed_at && new Date(s.scheduled_at) < new Date()).length
        return pastSch > 0
      }
      if (filter === '승인필요') return needApprovalSet.has(a.id)
      if (filter === '거부/제외') return a.status === '거부' || a.is_excluded
      if (filter === '연락두절') return a.sales_status === '연락두절'
      if (filter === '스케줄미확정') return a.sales_status === '스케줄미확정'
      if (filter === '수업후 거부') return a.sales_status === '수업후거부'
      return true
    })
    // 기간 필터 (등록일 기준)
    const withDate = (dateFrom || dateTo)
      ? base.filter((a) => {
          const reg = a.member.registered_at
          if (!reg) return false
          const regDate = reg.slice(0, 10)
          if (dateFrom && regDate < dateFrom) return false
          if (dateTo && regDate > dateTo) return false
          return true
        })
      : base
    // 세일즈 필터
    const withCategory = categoryFilter === '전체'
      ? withDate
      : categoryFilter === '매출대상' ? withDate.filter((a) => a.is_sales_target)
      : categoryFilter === 'PT전환' ? withDate.filter((a) => a.is_pt_conversion)
      : categoryFilter === '클로징실패' ? withDate.filter((a) => a.sales_status === '클로징실패')
      : categoryFilter === '연락두절' ? withDate.filter((a) => a.sales_status === '연락두절')
      : categoryFilter === '스케줄미확정' ? withDate.filter((a) => a.sales_status === '스케줄미확정')
      : categoryFilter === '거부' ? withDate.filter((a) => a.status === '거부')
      : withDate
    // 검색
    const q = search.trim().toLowerCase()
    if (!q) return withCategory
    const qDigits = q.replace(/\D/g, '')
    return withCategory.filter((a) => {
      const name = a.member.name?.toLowerCase() ?? ''
      const phone = (a.member.phone ?? '').replace(/\D/g, '')
      if (name.includes(q)) return true
      if (qDigits && phone.includes(qDigits)) return true
      return false
    })
  }, [otOnlyAssignments, filter, trainerId, search, dateFrom, dateTo, categoryFilter])

  const handleExcelDownload = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = filteredMembers.map((a) => {
      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
      const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0
      let progress = '대기'
      if (done >= 3) progress = 'OT3차완료'
      else if (done === 2 && scheduled > 0) progress = 'OT3차예정'
      else if (done === 2) progress = 'OT2차완료'
      else if (done === 1 && scheduled > 0) progress = 'OT2차예정'
      else if (done === 1) progress = 'OT1차완료'
      else if (done === 0 && scheduled > 0) progress = 'OT1차예정'
      return {
        '이름': a.member.name,
        '전화번호': a.member.phone ?? '',
        '종목': a.member.ot_category ?? '',
        '등록일': a.member.registered_at && a.member.registered_at > '1900-01-01' ? a.member.registered_at : '미상',
        '운동시간': a.member.exercise_time ?? '',
        '운동기간': a.member.duration_months ? String(a.member.duration_months) : '',
        'PT담당': a.pt_trainer?.name ?? '',
        'PPT담당': a.ppt_trainer?.name ?? '',
        '진행상태': progress,
        '상세정보': a.member.detail_info ?? '',
        '특이사항': a.member.notes ?? '',
      }
    })
    const wb = utils.book_new()
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), '회원목록')
    writeFile(wb, `${trainerName ?? '전체'}_회원목록_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const getNextSessionNumber = (a: OtAssignmentWithDetails): number => {
    const completed = a.sessions?.filter((s) => s.completed_at).length ?? 0
    return completed + 1
  }

  const handleCompleteOpen = (a: OtAssignmentWithDetails, sessionNumber: number) => {
    // 다이얼로그를 즉시 열고, 데이터는 백그라운드 로딩
    setCompleteTarget({ assignment: a, sessionNumber })
    setExercises([{ name: '', sets: 3, reps: 12 }])
    setTrainerTip('')
    setCardioType([])
    setCardioDuration(null)
    setNextDate('')
    setNextTime('')
    setCompleteResult('')
    setCompleteFailReason('')
    // 프리캐시된 프로그램이 있으면 즉시 사용 (상담카드만 없으면 백그라운드 fetch)
    const cached = expandedData[a.id]
    if (cached && cached !== 'loading' && cached.program) {
      setCompleteProgramData(cached.program)
      // 상담카드가 없으면 백그라운드에서 가져와서 캐시
      if (!cached.card) {
        getAssignmentExpandData(a.member_id, a.id).then(({ card }) => {
          setExpandedData((prev) => {
            const existing = prev[a.id]
            if (!existing || existing === 'loading') return prev
            return { ...prev, [a.id]: { ...existing, card } }
          })
        })
      }
    } else {
      // 캐시 미스 → 프로그램 + 상담카드 동시 로딩
      setCompleteProgramLoading(true)
      setCompleteProgramData(null)
      getAssignmentExpandData(a.member_id, a.id).then(({ card, program }) => {
        setCompleteProgramData(program)
        setExpandedData((prev) => ({ ...prev, [a.id]: { card, program } }))
        setCompleteProgramLoading(false)
      })
    }
  }

  const handleCompleteSubmit = async () => {
    if (!completeTarget) return
    setCompleteLoading(true)

    const { assignment, sessionNumber } = completeTarget

    // 1. OT 프로그램 폼 데이터 저장
    if (programFormRef.current) {
      programFormRef.current.markSessionCompleted(sessionNumber - 1)
      await new Promise((r) => setTimeout(r, 100))
      const saveResult = await programFormRef.current.saveData()
      if (saveResult.error) {
        setCompleteLoading(false)
        alert('프로그램 저장 실패: ' + saveResult.error)
        return
      }
    }

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
      const updateData: import('@/actions/ot').UpdateOtAssignmentValues = {}
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
        if (completeActualSales) {
          updateData.actual_sales = Number(completeActualSales) || 0
        }
      }
      if (Object.keys(updateData).length > 0) {
        await updateOtAssignment(assignment.id, updateData)
      }
    }

    setCompleteTarget(null)
    setCompleteLoading(false)
    refreshSchedules()
    startTransition(() => router.refresh())
  }

  const toggleCardio = (type: string) => {
    setCardioType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  // 진행상태 + 로그 + D-day를 미리 계산하여 캐싱 (렌더 시 재연산 방지, hydration-safe)
  const progressCache = useMemo(() => {
    const infoMap = new Map<string, { label: string; color: string }>()
    const logMap = new Map<string, { label: string; date: string | null; color: string }[]>()
    const ddayMap = new Map<string, { text: string; color: string } | null>()
    const isNewMap = new Map<string, boolean>()
    const todayStart = mounted ? new Date() : null
    if (todayStart) todayStart.setHours(0, 0, 0, 0)

    for (const a of assignments) {
      // ── progressInfo ──
      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
      const scheduled = a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).length ?? 0
      let info = { label: '대기', color: 'bg-gray-100 text-gray-700' }
      if (a.status === '거부') info = { label: '거부', color: 'bg-red-100 text-red-700' }
      else if (a.status === '추후결정') info = { label: '추후결정', color: 'bg-orange-100 text-orange-700' }
      else if (a.sales_status === '수업후거부') info = { label: '수업후 거부', color: 'bg-red-200 text-red-800' }
      else if (a.sales_status === '연락두절') info = { label: '연락두절', color: 'bg-gray-300 text-gray-800' }
      else if (a.sales_status === '스케줄미확정') info = { label: '스케줄미확정', color: 'bg-yellow-200 text-yellow-800' }
      else if (done === 0 && scheduled === 0) info = { label: '대기', color: 'bg-gray-100 text-gray-700' }
      else if (scheduled > 0) info = { label: `${done + 1}차스케줄확정`, color: 'bg-yellow-100 text-yellow-700' }
      else {
        const approvals = approvalMap[a.id] ?? []
        const lastApproval = approvals.find((ap) => ap.session === done)?.status
        const lastApprovalEntry = approvals.find((ap) => ap.session === done)
        if (done > 0 && lastApproval === '승인' && lastApprovalEntry?.admin_feedback === '임의승인') info = { label: `${done}차임의승인`, color: 'bg-amber-100 text-amber-700' }
        else if (done > 0 && lastApproval === '승인') info = { label: `${done}차승인완료`, color: 'bg-green-100 text-green-700' }
        else if (done > 0) info = { label: `${done}차수업완료`, color: 'bg-blue-100 text-blue-700' }
      }
      infoMap.set(a.id, info)

      // ── progressLog ──
      const log: { label: string; date: string | null; color: string }[] = []
      const approvals = approvalMap[a.id] ?? []
      const sorted = [...(a.sessions ?? [])].sort((x, y) => x.session_number - y.session_number)
      log.push({ label: '대기', date: a.created_at ? format(new Date(a.created_at), 'MM.dd') : null, color: 'text-gray-500' })
      for (const s of sorted) {
        const n = s.session_number
        if (s.completed_at) {
          // scheduled_at이 있으면 항상 "수업" 표시 + "완료" 표시
          const completeDate = format(new Date(s.completed_at), 'MM.dd')
          if (s.scheduled_at) {
            const classDate = format(new Date(s.scheduled_at), 'MM.dd')
            log.push({ label: `${n}차수업`, date: classDate, color: 'text-blue-600' })
            if (classDate !== completeDate) {
              log.push({ label: `${n}차완료`, date: completeDate, color: 'text-emerald-600' })
            }
          } else {
            log.push({ label: `${n}차완료`, date: completeDate, color: 'text-blue-600' })
          }
          const approval = approvals.find((ap) => ap.session === n)
          if (approval?.status === '승인') {
            const isManual = approval.admin_feedback === '임의승인'
            log.push({ label: isManual ? `${n}차임의승인` : `${n}차승인`, date: approval.approved_at ? format(new Date(approval.approved_at), 'MM.dd') : null, color: isManual ? 'text-amber-600' : 'text-green-600' })
          } else if (approval?.status === '반려') {
            log.push({ label: `${n}차반려`, date: null, color: 'text-red-600' })
          }
        } else if (s.scheduled_at) {
          // 스케줄만 잡힌 세션 (아직 완료 안 됨) → 예정으로 표시
          const schedDate = format(new Date(s.scheduled_at), 'MM.dd')
          log.push({ label: `${n}차예정`, date: schedDate, color: 'text-yellow-600' })
        }
      }
      logMap.set(a.id, log)

      // ── D-day (client-only) ──
      if (todayStart) {
        const scheduledSessions = (a.sessions ?? []).filter((s) => s.scheduled_at && !s.completed_at).sort((x, y) => (x.scheduled_at ?? '').localeCompare(y.scheduled_at ?? ''))
        if (scheduledSessions.length > 0) {
          const nextStart = new Date(scheduledSessions[0].scheduled_at!); nextStart.setHours(0, 0, 0, 0)
          const daysUntil = Math.floor((nextStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
          ddayMap.set(a.id, { text: `수업예정 D${daysUntil <= 0 ? daysUntil : `-${daysUntil}`}`, color: 'text-blue-600' })
        } else {
          const completedSessions = (a.sessions ?? []).filter((s) => s.completed_at).sort((x, y) => (y.scheduled_at ?? y.completed_at ?? '').localeCompare(x.scheduled_at ?? x.completed_at ?? ''))
          if (completedSessions.length > 0) {
            // 수업일(scheduled_at) 기준, 없으면 완료일(completed_at) fallback
            const lastDate = completedSessions[0].scheduled_at ?? completedSessions[0].completed_at
            const lastStart = new Date(lastDate!); lastStart.setHours(0, 0, 0, 0)
            const days = Math.floor((todayStart.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24))
            ddayMap.set(a.id, { text: `마지막수업일 D+${days}`, color: days >= 7 ? 'text-red-500' : days >= 3 ? 'text-orange-500' : 'text-gray-400' })
          } else {
            ddayMap.set(a.id, null)
          }
        }
        // New 뱃지
        isNewMap.set(a.id, !!(a.created_at && (todayStart.getTime() + 86400000 - new Date(a.created_at).getTime()) < 3 * 86400000))
      }
    }
    return { infoMap, logMap, ddayMap, isNewMap }
  }, [assignments, approvalMap, mounted])

  return (
    <>
      <div className="space-y-4">
        {/* 회원추가 + 엑셀 */}
        {trainerId && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              onClick={() => { setAddName(''); setAddPhone(''); setAddAssignDate(''); setAddDateUnknown(false); setAddCategory(''); setAddTrainingType(''); setAddDuration(''); setAddExerciseTime(''); setAddExerciseGoal(''); setAddNotes(''); setAddIsFloating(false); setShowAddMember(true) }}
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" />회원 추가
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleExcelDownload}
            >
              <Download className="h-3.5 w-3.5 mr-1" />엑셀
            </Button>
          </div>
        )}

        {/* 회원 검색 + 기간/카테고리 필터 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
            {/* 검색창 */}
            <div className="relative flex-1 min-w-0">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="회원 이름 또는 전화번호로 검색"
                className="h-9 text-sm pl-9 pr-9 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center text-xs font-bold"
                  aria-label="검색 지우기"
                >×</button>
              )}
            </div>
            {/* 기간 필터 */}
            <div className="flex items-center justify-center gap-1.5 bg-white border border-gray-300 rounded-md px-3 h-9 shrink-0">
              <span className="text-[10px] text-gray-500 font-medium shrink-0">기간</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-7 text-xs border-0 p-0 bg-white text-gray-900 w-[140px] text-center"
                aria-label="시작일"
              />
              <span className="text-gray-400 text-xs shrink-0">~</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 text-xs border-0 p-0 bg-white text-gray-900 w-[140px] text-center"
                aria-label="종료일"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="h-5 w-5 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 flex items-center justify-center text-[10px] font-bold ml-1 shrink-0"
                  aria-label="기간 초기화"
                >×</button>
              )}
            </div>
            {/* 세일즈 필터 — removed dropdown, now part of filter buttons */}
          </div>
          {/* 전체 / 거부·제외 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => { setFilter('전체'); setCategoryFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                filter === '전체' && categoryFilter === '전체'
                  ? 'bg-yellow-400 text-black border-2 border-yellow-500'
                  : 'bg-yellow-300 text-black border border-yellow-400 hover:bg-yellow-400'
              }`}
            >
              전체 {(filterCounts['전체'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['전체']}</span>}
            </button>
            <button
              onClick={() => { setCategoryFilter(categoryFilter === '매출대상' ? '전체' : '매출대상'); setFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                categoryFilter === '매출대상'
                  ? 'bg-purple-600 text-white border-2 border-purple-700'
                  : 'bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200'
              }`}
            >
              매출대상 {(filterCounts['매출대상'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['매출대상']}</span>}
            </button>
            <button
              onClick={() => { setCategoryFilter(categoryFilter === 'PT전환' ? '전체' : 'PT전환'); setFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                categoryFilter === 'PT전환'
                  ? 'bg-blue-600 text-white border-2 border-blue-700'
                  : 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200'
              }`}
            >
              PT전환 {(filterCounts['PT전환'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['PT전환']}</span>}
            </button>
            <button
              onClick={() => { setCategoryFilter(categoryFilter === '클로징실패' ? '전체' : '클로징실패'); setFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                categoryFilter === '클로징실패'
                  ? 'bg-pink-500 text-white border-2 border-pink-600'
                  : 'bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100'
              }`}
            >
              클로징실패 {(filterCounts['클로징실패'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['클로징실패']}</span>}
            </button>
            <button
              onClick={() => { setFilter('수업상태변경'); setCategoryFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                filter === '수업상태변경'
                  ? 'bg-amber-400 text-amber-900 border-2 border-amber-500'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              수업상태변경 {(filterCounts['수업상태변경'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['수업상태변경']}</span>}
            </button>
            <button
              onClick={() => { setFilter('승인필요'); setCategoryFilter('전체') }}
              className={`h-8 px-4 rounded-md text-xs font-bold transition-colors ${
                filter === '승인필요'
                  ? 'bg-green-400 text-green-900 border-2 border-green-500'
                  : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
              }`}
            >
              승인필요 {(filterCounts['승인필요'] ?? 0) > 0 && <span className="ml-1 text-[10px]">{filterCounts['승인필요']}</span>}
            </button>
          </div>
        </div>

        {/* 필터 + 회원추가 */}
        <div className="flex flex-wrap gap-2 items-center">
          {false && (null
          )}
          {FILTERS.map((f) => {
            const count = filterCounts[f] ?? 0
            const isActive = filter === f && categoryFilter === '전체'
            const colorMap: Record<string, { active: string; inactive: string }> = {
              '수업상태변경': { active: 'bg-amber-300 text-amber-900 border-amber-400', inactive: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' },
              '승인필요': { active: 'bg-green-400 text-green-900 border-green-500', inactive: 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' },
              '거부/제외': { active: 'bg-red-600 text-white border-red-700', inactive: 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200' },
            }
            const custom = colorMap[f]
            return (
              <button
                key={f}
                onClick={() => { setFilter(f); setCategoryFilter('전체') }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? (custom?.active ?? 'bg-yellow-400 text-black')
                    : (custom?.inactive ?? 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50')
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
                  const progress = progressCache.infoMap.get(a.id) ?? { label: '대기', color: 'bg-gray-100 text-gray-700' }
                  const nextSession = getNextSessionNumber(a)
                  const nextScheduled = a.sessions?.find((s) => s.session_number === nextSession && s.scheduled_at && !s.completed_at)

                  const isExpanded = expandedId === a.id

                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-200 overflow-hidden"
                    >
                      <div
                        className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          const next = isExpanded ? null : a.id
                          setExpandedId(next)
                          if (next) loadExpandedData(a.member_id, a.id)
                        }}
                      >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{a.member.name}</span>
                          {a.is_excluded && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">제외</span>
                          )}
                          {a.member.registration_source === '수기' && (
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">수기</span>
                          )}
                          {a.member.registration_source === '플로팅' && (
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">플로팅</span>
                          )}
                          {trainerId && trainerId !== 'unassigned' && (() => {
                            if (trainerId === 'excluded') {
                              // 제외 폴더: 실제 담당 기준으로 PT/PPT 표시
                              const badges = []
                              if (a.pt_trainer_id) badges.push({ role: 'PT', color: 'bg-blue-50 text-blue-700 border-blue-300' })
                              if (a.ppt_trainer_id) badges.push({ role: 'PPT', color: 'bg-violet-50 text-violet-700 border-violet-300' })
                              return badges.map((b) => (
                                <Badge key={b.role} variant="outline" className={`text-[10px] px-1.5 font-bold ${b.color}`}>{b.role}</Badge>
                              ))
                            }
                            const isPt = a.pt_trainer_id === trainerId
                            const role = isPt ? 'PT' : 'PPT'
                            return (
                              <Badge variant="outline" className={`text-[10px] px-1.5 font-bold ${
                                isPt
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-violet-50 text-violet-700 border-violet-300'
                              }`}>
                                {role}
                              </Badge>
                            )
                          })()}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 cursor-pointer hover:ring-2 hover:ring-yellow-400 transition-shadow ${progress.color}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              const nextSess = getNextSessionNumber(a)
                              handleCompleteOpen(a, nextSess)
                            }}
                          >
                            {progress.label}
                          </Badge>
                          {(() => {
                            const dday = progressCache.ddayMap.get(a.id)
                            if (!dday) return null
                            return <span className={`text-[10px] font-bold ${dday.color}`}>{dday.text}</span>
                          })()}
                        </div>
                        <div className="text-right text-xs text-gray-500 flex items-center justify-end gap-1.5">
                          {feedbackMap[a.id] && feedbackMap[a.id].length > 0 && (
                            <button
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold text-white transition-all duration-150 bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_2px_0_0_#b45309,0_3px_6px_rgba(180,83,9,0.3)] hover:shadow-[0_1px_0_0_#b45309,0_2px_4px_rgba(180,83,9,0.3)] hover:translate-y-[1px] active:shadow-none active:translate-y-[2px]"
                              onClick={(e) => { e.stopPropagation(); setFeedbackPopup({ name: a.member.name ?? '회원', feedbacks: feedbackMap[a.id] }) }}
                            >
                              피드백 ({feedbackMap[a.id].length})
                            </button>
                          )}
                          {a.is_sales_target && (
                            <Badge className="text-[10px] px-1.5 bg-purple-600 text-white border-purple-600 font-bold">★ 매출대상</Badge>
                          )}
                          {a.sales_status === '클로징실패' && (
                            <Badge className="text-[10px] px-1.5 bg-pink-500 text-white border-pink-500 font-bold">클로징실패</Badge>
                          )}
                          {a.is_pt_conversion && (
                            <Badge variant="outline" className="text-[10px] px-1.5 font-bold bg-blue-600 text-white border-blue-600">PT전환</Badge>
                          )}
                          {progressCache.isNewMap.get(a.id) && (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold text-white bg-gradient-to-b from-red-400 to-red-600 shadow-[0_2px_0_0_#991b1b,0_3px_6px_rgba(153,27,27,0.3)]">New</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            배정날짜 :
                            <input
                              type="date"
                              defaultValue={(a.assigned_at || a.created_at) ? format(new Date(a.assigned_at || a.created_at), 'yyyy-MM-dd') : ''}
                              className="bg-transparent border-b border-dashed border-gray-300 text-xs w-28 px-0 py-0 focus:border-blue-500 focus:outline-none cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                if (!e.target.value) return
                                updateOtAssignment(a.id, { assigned_at: new Date(e.target.value + 'T00:00:00+09:00').toISOString() })
                              }}
                            />
                          </span>
                        </div>
                      </div>
                      {/* OT 진행 로그 타임라인 */}
                      {(() => {
                        const log = progressCache.logMap.get(a.id) ?? []
                        if (log.length <= 1) return null
                        return (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10px]">
                            {log.map((entry, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <span className="text-gray-300 mx-0.5">|</span>}
                                <span className={`font-semibold ${entry.color}`}>
                                  {entry.date && <span className="font-normal">{entry.date}/</span>}
                                  {entry.label}
                                </span>
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                      {/* 기본 정보 */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>등록 {a.member.registered_at}</span>
                        <span>시작 {a.member.start_date ?? '-'}</span>
                        {a.member.ot_category && <span>{a.member.ot_category}</span>}
                        {a.member.phone && <span>번호) {a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>}
                        {a.expected_amount > 0 && <span className="text-green-600 font-medium">예상 {toManwon(a.expected_amount).toLocaleString()}만원{a.expected_sessions ? ` (${a.expected_sessions}회)` : ''}</span>}
                        {nextScheduled && <span>OT일정: {nextSession}차 {format(new Date(nextScheduled.scheduled_at!), 'M/d HH:mm')}</span>}
                      </div>
                      {a.notes && (
                        <p className="mt-1 text-[10px] text-orange-700 bg-orange-50 rounded px-2 py-0.5 truncate">📝 {a.notes}</p>
                      )}
                      {(() => {
                        const reason = a.excluded_reason || a.sales_note
                        const status = a.sales_status
                        const isInactive = a.is_excluded || ['연락두절','스케줄미확정','OT거부자','수업후거부','클로징실패'].includes(status)
                        if (!isInactive) return null
                        const label = a.is_excluded ? '거부/제외' : status === 'OT거부자' ? '거부' : status === '수업후거부' ? '수업후 거부' : status
                        return (
                          <p className="mt-1 text-[10px] text-red-600 bg-red-50 rounded px-2 py-0.5 truncate">
                            ⚠️ {label}{reason ? ` — ${reason}` : ''}
                          </p>
                        )
                      })()}
                      </div>

                      {/* 펼침: 상세 + OT 세션 */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                          {/* 상세 정보 — 상담카드 우선, 없으면 회원정보 */}
                          {(() => {
                            const ex = expandedData[a.id]
                            const card = (ex && ex !== 'loading') ? ex.card : null
                            if (card) {
                              // 상담카드 기반 정보 표시
                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-gray-900">📋 상담카드 정보</p>
                                    <div className="flex items-center gap-1.5">
                                      <Button size="sm" className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white" onClick={(e) => { e.stopPropagation(); setCardDetailTarget(card) }}>
                                        <ClipboardList className="h-3 w-3 mr-1" />상세 보기
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                    <div><p className="text-xs text-gray-500">연락처</p><p className="font-medium">{card.member_phone ?? a.member.phone?.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') ?? '-'}</p></div>
                                    <div><p className="text-xs text-gray-500">성별</p><p className="font-medium">{card.member_gender ?? a.member.gender ?? '-'}</p></div>
                                    <div><p className="text-xs text-gray-500">나이</p><p className="font-medium">{card.age ?? '-'}</p></div>
                                    <div><p className="text-xs text-gray-500">PT담당</p><p className="font-medium">{a.pt_trainer?.name ?? '미배정'}</p></div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-800">
                                    {card.exercise_goals?.length > 0 && <p><span className="font-bold text-gray-600">운동목적:</span> {card.exercise_goals.join(', ')}{card.exercise_goal_detail ? ` — ${card.exercise_goal_detail}` : ''}</p>}
                                    {card.body_correction_area && <p><span className="font-bold text-gray-600">체형교정:</span> {card.body_correction_area}</p>}
                                    {card.medical_conditions?.length > 0 && <p><span className="font-bold text-gray-600">병력:</span> {card.medical_conditions.join(', ')}{card.medical_detail ? ` (${card.medical_detail})` : ''}</p>}
                                    {card.surgery_detail && <p><span className="font-bold text-gray-600">수술:</span> {card.surgery_detail}</p>}
                                    {card.exercise_experiences?.length > 0 && <p><span className="font-bold text-gray-600">운동경험:</span> {card.exercise_experiences.join(', ')}{card.exercise_duration ? ` / ${card.exercise_duration}` : ''}</p>}
                                    {card.exercise_time_preference && <p><span className="font-bold text-gray-600">선호시간:</span> {card.exercise_time_preference}</p>}
                                    {card.desired_body_type && <p><span className="font-bold text-gray-600">원하는 체형:</span> {card.desired_body_type}</p>}
                                    {card.exercise_personality?.length > 0 && <p><span className="font-bold text-gray-600">운동성향:</span> {card.exercise_personality.join(', ')}</p>}
                                    {card.occupation && <p><span className="font-bold text-gray-600">직업:</span> {card.occupation}</p>}
                                    {card.residence_area && <p><span className="font-bold text-gray-600">거주지:</span> {card.residence_area}</p>}
                                    {card.registration_product && <p><span className="font-bold text-gray-600">등록상품:</span> {card.registration_product}</p>}
                                    {card.pt_satisfaction && <p><span className="font-bold text-gray-600">PT만족도:</span> {card.pt_satisfaction}{card.pt_satisfaction_reason ? ` — ${card.pt_satisfaction_reason}` : ''}</p>}
                                    {card.referral_sources?.length > 0 && <p><span className="font-bold text-gray-600">유입경로:</span> {card.referral_sources.join(', ')}{card.referral_detail ? ` (${card.referral_detail})` : ''}</p>}
                                  </div>
                                  {card.special_notes && (
                                    <div className="rounded-md bg-red-50 border border-red-200 p-2.5 mt-2">
                                      <p className="text-[10px] text-red-500 font-bold mb-0.5">특이사항</p>
                                      <p className="text-sm text-red-800 whitespace-pre-wrap">{card.special_notes}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            }
                            // 상담카드 없으면 기존 회원정보
                            return (
                              <>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-bold text-gray-900">회원 정보</p>
                                  <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={(e) => { e.stopPropagation(); openLinkCard(a) }}>
                                    <ClipboardList className="h-3 w-3 mr-1" />상담카드 연결
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                  <div><p className="text-xs text-gray-500">연락처</p><p className="font-medium">{a.member.phone ? a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</p></div>
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
                              </>
                            )
                          })()}

                          {/* 특이사항 메모 (수정 가능) */}
                          {(() => {
                            const noteId = `note-${a.id}`
                            const isEditing = editingNoteId === a.id
                            const hasNotes = !!a.notes
                            return (
                          <div className={`rounded-lg border p-3 space-y-2 ${hasNotes && !isEditing ? 'border-orange-300 bg-orange-50/80' : 'border-orange-200 bg-orange-50/50'}`} onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-orange-800">📝 특이사항</p>
                              {hasNotes && !isEditing && (
                                <Badge className="bg-orange-500 text-white text-[10px]">기록됨</Badge>
                              )}
                            </div>
                            {hasNotes && !isEditing ? (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap"><span className="font-bold text-orange-700">내용:</span> {a.notes}</p>
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={() => setEditingNoteId(a.id)}
                                >
                                  수정하기
                                </button>
                              </div>
                            ) : (
                              <>
                                <Textarea
                                  id={noteId}
                                  defaultValue={a.notes ?? ''}
                                  placeholder="환불, 부상, 회원 특이사항 등을 기록하세요"
                                  rows={2}
                                  className="text-sm bg-white border-orange-200"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-gray-500 border-gray-300 bg-white hover:bg-gray-100"
                                    onClick={() => { const el = document.getElementById(noteId) as HTMLTextAreaElement | null; if (el) el.value = a.notes ?? ''; setEditingNoteId(null) }}
                                  >취소</Button>
                                  <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                                    onClick={() => {
                                      const el = document.getElementById(noteId) as HTMLTextAreaElement | null
                                      const val = el?.value.trim() ?? ''
                                      updateOtAssignment(a.id, { notes: val || null }).then(() => { startTransition(() => router.refresh()); setEditingNoteId(null) })
                                    }}
                                  >저장</Button>
                                </div>
                              </>
                            )}
                          </div>
                            )
                          })()}

                          {/* 상담카드 요약 + 세일즈 여정 */}
                          <div onClick={(e) => e.stopPropagation()} className="space-y-4">
                            {(() => {
                              const ex = expandedData[a.id]
                              if (ex === 'loading' || !ex) {
                                return <p className="text-xs text-gray-400">상담/세일즈 정보 불러오는 중...</p>
                              }
                              const card = ex.card
                              const programSessions = ex.program?.sessions ?? []
                              const journey: { label: string; date?: string; status?: string; detail?: string }[] = []
                              programSessions.forEach((s, i) => {
                                const status = s.sales_status || (s.completed ? 'OT완료' : null)
                                if (!status && !s.sales_note && !s.is_sales_target && !s.is_pt_conversion && !s.closing_fail_reason) return
                                journey.push({
                                  label: `${i + 1}차 OT`,
                                  date: s.date || undefined,
                                  status: status ?? '',
                                  detail: [
                                    s.is_sales_target ? '매출대상 지정' : null,
                                    s.is_pt_conversion ? `PT 전환${s.pt_sales_amount ? ` · ${s.pt_sales_amount}만원` : ''}` : null,
                                    s.closing_probability ? `클로징 ${s.closing_probability}%` : null,
                                    s.expected_amount ? `예상 ${toManwon(s.expected_amount).toLocaleString()}만` : null,
                                    s.expected_sessions ? `${s.expected_sessions}회` : null,
                                    s.closing_fail_reason ? `실패: ${s.closing_fail_reason}` : null,
                                    s.sales_note ? s.sales_note : null,
                                  ].filter(Boolean).join(' · '),
                                })
                              })
                              const statusBadgeColor = (st?: string) => {
                                switch (st) {
                                  case '등록완료': return 'bg-green-600 text-white'
                                  case '클로징실패': return 'bg-red-500 text-white'
                                  case '거부자':
                                  case 'OT거부자': return 'bg-orange-500 text-white'
                                  case '연락두절': return 'bg-gray-500 text-white'
                                  case '매출대상': return 'bg-purple-600 text-white'
                                  case 'OT완료': return 'bg-emerald-500 text-white'
                                  default: return 'bg-gray-400 text-white'
                                }
                              }
                              // OT 진행 현황 — ot_sessions + program sessions 병합
                              const maxNum = Math.max(
                                0,
                                ...(a.sessions?.map((s) => s.session_number) ?? []),
                                programSessions.length,
                              )
                              const otProgress = Array.from({ length: maxNum }, (_, i) => {
                                const num = i + 1
                                const ot = a.sessions?.find((s) => s.session_number === num)
                                const prog = programSessions[i]
                                // 수업 날짜: 프로그램의 date 필드(트레이너가 입력한 실제 수업일) 우선
                                const progDate = prog?.date ?? null // 예: "2026-04-22"
                                return {
                                  num,
                                  scheduled_at: ot?.scheduled_at ?? null,
                                  completed_at: ot?.completed_at ?? null,
                                  approval_status: prog?.approval_status ?? null,
                                  inbody: prog?.inbody ?? false,
                                  prog_date: progDate,
                                }
                              })
                              const completedCount = otProgress.filter((s) => s.completed_at).length

                              return (
                                <>
                                  {/* 미진행 처리 (거부/제외 · 연락두절 · 스케줄미확정) */}
                                  {(() => {
                                    const isEditing = quickStatusTarget === a.id
                                    const currentStatus = a.sales_status
                                    const isExcluded = a.is_excluded
                                    const isInactive = isExcluded || ['OT거부자', '연락두절', '스케줄미확정', '수업후거부'].includes(currentStatus)
                                    const statusLabel = isExcluded ? '거부/제외' : currentStatus === 'OT거부자' ? '거부/제외' : currentStatus === '수업후거부' ? '수업후 거부' : currentStatus === '연락두절' ? '연락두절' : currentStatus === '스케줄미확정' ? '스케줄미확정' : ''
                                    const QUICK_STATUSES = ['거부/제외', '수업후 거부', '연락두절', '스케줄미확정']
                                    return (
                                  <div className={`rounded-lg border p-4 space-y-2 ${isInactive ? 'border-red-300 bg-red-50/60' : 'border-gray-200 bg-gray-50/40'}`}>
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <p className="text-sm font-bold text-gray-800">⚠️ 미진행 처리</p>
                                      {isInactive && !isEditing && (
                                        <Badge className="bg-red-500 text-white text-[10px]">{statusLabel}</Badge>
                                      )}
                                    </div>
                                    {isInactive && !isEditing && (
                                      <div className="space-y-1">
                                        {(a.excluded_reason || a.sales_note) && (
                                          <p className="text-xs text-gray-700"><span className="font-bold">사유:</span> {a.excluded_reason || a.sales_note}</p>
                                        )}
                                        <button
                                          type="button"
                                          className="text-xs text-blue-600 hover:underline"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setQuickStatusTarget(a.id)
                                            setQuickStatusValue(statusLabel)
                                            setQuickStatusReason(a.excluded_reason || a.sales_note || '')
                                          }}
                                        >
                                          수정하기
                                        </button>
                                      </div>
                                    )}
                                    {!isInactive && !isEditing && (
                                      <div className="flex gap-2">
                                        {QUICK_STATUSES.map((s) => (
                                          <button
                                            key={s}
                                            type="button"
                                            className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setQuickStatusTarget(a.id)
                                              setQuickStatusValue(s)
                                              setQuickStatusReason('')
                                            }}
                                          >
                                            {s}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {isEditing && (
                                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-2">
                                          {QUICK_STATUSES.map((s) => (
                                            <button
                                              key={s}
                                              type="button"
                                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                quickStatusValue === s
                                                  ? 'bg-red-500 text-white'
                                                  : 'border border-gray-300 bg-white text-gray-600 hover:bg-red-50'
                                              }`}
                                              onClick={() => setQuickStatusValue(s)}
                                            >
                                              {s}
                                            </button>
                                          ))}
                                        </div>
                                        <textarea
                                          value={quickStatusReason}
                                          onChange={(e) => setQuickStatusReason(e.target.value)}
                                          placeholder="사유를 입력해주세요"
                                          className="w-full rounded-md border border-gray-300 bg-white text-sm text-gray-900 p-2 h-20 resize-none"
                                        />
                                        <div className="flex gap-2 justify-end">
                                          {isInactive && (
                                            <Button
                                              size="sm"
                                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                              disabled={quickStatusLoading}
                                              onClick={() => {
                                                setQuickStatusTarget(null)
                                                updateOtAssignment(a.id, {
                                                  sales_status: 'OT진행중',
                                                  status: '배정완료',
                                                  is_excluded: false,
                                                  excluded_reason: null,
                                                  excluded_at: null,
                                                  sales_note: null,
                                                }).then(() => startTransition(() => router.refresh()))
                                              }}
                                            >
                                              미진행 해제
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs text-gray-500 border-gray-300 bg-white hover:bg-gray-100"
                                            onClick={() => setQuickStatusTarget(null)}
                                          >
                                            취소
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                                            disabled={quickStatusLoading || !quickStatusValue}
                                            onClick={() => {
                                              // 값을 먼저 캡처 (state 초기화 전)
                                              const selectedStatus = quickStatusValue
                                              const reason = quickStatusReason
                                              setQuickStatusTarget(null)
                                              // 서버 저장은 백그라운드
                                              if (selectedStatus === '거부/제외') {
                                                updateOtAssignment(a.id, {
                                                  sales_status: 'OT거부자',
                                                  status: '거부',
                                                  sales_note: reason || null,
                                                }).then(() => startTransition(() => router.refresh()))
                                              } else if (selectedStatus === '수업후 거부') {
                                                updateOtAssignment(a.id, {
                                                  sales_status: '수업후거부',
                                                  sales_note: reason || null,
                                                }).then(() => startTransition(() => router.refresh()))
                                              } else {
                                                updateOtAssignment(a.id, {
                                                  sales_status: selectedStatus as SalesStatus,
                                                  sales_note: reason || null,
                                                }).then(() => startTransition(() => router.refresh()))
                                              }
                                            }}
                                          >
                                            {quickStatusLoading ? '저장 중...' : '저장'}
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                    )
                                  })()}

                                  {/* 세일즈 정보 (통합) */}
                                  {(() => {
                                    const so = salesOverrides[a.id]
                                    const isSalesTarget = so?.is_sales_target ?? a.is_sales_target
                                    const isPtConversion = so?.is_pt_conversion ?? (a.is_pt_conversion || programSessions.some((s) => s.is_pt_conversion))
                                    const currentSalesStatus = so?.sales_status ?? a.sales_status
                                    const isClosingFail = currentSalesStatus === '클로징실패'
                                    const salesFormId = `sf-${a.id}`
                                    // 취소: 버튼 상태 + 입력값 모두 원래대로
                                    const handleSalesCancel = () => {
                                      setSalesOverrides((prev) => { const copy = { ...prev }; delete copy[a.id]; return copy })
                                      // 입력값 리셋
                                      const els = {
                                        sessions: document.getElementById(`${salesFormId}-sessions`) as HTMLInputElement | null,
                                        amount: document.getElementById(`${salesFormId}-amount`) as HTMLInputElement | null,
                                        prob: document.getElementById(`${salesFormId}-prob`) as HTMLInputElement | null,
                                        ptSessions: document.getElementById(`${salesFormId}-pt-sessions`) as HTMLInputElement | null,
                                        ptAmount: document.getElementById(`${salesFormId}-pt-amount`) as HTMLInputElement | null,
                                        failReason: document.getElementById(`${salesFormId}-fail`) as HTMLTextAreaElement | null,
                                      }
                                      if (els.sessions) els.sessions.value = String(a.expected_sessions || '')
                                      if (els.amount) els.amount.value = a.expected_amount ? String(toManwon(a.expected_amount)) : ''
                                      if (els.prob) els.prob.value = a.closing_probability ? `${a.closing_probability}%` : ''
                                      if (els.ptSessions) els.ptSessions.value = String(a.expected_sessions || '')
                                      if (els.ptAmount) els.ptAmount.value = a.actual_sales ? String(toManwon(a.actual_sales)) : ''
                                      if (els.failReason) els.failReason.value = a.closing_fail_reason ?? ''
                                    }
                                    // 저장: 버튼 상태 + 입력값 한번에
                                    const handleSalesSave = () => {
                                      const update: Record<string, unknown> = {
                                        is_sales_target: isSalesTarget,
                                        is_pt_conversion: isPtConversion,
                                      }
                                      if (isClosingFail) {
                                        update.sales_status = '클로징실패'
                                        const el = document.getElementById(`${salesFormId}-fail`) as HTMLTextAreaElement | null
                                        update.closing_fail_reason = el?.value.trim() || null
                                      } else if (isPtConversion) {
                                        update.sales_status = '등록완료'
                                      }
                                      if (isSalesTarget) {
                                        update.expected_sessions = Number((document.getElementById(`${salesFormId}-sessions`) as HTMLInputElement)?.value) || 0
                                        update.expected_amount = Number((document.getElementById(`${salesFormId}-amount`) as HTMLInputElement)?.value) || 0
                                        update.closing_probability = Number((document.getElementById(`${salesFormId}-prob`) as HTMLInputElement)?.value.replace('%', '')) || 0
                                      }
                                      if (isPtConversion) {
                                        update.expected_sessions = Number((document.getElementById(`${salesFormId}-pt-sessions`) as HTMLInputElement)?.value) || update.expected_sessions || 0
                                        update.actual_sales = Number((document.getElementById(`${salesFormId}-pt-amount`) as HTMLInputElement)?.value) || 0
                                      }
                                      updateOtAssignment(a.id, update).then(() => startTransition(() => router.refresh()))
                                    }
                                    return (
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-sm font-bold text-emerald-800">💰 세일즈 정보</p>

                                    {/* 상태 버튼: 매출대상자 / PT전환 / 클로징실패 — 클릭은 로컬 상태만 변경 */}
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <button type="button"
                                        className={`h-10 rounded-lg border-2 text-sm font-bold transition-colors ${isSalesTarget ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-purple-200 text-purple-600'}`}
                                        onClick={() => setSalesOverrides((prev) => ({ ...prev, [a.id]: { ...prev[a.id], is_sales_target: !isSalesTarget } }))}
                                      >★ 매출대상자 {isSalesTarget ? '✓' : ''}</button>
                                      <button type="button"
                                        className={`h-10 rounded-lg border-2 text-sm font-bold transition-colors ${isPtConversion ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200'}`}
                                        onClick={() => setSalesOverrides((prev) => ({ ...prev, [a.id]: { ...prev[a.id], is_pt_conversion: !isPtConversion, ...(isPtConversion ? { sales_status: 'OT진행중' } : { sales_status: '등록완료' }) } }))}
                                      >PT전환 {isPtConversion ? '✓' : ''}</button>
                                      <button type="button"
                                        className={`h-10 rounded-lg border-2 text-sm font-bold transition-colors ${isClosingFail ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-500 border-red-200'}`}
                                        onClick={() => setSalesOverrides((prev) => ({ ...prev, [a.id]: { ...prev[a.id], is_pt_conversion: false, sales_status: isClosingFail ? 'OT진행중' : '클로징실패' } }))}
                                      >클로징실패 {isClosingFail ? '✓' : ''}</button>
                                    </div>

                                    {/* 매출대상자: 예상횟수, 예상금액, 클로징확률 */}
                                    {isSalesTarget && (
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                          <p className="text-gray-500 mb-1">예상 횟수</p>
                                          <Input id={`${salesFormId}-sessions`} type="number" defaultValue={a.expected_sessions || ''} placeholder="회" className="h-8 text-xs bg-white text-gray-900 border-gray-300" />
                                        </div>
                                        <div>
                                          <p className="text-gray-500 mb-1">예상 금액 (만원)</p>
                                          <Input id={`${salesFormId}-amount`} type="number" defaultValue={a.expected_amount ? toManwon(a.expected_amount) : ''} placeholder="만원" className="h-8 text-xs bg-white text-gray-900 border-gray-300" />
                                        </div>
                                        <div>
                                          <p className="text-gray-500 mb-1">클로징 확률</p>
                                          <Input id={`${salesFormId}-prob`} type="text" defaultValue={a.closing_probability ? `${a.closing_probability}%` : ''} placeholder="%" className="h-8 text-xs bg-white text-gray-900 border-gray-300" />
                                        </div>
                                      </div>
                                    )}

                                    {/* PT전환: 클로징횟수, 클로징금액 */}
                                    {isPtConversion && (
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <p className="text-blue-600 mb-1 font-bold">클로징 횟수</p>
                                          <Input id={`${salesFormId}-pt-sessions`} type="number" defaultValue={a.expected_sessions || ''} placeholder="회" className="h-8 text-xs bg-white text-gray-900 border-blue-300" />
                                        </div>
                                        <div>
                                          <p className="text-blue-600 mb-1 font-bold">클로징 금액 (만원)</p>
                                          <Input id={`${salesFormId}-pt-amount`} type="number" defaultValue={a.actual_sales ? toManwon(a.actual_sales) : ''} placeholder="만원" className="h-8 text-xs bg-white text-gray-900 border-blue-300" />
                                        </div>
                                      </div>
                                    )}

                                    {/* 클로징실패: 사유 입력 */}
                                    {isClosingFail && (
                                      <div className="text-xs space-y-1">
                                        <p className="text-red-600 font-bold">실패 사유</p>
                                        <textarea
                                          id={`${salesFormId}-fail`}
                                          defaultValue={a.closing_fail_reason ?? ''}
                                          placeholder="클로징 실패 사유를 입력해주세요"
                                          className="w-full rounded-md border border-red-300 bg-white text-sm text-gray-900 p-2 h-16 resize-none"
                                        />
                                      </div>
                                    )}

                                    {a.sales_note && (
                                      <div className="rounded-lg border border-emerald-300 bg-white p-3 space-y-1">
                                        <div className="flex items-center gap-2">
                                          <p className="font-bold text-emerald-700 text-sm">세일즈 메모</p>
                                          <Badge className="bg-emerald-500 text-white text-[10px]">기록됨</Badge>
                                        </div>
                                        <p className="text-sm text-gray-900 whitespace-pre-wrap"><span className="font-bold text-emerald-700">내용:</span> {a.sales_note}</p>
                                      </div>
                                    )}

                                    {/* 통합 저장/취소 버튼 */}
                                    <div className="flex gap-2 justify-end border-t border-emerald-200 pt-3">
                                      <Button size="sm" variant="outline" className="h-8 px-4 text-xs text-gray-500 border-gray-300 bg-white hover:bg-gray-100 font-bold"
                                        onClick={handleSalesCancel}
                                      >취소</Button>
                                      <Button size="sm" className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                        onClick={handleSalesSave}
                                      >저장</Button>
                                    </div>
                                  </div>
                                    )
                                  })()}

                                  {/* 관리자 피드백 요약 — 모든 세션의 admin_feedback을 한 박스에 모아 표시 */}
                                  {(() => {
                                    const feedbacks = programSessions
                                      .map((s, i) => ({ idx: i, text: s.admin_feedback, status: s.approval_status }))
                                      .filter((f) => f.text && f.text.trim())
                                    if (feedbacks.length === 0) return null
                                    return (
                                      <div className="rounded-lg border-2 border-blue-300 bg-blue-50/60 p-4 space-y-2">
                                        <p className="text-sm font-bold text-blue-800">📋 관리자 피드백</p>
                                        <div className="space-y-2">
                                          {feedbacks.map((f) => (
                                            <div key={f.idx} className="bg-white rounded border border-blue-200 p-2">
                                              <div className="flex items-center gap-2 mb-1">
                                                <Badge className="bg-blue-600 text-white text-[10px]">{f.idx + 1}차</Badge>
                                                {f.status && f.status !== '작성중' && (
                                                  <Badge className={`text-[10px] text-white ${
                                                    f.status === '승인' ? 'bg-green-600'
                                                    : f.status === '반려' ? 'bg-red-500'
                                                    : 'bg-yellow-500'
                                                  }`}>{f.status}</Badge>
                                                )}
                                              </div>
                                              <p className="text-xs text-gray-800 whitespace-pre-wrap">{f.text}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </>
                              )
                            })()}

                          </div>

                          {/* (구) OT 일정 UI — 스케줄 탭으로 이동됨 */}
                          <div style={{ display: 'none' }} onClick={(e) => e.stopPropagation()}>
                            <p className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <CalendarDays className="h-5 w-5" />
                              OT 일정
                            </p>
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                              {Array.from({ length: Math.max(3, ...(a.sessions?.map(ss => ss.session_number) ?? [0]), scheduleEdit?.assignmentId === a.id ? scheduleEdit.sessionNumber : 0) }, (_, i) => i + 1).map((num) => {
                                const s = a.sessions?.find((ss) => ss.session_number === num)
                                const isDone = !!s?.completed_at
                                const isScheduled = !!s?.scheduled_at && !s?.completed_at
                                const isEditingCompleted = editingCompletedSession?.assignmentId === a.id && editingCompletedSession?.sessionNumber === num
                                const isEditingThis = scheduleEdit?.assignmentId === a.id && scheduleEdit?.sessionNumber === num
                                const localDate = isEditingThis ? scheduleEdit!.date : (s?.scheduled_at ? format(new Date(s.scheduled_at), 'yyyy-MM-dd') : '')
                                const localTime = isEditingThis ? scheduleEdit!.time : (s?.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '')
                                const localFeedback = isEditingThis ? scheduleEdit?.feedback ?? (s?.feedback ?? '') : (s?.feedback ?? '')
                                const ensureEdit = (patch: Partial<typeof scheduleEdit>) => {
                                  const base = scheduleEdit?.assignmentId === a.id && scheduleEdit?.sessionNumber === num
                                    ? scheduleEdit
                                    : { assignmentId: a.id, sessionNumber: num, date: localDate, time: localTime, feedback: localFeedback, duration: 30 }
                                  setScheduleEdit({ ...base, ...patch })
                                }

                                return (
                                  <div key={num} className={`rounded-lg border-2 p-4 space-y-3 ${
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
                                            setScheduleEdit({ assignmentId: a.id, sessionNumber: num, date: localDate, time: localTime, feedback: localFeedback, duration: 30 })
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
                                            onChange={(e) => ensureEdit({ date: e.target.value })}
                                            className="h-9 text-sm bg-white border-gray-300"
                                          />
                                        </div>

                                        {/* 시간 버튼 그리드 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            시간
                                          </p>
                                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                            {TIME_SLOTS.map((slot) => (
                                              <button
                                                key={slot}
                                                type="button"
                                                className={`rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                                                  localTime === slot
                                                    ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                                onClick={() => ensureEdit({ time: slot })}
                                              >
                                                {slot}
                                              </button>
                                            ))}
                                          </div>
                                          {/* 10분 단위 수동 입력 (10분 단위로 step) */}
                                          <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-gray-500 shrink-0">직접 입력</span>
                                            <Input
                                              type="time"
                                              step={600}
                                              value={localTime}
                                              onChange={(e) => ensureEdit({ time: e.target.value })}
                                              className="h-8 text-xs bg-white border-gray-300 w-32"
                                            />
                                          </div>
                                          {a.member.exercise_time && (
                                            <p className="text-xs text-blue-600 mt-1">회원 희망: {a.member.exercise_time}</p>
                                          )}
                                        </div>

                                        {/* 수업시간 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600">수업시간</p>
                                          <div className="flex gap-2">
                                            {[30, 50].map((d) => (
                                              <button
                                                key={d}
                                                type="button"
                                                className={`flex-1 rounded-md border px-3 py-2 text-sm font-bold transition-colors ${
                                                  (scheduleEdit?.duration ?? 30) === d
                                                    ? 'bg-yellow-400 text-black border-yellow-400'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                                onClick={() => ensureEdit({ duration: d })}
                                              >
                                                {d}분
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        {/* 피드백 */}
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-gray-600">피드백</p>
                                          <textarea
                                            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y min-h-[60px]"
                                            placeholder="회원 피드백을 입력하세요"
                                            value={localFeedback}
                                            onChange={(e) => ensureEdit({ feedback: e.target.value })}
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
                                                // KST(+09:00) 명시로 사용자 로컬 타임존 영향 제거
                                                scheduled_at: new Date(`${localDate}T${localTime}:00+09:00`).toISOString(),
                                                feedback: localFeedback || null,
                                                duration: scheduleEdit?.duration ?? 30,
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
                                                }).then((res) => {
                                                  if (res && 'error' in res && res.error) {
                                                    alert('완료 취소 실패: ' + res.error)
                                                  }
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
                                className="mt-3 w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-yellow-400 hover:text-yellow-600 transition-colors flex items-center justify-center gap-1"
                                onClick={() => {
                                  const maxSession = Math.max(3, ...(a.sessions?.map(s => s.session_number) ?? [0]))
                                  const newNum = maxSession + 1
                                  setScheduleEdit({ assignmentId: a.id, sessionNumber: newNum, date: '', time: '', feedback: '', duration: 30 })
                                }}
                              >
                                <Plus className="h-4 w-4" /> 세션 추가 ({Math.max(3, ...(a.sessions?.map(s => s.session_number) ?? [0])) + 1}차)
                              </button>
                            )}
                          </div>

                          {/* 퀵 액션 */}
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={(e) => { e.stopPropagation(); handleCompleteOpen(a, getNextSessionNumber(a)) }}>
                              <ClipboardList className="h-4 w-4 mr-1" />프로그램
                            </Button>
                            {(() => {
                              const ex = expandedData[a.id]
                              const progSessions = ex && ex !== 'loading' ? (ex.program?.sessions ?? []) : []
                              const completedCount = a.sessions?.filter((s) => s.completed_at).length ?? 0
                              // 제출/승인/반려까지 포함한 최대 진행 차수 (완료 여부와 무관하게 다음 차수 계산)
                              const progressedSessionNumbers = progSessions
                                .map((s, i) => (s.approval_status && s.approval_status !== '작성중' ? i + 1 : 0))
                                .filter((n) => n > 0)
                              const maxProgressed = Math.max(completedCount, ...progressedSessionNumbers, 0)
                              const nextNumber = Math.min(maxProgressed + 1, 3)

                              // 최신 진행 세션의 상태 (배지용)
                              const lastIdx = maxProgressed - 1
                              const lastProgSession = lastIdx >= 0 ? progSessions[lastIdx] : null
                              const lastApproval = lastProgSession?.approval_status
                              const isCompleted = lastIdx >= 0 && (a.sessions?.find((s) => s.session_number === maxProgressed)?.completed_at)

                              const statusLabel =
                                maxProgressed === 0 ? null
                                : lastApproval === '승인' ? `OT${maxProgressed}차 승인완료`
                                : lastApproval === '반려' ? `OT${maxProgressed}차 반려`
                                : lastApproval === '제출완료' ? `OT${maxProgressed}차 제출완료`
                                : isCompleted ? `OT${maxProgressed}차 완료`
                                : null
                              const statusColor =
                                lastApproval === '승인' ? 'bg-green-600 text-white'
                                : lastApproval === '반려' ? 'bg-red-500 text-white'
                                : lastApproval === '제출완료' ? 'bg-yellow-500 text-white'
                                : 'bg-emerald-500 text-white'

                              // 미승인 세션: progSessions + ot_sessions 양쪽에서 완료 여부 확인
                              const otSessions = a.sessions ?? []
                              const unapprovedSessions = progSessions.length > 0
                                ? progSessions.map((s, i) => {
                                    const otDone = !!otSessions.find((os) => os.session_number === i + 1 && os.completed_at)
                                    return { idx: i, status: s.approval_status, completed: s.completed || otDone }
                                  }).filter((s) => s.completed && s.status !== '승인')
                                : []
                              const programId = ex && ex !== 'loading' ? ex.program?.id : null
                              const showApproveBtn = isAdmin && ((unapprovedSessions.length > 0 && programId) || needApprovalSet.has(a.id))

                              return (
                                <>
                                  {showApproveBtn && (
                                    <Button
                                      size="sm"
                                      className="bg-amber-600 hover:bg-amber-700 text-white"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        // programId가 없으면 먼저 로드
                                        let pid = programId
                                        let sessionsToApprove = unapprovedSessions
                                        if (!pid) {
                                          const prog = await getOtProgram(a.id)
                                          if (!prog?.id) { alert('프로그램을 찾을 수 없습니다'); return }
                                          pid = prog.id
                                          const ots = a.sessions ?? []
                                          sessionsToApprove = (prog.sessions ?? []).map((s, i) => {
                                            const otDone = !!ots.find((os) => os.session_number === i + 1 && os.completed_at)
                                            return { idx: i, status: s.approval_status, completed: s.completed || otDone }
                                          }).filter((s) => s.completed && s.status !== '승인')
                                        }
                                        if (sessionsToApprove.length === 0) { alert('승인할 세션이 없습니다'); return }
                                        if (!confirm(`${a.member.name}의 미승인 ${sessionsToApprove.length}건을 모두 승인하시겠습니까?`)) return
                                        for (const s of sessionsToApprove) {
                                          await approveOtSession(pid, s.idx, '임의승인')
                                        }
                                        setNeedApprovalSet((prev) => { const next = new Set(prev); next.delete(a.id); return next })
                                        setExpandedData((prev) => { const copy = { ...prev }; delete copy[a.id]; return copy })
                                        router.refresh()
                                      }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />OT임의승인 {unapprovedSessions.length > 0 ? `(${unapprovedSessions.length})` : ''}
                                    </Button>
                                  )}
                                </>
                              )
                            })()}
                            <Button size="sm" variant="outline" className="text-white bg-gray-800 border-gray-700" onClick={(e) => { e.stopPropagation(); router.push(`/ot/${a.id}`) }}>
                              로그기록
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

      {/* 완료 처리 — OT 프로그램 팝업 (조건부 렌더링: 모바일 DOM 경량화) */}
      {!!completeTarget && <Dialog open onOpenChange={(open) => {
        if (!open) {
          const dirty = programFormRef.current?.isDirty?.() ?? false
          if (dirty) {
            const choice = window.confirm('변경사항이 있습니다. 저장하시겠습니까?\n\n확인: 저장 후 닫기\n취소: 저장하지 않고 닫기')
            if (choice) {
              programFormRef.current?.saveData().then(() => {
                startTransition(() => router.refresh())
              })
            }
          }
          setCompleteTarget(null)
          // 닫을 때 항상 최신 데이터 반영
          startTransition(() => router.refresh())
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              {completeTarget?.assignment.member.name} {completeTarget?.sessionNumber}차 OT 완료
            </DialogTitle>
            <DialogDescription>OT 프로그램을 작성하고 완료 처리해주세요</DialogDescription>
          </DialogHeader>
          {completeProgramLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">불러오는 중...</div>
          ) : completeTarget && profile ? (
            <div className="space-y-4">
              <OtProgramForm
                ref={programFormRef}
                assignment={completeTarget.assignment}
                program={completeProgramData}
                profile={profile}
                hideButtons
                completingSessionIdx={completeTarget.sessionNumber - 1}
                completeLoading={completeLoading}
                initialCard={(() => {
                  const cached = expandedData[completeTarget.assignment.id]
                  return (cached && cached !== 'loading') ? cached.card : null
                })()}
                onCompleteSession={async () => { await handleCompleteSubmit() }}
                onSaved={async () => {
                  const updated = await getOtProgram(completeTarget.assignment.id)
                  setCompleteProgramData(updated)
                  // expandedData 캐시도 갱신
                  setExpandedData((prev) => {
                    const existing = prev[completeTarget.assignment.id]
                    if (!existing || existing === 'loading') return prev
                    return { ...prev, [completeTarget.assignment.id]: { ...existing, program: updated } }
                  })
                  startTransition(() => router.refresh())
                }}
              />
            </div>
          ) : null}
          {!profile && <div className="space-y-4">
            {/* 운동 내용 (프로그램 폼이 없을 때 fallback) */}
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



          </div>}

          {/* 다음 OT 일정 + 결과 분류 + 완료 버튼 (프로그램 폼이 있을 때) */}
          {profile && completeTarget && (
            <div className="space-y-4">



            </div>
          )}
        </DialogContent>
      </Dialog>}

      {/* 회원 정보 퀵뷰 */}
      {!!quickViewTarget && <Dialog open onOpenChange={() => setQuickViewTarget(null)}>
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
                로그기록로 이동
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>}

      {/* 세일즈 편집 바텀시트 */}
      {!!salesTarget && <Dialog open onOpenChange={() => setSalesTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              {salesTarget?.member.name} 세일즈 관리
            </DialogTitle>
            <DialogDescription>OT 현황과 매출 정보를 입력하세요. 차수별 세일즈는 프로그램 팝업의 각 세션 카드에서 작성하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 매출대상자 / PT전환 */}
            <div className="flex gap-3">
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors ${
                  isSalesTarget
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white border-purple-200 text-purple-600'
                }`}
                onClick={() => setIsSalesTarget(!isSalesTarget)}
              >
                매출대상자
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-bold transition-colors ${
                  isPtConversion
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-blue-200 text-blue-600'
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
      </Dialog>}

      {/* 피드백 팝업 */}
      {!!feedbackPopup && <Dialog open onOpenChange={() => setFeedbackPopup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{feedbackPopup.name} - OT 피드백</DialogTitle>
            <DialogDescription>관리자 피드백 ({feedbackPopup.feedbacks.length}건)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {feedbackPopup.feedbacks.map((fb) => (
              <div key={fb.session} className="rounded-lg border border-amber-200 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5">
                  <span className="text-sm font-bold text-white">{fb.session}차 피드백</span>
                </div>
                <div className="bg-amber-50 p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{fb.feedback}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>}

      {/* 회원 추가 다이얼로그 */}
      {showAddMember && <Dialog open onOpenChange={setShowAddMember}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              회원 추가
            </DialogTitle>
            <DialogDescription>새 회원을 등록하고 이 트레이너에 배정합니다</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 담당 역할 */}
            <div className="space-y-2">
              <Label>내 담당 *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-md border py-2.5 text-sm font-bold transition-colors ${
                    addRole === 'pt'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setAddRole('pt')}
                >
                  PT 담당
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md border py-2.5 text-sm font-bold transition-colors ${
                    addRole === 'ppt'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setAddRole('ppt')}
                >
                  PPT 담당
                </button>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addIsFloating}
                  onChange={(e) => setAddIsFloating(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-orange-500"
                />
                <span className="text-sm text-gray-700">플로팅 배정</span>
              </label>
            </div>
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
              <Input value={addCategory} onChange={(e) => setAddCategory(e.target.value)} placeholder="예: 헬스, 필라, 헬스+필라" />
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
                  trainerRole: addRole,
                  registered_at: addDateUnknown ? undefined : addAssignDate || undefined,
                  ot_category: addCategory || null,
                  training_type: addTrainingType || undefined,
                  duration_months: addDuration || null,
                  exercise_time: addExerciseTime || null,
                  exercise_goal: addExerciseGoal || undefined,
                  notes: addNotes || null,
                  registration_source: addIsFloating ? '플로팅' : '수기',
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
      </Dialog>}

      {/* 상담카드 상세 보기 다이얼로그 */}
      {!!cardDetailTarget && <Dialog open onOpenChange={(o) => { if (!o) setCardDetailTarget(null) }}>
        <DialogContent className="w-[100vw] max-w-[100vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 sm:p-0 gap-0 bg-white rounded-none sm:rounded-lg">
          {cardDetailTarget && (() => {
            const c = cardDetailTarget
            const phone = c.member_phone?.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
            const initial = c.member_name?.trim().charAt(0) ?? '?'
            const genderColor = c.member_gender === '여' ? 'from-pink-400 to-rose-500' : c.member_gender === '남' ? 'from-blue-400 to-indigo-500' : 'from-gray-400 to-gray-500'

            const hasAny = (vals: (string | null | undefined | string[])[]) =>
              vals.some((v) => Array.isArray(v) ? v.length > 0 : v != null && v !== '')

            const Field = ({ label, value, full }: { label: string; value?: string | null; full?: boolean }) => {
              if (!value) return null
              return (
                <div className={full ? 'sm:col-span-2' : ''}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{value}</p>
                </div>
              )
            }
            const ChipField = ({ label, values, color, full }: { label: string; values?: string[] | null; color: string; full?: boolean }) => {
              if (!values?.length) return null
              return (
                <div className={full ? 'sm:col-span-2' : ''}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v, i) => (
                      <span key={i} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )
            }
            const Section = ({ title, icon: Icon, accent, children }: { title: string; icon: React.ComponentType<{ className?: string }>; accent: string; children: React.ReactNode }) => (
              <div className="border-t border-gray-100 px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pl-9">
                  {children}
                </div>
              </div>
            )

            const isEmpty = ![
              c.occupation, c.residence_area, c.instagram_id, c.fc_name, c.consultation_date,
              c.registration_product, c.expiry_date, c.exercise_start_date, c.exercise_time_preference,
              c.desired_body_type, c.exercise_goal_detail, c.body_correction_area, c.medical_detail,
              c.surgery_history, c.surgery_detail, c.exercise_experience_detail, c.exercise_experience_history,
              c.exercise_duration, c.pt_satisfaction, c.pt_satisfaction_reason,
              c.referral_sources, c.exercise_goals, c.medical_conditions, c.exercise_experiences,
              c.exercise_personality,
            ].some((v) => Array.isArray(v) ? v.length > 0 : v != null && v !== '')

            return (
              <>
                {/* 히어로 헤더 */}
                <DialogHeader className={`px-6 sm:px-8 pt-8 pb-6 bg-gradient-to-br ${genderColor} text-white`}>
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-3xl font-black shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-2xl font-bold text-white drop-shadow-sm">{c.member_name ?? '-'}</DialogTitle>
                      <DialogDescription className="text-white/90 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                        {c.member_gender && <span>{c.member_gender}</span>}
                        {c.age && <><span>·</span><span>{c.age}</span></>}
                        {phone && <><span>·</span>
                          <a href={`tel:${c.member_phone}`} className="inline-flex items-center gap-1 hover:underline">
                            <Phone className="h-3.5 w-3.5" />{phone}
                          </a>
                        </>}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {isEmpty ? (
                  <p className="text-sm text-gray-500 py-10 text-center">작성된 상담카드 내용이 없습니다.</p>
                ) : (
                  <div>
                    {/* 기본 정보 */}
                    {hasAny([c.occupation, c.residence_area, c.instagram_id]) && (
                      <Section title="기본 정보" icon={User} accent="bg-indigo-100 text-indigo-700">
                        <Field label="직업" value={c.occupation} />
                        <Field label="거주지역" value={c.residence_area} />
                        <Field label="인스타" value={c.instagram_id} />
                      </Section>
                    )}

                    {/* 등록 정보 */}
                    {hasAny([c.fc_name, c.registration_product, c.consultation_date, c.exercise_start_date, c.expiry_date, c.exercise_time_preference]) && (
                      <Section title="등록 정보" icon={ClipboardList} accent="bg-amber-100 text-amber-700">
                        <Field label="담당 FC" value={c.fc_name} />
                        <Field label="등록상품" value={c.registration_product} />
                        <Field label="상담일" value={c.consultation_date} />
                        <Field label="운동시작일" value={c.exercise_start_date} />
                        <Field label="만료일" value={c.expiry_date} />
                        <Field label="선호 운동시간" value={c.exercise_time_preference} />
                      </Section>
                    )}

                    {/* 운동 목표 */}
                    {hasAny([c.exercise_goals, c.exercise_goal_detail, c.desired_body_type, c.body_correction_area, c.referral_sources, c.referral_detail]) && (
                      <Section title="운동 목표 & 유입" icon={Target} accent="bg-emerald-100 text-emerald-700">
                        <ChipField label="운동 목적" values={c.exercise_goals} color="bg-emerald-50 text-emerald-700 border border-emerald-200" full />
                        <Field label="운동 목적 상세" value={c.exercise_goal_detail} full />
                        <Field label="원하는 체형" value={c.desired_body_type} />
                        <Field label="체형교정 부위" value={c.body_correction_area} />
                        <ChipField label="유입경로" values={c.referral_sources} color="bg-sky-50 text-sky-700 border border-sky-200" full />
                        <Field label="유입 상세" value={c.referral_detail} full />
                      </Section>
                    )}

                    {/* 건강 상태 */}
                    {hasAny([c.medical_conditions, c.medical_detail, c.surgery_history, c.surgery_detail]) && (
                      <Section title="건강 상태" icon={HeartPulse} accent="bg-rose-100 text-rose-700">
                        <ChipField label="병력" values={c.medical_conditions} color="bg-rose-50 text-rose-700 border border-rose-200" full />
                        <Field label="병력 상세" value={c.medical_detail} full />
                        <Field label="수술이력" value={c.surgery_history} />
                        <Field label="수술 상세" value={c.surgery_detail} full />
                      </Section>
                    )}

                    {/* 운동 경험 */}
                    {hasAny([c.exercise_experiences, c.exercise_experience_detail, c.exercise_experience_history, c.exercise_duration, c.pt_satisfaction, c.pt_satisfaction_reason, c.exercise_personality]) && (
                      <Section title="운동 경험 & 성향" icon={Dumbbell} accent="bg-purple-100 text-purple-700">
                        <ChipField label="운동 경험" values={c.exercise_experiences} color="bg-purple-50 text-purple-700 border border-purple-200" full />
                        <Field label="경험 상세" value={c.exercise_experience_detail} full />
                        <Field label="경험 이력" value={c.exercise_experience_history} full />
                        <Field label="운동 지속기간" value={c.exercise_duration} />
                        <Field label="PT 만족도" value={c.pt_satisfaction} />
                        <Field label="PT 만족도 사유" value={c.pt_satisfaction_reason} full />
                        <ChipField label="운동 성향" values={c.exercise_personality} color="bg-indigo-50 text-indigo-700 border border-indigo-200" full />
                      </Section>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>}

      {/* N차 일정 잡기 다이얼로그 */}
      {!!scheduleOnlyTarget && <Dialog open onOpenChange={(o) => { if (!o) setScheduleOnlyTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>스케줄 추가</DialogTitle>
            <DialogDescription>
              {scheduleOnlyTarget && (
                <span className="text-sm">
                  <strong className="text-gray-900">{scheduleOnlyTarget.assignment.member.name}</strong> · {scheduleOnlyTarget.sessionNumber}차 OT
                  {scheduleOnlyTarget.assignment.member.phone && (
                    <span className="text-gray-500"> · {scheduleOnlyTarget.assignment.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 일정 종류 (OT 고정 표시) */}
            <div>
              <Label className="text-xs mb-1 block">일정 종류</Label>
              <div className="inline-flex px-4 py-2 rounded-md bg-emerald-100 text-emerald-900 border-2 border-emerald-400 font-bold text-sm">OT</div>
            </div>

            {/* 날짜 */}
            <div className="space-y-1">
              <Label className="text-xs">날짜</Label>
              <Input
                type="date"
                value={scheduleOnlyDate}
                min={today}
                onChange={(e) => setScheduleOnlyDate(e.target.value)}
                className="h-10"
              />
            </div>

            {/* 시작 시간 */}
            <div className="space-y-1">
              <Label className="text-xs">시작 시간</Label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm h-10"
                value={scheduleOnlyTime}
                onChange={(e) => setScheduleOnlyTime(e.target.value)}
              >
                <option value="">시간 선택</option>
                {TIME_SLOTS.map((t) => {
                  const booked = scheduleOnlyDate ? getBookedSlots(scheduleOnlyDate) : new Map()
                  const bookedBy = booked.get(t)
                  return <option key={t} value={t} disabled={!!bookedBy}>{bookedBy ? `${t} (${bookedBy})` : t}</option>
                })}
              </select>
            </div>

            {/* 수업 시간 */}
            <div className="space-y-1">
              <Label className="text-xs">수업 시간</Label>
              <div className="grid grid-cols-2 gap-2">
                {([30, 50] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setScheduleOnlyDuration(d)}
                    className={`h-11 rounded-md border-2 text-sm font-bold transition-colors ${
                      scheduleOnlyDuration === d
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {d}분
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setScheduleOnlyTarget(null)}
                disabled={scheduleOnlyLoading}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                disabled={scheduleOnlyLoading || !scheduleOnlyDate || !scheduleOnlyTime}
                onClick={handleScheduleOnlySave}
              >
                {scheduleOnlyLoading ? '저장 중...' : '일정 저장'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>}

      {/* 상담카드 연결 다이얼로그 (배정된 회원용) */}
      {!!linkCardTarget && <Dialog open onOpenChange={(o) => { if (!o) setLinkCardTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>상담카드 연결</DialogTitle>
            <DialogDescription>
              <strong>{linkCardTarget.member.name}</strong> 회원({linkCardTarget.member.phone ? linkCardTarget.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'})에게 연결할 미연결 상담카드를 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const memberPhoneDigits = (linkCardTarget?.member.phone ?? '').replace(/\D/g, '')
              const memberName = linkCardTarget?.member.name ?? ''
              const list = unlinkedCards.filter((c) => {
                const cp = (c.member_phone ?? '').replace(/\D/g, '')
                return memberPhoneDigits && cp && cp === memberPhoneDigits
              })
              return (
                <>
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    {unlinkedLoading ? (
                      <p className="text-center py-6 text-sm text-gray-400">불러오는 중...</p>
                    ) : list.length === 0 ? (
                      <p className="text-center py-8 text-sm text-gray-500 px-4">
                        이 회원({memberName})의 연락처와 일치하는 미연결 상담카드가 없어요.
                      </p>
                    ) : (
                      list.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b last:border-0 flex justify-between items-center ${linkCardSelectedId === c.id ? 'bg-amber-100' : ''}`}
                          onClick={() => setLinkCardSelectedId(c.id)}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{c.member_name ?? '-'}</span>
                            <Badge className="bg-green-500 text-white text-[10px]">연락처 일치</Badge>
                          </span>
                          <span className="text-gray-400 text-xs">{c.member_phone ? c.member_phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )
            })()}
            <Button
              onClick={handleLinkCardSave}
              disabled={linkCardSaving || !linkCardSelectedId}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {linkCardSaving ? '연결 중...' : '연결하기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>}

      {/* 제외 사유 입력 다이얼로그 */}
      {!!excludeTarget && <Dialog open onOpenChange={() => setExcludeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="h-5 w-5" />
              제외 처리 — {excludeTarget?.member.name}
            </DialogTitle>
            <DialogDescription>제외 사유를 입력해주세요. 제외된 회원은 제외회원 폴더로 이동됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제외 사유 <span className="text-red-500">*</span></Label>
              <Textarea
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                placeholder="환불, 거부, 연락두절 등 사유를 입력해주세요"
                rows={3}
                className="bg-white text-gray-900 border-gray-300"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="text-gray-900 border-gray-400 bg-gray-100 hover:bg-gray-200" onClick={() => setExcludeTarget(null)}>취소</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleExclude}
                disabled={excludeLoading || !excludeReason.trim()}
              >
                {excludeLoading ? '처리 중...' : '제외 처리'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>}
    </>
  )
}
