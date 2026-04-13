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
import { approveOtProgram, rejectOtProgram, getOtProgram, upsertOtProgram } from '@/actions/ot-program'
import { getOtAssignment } from '@/actions/ot'
import { OtProgramForm } from '@/components/ot/ot-program-form'
import type { OtProgram, OtProgramSession, OtAssignmentWithDetails, Profile } from '@/types'

interface Props {
  programs: (OtProgram & { member_name?: string })[]
  profile: Profile
}

const STATUS_BADGE: Record<string, string> = {
  '제출완료': 'bg-yellow-500 text-white',
  '승인': 'bg-green-500 text-white',
  '반려': 'bg-red-500 text-white',
}

export function ApprovalList({ programs: initialPrograms, profile }: Props) {
  const router = useRouter()
  const [programs, setPrograms] = useState(initialPrograms)
  const [viewTarget, setViewTarget] = useState<{ program: OtProgram; assignment: OtAssignmentWithDetails } | null>(null)
  const [loading, setLoading] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 세션별 피드백 + 펼침
  const [sessionFeedbacks, setSessionFeedbacks] = useState<Record<number, string>>({})
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  const handleView = async (prog: OtProgram) => {
    setLoading(true)
    const assignment = await getOtAssignment(prog.ot_assignment_id)
    if (assignment) {
      const freshProg = await getOtProgram(prog.ot_assignment_id)
      setViewTarget({ program: freshProg ?? prog, assignment })
      const feedbacks: Record<number, string> = {}
      ;(freshProg ?? prog).sessions?.forEach((s, i) => {
        if (s.tip) feedbacks[i] = s.tip
      })
      setSessionFeedbacks(feedbacks)
      setExpandedSession(null)
    }
    setLoading(false)
  }

  const handleApprove = async (id: string) => {
    await approveOtProgram(id)
    router.refresh()
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, approval_status: '승인' as const } : p))
    setViewTarget(null)
  }

  const handleReject = async () => {
    if (!rejectId || !rejectReason) return
    await rejectOtProgram(rejectId, rejectReason)
    router.refresh()
    setPrograms((prev) => prev.map((p) => p.id === rejectId ? { ...p, approval_status: '반려' as const, rejection_reason: rejectReason } : p))
    setRejectId(null)
    setRejectReason('')
    setViewTarget(null)
  }

  const handleSessionFeedbackSave = async (sessionIdx: number) => {
    if (!viewTarget) return
    setFeedbackSaving(true)
    const updatedSessions = [...(viewTarget.program.sessions ?? [])]
    if (updatedSessions[sessionIdx]) {
      updatedSessions[sessionIdx] = { ...updatedSessions[sessionIdx], tip: sessionFeedbacks[sessionIdx] ?? '' }
    }
    await upsertOtProgram(viewTarget.program.ot_assignment_id, viewTarget.program.member_id, {
      sessions: updatedSessions as unknown as OtProgramSession[],
    })
    setViewTarget({ ...viewTarget, program: { ...viewTarget.program, sessions: updatedSessions } })
    setFeedbackSaving(false)
    alert('피드백이 저장되었습니다.')
  }

  const pending = programs.filter((p) => p.approval_status === '제출완료')
  const processed = programs.filter((p) => p.approval_status !== '제출완료')

  // 트레이너별 현황
  const trainerStats = (() => {
    const map = new Map<string, { total: number; approved: number; inbody: number }>()
    for (const p of programs) {
      const name = p.trainer_name ?? '미배정'
      const e = map.get(name) ?? { total: 0, approved: 0, inbody: 0 }
      e.total++
      if (p.approval_status === '승인') e.approved++
      e.inbody += p.sessions?.filter((s) => s.inbody).length ?? 0
      map.set(name, e)
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }))
  })()

  return (
    <div className="space-y-6">
      {/* 트레이너별 현황 */}
      {trainerStats.length > 0 && (
        <div className="flex justify-center">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {trainerStats.map((t) => (
              <Card key={t.name}>
                <CardContent className="py-3 px-4">
                  <p className="text-sm font-bold text-gray-900 mb-2 text-center">{t.name}</p>
                  <div className="flex items-center justify-center gap-3 text-xs">
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-600">{t.total}</p>
                      <p className="text-gray-500">OT 수</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">{t.approved}</p>
                      <p className="text-gray-500">승인</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-purple-600">{t.inbody}</p>
                      <p className="text-gray-500">인바디</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 승인 대기 */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3">
          승인 대기 <Badge className="bg-yellow-500 text-white ml-2">{pending.length}</Badge>
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">승인 대기 중인 프로그램이 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            {pending.map((prog) => (
              <Card key={prog.id} className="border-yellow-300">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{prog.member_name}</p>
                    <p className="text-xs text-gray-500">
                      담당: {prog.trainer_name ?? '-'} | 제출: {prog.submitted_at ? new Date(prog.submitted_at).toLocaleDateString('ko') : '-'}
                      {' | '}세션 {prog.sessions?.length ?? 0}차
                      {' | '}인바디 {prog.sessions?.filter((s) => s.inbody).length ?? 0}건
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-gray-800 hover:bg-gray-700 text-white" onClick={() => handleView(prog)} disabled={loading}>
                      <Eye className="h-3.5 w-3.5 mr-1" />확인
                    </Button>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setRejectId(prog.id); setRejectReason('') }}>
                      <XCircle className="h-3.5 w-3.5 mr-1" />반려
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 처리 완료 */}
      {processed.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">처리 완료</h3>
          <div className="grid gap-2">
            {processed.map((prog) => (
              <Card key={prog.id} className="border-gray-200">
                <CardContent className="py-2 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={STATUS_BADGE[prog.approval_status] ?? 'bg-gray-200 text-gray-700'}>
                      {prog.approval_status}
                    </Badge>
                    <span className="font-medium text-gray-900 text-sm">{prog.member_name}</span>
                    <span className="text-xs text-gray-500">{prog.trainer_name}</span>
                    {prog.rejection_reason && (
                      <span className="text-xs text-red-500">({prog.rejection_reason})</span>
                    )}
                  </div>
                  <Button size="sm" className="bg-gray-800 hover:bg-gray-700 text-white" onClick={() => handleView(prog)} disabled={loading}>
                    <Eye className="h-3.5 w-3.5 mr-1" />보기
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
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
                onSaved={() => router.refresh()}
              />

              {/* 세션별 피드백 + 승인 — 각 OT 아래 */}
              <div className="space-y-3">
                {viewTarget.program.sessions?.map((session, idx) => (
                  <Card key={idx} className={`border-2 ${session.completed ? 'border-green-400' : 'border-gray-200'}`}>
                    <CardContent className="py-3 px-4 space-y-3">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSession(expandedSession === idx ? null : idx)}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-base">{idx + 1}차 OT</span>
                          {session.completed && <Badge className="bg-green-500 text-white text-xs">완료</Badge>}
                          {session.inbody && <Badge className="bg-purple-500 text-white text-xs">인바디</Badge>}
                          {session.date && <span className="text-sm text-gray-500">{session.date} {session.time}</span>}
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <span className="text-xs">피드백 / 승인</span>
                          {expandedSession === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {/* 펼침 — 운동 요약 + 피드백 + 승인 */}
                      {expandedSession === idx && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          {/* 운동 내용 */}
                          {session.exercises?.filter((e) => e.name).length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-gray-500 mb-1">운동 내용</p>
                              <div className="space-y-0.5">
                                {session.exercises.filter((e) => e.name).map((e, i) => (
                                  <p key={i} className="text-sm text-gray-800">{e.name} {e.weight && `· ${e.weight}`} {e.sets && `· ${e.sets}세트`}</p>
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

                          {/* 트레이너 메모 */}
                          {session.tip && !sessionFeedbacks[idx] && (
                            <div className="bg-yellow-50 rounded-lg p-3">
                              <p className="text-xs font-bold text-yellow-700 mb-1">트레이너 메모</p>
                              <p className="text-sm text-gray-800">{session.tip}</p>
                            </div>
                          )}

                          {/* 관리자 피드백 입력 */}
                          <div className="space-y-2 bg-blue-50/50 rounded-lg p-3 border border-blue-200">
                            <p className="text-sm font-bold text-blue-700">관리자 피드백</p>
                            <Textarea
                              value={sessionFeedbacks[idx] ?? ''}
                              onChange={(e) => setSessionFeedbacks({ ...sessionFeedbacks, [idx]: e.target.value })}
                              placeholder="이 세션에 대한 피드백을 작성하세요 (트레이너에게 전달됩니다)"
                              rows={3}
                              className="bg-white border-blue-200 focus:ring-blue-400"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleSessionFeedbackSave(idx)}
                                disabled={feedbackSaving}
                              >
                                <Send className="h-3.5 w-3.5 mr-1" />
                                {feedbackSaving ? '저장 중...' : '피드백 저장'}
                              </Button>
                              {viewTarget.program.approval_status === '제출완료' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={async () => {
                                    // 피드백 있으면 먼저 저장
                                    if (sessionFeedbacks[idx]) {
                                      await handleSessionFeedbackSave(idx)
                                    }
                                    await handleApprove(viewTarget.program.id)
                                  }}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />승인
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 하단 — 반려 + 닫기 */}
              <div className="flex gap-3 pt-2 border-t border-gray-200">
                {viewTarget.program.approval_status === '제출완료' && (
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11 text-base" onClick={() => { setRejectId(viewTarget.program.id); setRejectReason('') }}>
                    <XCircle className="h-5 w-5 mr-2" />반려
                  </Button>
                )}
                <Button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white h-11 text-base" onClick={() => setViewTarget(null)}>닫기</Button>
              </div>
            </div>
          )}
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
            <Button variant="outline" onClick={() => setRejectId(null)}>취소</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleReject} disabled={!rejectReason}>반려</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
