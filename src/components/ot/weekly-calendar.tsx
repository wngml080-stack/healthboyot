'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { ChevronLeft, ChevronRight, X, Search, UserPlus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateOtAssignment, upsertOtSession } from '@/actions/ot'
import { searchMembers, quickRegisterMember } from '@/actions/members'
// import { OtStatusBadge } from './ot-status-badge'
import type { OtAssignmentWithDetails, OtStatus, Member } from '@/types'

interface ScheduleItem {
  id: string
  trainer_id: string
  schedule_type: string
  member_name: string
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

const TYPE_COLORS: Record<string, string> = {
  OT: 'bg-emerald-200 border-emerald-400 text-emerald-900',
  PT: 'bg-blue-200 border-blue-400 text-blue-900',
  PPT: 'bg-purple-200 border-purple-400 text-purple-900',
  식사: 'bg-orange-200 border-orange-400 text-orange-900',
  홍보: 'bg-pink-200 border-pink-400 text-pink-900',
  회의: 'bg-yellow-200 border-yellow-400 text-yellow-900',
  간담회: 'bg-indigo-200 border-indigo-400 text-indigo-900',
  기타: 'bg-gray-200 border-gray-400 text-gray-900',
}

const SCHEDULE_TYPES = ['OT', 'PT', 'PPT', '식사', '홍보', '회의', '간담회', '기타'] as const

const STATUS_OPTIONS: OtStatus[] = ['신청대기', '배정완료', '진행중', '완료', '거부', '추후결정']

export function WeeklyCalendar({ assignments, trainerId }: Props) {
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
  const [createNote, setCreateNote] = useState('')
  const [createIsSalesTarget, setCreateIsSalesTarget] = useState(false)
  const [createExpectedAmount, setCreateExpectedAmount] = useState(0)
  const [createClosingProb, setCreateClosingProb] = useState(0)
  const [createSaving, setCreateSaving] = useState(false)

  // 회원 검색/간편등록
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Member[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showQuickRegister, setShowQuickRegister] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickIsExisting, setQuickIsExisting] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // 회원 상세 다이얼로그
  const [detailAssignment, setDetailAssignment] = useState<OtAssignmentWithDetails | null>(null)
  const [detailStatus, setDetailStatus] = useState<OtStatus>('신청대기')
  const [detailSalesNote, setDetailSalesNote] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)

  // 스케줄 편집 다이얼로그
  const [editSchedule, setEditSchedule] = useState<ScheduleItem | null>(null)
  const [editTime, setEditTime] = useState('')
  const [editDuration, setEditDuration] = useState(50)
  const [editSaving, setEditSaving] = useState(false)

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
        setSchedules((data ?? []) as ScheduleItem[])
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
    setCreateTime(`${String(hour).padStart(2, '0')}:${half === 0 ? '00' : '30'}`)
    setCreateType('OT')
    setCreateName('')
    setCreateOtSessionId('')
    setCreateDuration(50)
    setCreateNote('')
    setCreateIsSalesTarget(false)
    setCreateExpectedAmount(0)
    setCreateClosingProb(0)
    setSearchQuery('')
    setSearchResults([])
    setSelectedMember(null)
    setShowQuickRegister(false)
    setQuickName('')
    setQuickPhone('')
    setShowCreate(true)
  }

  // 회원 검색 (디바운스)
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setSelectedMember(null)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchMembers(query)
      setSearchResults(results)
      setSearching(false)
    }, 300)
  }

  const handleSelectSearchResult = (member: Member) => {
    setSelectedMember(member)
    setCreateName(member.name)
    setSearchQuery(member.name)
    setSearchResults([])
  }

  const handleQuickRegister = async () => {
    if (!quickName || !quickPhone) return
    const phone = quickPhone.replace(/[^0-9]/g, '')
    if (phone.length < 10 || phone.length > 11) {
      alert('올바른 전화번호를 입력해주세요 (10~11자리)')
      return
    }
    setCreateSaving(true)
    const result = await quickRegisterMember({ name: quickName, phone, trainerId, isExistingMember: quickIsExisting })
    if (result.error) {
      alert('등록 실패: ' + result.error)
      setCreateSaving(false)
      return
    }
    if (result.existingMember) {
      alert(`${result.existingMember.name}님은 이미 등록된 회원입니다. 기존 회원으로 연결했습니다.`)
    }
    setCreateName(quickName)
    setSelectedMember(null)
    setShowQuickRegister(false)
    setCreateSaving(false)
  }

  const handleCreate = async () => {
    if (createType === 'OT' && !createOtSessionId) return
    if ((createType === 'PT' || createType === 'PPT') && !createName && !selectedMember) return
    if (createType !== 'OT' && createType !== 'PT' && createType !== 'PPT' && !createName) return

    setCreateSaving(true)

    let name = createName
    if (createType === 'OT') {
      const match = otMembers.find((a) =>
        createOtSessionId.startsWith('new-')
          ? createOtSessionId.includes(a.id)
          : a.sessions?.some((s) => s.id === createOtSessionId)
      )
      name = match?.member.name ?? 'OT'
    }

    const { error } = await supabaseRef.current
      .from('trainer_schedules')
      .insert({
        trainer_id: trainerId,
        schedule_type: createType,
        member_name: name,
        scheduled_date: createDate,
        start_time: createTime,
        duration: createDuration,
        note: createNote || null,
      })

    if (error) {
      alert('저장 실패: ' + error.message)
      setCreateSaving(false)
      return
    }

    // OT 스케줄 생성 시 ot_sessions의 scheduled_at도 동기화
    if (createType === 'OT') {
      const assignment = otMembers.find((a) =>
        createOtSessionId.startsWith('new-')
          ? createOtSessionId.includes(a.id)
          : a.sessions?.some((s) => s.id === createOtSessionId)
      )
      if (assignment) {
        const done = assignment.sessions?.filter((s) => s.completed_at).length ?? 0
        const nextN = done + 1
        await upsertOtSession({
          ot_assignment_id: assignment.id,
          session_number: nextN,
          scheduled_at: `${createDate}T${createTime}:00`,
        })

        if (createIsSalesTarget || createExpectedAmount > 0) {
          await updateOtAssignment(assignment.id, {
            is_sales_target: createIsSalesTarget,
            expected_amount: createExpectedAmount,
            closing_probability: createClosingProb,
          })
        }
      }
    } else if ((createType === 'PT' || createType === 'PPT') && (createIsSalesTarget || createExpectedAmount > 0)) {
      const assignment = otMembers.find((a) => a.member.name === createName)
      if (assignment) {
        await updateOtAssignment(assignment.id, {
          is_sales_target: createIsSalesTarget,
          expected_amount: createExpectedAmount,
          closing_probability: createClosingProb,
        })
      }
    }

    setShowCreate(false)
    setCreateSaving(false)
    await fetchSchedules()
  }

  const handleDelete = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabaseRef.current.from('trainer_schedules').delete().eq('id', id)
    if (error) {
      console.error('삭제 실패:', error.message)
      fetchSchedules() // 삭제 실패 시 목록 다시 불러오기
    }
  }

  // 스케줄 블록 클릭 → 회원 상세 또는 스케줄 편집
  const openMemberDetail = (schedule: ScheduleItem) => {
    const matched = assignments.find((a) => a.member.name === schedule.member_name)
    if (matched) {
      setDetailAssignment(matched)
      setDetailStatus(matched.status)
      setDetailSalesNote(matched.sales_note ?? '')
    }
    // 모든 스케줄은 시간/수업시간 편집 가능
    setEditSchedule(schedule)
    setEditTime(schedule.start_time)
    setEditDuration(schedule.duration)
  }

  const handleEditScheduleSave = async () => {
    if (!editSchedule) return
    setEditSaving(true)
    const { error } = await supabaseRef.current
      .from('trainer_schedules')
      .update({ start_time: editTime, duration: editDuration })
      .eq('id', editSchedule.id)
    if (error) alert('수정 실패: ' + error.message)
    setEditSchedule(null)
    setEditSaving(false)
    fetchSchedules()
  }

  const handleDetailSave = async () => {
    if (!detailAssignment) return
    setDetailSaving(true)
    await updateOtAssignment(detailAssignment.id, {
      status: detailStatus,
      sales_note: detailSalesNote || null,
    })
    setDetailSaving(false)
    setDetailAssignment(null)
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

  const totalSlots = HOURS.length * SLOTS_PER_HOUR

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
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-300" /> 간담회</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300" /> 기타</span>
          <span className="flex items-center gap-1"><span className="text-yellow-500">★</span> 매출대상</span>
        </div>

        {/* 캘린더 */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
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
                <div key={dayIdx} className={`flex-1 border-l border-gray-300 relative min-w-[90px] ${isToday ? 'bg-yellow-50/50' : ''}`}>
                  {/* 30분 단위 그리드 */}
                  {Array.from({ length: totalSlots }).map((_, slotIdx) => {
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
                    const heightSlots = s.duration >= 50 ? 2 : 1
                    const top = slot * SLOT_HEIGHT
                    const height = heightSlots * SLOT_HEIGHT - 2
                    const color = TYPE_COLORS[s.schedule_type] ?? TYPE_COLORS.OT
                    const matched = (s.schedule_type === 'OT' || s.schedule_type === 'PT' || s.schedule_type === 'PPT')
                      ? assignments.find((a) => a.member.name === s.member_name)
                      : null
                    const isSales = matched?.is_sales_target
                    const amount = matched?.expected_amount
                    const hasDetail = !!matched

                    return (
                      <div
                        key={s.id}
                        className={`absolute left-0.5 right-0.5 rounded border px-1 py-0.5 overflow-hidden group ${hasDetail ? 'cursor-pointer' : ''} ${isSales ? 'ring-2 ring-blue-400 ' : ''}${color}`}
                        style={{ top, height, zIndex: 5 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (hasDetail) openMemberDetail(s)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {isSales && <span className="text-yellow-500">★ </span>}
                              {s.schedule_type} {s.member_name}
                            </p>
                            <p className="text-[10px] opacity-70">
                              {s.start_time} · {s.duration}분
                              {amount ? ` · ${amount}만` : ''}
                            </p>
                          </div>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 shrink-0"
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>스케줄 추가</DialogTitle>
            <DialogDescription>{createDate} {createTime}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 타입 선택 */}
            <div className="grid grid-cols-4 gap-1.5">
              {SCHEDULE_TYPES.map((t) => {
                const c = TYPE_COLORS[t] ?? TYPE_COLORS.기타
                return (
                  <button
                    key={t}
                    className={`rounded-md border-2 py-2 text-xs font-bold transition-colors ${createType === t ? `${c} border-current` : 'bg-white border-gray-200 text-gray-400'}`}
                    onClick={() => { setCreateType(t as typeof createType); setCreateName(''); setCreateOtSessionId('') }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {/* OT: 배정된 회원 선택 */}
            {createType === 'OT' && (
              <div className="space-y-2">
                <Label>회원 선택 (배정된 회원)</Label>
                <Select value={createOtSessionId} onValueChange={(v) => setCreateOtSessionId(v)}>
                  <SelectTrigger><SelectValue placeholder="회원을 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    {otMembers.map((a) => {
                      const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
                      const nextN = done + 1
                      const session = a.sessions?.find((s) => s.session_number === nextN)
                      return (
                        <SelectItem key={a.id} value={session?.id ?? `new-${a.id}-${nextN}`}>
                          {a.member.name} ({done}/3차 완료)
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {createOtSessionId && (
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const match = otMembers.find((a) =>
                        createOtSessionId.startsWith('new-') ? createOtSessionId.includes(a.id) : a.sessions?.some((s) => s.id === createOtSessionId)
                      )
                      if (!match) return ''
                      const done = match.sessions?.filter((s) => s.completed_at).length ?? 0
                      return `${done + 1}차 OT · ${match.member.ot_category ?? '헬스'}`
                    })()}
                  </p>
                )}
              </div>
            )}

            {/* PT/PPT: 회원 검색 + 간편 등록 */}
            {(createType === 'PT' || createType === 'PPT') && !showQuickRegister && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Search className="h-3 w-3" /> 회원 검색
                </Label>
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="이름 또는 전화번호로 검색..."
                    className="bg-white"
                  />
                  {searching && (
                    <span className="absolute right-3 top-2.5 text-xs text-gray-400">검색 중...</span>
                  )}
                </div>
                {/* 검색 결과 */}
                {searchResults.length > 0 && (
                  <div className="rounded-md border border-gray-200 max-h-[150px] overflow-y-auto">
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 border-b border-gray-100 last:border-0 flex justify-between items-center ${selectedMember?.id === m.id ? 'bg-yellow-50' : ''}`}
                        onClick={() => handleSelectSearchResult(m)}
                      >
                        <span className="font-medium text-gray-900">{m.name}</span>
                        <span className="text-xs text-gray-400">{m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                  <p className="text-xs text-gray-400 text-center py-1">검색 결과 없음</p>
                )}
                {/* 선택된 회원 표시 */}
                {selectedMember && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">{selectedMember.name}</p>
                      <p className="text-xs text-green-600">{selectedMember.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
                    </div>
                    <button onClick={() => { setSelectedMember(null); setCreateName(''); setSearchQuery('') }} className="text-green-400 hover:text-green-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {/* 간편 등록 버튼 */}
                {!selectedMember && (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    onClick={() => { setShowQuickRegister(true); setQuickName(searchQuery) }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    신규 회원 간편 등록
                  </button>
                )}
              </div>
            )}

            {/* PT/PPT: 간편 등록 폼 */}
            {(createType === 'PT' || createType === 'PPT') && showQuickRegister && (
              <div className="space-y-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <UserPlus className="h-3.5 w-3.5" /> 신규 회원 등록
                  </p>
                  <button onClick={() => setShowQuickRegister(false)} className="text-blue-400 hover:text-blue-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">이름</Label>
                  <Input value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="회원 이름" className="bg-white h-8 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">전화번호</Label>
                  <Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="01012345678" className="bg-white h-8 text-sm" />
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> 전화번호로 중복 체크 후 등록됩니다
                  </p>
                </div>
                <button
                  type="button"
                  className={`w-full rounded-lg border-2 py-2 text-xs font-bold transition-colors ${
                    quickIsExisting
                      ? 'bg-orange-50 border-orange-400 text-orange-700'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}
                  onClick={() => setQuickIsExisting(!quickIsExisting)}
                >
                  {quickIsExisting ? '✓ 이전 고객 (3월 이전)' : '신규 고객'}
                </button>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleQuickRegister}
                  disabled={!quickName || !quickPhone || createSaving}
                >
                  {createSaving ? '등록 중...' : '등록 후 스케줄 추가'}
                </Button>
              </div>
            )}

            {/* 기타 타입: 수기 입력 */}
            {createType !== 'OT' && createType !== 'PT' && createType !== 'PPT' && (
              <div className="space-y-2">
                <Label>내용</Label>
                <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={`${createType} 내용`} />
              </div>
            )}

            {/* 시간 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>날짜</Label>
                <Input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} step="1800" />
              </div>
            </div>

            {/* 수업 시간 */}
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
                      <p className="text-sm font-bold text-gray-900">{detailAssignment.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
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
                            {isDone ? '완료' : isScheduled ? format(new Date(session!.scheduled_at!), 'M/d HH:mm') : '미정'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 상태 변경 */}
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-2">상태 변경</p>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        className={`rounded-lg border-2 py-2.5 text-xs font-bold transition-colors ${
                          detailStatus === s
                            ? s === '완료' ? 'bg-green-500 text-white border-green-500'
                            : s === '거부' ? 'bg-red-500 text-white border-red-500'
                            : 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                        onClick={() => setDetailStatus(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 매출 정보 */}
                {(detailAssignment.is_sales_target || (detailAssignment.expected_amount && detailAssignment.expected_amount > 0)) && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-blue-700">매출대상자</span>
                      <span className="text-sm font-bold text-blue-900">
                        {detailAssignment.expected_amount ? `${detailAssignment.expected_amount.toLocaleString()}만원` : '-'}
                        {detailAssignment.closing_probability ? ` (${detailAssignment.closing_probability}%)` : ''}
                      </span>
                    </div>
                  </div>
                )}

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
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map((slot) => (
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
        <DialogContent className="max-w-sm">
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
                    {Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map((slot) => (
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
    </>
  )
}
