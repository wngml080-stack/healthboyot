'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOtAssignment, getTrainers } from '@/actions/ot'
import { getConsultationCard } from '@/actions/consultation'
import { OT_STATUS_OPTIONS } from '@/lib/constants'
import type { OtAssignmentWithDetails, OtStatus } from '@/types'

interface OtAssignDialogProps {
  assignment: OtAssignmentWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function OtAssignDialog({
  assignment,
  open,
  onOpenChange,
  onSuccess,
}: OtAssignDialogProps) {
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([])
  const [status, setStatus] = useState<OtStatus>('신청대기')
  const [ptTrainerId, setPtTrainerId] = useState<string>('')
  const [pptTrainerId, setPptTrainerId] = useState<string>('')
  const [exerciseStartDate, setExerciseStartDate] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      getTrainers().then(setTrainers)
      if (assignment) {
        setStatus(assignment.status)
        setPtTrainerId(assignment.pt_trainer_id ?? '')
        setPptTrainerId(assignment.ppt_trainer_id ?? '')
        // 상담카드에서 운동 시작일 가져오기
        getConsultationCard(assignment.member_id).then((card) => {
          setExerciseStartDate(card?.exercise_start_date ?? '')
        })
      }
    }
  }, [open, assignment])

  const handleSave = async () => {
    if (!assignment) return
    setLoading(true)

    const result = await updateOtAssignment(assignment.id, {
      status,
      pt_trainer_id: ptTrainerId === 'none' ? null : ptTrainerId || null,
      ppt_trainer_id: pptTrainerId === 'none' ? null : pptTrainerId || null,
    })

    setLoading(false)

    if (!result.error) {
      onSuccess()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            OT 배정 — {assignment?.member.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 운동 시작일 */}
          <div className="space-y-2">
            <Label>운동 시작일</Label>
            <Input
              type="date"
              value={exerciseStartDate}
              className="bg-muted"
              disabled
              placeholder="상담카드에서 설정"
            />
            {!exerciseStartDate && (
              <p className="text-xs text-muted-foreground">상담카드에서 운동 시작일을 설정해주세요</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>상태</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as OtStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>PT 담당</Label>
            <Select value={ptTrainerId} onValueChange={(v) => setPtTrainerId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미배정</SelectItem>
                {trainers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>PPT 담당</Label>
            <Select value={pptTrainerId} onValueChange={(v) => setPptTrainerId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">미배정</SelectItem>
                {trainers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
