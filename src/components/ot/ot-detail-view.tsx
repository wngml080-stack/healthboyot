'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OtStatusBadge } from './ot-status-badge'
import { upsertOtSession, updateOtAssignment } from '@/actions/ot'
import { OT_STATUS_OPTIONS } from '@/lib/constants'
import { ArrowLeft, Check, CalendarDays, Clock } from 'lucide-react'
import Link from 'next/link'
import type { OtAssignmentWithDetails, OtStatus, Profile } from '@/types'

interface Props {
  assignment: OtAssignmentWithDetails
  profile: Profile
}

const TIME_SLOTS = [
  '06:00','07:00','08:00','09:00','10:00','11:00',
  '12:00','13:00','14:00','15:00','16:00','17:00',
  '18:00','19:00','20:00','21:00','22:00',
]

export function OtDetailView({ assignment, profile }: Props) {
  const router = useRouter()
  const a = assignment
  const isAdmin = profile.role === 'admin'
  const isAssignedTrainer =
    profile.id === a.pt_trainer_id || profile.id === a.ppt_trainer_id
  const canEdit = isAdmin || isAssignedTrainer

  const [status, setStatus] = useState<OtStatus>(a.status)
  const [ptConversion, setPtConversion] = useState(
    a.notes?.includes('PT 전환') ?? false
  )
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (newStatus: OtStatus) => {
    setStatus(newStatus)
    setSaving(true)
    await updateOtAssignment(a.id, { status: newStatus })
    setSaving(false)
    router.refresh()
  }

  const handlePtConversion = async () => {
    const next = !ptConversion
    setPtConversion(next)
    setSaving(true)
    const currentNotes = a.notes ?? ''
    const newNotes = next
      ? (currentNotes + ' PT 전환 희망').trim()
      : currentNotes.replace(/PT 전환 희망/g, '').trim()
    await updateOtAssignment(a.id, { notes: newNotes || null })
    setSaving(false)
    router.refresh()
  }

  const allSessionsCompleted = [1, 2, 3].every((n) =>
    a.sessions.find((s) => s.session_number === n)?.completed_at
  )

  // 일정 저장 후 상태 자동 변경
  const handleSessionSaved = async () => {
    // 첫 일정이 잡히면 → 진행중
    if (status === '신청대기' || status === '배정완료') {
      await updateOtAssignment(a.id, { status: '진행중' })
    }
    router.refresh()
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* 상단 네비 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/ot"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          OT 목록으로
        </Link>

        {canEdit && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={ptConversion ? 'default' : 'outline'}
              size="sm"
              onClick={handlePtConversion}
              disabled={saving}
            >
              <Check className={`h-4 w-4 mr-1 ${ptConversion ? '' : 'opacity-0'}`} />
              PT 전환
            </Button>

            <Select value={status} onValueChange={(v) => handleStatusChange(v as OtStatus)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {allSessionsCompleted && status !== '완료' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusChange('완료')}
                disabled={saving}
              >
                OT 전체 완료
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 회원 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{a.member.name}</CardTitle>
            <OtStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <span className="text-muted-foreground">연락처</span>
              <p className="font-medium">
                {a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">성별</span>
              <p className="font-medium">{a.member.gender ?? '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">운동기간</span>
              <p className="font-medium">
                {a.member.duration_months ? `${a.member.duration_months}개월` : '-'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">가능시간</span>
              <p className="font-medium text-blue-600">{a.member.exercise_time ?? '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">종목</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {a.member.sports.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">부상태그</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {a.member.injury_tags.length > 0
                  ? a.member.injury_tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-red-600 border-red-200">
                        {tag}
                      </Badge>
                    ))
                  : <span className="text-muted-foreground">없음</span>
                }
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">PT 담당</span>
              <p className="font-medium">{a.pt_trainer?.name ?? '미배정'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">PPT 담당</span>
              <p className="font-medium">{a.ppt_trainer?.name ?? '미배정'}</p>
            </div>
          </div>
          {a.member.notes && (
            <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
              <span className="text-muted-foreground">특이사항: </span>
              {a.member.notes}
            </div>
          )}
          {ptConversion && (
            <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              PT 전환 희망 회원입니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* OT 일정 잡기 */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          OT 일정
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((num) => (
            <SessionCard
              key={num}
              sessionNumber={num}
              assignmentId={a.id}
              session={a.sessions.find((s) => s.session_number === num) ?? null}
              canEdit={canEdit}
              onSaved={handleSessionSaved}
              memberExerciseTime={a.member.exercise_time}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionCard({
  sessionNumber,
  assignmentId,
  session,
  canEdit,
  onSaved,
  memberExerciseTime,
}: {
  sessionNumber: number
  assignmentId: string
  session: OtAssignmentWithDetails['sessions'][number] | null
  canEdit: boolean
  onSaved: () => void
  memberExerciseTime: string | null
}) {
  const [date, setDate] = useState(
    session?.scheduled_at
      ? format(new Date(session.scheduled_at), 'yyyy-MM-dd')
      : ''
  )
  const [time, setTime] = useState(
    session?.scheduled_at
      ? format(new Date(session.scheduled_at), 'HH:mm')
      : ''
  )
  const [feedback, setFeedback] = useState(session?.feedback ?? '')
  const [loading, setLoading] = useState(false)

  const isCompleted = !!session?.completed_at
  const isScheduled = !!date && !!time

  const handleSave = async () => {
    if (!date || !time) return
    setLoading(true)
    await upsertOtSession({
      ot_assignment_id: assignmentId,
      session_number: sessionNumber,
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
      feedback: feedback || null,
    })
    setLoading(false)
    onSaved()
  }

  const handleComplete = async () => {
    if (!date || !time) return
    setLoading(true)
    await upsertOtSession({
      ot_assignment_id: assignmentId,
      session_number: sessionNumber,
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
      completed_at: new Date().toISOString(),
      feedback: feedback || null,
    })
    setLoading(false)
    onSaved()
  }

  return (
    <Card className={isCompleted ? 'border-green-200 bg-green-50/30' : isScheduled ? 'border-blue-200' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between text-gray-900">
          <span>{sessionNumber}차 OT</span>
          {isCompleted ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              완료
            </Badge>
          ) : isScheduled ? (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              예약됨
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 완료된 일정 표시 */}
        {isCompleted && session?.scheduled_at && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-center">
            <p className="font-medium">
              {format(new Date(session.scheduled_at), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            </p>
            <p className="text-green-700 font-bold text-lg">
              {format(new Date(session.scheduled_at), 'HH:mm')}
            </p>
          </div>
        )}

        {/* 날짜 선택 */}
        {!isCompleted && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1 text-gray-700">
                <CalendarDays className="h-3 w-3" />
                날짜
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!canEdit}
                min={new Date().toISOString().split('T')[0]}
                className="bg-white text-gray-900 border-gray-300"
              />
            </div>

            {/* 시간 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1 text-gray-700">
                <Clock className="h-3 w-3" />
                시간
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_SLOTS.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={time === slot ? 'default' : 'outline'}
                    size="sm"
                    className={`text-xs h-8 px-0 ${time === slot ? 'bg-yellow-400 text-black hover:bg-yellow-500 border-yellow-400' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                    onClick={() => setTime(slot)}
                    disabled={!canEdit}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
              {memberExerciseTime && (
                <p className="text-[11px] text-blue-600 mt-1">
                  회원 희망: {memberExerciseTime}
                </p>
              )}
            </div>

            {/* 예약 확인 표시 */}
            {isScheduled && (
              <div className="rounded-md bg-blue-50 border border-blue-100 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">선택한 일정</p>
                <p className="font-medium text-sm">
                  {format(new Date(`${date}T${time}:00`), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </p>
                <p className="text-blue-700 font-bold text-xl">{time}</p>
              </div>
            )}
          </>
        )}

        {/* 피드백 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-700">피드백</Label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="회원 피드백을 입력하세요"
            rows={2}
            disabled={!canEdit}
            className="bg-white text-gray-900 border-gray-300"
          />
        </div>

        {/* 액션 버튼 */}
        {canEdit && !isCompleted && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={loading || !isScheduled}
              className="flex-1 bg-white text-gray-900 border-gray-300 hover:bg-gray-100"
            >
              {loading ? '저장 중...' : session?.scheduled_at ? '일정 수정' : '일정 저장'}
            </Button>
            {isScheduled && session?.scheduled_at && (
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                완료 처리
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
