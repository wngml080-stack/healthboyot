'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Loader2, Check, X, ImageIcon, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface RapoSchedule {
  name: string
  day: number
  dayOfWeek: string
  time: string
}

type ReviewItem = RapoSchedule & {
  selected: boolean
  exists: boolean
  notRegistered: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  trainerId: string
  year: number
  month: number
  onImported: () => void
}

export function RapoImportDialog({ open, onClose, trainerId, year, month, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'importing' | 'done'>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<ReviewItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState({ success: 0, skipped: 0 })
  const fileRef = useRef<HTMLInputElement>(null)
  const fileDataRef = useRef<File | null>(null)

  const reset = () => {
    setStep('upload')
    setPreview(null)
    setSchedules([])
    setError(null)
    setImportResult({ success: 0, skipped: 0 })
    fileDataRef.current = null
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다')
      return
    }
    fileDataRef.current = file
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!fileDataRef.current) return
    setStep('processing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', fileDataRef.current)

      const res = await fetch('/api/ocr-google', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || '분석 실패')
        setStep('upload')
        return
      }

      // 기존 스케줄과 중복 체크
      const supabase = createClient()
      const weekDates = (data.schedules as RapoSchedule[]).map((s) => {
        const dateStr = `${year}-${String(data.month ?? month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
        return dateStr
      })
      const minDate = weekDates.sort()[0]
      const maxDate = weekDates.sort().reverse()[0]

      const dataMonth = `${year}-${String(data.month ?? month).padStart(2, '0')}`

      const [{ data: existing }, { data: members }] = await Promise.all([
        supabase
          .from('trainer_schedules')
          .select('member_name, scheduled_date, start_time')
          .eq('trainer_id', trainerId)
          .gte('scheduled_date', minDate)
          .lte('scheduled_date', maxDate),
        supabase
          .from('pt_members')
          .select('name')
          .eq('trainer_id', trainerId)
          .eq('data_month', dataMonth),
      ])

      const existingSet = new Set(
        (existing ?? []).map((e: { member_name: string; scheduled_date: string; start_time: string }) =>
          `${e.member_name}|${e.scheduled_date}|${e.start_time}`
        )
      )

      const memberNameSet = new Set(
        (members ?? []).map((m: { name: string }) => m.name.trim())
      )

      const mapped: ReviewItem[] = (data.schedules as RapoSchedule[]).map((s) => {
        const dateStr = `${year}-${String(data.month ?? month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
        const key = `${s.name}|${dateStr}|${s.time}`
        const exists = existingSet.has(key)
        const notRegistered = !memberNameSet.has(s.name.trim())
        return {
          ...s,
          selected: !exists && !notRegistered,
          exists,
          notRegistered,
        }
      })

      setSchedules(mapped)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류 발생')
      setStep('upload')
    }
  }

  const handleImport = async () => {
    setStep('importing')
    const supabase = createClient()
    let success = 0
    let skipped = 0

    const selected = schedules.filter((s) => s.selected)

    for (const s of selected) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
      const { error } = await supabase.from('trainer_schedules').insert({
        trainer_id: trainerId,
        schedule_type: 'PT',
        member_name: s.name,
        scheduled_date: dateStr,
        start_time: s.time,
        duration: 60,
        note: null,
      })
      if (error) {
        skipped++
      } else {
        success++
      }
    }

    setImportResult({ success, skipped })
    setStep('done')
    if (success > 0) onImported()
  }

  const toggleAll = (val: boolean) => {
    setSchedules((prev) => prev.map((s) => (s.exists || s.notRegistered) ? s : { ...s, selected: val }))
  }

  const toggleOne = (idx: number) => {
    setSchedules((prev) => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))
  }

  const selectedCount = schedules.filter((s) => s.selected).length
  const unregisteredNames = Array.from(new Set(schedules.filter((s) => s.notRegistered).map((s) => s.name)))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-500" />
            라포 스케줄 가져오기
          </DialogTitle>
          <DialogDescription>라포 앱 스케줄 화면을 캡처해서 올리면 PT 수업을 자동으로 가져옵니다</DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {preview ? (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border border-gray-200">
                  <img src={preview} alt="라포 캡처" className="w-full" />
                  <button
                    onClick={() => { setPreview(null); fileDataRef.current = null }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Button onClick={handleAnalyze} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <Upload className="h-4 w-4 mr-2" />
                  분석 시작
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) handleFile(file)
                }}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">라포 앱 스케줄 캡처를 업로드하세요</p>
                <p className="text-xs text-gray-400 mt-1">클릭 또는 드래그 앤 드롭</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-600">라포 스케줄을 분석하고 있습니다...</p>
            <p className="text-xs text-gray-400">파란색 수업 셀을 인식 중</p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">
                {schedules.length}개 PT 수업 인식됨
              </p>
              <div className="flex gap-2">
                <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">전체 선택</button>
                <button onClick={() => toggleAll(false)} className="text-xs text-gray-500 hover:underline">전체 해제</button>
              </div>
            </div>

            {unregisteredNames.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800">
                    {month}월 PT 회원 목록에 없는 이름 {unregisteredNames.length}명 — 스킵됩니다
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5 break-words">
                    {unregisteredNames.join(', ')}
                  </p>
                </div>
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {schedules.map((s, i) => {
                const dateStr = `${month}/${s.day} (${s.dayOfWeek})`
                const disabled = s.exists || s.notRegistered
                return (
                  <div
                    key={i}
                    onClick={() => !disabled && toggleOne(i)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      s.exists
                        ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                        : s.notRegistered
                          ? 'bg-amber-50 border border-amber-200 cursor-not-allowed'
                          : s.selected
                            ? 'bg-blue-50 border border-blue-200 cursor-pointer'
                            : 'bg-gray-50 border border-transparent hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      s.exists
                        ? 'border-gray-300 bg-gray-200'
                        : s.notRegistered
                          ? 'border-amber-300 bg-amber-100'
                          : s.selected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                    }`}>
                      {(s.selected || s.exists) && <Check className="h-3 w-3 text-white" />}
                      {s.notRegistered && <X className="h-3 w-3 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-bold ${s.notRegistered ? 'text-amber-800' : 'text-gray-900'}`}>{s.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{dateStr} {s.time}</span>
                    {s.exists && <Badge className="bg-gray-200 text-gray-500 text-[9px] shrink-0">이미 등록됨</Badge>}
                    {!s.exists && s.notRegistered && <Badge className="bg-amber-200 text-amber-800 text-[9px] shrink-0">미등록</Badge>}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                다시 업로드
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {selectedCount}개 가져오기
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-600">스케줄을 등록하고 있습니다...</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 'done' && (
          <div className="space-y-4 text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">가져오기 완료!</p>
              <p className="text-sm text-gray-500 mt-1">
                {importResult.success}개 등록 완료
                {importResult.skipped > 0 && ` · ${importResult.skipped}개 실패`}
              </p>
            </div>
            <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white">
              닫기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
