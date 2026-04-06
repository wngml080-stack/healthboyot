'use client'

import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Send, CheckCircle, XCircle, Plus, ImagePlus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { upsertOtProgram, submitOtProgram, approveOtProgram, rejectOtProgram } from '@/actions/ot-program'
import { getConsultationCard } from '@/actions/consultation'
import { createClient } from '@/lib/supabase/client'
import type {
  OtProgram, OtProgramSession, OtProgramExercise,
  OtProgramConsultationData, OtProgramInbodyData,
  OtAssignmentWithDetails, Profile,
} from '@/types'

const CARDIO_OPTIONS = ['러닝머신', '싸이클', '스텝퍼']

const emptySession = (): OtProgramSession => ({
  date: '', time: '',
  exercises: [
    { name: '', weight: '', sets: '' },
    { name: '', weight: '', sets: '' },
    { name: '', weight: '', sets: '' },
  ],
  tip: '', next_ot_date: '',
  cardio: { types: [], duration_min: '' },
  inbody: false, images: [], completed: false,
})

export interface OtProgramFormRef {
  saveData: () => Promise<{ error?: string }>
  markSessionCompleted: (sessionIdx: number) => void
}

interface Props {
  assignment: OtAssignmentWithDetails
  program: OtProgram | null
  profile: Profile
  onSaved?: () => void
  hideButtons?: boolean
}

const APPROVAL_BADGE: Record<string, string> = {
  '작성중': 'bg-gray-200 text-gray-700',
  '제출완료': 'bg-yellow-200 text-yellow-800',
  '승인': 'bg-green-200 text-green-800',
  '반려': 'bg-red-200 text-red-800',
}

export const OtProgramForm = forwardRef<OtProgramFormRef, Props>(function OtProgramForm({ assignment, program, profile, onSaved, hideButtons }, ref) {
  const a = assignment
  const isAdmin = ['admin', '관리자'].includes(profile.role)
  const isTrainer = profile.id === a.pt_trainer_id || profile.id === a.ppt_trainer_id
  const canEdit = (isAdmin || isTrainer) && (program?.approval_status !== '승인')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 기본 정보
  const [trainerName, setTrainerName] = useState(program?.trainer_name ?? a.pt_trainer?.name ?? '')
  const [athleticGoal, setAthleticGoal] = useState(program?.athletic_goal ?? '')
  const [totalSets, setTotalSets] = useState(program?.total_sets_per_day?.toString() ?? '')
  const [daysPerWeek, setDaysPerWeek] = useState(program?.recommended_days_per_week?.toString() ?? '')
  const [durationMin, setDurationMin] = useState(program?.exercise_duration_min?.toString() ?? '')
  const [targetHR, setTargetHR] = useState(program?.target_heart_rate?.toString() ?? '')
  const [startDate, setStartDate] = useState(program?.member_start_date ?? a.member.start_date ?? '')
  const [endDate, setEndDate] = useState(program?.member_end_date ?? '')

  // 상담카드 데이터 — program에 있으면 사용, 없으면 빈 값 (서버에서 자동 채움)
  const [consultation, setConsultation] = useState<OtProgramConsultationData>(
    program?.consultation_data?.exercise_goals?.length
      ? program.consultation_data
      : { exercise_goals: [], exercise_goal_detail: null, body_correction_area: null, medical_conditions: [], medical_detail: null, surgery_detail: null, exercise_experiences: [], exercise_experience_history: null, exercise_duration: null, exercise_personality: [], desired_body_type: null }
  )

  // 상담카드가 비어있으면 직접 가져오기
  useEffect(() => {
    if (consultation.exercise_goals.length === 0 && consultation.medical_conditions.length === 0) {
      getConsultationCard(a.member_id).then((card) => {
        if (card) {
          setConsultation({
            exercise_goals: card.exercise_goals ?? [],
            exercise_goal_detail: card.exercise_goal_detail ?? null,
            body_correction_area: card.body_correction_area ?? null,
            medical_conditions: card.medical_conditions ?? [],
            medical_detail: card.medical_detail,
            surgery_detail: card.surgery_detail,
            exercise_experiences: card.exercise_experiences ?? [],
            exercise_experience_history: card.exercise_experience_history ?? null,
            exercise_duration: card.exercise_duration,
            exercise_personality: card.exercise_personality ?? [],
            desired_body_type: card.desired_body_type,
          })
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.member_id])

  // 인바디
  const [inbody, setInbody] = useState<OtProgramInbodyData>(program?.inbody_data ?? {
    current_weight: '', target_weight: '', current_body_fat: '', target_body_fat: '',
    current_muscle_mass: '', target_muscle_mass: '', current_bmr: '', target_bmr: '',
  })

  // 세션 초기화: ot_sessions 기반으로 필요한 만큼 세션 생성
  const [sessions, setSessions] = useState<OtProgramSession[]>(() => {
    const programSessions = program?.sessions?.length ? [...program.sessions] : []

    // ot_sessions에서 최대 세션 번호 확인
    const maxOtSession = Math.max(0, ...(a.sessions?.map((s) => s.session_number) ?? []))
    // 최소한 maxOtSession 개수만큼 세션 필요, 최소 1개
    const needed = Math.max(1, maxOtSession, programSessions.length)

    // 부족한 세션 채우기
    while (programSessions.length < needed) {
      programSessions.push(emptySession())
    }

    // ot_sessions의 completed_at 동기화
    return programSessions.map((s, idx) => {
      const otSession = a.sessions?.find((os) => os.session_number === idx + 1)
      const isCompleted = !!otSession?.completed_at
      return {
        ...emptySession(),
        ...s,
        completed: isCompleted,
        // ot_session에서 날짜/시간 채우기 (프로그램에 없으면)
        date: s.date || (otSession?.scheduled_at ? new Date(otSession.scheduled_at).toISOString().split('T')[0] : ''),
        time: s.time || (otSession?.scheduled_at ? new Date(otSession.scheduled_at).toTimeString().slice(0, 5) : ''),
      }
    })
  })

  // 완료 펼침 토글
  const [expandedCompleted, setExpandedCompleted] = useState<number | null>(null)

  // ref로 외부에서 저장/완료마킹 가능
  useImperativeHandle(ref, () => ({
    saveData: async () => {
      const result = await upsertOtProgram(a.id, a.member_id, {
        trainer_name: trainerName || null,
        athletic_goal: athleticGoal || null,
        total_sets_per_day: totalSets ? Number(totalSets) : null,
        recommended_days_per_week: daysPerWeek ? Number(daysPerWeek) : null,
        exercise_duration_min: durationMin ? Number(durationMin) : null,
        target_heart_rate: targetHR ? Number(targetHR) : null,
        member_start_date: startDate || null,
        member_end_date: endDate || null,
        sessions: sessions as unknown as OtProgramSession[],
        inbody_data: inbody,
        consultation_data: consultation,
      })
      if (result.error) return { error: result.error }
      return {}
    },
    markSessionCompleted: (sessionIdx: number) => {
      setSessions((prev) => {
        const copy = [...prev]
        // 부족하면 추가
        while (copy.length <= sessionIdx) copy.push(emptySession())
        copy[sessionIdx] = { ...copy[sessionIdx], completed: true }
        return copy
      })
    },
  }))

  // 반려
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [uploading, setUploading] = useState(false)

  const updateSession = useCallback((idx: number, field: keyof OtProgramSession, value: unknown) => {
    setSessions((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }, [])

  const updateExercise = useCallback((sIdx: number, eIdx: number, field: keyof OtProgramExercise, value: string) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s
      const exCopy = [...s.exercises]
      exCopy[eIdx] = { ...exCopy[eIdx], [field]: value }
      return { ...s, exercises: exCopy }
    }))
  }, [])

  const addExercise = useCallback((sIdx: number) => {
    setSessions((prev) => prev.map((s, i) =>
      i === sIdx ? { ...s, exercises: [...s.exercises, { name: '', weight: '', sets: '' }] } : s
    ))
  }, [])

  const toggleCardio = useCallback((sIdx: number, type: string) => {
    setSessions((prev) => prev.map((s, i) => {
      if (i !== sIdx) return s
      const types = s.cardio.types.includes(type)
        ? s.cardio.types.filter((t) => t !== type)
        : [...s.cardio.types, type]
      return { ...s, cardio: { ...s.cardio, types } }
    }))
  }, [])

  const addSession = () => setSessions((prev) => [...prev, emptySession()])

  const handleImageUpload = async (sessionIdx: number, files: FileList) => {
    setUploading(true)
    const supabase = createClient()
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${a.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('ot-images').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('ot-images').getPublicUrl(path)
        uploaded.push(urlData.publicUrl)
      }
    }
    setSessions((prev) => prev.map((s, i) =>
      i === sessionIdx ? { ...s, images: [...(s.images || []), ...uploaded] } : s
    ))
    setUploading(false)
  }

  const removeImage = (sessionIdx: number, imgIdx: number) => {
    setSessions((prev) => prev.map((s, i) =>
      i === sessionIdx ? { ...s, images: s.images.filter((_, j) => j !== imgIdx) } : s
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const result = await upsertOtProgram(a.id, a.member_id, {
      trainer_name: trainerName || null,
      athletic_goal: athleticGoal || null,
      total_sets_per_day: totalSets ? Number(totalSets) : null,
      recommended_days_per_week: daysPerWeek ? Number(daysPerWeek) : null,
      exercise_duration_min: durationMin ? Number(durationMin) : null,
      target_heart_rate: targetHR ? Number(targetHR) : null,
      member_start_date: startDate || null,
      member_end_date: endDate || null,
      sessions: sessions as unknown as OtProgramSession[],
      inbody_data: inbody,
      consultation_data: consultation,
    })
    setSaving(false)
    if (result.error) setError(result.error)
    else {
      setSuccess(true)
      // 저장 후 상담카드 데이터가 채워졌을 수 있으므로 갱신
      setTimeout(() => setSuccess(false), 3000)
      onSaved?.()
    }
  }

  // 저장 후 상담카드 데이터 갱신 (서버에서 채워줬을 수 있음)
  useEffect(() => {
    if (program?.consultation_data?.exercise_goals?.length) {
      setConsultation(program.consultation_data)
    }
  }, [program?.consultation_data])

  const handleSubmit = async () => {
    await handleSave()
    if (!program?.id) return
    setSaving(true)
    const result = await submitOtProgram(program.id)
    setSaving(false)
    if (result.error) setError(result.error)
    else onSaved?.()
  }

  const handleApprove = async () => {
    if (!program?.id) return
    setSaving(true)
    await approveOtProgram(program.id)
    setSaving(false)
    onSaved?.()
  }

  const handleReject = async () => {
    if (!program?.id || !rejectReason) return
    setSaving(true)
    await rejectOtProgram(program.id, rejectReason)
    setSaving(false)
    setShowRejectInput(false)
    onSaved?.()
  }

  const approvalStatus = program?.approval_status ?? '작성중'

  // 현재 활성 세션 (첫 번째 미완료 세션)
  const activeSessionIdx = sessions.findIndex((s) => !s.completed)

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
        <div className="bg-blue-50 border-b-2 border-blue-400 px-4 py-3 text-center">
          <h2 className="text-xl font-black text-gray-900">ORIENTATION PROGRAM</h2>
          <Badge className={`mt-1 ${APPROVAL_BADGE[approvalStatus]}`}>{approvalStatus}</Badge>
          {program?.rejection_reason && (
            <p className="mt-1 text-xs text-red-600">반려사유: {program.rejection_reason}</p>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* 회원 기본정보 (수정불가) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs">회원이름:</Label>
              <Input value={a.member.name} disabled className="h-7 text-sm bg-gray-100" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap font-bold text-xs">성별:</Label>
              <span className={`text-sm ${a.member.gender === '남' ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                {a.member.gender === '남' ? '☑' : '☐'} 남
              </span>
              <span className={`text-sm ${a.member.gender === '여' ? 'font-bold text-pink-600' : 'text-gray-400'}`}>
                {a.member.gender === '여' ? '☑' : '☐'} 여
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs">시작일:</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-7 text-sm" disabled={!canEdit} />
            </div>
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs">만료일:</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-7 text-sm" disabled={!canEdit} />
            </div>
          </div>

          {/* 담당자 (수정불가) */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs text-orange-600">FC:</Label>
              <Input value={a.member.creator_name ?? '-'} disabled className="h-7 text-sm bg-gray-100" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs text-blue-600">PT:</Label>
              <Input value={a.pt_trainer?.name ?? '미배정'} disabled className="h-7 text-sm bg-gray-100" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="whitespace-nowrap font-bold text-xs text-purple-600">PPT:</Label>
              <Input value={a.ppt_trainer?.name ?? '미배정'} disabled className="h-7 text-sm bg-gray-100" />
            </div>
          </div>

          {/* 운동목표 */}
          <div className="flex items-center gap-1 text-sm">
            <Label className="whitespace-nowrap font-bold text-xs">운동목표:</Label>
            <Input value={athleticGoal} onChange={(e) => setAthleticGoal(e.target.value)} className="h-7 text-sm flex-1" disabled={!canEdit} />
          </div>
        </div>
      </div>

      {/* 상담카드 연동 정보 */}
      {consultation.exercise_goals.length > 0 || consultation.medical_conditions.length > 0 ? (
        <Card className="border border-amber-300 bg-amber-50/50">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm text-amber-800">상담카드 정보 (자동연동)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1 text-xs">
            {consultation.exercise_goals.length > 0 && (
              <p><span className="font-bold">운동목적:</span> {consultation.exercise_goals.join(', ')}
                {consultation.exercise_goal_detail ? ` — ${consultation.exercise_goal_detail}` : ''}
              </p>
            )}
            {consultation.body_correction_area && <p><span className="font-bold">체형교정 부위:</span> {consultation.body_correction_area}</p>}
            {consultation.medical_conditions.length > 0 && <p><span className="font-bold">병력:</span> {consultation.medical_conditions.join(', ')}{consultation.medical_detail ? ` (${consultation.medical_detail})` : ''}</p>}
            {consultation.surgery_detail && <p><span className="font-bold">수술이력:</span> {consultation.surgery_detail}</p>}
            {consultation.exercise_experiences.length > 0 && (
              <p><span className="font-bold">운동경험:</span> {consultation.exercise_experiences.join(', ')}{consultation.exercise_duration ? ` / ${consultation.exercise_duration}` : ''}
                {consultation.exercise_experience_history ? ` — ${consultation.exercise_experience_history}` : ''}
              </p>
            )}
            {consultation.desired_body_type && <p><span className="font-bold">원하는 체형:</span> {consultation.desired_body_type}</p>}
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">상담카드를 먼저 작성하면 자동으로 연동됩니다</p>
      )}

      {/* 인바디 */}
      <Card>
        <CardHeader className="py-2 px-4">
          <CardTitle className="text-sm">Inbody 분석</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {([
              { label: '체중', key: 'current_weight', tKey: 'target_weight', unit: 'kg' },
              { label: '체지방량', key: 'current_body_fat', tKey: 'target_body_fat', unit: 'kg' },
              { label: '근육량', key: 'current_muscle_mass', tKey: 'target_muscle_mass', unit: 'kg' },
              { label: '기초대사량', key: 'current_bmr', tKey: 'target_bmr', unit: 'kcal' },
            ] as const).map(({ label, key, tKey, unit }) => (
              <div key={key} className="flex items-center gap-1 text-xs">
                <span className="font-bold w-14 text-right">{label}:</span>
                <Input value={inbody[key]} onChange={(e) => setInbody({ ...inbody, [key]: e.target.value })} className="w-14 h-6 text-xs text-right" inputMode="decimal" disabled={!canEdit} />
                <span className="text-gray-400">→</span>
                <Input value={inbody[tKey]} onChange={(e) => setInbody({ ...inbody, [tKey]: e.target.value })} className="w-14 h-6 text-xs text-right" inputMode="decimal" disabled={!canEdit} />
                <span className="text-gray-400">{unit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 세션들 */}
      {sessions.map((session, idx) => {
        const isCompleted = session.completed
        const isExpanded = expandedCompleted === idx
        const hasContent = session.exercises?.some((e) => e.name) || session.tip

        return (
          <Card key={idx} className={`border-2 ${isCompleted ? 'border-green-400 bg-green-50/30' : idx === activeSessionIdx ? 'border-blue-400' : 'border-gray-300'}`}>
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {idx + 1}차 OT
                  {isCompleted && <Badge className="bg-green-500 text-white text-xs">완료</Badge>}
                  {idx === activeSessionIdx && !isCompleted && <Badge className="bg-blue-500 text-white text-xs">현재</Badge>}
                </CardTitle>
                {isCompleted && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpandedCompleted(isExpanded ? null : idx)}>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {isExpanded ? '접기' : '내용 보기'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {/* 완료된 세션: 요약 + 펼치기 */}
              {isCompleted && !isExpanded ? (
                <div className="text-sm text-gray-500">
                  {session.date && <span>{session.date} {session.time}</span>}
                  {hasContent && <span className="ml-2">— {session.exercises.filter((e) => e.name).map((e) => e.name).join(', ')}</span>}
                  {!hasContent && !session.date && <span className="text-gray-400">내용 없음 (내용 보기로 확인)</span>}
                </div>
              ) : (
                /* 편집 가능 영역 (완료 세션도 펼치면 볼 수 있음, 미완료는 항상 표시) */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs font-bold">날짜:</Label>
                      <Input type="date" value={session.date} onChange={(e) => updateSession(idx, 'date', e.target.value)} className="h-7 text-sm" disabled={!canEdit || (isCompleted && !isExpanded)} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs font-bold">시간:</Label>
                      <Input type="time" value={session.time} onChange={(e) => updateSession(idx, 'time', e.target.value)} className="h-7 text-sm" disabled={!canEdit || (isCompleted && !isExpanded)} />
                    </div>
                  </div>

                  {/* 운동 */}
                  <div>
                    <div className="grid grid-cols-[1fr_60px_60px] gap-1 text-xs text-center text-gray-500 mb-1">
                      <span>운동명</span><span>무게(kg)</span><span>세트</span>
                    </div>
                    {session.exercises.map((ex, eIdx) => (
                      <div key={eIdx} className="grid grid-cols-[1fr_60px_60px] gap-1 mb-1">
                        <Input value={ex.name} onChange={(e) => updateExercise(idx, eIdx, 'name', e.target.value)} className="h-7 text-sm" placeholder={`운동 ${eIdx + 1}`} disabled={!canEdit} />
                        <Input value={ex.weight} onChange={(e) => updateExercise(idx, eIdx, 'weight', e.target.value)} className="h-7 text-sm text-center" disabled={!canEdit} />
                        <Input value={ex.sets} onChange={(e) => updateExercise(idx, eIdx, 'sets', e.target.value)} className="h-7 text-sm text-center" disabled={!canEdit} />
                      </div>
                    ))}
                    {canEdit && !isCompleted && (
                      <button type="button" className="w-full rounded border border-dashed border-gray-300 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600" onClick={() => addExercise(idx)}>
                        + 종목 추가
                      </button>
                    )}
                  </div>

                  {/* Tip */}
                  <div>
                    <Label className="text-xs font-bold text-red-600">Tip:</Label>
                    <Textarea value={session.tip} onChange={(e) => updateSession(idx, 'tip', e.target.value)} className="text-sm min-h-[50px] mt-1" placeholder="트레이너 팁" disabled={!canEdit} />
                  </div>

                  {/* 유산소 */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs font-bold">유산소:</Label>
                    {CARDIO_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-1 text-sm cursor-pointer">
                        <Checkbox checked={session.cardio.types.includes(opt)} onCheckedChange={() => toggleCardio(idx, opt)} disabled={!canEdit} />
                        {opt}
                      </label>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={session.cardio.duration_min}
                        onChange={(e) => setSessions((prev) => prev.map((s, i) => i === idx ? { ...s, cardio: { ...s.cardio, duration_min: e.target.value } } : s))}
                        className="h-6 text-xs w-14" placeholder="분" disabled={!canEdit}
                      />
                      <span className="text-xs">분</span>
                    </div>
                  </div>

                  {/* 인바디 체크 */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={session.inbody} onCheckedChange={(v) => updateSession(idx, 'inbody', !!v)} disabled={!canEdit} />
                    <span className="text-sm font-bold">인바디 측정</span>
                  </label>

                  {/* 이미지 */}
                  <div>
                    <Label className="text-xs font-bold">이미지</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {(session.images || []).map((img, imgIdx) => (
                        <div key={imgIdx} className="relative">
                          <img src={img} alt="" className="w-20 h-20 object-cover rounded border" />
                          {canEdit && (
                            <button type="button" className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" onClick={() => removeImage(idx, imgIdx)}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {canEdit && !isCompleted && (
                        <label className="w-20 h-20 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 text-gray-400 hover:text-blue-500">
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-[10px] mt-0.5">{uploading ? '...' : '추가'}</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImageUpload(idx, e.target.files)} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* 세션 추가 */}
      {canEdit && (
        <button type="button" className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-1" onClick={addSession}>
          <Plus className="h-4 w-4" />
          {sessions.length + 1}차 OT 추가
        </button>
      )}

      {/* 메시지 */}
      {(error || success) && (
        <div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">저장되었습니다!</p>}
        </div>
      )}

      {/* 하단 버튼 */}
      {!hideButtons && (
        <div className="flex flex-wrap items-center justify-end gap-2 pb-4">
          {canEdit && (
            <>
              <Button onClick={handleSave} disabled={saving} variant="outline">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                저장
              </Button>
              {(approvalStatus === '작성중' || approvalStatus === '반려') && program?.id && (
                <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Send className="h-4 w-4 mr-2" />
                  관리자에게 제출
                </Button>
              )}
            </>
          )}
          {isAdmin && approvalStatus === '제출완료' && (
            <>
              <Button onClick={handleApprove} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" />승인
              </Button>
              {!showRejectInput ? (
                <Button onClick={() => setShowRejectInput(true)} disabled={saving} variant="destructive">
                  <XCircle className="h-4 w-4 mr-2" />반려
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="반려 사유" className="h-9 text-sm w-48" />
                  <Button onClick={handleReject} disabled={saving || !rejectReason} variant="destructive" size="sm">확인</Button>
                  <Button onClick={() => setShowRejectInput(false)} variant="ghost" size="sm">취소</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
})
