'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef, useTransition } from 'react'
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
import { ChevronLeft, ChevronRight, X, Search, Copy, AlertCircle, RefreshCw } from 'lucide-react'
import { toKstShortStr } from '@/lib/kst'
import { createClient } from '@/lib/supabase/client'
import { updateOtAssignment, upsertOtSession, moveOtSchedule, deleteOtSession } from '@/actions/ot'
// import { OtStatusBadge } from './ot-status-badge'
import type { OtAssignmentWithDetails, SalesStatus, Profile, OtProgram } from '@/types'
import dynamic from 'next/dynamic'
const OtProgramForm = dynamic(() => import('@/components/ot/ot-program-form').then((m) => m.OtProgramForm), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-gray-500">프로그램 로드 중...</div>,
}) as unknown as typeof import('@/components/ot/ot-program-form').OtProgramForm
import { getOtProgram, batchGetOtPrograms, upsertOtProgram } from '@/actions/ot-program'
import { adjustPtMemberSessions } from '@/actions/pt-members'
import { ClipboardList, ImageIcon } from 'lucide-react'
import { RapoImportDialog } from './rapo-import-dialog'

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
  profile?: Profile
  workStartTime?: string | null
  workEndTime?: string | null
}

// ── 한국 공휴일 / 대체공휴일 (2025~2027) ──
// 양력 고정 + 음력 연동 공휴일은 연도별로 직접 지정
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '신정', '2025-01-28': '설날', '2025-01-29': '설날', '2025-01-30': '설날',
  '2025-03-01': '삼일절', '2025-05-01': '근로자의날', '2025-05-05': '어린이날', '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일', '2025-08-15': '광복절', '2025-10-03': '개천절', '2025-10-05': '추석',
  '2025-10-06': '추석', '2025-10-07': '추석', '2025-10-08': '대체공휴일(추석)',
  '2025-10-09': '한글날', '2025-12-25': '성탄절',
  // 2026
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일(삼일절)', '2026-05-01': '근로자의날',
  '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석', '2026-09-25': '추석', '2026-09-26': '추석',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일(개천절)', '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  // 2027
  '2027-01-01': '신정', '2027-02-06': '설날', '2027-02-07': '설날', '2027-02-08': '설날',
  '2027-02-09': '대체공휴일(설날)', '2027-03-01': '삼일절', '2027-05-01': '근로자의날',
  '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일',
  '2027-06-07': '대체공휴일(현충일)', '2027-08-15': '광복절', '2027-08-16': '대체공휴일(광복절)',
  '2027-10-03': '개천절', '2027-10-04': '대체공휴일(개천절)', '2027-10-09': '한글날',
  '2027-10-11': '추석', '2027-10-12': '추석', '2027-10-13': '추석', '2027-12-25': '성탄절',
}

function isHoliday(dateStr: string): boolean {
  return !!KOREAN_HOLIDAYS[dateStr]
}

function isWeekendOrHoliday(day: Date): boolean {
  const dow = day.getDay()
  if (dow === 0 || dow === 6) return true
  return isHoliday(format(day, 'yyyy-MM-dd'))
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6) // 06~24
const SLOTS_PER_HOUR = 2 // 30분 단위
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const SLOT_HEIGHT = 40 // px per 30min (데스크톱)
const SLOT_HEIGHT_MOBILE = 24 // px per 30min (모바일 컴팩트)
const TOTAL_SLOTS = HOURS.length * SLOTS_PER_HOUR

// 스케줄 블록 색상 — 원색 대신 불투명도 톤다운, 같은 색 중복 안 되게 분배
const TYPE_COLORS: Record<string, string> = {
  OT: 'bg-blue-100/70 border-blue-300 text-blue-900',
  PT: 'bg-slate-200/70 border-slate-400 text-slate-800',
  PPT: 'bg-purple-100/70 border-purple-300 text-purple-900',
  바챌: 'bg-green-100/70 border-green-300 text-green-900',
  식사: 'bg-fuchsia-100/70 border-fuchsia-300 text-fuchsia-900',
  홍보: 'bg-pink-100/70 border-pink-300 text-pink-900',
  간부회의: 'bg-stone-200/70 border-stone-400 text-stone-900',
  팀회의: 'bg-lime-100/70 border-lime-300 text-lime-900',
  전체회의: 'bg-amber-100/70 border-amber-300 text-amber-900',
  간담회: 'bg-sky-100/70 border-sky-300 text-sky-900',
  당직: 'bg-rose-100/70 border-rose-300 text-rose-900',
  대외활동: 'bg-teal-100/70 border-teal-300 text-teal-900',
  유급휴식: 'bg-cyan-100/70 border-cyan-300 text-cyan-900',
  기타: 'bg-neutral-200/70 border-neutral-400 text-neutral-800',
}

// PT/PPT 블록 색상: IN/OUT/공동구매/주말 분기
// IN: 회색, OUT: 주황, 공동구매: 노랑, 주말/공휴일: 슬레이트(다른 회색 톤)
const PT_IN_COLOR = 'bg-slate-200/70 border-slate-400 text-slate-800'
const PT_OUT_COLOR = 'bg-orange-100/70 border-orange-300 text-orange-900'
const PT_GROUP_PURCHASE_COLOR = 'bg-yellow-200/80 border-yellow-400 text-yellow-900'
const PT_WEEKEND_COLOR = 'bg-zinc-300/70 border-zinc-500 text-zinc-800'

const SCHEDULE_TYPES = ['PT', 'PPT', '바챌', 'OT', '식사', '홍보', '간부회의', '팀회의', '전체회의', '간담회', '당직', '대외활동', '유급휴식', '기타'] as const

// OT/PT/PPT/바챌 이외의 타입은 시작~종료 시간으로 입력 (duration 자동 계산)
const RANGE_TYPES = new Set(['식사', '홍보', '간부회의', '팀회의', '전체회의', '간담회', '당직', '대외활동', '유급휴식', '기타'])

// PT 계열 (PT note 파싱/IN-OUT 로직 적용 대상)
const isPtLikeType = (t: string) => t === 'PT' || t === 'PPT' || t === '바챌'

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
  '수업후거부': 'bg-red-600 border-red-600 text-white',
}
const OT_SALES_TEXT_COLORS: Record<SalesStatus, string> = {
  'OT진행중': 'text-green-700',
  'OT거부자': 'text-orange-700',
  '등록완료': 'text-blue-700',
  '스케줄미확정': 'text-yellow-700',
  '연락두절': 'text-gray-700',
  '클로징실패': 'text-red-600',
  '수업후거부': 'text-red-700',
}
const OT_SALES_LABEL: Record<SalesStatus, string> = {
  'OT진행중': '진행중',
  'OT거부자': '거부자',
  '등록완료': '등록완료',
  '스케줄미확정': '스케줄미확정',
  '연락두절': '연락두절',
  '클로징실패': '클로징실패',
  '수업후거부': '수업후거부',
}

// ISO timestamp → "M/d HH:mm" KST 표시 (브라우저 TZ 무관)
const formatKstShort = toKstShortStr

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
  inOut: 'IN' | 'OUT'
  isGroupPurchase: boolean
  memo: string
}

function parsePtNote(note: string | null): ParsedPtNote {
  const empty: ParsedPtNote = { phone: '', current: '', total: '', isSalesTarget: false, expectedAmount: '', classResult: '', inOut: 'IN', isGroupPurchase: false, memo: '' }
  if (!note) return empty
  let rest = note
  const result: ParsedPtNote = { ...empty }

  // IN/OUT
  if (rest.startsWith('[OUT]')) { result.inOut = 'OUT'; rest = rest.slice(5).replace(/^\s+/, '') }

  // 공동구매 — 항상 IN으로 강제
  if (rest.startsWith('[공동구매]')) {
    result.isGroupPurchase = true
    result.inOut = 'IN'
    rest = rest.slice(6).replace(/^\s+/, '')
  }

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
  inOut?: 'IN' | 'OUT'
  isGroupPurchase?: boolean
  memo?: string
}): string | null {
  const parts: string[] = []
  // 공동구매는 항상 IN — OUT 태그를 붙이지 않음
  if (opts.inOut === 'OUT' && !opts.isGroupPurchase) parts.push('[OUT]')
  if (opts.isGroupPurchase) parts.push('[공동구매]')
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

export function WeeklyCalendar({ assignments, trainerId, profile, workStartTime, workEndTime }: Props) {
  const router = useRouter()
  const isAdmin = profile && ['admin', '관리자', '개발자'].includes(profile.role)
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [monthOffset, setMonthOffset] = useState(0)
  const [monthFilter, setMonthFilter] = useState<'전체' | 'OT' | 'PT' | 'PPT' | '바챌'>('전체')
  const [, startTransition] = useTransition()
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const scheduleRetryRef = useRef(0)
  const scheduleRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 진행 중인 fetch가 신선한 state를 덮어쓰지 못하도록 세대 추적
  // (placeholder 주차 fetch ↔ 현재 주차 fetch 레이스 방어)
  const fetchGenRef = useRef(0)
  // schedulesRef는 1191줄에서 이미 선언/갱신됨 — 여기서는 loading만 ref화
  const loadingRef = useRef(false)
  useEffect(() => { loadingRef.current = loading }, [loading])

  // 첫 로그인 직후 RLS가 빈 결과를 돌려주는 케이스 — 마운트당 한 번만, INITIAL_SESSION 이벤트 + 빈 데이터일 때 router.refresh
  // SIGNED_IN/INITIAL_SESSION만 처리, TOKEN_REFRESHED는 무시 (1시간마다 자동 refresh되어 불필요한 re-render 발생)
  const initialRefreshDoneRef = useRef(false)
  useEffect(() => {
    const supabase = supabaseRef.current
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION + 실제 세션 있음 + 데이터 비어있음 → 한 번만 RSC 재조회
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session && !initialRefreshDoneRef.current) {
        if (assignments.length === 0 && trainerId !== 'unassigned' && trainerId !== 'excluded') {
          initialRefreshDoneRef.current = true
          router.refresh()
        }
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fetchSchedules ref는 더 이상 필요 없음 (auth 리스너에서 호출 안 함)

  // PT 회원 목록 (스케줄 생성 시 선택용 / 캘린더 블록 라이브 회차 표시용)
  // 월별 분리 저장 — 모든 월 데이터를 가져와서 (name, month) 키로 lookup
  type PtMemberLite = { id: string; name: string; phone: string | null; total_sessions: number; completed_sessions: number; data_month: string | null }
  const [ptMembers, setPtMembers] = useState<PtMemberLite[]>([])
  useEffect(() => {
    supabaseRef.current
      .from('pt_members')
      .select('id, name, phone, total_sessions, completed_sessions, data_month')
      .eq('trainer_id', trainerId)
      .eq('status', '진행중')
      .order('data_month', { ascending: false })
      .order('name')
      .then(({ data }) => setPtMembers((data ?? []) as PtMemberLite[]))
  }, [trainerId])

  // 같은 이름 중 가장 최신 월 (스케줄 생성 폼 dropdown용)
  const ptMembersDedup = useMemo(() => {
    const seen = new Set<string>()
    return ptMembers.filter((m) => {
      if (seen.has(m.name)) return false
      seen.add(m.name)
      return true
    })
  }, [ptMembers])

  // (name, month) → pt_members row 매핑 (캘린더 블록에서 라이브 회차 lookup)
  const ptMemberByNameMonth = useMemo(() => {
    const map = new Map<string, PtMemberLite>()
    for (const m of ptMembers) {
      if (m.data_month) map.set(`${m.name}|${m.data_month}`, m)
    }
    return map
  }, [ptMembers])

  // 회원별 PT/PPT/바챌 시간순 회차 매핑: schedule.id → 해당 월 내 회차 번호 (월 단위로 1차부터 reset)
  // 트레이너의 모든 PT/PPT/바챌 스케줄을 조회해 (회원, 월) 단위로 정렬해 1차 2차 3차 ... 자동 부여
  const [sessionPosById, setSessionPosById] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    if (!trainerId) return
    let cancelled = false
    supabaseRef.current
      .from('trainer_schedules')
      .select('id, member_name, schedule_type, scheduled_date, start_time')
      .eq('trainer_id', trainerId)
      .in('schedule_type', ['PT', 'PPT', '바챌'])
      .then(({ data }) => {
        if (cancelled || !data) return
        // (이름 + YYYY-MM)으로 그룹핑 → 월 단위 회차 reset
        const groups = new Map<string, typeof data>()
        for (const s of data) {
          const name = (s.member_name ?? '').trim()
          if (!name) continue
          const month = s.scheduled_date.slice(0, 7)
          const key = `${name}|${month}`
          const arr = groups.get(key) ?? []
          arr.push(s)
          groups.set(key, arr)
        }
        const map = new Map<string, number>()
        for (const arr of Array.from(groups.values())) {
          arr.sort((a, b) => {
            if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date)
            if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time)
            return a.id.localeCompare(b.id)
          })
          arr.forEach((s, idx) => map.set(s.id, idx + 1))
        }
        setSessionPosById(map)
      })
    return () => { cancelled = true }
  }, [trainerId, schedules])

  // ── OT 세션별 승인 / 인바디 상태 맵 ──
  const [approvedSessionIds, setApprovedSessionIds] = useState<Set<string>>(new Set())
  const [inbodySessionIds, setInbodySessionIds] = useState<Set<string>>(new Set())
  // 프로그램 데이터 캐시 (인바디 토글 저장 시 다시 fetch 안 하도록)
  const programCacheRef = useRef<Record<string, OtProgram | null>>({})
  useEffect(() => {
    const ids = assignments.map((a) => a.id)
    if (ids.length === 0) return
    batchGetOtPrograms(ids).then((programMap) => {
      const approved = new Set<string>()
      const inbody = new Set<string>()
      for (const [aid, prog] of Object.entries(programMap)) {
        programCacheRef.current[aid] = prog
        const a = assignments.find((x) => x.id === aid)
        if (!prog.sessions || !a?.sessions) continue
        prog.sessions.forEach((s, i) => {
          const otSession = a.sessions?.find((os) => os.session_number === i + 1)
          if (!otSession?.id) return
          if (s.approval_status === '승인') approved.add(otSession.id)
          if (s.inbody) inbody.add(otSession.id)
        })
      }
      setApprovedSessionIds(approved)
      setInbodySessionIds(inbody)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments])

  // OT 스케줄이 승인된 세션인지 확인
  const isOtApproved = useCallback((schedule: ScheduleItem) => {
    if (schedule.schedule_type !== 'OT') return false
    if (!schedule.ot_session_id) return false
    return approvedSessionIds.has(schedule.ot_session_id)
  }, [approvedSessionIds])

  // OT 세션의 인바디 측정 여부 토글 — 프로그램 sessions[i].inbody 갱신
  const toggleInbodyForOtSchedule = useCallback(async (schedule: ScheduleItem, next: boolean) => {
    if (schedule.schedule_type !== 'OT' || !schedule.ot_session_id) return
    const assignment = assignments.find((a) => a.sessions?.some((s) => s.id === schedule.ot_session_id))
    if (!assignment) return
    const session = assignment.sessions?.find((s) => s.id === schedule.ot_session_id)
    if (!session) return
    const idx = session.session_number - 1
    // 캐시된 프로그램 우선, 없으면 fetch
    let program = programCacheRef.current[assignment.id]
    if (!program) {
      program = await getOtProgram(assignment.id)
      programCacheRef.current[assignment.id] = program
    }
    if (!program) return
    const sessions = [...(program.sessions ?? [])]
    while (sessions.length <= idx) {
      sessions.push({ date: '', time: '', exercises: [], tip: '', next_ot_date: '', cardio: { types: [], duration_min: '' }, inbody: false, images: [], completed: false })
    }
    sessions[idx] = { ...sessions[idx], inbody: next }
    await upsertOtProgram(assignment.id, assignment.member_id, { sessions })
    // 캐시 + 표시 상태 즉시 갱신
    programCacheRef.current[assignment.id] = { ...program, sessions }
    setInbodySessionIds((prev) => {
      const nextSet = new Set(prev)
      if (next) nextSet.add(schedule.ot_session_id!)
      else nextSet.delete(schedule.ot_session_id!)
      return nextSet
    })
  }, [assignments])

  // ── 모바일 감지 (640px 미만) ──
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  const slotH = isMobile ? SLOT_HEIGHT_MOBILE : SLOT_HEIGHT

  // 생성 다이얼로그
  const [showCreate, setShowCreate] = useState(false)
  const [createDate, setCreateDate] = useState('')
  const [createTime, setCreateTime] = useState('')
  const [createType, setCreateType] = useState<string>('PT')
  const [createName, setCreateName] = useState('')
  const [createOtSessionId, setCreateOtSessionId] = useState('')
  const [createDuration, setCreateDuration] = useState(50)
  // 종료 시간 (RANGE_TYPES용) — start_time + duration으로 계산하지만, 사용자는 종료 시간을 직접 지정
  const [createEndTime, setCreateEndTime] = useState('')
  const [createNote, setCreateNote] = useState('')
  // IN/OUT은 근무시간 기준 자동 판별 (수동 토글 제거됨)
  const [createIsSalesTarget, setCreateIsSalesTarget] = useState(false)
  const [createExpectedAmount, setCreateExpectedAmount] = useState(0)
  const [createExpectedSessions, setCreateExpectedSessions] = useState(0)
  const [createClosingProb, setCreateClosingProb] = useState(0)
  const [createSaving, setCreateSaving] = useState(false)
  const createSavingRef = useRef(false)
  const stopCreateSaving = () => {
    createSavingRef.current = false
    setCreateSaving(false)
  }
  // 반복 생성: 추가로 같이 생성할 요일 (월=1 ... 일=0). createDate 자체는 항상 포함.
  const [createRepeatDows, setCreateRepeatDows] = useState<number[]>([])
  // 충돌 확인 다이얼로그
  const [conflictConfirm, setConflictConfirm] = useState<{
    conflicts: { date: string; type: string; name: string; time: string }[]
    onConfirm: () => void
  } | null>(null)
  // OT 회원 검색 필터
  const [createOtFilter, setCreateOtFilter] = useState('')

  // PT/PPT/바챌 신규 입력 필드
  const [createMemberPhone, setCreateMemberPhone] = useState('')
  const [createPtCurrentSession, setCreatePtCurrentSession] = useState('')
  const [createPtTotalSession, setCreatePtTotalSession] = useState('')
  const [createIsGroupPurchase, setCreateIsGroupPurchase] = useState(false)
  const [createPtFilter, setCreatePtFilter] = useState('')

  // 회원 상세 다이얼로그
  const [detailAssignment, setDetailAssignment] = useState<OtAssignmentWithDetails | null>(null)
  // sessionIdx: 스케줄에서 진입 시 해당 차수의 저장/완료 버튼이 보이도록 (없으면 단순 조회)
  const [programTarget, setProgramTarget] = useState<{ assignment: OtAssignmentWithDetails; program: OtProgram | null; sessionIdx?: number | null } | null>(null)
  const [programCompleteLoading, setProgramCompleteLoading] = useState(false)
  const [programLoading, setProgramLoading] = useState(false)

  const openProgramDialog = async (a: OtAssignmentWithDetails, sessionIdx?: number | null) => {
    setProgramLoading(true)
    try {
      const program = await getOtProgram(a.id)
      setProgramTarget({ assignment: a, program, sessionIdx: sessionIdx ?? null })
      setDetailAssignment(null)
    } finally {
      setProgramLoading(false)
    }
  }
  const [detailSalesStatus, setDetailSalesStatus] = useState<SalesStatus>('OT진행중')
  const [detailSalesNote, setDetailSalesNote] = useState('')
  const [detailIsSalesTarget, setDetailIsSalesTarget] = useState(false)
  const [detailExpectedSessions, setDetailExpectedSessions] = useState(0)
  const [detailExpectedAmount, setDetailExpectedAmount] = useState(0)
  const [detailClosingProb, setDetailClosingProb] = useState(0)
  const [detailSaving, setDetailSaving] = useState(false)

  // OT 수업 상태 (스케줄 클릭 시) — TODO: 수업 상태 다이얼로그 UI 구현 예정
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [otClassSchedule, setOtClassSchedule] = useState<ScheduleItem | null>(null)

  // 스케줄 편집 다이얼로그 (OT/식사/회의 등 일반 스케줄용 — 시간/수업시간만)
  const [editSchedule, setEditSchedule] = useState<ScheduleItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editDuration, setEditDuration] = useState(50)
  const [editInbody, setEditInbody] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // PT 수업 진행 다이얼로그 (PT/PPT 스케줄 클릭 시)
  const [editPtSchedule, setEditPtSchedule] = useState<ScheduleItem | null>(null)
  const [editPtScheduleType, setEditPtScheduleType] = useState<'PT' | 'PPT' | '바챌'>('PT')
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
  // editPtInOut도 근무시간 기준 자동 판별로 대체
  const [editPtIsGroupPurchase, setEditPtIsGroupPurchase] = useState(false)
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
    dragStarted: boolean
  }
  const dragStateRef = useRef<DragRef | null>(null)
  // 드래그 중인 schedule id만 React state로 (시각 효과용 - shadow/ring 등)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // 드래그로 이동한 직후 click 이벤트 억제용
  const suppressNextClickRef = useRef(false)
  // 각 day column의 DOM 참조 (드래그 중 좌표 계산용)
  const dayColRefs = useRef<(HTMLDivElement | null)[]>([])
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const statsScrollRef = useRef<HTMLDivElement>(null)

  // ── 복사/붙여넣기 ──
  const [copiedSchedule, setCopiedSchedule] = useState<ScheduleItem | null>(null)
  const [showRapoImport, setShowRapoImport] = useState(false)
  const lastClickedScheduleRef = useRef<ScheduleItem | null>(null)
  const [pasteSaving, setPasteSaving] = useState(false)

  // Ctrl+C / Ctrl+V 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Ctrl+C: 마지막 클릭한 스케줄 복사
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && lastClickedScheduleRef.current) {
        // OT도 복사 가능
        setCopiedSchedule(lastClickedScheduleRef.current)
        e.preventDefault()
      }
      // Escape: 복사 모드 해제
      if (e.key === 'Escape') {
        setCopiedSchedule(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 복사한 스케줄 붙여넣기
  const handlePaste = async (day: Date, hour: number, half: number) => {
    if (!copiedSchedule || pasteSaving) return
    const dateStr = format(day, 'yyyy-MM-dd')
    const timeStr = `${String(hour).padStart(2, '0')}:${half === 0 ? '00' : '30'}`

    // PT/PPT는 붙여넣은 시간 기준 IN/OUT 재계산. 공동구매는 IN 유지.
    // 바챌은 별도 카테고리 (IN/OUT 무관, 통계는 schedule_type만 사용)
    let note = copiedSchedule.note
    if (isPtLikeType(copiedSchedule.schedule_type)) {
      const parsed = parsePtNote(note)
      const isBaChal = copiedSchedule.schedule_type === '바챌'
      const newInOut = isBaChal || parsed.isGroupPurchase ? 'IN' : getAutoInOut(dateStr, timeStr)
      note = buildPtNote({ ...parsed, inOut: newInOut })
    }

    const doPaste = async () => {
      setPasteSaving(true)
      if (copiedSchedule.schedule_type === 'OT') {
        // OT: assignment를 찾아서 upsertOtSession으로 생성
        const assignment = otMembers.find((a) =>
          a.member.name === copiedSchedule.member_name ||
          (copiedSchedule.ot_session_id && a.sessions?.some((s) => s.id === copiedSchedule.ot_session_id))
        )
        if (assignment) {
          const existingNums = new Set(assignment.sessions?.map((s) => s.session_number) ?? [])
          let nextN = 1
          while (existingNums.has(nextN)) nextN++
          const result = await upsertOtSession({
            ot_assignment_id: assignment.id,
            session_number: nextN,
            scheduled_at: new Date(`${dateStr}T${timeStr}:00+09:00`).toISOString(),
            duration: copiedSchedule.duration,
          })
          if (result?.error) {
            alert('붙여넣기 실패: ' + result.error)
            setPasteSaving(false)
            return
          }
        } else {
          alert('OT 회원 정보를 찾을 수 없습니다')
          setPasteSaving(false)
          return
        }
      } else {
        // PT/PPT/기타: trainer_schedules 직접 insert
        const { error } = await supabaseRef.current.from('trainer_schedules').insert({
          trainer_id: trainerId,
          schedule_type: copiedSchedule.schedule_type,
          member_name: copiedSchedule.member_name,
          member_id: copiedSchedule.member_id,
          scheduled_date: dateStr,
          start_time: timeStr,
          duration: copiedSchedule.duration,
          note,
        })
        if (error) {
          alert('붙여넣기 실패: ' + error.message)
          setPasteSaving(false)
          return
        }
      }
      setPasteSaving(false)
      await fetchSchedules()
      router.refresh()
    }

    // 충돌 검사
    const newStartSlot = (hour - 6) * SLOTS_PER_HOUR + half
    const heightSlots = Math.max(1, Math.ceil(copiedSchedule.duration / 30))
    const newEndSlot = newStartSlot + heightSlots
    const conflict = schedules.find((s) => {
      if (s.scheduled_date !== dateStr) return false
      const sStart = timeToSlot(s.start_time)
      const sEnd = sStart + Math.max(1, Math.ceil(s.duration / 30))
      return newStartSlot < sEnd && newEndSlot > sStart
    })
    if (conflict) {
      setConflictConfirm({
        conflicts: [{ date: dateStr, type: conflict.schedule_type, name: conflict.member_name, time: conflict.start_time }],
        onConfirm: doPaste,
      })
      return
    }
    await doPaste()
  }

  // 드래그 가능 여부:
  // - OT: 매칭되는 ot_session이 완료되지 않았을 때 (ot_session_id 매칭 못 찾으면 fallback으로 허용)
  // - 그 외 (PT/PPT/회의/식사 등): 항상 허용
  const canDragSchedule = useCallback((s: ScheduleItem): boolean => {
    // 승인된 OT 세션은 드래그 불가 (관리자/개발자는 예외)
    if (isOtApproved(s) && !isAdmin) return false
    return true
  }, [isOtApproved, isAdmin])

  // ── 근무시간 판별: 주말/공휴일은 항상 IN, 평일은 근무시간 내만 IN ──
  const hasWorkHours = !!(workStartTime && workEndTime)
  const workStartSlot = hasWorkHours ? (() => {
    const [h, m] = workStartTime!.split(':').map(Number)
    return Math.max(0, (h - 6) * SLOTS_PER_HOUR + (m >= 30 ? 1 : 0))
  })() : 0
  // 종료 시간: "15시까지" → 15시대 전체 포함, 16시부터 OUT
  // "00:00" (자정) = 24시로 처리
  const workEndSlot = hasWorkHours ? (() => {
    const [h, m] = workEndTime!.split(':').map(Number)
    const effectiveH = h === 0 ? 24 : h
    return (effectiveH - 6) * SLOTS_PER_HOUR + (m >= 30 ? 1 : 0) + SLOTS_PER_HOUR
  })() : TOTAL_SLOTS

  // PT/PPT 생성 시 시작 시간 기준으로 IN/OUT 자동 판별
  const getAutoInOut = useCallback((dateStr: string, time: string): 'IN' | 'OUT' => {
    if (!hasWorkHours) return 'IN'
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const day = new Date(yyyy, mm - 1, dd)
    if (isWeekendOrHoliday(day)) return 'IN'
    const [h, m] = time.split(':').map(Number)
    const slot = (h - 6) * SLOTS_PER_HOUR + (m >= 30 ? 1 : 0)
    return (slot >= workStartSlot && slot < workEndSlot) ? 'IN' : 'OUT'
  }, [hasWorkHours, workStartSlot, workEndSlot])

  // 서버(UTC)와 클라이언트(KST)의 시간 불일치로 hydration mismatch가 나면 React 18 production은
  // 전체 트리를 unmount → global-error 가 떠 버린다. 첫 렌더는 안정 placeholder로 통일하고,
  // mount 후에만 진짜 now 를 사용한다.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  // SSR/첫 렌더에서 사용할 stable placeholder (서버/클라 동일 결과 보장 — 2026-01-05는 월요일)
  const stableNow = now ?? new Date('2026-01-05T00:00:00Z')

  const baseWeekStart = useMemo(() => startOfWeek(stableNow, { weekStartsOn: 1 }), [stableNow])
  const weekStart = useMemo(() => addDays(baseWeekStart, weekOffset * 7), [baseWeekStart, weekOffset])
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekNum = Math.ceil(days[0].getDate() / 7)

  // 모바일: 오늘 날짜 컬럼으로 자동 스크롤
  useEffect(() => {
    const container = calendarScrollRef.current
    if (!container || !now) return
    const todayIdx = days.findIndex((d) => isSameDay(d, now))
    if (todayIdx <= 0) return
    const colWidth = 90
    const timeAxisWidth = 56
    const scrollTo = timeAxisWidth + colWidth * todayIdx - container.clientWidth / 2 + colWidth / 2
    container.scrollLeft = Math.max(0, scrollTo)
  }, [days, now]) // eslint-disable-line react-hooks/exhaustive-deps

  // 월간 통계: 오늘 날짜 컬럼으로 자동 스크롤 (좌우 sticky 컬럼은 항상 보임)
  useEffect(() => {
    if (viewMode !== 'month') return
    const container = statsScrollRef.current
    if (!container) return
    const today = new Date()
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + monthOffset)
    if (today.getFullYear() !== base.getFullYear() || today.getMonth() !== base.getMonth()) return
    const labelWidth = 110
    const colWidth = 36
    const scrollTo = labelWidth + colWidth * (today.getDate() - 1) - container.clientWidth / 2 + colWidth / 2
    container.scrollLeft = Math.max(0, scrollTo)
  }, [viewMode, monthOffset, schedules])

  // OT 배정된 회원 목록 (선택용)
  const otMembers = assignments.filter((a) => !['거부', '완료'].includes(a.status))

  const fetchSchedules = useCallback(async () => {
    const gen = ++fetchGenRef.current
    setLoading(true)
    setScheduleLoadError(null)
    try {
      let ws: string, we: string
      if (viewMode === 'month') {
        const base = new Date()
        base.setDate(1)
        base.setMonth(base.getMonth() + monthOffset)
        ws = format(base, 'yyyy-MM-dd')
        we = format(new Date(base.getFullYear(), base.getMonth() + 1, 0), 'yyyy-MM-dd')
      } else {
        ws = weekStartStr
        we = format(addDays(weekStart, 6), 'yyyy-MM-dd')
      }
      const { data, error } = await supabaseRef.current
        .from('trainer_schedules')
        .select('*')
        .eq('trainer_id', trainerId)
        .gte('scheduled_date', ws)
        .lte('scheduled_date', we)
        .order('start_time')
      // 더 새로운 fetch가 시작됐으면 결과 무시 (placeholder 주차 → 현재 주차 전환 시 stale fetch 차단)
      if (gen !== fetchGenRef.current) return
      if (error) throw new Error(error.message)
      // PostgreSQL time 컬럼은 "HH:MM:SS" 형식으로 반환됨 → "HH:MM"으로 정규화해서
      // 수정 다이얼로그의 슬롯 매칭/<input type="time"> 동작과 일관되게 함
      const normalized = ((data ?? []) as ScheduleItem[]).map((d) => ({
        ...d,
        start_time: typeof d.start_time === 'string' ? d.start_time.slice(0, 5) : d.start_time,
      }))
      setSchedules(normalized)
      scheduleRetryRef.current = 0
    } catch (err) {
      if (gen !== fetchGenRef.current) return
      console.error('스케줄 조회 에러:', err)
      // 인증/RLS 미준비로 인한 에러일 가능성 → 자동 재시도 (최대 3회, backoff)
      if (scheduleRetryRef.current < 3) {
        scheduleRetryRef.current += 1
        const delay = 400 * scheduleRetryRef.current
        scheduleRetryTimerRef.current = setTimeout(() => { void fetchSchedules() }, delay)
        return
      }
      setScheduleLoadError(err instanceof Error ? err.message : '스케줄을 불러오지 못했습니다')
    } finally {
      if (gen === fetchGenRef.current) setLoading(false)
    }
  }, [trainerId, weekStartStr, viewMode, monthOffset, weekStart])

  useEffect(() => {
    // 첫 렌더(SSR placeholder 시점) — now가 null이면 weekStartStr이 placeholder("2026-01-05")라
    // 과거 주차 fetch가 발화되어 정상 데이터를 덮어쓰는 레이스를 만든다. now가 set된 뒤에만 fetch.
    if (!now) return
    scheduleRetryRef.current = 0
    fetchSchedules()
    // 탭 복귀 시 스케줄이 비어있으면 재조회 (ref로 최신값 참조)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && schedulesRef.current.length === 0 && !loadingRef.current) {
        scheduleRetryRef.current = 0
        void fetchSchedules()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (scheduleRetryTimerRef.current) clearTimeout(scheduleRetryTimerRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchSchedules, now])

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
    setCreateType('PT')
    setCreateName('')
    setCreateOtSessionId('')
    setCreateDuration(50)
    setCreateNote('')
    setCreateIsSalesTarget(false)
    setCreateExpectedAmount(0)
    setCreateExpectedSessions(0)
    setCreateClosingProb(0)
    setCreateRepeatDows([])
    setCreateOtFilter('')
    setCreateMemberPhone('')
    setCreatePtCurrentSession('')
    setCreatePtTotalSession('')
    setCreateIsGroupPurchase(false)
    setCreatePtFilter('')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (createType === 'OT' && !createOtSessionId) return
    if (isPtLikeType(createType) && !createName.trim()) return
    // 식사/회의/대외활동 등 비-회원 타입은 제목(createName) 입력 불필요 — 빈 문자열로 저장

    // 이중 클릭 방지: ref로 즉시 차단 (state는 비동기라 rapid click 허용될 수 있음)
    if (createSavingRef.current) return
    createSavingRef.current = true
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
        stopCreateSaving()
        return
      }
      // 사용자가 드롭다운에서 선택한 회차를 그대로 사용 (캐시 stale 시에도 정확)
      // - 'new-{assignmentId}-{N}' 형식이면 마지막 '-' 뒤가 N
      // - 기존 세션 ID면 해당 세션의 session_number 사용
      // - 어느 쪽도 안 되면 fallback: 빈 가장 작은 번호
      let nextN = 1
      if (createOtSessionId.startsWith('new-')) {
        const lastDash = createOtSessionId.lastIndexOf('-')
        const parsed = Number(createOtSessionId.slice(lastDash + 1))
        if (parsed > 0) nextN = parsed
      } else {
        const existing = assignment.sessions?.find((s) => s.id === createOtSessionId)
        if (existing) nextN = existing.session_number
      }
      // 안전장치: 위 경로 모두 실패 시 빈 슬롯 채우기
      if (!nextN || nextN < 1) {
        const existingNums = new Set(assignment.sessions?.map((s) => s.session_number) ?? [])
        nextN = 1
        while (existingNums.has(nextN)) nextN++
      }

      // OT 충돌 검사
      const otDurationSlots = Math.max(1, Math.ceil(createDuration / 30))
      const otStartSlot = timeToSlot(createTime)
      const otEndSlot = otStartSlot + otDurationSlots
      const otConflict = schedules.find((s) => {
        if (s.scheduled_date !== createDate) return false
        const sStart = timeToSlot(s.start_time)
        const sEnd = sStart + Math.max(1, Math.ceil(s.duration / 30))
        return otStartSlot < sEnd && otEndSlot > sStart
      })

      const doOtCreate = async () => {
        const result = await upsertOtSession({
          ot_assignment_id: assignment.id,
          session_number: nextN,
          scheduled_at: new Date(`${createDate}T${createTime}:00+09:00`).toISOString(),
          duration: createDuration,
        })
        if (result?.error) {
          alert('저장 실패: ' + result.error)
          stopCreateSaving()
          return
        }
        if (createIsSalesTarget || createExpectedAmount > 0 || createExpectedSessions > 0) {
          await updateOtAssignment(assignment.id, {
            is_sales_target: createIsSalesTarget,
            expected_amount: createExpectedAmount,
            expected_sessions: createExpectedSessions,
            closing_probability: createClosingProb,
          })
        }
        setShowCreate(false)
        startTransition(() => router.refresh())
        fetchSchedules()
        stopCreateSaving()
      }

      if (otConflict) {
        setConflictConfirm({
          conflicts: [{ date: createDate, type: otConflict.schedule_type, name: otConflict.member_name, time: otConflict.start_time }],
          onConfirm: doOtCreate,
        })
        return
      }
      await doOtCreate()
      return
    } else {
      // OT가 아닌 일정 — 다중 요일 반복 생성 가능
      // RANGE_TYPES (식사/회의/당직 등)는 createEndTime - createTime = duration 자동 계산
      let effectiveDuration = createDuration
      if (RANGE_TYPES.has(createType)) {
        if (!createEndTime) {
          alert('종료 시간을 입력해주세요')
          stopCreateSaving()
          return
        }
        const [sh, sm] = createTime.split(':').map(Number)
        const [eh, em] = createEndTime.split(':').map(Number)
        const startMin = sh * 60 + sm
        const endMin = eh * 60 + em
        if (endMin <= startMin) {
          alert('종료 시간은 시작 시간보다 늦어야 합니다')
          stopCreateSaving()
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
      const newDurationSlots = Math.max(1, Math.ceil(effectiveDuration / 30))
      const newStartSlot = timeToSlot(createTime)
      const newEndSlot = newStartSlot + newDurationSlots
      const foundConflicts: { date: string; type: string; name: string; time: string }[] = []
      for (const d of dateList) {
        const conflict = schedules.find((s) => {
          if (s.scheduled_date !== d) return false
          const sStart = timeToSlot(s.start_time)
          const sEnd = sStart + Math.max(1, Math.ceil(s.duration / 30))
          return newStartSlot < sEnd && newEndSlot > sStart
        })
        if (conflict) {
          foundConflicts.push({ date: d, type: conflict.schedule_type, name: conflict.member_name, time: conflict.start_time })
        }
      }

      // 3) 이름 결정
      const memberName = createName.trim()

      // 4) PT/PPT/바챌는 phone+회차+메모를 note에 통합 저장. 그 외는 createNote 그대로.
      // - 공동구매(PT/PPT): 강제 IN
      // - 바챌: IN/OUT과 무관한 별도 카테고리 (note의 inOut 값은 통계에서 무시됨)
      // - 그 외 PT/PPT: 날짜·시간 기준 자동 판별 (반복 등록 시 날짜별로 다르게)
      const ptLike = isPtLikeType(createType)
      const groupPurchase = (createType === 'PT' || createType === 'PPT') && createIsGroupPurchase
      const isBaChal = createType === '바챌'
      const buildPtNoteFor = (date: string) =>
        buildPtNote({
          phone: createMemberPhone,
          current: createPtCurrentSession,
          total: createPtTotalSession,
          // 바챌은 별도 카테고리(IN/OUT 무관) — 편의상 IN으로 저장하지만 통계는 schedule_type만 사용
          inOut: isBaChal || groupPurchase ? 'IN' : getAutoInOut(date, createTime),
          isGroupPurchase: groupPurchase,
          memo: createNote,
        })

      const doNonOtCreate = async () => {
        // 일괄 INSERT (날짜별로 IN/OUT 자동 판별)
        const rows = dateList.map((d) => ({
          trainer_id: trainerId,
          schedule_type: createType,
          member_name: memberName,
          member_id: null,
          scheduled_date: d,
          start_time: createTime,
          duration: effectiveDuration,
          note: ptLike ? buildPtNoteFor(d) : (createNote || null),
        }))
        const { error } = await supabaseRef.current.from('trainer_schedules').insert(rows)
        if (error) {
          alert('저장 실패: ' + error.message)
          stopCreateSaving()
          return
        }
        // PT/PPT/바챌 스케줄: 해당 월 pt_members 4 카테고리 카운트 증가
        if (isPtLikeType(createType) && memberName) {
          const results = await Promise.all(dateList.map((d) => {
            const month = d.slice(0, 7)
            let category: 'IN' | 'OUT' | 'GROUP_PURCHASE' | 'BACHAL'
            if (createType === '바챌') category = 'BACHAL'
            else {
              const parsed = parsePtNote(buildPtNoteFor(d))
              if (parsed.isGroupPurchase) category = 'GROUP_PURCHASE'
              else if (parsed.inOut === 'OUT') category = 'OUT'
              else category = 'IN'
            }
            return adjustPtMemberSessions(trainerId, memberName, month, category, +1)
          }))
          const missing = results.some((r) => 'skipped' in r && r.skipped)
          if (missing) {
            const months = Array.from(new Set(dateList.map((d) => d.slice(0, 7)))).join(', ')
            alert(`⚠️ PT 회원 미등록\n회원: ${memberName}\n월: ${months}\n→ PT회원 페이지에서 먼저 ${memberName} 등록 필요`)
          }
        }
        setShowCreate(false)
        startTransition(() => router.refresh())
        fetchSchedules()
        stopCreateSaving()
      }

      if (foundConflicts.length > 0) {
        setConflictConfirm({
          conflicts: foundConflicts,
          onConfirm: doNonOtCreate,
        })
        return
      }
      await doNonOtCreate()
      return
    }
  }

  const handleDelete = async (id: string) => {
    // 삭제 대상 스케줄 정보 보존
    const target = schedules.find((s) => s.id === id)

    // 승인된 OT 세션은 삭제 불가 (관리자/개발자는 예외)
    if (target && isOtApproved(target) && !isAdmin) {
      alert('승인이 완료된 OT 세션은 삭제할 수 없습니다.\n관리자에게 요청해주세요.')
      return
    }

    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return
    setSchedules((prev) => prev.filter((s) => s.id !== id))

    // OT 스케줄이면 deleteOtSession server action으로 처리 (프로그램 세션도 함께 정리)
    if (target?.schedule_type === 'OT' && target.ot_session_id) {
      const { data: session } = await supabaseRef.current
        .from('ot_sessions')
        .select('ot_assignment_id, session_number')
        .eq('id', target.ot_session_id)
        .single()
      if (session) {
        const result = await deleteOtSession(session.ot_assignment_id, session.session_number)
        if (result?.error) console.error('OT 삭제 실패:', result.error)
      } else {
        // fallback: session 조회 실패 시 직접 삭제
        await supabaseRef.current.from('trainer_schedules').delete().eq('ot_session_id', target.ot_session_id)
        await supabaseRef.current.from('ot_sessions').delete().eq('id', target.ot_session_id)
      }
    } else {
      const { error } = await supabaseRef.current.from('trainer_schedules').delete().eq('id', id)
      if (error) {
        console.error('삭제 실패:', error.message)
      } else if (target && isPtLikeType(target.schedule_type) && target.member_name) {
        // PT/PPT/바챌 삭제 시 해당 월 카테고리 카운트 차감 (잔여세션 복원)
        let category: 'IN' | 'OUT' | 'GROUP_PURCHASE' | 'BACHAL'
        if (target.schedule_type === '바챌') category = 'BACHAL'
        else {
          const parsed = parsePtNote(target.note)
          if (parsed.isGroupPurchase) category = 'GROUP_PURCHASE'
          else if (parsed.inOut === 'OUT') category = 'OUT'
          else category = 'IN'
        }
        const month = target.scheduled_date.slice(0, 7)
        await adjustPtMemberSessions(target.trainer_id, target.member_name, month, category, -1)
      }
    }
    fetchSchedules()
    startTransition(() => router.refresh())
  }

  // 스케줄 블록 클릭 → 타입에 따라 적절한 다이얼로그 분기
  const openMemberDetail = (schedule: ScheduleItem) => {
    // PT/PPT/바챌 스케줄은 PT 수업 진행 전용 다이얼로그
    if (isPtLikeType(schedule.schedule_type)) {
      const parsed = parsePtNote(schedule.note)
      // 회차/총회차는 캘린더 블록 라벨과 동일한 라이브 계산값을 사용 (note의 옛 값 우선순위 낮춤)
      // - current: sessionPosById의 시간순 자동 회차 (없으면 note의 current)
      // - total: 해당 월 pt_members.total_sessions (0 또는 없으면 note의 total)
      const autoPos = sessionPosById.get(schedule.id)
      const month = schedule.scheduled_date.slice(0, 7)
      const pm = schedule.member_name ? ptMemberByNameMonth.get(`${schedule.member_name}|${month}`) : null
      const liveCurrent = autoPos ?? (Number(parsed.current) || 0)
      const liveTotal = (pm && pm.total_sessions > 0) ? pm.total_sessions : (Number(parsed.total) || 0)

      setEditPtSchedule(schedule)
      setEditPtScheduleType(schedule.schedule_type as 'PT' | 'PPT' | '바챌')
      setEditPtMemberName(schedule.member_name)
      setEditPtPhone(parsed.phone)
      setEditPtTime(schedule.start_time)
      setEditPtDuration(schedule.duration)
      setEditPtCurrentSession(liveCurrent > 0 ? String(liveCurrent) : '')
      setEditPtTotalSession(liveTotal > 0 ? String(liveTotal) : '')
      setEditPtIsSalesTarget(parsed.isSalesTarget)
      setEditPtExpectedAmount(parsed.expectedAmount)
      setEditPtClassResult(parsed.classResult)
      setEditPtMemo(parsed.memo)
      setEditPtIsGroupPurchase(parsed.isGroupPurchase)
      return
    }
    // 승인된 OT 세션은 수정 불가 (관리자/개발자는 예외)
    if (isOtApproved(schedule) && !isAdmin) {
      alert('승인이 완료된 OT 세션은 수정할 수 없습니다.\n관리자에게 요청해주세요.')
      return
    }
    // OT 스케줄 클릭 → 간단한 스케줄 수정 팝업
    setEditSchedule(schedule)
    setEditDate(schedule.scheduled_date)
    setEditTime(schedule.start_time)
    setEditDuration(schedule.duration)
    setEditInbody(schedule.schedule_type === 'OT' && !!schedule.ot_session_id ? inbodySessionIds.has(schedule.ot_session_id) : false)
  }

  const handleEditPtScheduleSave = async () => {
    if (!editPtSchedule) return
    setEditPtSaving(true)
    // - 공동구매(PT/PPT): 강제 IN
    // - 바챌: IN/OUT과 무관한 별도 카테고리 (저장 값은 통계에서 무시됨)
    // - 그 외: 시간 기준 자동 판별
    const groupPurchase = (editPtScheduleType === 'PT' || editPtScheduleType === 'PPT') && editPtIsGroupPurchase
    const isBaChal = editPtScheduleType === '바챌'
    const noteValue = buildPtNote({
      phone: editPtPhone,
      current: editPtCurrentSession,
      total: editPtTotalSession,
      isSalesTarget: editPtIsSalesTarget,
      expectedAmount: editPtExpectedAmount,
      classResult: editPtClassResult,
      inOut: isBaChal || groupPurchase ? 'IN' : getAutoInOut(editPtSchedule.scheduled_date, editPtTime),
      isGroupPurchase: groupPurchase,
      memo: editPtMemo,
    })
    const { error } = await supabaseRef.current
      .from('trainer_schedules')
      .update({
        schedule_type: editPtScheduleType,
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
    if (dragStateRef.current) return
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
      dragStarted: false,
    }

    e.preventDefault()
    e.stopPropagation()
  }

  const handleSchedulePointerMove = (e: React.PointerEvent) => {
    const cur = dragStateRef.current
    if (!cur || cur.saving) return
    if (cur.schedule.id !== (e.currentTarget as HTMLElement).dataset.scheduleId) return

    const dx = e.clientX - cur.startClientX
    const dy = e.clientY - cur.startClientY

    // 최소 이동 거리 도달 전까지 드래그 시작 안 함 (미세한 움직임 무시)
    if (!cur.dragStarted) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      cur.dragStarted = true
      setDraggingId(cur.schedule.id)
    }

    // 직접 DOM transform — React state 업데이트 없음 → 60fps
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

    // 드래그 시작 안 됐으면 클릭으로 처리
    if (!cur.dragStarted || (Math.abs(dx) < 5 && Math.abs(dy) < 5)) {
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
    const slot = Math.round(newTopInCol / slotH)

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
    const doMove = async () => {
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
          // PT/PPT는 이동한 시간대에 맞춰 note의 IN/OUT 재계산. 공동구매는 IN 유지.
          // 바챌은 별도 카테고리 (IN/OUT 무관, 통계는 schedule_type만 사용)
          const updates: { scheduled_date: string; start_time: string; note?: string | null } = {
            scheduled_date: newDateStr,
            start_time: newTimeStr,
          }
          if (isPtLikeType(cur.schedule.schedule_type)) {
            const parsed = parsePtNote(cur.schedule.note)
            const isBaChal = cur.schedule.schedule_type === '바챌'
            const newInOut = isBaChal || parsed.isGroupPurchase ? 'IN' : getAutoInOut(newDateStr, newTimeStr)
            updates.note = buildPtNote({ ...parsed, inOut: newInOut })
          }
          const { error } = await supabaseRef.current
            .from('trainer_schedules')
            .update(updates)
            .eq('id', cur.schedule.id)
          if (error) {
            alert('이동 실패: ' + error.message)
          }
        }
      } catch (err) {
        alert('이동 중 오류: ' + (err instanceof Error ? err.message : String(err)))
      }
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      await fetchSchedules()
      router.refresh()
    }

    if (conflict) {
      // 충돌 확인 팝업 — 취소 시 원위치 복구
      cur.blockEl.style.transform = ''
      cur.blockEl.style.zIndex = ''
      dragStateRef.current = null
      setDraggingId(null)
      setConflictConfirm({
        conflicts: [{ date: newDateStr, type: conflict.schedule_type, name: conflict.member_name, time: conflict.start_time }],
        onConfirm: doMove,
      })
      return
    }

    await doMove()
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
      const newScheduledAt = new Date(`${editDate}T${editTime}:00+09:00`).toISOString()
      const result = await moveOtSchedule({
        ot_session_id: editSchedule.ot_session_id,
        newScheduledAtIso: newScheduledAt,
        newDateStr: editDate,
        newTimeStr: editTime,
        newDuration: editDuration !== editSchedule.duration ? editDuration : undefined,
      })
      if ('error' in result && result.error) {
        alert('수정 실패: ' + result.error)
        setEditSaving(false)
        return
      }
      // 인바디 토글 변경 적용
      const wasInbody = inbodySessionIds.has(editSchedule.ot_session_id)
      if (wasInbody !== editInbody) {
        try {
          await toggleInbodyForOtSchedule(editSchedule, editInbody)
        } catch (err) {
          console.error('인바디 저장 실패:', err)
        }
      }
    } else {
      // OT가 아닌 일정 — 단일 row update
      const { error } = await supabaseRef.current
        .from('trainer_schedules')
        .update({ scheduled_date: editDate, start_time: editTime, duration: editDuration })
        .eq('id', editSchedule.id)
      if (error) {
        alert('수정 실패: ' + error.message)
        setEditSaving(false)
        return
      }
    }

    await fetchSchedules()
    setEditSchedule(null)
    setEditSaving(false)
    startTransition(() => router.refresh())
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
      <div className="space-y-1.5 sm:space-y-3">
        {/* 네비게이션 */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* 주간/월간 토글 */}
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              <button
                className={`px-2 py-1 text-[10px] sm:text-xs font-bold ${viewMode === 'week' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setViewMode('week')}
              >주간</button>
              <button
                className={`px-2 py-1 text-[10px] sm:text-xs font-bold ${viewMode === 'month' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                onClick={() => { setViewMode('month'); setMonthOffset(0) }}
              >월간</button>
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 bg-white text-gray-700 border-gray-300" onClick={() => startTransition(() => viewMode === 'week' ? setWeekOffset((p) => p - 1) : setMonthOffset((p) => p - 1))}>
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-bold text-white bg-gray-900 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md min-w-0 sm:min-w-[140px] text-center whitespace-nowrap">
              {viewMode === 'week'
                ? `${format(weekStart, 'M월', { locale: ko })} ${weekNum}주차`
                : format(addDays(stableNow, monthOffset * 30), 'yyyy년 M월', { locale: ko })
              }
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 bg-white text-gray-700 border-gray-300" onClick={() => startTransition(() => viewMode === 'week' ? setWeekOffset((p) => p + 1) : setMonthOffset((p) => p + 1))}>
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {hasWorkHours && (
              <span className="text-[10px] sm:text-sm font-bold text-white bg-blue-600 px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-md shadow-sm whitespace-nowrap">
                {workStartTime}~{workEndTime}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 text-[10px] sm:text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 whitespace-nowrap px-2 sm:px-3"
              onClick={() => setShowRapoImport(true)}
              title="라포스케줄 이미지"
            >
              <ImageIcon className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">라포스케줄 이미지</span>
            </Button>
          </div>
        </div>

        {/* 범례 — 모바일에서 숨김. 순서: OT/PT 계열 → 근무 상태 → 업무/기타 → 매출표시 */}
        <div className="hidden sm:flex flex-wrap gap-3 text-xs">
          {/* OT/PT 계열 */}
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100/70 border border-blue-300" /> OT</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200/70 border border-slate-400" /> PT</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100/70 border border-purple-300" /> PPT</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100/70 border border-green-300" /> 바챌</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200/80 border border-yellow-400" /> 공동구매</span>
          {/* 근무 상태 (PT 계열 옆에 배치) */}
          {hasWorkHours && (<>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200/70 border border-slate-400" /> 근무(IN)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100/70 border border-orange-300" /> 근무외(OUT)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-zinc-300/70 border border-zinc-500" /> 주말·공휴일</span>
          </>)}
          <span className="flex items-center gap-1"><span className="text-yellow-500">★</span> 매출대상</span>
          {/* 업무 / 회의 / 기타 */}
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-fuchsia-100/70 border border-fuchsia-300" /> 식사</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-pink-100/70 border border-pink-300" /> 홍보</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-lime-100/70 border border-lime-300" /> 회의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100/70 border border-amber-300" /> 전체회의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-200/70 border border-stone-400" /> 간부회의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100/70 border border-sky-300" /> 간담회</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100/70 border border-rose-300" /> 당직</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-200/70 border border-neutral-400" /> 기타</span>
        </div>

        {/* 복사 모드 배너 */}
        {copiedSchedule && (
          <div className="flex items-center justify-between rounded-lg bg-green-100 border border-green-400 px-4 py-2">
            <p className="text-sm font-bold text-green-800">
              {copiedSchedule.schedule_type} {copiedSchedule.member_name} ({copiedSchedule.duration}분) 복사됨 — 빈 시간을 클릭하면 붙여넣기
            </p>
            <button
              onClick={() => setCopiedSchedule(null)}
              className="text-green-600 hover:text-green-800 text-xs font-bold border border-green-400 rounded px-2 py-1"
            >
              취소 (ESC)
            </button>
          </div>
        )}

        {/* 스케줄 로딩 실패 배너 */}
        {scheduleLoadError && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-300 px-4 py-2">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm font-medium">{scheduleLoadError}</span>
            </div>
            <button
              onClick={() => { scheduleRetryRef.current = 0; void fetchSchedules() }}
              className="flex items-center gap-1 px-2.5 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-bold rounded shrink-0"
            >
              <RefreshCw className="h-3 w-3" /> 다시 시도
            </button>
          </div>
        )}

        {/* 월간 뷰 */}
        {viewMode === 'month' && (() => {
          const baseMonth = new Date(stableNow.getTime())
          baseMonth.setDate(1)
          baseMonth.setMonth(baseMonth.getMonth() + monthOffset)
          const year = baseMonth.getFullYear()
          const month = baseMonth.getMonth()
          const firstDay = new Date(year, month, 1)
          const lastDay = new Date(year, month + 1, 0)
          const startDow = firstDay.getDay() // 0=일
          const totalDays = lastDay.getDate()
          const weeks: (number | null)[][] = []
          let week: (number | null)[] = Array(startDow).fill(null)
          for (let d = 1; d <= totalDays; d++) {
            week.push(d)
            if (week.length === 7) { weeks.push(week); week = [] }
          }
          if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }

          const typeColor: Record<string, string> = { OT: 'bg-emerald-400', PT: 'bg-blue-400', PPT: 'bg-violet-400', 바챌: 'bg-yellow-400' }

          // 필터 적용
          const filteredSchedules = monthFilter === '전체' ? schedules : schedules.filter((s) => s.schedule_type === monthFilter)

          // 이 달의 스케줄을 날짜별 그룹
          const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
          const daySchedules = new Map<number, typeof schedules>()
          for (const s of filteredSchedules) {
            if (s.scheduled_date.startsWith(monthStr)) {
              const day = Number(s.scheduled_date.slice(8, 10))
              if (!daySchedules.has(day)) daySchedules.set(day, [])
              daySchedules.get(day)!.push(s)
            }
          }

          // OT 차수 맵 생성 (ot_session_id → session_number)
          const sessionNumMap = new Map<string, number>()
          for (const a of assignments) {
            for (const sess of a.sessions ?? []) {
              sessionNumMap.set(sess.id, sess.session_number)
            }
          }

          return (
            <div className="space-y-2">
            <div className="flex gap-1.5">
              {(['전체', 'OT', 'PT', 'PPT', '바챌'] as const).map((f) => (
                <button
                  key={f}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                    monthFilter === f
                      ? f === 'OT' ? 'bg-emerald-500 text-white' : f === 'PT' ? 'bg-blue-500 text-white' : f === 'PPT' ? 'bg-violet-500 text-white' : f === '바챌' ? 'bg-yellow-500 text-black' : 'bg-gray-900 text-white'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setMonthFilter(f)}
                >{f}</button>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white -mx-4 sm:mx-0 overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-900 text-white text-xs text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                  <div key={d} className="py-2 font-bold">{d}</div>
                ))}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-t border-gray-200">
                  {week.map((day, di) => {
                    const isToday = !!(day && now && now.getDate() === day && now.getMonth() === month && now.getFullYear() === year)
                    const dayItems = day ? (daySchedules.get(day) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time)) : []
                    return (
                      <div
                        key={di}
                        className={`min-h-[280px] border-l border-gray-100 p-1 cursor-pointer hover:bg-gray-50 ${!day ? 'bg-gray-50' : ''} ${isToday ? 'bg-yellow-50' : ''} ${di === 0 || di === 6 ? 'bg-red-50/30' : ''}`}
                        onClick={() => {
                          if (!day) return
                          const clickedDate = new Date(year, month, day)
                          const today = new Date()
                          const diff = Math.round((clickedDate.getTime() - today.getTime()) / (7 * 86400000))
                          setWeekOffset(diff)
                          setViewMode('week')
                        }}
                      >
                        {day && (
                          <>
                            <p className={`text-xs font-bold mb-0.5 ${isToday ? 'text-yellow-600' : di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</p>
                            <div className="space-y-px">
                              {dayItems.slice(0, 16).map((s) => {
                                const otNum = s.schedule_type === 'OT' && s.ot_session_id ? sessionNumMap.get(s.ot_session_id) : null
                                return (
                                  <div key={s.id} className={`rounded px-1 py-px text-[9px] sm:text-[10px] truncate text-white font-medium leading-tight ${typeColor[s.schedule_type] ?? 'bg-gray-400'}`}>
                                    {s.start_time.slice(0, 5)} {s.member_name}{otNum ? ` ${otNum}차` : ''}{s.schedule_type !== 'OT' ? ` ${s.schedule_type}` : ''}
                                  </div>
                                )
                              })}
                              {dayItems.length > 16 && (
                                <p className="text-[9px] text-gray-500">+{dayItems.length - 16}건</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            </div>
          )
        })()}

        {/* 주간 캘린더 */}
        {viewMode === 'week' && (
        <div ref={calendarScrollRef} className="rounded-lg border border-gray-200 bg-white overflow-x-auto -mx-4 sm:mx-0">
          {/* 헤더 */}
          <div className="flex border-b border-gray-200 sticky top-0 bg-gray-900 z-10">
            <div className={`${isMobile ? 'w-8' : 'w-14'} shrink-0`} />
            {days.map((day, i) => {
              const isToday = !!now && isSameDay(day, now)
              const dateStr = format(day, 'yyyy-MM-dd')
              const holidayName = KOREAN_HOLIDAYS[dateStr]
              const isWeekend = i >= 5
              const isHolidayDay = isWeekend || !!holidayName
              return (
                <div key={i} className={`flex-1 text-center ${isMobile ? 'py-1' : 'py-3'} border-l border-gray-700 ${isMobile ? 'min-w-0' : 'min-w-[90px]'} ${isToday ? 'bg-yellow-500/20' : ''}`} style={{ height: slotH * 2 }}>
                  <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} ${isHolidayDay ? 'text-red-400' : 'text-gray-400'}`}>
                    {DAY_LABELS[day.getDay()]}
                    {!isMobile && holidayName && <span className="ml-0.5">({holidayName})</span>}
                  </p>
                  <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold ${isToday ? `bg-yellow-400 text-black rounded-full ${isMobile ? 'w-6 h-6 text-xs' : 'w-8 h-8'} flex items-center justify-center mx-auto` : isHolidayDay ? 'text-red-400' : 'text-white'}`}>
                    {day.getDate()}
                  </p>
                </div>
              )
            })}
          </div>

          {/* 바디 */}
          <div className="flex" style={{ minWidth: isMobile ? undefined : 700 }}>
            {/* 시간 축 */}
            <div className={`${isMobile ? 'w-8' : 'w-14'} shrink-0 bg-gray-50`}>
              {HOURS.map((hour) => (
                <div key={hour} style={{ height: slotH * 2 }} className={`border-b border-gray-300 px-0.5 ${isMobile ? 'text-[8px]' : 'text-[10px]'} text-gray-700 font-bold text-center flex items-center justify-center`}>
                  {isMobile ? hour : `${String(hour).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* 날짜 컬럼 */}
            {days.map((day, dayIdx) => {
              const isToday = !!now && isSameDay(day, now)
              const daySchedules = getSchedulesForDay(day)

              return (
                <div
                  key={dayIdx}
                  ref={(el) => { dayColRefs.current[dayIdx] = el }}
                  className={`flex-1 border-l border-gray-300 relative ${isMobile ? 'min-w-0' : 'min-w-[90px]'} ${isToday ? 'bg-yellow-50/50' : ''}`}
                >
                  {/* 30분 단위 그리드 — 배경은 흰색 통일, IN/OUT 구분은 블록 색상으로 표기 */}
                  {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
                    const hour = Math.floor(slotIdx / 2) + 6
                    const half = slotIdx % 2
                    return (
                      <div
                        key={slotIdx}
                        style={{ height: slotH, ...(copiedSchedule ? { cursor: 'copy' } : {}) }}
                        className={`${half === 1 ? 'border-b border-gray-300' : 'border-b border-gray-100'} ${copiedSchedule ? '' : 'cursor-pointer'} hover:bg-yellow-100 transition-colors ${copiedSchedule ? 'hover:bg-green-100' : ''}`}
                        onClick={() => copiedSchedule ? handlePaste(day, hour, half) : openCreate(day, hour, half)}
                      />
                    )
                  })}

                  {/* 스케줄 블록 (절대 위치) — 중복 시 나란히 표시 */}
                  {(() => {
                    // 겹치는 블록 column 레이아웃 계산
                    const items = daySchedules.map((s) => {
                      const [sh, sm] = s.start_time.split(':').map(Number)
                      const startMin = sh * 60 + sm
                      const endMin = startMin + s.duration
                      return { s, startMin, endMin }
                    }).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
                    // 각 블록의 column index와 총 column 수 계산
                    const colMap = new Map<string, { col: number; total: number }>()
                    const groups: typeof items[] = []
                    for (const item of items) {
                      let placed = false
                      for (const g of groups) {
                        if (g[g.length - 1].endMin > item.startMin) {
                          g.push(item)
                          placed = true
                          break
                        }
                      }
                      if (!placed) groups.push([item])
                    }
                    // 실제 동시 겹침 처리 (greedy column assignment)
                    const colAssign = new Map<string, number>()
                    const processed: typeof items = []
                    for (const item of items) {
                      // 현재 겹치는 블록들 중 사용 중인 column 확인
                      const usedCols = new Set<number>()
                      for (const p of processed) {
                        if (p.endMin > item.startMin) {
                          usedCols.add(colAssign.get(p.s.id) ?? 0)
                        }
                      }
                      let col = 0
                      while (usedCols.has(col)) col++
                      colAssign.set(item.s.id, col)
                      processed.push(item)
                    }
                    // 각 블록의 총 column 수 = 겹치는 그룹 내 최대 column + 1
                    for (const item of items) {
                      const myCol = colAssign.get(item.s.id) ?? 0
                      let maxCol = myCol
                      for (const other of items) {
                        if (other.s.id === item.s.id) continue
                        if (other.startMin < item.endMin && other.endMin > item.startMin) {
                          maxCol = Math.max(maxCol, colAssign.get(other.s.id) ?? 0)
                        }
                      }
                      colMap.set(item.s.id, { col: myCol, total: maxCol + 1 })
                    }
                    return daySchedules.map((s) => {
                    const slot = timeToSlot(s.start_time)
                    // 시작 시간의 분 단위 오프셋 (예: 18:50 → 50분의 30분 슬롯 내 20분 오프셋)
                    const [, startMin] = s.start_time.split(':').map(Number)
                    const minuteOffset = startMin % 30  // 슬롯 내 오프셋 (분)
                    const pixelOffset = (minuteOffset / 30) * slotH
                    const top = slot * slotH + pixelOffset
                    // duration을 정확한 픽셀 높이로 (50분이면 50/30 * slotH)
                    const height = Math.max(slotH * 0.8, (s.duration / 30) * slotH) - 2
                    const layout = colMap.get(s.id) ?? { col: 0, total: 1 }
                    const colWidth = 100 / layout.total
                    const colLeft = layout.col * colWidth
                    // 회원 정보 매칭 — OT 스케줄만 ot_assignments에서 찾음
                    // PT/PPT/바챌은 동명이인 OT 회원의 매출대상자 표시가 잘못 묻어오는 문제를 방지
                    const matched = s.schedule_type === 'OT'
                      ? assignments.find((a) => a.member.name === s.member_name)
                      : null
                    // PT 매출대상자/금액/수업결과는 note의 prefix로 판별 (PT/PPT/바챌)
                    const ptParsed = isPtLikeType(s.schedule_type) ? parsePtNote(s.note) : null
                    // 주말/공휴일은 무조건 IN으로 표시 (저장된 값 무시)
                    const sDate = new Date(s.scheduled_date + 'T00:00:00')
                    const isInForce = isWeekendOrHoliday(sDate)
                    // IN/OUT은 현재 근무시간 기준으로 라이브 계산 — 저장 당시 근무시간이 비어있거나
                    // 달랐던 과거 스케줄도 현재 근무시간 변경에 즉시 반영되도록 함
                    const effectiveInOut: 'IN' | 'OUT' = ptParsed
                      ? (isInForce || ptParsed.isGroupPurchase ? 'IN' : getAutoInOut(s.scheduled_date, s.start_time))
                      : 'IN'
                    // 색상 결정:
                    //   - PT/PPT 노쇼/차감노쇼: 빨강
                    //   - 바챌: 항상 초록
                    //   - 공동구매 PT: 노랑
                    //   - PT/PPT 주말·공휴일(강제 IN): 슬레이트(회색 변형)
                    //   - PT/PPT IN: 회색 / OUT: 주황
                    //   - 그 외 타입(OT/식사/회의 등): 타입 기본색
                    const ptResult = ptParsed?.classResult ?? ''
                    const isNoShow = ptResult === '노쇼' || ptResult === '차감노쇼'
                    let color: string
                    if (isNoShow) {
                      color = 'bg-red-200/70 border-red-400 text-red-900'
                    } else if (s.schedule_type === '바챌') {
                      color = TYPE_COLORS['바챌']
                    } else if (s.schedule_type === 'PT' || s.schedule_type === 'PPT') {
                      if (ptParsed?.isGroupPurchase) color = PT_GROUP_PURCHASE_COLOR
                      else if (effectiveInOut === 'OUT') color = PT_OUT_COLOR
                      else if (isInForce) color = PT_WEEKEND_COLOR
                      else color = PT_IN_COLOR
                    } else {
                      color = TYPE_COLORS[s.schedule_type] ?? TYPE_COLORS.OT
                    }
                    const isSales = s.schedule_type === 'OT'
                      ? !!matched?.is_sales_target
                      : !!ptParsed?.isSalesTarget
                    const amount = s.schedule_type === 'OT'
                      ? (matched?.expected_amount ?? 0)
                      : (ptParsed?.expectedAmount ? Number(ptParsed.expectedAmount) : 0)
                    // OT 회원의 sales_status (진행중/거부자/등록완료 등) — 캘린더 블록에 라벨로 표시
                    const otSalesStatus = s.schedule_type === 'OT' ? (matched?.sales_status as SalesStatus | null | undefined) : null
                    // PT/PPT 회차 라벨: 시간순으로 자동 계산된 회차 번호 사용
                    // - 회차(N): 전체 기간 회원의 PT/PPT/바챌 스케줄을 시간순 정렬한 위치 (sessionPosById)
                    // - 총(M): 해당 월 pt_members의 total_sessions 우선, 0이면 note의 [N/M] fallback
                    let sessionLabel: string | null = null
                    if (s.schedule_type === 'PT' || s.schedule_type === 'PPT') {
                      const autoPos = sessionPosById.get(s.id)
                      const noteCurrent = Number(ptParsed?.current) || 0
                      const noteTotal = Number(ptParsed?.total) || 0
                      const month = s.scheduled_date.slice(0, 7)
                      const pm = s.member_name ? ptMemberByNameMonth.get(`${s.member_name}|${month}`) : null
                      const total = (pm && pm.total_sessions > 0) ? pm.total_sessions : (noteTotal > 0 ? noteTotal : 0)
                      const current = autoPos ?? (noteCurrent > 0 ? noteCurrent : 0)
                      if (current > 0 && total > 0) {
                        sessionLabel = `${total}회 중 ${current}회차`
                      } else if (current > 0) {
                        sessionLabel = `${current}회차`
                      }
                    }
                    const draggable = canDragSchedule(s)
                    const isDragging = draggingId === s.id

                    return (
                      <div
                        key={s.id}
                        data-schedule-id={s.id}
                        className={`absolute rounded border ${isMobile ? 'px-0.5 py-0' : 'px-1 py-0.5'} overflow-hidden group select-none ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isSales ? 'ring-2 ring-blue-400 ' : ''} ${isDragging ? 'shadow-2xl ring-2 ring-yellow-400 opacity-80' : ''} ${color}`}
                        style={{ top, height, zIndex: isDragging ? 30 : 5, touchAction: 'none', left: isDragging ? 0 : (layout.total > 1 ? `${colLeft}%` : (isMobile ? 0 : 2)), right: isDragging ? 0 : (layout.total > 1 ? `${100 - colLeft - colWidth}%` : (isMobile ? 0 : 2)), width: isDragging ? '100%' : undefined }}
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
                          lastClickedScheduleRef.current = s
                          openMemberDetail(s)
                        }}
                      >
                        {isMobile ? (
                          /* ── 모바일 컴팩트 블록 ── */
                          <p className="text-[8px] font-bold leading-tight truncate">
                            {s.schedule_type.toLowerCase()} {s.member_name || ''}
                          </p>
                        ) : (
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {isOtApproved(s) && <span className="text-gray-500">🔒 </span>}
                              {isSales && <span className="text-yellow-500">★ </span>}
                              {s.schedule_type === 'OT' && s.ot_session_id && inbodySessionIds.has(s.ot_session_id) && (
                                <span className="text-fuchsia-600" title="인바디 측정">● </span>
                              )}
                              {s.schedule_type}
                              {s.member_name ? ` ${s.member_name}` : ''}
                            </p>
                            {sessionLabel && (
                              <p className="text-[10px] font-semibold opacity-80 truncate">{sessionLabel}</p>
                            )}
                            {ptResult && (
                              <p className={`text-[10px] font-bold ${PT_RESULT_TEXT_COLORS[ptResult as PtClassResult] ?? 'text-gray-700'}`}>
                                [{ptResult}]
                              </p>
                            )}
                            {otSalesStatus && (
                              <p className={`text-[10px] font-bold ${OT_SALES_TEXT_COLORS[otSalesStatus] ?? 'text-gray-700'}`}>
                                [{OT_SALES_LABEL[otSalesStatus]}]
                              </p>
                            )}
                            <p className="text-[10px] opacity-70">
                              {s.start_time}
                              {s.schedule_type === 'OT' && s.ot_session_id && matched && (() => {
                                const os = matched.sessions?.find((o) => o.id === s.ot_session_id)
                                return os ? ` ${os.session_number}차` : ''
                              })()}
                              {` · ${s.duration}분`}
                              {amount ? ` · ${amount}만` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0">
                            <button
                              className="opacity-0 group-hover:opacity-100 group-active:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity text-green-600 hover:text-green-800 active:text-green-800 shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setCopiedSchedule(s) }}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 group-active:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity text-red-500 hover:text-red-700 active:text-red-700 shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        )}
                      </div>
                    )
                  })
                  })()}
                </div>
              )
            })}
          </div>
        </div>
        )}

        {loading && <p className="text-xs text-gray-400 text-center">로딩 중...</p>}

        {/* ── 통계표 (주간 = 일별 / 월간 = 합계만) ── */}
        {schedules.length > 0 && (() => {
          const formatMin = (min: number) => {
            if (min === 0) return '-'
            const h = Math.floor(min / 60)
            const m = min % 60
            return h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`
          }
          const meetingTypes = new Set(['간부회의', '팀회의', '전체회의', '간담회'])
          const isWeekStats = viewMode === 'week'

          // 통계 컬럼 계산: 주간이면 7일, 월간이면 1일~말일 전체
          const statsDays: Date[] = isWeekStats ? days : (() => {
            const base = new Date(stableNow.getTime())
            base.setDate(1)
            base.setMonth(base.getMonth() + monthOffset)
            const year = base.getFullYear()
            const month = base.getMonth()
            const lastDay = new Date(year, month + 1, 0).getDate()
            return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1))
          })()

          // 통계 키별 카운트 (노쇼/차감노쇼는 별도)
          type DayStat = {
            ptInReg: number; ptInRegNoshow: number  // PT IN (정상, 평일, 비-공동구매)
            ptGP: number; ptGPNoshow: number        // PT 공동구매 (항상 IN)
            ptWH: number; ptWHNoshow: number        // PT 주말/공휴일 (강제 IN)
            ptOut: number; ptOutNoshow: number      // PT OUT
            pptIn: number; pptInNoshow: number      // PPT IN (주말/공휴일 포함)
            pptOut: number; pptOutNoshow: number    // PPT OUT
            baChal: number; baChalNoshow: number    // 바챌 (고정급여, IN/OUT 없음)
            ot: number                              // OT 세션 수
            inbody: number                          // OT 중 인바디 측정 건수
            meetingMin: number                      // 회의 시간(분)
            otherMin: Record<string, number>
          }
          const emptyStat = (): DayStat => ({
            ptInReg: 0, ptInRegNoshow: 0, ptGP: 0, ptGPNoshow: 0, ptWH: 0, ptWHNoshow: 0,
            ptOut: 0, ptOutNoshow: 0, pptIn: 0, pptInNoshow: 0, pptOut: 0, pptOutNoshow: 0,
            baChal: 0, baChalNoshow: 0, ot: 0, inbody: 0, meetingMin: 0, otherMin: {},
          })
          const dayStats = new Map<string, DayStat>()
          for (const d of statsDays) {
            dayStats.set(format(d, 'yyyy-MM-dd'), emptyStat())
          }
          const total: DayStat = emptyStat()

          const accumulate = (st: DayStat, s: typeof schedules[number]) => {
            if (s.schedule_type === '바챌') {
              const parsed = parsePtNote(s.note)
              const isNoshow = parsed.classResult === '노쇼' || parsed.classResult === '차감노쇼'
              st.baChal++; if (isNoshow) st.baChalNoshow++
            } else if (s.schedule_type === 'PT' || s.schedule_type === 'PPT') {
              const parsed = parsePtNote(s.note)
              const isNoshow = parsed.classResult === '노쇼' || parsed.classResult === '차감노쇼'
              const sDate = new Date(s.scheduled_date + 'T00:00:00')
              const isWH = isWeekendOrHoliday(sDate)
              // IN/OUT은 캘린더 색상과 동일하게 현재 근무시간 기준으로 라이브 계산
              // (저장 당시 근무시간이 비어있던 과거 스케줄도 즉시 반영)
              const liveInOut: 'IN' | 'OUT' = parsed.isGroupPurchase
                ? 'IN'
                : getAutoInOut(s.scheduled_date, s.start_time)
              if (s.schedule_type === 'PPT') {
                if (liveInOut === 'OUT' && !isWH) {
                  st.pptOut++; if (isNoshow) st.pptOutNoshow++
                } else {
                  st.pptIn++; if (isNoshow) st.pptInNoshow++
                }
              } else { // PT
                if (parsed.isGroupPurchase) {
                  st.ptGP++; if (isNoshow) st.ptGPNoshow++
                } else if (isWH) {
                  st.ptWH++; if (isNoshow) st.ptWHNoshow++
                } else if (liveInOut === 'OUT') {
                  st.ptOut++; if (isNoshow) st.ptOutNoshow++
                } else {
                  st.ptInReg++; if (isNoshow) st.ptInRegNoshow++
                }
              }
            } else if (s.schedule_type === 'OT') {
              st.ot++
              if (s.ot_session_id && inbodySessionIds.has(s.ot_session_id)) st.inbody++
            } else if (meetingTypes.has(s.schedule_type)) {
              st.meetingMin += s.duration
            } else {
              st.otherMin[s.schedule_type] = (st.otherMin[s.schedule_type] ?? 0) + s.duration
            }
          }

          for (const s of schedules) {
            const st = dayStats.get(s.scheduled_date)
            if (st) accumulate(st, s)
            accumulate(total, s)
          }

          // 기타 타입 목록
          const allOtherTypes = Object.keys(total.otherMin)

          // 셀 렌더링 — isTotal=true면 sticky-right로 고정
          const cell = (val: number | string, isTotal = false) => {
            const empty = val === 0 || val === '-'
            const stickyCls = isTotal ? 'sticky right-0 z-[1] bg-gray-50 shadow-[-4px_0_6px_-3px_rgba(0,0,0,0.06)]' : ''
            return (
              <td className={`text-center py-2.5 px-1 text-xs border-r border-gray-100 last:border-r-0 ${isTotal ? 'font-black' : 'font-semibold'} ${stickyCls} ${empty ? 'text-gray-300' : isTotal ? 'text-gray-900' : 'text-gray-700'}`}>
                {empty ? '-' : val}
              </td>
            )
          }
          const classCell = (count: number, noshow: number, isTotal = false) => {
            const effective = count - noshow
            const empty = effective === 0 && noshow === 0
            const stickyCls = isTotal ? 'sticky right-0 z-[1] bg-gray-50 shadow-[-4px_0_6px_-3px_rgba(0,0,0,0.06)]' : ''
            return (
              <td className={`text-center py-2.5 px-1 text-xs border-r border-gray-100 last:border-r-0 ${isTotal ? 'font-black' : 'font-semibold'} ${stickyCls}`}>
                {empty ? <span className="text-gray-300">-</span> : (
                  <>
                    <span className={isTotal ? 'text-gray-900' : 'text-gray-700'}>{effective}</span>
                    {noshow > 0 && <span className="text-red-500 font-bold ml-0.5">({noshow})</span>}
                  </>
                )}
              </td>
            )
          }

          // 일별/주별 누적 합 (노쇼 제외)
          const stTotal = (st: DayStat) => (
            (st.ptInReg - st.ptInRegNoshow) + (st.ptGP - st.ptGPNoshow) + (st.ptWH - st.ptWHNoshow) + (st.ptOut - st.ptOutNoshow)
            + (st.pptIn - st.pptInNoshow) + (st.pptOut - st.pptOutNoshow)
            + (st.baChal - st.baChalNoshow) + st.ot
          )
          const stNoshow = (st: DayStat) => (
            st.ptInRegNoshow + st.ptGPNoshow + st.ptWHNoshow + st.ptOutNoshow
            + st.pptInNoshow + st.pptOutNoshow + st.baChalNoshow
          )
          const grandTotalClass = stTotal(total)
          const grandTotalNoshow = stNoshow(total)

          // 행 렌더링 헬퍼: 모든 일자 컬럼 + 합계
          const classRow = (
            label: React.ReactNode, dotColor: string, textColor: string,
            getCount: (st: DayStat) => number, getNoshow: (st: DayStat) => number,
          ) => (
            <tr className={`border-b border-gray-100 transition-colors`}>
              <td className="py-2.5 px-2 sm:px-3 sticky left-0 bg-white z-[1]">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${textColor}`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />{label}
                </span>
              </td>
              {statsDays.map((d, i) => {
                const st = dayStats.get(format(d, 'yyyy-MM-dd'))!
                return <React.Fragment key={i}>{classCell(getCount(st), getNoshow(st))}</React.Fragment>
              })}
              {classCell(getCount(total), getNoshow(total), true)}
            </tr>
          )
          const numRow = (
            label: React.ReactNode, dotColor: string, textColor: string,
            getVal: (st: DayStat) => number,
          ) => (
            <tr className={`border-b border-gray-100 transition-colors`}>
              <td className="py-2.5 px-2 sm:px-3 sticky left-0 bg-white z-[1]">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${textColor}`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />{label}
                </span>
              </td>
              {statsDays.map((d, i) => {
                const st = dayStats.get(format(d, 'yyyy-MM-dd'))!
                return <React.Fragment key={i}>{cell(getVal(st))}</React.Fragment>
              })}
              {cell(getVal(total), true)}
            </tr>
          )
          const minRow = (
            label: React.ReactNode, dotColor: string, textColor: string,
            getMin: (st: DayStat) => number,
          ) => (
            <tr className={`border-b border-gray-100 transition-colors`}>
              <td className="py-2.5 px-2 sm:px-3 sticky left-0 bg-white z-[1]">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${textColor}`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />{label}
                </span>
              </td>
              {statsDays.map((d, i) => {
                const st = dayStats.get(format(d, 'yyyy-MM-dd'))!
                return <React.Fragment key={i}>{cell(formatMin(getMin(st)))}</React.Fragment>
              })}
              {cell(formatMin(getMin(total)), true)}
            </tr>
          )

          return (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm -mx-4 sm:mx-0">
              {/* 타이틀 */}
              <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-bold text-white">{isWeekStats ? '일별 통계' : '월간 통계'}</p>
                <p className="text-xs text-gray-400">총 수업 <span className="text-yellow-400 font-black text-sm">{grandTotalClass}</span>건{grandTotalNoshow > 0 && <span className="text-red-400 ml-1">({grandTotalNoshow} 노쇼)</span>}</p>
              </div>
              <div ref={statsScrollRef} className="overflow-x-auto">
                <table className="w-full min-w-[360px] border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-2.5 px-2 sm:px-3 text-left text-[11px] font-bold text-gray-500 w-[72px] min-w-[72px] sm:w-[110px] sm:min-w-[110px] sticky left-0 bg-gray-50 z-[2]" />
                      {statsDays.map((d, i) => {
                        const dow = d.getDay()
                        const isWe = dow === 0 || dow === 6
                        const isHol = !!KOREAN_HOLIDAYS[format(d, 'yyyy-MM-dd')]
                        return (
                          <th key={i} className={`py-2.5 px-0.5 sm:px-1 text-center text-[11px] font-bold border-r border-gray-100 last:border-r-0 min-w-[28px] sm:min-w-[36px] ${isWe || isHol ? 'text-red-400' : 'text-gray-500'}`}>
                            <span className="block">{DAY_LABELS[dow]}</span>
                            <span className="block text-sm">{d.getDate()}{isWeekStats ? '일' : ''}</span>
                          </th>
                        )
                      })}
                      <th className="py-2.5 px-1 sm:px-2 text-center text-[11px] font-bold text-gray-900 bg-gray-100 min-w-[44px] sm:min-w-[60px] sticky right-0 z-[2]">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 수업 합계 */}
                    <tr className="border-b-2 border-gray-200 bg-yellow-50/60">
                      <td className="py-2.5 px-2 sm:px-3 text-[11px] font-black text-gray-900 sticky left-0 bg-yellow-50/60 z-[1] whitespace-nowrap">수업 합계</td>
                      {statsDays.map((d, i) => {
                        const st = dayStats.get(format(d, 'yyyy-MM-dd'))!
                        const v = stTotal(st)
                        const ns = stNoshow(st)
                        return <React.Fragment key={i}>{classCell(v + ns, ns)}</React.Fragment>
                      })}
                      <td className="text-center py-2.5 px-1 font-black text-sm bg-yellow-100 sticky right-0 z-[1]">
                        <span className="text-gray-900">{grandTotalClass}</span>
                        {grandTotalNoshow > 0 && <span className="text-red-500 text-[10px] ml-0.5">({grandTotalNoshow})</span>}
                      </td>
                    </tr>
                    {/* PT IN (정상 평일) */}
                    {classRow('PT IN', 'bg-blue-400', 'text-blue-700', (st) => st.ptInReg, (st) => st.ptInRegNoshow)}
                    {/* PT 공동구매 */}
                    {classRow('PT 공동구매', 'bg-blue-700', 'text-blue-900', (st) => st.ptGP, (st) => st.ptGPNoshow)}
                    {/* PT 주말/공휴일 */}
                    {classRow('PT 주말/공휴일', 'bg-rose-400', 'text-rose-700', (st) => st.ptWH, (st) => st.ptWHNoshow)}
                    {/* PT OUT */}
                    {classRow('PT OUT', 'bg-orange-400', 'text-orange-600', (st) => st.ptOut, (st) => st.ptOutNoshow)}
                    {/* PPT — 데이터 있을 때만 */}
                    {(total.pptIn + total.pptOut) > 0 && (<>
                      {classRow('PPT IN', 'bg-purple-400', 'text-purple-700', (st) => st.pptIn, (st) => st.pptInNoshow)}
                      {classRow('PPT OUT', 'bg-orange-400', 'text-orange-600', (st) => st.pptOut, (st) => st.pptOutNoshow)}
                    </>)}
                    {/* 바챌 */}
                    {classRow('바챌', 'bg-yellow-400', 'text-yellow-700', (st) => st.baChal, (st) => st.baChalNoshow)}
                    {/* OT */}
                    {numRow('OT', 'bg-emerald-400', 'text-emerald-700', (st) => st.ot)}
                    {/* 인바디 */}
                    {numRow(<span className="flex items-center gap-1">인바디 <span className="text-fuchsia-500">●</span></span>, 'bg-fuchsia-400', 'text-fuchsia-700', (st) => st.inbody)}
                    {/* 회의 */}
                    {total.meetingMin > 0 && minRow('회의', 'bg-yellow-500', 'text-yellow-700', (st) => st.meetingMin)}
                    {/* 기타 타입들 */}
                    {allOtherTypes.sort().map((t) => minRow(t, 'bg-gray-400', 'text-gray-600', (st) => st.otherMin[t] ?? 0))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </div>

      {/* 스케줄 생성 다이얼로그 */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">스케줄 추가</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{createDate} {createTime}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            {/* 타입 선택 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
              {SCHEDULE_TYPES.map((t) => {
                const c = TYPE_COLORS[t] ?? TYPE_COLORS.기타
                return (
                  <button
                    key={t}
                    className={`rounded-md border-2 py-1.5 text-xs font-bold transition-colors ${createType === t ? `${c} border-current` : 'bg-white border-gray-200 text-gray-400'}`}
                    onClick={() => { setCreateType(t as typeof createType); setCreateName(''); setCreateOtSessionId('') }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {/* 공동구매 체크박스 (PT/PPT, 타입 선택 바로 아래) */}
            {(createType === 'PT' || createType === 'PPT') && (
              <label
                className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 cursor-pointer transition-colors ${
                  createIsGroupPurchase
                    ? 'bg-sky-50 border-sky-500'
                    : 'bg-white border-gray-200 hover:border-sky-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={createIsGroupPurchase}
                  onChange={(e) => setCreateIsGroupPurchase(e.target.checked)}
                  className="h-4 w-4 accent-sky-600 cursor-pointer"
                />
                <span className={`text-sm font-bold ${createIsGroupPurchase ? 'text-sky-700' : 'text-gray-600'}`}>
                  공동구매
                </span>
                {createIsGroupPurchase && (
                  <span className="ml-auto text-[10px] font-bold text-sky-600">항상 IN</span>
                )}
              </label>
            )}

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

            {/* PT/PPT/바챌: PT 회원 선택 또는 직접 입력 */}
            {isPtLikeType(createType) && (<>
              <div className="space-y-3">
                {/* PT 회원 검색 + 선택 */}
                {ptMembersDedup.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Search className="h-3 w-3" /> PT 회원 검색
                    </Label>
                    <Input
                      value={createPtFilter}
                      onChange={(e) => setCreatePtFilter(e.target.value)}
                      placeholder="이름 또는 전화번호 일부 입력"
                      className="bg-white"
                    />
                    {/* 검색 결과 — 입력값이 있을 때만 노출 */}
                    {createPtFilter.trim() && (
                      <div className="rounded-md border border-gray-200 max-h-[180px] overflow-y-auto">
                        {(() => {
                          const q = createPtFilter.trim().toLowerCase()
                          const filtered = ptMembersDedup.filter((pm) =>
                            pm.name.toLowerCase().includes(q) ||
                            (pm.phone ?? '').includes(q),
                          )
                          if (filtered.length === 0) {
                            return <p className="text-xs text-gray-400 text-center py-2">결과 없음</p>
                          }
                          return filtered.map((pm) => {
                            const isSelected = createName === pm.name && createMemberPhone === (pm.phone ?? '')
                            return (
                              <button
                                key={pm.id}
                                type="button"
                                onClick={() => {
                                  setCreateName(pm.name)
                                  setCreateMemberPhone(pm.phone ?? '')
                                  setCreatePtTotalSession(String(pm.total_sessions))
                                  setCreatePtCurrentSession(String(pm.completed_sessions + 1))
                                  setCreatePtFilter('')
                                }}
                                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 hover:bg-yellow-50 ${isSelected ? 'bg-yellow-100' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-900">{pm.name}</span>
                                  <span className="text-[10px] text-gray-500">{pm.completed_sessions}/{pm.total_sessions}회</span>
                                </div>
                                <p className="text-[10px] text-gray-400">{pm.phone ? pm.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '전화번호 없음'}</p>
                              </button>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )}
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
              {/* IN/OUT은 근무시간 기준 자동 판별 — 토글 제거됨 */}
            </>)}

            {/* 기타 타입: 내용 선택사항 (제목 없이도 저장 가능) */}
            {createType !== 'OT' && !isPtLikeType(createType) && (
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
                  <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} step="300" />
                </div>
                <div className="space-y-2">
                  <Label>종료 시간</Label>
                  <Input type="time" value={createEndTime} onChange={(e) => setCreateEndTime(e.target.value)} step="300" />
                </div>
              </div>
            ) : (
              // OT/PT/PPT — 시작 시간만, duration은 별도 버튼
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} step="300" />
              </div>
            )}

            {/* 다중 요일 반복 (OT 제외) */}
            {createType !== 'OT' && (
              <div className="space-y-2">
                <Label className="text-xs">반복 요일 (선택) — 같은 주의 다른 요일에도 같은 시간으로 함께 생성</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
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

            {/* 매출 정보 (OT/PT/PPT/바챌) */}
            {(createType === 'OT' || isPtLikeType(createType)) && (
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>예상 회수</Label>
                        <div className="flex items-center gap-1">
                          <Input type="number" value={createExpectedSessions || ''} onChange={(e) => setCreateExpectedSessions(Number(e.target.value))} placeholder="0" />
                          <span className="text-sm text-gray-500 shrink-0">회</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>예상 금액</Label>
                        <div className="flex items-center gap-1">
                          <Input type="number" value={createExpectedAmount || ''} onChange={(e) => setCreateExpectedAmount(Number(e.target.value))} placeholder="0" />
                          <span className="text-sm text-gray-500 shrink-0">만원</span>
                        </div>
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
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {detailAssignment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{detailAssignment.member.name}</DialogTitle>
                <DialogDescription>회원 정보 · 상태 변경</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                {/* 프로그램 & 세일즈 관리 */}
                <button
                  type="button"
                  onClick={() => openProgramDialog(detailAssignment)}
                  disabled={programLoading}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-sm flex items-center justify-center gap-2 shadow disabled:opacity-50"
                >
                  <ClipboardList className="h-4 w-4" />
                  {programLoading ? '불러오는 중...' : '프로그램 & 세일즈 관리 (차수별 기록)'}
                </button>
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
                          <p className={`text-xs mt-0.5 ${isDone ? 'text-green-600' : isScheduled ? 'text-blue-600' : 'text-gray-400'}`}>
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
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
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
                {editSchedule && (() => {
                  const bookedSlots = new Map<string, string>()
                  for (const sc of schedules) {
                    if (sc.scheduled_date !== editSchedule.scheduled_date) continue
                    if (sc.id === editSchedule.id) continue
                    bookedSlots.set(sc.start_time.slice(0, 5), `${sc.schedule_type} ${sc.member_name}`)
                  }
                  return (
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-bold text-gray-900">스케줄 수정</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">시간</p>
                      <div className="grid grid-cols-4 gap-1">
                        {Array.from({ length: 33 }, (_, i) => {
                          const h = 6 + Math.floor(i / 2)
                          const m = (i % 2) * 30
                          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                        }).map((slot) => {
                          const booked = bookedSlots.get(slot)
                          return (
                          <button
                            key={slot}
                            type="button"
                            disabled={!!booked}
                            title={booked ?? ''}
                            className={`rounded border px-1 py-1 text-xs font-medium transition-colors ${
                              editTime === slot
                                ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
                                : booked
                                  ? 'bg-red-50 text-red-300 border-red-200 cursor-not-allowed'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                            }`}
                            onClick={() => !booked && setEditTime(slot)}
                          >
                            {slot}
                          </button>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500 shrink-0">직접 입력</span>
                        <Input type="time" step={600} value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-8 text-xs bg-white border-gray-300 w-32" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600">수업시간</p>
                      <div className="flex gap-2">
                        {[30, 50].map((d) => (
                          <button key={d} type="button"
                            className={`flex-1 rounded-md border px-3 py-2 text-sm font-bold transition-colors ${editDuration === d ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                            onClick={() => setEditDuration(d)}
                          >{d}분</button>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold" onClick={handleEditScheduleSave} disabled={editSaving}>
                      {editSaving ? '저장 중...' : '스케줄 수정 저장'}
                    </Button>
                  </div>
                  )
                })()}

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
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {editSchedule && (
            <>
              <DialogHeader>
                <DialogTitle>스케줄 수정</DialogTitle>
                <DialogDescription>{editSchedule.member_name} · {editSchedule.schedule_type}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">날짜</p>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-9 text-sm bg-white text-gray-900 border-gray-300"
                  />
                </div>
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
                    <span className="text-xs text-gray-500 shrink-0">직접 입력</span>
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
                {/* 인바디 측정 (OT 한정) — OT 진행 중 인바디 측정 여부 체크 */}
                {editSchedule.schedule_type === 'OT' && editSchedule.ot_session_id && (
                  <label
                    className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 cursor-pointer transition-colors ${
                      editInbody
                        ? 'bg-fuchsia-50 border-fuchsia-500'
                        : 'bg-white border-gray-200 hover:border-fuchsia-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editInbody}
                      onChange={(e) => setEditInbody(e.target.checked)}
                      className="h-4 w-4 accent-fuchsia-600 cursor-pointer"
                    />
                    <span className={`text-sm font-bold ${editInbody ? 'text-fuchsia-700' : 'text-gray-600'}`}>
                      인바디 측정
                    </span>
                    {editInbody && <span className="ml-auto text-fuchsia-600">●</span>}
                  </label>
                )}
                <div className="flex gap-2">
                  {editSchedule.schedule_type === 'OT' && (() => {
                    const matched = assignments.find((a) => a.member.name === editSchedule.member_name)
                    if (!matched) return null
                    // 스케줄의 ot_session_id로 해당 차수의 session_number 찾기 → 그 차수 카드의 저장/완료 버튼 노출
                    const matchedSession = matched.sessions?.find((s) => s.id === editSchedule.ot_session_id)
                    const sessionIdx = matchedSession ? matchedSession.session_number - 1 : null
                    return (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={() => {
                          setOtClassSchedule(editSchedule)
                          openProgramDialog(matched, sessionIdx)
                          setEditSchedule(null)
                        }}
                      >
                        프로그램
                      </Button>
                    )
                  })()}
                  <Button
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold"
                    onClick={handleEditScheduleSave}
                    disabled={editSaving}
                  >
                    {editSaving ? '저장 중...' : '수정 저장'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PT 수업 진행 다이얼로그 (PT/PPT 스케줄 클릭 시) */}
      <Dialog open={!!editPtSchedule} onOpenChange={() => setEditPtSchedule(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          {editPtSchedule && (
            <>
              <DialogHeader>
                <DialogTitle>PT 수업 진행</DialogTitle>
                <DialogDescription>{editPtSchedule.scheduled_date} · {editPtScheduleType}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* 유형 변경 (PT/PPT/바챌) */}
                <div className="space-y-1.5">
                  <Label>유형</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['PT', 'PPT', '바챌'] as const).map((t) => {
                      const c = TYPE_COLORS[t]
                      const selected = editPtScheduleType === t
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`rounded-md border-2 py-2 text-sm font-bold transition-colors ${
                            selected ? `${c} border-current` : 'bg-white border-gray-200 text-gray-400'
                          }`}
                          onClick={() => {
                            setEditPtScheduleType(t)
                            // 바챌은 공동구매 사용 안함
                            if (t === '바챌') setEditPtIsGroupPurchase(false)
                          }}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 공동구매 토글 (PT/PPT, 유형 바로 아래) */}
                {(editPtScheduleType === 'PT' || editPtScheduleType === 'PPT') && (
                  <button
                    type="button"
                    className={`w-full rounded-md border-2 py-2 text-sm font-bold transition-colors ${
                      editPtIsGroupPurchase
                        ? 'bg-yellow-200/80 border-yellow-400 text-yellow-900'
                        : 'bg-white border-gray-200 text-gray-500'
                    }`}
                    onClick={() => setEditPtIsGroupPurchase(!editPtIsGroupPurchase)}
                  >
                    {editPtIsGroupPurchase ? '✓ 공동구매 (항상 IN)' : '공동구매로 지정'}
                  </button>
                )}

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
                    <span className="text-xs text-gray-500 shrink-0">직접 입력</span>
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

                {/* IN/OUT은 근무시간 기준 자동 판별 — 토글 제거됨. 공동구매는 유형 아래로 이동 */}

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

      {/* 프로그램 & 세일즈 다이얼로그 (스케줄에서 열기) */}
      <Dialog open={!!programTarget} onOpenChange={() => setProgramTarget(null)}>
        <DialogContent className="w-[calc(100%-0.5rem)] sm:w-[95vw] max-w-[95vw] sm:max-w-5xl max-h-[85vh] sm:max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {programTarget?.assignment.member.name} · 프로그램 & 세일즈
            </DialogTitle>
            <DialogDescription>각 차수 카드에서 운동·계획서·세일즈·결과까지 한 번에 기록하세요</DialogDescription>
          </DialogHeader>
          {programTarget && profile && (
            <OtProgramForm
              assignment={programTarget.assignment}
              program={programTarget.program}
              profile={profile}
              completingSessionIdx={programTarget.sessionIdx ?? null}
              completeLoading={programCompleteLoading}
              onCompleteSession={programTarget.sessionIdx == null ? undefined : async (idx) => {
                setProgramCompleteLoading(true)
                try {
                  const sessionNumber = idx + 1
                  const existing = programTarget.assignment.sessions?.find((s) => s.session_number === sessionNumber)
                  await upsertOtSession({
                    ot_assignment_id: programTarget.assignment.id,
                    session_number: sessionNumber,
                    scheduled_at: existing?.scheduled_at ?? new Date().toISOString(),
                    completed_at: new Date().toISOString(),
                  })
                  setProgramTarget(null)
                  fetchSchedules()
                  startTransition(() => router.refresh())
                } catch (err) {
                  alert('완료 처리 실패: ' + (err instanceof Error ? err.message : String(err)))
                } finally {
                  setProgramCompleteLoading(false)
                }
              }}
              onSaved={async () => {
                const fresh = await getOtProgram(programTarget.assignment.id)
                setProgramTarget({ ...programTarget, program: fresh })
              }}
            />
          )}
          {programTarget && !profile && (
            <p className="text-sm text-red-600">프로필 정보가 없어 프로그램을 열 수 없습니다. 관리자에게 문의하세요.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* 스케줄 충돌 확인 다이얼로그 */}
      <Dialog open={!!conflictConfirm} onOpenChange={() => { setConflictConfirm(null); stopCreateSaving() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ 시간 중복 확인</DialogTitle>
            <DialogDescription>동시간대에 이미 일정이 있습니다. 중복으로 진행하시겠습니까?</DialogDescription>
          </DialogHeader>
          {conflictConfirm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {conflictConfirm.conflicts.map((c, i) => (
                  <div key={i} className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-center">
                    <p className="text-sm font-bold text-red-800">{c.name}</p>
                    <p className="text-xs text-red-600 mt-1">{c.type} · {c.time}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{c.date}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-center text-gray-700 font-medium">
                {conflictConfirm.conflicts.map((c) => c.name).join(', ')} 회원의 수업시간입니다.<br />
                중복으로 동시간대에 진행하시겠습니까?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="font-bold"
                  onClick={() => { setConflictConfirm(null); stopCreateSaving() }}
                >
                  취소
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={async () => {
                    const fn = conflictConfirm.onConfirm
                    setConflictConfirm(null)
                    await fn()
                  }}
                >
                  중복 진행
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 라포 가져오기 */}
      <RapoImportDialog
        open={showRapoImport}
        onClose={() => setShowRapoImport(false)}
        trainerId={trainerId}
        year={weekStart.getFullYear()}
        month={weekStart.getMonth() + 1}
        onImported={() => { fetchSchedules(); router.refresh() }}
      />
    </>
  )
}
