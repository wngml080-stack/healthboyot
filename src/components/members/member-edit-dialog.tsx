'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { updateMember } from '@/actions/members'
import { updateOtAssignment } from '@/actions/ot'
import type { Profile } from '@/types'
import type { MemberWithOt } from './member-list'

interface Props {
  member: MemberWithOt | null
  trainers: Pick<Profile, 'id' | 'name'>[]
  onClose: () => void
  onSaved: () => void
}

export function MemberEditDialog({ member, trainers, onClose, onSaved }: Props) {
  const [name, setName] = useState(member?.name ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [gender, setGender] = useState(member?.gender ?? '')
  const [exerciseTime, setExerciseTime] = useState(member?.exercise_time ?? '')
  const [duration, setDuration] = useState(member?.duration_months ? String(member.duration_months) : '')
  const [notes, setNotes] = useState(member?.notes ?? '')
  const [ptTrainer, setPtTrainer] = useState(member?.assignment?.pt_trainer_id ?? 'none')
  const [pptTrainer, setPptTrainer] = useState(member?.assignment?.ppt_trainer_id ?? 'none')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!member) return
    setLoading(true)

    const promises: Promise<unknown>[] = [
      updateMember(member.id, {
        name,
        phone,
        gender: gender as '남' | '여' | undefined || undefined,
        exercise_time: exerciseTime || null,
        duration_months: duration || null,
        notes: notes || null,
      }),
    ]

    if (member.assignment) {
      const trainerUpdates: import('@/actions/ot').UpdateOtAssignmentValues = {}
      const newPt = ptTrainer === 'none' ? null : ptTrainer
      const newPpt = pptTrainer === 'none' ? null : pptTrainer

      if (newPt !== member.assignment.pt_trainer_id) {
        trainerUpdates.pt_trainer_id = newPt
      }
      if (newPpt !== member.assignment.ppt_trainer_id) {
        trainerUpdates.ppt_trainer_id = newPpt
      }

      if (Object.keys(trainerUpdates).length > 0) {
        promises.push(updateOtAssignment(member.assignment.id, trainerUpdates))
      }
    }

    await Promise.all(promises)
    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open={!!member} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>회원 정보 수정</DialogTitle>
          <DialogDescription>{member?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>연락처</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>성별</Label>
              <Select value={gender || 'none'} onValueChange={(v) => setGender(v === 'none' ? '' : v)}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미입력</SelectItem>
                  <SelectItem value="남">남</SelectItem>
                  <SelectItem value="여">여</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>운동기간</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="예: 헬스3, 기필10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>운동시간</Label>
            <Input value={exerciseTime} onChange={(e) => setExerciseTime(e.target.value)} placeholder="예: 저녁시간" />
          </div>
          <div className="space-y-2">
            <Label>특이사항</Label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-900 mb-3">담당자 배정</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>PT 담당</Label>
                <Select value={ptTrainer} onValueChange={setPtTrainer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    <SelectItem value="not_requested">미신청</SelectItem>
                    <SelectItem value="later">추후배정</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>PPT 담당</Label>
                <Select value={pptTrainer} onValueChange={setPptTrainer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미배정</SelectItem>
                    <SelectItem value="not_requested">미신청</SelectItem>
                    <SelectItem value="later">추후배정</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
