'use client'

import { useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
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
import { changeTrainer, updateOtAssignment } from '@/actions/ot'
import { addChangeLog } from '@/actions/change-log'
import type { Profile } from '@/types'
import type { MemberWithOt } from './member-list'

interface Props {
  member: MemberWithOt | null
  trainers: Pick<Profile, 'id' | 'name'>[]
  onClose: () => void
  onSaved: () => void
}

const isSpecialVal = (v: string) => v === 'none' || v === 'later' || v === 'not_requested'
const statusLabel = (v: string) => v === 'later' ? '추후배정' : v === 'not_requested' ? '미신청' : '미배정'

export function TrainerChangeDialog({ member, trainers, onClose, onSaved }: Props) {
  const a = member?.assignment
  const ptStatus = a?.pt_assign_status
  const pptStatus = a?.ppt_assign_status

  const [newPtTrainer, setNewPtTrainer] = useState(
    a?.pt_trainer_id ?? (ptStatus === 'later' ? 'later' : ptStatus === 'not_requested' ? 'not_requested' : 'none')
  )
  const [newPptTrainer, setNewPptTrainer] = useState(
    a?.ppt_trainer_id ?? (pptStatus === 'later' ? 'later' : pptStatus === 'not_requested' ? 'not_requested' : 'none')
  )
  const [ptChangeReason, setPtChangeReason] = useState('')
  const [pptChangeReason, setPptChangeReason] = useState('')
  const [changing, setChanging] = useState(false)

  const handleChange = async () => {
    if (!member || !a) return
    setChanging(true)

    const oldPtVal = a.pt_trainer_id ?? (a.pt_assign_status === 'later' ? 'later' : a.pt_assign_status === 'not_requested' ? 'not_requested' : 'none')
    const oldPptVal = a.ppt_trainer_id ?? (a.ppt_assign_status === 'later' ? 'later' : a.ppt_assign_status === 'not_requested' ? 'not_requested' : 'none')

    const promises: Promise<unknown>[] = []
    const statusOverrides: import('@/actions/ot').UpdateOtAssignmentValues = {}

    if (newPtTrainer !== oldPtVal) {
      const oldName = a.pt_trainer?.name ?? statusLabel(oldPtVal)
      const newName = isSpecialVal(newPtTrainer) ? statusLabel(newPtTrainer) : trainers.find((t) => t.id === newPtTrainer)?.name ?? newPtTrainer
      promises.push(changeTrainer(a.id, 'pt_trainer_id', isSpecialVal(newPtTrainer) ? null : newPtTrainer, oldName, newName, member.name))
      if (newPtTrainer === 'later' || newPtTrainer === 'not_requested') {
        statusOverrides.pt_assign_status = newPtTrainer
      }
      if (ptChangeReason) {
        promises.push(addChangeLog({ target_type: 'ot_assignment', target_id: a.id, action: 'PT 변경 사유', old_value: oldName, new_value: newName, note: `[사유] ${ptChangeReason}` }))
      }
    }
    if (newPptTrainer !== oldPptVal) {
      const oldName = a.ppt_trainer?.name ?? statusLabel(oldPptVal)
      const newName = isSpecialVal(newPptTrainer) ? statusLabel(newPptTrainer) : trainers.find((t) => t.id === newPptTrainer)?.name ?? newPptTrainer
      promises.push(changeTrainer(a.id, 'ppt_trainer_id', isSpecialVal(newPptTrainer) ? null : newPptTrainer, oldName, newName, member.name))
      if (newPptTrainer === 'later' || newPptTrainer === 'not_requested') {
        statusOverrides.ppt_assign_status = newPptTrainer
      }
      if (pptChangeReason) {
        promises.push(addChangeLog({ target_type: 'ot_assignment', target_id: a.id, action: 'PPT 변경 사유', old_value: oldName, new_value: newName, note: `[사유] ${pptChangeReason}` }))
      }
    }

    await Promise.all(promises)

    if (Object.keys(statusOverrides).length > 0) {
      await updateOtAssignment(a.id, statusOverrides)
    }

    setChanging(false)
    onSaved()
  }

  return (
    <Dialog open={!!member} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <ArrowRightLeft className="h-5 w-5" />
            선생님 변경
          </DialogTitle>
          <DialogDescription>
            <strong>{member?.name}</strong> 회원의 담당 선생님을 변경합니다.<br />
            변경 시 수업 히스토리가 새 선생님 폴더로 이동됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {a && (
            <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
              <p>현재 PT: <strong>{a.pt_trainer?.name ?? '미배정'}</strong></p>
              <p>현재 PPT: <strong>{a.ppt_trainer?.name ?? '미배정'}</strong></p>
            </div>
          )}
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
              <Label className="text-sm text-blue-600 font-bold">PT 담당</Label>
              <Select value={newPtTrainer} onValueChange={setNewPtTrainer}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  <SelectItem value="not_requested">미신청</SelectItem>
                  <SelectItem value="later">추후배정</SelectItem>
                  {trainers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
              {newPtTrainer !== (a?.pt_trainer_id ?? 'none') && (
                <div className="space-y-1">
                  <Label className="text-xs text-blue-500">변경 사유</Label>
                  <textarea
                    className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 min-h-[50px]"
                    placeholder="PT 변경 사유를 입력해주세요"
                    value={ptChangeReason}
                    onChange={(e) => setPtChangeReason(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
              <Label className="text-sm text-purple-600 font-bold">PPT 담당</Label>
              <Select value={newPptTrainer} onValueChange={setNewPptTrainer}>
                <SelectTrigger className="bg-white text-gray-900 border-gray-300"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  <SelectItem value="not_requested">미신청</SelectItem>
                  <SelectItem value="later">추후배정</SelectItem>
                  {trainers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
              {newPptTrainer !== (a?.ppt_trainer_id ?? 'none') && (
                <div className="space-y-1">
                  <Label className="text-xs text-purple-500">변경 사유</Label>
                  <textarea
                    className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-purple-400 min-h-[50px]"
                    placeholder="PPT 변경 사유를 입력해주세요"
                    value={pptChangeReason}
                    onChange={(e) => setPptChangeReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleChange} disabled={changing}>
            {changing ? '변경 중...' : '선생님 변경'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
