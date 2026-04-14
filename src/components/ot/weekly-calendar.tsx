'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, X, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateOtAssignment, upsertOtSession, moveOtSchedule } from '@/actions/ot'
// import { OtStatusBadge } from './ot-status-badge'
import type { OtAssignmentWithDetails, OtStatus, SalesStatus } from '@/types'

interface ScheduleItem {
  id: string
  trainer_id: string
  schedule_type: string
  member_name: string
  member_id: string | null
  ot_session_id: string | null
  scheduled_date: string
  start_time: string
  duration: number
  note: string | null
}

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainerId: string
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6) // 06~24
const SLOTS_PER_HOUR = 2 // 30분 단위
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_HEIGHT = 40 // px per 30min
const TOTAL_SLOTS = HOURS.length * SLOTS_PER_HOUR

const TYPE_COLORS: Record<string, string> = {
  OT: 'bg-emerald-200 border-emerald-400 text-emerald-900',
  PT: 'bg-blue-200 border-blue-400 text-blue-900',
  PPT: 'bg-purple-200 border-purple-400 text-purple-900',
  식사: 'bg-orange-200 border-orange-400 text-orange-900',
  홍보: 'bg-pink-200 border-pink-400 text-pink-900',
  간부회의: 'bg-yellow-300 border-yellow-500 text-yellow-900',
  팀회의: 'bg-yellow-200 border-yellow-400 text-yellow-900',
  전체회의: 'bg-amber-200 border-amber-400 text-amber-900',
  간담회: 'bg-indigo-200 border-indigo-400 text-indigo-900',
  당직: 'bg-rose-200 border-rose-400 text-rose-900',
  대외활동: 'bg-teal-200 border-teal-400 text-teal-900',
  유급휴식: 'bg-cyan-200 border-cyan-400 text-cyan-900',
  기타: 'bg-gray-200 border-gray-400 text-gray-900',
}

const SCHEDULE_TYPES = ['OT', 'PT', 'PPT', '식사', '홍보', '간부회의', '팀회의', '전체회의', '간담회', '당직', '대외활동', '유급휴식', '기타'] as const

// OT/PT/PPT 이외의 타입은 시작~종료 시간으로 입력 (duration 자동 계산)
const RANGE_TYPES = new Set(['식사', '홍보', '간부회의', '팀회의', '전체회의', '간담회', '당직', '대외활동', '유급휴식', '기타'])

// PT 수업 상태/결과 옵션 — buildPtNote에서 [수업완료] 같은 prefix로 저장
const PT_CLASS_RESULTS = ['예약완료', '조정중', '수업완료', '노쇼', '차감노쇼', '서비스수업'] as const
type PtClassResult = typeof PT_CLASS_RESULTS[number]

// PT 다이얼로그 + 캘린더 블록의 결과 색상 매핑 — 한 곳에서 관리
const PT_RESULT_BUTTON_COLORS: Record<PtClassResult, string> = {
  '예약완료': 'bg-blue-500 border-blue-500 text-white',
  '조정중': 'bg-gray-500 border-gray-500 text-white',
  '수업완료': 'bg-green-500 border-green-500 text-white',
  '노쇼': 'bg-red-500 border-red-500 text-white',
  '차감노쇼': 'bg-orange-500 border-orange-500 text-white',
  '서비스수업': 'bg-purple-500 border-purple-500 text-white',
}
const PT_RESULT_TEXT_COLORS: Record<PtClassResult, string> = {
  '예약완료': 'text-blue-700',
  '조정중': 'text-gray-700',
  '수업완료': 'text-green-700',
  '노쇼': 'text-red-600',
  '차감노쇼': 'text-red-600',
  '서비스수업': 'text-purple-700',
}

const STATUS_OPTIONS: OtStatus[] = ['신청대기', '배정완료', '진행중', '완료', '거부', '추후결정']

// OT 회원의 sales_status (캘린더 다이얼로그에서 변경 가능 — 진행 상태 외 영업 상태)
// trainer-card-list.tsx의 SALES_STATUSES와 동일
const OT_SALES_STATUSES: { value: SalesStatus; label: string }[] = [
  { value: 'OT진행중', label: '진행중' },
  { value: 'OT거부자', label: '거부자' },
  { value: '등록완료', label: '등록완료' },
  { value: '스케줄미확정', label: '스케줄미확정' },
  { value: '연락두절', label: '연락두절' },
  { value: '클로징실패', label: '클로징실패' },
]
const OT_SALES_BUTTON_COLORS: Record<SalesStatus, string> = {
  'OT진행중': 'bg-green-500 border-green-500 text-white',
  'OT거부자': 'bg-orange-500 border-orange-500 text-white',
  '등록완료': 'bg-blue-500 border-blue-500 text-white',
  '스케줄미확정': 'bg-yellow-500 border-yellow-500 text-white',
  '연락두절': 'bg-gray-500 border-gray-500 text-white',
  '클로징실패': 'bg-red-500 border-red-500 text-white',
}
const OT_SALES_TEXT_COLORS: Record<SalesStatus, string> = {
  'OT진행중': 'text-green-700',
  'OT거부자': 'text-orange-700',
  '등록완료': 'text-blue-700',
  '스케줄미확정': 'text-yellow-700',
  '연락두절': 'text-gray-700',
  '클로징실패': 'text-red-600',
}
const OT_SALES_LABEL: Record<SalesStatus, string> = {
  'OT진행중': '진행중',
  'OT거부자': '거부자',
  '등록완료': '등록완료',
  '스케줄미확정': '스케줄미확정',
  '연락두절': '연락두절',
  '클로징실패': '클로징실패',
}

// ISO timestamp → "M/d HH:mm" KST 표시 (브라우저 TZ 무관)
// Vercel이 UTC라서 server-side 렌더링 시 getHours()가 UTC 시간을 반환하는 문제 회피용
function formatKstShort(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`
}

// PT 스케줄의 note 필드 파싱:
// 형식: "[010-1234-5678] [5/30회] [★] [200만] [수업완료] 메모 본문"
// - [전화번호] [N/M회] [★(매출대상)] [N만(예상금액)] [수업결과] 순서, 모두 옵션
// - 마지막에 자유 텍스트 메모
interface ParsedPtNote {
  phone: string
  current: string
  total: string
  isSalesTarget: boolean
  expectedAmount: string
  classResult: PtClassResult | ''
  memo: string
}

function parsePtNote(note: string | null): ParsedPtNote {
  const empty: ParsedPtNote = { phone: '', current: '', total: '', isSalesTarget: false, expectedAmount: '', classResult: '', memo: '' }
  if (!note) return empty
  let rest = note
  const result: ParsedPtNote = { ...empty }

  // 전화번호 prefix [010-...] 또는 숫자만
  const phoneMatch = rest.match(/^\[([\d][\d\s-]*)\]\s*/)
  if (phoneMatch) {
    result.phone = phoneMatch[1].trim()
    rest = rest.slice(phoneMatch[0].length)
  }

  // 회차 prefix [N/M회] 또는 [N/M]
  const sessionMatch = rest.match(/^\[(\d+)\s*\/\s*(\d+)\s*회?\]\s*/)
  if (sessionMatch) {
    result.current = sessionMatch[1]
    result.total = sessionMatch[2]
    rest = rest.slice(sessionMatch[0].length)
  }

  // 매출대상자 표시 [★]
  if (rest.startsWith('[★]')) {
    result.isSalesTarget = true
    rest = rest.slice(3).replace(/^\s+/, '')
  }

  // 예상 금액 [N만] (만원 단위)
  const amountMatch = rest.match(/^\[(\d+)\s*만\]\s*/)
  if (amountMatch) {
    result.expectedAmount = amountMatch[1]
    rest = rest.slice(amountMatch[0].length)
  }

  // 수업 결과 [수업완료] / [노쇼] / [차감노쇼] / [서비스수업]
  for (const r of PT_CLASS_RESULTS) {
    const tag = `[${r}]`
    if (rest.startsWith(tag)) {
      result.classResult = r
      rest = rest.slice(tag.length).replace(/^\s+/, '')
      break
    }
  }

  result.memo = rest
  return result
}

function buildPtNote(opts: {
  phone?: string
  current?: string
  total?: string
  isSalesTarget?: boolean
  expectedAmount?: string | number
  classResult?: PtClassResult | ''
  memo?: string
}): string | null {
  const parts: string[] = []
  const phone = opts.phone?.trim()
  const cur = opts.current?.trim()
  const tot = opts.total?.trim()
  const amount = String(opts.expectedAmount ?? '').trim()
  const memo = opts.memo?.trim()
  if (phone) parts.push(`[${phone}]`)
  if (cur && tot) parts.push(`[${cur}/${tot}회]`)
  if (opts.isSalesTarget) parts.push('[★]')
  if (amount && Number(amount) > 0) parts.push(`[${amount}만]`)
  if (opts.classResult) parts.push(`[${opts.classResult}]`)
  if (memo) parts.push(memo)
  return parts.length > 0 ? parts.join(' ') : null
}

export function WeeklyCalendar({ assignments, trainerId }: Props) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const supabaseRef = useRef(createClient())

  // 생성 다이얼로그
  const [showCreate, setShowCreate] = useState(false)
  const [createDate, setCreateDate] = useState('')
  const [createTime, setCreateTime] = useState('')
  const [createType, setCreateType] = useState<string>('OT')
  const [createName, setCreateName] = useState('')
  const [createOtSessionId, setCreateOtSessionId] = useState('')
  const [createDuration, setCreateDuration] = useState(50)
  // 종료 시간 (RANGE_TYPES용) — start_time + duration으로 계산하지만, 사용자는 종료 시간을 직접 지정
  const [createEndTime, setCreateEndTime] = useState('')
  const [createNote, setCreateNote] = useState('')
  const [createIsSalesTarget, setCreateIsSalesTarget] = useState(false)
  const [createExpectedAmount, setCreateExpectedAmount] = useState(0)
  const [createClosingProb, setCreateClosingProb] = useState(0)
  const [createSaving, setCreateSaving] = useState(false)
  // 반복 생성: 추가로 같이 생성할 요일 (월=1 ... 일=0). createDate 자체는 항상 포함.
  const [createRepeatDows, setCreateRepeatDows] = useState<number[]>([])
  // OT 회원 검색 필터
  const [createOtFilter, setCreateOtFilter] = useState('')

  // PT/PPT 신규 입력 필드 (검색 X — 그냥 텍스트로 입력해서 trainer_schedules에 기록)
  const [createMemberPhone, setCreateMemberPhone] = useState('')
  const [createPtCurrentSession, setCreatePtCurrentSession] = useState('')
  const [createPtTotalSession, setCreatePtTotalSession] = useState('')

  // 회원 상세 다이얼로그
  const [detailAssignment, setDetailAssignment] = useState<OtAssignmentWithDetails | null>(null)
  const [detailStatus, setDetailStatus] = useState<OtStatus>('신청대기')
  const [detailSalesStatus, setDetailSalesStatus] = useState<SalesStatus>('OT진행중')
  const [detailSalesNote, setDetailSalesNote] = useState('')
  const [detailIsSalesTarget, setDetailIsSalesTarget] = useState(false)
  const [detailExpectedSessions, setDetailExpectedSessions] = useState(0)
  const [detailExpectedAmount, setDetailExpectedAmount] = useState(0)
  const [detailClosingProb, setDetailClosingProb] = useState(0)
  const [detailSaving, setDetailSaving] = useState(false)

  // 스케줄 편집 다이얼로그 (OT/식사/회의 등 일반 스케줄용 — 시간/수업시간만)
  const [editSchedule, setEditSchedule] = useState<ScheduleItem | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editDuration, setEditDuration] = useState(50)
  const [editSaving, setEditSaving] = useState(false)

  // PT 수업 진행 다이얼로그 (PT/PPT 스케줄 클릭 시)
  const [editPtSchedule, setEditPtSchedule] = useState<ScheduleItem | null>(null)
  const [editPtMemberName, setEditPtMemberName] = useState('')
  const [editPtPhone, setEditPtPhone] = useState('')
  const [editPtTime, setEditPtTime] = useState('')
  const [editPtDuration, setEditPtDuration] = useState(50)
  const [editPtCurrentSession, setEditPtCurrentSession] = useState('')
  const [editPtTotalSession, setEditPtTotalSession] = useState('')
  const [editPtIsSalesTarget, setEditPtIsSalesTarget] = useState(false)
  const [editPtExpectedAmount, setEditPtExpectedAmount] = useState('')
  const [editPtClassResult, setEditPtClassResult] = useState<PtClassResult | ''>('')
  const [editPtMemo, setEditPtMemo] = useState('')
  const [editPtSaving, setEditPtSaving] = useState(false)

  // ── 드래그 이동 상태 ──
  // 픽셀 기반 부드러운 드래그: pointermove 동안 React state는 건드리지 않고
  // 직접 element.style.transform으로 이동 → 60fps 부드러운 움직임
  // pointerup 시점에만 30분 단위로 스냅해서 저장
  type DragRef = {
    schedule: ScheduleItem
    startClientX: number
    startClientY: number
    blockEl: HTMLElement
    startRect: DOMRect
    saving: boolean
  }
  const dragStateRef = useRef<DragRef | null>(null)
  // 드래그 중인 schedule id만 React state로 (시각 효과용 - shadow/ring 등)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // 드래그로 이동한 직후 click 이벤트 억제용
  const suppressNextClickRef = useRef(false)
  // 각 day column의 DOM 참조 (드래그 중 좌표 계산용)
  const dayColRefs = useRef<(HTMLDivElement | null)[]>([])

  // 드래그 가능 여부:
  // - OT: 매칭되는 ot_session이 완료되지 않았을 때 (ot_session_id 매칭 못 찾으면 fallback으로 허용)
  // - 그 외 (PT/PPT/회의/식사 등): 항상 허용
  const canDragSchedule = useCallback((s: ScheduleItem): boolean => {
    if (s.schedule_type !== 'OT') return true
    // OT의 경우 ot_session_id가 있고 완료되지 않은 세션이면 드래그 가능
    if (s.ot_session_id) {
      for (const a of assignments) {
        const sess = a.sessions?.find((sess) => sess.id === s.ot_session_id)
        if (sess) return !sess.completed_at
      }
    }
    // ot_session_id가 NULL이거나 매칭 못 찾는 OT (이전 데이터) — 일단 드래그 허용
    // onUp에서 fallback 처리
    return true
  }, [assignments])

  const now = new Date()
  const baseWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekStart = useMemo(() => addDays(baseWeekStart, weekOffset * 7), [weekOffset])
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekNum = Math.ceil(days[0].getDate() / 7)

  // OT 배정된 회원 목록 (선택용)
  const otMembers = assignments.filter((a) => !['거부', '완료'].includes(a.status))

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const ws = weekStartStr
      const we = format(addDays(weekStart, 6), 'yyyy-MM-dd')
      const { data, error } = await supabaseRef.current
        .from('trainer_schedules')
        .select('*')
        .eq('trainer_id', trainerId)
        .gte('scheduled_date', ws)
        .lte('scheduled_date', we)
        .order('start_time')
      if (error) {
        console.error('스케줄 조회 실패:', error.message)
      } else {
        // PostgreSQL time 컬럼은 "HH:MM:SS" 형식으로 반환됨 → "HH:MM"으로 정규화해서
        // 수정 다이얼로그의 슬롯 매칭/<input type="time"> 동작과 일관되게 함
        const normalized = ((data ?? []) as ScheduleItem[]).map((d) => ({
          ...d,
          start_time: typeof d.start_time === 'string' ? d.start_time.slice(0, 5) : d.start_time,
        }))
        setSchedules(normalized)
      }
    } catch (err) {
      console.error('스케줄 조회 에러:', err)
    }
    setLoading(false)
  }, [trainerId, weekStartStr])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const openCreate = (day: Date, hour: number, half: number) => {
    setCreateDate(format(day, 'yyyy-MM-dd'))
    const startTime = `${String(hour).padStart(2, '0')}:${half === 0 ? '00' : '30'}`
    setCreateTime(startTime)
    // 종료 시간 default는 start + 1시간
    const startTotalMin = hour * 60 + (half === 0 ? 0 : 30)
    const endTotalMin = Math.min(startTotalMin + 60, 23 * 60 + 59)
    const endH = Math.floor(endTotalMin / 60)
    const endM = endTotalMin % 60
    setCreateEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
    setCreateType('OT')
    setCreateName('')
    setCreateOtSessionId('')
    setCreateDuration(50)
    setCreateNote('')
    setCreateIsSalesTarget(false)
    setCreateExpectedAmount(0)
    setCreateClosingProb(0)
    setCreateRepeatDows([])
    setCreateOtFilter('')
    setCreateMemberPhone('')
    setCreatePtCurrentSession('')
    setCreatePtTotalSession('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (createType === 'OT' && !createOtSessionId) return
    if ((createType === 'PT' || createType === 'PPT') && !createName.trim()) return
    // 식사/회의/대외활동 등 비-회원 타입은 제목(createName) 입력 불필요 — 빈 문자열로 저장

    setCreateSaving(true)

    if (createType === 'OT') {
      // OT는 회원별 1차/2차/3차 한 번씩만 가능 → 반복 생성 불가, 항상 createDate 단일
      // trainer_schedules 직접 INSERT를 하지 않고 upsertOtSession에 위임 → 이중 생성 방지
      const assignment = otMembers.find((a) =>
        createOtSessionId.startsWith('new-')
          ? createOtSessionId.includes(a.id)
          : a.sessions?.some((s) => s.id === createOtSessionId),
      )
      if (!assignment) {
        alert('OT 회원을 찾을 수 없습니다')
        setCreateSaving(false)
        return
      }
      // 다음 회차 = 1,2,3... 중 아직 등록 안 된 가장 작은 번호
      // (이전 버그: 완료 세션만 카운트해서 미완료 1차/2차를 덮어쓰던 문제 수정)
      const existingNums = new Set(assignment.sessions?.map((s) => s.session_number) ?? [])
      let nextN = 1
      while (existingNums.has(nextN)) nextN++
      const result = await upsertOtSession({
        ot_assignment_id: assignment.id,
        session_number: nextN,
        // KST(+09:00) 명시 — 다른 타임존에서 접속해도 정확한 KST 시간으로 저장
        scheduled_at: new Date(`${createDate}T${createTime}:00+09:00`).toISOString(),
        duration: createDuration,
      })
      if (result?.error) {
        alert('저장 실패: ' + result.error)
        setCreateSaving(false)
        return
      }
      if (createIsSalesTarget || createExpectedAmount > 0) {
        await updateOtAssignment(assignment.id, {
          is_sales_target: createIsSalesTarget,
          expected_amount: createExpectedAmount,
          closing_probability: createClosingProb,
        })
      }
    } else {
      // OT가 아닌 일정 — 다중 요일 반복 생성 가능
      // RANGE_TYPES (식사/회의/당직 등)는 createEndTime - createTime = duration 자동 계산
      let effectiveDuration = createDuration
      if (RANGE_TYPES.has(createType)) {
        if (!createEndTime) {
          alert('종료 시간을 입력해주세요')
          setCreateSaving(false)
          return
        }
        const [sh, sm] = createTime.split(':').map(Number)
        const [eh, em] = createEndTime.split(':').map(Number)
        const startMin = sh * 60 + sm
        const endMin = eh * 60 + em
        if (endMin <= startMin) {
          alert('종료 시간은 시작 시간보다 늦어야 합니다')
          setCreateSaving(false)
          return
        }
        effectiveDuration = endMin - startMin
      }

      // 1) 생성 대상 날짜 목록 만들기 (createDate + 같은 주의 createRepeatDows 요일들)
      //    createDate는 "YYYY-MM-DD" 문자열. 사용자 로컬 타임존 영향 없게 UTC parse 사용.
      const [yyyy, mm, dd] = createDate.split('-').map(Number)
      // UTC 자정으로 만들고 → 로컬 무관 요일 계산을 위해 getUTCDay 사용
      const baseDateUtc = new Date(Date.UTC(yyyy, mm - 1, dd))
      const baseDow = baseDateUtc.getUTCDay() // 0=일 1=월 ... 6=토
      // 같은 주(월요일 기준) 시작 = baseDateUtc - ((baseDow + 6) % 7)일
      const offsetFromMonday = (baseDow + 6) % 7
      const mondayUtc = new Date(baseDateUtc.getTime() - offsetFromMonday * 86400000)
      const targetDates = new Set<string>()
      targetDates.add(createDate) // 항상 본인 날짜 포함
      for (const dow of createRepeatDows) {
        if (dow === baseDow) continue // 본인 요일과 같으면 중복 무시
        // 월=1 → 0일, 화=2 → 1일, ... 일=0 → 6일
        const offset = dow === 0 ? 6 : dow - 1
        const d = new Date(mondayUtc.getTime() + offset * 86400000)
        const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        targetDates.add(ds)
      }
      const dateList = Array.from(targetDates).sort()

      // 2) 모든 날짜에 대해 충돌 사전 검사 (현재 schedules 기준)
      // duration이 60분 이상이면 더 많은 슬롯을 차지하지만 timeToSlot은 30분 단위.
      // 충돌 검사용으로 슬롯 수를 ceil(duration / 30)로 계산.
      const newDurationSlots = Math.max(1, Math.ceil(effectiveDuration / 30))
      const newStartSlot = timeToSlot(createTime)
      const newEndSlot = newStartSlot + newDurationSlots
      const conflicts: string[] = []
      for (const d of dateList) {
        const conflict = schedules.find((s) => {
          if (s.scheduled_date !== d) return false
          const sStart = timeToSlot(s.start_time)
          const sEnd = sStart + Math.max(1, Math.ceil(s.duration / 30))
          return newStartSlot < sEnd && newEndSlot > sStart
        })
        if (conflict) {
          conflicts.push(`${d} (${conflict.schedule_type} ${conflict.member_name})`)
        }
      }
      if (conflicts.length > 0) {
        alert(`다음 날짜에 이미 일정이 있어 추가할 수 없습니다:\n${conflicts.join('\n')}`)
        setCreateSaving(false)
        return
      }

      // 3) 이름 결정
      const memberName = createName.trim()

      // 4) PT/PPT는 phone+회차+메모를 note에 통합 저장. 그 외는 createNote 그대로.
      const noteValue = (createType === 'PT' || createType === 'PPT')
        ? buildPtNote({
            phone: createMemberPhone,
            current: createPtCurrentSession,
            total: createPtTotalSession,
            memo: createNote,
          })
        : (createNote || null)

      // 5) 일괄 INSERT
      const rows = dateList.map((d) => ({
        trainer_id: trainerId,
        schedule_type: createType,
        member_name: memberName,
        member_id: null,
        scheduled_date: d,
        start_time: createTime,
        duration: effectiveDuration,
        note: noteValue,
      }))
      const { error } = await supabaseRef.current.from('trainer_schedules').insert(rows)
      if (error) {
        alert('저장 실패: ' + error.message)
        setCreateSaving(false)
        return
      }
    }

    setShowCreate(false)
    setCreateSaving(false)
    await fetchSchedules()
    // 부모 서버 컴포넌트의 trainerAssignments(ot_sessions 포함) 갱신 → 회원관리 탭에도 반영
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabaseRef.current.from('trainer_schedules').delete().eq('id', id)
    if (error) {
      console.error('삭제 실패:', error.message)
      fetchSchedules() // 삭제 실패 시 목록 다시 불러오기
    }
  }

  // 스케줄 블록 클릭 → 타입에 따라 적절한 다이얼로그 분기
  const openMemberDetail = (schedule: ScheduleItem) => {
    // PT/PPT 스케줄은 PT 수업 진행 전용 다이얼로그
    if (schedule.schedule_type === 'PT' || schedule.schedule_type === 'PPT') {
      const parsed = parsePtNote(schedule.note)
      setEditPtSchedule(schedule)
      setEditPtMemberName(schedule.member_name)
      setEditPtPhone(parsed.phone)
      setEditPtTime(schedule.start_time)
      setEditPtDuration(schedule.duration)
      setEditPtCurrentSession(parsed.current)
      setEditPtTotalSession(parsed.total)
      setEditPtIsSalesTarget(parsed.isSalesTarget)
      setEditPtExpectedAmount(parsed.expectedAmount)
      setEditPtClassResult(parsed.classResult)
      setEditPtMemo(parsed.memo)
      return
    }
    // OT 스케줄은 회원 상세 + 시간 수정 다이얼로그
    const matched = assignments.find((a) => a.member.name === schedule.member_name)
    if (matched) {
      setDetailAssignment(matched)
      setDetailStatus(matched.status)
      setDetailSalesStatus((matched.sales_status as SalesStatus) || 'OT진행중')
      setDetailSalesNote(matched.sales_note ?? '')
      setDetailIsSalesTarget(matched.is_sales_target ?? false)
      setDetailExpectedSessions(matched.expected_sessions ?? 0)
      setDetailExpectedAmount(matched.expected_amount ?? 0)
      setDetailClosingProb(matched.closing_probability ?? 0)
    }
    // 모든 스케줄은 시간/수업시간 편집 가능 (식사/회의 등도 포함)
    setEditSchedule(schedule)
    setEditTime(schedule.start_time)
    setEditDuration(schedule.duration)
  }

  const handleEditPtScheduleSave = async () => {
    if (!editPtSchedule) return
    setEditPtSaving(true)
    const noteValue = buildPtNote({
      phone: editPtPhone,
      current: editPtCurrentSession,
      total: editPtTotalSession,
      isSalesTarget: editPtIsSalesTarget,
      expectedAmount: editPtExpectedAmount,
      classResult: editPtClassResult,
      memo: editPtMemo,
    })
    const { error } = await supabaseRef.current
      .from('trainer_schedules')
      .update({
        member_name: editPtMemberName.trim() || editPtSchedule.member_name,
        start_time: editPtTime,
        duration: editPtDuration,
        note: noteValue,
      })
      .eq('id', editPtSchedule.id)
    if (error) {
      alert('저장 실패: ' + error.message)
      setEditPtSaving(false)
      return
    }
    setEditPtSchedule(null)
    setEditPtSaving(false)
    await fetchSchedules()
    router.refresh()
  }

  // schedules의 최신값을 onUp에서 closure 없이 접근하기 위한 ref
  const schedulesRef = useRef<ScheduleItem[]>([])
  schedulesRef.current = schedules
  const daysRef = useRef<Date[]>(days)
  daysRef.current = days

  // ── 드래그 이동: 픽셀 단위 부드러운 드래그 + 드롭 시점에만 30분 스냅 ──
  const handleSchedulePointerDown = (e: React.PointerEvent, s: ScheduleItem) => {
    if (dragStateRef.current) return // 이미 진행 중
    if (!canDragSchedule(s)) return
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return

    const blockEl = e.currentTarget as HTMLElement
    try { blockEl.setPointerCapture(e.pointerId) } catch {}

    dragStateRef.current = {
      schedule: s,
      startClientX: e.clientX,
      startClientY: e.clientY,
      blockEl,
      startRect: blockEl.getBoundingClientRect(),
      saving: false,
    }
    setDraggingId(s.id)

    e.preventDefault()
    e.stopPropagation()
  }

  const handleSchedulePointerMove = (e: React.PointerEvent) => {
    const cur = dragStateRef.current
    if (!cur || cur.saving) return
    if (cur.schedule.id !== (e.currentTarget as HTMLElement).dataset.scheduleId) return

    // 직접 DOM transform — React state 업데이트 없음 → 60fps 부드러운 이동
    const dx = e.clientX - cur.startClientX
    const dy = e.clientY - cur.startClientY
    cur.blockEl.style.transform = `translate(${dx}px, ${dy}px)`
    cur.blockEl.style.zIndex = '30'
  }

  const handleSchedulePointerUp = async (e: React.PointerEvent) => {
    const cur = dragStateRef.current
    if (!cur) return
    if (cur.schedule.id !== (e.currentTarget as HTMLElement).dataset.scheduleId) return
    if (cur.saving) return

    try {
      if (cur.blockEl.hasPointerCapture(e.pointerId)) {
        cur.blockEl.releasePointerCapture(e.pointerId)
      }
    } catch {}

    const dx = e.clientX - cur.startClientX
    const dy = e.clientY - cur.startClientY

    // 이동 임계값 (5px 미만 = 클릭으로 처리)
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      return
    }

    // 드래그로 이동했음 → click 이벤트 억제
    suppressNextClickRef.current = true
    setTimeout(() => { suppressNextClickRef.current = false }, 0)

    // 새 위치 계산
    // 1) 드롭 위치 X로 어느 day column인지 판별 (블록의 가로 중심점 기준)
    const newCenterX = cur.startRect.left + cur.startRect.width / 2 + dx
    let targetDayIdx = -1
    for (let i = 0; i < dayColRefs.current.length; i++) {
      const col = dayColRefs.current[i]
      if (!col) continue
      const r = col.getBoundingClientRect()
      if (newCenterX >= r.left && newCenterX <= r.right) {
        targetDayIdx = i
        break
      }
    }

    // 캘린더 바깥으로 드롭 — 취소
    if (targetDayIdx < 0) {
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      return
    }

    const targetCol = dayColRefs.current[targetDayIdx]!
    const colRect = targetCol.getBoundingClientRect()
    // 블록의 새 top edge (target column 기준) → 30분 슬롯으로 스냅
    const newTopInCol = (cur.startRect.top + dy) - colRect.top
    const slot = Math.round(newTopInCol / SLOT_HEIGHT)

    const heightSlots = Math.max(1, Math.ceil(cur.schedule.duration / 30))
    const clamped = Math.max(0, Math.min(TOTAL_SLOTS - heightSlots, slot))

    // 결과
    const newDay = daysRef.current[targetDayIdx]
    const newDateStr = format(newDay, 'yyyy-MM-dd')
    const newHour = Math.floor(clamped / SLOTS_PER_HOUR) + 6
    const newMin = (clamped % SLOTS_PER_HOUR) * 30
    const newTimeStr = `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`

    // 변동 없음 (스냅 결과 원위치) — 취소
    const startSlot = timeToSlot(cur.schedule.start_time)
    const startDayIdx = daysRef.current.findIndex((d) => format(d, 'yyyy-MM-dd') === cur.schedule.scheduled_date)
    if (clamped === startSlot && targetDayIdx === startDayIdx) {
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      return
    }

    // 충돌 검사
    const newEndSlot = clamped + heightSlots
    const conflict = schedulesRef.current.find((other) => {
      if (other.id === cur.schedule.id) return false
      if (other.scheduled_date !== newDateStr) return false
      const otherStart = timeToSlot(other.start_time)
      const otherHeight = Math.max(1, Math.ceil(other.duration / 30))
      const otherEnd = otherStart + otherHeight
      return clamped < otherEnd && newEndSlot > otherStart
    })
    if (conflict) {
      alert(`이동할 시간(${newDateStr} ${newTimeStr})에 이미 다른 일정이 있습니다: ${conflict.schedule_type} ${conflict.member_name}`)
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      return
    }

    // 저장
    cur.saving = true
    try {
      if (cur.schedule.schedule_type === 'OT' && cur.schedule.ot_session_id) {
        const newScheduledAt = new Date(`${newDateStr}T${newTimeStr}:00+09:00`).toISOString()
        const result = await moveOtSchedule({
          ot_session_id: cur.schedule.ot_session_id,
          newScheduledAtIso: newScheduledAt,
          newDateStr,
          newTimeStr,
        })
        if ('error' in result && result.error) {
          alert('이동 실패: ' + result.error)
        } else if ('warning' in result && result.warning) {
          alert(result.warning)
        }
      } else {
        const { error } = await supabaseRef.current
          .from('trainer_schedules')
          .update({ scheduled_date: newDateStr, start_time: newTimeStr })
          .eq('id', cur.schedule.id)
        if (error) {
          alert('이동 실패: ' + error.message)
        }
      }
    } catch (err) {
      alert('이동 중 오류: ' + (err instanceof Error ? err.message : String(err)))
    }

    // transform reset → fetchSchedules가 새 위치로 다시 렌더
    cur.blockEl.style.transform = ''
    cur.blockEl.style.zIndex = ''
    dragStateRef.current = null
    setDraggingId(null)
    await fetchSchedules()
    router.refresh()
  }

  const handleSchedulePointerCancel = (e: React.PointerEvent) => {
    const cur = dragStateRef.current
    if (!cur) return
    try {
      if (cur.blockEl.hasPointerCapture(e.pointerId)) {
        cur.blockEl.releasePointerCapture(e.pointerId)
      }
    } catch {}
    cur.blockEl.style.transform = ''
    cur.blockEl.style.zIndex = ''
    dragStateRef.current = null
    setDraggingId(null)
  }

  const handleEditScheduleSave = async () => {
    if (!editSchedule) return
    setEditSaving(true)

    // OT 스케줄은 moveOtSchedule로 양쪽 trainer_schedules + ot_sessions 동기 업데이트
    // duration이 변경된 경우 trainer_schedules에 별도 update가 필요하므로 두 단계로 처리
    if (editSchedule.schedule_type === 'OT' && editSchedule.ot_session_id) {
      const newScheduledAt = new Date(`${editSchedule.scheduled_date}T${editTime}:00+09:00`).toISOString()
      const result = await moveOtSchedule({
        ot_session_id: editSchedule.ot_session_id,
        newScheduledAtIso: newScheduledAt,
        newDateStr: editSchedule.scheduled_date,
        newTimeStr: editTime,
      })
      if ('error' in result && result.error) {
        alert('수정 실패: ' + result.error)
        setEditSaving(false)
        return
      }
      // duration 변경 — trainer_schedules의 같은 ot_session_id 행 모두에 적용
      if (editDuration !== editSchedule.duration) {
        await supabaseRef.current
          .from('trainer_schedules')
          .update({ duration: editDuration })
          .eq('ot_session_id', editSchedule.ot_session_id)
      }
    } else {
      // OT가 아닌 일정 — 단일 row update
      const { error } = await supabaseRef.current
        .from('trainer_schedules')
        .update({ start_time: editTime, duration: editDuration })
        .eq('id', editSchedule.id)
      if (error) {
        alert('수정 실패: ' + error.message)
        setEditSaving(false)
        return
      }
    }

    setEditSchedule(null)
    setEditSaving(false)
    await fetchSchedules()
    router.refresh()
  }

  const handleDetailSave = async () => {
    if (!detailAssignment) return
    setDetailSaving(true)
    // 캘린더 다이얼로그에서는 status(신청대기/배정완료/진행중/완료/거부/추후결정)는 변경 불가
    // → 회원관리 탭에서만 가능. 여기서는 sales_status와 매출 정보만 업데이트.
    await updateOtAssignment(detailAssignment.id, {
      sales_status: detailSalesStatus,
      sales_note: detailSalesNote || null,
      is_sales_target: detailIsSalesTarget,
      expected_sessions: detailExpectedSessions,
      expected_amount: detailExpectedAmount,
      closing_probability: detailClosingProb,
    })
    setDetailSaving(false)
    setDetailAssignment(null)
    router.refresh()
  }

  // 스케줄을 슬롯 위치로 변환
  const getSchedulesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return schedules.filter((s) => s.scheduled_date === dateStr)
  }

  const timeToSlot = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return (h - 6) * SLOTS_PER_HOUR + (m >= 30 ? 1 : 0)
  }

  return (
    <>
      <div className="space-y-3">
        {/* 네비게이션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-white text-gray-700 border-gray-300" onClick={() => setWeekOffset((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-bold text-white bg-gray-900 px-3 py-1 rounded-md min-w-[140px] text-center">
              {format(weekStart, 'yyyy년 M월', { locale: ko })} {weekNum}주차
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-white text-gray-700 border-gray-300" onClick={() => setWeekOffset((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-300" /> OT</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-300" /> PT</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-300" /> 식사</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-300" /> 홍보</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-300" /> 회의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300" /> 전체회의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-300" /> 간담회</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-300" /> 당직</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300" /> 기타</span>
          <span className="flex items-center gap-1"><span className="text-yellow-500">★</span> 매출대상</span>
        </div>

        {/* 캘린더 */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto -mx-4 sm:mx-0">
          {/* 헤더 */}
          <div className="flex border-b border-gray-200 sticky top-0 bg-gray-900 z-10">
            <div className="w-14 shrink-0" />
            {days.map((day, i) => {
              const isToday = isSameDay(day, now)
              const isWeekend = i >= 5
              return (
                <div key={i} className={`flex-1 text-center py-3 border-l border-gray-700 min-w-[90px] ${isToday ? 'bg-yellow-500/20' : ''}`} style={{ height: SLOT_HEIGHT * 2 }}>
                  <p className={`text-[10px] ${isWeekend ? 'text-red-400' : 'text-gray-400'}`}>{DAY_LABELS[day.getDay()]}</p>
                  <p className={`text-lg font-bold ${isToday ? 'bg-yellow-400 text-black rounded-full w-8 h-8 flex items-center justify-center mx-auto' : isWeekend ? 'text-red-400' : 'text-white'}`}>
                    {day.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* 바디 */}
          <div className="flex" style={{ minWidth: 700 }}>
            {/* 시간 축 */}
            <div className="w-14 shrink-0 bg-gray-50">
              {HOURS.map((hour) => (
                <div key={hour} style={{ height: SLOT_HEIGHT * 2 }} className="border-b border-gray-300 px-1 text-[10px] text-gray-700 font-bold text-center flex items-center justify-center">
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 날짜 컬럼 */}
            {days.map((day, dayIdx) => {
              const isToday = isSameDay(day, now)
              const daySchedules = getSchedulesForDay(day)

              return (
                <div
                  key={dayIdx}
                  ref={(el) => { dayColRefs.current[dayIdx] = el }}
                  className={`flex-1 border-l border-gray-300 relative min-w-[90px] ${isToday ? 'bg-yellow-50/50' : ''}`}
                >
                  {/* 30분 단위 그리드 */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
                    const hour = Math.floor(slotIdx / 2) + 6
                    const half = slotIdx % 2
                    return (
                      <div
                        key={slotIdx}
                        style={{ height: SLOT_HEIGHT }}
                        className={`${half === 1 ? 'border-b border-gray-300' : 'border-b border-gray-100'} cursor-pointer hover:bg-yellow-100 transition-colors`}
                        onClick={() => openCreate(day, hour, half)}
                      />
                    )
                  })}

                  {/* 스케줄 블록 (절대 위치) */}
                  {daySchedules.map((s) => {
                    const slot = timeToSlot(s.start_time)
                    const heightSlots = Math.max(1, Math.ceil(s.duration / 30))
                    const top = slot * SLOT_HEIGHT
                    const height = heightSlots * SLOT_HEIGHT - 2
                    // 회원 정보 매칭 — OT 스케줄만 ot_assignments에서 찾음
                    // PT/PPT는 동명이인 OT 회원의 매출대상자 표시가 잘못 묻어오는 문제를 방지
                    const matched = s.schedule_type === 'OT'
                      ? assignments.find((a) => a.member.name === s.member_name)
                      : null
                    // 색상은 schedule_type 기반으로만 (PT 신규 회원도 일반 PT와 동일하게 파란색)
                    const color = TYPE_COLORS[s.schedule_type] ?? TYPE_COLORS.OT
                    // PT 매출대상자/금액/수업결과는 note의 prefix로 판별
                    const ptParsed = (s.schedule_type === 'PT' || s.schedule_type === 'PPT') ? parsePtNote(s.note) : null
                    const isSales = s.schedule_type === 'OT'
                      ? !!matched?.is_sales_target
                      : !!ptParsed?.isSalesTarget
                    const amount = s.schedule_type === 'OT'
                      ? (matched?.expected_amount ?? 0)
                      : (ptParsed?.expectedAmount ? Number(ptParsed.expectedAmount) : 0)
                    const ptResult = ptParsed?.classResult ?? ''
                    // OT 회원의 sales_status (진행중/거부자/등록완료 등) — 캘린더 블록에 라벨로 표시
                    const otSalesStatus = s.schedule_type === 'OT' ? (matched?.sales_status as SalesStatus | null | undefined) : null
                    const hasDetail = !!matched
                    const draggable = canDragSchedule(s)
                    const isDragging = draggingId === s.id

                    return (
                      <div
                        key={s.id}
                        data-schedule-id={s.id}
                        className={`absolute left-0.5 right-0.5 rounded border px-1 py-0.5 overflow-hidden group select-none ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isSales ? 'ring-2 ring-blue-400 ' : ''} ${isDragging ? 'shadow-2xl ring-2 ring-yellow-400 opacity-80' : ''} ${color}`}
                        style={{ top, height, zIndex: isDragging ? 30 : 5, touchAction: 'none' }}
                        onPointerDown={(e) => handleSchedulePointerDown(e, s)}
                        onPointerMove={handleSchedulePointerMove}
                        onPointerUp={handleSchedulePointerUp}
                        onPointerCancel={handleSchedulePointerCancel}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false
                            return
                          }
                          if (dragStateRef.current) return
                          // OT 회원: 회원 상세 + 시간 수정 다이얼로그 동시 (matched 있음)
                          // PT 수기/식사/회의 등: 시간 수정 다이얼로그만 (openMemberDetail 내부에서 matched 없으면 detail 안 띄움)
                          openMemberDetail(s)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {isSales && <span className="text-yellow-500">★ </span>}
                              {s.schedule_type}
                              {s.member_name ? ` ${s.member_name}` : ''}
                              {ptResult && (
                                <span className={`ml-1 ${PT_RESULT_TEXT_COLORS[ptResult as PtClassResult] ?? 'text-gray-700'}`}>
                                  [{ptResult}]
                                </span>
                              )}
                              {otSalesStatus && (
                                <span className={`ml-1 ${OT_SALES_TEXT_COLORS[otSalesStatus] ?? 'text-gray-700'}`}>
                                  [{OT_SALES_LABEL[otSalesStatus]}]
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] opacity-70">
                              {s.start_time} · {s.duration}분
                              {amount ? ` · ${amount}만` : ''}
                            </p>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 shrink-0"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {loading && <p className="text-xs text-gray-400 text-center">로딩 중...</p>}
      </div>

      {/* 스케줄 생성 다이얼로그 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>스케줄 추가</DialogTitle>
            <DialogDescription>{createDate} {createTime}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 타입 선택 */}
            <div className="grid grid-cols-4 gap-1">
              {SCHEDULE_TYPES.map((t) => {
                const c = TYPE_COLORS[t] ?? TYPE_COLORS.기타
                return (
                  <button
                    key={t}
                    className={`rounded-md border-2 py-1.5 text-[11px] font-bold transition-colors ${createType === t ? `${c} border-current` : 'bg-white border-gray-200 text-gray-400'}`}
                    onClick={() => { setCreateType(t as typeof createType); setCreateName(''); setCreateOtSessionId('') }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {/* OT: 배정된 회원 검색 + 선택 */}
            {createType === 'OT' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Search className="h-3 w-3" /> 회원 검색 (배정된 회원)
                </Label>
                <Input
                  value={createOtFilter}
                  onChange={(e) => setCreateOtFilter(e.target.value)}
                  placeholder="이름 또는 전화번호 일부 입력"
                  className="bg-white"
                />
                {/* 검색 결과 (이름/전화 부분 일치, 미배정/완료 제외) */}
                <div className="rounded-md border border-gray-200 max-h-[180px] overflow-y-auto">
                  {(() => {
                    const q = createOtFilter.trim().toLowerCase()
                    const filtered = q
                      ? otMembers.filter((a) =>
                          a.member.name.toLowerCase().includes(q) ||
                          (a.member.phone ?? '').includes(q),
                        )
                      : otMembers
                    if (filtered.length === 0) {
                      return <p className="text-xs text-gray-400 text-center py-2">결과 없음</p>
                    }
                    return filtered.map((a) => {
                      // 다음 회차 = 1,2,3... 중 아직 등록 안 된 가장 작은 번호
                      // (이전 버그: 완료 세션만 카운트해서 미완료 세션을 덮어쓰던 문제 수정)
                      const existingNums = new Set(a.sessions?.map((s) => s.session_number) ?? [])
                      let nextN = 1
                      while (existingNums.has(nextN)) nextN++
                      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
                      const session = a.sessions?.find((s) => s.session_number === nextN)
                      const value = session?.id ?? `new-${a.id}-${nextN}`
                      const isSelected = createOtSessionId === value
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setCreateOtSessionId(value)}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 hover:bg-yellow-50 ${isSelected ? 'bg-yellow-100' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{a.member.name}</span>
                            <span className="text-[10px] text-gray-500">{nextN}차 · {a.member.ot_category ?? '헬스'}</span>
                          </div>
                          <p className="text-[10px] text-gray-400">{a.member.phone ? a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '전화번호 없음'} · {done}/3차 완료</p>
                        </button>
                      )
                    })
                  })()}
                </div>
              </div>
            )}

            {/* PT/PPT: 신규 입력 폼 (회원 등록 없이 trainer_schedules에 텍스트로만 기록) */}
            {(createType === 'PT' || createType === 'PPT') && (
              <div className="space-y-3">
                {/* 이름 (필수) */}
                <div className="space-y-1.5">
                  <Label>이름 <span className="text-red-500">*</span></Label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="회원 이름"
                    className="bg-white"
                  />
                </div>
                {/* 전화번호 (선택) */}
                <div className="space-y-1.5">
                  <Label>전화번호 <span className="text-gray-400 text-xs">(선택)</span></Label>
                  <Input
                    value={createMemberPhone}
                    onChange={(e) => setCreateMemberPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="bg-white"
                  />
                </div>
                {/* 회차 (선택): "00회 중 00회차" */}
                <div className="space-y-1.5">
                  <Label>
                    회차 진행 <span className="text-gray-400 text-xs">(선택)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={createPtTotalSession}
                      onChange={(e) => setCreatePtTotalSession(e.target.value)}
                      placeholder="총"
                      className="bg-white w-20 text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">회 중</span>
                    <Input
                      type="number"
                      min="0"
                      value={createPtCurrentSession}
                      onChange={(e) => setCreatePtCurrentSession(e.target.value)}
                      placeholder="현재"
                      className="bg-white w-20 text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">회차</span>
                  </div>
                </div>
              </div>
            )}

            {/* 기타 타입: 내용 선택사항 (제목 없이도 저장 가능) */}
            {createType !== 'OT' && createType !== 'PT' && createType !== 'PPT' && (
              <div className="space-y-2">
                <Label>내용 <span className="text-gray-400 text-xs">(선택)</span></Label>
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={`${createType} 내용 (비워둬도 됩니다)`} />
              </div>
            )}

            {/* 시간 */}
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
            </div>
            {RANGE_TYPES.has(createType) ? (
              // 식사/회의/당직 등 — 시작/종료 시간 직접 입력
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>시작 시간</Label>
                  <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} step="600" />
                </div>
                <div className="space-y-2">
                  <Label>종료 시간</Label>
                  <Input type="time" value={createEndTime} onChange={(e) => setCreateEndTime(e.target.value)} step="600" />
                </div>
              </div>
            ) : (
              // OT/PT/PPT — 시작 시간만, duration은 별도 버튼
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} step="600" />
              </div>
            )}

            {/* 다중 요일 반복 (OT 제외) */}
            {createType !== 'OT' && (
              <div className="space-y-2">
                <Label className="text-xs">반복 요일 (선택) — 같은 주의 다른 요일에도 같은 시간으로 함께 생성</Label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { dow: 1, label: '월' },
                    { dow: 2, label: '화' },
                    { dow: 3, label: '수' },
                    { dow: 4, label: '목' },
                    { dow: 5, label: '금' },
                    { dow: 6, label: '토' },
                    { dow: 0, label: '일' },
                  ].map(({ dow, label }) => {
                    // createDate의 요일은 항상 활성(잠금) — 본인 날짜
                    // 사용자 로컬 타임존 영향 없이 계산 (UTC 자정 → getUTCDay)
                    let baseDow = -1
                    if (createDate) {
                      const [yy, mo, dy] = createDate.split('-').map(Number)
                      baseDow = new Date(Date.UTC(yy, mo - 1, dy)).getUTCDay()
                    }
                    const isBase = dow === baseDow
                    const isWeekend = dow === 0 || dow === 6
                    const isChecked = isBase || createRepeatDows.includes(dow)
                    return (
                      <button
                        key={dow}
                        type="button"
                        disabled={isBase}
                        onClick={() => {
                          if (isBase) return
                          setCreateRepeatDows((prev) =>
                            prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow],
                          )
                        }}
                        className={`rounded-md border py-1.5 text-xs font-bold transition-colors ${
                          isBase
                            ? 'bg-gray-900 text-white border-gray-900 cursor-default'
                            : isChecked
                              ? 'bg-yellow-400 text-black border-yellow-400'
                              : isWeekend
                                ? 'bg-white text-red-400 border-gray-200 hover:border-yellow-400'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-yellow-400'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {createRepeatDows.length > 0 && (
                  <p className="text-[10px] text-gray-500">선택한 요일에 동시에 생성됩니다 (충돌 시 전체 취소)</p>
                )}
              </div>
            )}

            {/* 수업 시간 (OT/PT/PPT만) */}
            {!RANGE_TYPES.has(createType) && (
              <div className="space-y-2">
                <Label>수업 시간</Label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 rounded-md border py-2 text-sm font-medium ${createDuration === 30 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                    onClick={() => setCreateDuration(30)}
                  >
                    30분
                  </button>
                  <button
                    className={`flex-1 rounded-md border py-2 text-sm font-medium ${createDuration === 50 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                    onClick={() => setCreateDuration(50)}
                  >
                    50분
                  </button>
                </div>
              </div>
            )}

            {/* 매출 정보 (OT/PT/PPT) */}
            {(createType === 'OT' || createType === 'PT' || createType === 'PPT') && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  className={`w-full rounded-lg border-2 py-2 text-sm font-bold transition-colors ${
                    createIsSalesTarget ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                  onClick={() => setCreateIsSalesTarget(!createIsSalesTarget)}
                >
                  매출대상자 {createIsSalesTarget ? '✓' : ''}
                </button>
                {createIsSalesTarget && (
                  <>
                    <div className="space-y-2">
                      <Label>예상 금액</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={createExpectedAmount || ''} onChange={(e) => setCreateExpectedAmount(Number(e.target.value))} placeholder="0" />
                        <span className="text-sm text-gray-500 shrink-0">만원</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>클로징 확률</Label>
                      <div className="flex gap-2">
                        {[20, 40, 60, 80, 100].map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`flex-1 rounded-md border py-1.5 text-xs font-medium ${createClosingProb === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                            onClick={() => setCreateClosingProb(p)}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input value={createNote} onChange={(e) => setCreateNote(e.target.value)} placeholder="메모" />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={createSaving}>
              {createSaving ? '저장 중...' : '추가'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 회원 상세/상태변경 다이얼로그 */}
      <Dialog open={!!detailAssignment} onOpenChange={() => setDetailAssignment(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {detailAssignment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{detailAssignment.member.name}</DialogTitle>
                <DialogDescription>회원 정보 · 상태 변경</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                {/* 회원 정보 */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-[10px] text-gray-400 mb-1">연락처</p>
                      <p className="text-sm font-bold text-gray-900">{detailAssignment.member.phone ? detailAssignment.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-[10px] text-gray-400 mb-1">종목</p>
                      <p className="text-sm font-bold text-gray-900">{detailAssignment.member.ot_category ?? '-'}</p>
                    </div>
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-[10px] text-gray-400 mb-1">운동기간</p>
                      <p className="text-sm font-bold text-gray-900">{detailAssignment.member.duration_months ?? '-'}</p>
                    </div>
                    <div className="rounded-md bg-blue-50 p-3">
                      <p className="text-[10px] text-blue-400 mb-1">가능시간</p>
                      <p className="text-sm font-bold text-blue-700">{detailAssignment.member.exercise_time ?? '-'}</p>
                    </div>
                  </div>
                  {detailAssignment.member.notes && (
                    <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
                      <p className="text-[10px] text-orange-500 mb-1">특이사항</p>
                      <p className="text-sm text-gray-900">{detailAssignment.member.notes}</p>
                    </div>
                  )}
                </div>

                {/* OT 진행 현황 */}
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">OT 진행 현황</p>
                  <div className="flex gap-2">
                    {Array.from({ length: Math.max(3, detailAssignment.sessions?.length ?? 0) }, (_, i) => i + 1).map((num) => {
                      const session = detailAssignment.sessions?.find((s) => s.session_number === num)
                      const isDone = !!session?.completed_at
                      const isScheduled = !!session?.scheduled_at && !session?.completed_at
                      return (
                        <div key={num} className={`flex-1 rounded-lg border-2 p-2.5 text-center ${
                          isDone ? 'bg-green-50 border-green-400'
                          : isScheduled ? 'bg-blue-50 border-blue-400'
                          : 'bg-gray-50 border-gray-200'
                        }`}>
                          <p className={`text-xs font-bold ${isDone ? 'text-green-700' : isScheduled ? 'text-blue-700' : 'text-gray-400'}`}>{num}차</p>
                          <p className={`text-[11px] mt-0.5 ${isDone ? 'text-green-600' : isScheduled ? 'text-blue-600' : 'text-gray-400'}`}>
                            {isDone ? '완료' : isScheduled ? formatKstShort(session!.scheduled_at!) : '미정'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 상태 (sales_status) — 진행/거부자/등록완료/스케줄미확정/연락두절/클로징실패 */}
                {/* status(신청대기/배정완료/진행중/완료/거부/추후결정)는 회원관리 탭에서만 변경 가능 */}
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">상태</p>
                  <div className="grid grid-cols-3 gap-2">
                    {OT_SALES_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        className={`rounded-lg border-2 py-2.5 text-xs font-bold transition-colors ${
                          detailSalesStatus === s.value
                            ? OT_SALES_BUTTON_COLORS[s.value]
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                        onClick={() => setDetailSalesStatus(s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 매출 정보 — 입력 가능 */}
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                  <button
                    type="button"
                    className={`w-full rounded-md border-2 py-2.5 text-sm font-bold transition-colors ${
                      detailIsSalesTarget
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                    onClick={() => setDetailIsSalesTarget(!detailIsSalesTarget)}
                  >
                    {detailIsSalesTarget ? '★ 매출대상자' : '매출대상자로 지정'}
                  </button>
                  {/* 매출대상자로 지정했을 때만 예상 회수/금액/확률 입력 노출 */}
                  {detailIsSalesTarget && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0 w-20">예상 회수</Label>
                        <Input
                          type="number"
                          min="0"
                          value={detailExpectedSessions || ''}
                          onChange={(e) => setDetailExpectedSessions(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="bg-white h-8 text-sm flex-1 text-right"
                        />
                        <span className="text-xs text-gray-600 shrink-0">회</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0 w-20">예상 금액</Label>
                        <Input
                          type="number"
                          min="0"
                          value={detailExpectedAmount || ''}
                          onChange={(e) => setDetailExpectedAmount(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="bg-white h-8 text-sm flex-1 text-right"
                        />
                        <span className="text-xs text-gray-600 shrink-0">만원</span>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">클로징 확률</Label>
                        <div className="grid grid-cols-5 gap-1">
                          {[20, 40, 60, 80, 100].map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`rounded-md border py-1.5 text-xs font-bold transition-colors ${
                                detailClosingProb === p
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                              }`}
                              onClick={() => setDetailClosingProb(detailClosingProb === p ? 0 : p)}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 세일즈 메모 */}
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-900">세일즈 메모</p>
                  <Textarea
                    value={detailSalesNote}
                    onChange={(e) => setDetailSalesNote(e.target.value)}
                    placeholder="클로징 과정, 특이사항 등"
                    rows={3}
                    className="bg-white text-gray-900 border-gray-300"
                  />
                </div>

                {/* 스케줄 시간/수업시간 수정 */}
                {editSchedule && (
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-bold text-gray-900">스케줄 수정</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">시간</p>
                      <div className="grid grid-cols-4 gap-1">
                        {Array.from({ length: 33 }, (_, i) => {
                          const h = 6 + Math.floor(i / 2)
                          const m = (i % 2) * 30
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                        }).map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`rounded border px-1 py-1 text-xs font-medium transition-colors ${
                              editTime === slot
                                ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                            onClick={() => setEditTime(slot)}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                      {/* 10분 단위 직접 입력 */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-gray-500 shrink-0">직접 입력</span>
                        <Input
                          type="time"
                          step={600}
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="h-8 text-xs bg-white border-gray-300 w-32"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">수업시간</p>
                      <div className="flex gap-2">
                        {[30, 50].map((d) => (
                          <button
                            key={d}
                            type="button"
                            className={`flex-1 rounded-md border px-3 py-2 text-sm font-bold transition-colors ${
                              editDuration === d
                                ? 'bg-yellow-400 text-black border-yellow-400'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                            onClick={() => setEditDuration(d)}
                          >
                            {d}분
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                      onClick={handleEditScheduleSave}
                      disabled={editSaving}
                    >
                      {editSaving ? '저장 중...' : '스케줄 수정 저장'}
                    </Button>
                  </div>
                )}

                <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold" onClick={handleDetailSave} disabled={detailSaving}>
                  {detailSaving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 스케줄 수정 다이얼로그 */}
      <Dialog open={!!editSchedule && !detailAssignment} onOpenChange={() => setEditSchedule(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          {editSchedule && (
            <>
              <DialogHeader>
                <DialogTitle>스케줄 수정</DialogTitle>
                <DialogDescription>{editSchedule.member_name} · {editSchedule.schedule_type}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">시간</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 33 }, (_, i) => {
                      const h = 6 + Math.floor(i / 2)
                      const m = (i % 2) * 30
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                    }).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                          editTime === slot
                            ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setEditTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  {/* 10분 단위 직접 입력 */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-gray-500 shrink-0">직접 입력</span>
                    <Input
                      type="time"
                      step={600}
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="h-8 text-xs bg-white border-gray-300 w-32"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">수업시간</p>
                  <div className="flex gap-2">
                    {[30, 50].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-bold transition-colors ${
                          editDuration === d
                            ? 'bg-yellow-400 text-black border-yellow-400'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setEditDuration(d)}
                      >
                        {d}분
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                  onClick={handleEditScheduleSave}
                  disabled={editSaving}
                >
                  {editSaving ? '저장 중...' : '수정 저장'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PT 수업 진행 다이얼로그 (PT/PPT 스케줄 클릭 시) */}
      <Dialog open={!!editPtSchedule} onOpenChange={() => setEditPtSchedule(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          {editPtSchedule && (
            <>
              <DialogHeader>
                <DialogTitle>PT 수업 진행</DialogTitle>
                <DialogDescription>{editPtSchedule.scheduled_date} · {editPtSchedule.schedule_type}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* 회원 이름 */}
                <div className="space-y-2">
                  <Label>회원 이름</Label>
                  <Input
                    value={editPtMemberName}
                    onChange={(e) => setEditPtMemberName(e.target.value)}
                    placeholder="회원 이름"
                    className="bg-white"
                  />
                </div>

                {/* 전화번호 */}
                <div className="space-y-2">
                  <Label>전화번호 <span className="text-gray-400 text-xs">(선택)</span></Label>
                  <Input
                    value={editPtPhone}
                    onChange={(e) => setEditPtPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="bg-white"
                  />
                </div>

                {/* 시간 슬롯 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">시간</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 33 }, (_, i) => {
                      const h = 6 + Math.floor(i / 2)
                      const m = (i % 2) * 30
                      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                    }).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                          editPtTime === slot
                            ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setEditPtTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-gray-500 shrink-0">직접 입력</span>
                    <Input
                      type="time"
                      step={600}
                      value={editPtTime}
                      onChange={(e) => setEditPtTime(e.target.value)}
                      className="h-8 text-xs bg-white border-gray-300 w-32"
                    />
                  </div>
                </div>

                {/* 수업시간 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">수업시간</p>
                  <div className="flex gap-2">
                    {[30, 50, 60].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-bold transition-colors ${
                          editPtDuration === d
                            ? 'bg-yellow-400 text-black border-yellow-400'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => setEditPtDuration(d)}
                      >
                        {d}분
                      </button>
                    ))}
                  </div>
                </div>

                {/* 회차 (선택) — "00회 중 00회차" */}
                <div className="space-y-2">
                  <Label>
                    회차 진행 <span className="text-gray-400 text-xs">(선택)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={editPtTotalSession}
                      onChange={(e) => setEditPtTotalSession(e.target.value)}
                      placeholder="총"
                      className="bg-white w-20 text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">회 중</span>
                    <Input
                      type="number"
                      min="0"
                      value={editPtCurrentSession}
                      onChange={(e) => setEditPtCurrentSession(e.target.value)}
                      placeholder="현재"
                      className="bg-white w-20 text-center"
                    />
                    <span className="text-xs text-gray-600 shrink-0">회차</span>
                  </div>
                </div>

                {/* 매출 대상 + 예상 금액 */}
                <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/40 p-3">
                  <button
                    type="button"
                    className={`w-full rounded-md border-2 py-2 text-xs font-bold transition-colors ${
                      editPtIsSalesTarget
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                    onClick={() => setEditPtIsSalesTarget(!editPtIsSalesTarget)}
                  >
                    {editPtIsSalesTarget ? '★ 매출대상자' : '매출대상자로 지정'}
                  </button>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">예상 금액</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editPtExpectedAmount}
                      onChange={(e) => setEditPtExpectedAmount(e.target.value)}
                      placeholder="0"
                      className="bg-white h-8 text-sm flex-1 text-right"
                    />
                    <span className="text-xs text-gray-600 shrink-0">만원</span>
                  </div>
                </div>

                {/* 수업 상태/결과 */}
                <div className="space-y-2">
                  <Label>수업 상태 <span className="text-gray-400 text-xs">(선택)</span></Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PT_CLASS_RESULTS.map((r) => {
                      const isSelected = editPtClassResult === r
                      return (
                        <button
                          key={r}
                          type="button"
                          className={`rounded-md border-2 py-2 text-xs font-bold transition-colors ${
                            isSelected ? PT_RESULT_BUTTON_COLORS[r] : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}
                          onClick={() => setEditPtClassResult(isSelected ? '' : r)}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 수업 메모 */}
                <div className="space-y-2">
                  <Label>수업 메모</Label>
                  <Textarea
                    value={editPtMemo}
                    onChange={(e) => setEditPtMemo(e.target.value)}
                    placeholder="오늘 진행한 운동, 회원 컨디션, 다음 회차 계획 등"
                    rows={4}
                    className="bg-white text-gray-900 border-gray-300"
                  />
                </div>

                <Button
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold"
                  onClick={handleEditPtScheduleSave}
                  disabled={editPtSaving}
                >
                  {editPtSaving ? '저장 중...' : '저장'}
                </Button>

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  className="w-full text-xs text-red-500 hover:text-red-700 underline"
                  onClick={() => {
                    if (confirm('이 PT 스케줄을 삭제하시겠습니까?')) {
                      handleDelete(editPtSchedule.id)
                      setEditPtSchedule(null)
                    }
                  }}
                >
                  스케줄 삭제
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
