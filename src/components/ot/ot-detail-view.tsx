'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OtStatusBadge } from './ot-status-badge'
import { updateOtAssignment } from '@/actions/ot'
import { ArrowLeft } from 'lucide-react'
import { MemberTimeline } from './member-timeline'
import type { OtAssignmentWithDetails, OtStatus, Profile } from '@/types'

interface Props {
  assignment: OtAssignmentWithDetails
  profile: Profile
}

export function OtDetailView({ assignment, profile }: Props) {
  const router = useRouter()
  const a = assignment
  const isAdmin = profile.role === 'admin'
  const isAssignedTrainer =
    profile.id === a.pt_trainer_id || profile.id === a.ppt_trainer_id
  const canEdit = isAdmin || isAssignedTrainer

  const [status, setStatus] = useState<OtStatus>(a.status)
  const ptConversion = a.notes?.includes('PT 전환') ?? false
  const ptConverted = ptConversion && (a.is_pt_conversion || status === '완료' || (a.actual_sales ?? 0) > 0)
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (newStatus: OtStatus) => {
    setStatus(newStatus)
    setSaving(true)
    await updateOtAssignment(a.id, { status: newStatus })
    setSaving(false)
    router.refresh()
  }

  const allSessionsCompleted = a.sessions.length >= 3 && a.sessions.every((s) => s.completed_at)

  return (
    <div className="max-w-4xl space-y-6">
      {/* 상단 네비 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          회원관리로 돌아가기
        </button>

        {canEdit && allSessionsCompleted && status !== '완료' && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleStatusChange('완료')}
            disabled={saving}
          >
            OT 전체 완료
          </Button>
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
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div>
              <span className="text-muted-foreground">연락처</span>
              <p className="font-medium">
                {a.member.phone ? a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">운동기간</span>
              <p className="font-medium">
                {a.member.duration_months ?? '-'}
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
          {ptConverted ? (
            <div className="mt-3 rounded-md bg-purple-50 border border-purple-200 p-3 text-sm text-purple-700 font-medium">
              ✓ PT 전환 완료 회원입니다
            </div>
          ) : ptConversion ? (
            <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              PT 전환 희망 회원입니다
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 히스토리 타임라인 */}
      <MemberTimeline assignment={a} />
    </div>
  )
}
