'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { rejectOtProgram, getOtProgram, upsertOtProgram, approveOtSession, rejectOtSession } from '@/actions/ot-program'
import { getOtAssignment } from '@/actions/ot'
import { getConsultationCard } from '@/actions/consultation'
import dynamic from 'next/dynamic'
const OtProgramForm = dynamic(() => import('@/components/ot/ot-program-form').then((m) => m.OtProgramForm), {
  ssr: false,
  loading: () => <div className="py-10 text-center text-sm text-gray-500">프로그램 로드 중...</div>,
}) as unknown as typeof import('@/components/ot/ot-program-form').OtProgramForm
import type { OtProgram, OtProgramSession, OtAssignmentWithDetails, Profile, ConsultationCard, OtRegistrationWithTrainer } from '@/types'

interface Props {
  programs: (OtProgram & { member_name?: string })[]
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
    // member_id는 프로그램에 이미 있으므로 3개 요청을 모두 병렬로 실행
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
      // 모든 세션 펼침 (승인된 세션도 반려 가능하도록)
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
    // 즉시 UI 반영
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, approval_status: '반려' as const, rejection_reason: reason } : p))
    setRejectId(null)
    setRejectReason('')
    setViewTarget(null)
    // 서버 반영은 백그라운드
    void rejectOtProgram(id, reason).then(() => router.refresh())
  }

  const handleSessionApprove = (sessionIdx: number) => {
    if (!viewTarget?.program?.id) return
    const programId = viewTarget.program.id
    const assignmentId = viewTarget.program.ot_assignment_id
    const memberId = viewTarget.program.member_id
    const feedbackText = sessionFeedbacks[sessionIdx]

    // 즉시 UI 반영 (낙관적 업데이트)
    const updatedSessions = (viewTarget.program.sessions ?? []).map((s, i) =>
      i === sessionIdx
        ? { ...s, approval_status: '승인' as const, approved_at: new Date().toISOString(), admin_feedback: feedbackText ?? s.admin_feedback, rejection_reason: null }
        : s,
    )
    const updatedProgram = { ...viewTarget.program, sessions: updatedSessions as unknown as OtProgramSession[] }
    // 모든 세션이 승인되면 프로그램 전체 승인
    const allApproved = updatedSessions.every((s) => s.approval_status === '승인')
    if (allApproved) updatedProgram.approval_status = '승인'
    setViewTarget({ ...viewTarget, program: updatedProgram })
    setPrograms((prev) => prev.map((p) => p.id === programId ? { ...p, ...updatedProgram } : p))

    // 모든 세션 승인 완료 시 자동으로 팝업 닫기
    if (allApproved) {
      setTimeout(() => { setViewTarget(null); router.refresh() }, 1000)
    }

    // 서버 반영은 백그라운드
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

    // 즉시 UI 반영
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
    // 즉시 UI 반영
    setViewTarget({ ...viewTarget, program: { ...viewTarget.program, sessions: updatedSessions } })
    setFeedbackSaving(true)
    void upsertOtProgram(assignmentId, memberId, { sessions: updatedSessions as unknown as OtProgramSession[] }).then(() => {
      setFeedbackSaving(false)
      router.refresh()
    })
  }

  const pending = programs.filter((p) => p.approval_status === '제출완료')
  const processed = programs.filter((p) => p.approval_status !== '제출완료')

  // 트레이너별 현황
  const trainerStats = (() => {
    const map = new Map<string, { total: number; pending: number; approved: number; inbody: number }>()
    for (const p of programs) {
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

      {/* 회원권 등록 OT 인정건수 */}
      {(pendingRegs.length > 0 || processedRegs.length > 0) && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            회원권 등록 OT 인정건수
            {pendingRegs.length > 0 && <Badge className="bg-yellow-500 text-white">대기 {pendingRegs.length}</Badge>}
            <Badge className="bg-green-500 text-white">승인 {regs.filter((r) => r.approval_status === '승인').reduce((s, r) => s + r.ot_credit, 0)}건</Badge>
          </h3>
          <div className="grid gap-2">
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
              <details className="mt-1" open>
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">처리완료 {processedRegs.length}건 보기</summary>
                <div className="grid gap-1.5 mt-2">
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
            )}
          </div>
        </div>
      )}

      {/* 승인 대기 (좌) / 처리 완료 (우) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          승인 대기 <Badge className="bg-yellow-500 text-white">{pending.length}</Badge>
        </h3>
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
        {processed.length === 0 ? (
          <Card className="bg-white/5 border-gray-700">
            <CardContent className="py-6 text-center text-sm text-gray-400">
              처리 완료된 프로그램이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {processed.map((prog) => (
              <Card key={prog.id} className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-2.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <Badge className={STATUS_BADGE[prog.approval_status] ?? 'bg-gray-200 text-gray-700'}>
                      {prog.approval_status}
                    </Badge>
                    <span className="font-bold text-gray-900 text-sm">{prog.member_name}</span>
                    <span className="text-xs text-gray-500">담당 {prog.trainer_name ?? '-'}</span>
                    {prog.rejection_reason && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">사유: {prog.rejection_reason}</span>
                    )}
                  </div>
                  <Button size="sm" className="bg-gray-800 hover:bg-gray-700 text-white shrink-0" onClick={() => handleView(prog)} disabled={loading}>
                    <Eye className="h-3.5 w-3.5 mr-1" />보기
                  </Button>
                </CardContent>
              </Card>
            ))}
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
              {/* 프로그램 폼 (읽기용) */}
              <OtProgramForm
                assignment={viewTarget.assignment}
                program={viewTarget.program}
                profile={profile}
                hideButtons
                hideSessionList
                onSaved={() => router.refresh()}
              />


              {/* 세션별 피드백 + 승인 — 각 OT 아래 */}
              <div className="space-y-3">
                {viewTarget.program.sessions?.map((session, idx) => {
                  const sessStatus = session.approval_status ?? '작성중'
                  const sessBadge = sessStatus === '승인' ? 'bg-green-500' : sessStatus === '반려' ? 'bg-red-500' : sessStatus === '제출완료' ? 'bg-yellow-500' : 'bg-gray-400'
                  const canActSession = sessStatus === '제출완료' || sessStatus === '반려' || sessStatus === '승인'
                  return (
                  <Card key={idx} className={`border-2 ${sessStatus === '승인' ? 'border-green-400' : sessStatus === '반려' ? 'border-red-300' : 'border-gray-200'}`}>
                    <CardContent className="py-3 px-4 space-y-3">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSession(idx)}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-base">{idx + 1}차 OT</span>
                          <Badge className={`${sessBadge} text-white text-xs`}>{sessStatus}</Badge>
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

                      {/* 펼침 — 운동 요약 + 피드백 + 승인 */}
                      {expandedSessions.has(idx) && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          {/* 운동 내용 */}
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

                          {/* 유산소 */}
                          {session.cardio?.types?.length > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-blue-600">유산소: {session.cardio.types.join(', ')} {session.cardio.duration_min && `· ${session.cardio.duration_min}분`}</p>
                            </div>
                          )}

                          {/* 인바디 */}
                          {session.inbody && (
                            <div className="bg-purple-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-purple-700 mb-1">📊 인바디 측정</p>
                              {(session.inbody_images?.length ?? 0) > 0 && (
                                <div className="flex gap-2 flex-wrap mt-1">
                                  {session.inbody_images!.map((url, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <a key={i} href={url} target="_blank" rel="noreferrer">
                                      <img src={url} alt="inbody" className="h-20 w-20 object-cover rounded border" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 세일즈 정보 */}
                          {(session.sales_status || session.expected_amount || session.closing_probability || session.sales_note || session.is_sales_target || session.is_pt_conversion || session.closing_fail_reason || session.pt_sales_amount) && (
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <p className="text-xs font-bold text-emerald-800">💰 세일즈 정보</p>
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

                          {/* 수업 계획서 */}
                          {(session.plan || session.plan_detail) && (() => {
                            const pd = session.plan_detail || null
                            const hasAny = session.plan || pd?.sessions_needed || pd?.duration || pd?.current_state || pd?.target_state || (pd?.weekly_roadmap && pd.weekly_roadmap.length > 0) || pd?.notes
                            if (!hasAny) return null
                            return (
                              <div className="bg-indigo-50 rounded-lg p-3 space-y-2 border border-indigo-200">
                                <p className="text-xs font-bold text-indigo-700">🎯 수업 계획서</p>
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

                          {/* 트레이너 메모 */}
                          {session.tip && (
                            <div className="bg-yellow-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-yellow-700 mb-1">트레이너 메모</p>
                              <p className="text-sm text-gray-800">{session.tip}</p>
                            </div>
                          )}

                          {/* 관리자 피드백 입력 — 관리자 전용 */}
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
                                <p className="text-xs font-bold text-blue-700 mb-1">📋 관리자 피드백</p>
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

              {/* 하단 — 닫기만 */}
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
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSessionReject} disabled={!sessionRejectReason }>반려</Button>
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
