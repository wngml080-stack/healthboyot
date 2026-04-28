'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Send, DollarSign, ArrowRightLeft, Search } from 'lucide-react'
import { rejectOtProgram, getOtProgram, upsertOtProgram, approveOtSession, rejectOtSession, fixProgramRollup } from '@/actions/ot-program'
import { getOtAssignment } from '@/actions/ot'
import { getConsultationCard } from '@/actions/consultation'
import dynamic from 'next/dynamic'
const OtProgramForm = dynamic(() => import('@/components/ot/ot-program-form').then((m) => m.OtProgramForm), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-gray-500">프로그램 로드 중...</div>,
}) as unknown as typeof import('@/components/ot/ot-program-form').OtProgramForm
import type { OtProgram, OtProgramSession, OtAssignmentWithDetails, Profile, ConsultationCard, OtRegistrationWithTrainer } from '@/types'

interface Props {
  programs: (OtProgram & { member_name?: string; is_sales_target?: boolean; is_pt_conversion?: boolean })[]
  profile: Profile
  registrations?: OtRegistrationWithTrainer[]
}

const STATUS_BADGE: Record<string, string> = {
  '제출완료': 'bg-yellow-500 text-white',
  '승인': 'bg-green-500 text-white',
  '반려': 'bg-red-500 text-white',
}

export function ApprovalList({ programs: initialPrograms, profile, registrations: initialRegistrations = [] }: Props) {
  const router = useRouter()
  const isAdmin = ['admin', '관리자'].includes(profile.role)
  const [programs, setPrograms] = useState(initialPrograms)

  // 승인 대기인데 모든 진행 세션이 승인된 프로그램 → rollup 자동 수정
  useState(() => {
    const stalePrograms = initialPrograms.filter((p) => {
      if (p.approval_status !== '제출완료') return false
      const relevant = (p.sessions ?? []).filter((s) => s.approval_status && s.approval_status !== '작성중')
      return relevant.length > 0 && relevant.every((s) => s.approval_status === '승인')
    })
    if (stalePrograms.length > 0) {
      Promise.all(stalePrograms.map((p) => fixProgramRollup(p.id))).then(() => {
        if (stalePrograms.length > 0) router.refresh()
      })
    }
  })
  const [viewTarget, setViewTarget] = useState<{ program: OtProgram; assignment: OtAssignmentWithDetails; card: ConsultationCard | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 인정건수 승인
  const [regs, setRegs] = useState(initialRegistrations)
  const [regRejectId, setRegRejectId] = useState<string | null>(null)
  const [regRejectReason, setRegRejectReason] = useState('')
  const pendingRegs = regs.filter((r) => r.approval_status === '제출완료')
  const processedRegs = regs.filter((r) => r.approval_status !== '제출완료')

  const handleRegApprove = async (id: string) => {
    setRegs((prev) => prev.map((r) => r.id === id ? { ...r, approval_status: '승인' as const, approved_at: new Date().toISOString() } : r))
    const { approveOtRegistration } = await import('@/actions/ot-registration')
    await approveOtRegistration(id)
    router.refresh()
  }

  const handleRegReject = async () => {
    if (!regRejectId || !regRejectReason) return
    const id = regRejectId
    const reason = regRejectReason
    setRegs((prev) => prev.map((r) => r.id === id ? { ...r, approval_status: '반려' as const, rejection_reason: reason } : r))
    setRegRejectId(null)
    setRegRejectReason('')
    const { rejectOtRegistration } = await import('@/actions/ot-registration')
    await rejectOtRegistration(id, reason)
    router.refresh()
  }

  // 세션별 피드백 + 펼침 (다중 펼침 지원)
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<number, string>>({})
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set())
  const toggleSession = (idx: number) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const [sessionRejectIdx, setSessionRejectIdx] = useState<number | null>(null)
  const [sessionRejectReason, setSessionRejectReason] = useState('')

  const handleView = async (prog: OtProgram) => {
    setLoading(true)
    const [assignment, freshProg, card] = await Promise.all([
      getOtAssignment(prog.ot_assignment_id),
      getOtProgram(prog.ot_assignment_id),
      getConsultationCard(prog.member_id),
    ])
    if (assignment) {
      setViewTarget({ program: freshProg ?? prog, assignment, card })
      const feedbacks: Record<number, string> = {}
      ;(freshProg ?? prog).sessions?.forEach((s, i) => {
        if (s.admin_feedback) feedbacks[i] = s.admin_feedback
      })
      setSessionFeedbacks(feedbacks)
      const toExpand = new Set<number>()
      ;(freshProg ?? prog).sessions?.forEach((_, i) => toExpand.add(i))
      setExpandedSessions(toExpand)
    }
    setLoading(false)
  }

  const handleReject = () => {
    if (!rejectId || !rejectReason) return
    const id = rejectId
    const reason = rejectReason
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, approval_status: '반려' as const, rejection_reason: reason } : p))
    setRejectId(null)
    setRejectReason('')
    setViewTarget(null)
    void rejectOtProgram(id, reason).then(() => router.refresh())
  }

  const handleSessionApprove = (sessionIdx: number) => {
    if (!viewTarget?.program?.id) return
    const programId = viewTarget.program.id
    const assignmentId = viewTarget.program.ot_assignment_id
    const memberId = viewTarget.program.member_id
    const feedbackText = sessionFeedbacks[sessionIdx]

    const updatedSessions = (viewTarget.program.sessions ?? []).map((s, i) =>
      i === sessionIdx
        ? { ...s, approval_status: '승인' as const, approved_at: new Date().toISOString(), admin_feedback: feedbackText ?? s.admin_feedback, rejection_reason: null }
        : s,
    )
    const updatedProgram = { ...viewTarget.program, sessions: updatedSessions as unknown as OtProgramSession[] }
    const allApproved = updatedSessions.every((s) => s.approval_status === '승인')
    if (allApproved) updatedProgram.approval_status = '승인'
    setViewTarget({ ...viewTarget, program: updatedProgram })
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, ...updatedProgram } : p))

    if (allApproved) {
      setTimeout(() => { setViewTarget(null); router.refresh() }, 1000)
    }

    void (async () => {
      if (feedbackText) {
        await upsertOtProgram(assignmentId, memberId, { sessions: updatedSessions as unknown as OtProgramSession[] })
      }
      await approveOtSession(programId, sessionIdx)
      router.refresh()
    })()
  }

  const handleSessionReject = () => {
    if (!viewTarget?.program?.id || sessionRejectIdx === null || !sessionRejectReason) return
    const programId = viewTarget.program.id
    const idx = sessionRejectIdx
    const reason = sessionRejectReason

    const updatedSessions = (viewTarget.program.sessions ?? []).map((s, i) =>
      i === idx ? { ...s, approval_status: '반려' as const, rejection_reason: reason } : s,
    )
    const updatedProgram = { ...viewTarget.program, sessions: updatedSessions as unknown as OtProgramSession[] }
    setViewTarget({ ...viewTarget, program: updatedProgram })
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, ...updatedProgram } : p))
    setSessionRejectIdx(null)
    setSessionRejectReason('')

    void rejectOtSession(programId, idx, reason).then(() => router.refresh())
  }

  const handleSessionFeedbackSave = (sessionIdx: number) => {
    if (!viewTarget) return
    const feedbackText = sessionFeedbacks[sessionIdx] ?? ''
    const assignmentId = viewTarget.program.ot_assignment_id
    const memberId = viewTarget.program.member_id
    const updatedSessions = [...(viewTarget.program.sessions ?? [])]
    if (updatedSessions[sessionIdx]) {
      updatedSessions[sessionIdx] = { ...updatedSessions[sessionIdx], admin_feedback: feedbackText }
    }
    setViewTarget({ ...viewTarget, program: { ...viewTarget.program, sessions: updatedSessions } })
    setFeedbackSaving(true)
    void upsertOtProgram(assignmentId, memberId, { sessions: updatedSessions as unknown as OtProgramSession[] }).then(() => {
      setFeedbackSaving(false)
      router.refresh()
    })
  }

  // 월별 필터
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 승인대기/처리완료 각각 검색 + 기간 필터
  const [pendingSearch, setPendingSearch] = useState('')
  const [processedSearch, setProcessedSearch] = useState('')
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [pendingMonth, setPendingMonth] = useState('')
  const [processedMonth, setProcessedMonth] = useState(currentMonth)
  // 트레이너 필터
  const trainerNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of programs) { if (p.trainer_name) names.add(p.trainer_name) }
    return Array.from(names).sort()
  }, [programs])
  const [trainerFilter, setTrainerFilter] = useState('')

  const filteredPrograms = useMemo(() => {
    let list = programs
    if (monthFilter) {
      list = list.filter((p) => {
        const date = p.submitted_at ?? p.created_at
        return date?.startsWith(monthFilter)
      })
    }
    if (trainerFilter) {
      list = list.filter((p) => p.trainer_name === trainerFilter)
    }
    return list
  }, [programs, monthFilter, trainerFilter])

  const pending = useMemo(() => {
    let list = filteredPrograms.filter((p) => p.approval_status === '제출완료')
    if (pendingMonth) {
      list = list.filter((p) => {
        const date = p.submitted_at ?? p.created_at
        return date?.startsWith(pendingMonth)
      })
    }
    const q = pendingSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        (p.member_name ?? '').toLowerCase().includes(q) ||
        (p.trainer_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [filteredPrograms, pendingSearch, pendingMonth])

  const processed = useMemo(() => {
    let list = filteredPrograms.filter((p) => p.approval_status !== '제출완료')
    if (processedMonth) {
      list = list.filter((p) => {
        const date = p.submitted_at ?? p.approved_at ?? p.created_at
        return date?.startsWith(processedMonth)
      })
    }
    const q = processedSearch.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        (p.member_name ?? '').toLowerCase().includes(q) ||
        (p.trainer_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [filteredPrograms, processedSearch, processedMonth])

  // 트레이너별 현황
  const trainerStats = (() => {
    const map = new Map<string, { total: number; pending: number; approved: number; inbody: number }>()
    for (const p of filteredPrograms) {
      const name = p.trainer_name ?? '미배정'
      const e = map.get(name) ?? { total: 0, pending: 0, approved: 0, inbody: 0 }
      e.total++
      if (p.approval_status === '제출완료') e.pending++
      if (p.approval_status === '승인') e.approved++
      e.inbody += p.sessions?.filter((s) => s.inbody).length ?? 0
      map.set(name, e)
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total)
  })()

  return (
    <div className="space-y-6">
      {/* 월별 필터만 (검색바 제거) */}
      <div className="flex gap-2 items-center">
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="h-9 text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-3"
        />
        {monthFilter && (
          <button onClick={() => setMonthFilter('')} className="h-9 px-3 text-xs bg-gray-100 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-200 shrink-0">전체기간</button>
        )}
      </div>

      {/* 트레이너별 현황 */}
      {trainerStats.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">트레이너별 현황</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trainerStats.map((t) => (
              <Card key={t.name} className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    {t.pending > 0 && (
                      <Badge className="bg-yellow-500 text-white text-[10px]">대기 {t.pending}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-600">{t.total}</p>
                      <p className="text-gray-500 text-xs">OT 수</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-yellow-600">{t.pending}</p>
                      <p className="text-gray-500 text-xs">대기</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-green-600">{t.approved}</p>
                      <p className="text-gray-500 text-xs">승인</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-purple-600">{t.inbody}</p>
                      <p className="text-gray-500 text-xs">인바디</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 회원권 등록 OT 인정건수 — 2열 그리드 */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          회원권 등록 OT 인정건수
          {pendingRegs.length > 0 && <Badge className="bg-yellow-500 text-white">대기 {pendingRegs.length}</Badge>}
          <Badge className="bg-green-500 text-white">승인 {regs.filter((r) => r.approval_status === '승인').reduce((s, r) => s + r.ot_credit, 0)}건</Badge>
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {pendingRegs.map((r) => (
            <Card key={r.id} className="bg-white border-l-4 border-l-emerald-400 border-y border-r border-gray-200 shadow-sm">
              <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px]">제출완료</Badge>
                    <p className="font-bold text-gray-900">{r.member_name}</p>
                    <span className="text-xs text-gray-500">{r.trainer?.name ?? '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{r.membership_type}</span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.registration_amount.toLocaleString()}원</span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{r.ot_credit}건</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs" onClick={() => handleRegApprove(r.id)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />승인
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs" onClick={() => { setRegRejectId(r.id); setRegRejectReason('') }}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />반려
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {processedRegs.length > 0 && (
            <div className="lg:col-span-2">
              <details className="mt-1" open>
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">처리완료 {processedRegs.length}건 보기</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 mt-2">
                  {processedRegs.map((r) => (
                    <Card key={r.id} className="bg-white border-gray-200 shadow-sm">
                      <CardContent className="py-2 px-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge className={r.approval_status === '승인' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>{r.approval_status}</Badge>
                          <span className="font-bold text-gray-900 text-sm">{r.member_name}</span>
                          <span className="text-xs text-gray-500">{r.trainer?.name} · {r.membership_type} · {r.registration_amount.toLocaleString()}원 · {r.ot_credit}건</span>
                          {r.rejection_reason && <span className="text-xs text-red-500">({r.rejection_reason})</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
        {pendingRegs.length === 0 && processedRegs.length === 0 && (
          <Card className="bg-white/5 border-gray-700">
            <CardContent className="py-6 text-center text-sm text-gray-400">
              등록된 인정건수가 없습니다.
            </CardContent>
          </Card>
        )}
      </div>

      {/* 트레이너 필터 */}
      {trainerNames.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setTrainerFilter('')}
            className={`h-8 px-3 rounded-md text-xs font-bold transition-colors ${!trainerFilter ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/70 hover:text-white'}`}
          >전체</button>
          {trainerNames.map((name) => (
            <button
              key={name}
              onClick={() => setTrainerFilter(trainerFilter === name ? '' : name)}
              className={`h-8 px-3 rounded-md text-xs font-bold transition-colors ${trainerFilter === name ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/70 hover:text-white'}`}
            >{name}</button>
          ))}
        </div>
      )}

      {/* 승인 대기 (좌) / 처리 완료 (우) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          승인 대기 <Badge className="bg-yellow-500 text-white">{pending.length}</Badge>
        </h3>
        {/* 승인대기 검색 + 기간 */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              placeholder="회원 또는 트레이너 검색"
              className="h-9 text-sm bg-white text-gray-900 border-gray-300 pl-9"
            />
          </div>
          <input
            type="month"
            value={pendingMonth}
            onChange={(e) => setPendingMonth(e.target.value)}
            className="h-9 text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2 w-[130px] shrink-0"
          />
          {pendingMonth && (
            <button onClick={() => setPendingMonth('')} className="h-9 px-2 text-[10px] bg-gray-100 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-200 shrink-0">전체</button>
          )}
        </div>
        {pending.length === 0 ? (
          <Card className="bg-white/5 border-gray-700">
            <CardContent className="py-6 text-center text-sm text-gray-400">
              승인 대기 중인 프로그램이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {pending.map((prog) => {
              const sessionCount = prog.sessions?.length ?? 0
              const inbodyCount = prog.sessions?.filter((s) => s.inbody).length ?? 0
              return (
                <Card key={prog.id} className="bg-white border-l-4 border-l-yellow-400 border-y border-r border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <p className="font-bold text-gray-900 text-base">{prog.member_name}</p>
                        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px]">제출완료</Badge>
                        {prog.is_sales_target && (
                          <Badge className="bg-red-100 text-red-700 border border-red-300 text-[10px] flex items-center gap-0.5">
                            <DollarSign className="h-2.5 w-2.5" />매출대상
                          </Badge>
                        )}
                        {prog.is_pt_conversion && (
                          <Badge className="bg-purple-100 text-purple-700 border border-purple-300 text-[10px] flex items-center gap-0.5">
                            <ArrowRightLeft className="h-2.5 w-2.5" />PT전환
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                          담당 {prog.trainer_name ?? '-'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          세션 {sessionCount}차
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">
                          인바디 {inbodyCount}건
                        </span>
                        {prog.submitted_at && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">
                            제출 {new Date(prog.submitted_at).toLocaleDateString('ko')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={() => handleView(prog)} disabled={loading}>
                      <Eye className="h-3.5 w-3.5 mr-1" />확인하기
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 처리 완료 */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          처리 완료 <Badge className="bg-gray-500 text-white">{processed.length}</Badge>
        </h3>
        {/* 처리완료 검색 + 기간 */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={processedSearch}
              onChange={(e) => setProcessedSearch(e.target.value)}
              placeholder="회원 또는 트레이너 검색"
              className="h-9 text-sm bg-white text-gray-900 border-gray-300 pl-9"
            />
          </div>
          <input
            type="month"
            value={processedMonth}
            onChange={(e) => setProcessedMonth(e.target.value)}
            className="h-9 text-sm bg-white text-gray-900 border border-gray-300 rounded-md px-2 w-[130px] shrink-0"
          />
          {processedMonth && (
            <button onClick={() => setProcessedMonth('')} className="h-9 px-2 text-[10px] bg-gray-100 text-gray-600 rounded-md border border-gray-300 hover:bg-gray-200 shrink-0">전체</button>
          )}
        </div>
        {processed.length === 0 ? (
          <Card className="bg-white/5 border-gray-700">
            <CardContent className="py-6 text-center text-sm text-gray-400">
              처리 완료된 프로그램이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {processed.map((prog) => {
              const hasManualApproval = prog.sessions?.some((s) => s.admin_feedback === '임의승인')
              return (
              <Card key={prog.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-2.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge className={STATUS_BADGE[prog.approval_status] ?? 'bg-gray-200 text-gray-700'}>
                      {prog.approval_status}
                    </Badge>
                    {hasManualApproval && <Badge className="bg-amber-500 text-white">임의승인</Badge>}
                    <span className="font-bold text-gray-900 text-sm">{prog.member_name}</span>
                    <span className="text-xs text-gray-500">담당 {prog.trainer_name ?? '-'}</span>
                    {prog.is_sales_target && (
                      <Badge className="bg-red-100 text-red-700 border border-red-300 text-[10px] flex items-center gap-0.5">
                        <DollarSign className="h-2.5 w-2.5" />매출대상
                      </Badge>
                    )}
                    {prog.is_pt_conversion && (
                      <Badge className="bg-purple-100 text-purple-700 border border-purple-300 text-[10px] flex items-center gap-0.5">
                        <ArrowRightLeft className="h-2.5 w-2.5" />PT전환
                      </Badge>
                    )}
                    {prog.rejection_reason && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">사유: {prog.rejection_reason}</span>
                    )}
                  </div>
                  <Button size="sm" className="bg-gray-800 hover:bg-gray-700 text-white shrink-0" onClick={() => handleView(prog)} disabled={loading}>
                    <Eye className="h-3.5 w-3.5 mr-1" />보기
                  </Button>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </div>
      </div>

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{viewTarget?.assignment.member.name} OT 승인</DialogTitle>
            <DialogDescription>각 세션 내용을 확인하고 피드백/승인 처리하세요</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <OtProgramForm
                assignment={viewTarget.assignment}
                program={viewTarget.program}
                profile={profile}
                hideButtons
                hideSessionList
                onSaved={() => router.refresh()}
              />

              {/* 세션별 피드백 + 승인 */}
              <div className="space-y-3">
                {viewTarget.program.sessions?.map((session, idx) => {
                  const sessStatus = session.approval_status ?? '작성중'
                  const sessBadge = sessStatus === '승인' ? 'bg-green-500' : sessStatus === '반려' ? 'bg-red-500' : sessStatus === '제출완료' ? 'bg-yellow-500' : 'bg-gray-400'
                  const canActSession = sessStatus === '제출완료' || sessStatus === '반려' || sessStatus === '승인'
                  return (
                  <Card key={idx} className={`border-2 ${sessStatus === '승인' ? 'border-green-400' : sessStatus === '반려' ? 'border-red-300' : 'border-gray-200'}`}>
                    <CardContent className="py-3 px-4 space-y-3">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSession(idx)}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-base">{idx + 1}차 OT</span>
                          <Badge className={`${sessBadge} text-white text-xs`}>{sessStatus}</Badge>
                          {session.admin_feedback === '임의승인' && <Badge className="bg-amber-500 text-white text-xs">임의승인</Badge>}
                          {session.completed && <Badge className="bg-green-500 text-white text-xs">완료</Badge>}
                          {session.inbody && <Badge className="bg-purple-500 text-white text-xs">인바디</Badge>}
                          {session.date && <span className="text-sm text-gray-500">{session.date} {session.time}</span>}
                          {session.rejection_reason && sessStatus === '반려' && (
                            <span className="text-xs text-red-500">({session.rejection_reason})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <span className="text-xs">피드백 / 승인</span>
                          {expandedSessions.has(idx) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {expandedSessions.has(idx) && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          {session.exercises?.filter((e) => e.name).length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-gray-500 mb-1">운동 내용</p>
                              <div className="space-y-0.5">
                                {session.exercises.filter((e) => e.name).map((e, i) => (
                                  <p key={i} className="text-sm text-gray-800">{e.name} {e.weight && `· ${e.weight}kg`} {e.reps && `· ${e.reps}개`} {e.sets && `· ${e.sets}세트`}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {session.cardio?.types?.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-blue-600">유산소: {session.cardio.types.join(', ')} {session.cardio.duration_min && `· ${session.cardio.duration_min}분`}</p>
                            </div>
                          )}

                          {session.inbody && (
                            <div className="bg-purple-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-purple-700 mb-1">인바디 측정</p>
                              {(session.inbody_images?.length ?? 0) > 0 && (
                                <div className="flex gap-2 flex-wrap mt-1">
                                  {session.inbody_images!.map((url, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <a key={i} href={url} target="_blank" rel="noreferrer">
                                      <img src={url} alt="inbody" className="h-20 w-20 object-cover rounded border" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {(session.sales_status || session.expected_amount || session.closing_probability || session.sales_note || session.is_sales_target || session.is_pt_conversion || session.closing_fail_reason || session.pt_sales_amount) && (
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <p className="text-xs font-bold text-emerald-800">세일즈 정보</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {session.sales_status && <Badge className="bg-emerald-600 text-white text-[10px]">{session.sales_status}</Badge>}
                                  {session.is_sales_target && <Badge className="bg-blue-600 text-white text-[10px]">매출대상</Badge>}
                                  {session.is_pt_conversion && <Badge className="bg-purple-600 text-white text-[10px]">PT전환</Badge>}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                                {session.expected_amount != null && (
                                  <div className="bg-white rounded px-2 py-1">
                                    <span className="text-gray-500">예상 매출</span>
                                    <p className="font-bold text-gray-900">{session.expected_amount.toLocaleString()}만</p>
                                  </div>
                                )}
                                {session.expected_sessions != null && (
                                  <div className="bg-white rounded px-2 py-1">
                                    <span className="text-gray-500">예상 회수</span>
                                    <p className="font-bold text-gray-900">{session.expected_sessions}회</p>
                                  </div>
                                )}
                                {session.closing_probability != null && (
                                  <div className="bg-white rounded px-2 py-1">
                                    <span className="text-gray-500">클로징 확률</span>
                                    <p className="font-bold text-gray-900">{session.closing_probability}%</p>
                                  </div>
                                )}
                                {session.pt_sales_amount != null && session.pt_sales_amount > 0 && (
                                  <div className="bg-white rounded px-2 py-1">
                                    <span className="text-gray-500">PT 매출</span>
                                    <p className="font-bold text-green-700">{session.pt_sales_amount.toLocaleString()}만</p>
                                  </div>
                                )}
                              </div>
                              {session.sales_note && (
                                <p className="text-xs text-gray-700"><span className="font-bold">메모:</span> {session.sales_note}</p>
                              )}
                              {session.closing_fail_reason && (
                                <p className="text-xs text-red-700"><span className="font-bold">실패 사유:</span> {session.closing_fail_reason}</p>
                              )}
                            </div>
                          )}

                          {(session.plan || session.plan_detail) && (() => {
                            const pd = session.plan_detail || null
                            const hasAny = session.plan || pd?.sessions_needed || pd?.duration || pd?.current_state || pd?.target_state || (pd?.weekly_roadmap && pd.weekly_roadmap.length > 0) || pd?.notes
                            if (!hasAny) return null
                            return (
                              <div className="bg-indigo-50 rounded-lg p-3 space-y-2 border border-indigo-200">
                                <p className="text-xs font-bold text-indigo-700">수업 계획서</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {pd?.sessions_needed && (
                                    <div className="bg-white rounded px-2 py-1.5">
                                      <span className="text-gray-500 text-[10px]">필요 횟수</span>
                                      <p className="font-bold text-gray-900">{pd.sessions_needed}</p>
                                    </div>
                                  )}
                                  {pd?.duration && (
                                    <div className="bg-white rounded px-2 py-1.5">
                                      <span className="text-gray-500 text-[10px]">기간</span>
                                      <p className="font-bold text-gray-900">{pd.duration}</p>
                                    </div>
                                  )}
                                </div>
                                {pd?.current_state && (
                                  <div className="bg-white rounded px-2 py-1.5 text-xs">
                                    <span className="font-bold text-gray-600">현재 몸상태:</span> <span className="text-gray-800 whitespace-pre-wrap">{pd.current_state}</span>
                                  </div>
                                )}
                                {pd?.target_state && (
                                  <div className="bg-white rounded px-2 py-1.5 text-xs">
                                    <span className="font-bold text-gray-600">목표 몸상태:</span> <span className="text-gray-800 whitespace-pre-wrap">{pd.target_state}</span>
                                  </div>
                                )}
                                {pd?.weekly_roadmap && pd.weekly_roadmap.length > 0 && (
                                  <div className="bg-white rounded p-2 text-xs space-y-1">
                                    <p className="font-bold text-gray-600 mb-1">주차별 로드맵</p>
                                    {pd.weekly_roadmap.map((r, i) => (
                                      <div key={i} className="flex gap-2 items-start border-l-2 border-indigo-300 pl-2">
                                        <span className="font-bold text-indigo-700 shrink-0">{r.week}</span>
                                        <span className="text-gray-800 whitespace-pre-wrap">{r.content}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {pd?.notes && (
                                  <div className="bg-white rounded px-2 py-1.5 text-xs">
                                    <span className="font-bold text-gray-600">특이사항:</span> <span className="text-gray-800 whitespace-pre-wrap">{pd.notes}</span>
                                  </div>
                                )}
                                {session.plan && !pd && (
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{session.plan}</p>
                                )}
                              </div>
                            )
                          })()}

                          {session.tip && (
                            <div className="bg-yellow-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-yellow-700 mb-1">트레이너 메모</p>
                              <p className="text-sm text-gray-800">{session.tip}</p>
                            </div>
                          )}

                          {isAdmin ? (
                            <div className="space-y-2 bg-blue-50/50 rounded-lg p-3 border border-blue-200">
                              <p className="text-sm font-bold text-blue-700">관리자 피드백</p>
                              <Textarea
                                value={sessionFeedbacks[idx] ?? ''}
                                onChange={(e) => setSessionFeedbacks({ ...sessionFeedbacks, [idx]: e.target.value })}
                                placeholder="피드백을 작성하고 승인/반려하세요 (트레이너에게 전달됩니다)"
                                rows={3}
                                className="bg-white border-blue-200 focus:ring-blue-400"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => handleSessionFeedbackSave(idx)}
                                  disabled={feedbackSaving}
                                >
                                  <Send className="h-3.5 w-3.5 mr-1" />
                                  {feedbackSaving ? '저장 중...' : '피드백 저장'}
                                </Button>
                                {canActSession && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleSessionApprove(idx)}
                                      title="피드백 내용이 있으면 함께 저장됩니다"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5 mr-1" />{idx + 1}차 승인 (피드백 저장)
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                      onClick={() => { setSessionRejectIdx(idx); setSessionRejectReason('') }}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />{idx + 1}차 {sessStatus === '승인' ? '승인후 반려' : '반려'}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            sessionFeedbacks[idx] && (
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <p className="text-xs font-bold text-blue-700 mb-1">관리자 피드백</p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{sessionFeedbacks[idx]}</p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  )
                })}
              </div>

              <div className="pt-2 border-t border-gray-200">
                <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white h-10 text-sm" onClick={() => setViewTarget(null)}>닫기</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 세션별 반려 사유 */}
      <Dialog open={sessionRejectIdx !== null} onOpenChange={() => setSessionRejectIdx(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{sessionRejectIdx !== null ? `${sessionRejectIdx + 1}차 OT 반려` : '반려'}</DialogTitle>
            <DialogDescription>반려 사유를 입력해주세요</DialogDescription>
          </DialogHeader>
          <Input value={sessionRejectReason} onChange={(e) => setSessionRejectReason(e.target.value)} placeholder="반려 사유" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => setSessionRejectIdx(null)}>취소</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSessionReject} disabled={!sessionRejectReason}>반려</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 반려 사유 다이얼로그 */}
      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>반려 사유</DialogTitle>
            <DialogDescription>반려 사유를 입력해주세요</DialogDescription>
          </DialogHeader>
          <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="반려 사유" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => setRejectId(null)}>취소</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleReject} disabled={!rejectReason}>반려</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 인정건수 반려 다이얼로그 */}
      <Dialog open={!!regRejectId} onOpenChange={() => setRegRejectId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>인정건수 반려</DialogTitle>
            <DialogDescription>반려 사유를 입력해주세요</DialogDescription>
          </DialogHeader>
          <Input value={regRejectReason} onChange={(e) => setRegRejectReason(e.target.value)} placeholder="반려 사유" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50" onClick={() => setRegRejectId(null)}>취소</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleRegReject} disabled={!regRejectReason}>반려</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
