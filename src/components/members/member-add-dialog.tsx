'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
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
import { quickRegisterMember } from '@/actions/members'
import type { Profile } from '@/types'

interface Props {
  open: boolean
  trainers: Pick<Profile, 'id' | 'name'>[]
  onClose: () => void
  onSaved: () => void
}

export function MemberAddDialog({ open, trainers, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [assignDate, setAssignDate] = useState('')
  const [dateUnknown, setDateUnknown] = useState(false)
  const [category, setCategory] = useState('')
  const [trainingType, setTrainingType] = useState('')
  const [duration, setDuration] = useState('')
  const [exerciseTime, setExerciseTime] = useState('')
  const [exerciseGoal, setExerciseGoal] = useState('')
  const [notes, setNotes] = useState('')
  const [trainerId, setTrainerId] = useState('')
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setName(''); setPhone(''); setAssignDate(''); setDateUnknown(false)
    setCategory(''); setTrainingType(''); setDuration('')
    setExerciseTime(''); setExerciseGoal(''); setNotes(''); setTrainerId('')
  }

  const handleAdd = async () => {
    if (!name || !phone || !category) return
    if (!dateUnknown && !assignDate) {
      alert('배정날짜를 입력하거나 "모름"을 체크해주세요')
      return
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      alert('올바른 전화번호를 입력해주세요 (10~11자리)')
      return
    }

    setLoading(true)
    const result = await quickRegisterMember({
      name,
      phone: cleanPhone,
      trainerId: trainerId || '',
      registered_at: dateUnknown ? undefined : assignDate || undefined,
      ot_category: category || null,
      training_type: trainingType || undefined,
      duration_months: duration || null,
      exercise_time: exerciseTime || null,
      exercise_goal: exerciseGoal || undefined,
      notes: notes || null,
    })
    if ('duplicate' in result && result.duplicate) {
      // 전화번호 중복 — 안내만 띄우고 등록 차단
      alert(result.message)
      setLoading(false)
      return
    }
    if (result.error) {
      alert('등록 실패: ' + result.error)
    } else {
      resetForm()
      onSaved()
    }
    setLoading(false)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      resetForm()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            회원 추가
          </DialogTitle>
          <DialogDescription>새 회원 정보를 입력해주세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>이름 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="회원 이름" />
          </div>
          <div className="space-y-2">
            <Label>전화번호 *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" />
          </div>
          <div className="space-y-2">
            <Label>배정날짜 *</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                disabled={dateUnknown}
                className={`flex-1 ${dateUnknown ? 'opacity-50' : ''}`}
              />
              <button
                type="button"
                className={`shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  dateUnknown
                    ? 'bg-gray-600 text-white border-gray-600'
                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => { setDateUnknown(!dateUnknown); if (!dateUnknown) setAssignDate('') }}
              >
                모름
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>담당 트레이너</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger>
                <SelectValue placeholder="선택 안함 (미배정)" />
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
            <Label>종목 *</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: 헬스, 필라, 헬스+필라" />
          </div>
          <div className="space-y-2">
            <Label>운동기간</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="예: 3개월, 6개월" />
          </div>
          <div className="space-y-2">
            <Label>운동 희망시간</Label>
            <Input value={exerciseTime} onChange={(e) => setExerciseTime(e.target.value)} placeholder="예: 평일 18시 이후" />
          </div>
          <div className="space-y-2">
            <Label>운동목적</Label>
            <Input value={exerciseGoal} onChange={(e) => setExerciseGoal(e.target.value)} placeholder="예: 다이어트, 체력증진, 재활" />
          </div>
          <div className="space-y-2">
            <Label>특이사항</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="부상 이력, 주의사항 등"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleAdd}
            disabled={loading || !name || !phone || !category || (!dateUnknown && !assignDate)}
          >
            {loading ? '등록 중...' : '회원 등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
