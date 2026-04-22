'use client'

import { useState, useCallback, useImperativeHandle, forwardRef, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, Loader2, Send, CheckCircle, Plus, ImagePlus, X, ChevronDown, ChevronUp, Download, Share2 } from 'lucide-react'
import { upsertOtProgram, submitOtSession, unsubmitOtSession } from '@/actions/ot-program'
import { upsertOtSession } from '@/actions/ot'
import { ensureShareToken } from '@/actions/ot-signing'
import { SessionShareCard } from './session-share-card'
import { getConsultationCard } from '@/actions/consultation'
import { createClient } from '@/lib/supabase/client'
import type {
  OtProgram, OtProgramSession, OtProgramExercise,
  OtProgramConsultationData, OtProgramInbodyData,
  OtAssignmentWithDetails, Profile,
  OtSessionPlanDetail, OtSessionPlanRoadmapItem,
  ConsultationCard,
} from '@/types'

const CARDIO_OPTIONS = ['러닝머신', '싸이클', '스텝퍼']

function addMonthsYMD(ymd: string, months: number): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1 + months, d)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function addDaysYMD(ymd: string, days: number): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const emptySession = (): OtProgramSession => ({
  date: '', time: '',
  exercises: [
    { name: '', weight: '', reps: '', sets: '' },
    { name: '', weight: '', reps: '', sets: '' },
    { name: '', weight: '', reps: '', sets: '' },
  ],
  tip: '', next_ot_date: '',
  cardio: { types: [], duration_min: '' },
  inbody: false, images: [], completed: false,
  approval_status: '작성중', submitted_at: null, approved_at: null, approved_by: null, rejection_reason: null, admin_feedback: null,
  plan: '',
  plan_detail: null,
  result_category: null, result_note: '',
})

export interface OtProgramFormRef {
  saveData: () => Promise<{ error?: string }>
  markSessionCompleted: (sessionIdx: number) => void
  isDirty: () => boolean
}

interface Props {
  assignment: OtAssignmentWithDetails
  program: OtProgram | null
  profile: Profile
  onSaved?: () => void
  hideButtons?: boolean
  hideSessionList?: boolean
  completingSessionIdx?: number | null
  onCompleteSession?: (idx: number) => Promise<void> | void
  completeLoading?: boolean
}

export const OtProgramForm = forwardRef<OtProgramFormRef, Props>(function OtProgramForm({ assignment, program, profile, onSaved, hideButtons, hideSessionList, completingSessionIdx, onCompleteSession, completeLoading }, ref) {
  const a = assignment
  const isAdmin = ['admin', '관리자'].includes(profile.role)
  const isTrainer = profile.id === a.pt_trainer_id || profile.id === a.ppt_trainer_id
  // 프로그램 전체 승인 여부와 무관하게 트레이너/관리자는 편집 가능 — 세션별 잠금은 isSessionLocked로 개별 체크
  const canEdit = isAdmin || isTrainer
  const isSessionLocked = (s: OtProgramSession) => s.approval_status === '승인'

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 기본 정보
  const [trainerName] = useState(program?.trainer_name ?? a.pt_trainer?.name ?? '')
  const [athleticGoal, setAthleticGoal] = useState(program?.athletic_goal ?? '')
  const [totalSets] = useState(program?.total_sets_per_day?.toString() ?? '')
  const [daysPerWeek] = useState(program?.recommended_days_per_week?.toString() ?? '')
  const [durationMin] = useState(program?.exercise_duration_min?.toString() ?? '')
  const [targetHR] = useState(program?.target_heart_rate?.toString() ?? '')
  const [startDate, setStartDate] = useState(program?.member_start_date ?? a.member.start_date ?? '')
  const [endDate, setEndDate] = useState(program?.member_end_date ?? '')
  const [durationValue] = useState<string>('')
  const [durationUnit] = useState<'month' | 'day'>('month')

  // 상담카드 데이터 — program에 있으면 사용, 없으면 빈 값 (서버에서 자동 채움)
  const [consultation, setConsultation] = useState<OtProgramConsultationData>(
    program?.consultation_data?.exercise_goals?.length
      ? program.consultation_data
      : { exercise_goals: [], exercise_goal_detail: null, body_correction_area: null, medical_conditions: [], medical_detail: null, surgery_detail: null, exercise_experiences: [], exercise_experience_history: null, exercise_duration: null, exercise_personality: [], desired_body_type: null }
  )

  // 상담카드 전체 필드 (읽기 전용 표시용)
  const [fullCard, setFullCard] = useState<ConsultationCard | null>(null)

  // 상담카드 1번만 fetch — 읽기용 + 빈 consultation 채우기 양쪽에 사용
  useEffect(() => {
    const needsFill = consultation.exercise_goals.length === 0 && consultation.medical_conditions.length === 0
    getConsultationCard(a.member_id).then((card) => {
      if (!card) return
      setFullCard(card)
      if (needsFill) {
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
      if (!startDate && card.exercise_start_date) setStartDate(card.exercise_start_date)
      setAthleticGoal((prev) => {
        if (prev) return prev
        const goals = card.exercise_goals ?? []
        if (!goals.length) return prev
        return goals.join(', ') + (card.exercise_goal_detail ? ` — ${card.exercise_goal_detail}` : '')
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.member_id])

  // 기간 선택 시 운동시작일 + N개월/일로 만료일 자동 계산
  useEffect(() => {
    const n = Number(durationValue)
    if (!n || n < 1) return
    const base = startDate || fullCard?.exercise_start_date
    if (!base) return
    setEndDate(durationUnit === 'month' ? addMonthsYMD(base, n) : addDaysYMD(base, n))
  }, [durationValue, durationUnit, startDate, fullCard?.exercise_start_date])

  // 인바디
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [inbody, _setInbody] = useState<OtProgramInbodyData>(program?.inbody_data ?? {
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

  // 세션 접기/펼치기 — completingSessionIdx 또는 활성 세션만 열림
  const [openSessionIdx, setOpenSessionIdx] = useState<number>(() => {
    if (typeof completingSessionIdx === 'number') return completingSessionIdx
    const initial = program?.sessions ?? []
    const activeIdx = initial.findIndex((s) => !s.completed)
    return activeIdx >= 0 ? activeIdx : 0
  })
  // completingSessionIdx 변경 시 해당 세션 열기
  useEffect(() => {
    if (typeof completingSessionIdx === 'number') setOpenSessionIdx(completingSessionIdx)
  }, [completingSessionIdx])
  const collapsedSessions = new Set(sessions.map((_, i) => i).filter((i) => i !== openSessionIdx))
  const toggleSessionCollapse = (idx: number) => {
    setOpenSessionIdx((prev) => prev === idx ? -1 : idx)
  }

  // 이미지 확대 보기 (Lightbox)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

  // 저장 payload를 한 곳에서 구성 (5곳에서 중복 제거)
  const buildSavePayload = useCallback(() => ({
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
  }), [trainerName, athleticGoal, totalSets, daysPerWeek, durationMin, targetHR, startDate, endDate, sessions, inbody, consultation])

  // 마지막 저장 시점의 payload 스냅샷
  const lastSavedRef = useRef(JSON.stringify(buildSavePayload()))

  // ref로 외부에서 저장/완료마킹/dirty체크 가능
  useImperativeHandle(ref, () => ({
    saveData: async () => {
      const payload = buildSavePayload()
      const result = await upsertOtProgram(a.id, a.member_id, payload)
      if (result.error) return { error: result.error }
      lastSavedRef.current = JSON.stringify(payload)
      return {}
    },
    isDirty: () => JSON.stringify(buildSavePayload()) !== lastSavedRef.current,
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

  const [uploading, setUploading] = useState(false)

  const captureRef = useRef<HTMLDivElement>(null)
  const sessionRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const shareCardRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [sharing, setSharing] = useState(false)
  const [signOpening, setSignOpening] = useState(false)

  // 서명 완료 수신 (BroadcastChannel) → 세션에 반영 + 자동 저장
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const buildPayloadRef = useRef(buildSavePayload)
  buildPayloadRef.current = buildSavePayload

  useEffect(() => {
    const channel = new BroadcastChannel('ot-signature')
    channel.onmessage = async (e) => {
      if (e.data?.type !== 'signature-complete') return
      const { sessionIdx: sigIdx, signatureUrl, signerName: sName } = e.data
      if (typeof sigIdx !== 'number' || !signatureUrl) return
      const signedAt = new Date().toISOString()
      // 세션에 서명 데이터 반영
      setSessions((prev) => prev.map((s, i) =>
        i === sigIdx ? { ...s, signature_url: signatureUrl, signer_name: sName, signed_at: signedAt } : s,
      ))
      // 최신 sessions로 payload 구성 후 저장
      const currentSessions = sessionsRef.current.map((s, i) =>
        i === sigIdx ? { ...s, signature_url: signatureUrl, signer_name: sName, signed_at: signedAt } : s,
      )
      const payload = buildPayloadRef.current()
      await upsertOtProgram(a.id, a.member_id, { ...payload, sessions: currentSessions as unknown as OtProgramSession[] })
      onSaved?.()
    }
    return () => channel.close()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, a.member_id])

  const openMemberSignPage = async (sessionIdx: number) => {
    setSignOpening(true)
    try {
      let programId = program?.id
      // 프로그램이 아직 없으면 자동 저장해서 생성
      if (!programId) {
        const saveRes = await upsertOtProgram(a.id, a.member_id, buildSavePayload())
        if (saveRes?.error || !saveRes?.data) {
          alert('프로그램 자동 저장에 실패했습니다: ' + (saveRes?.error ?? '알 수 없는 오류'))
          return
        }
        programId = (saveRes.data as { id: string }).id
        onSaved?.()
      }
      const token = await ensureShareToken(programId)
      if (!token) {
        alert('서명 링크를 만들 수 없습니다. 관리자에게 문의하세요.')
        return
      }
      const url = `${window.location.origin}/sign/${token}/${sessionIdx}`
      window.open(url, '_blank', 'noopener')
    } finally {
      setSignOpening(false)
    }
  }

  const handleShareSession = async (sessionIdx: number) => {
    setSharing(true)
    try {
      let programId = program?.id
      if (!programId) {
        const saveRes = await upsertOtProgram(a.id, a.member_id, buildSavePayload())
        if (saveRes?.error || !saveRes?.data) {
          alert('프로그램 자동 저장에 실패했습니다: ' + (saveRes?.error ?? '알 수 없는 오류'))
          return
        }
        programId = (saveRes.data as { id: string }).id
        onSaved?.()
      }
      const token = await ensureShareToken(programId)
      if (!token) {
        alert('공유 링크를 만들 수 없습니다.')
        return
      }
      const signUrl = `${window.location.origin}/sign/${token}/${sessionIdx}`
      const shareTitle = `${a.member.name}님 ${sessionIdx + 1}차 OT 수업 내용`
      const shareText = `${shareTitle}\n\n아래 링크에서 수업 내용을 확인하고 서명해주세요:\n${signUrl}`

      const kakao = (window as unknown as { Kakao?: { isInitialized: () => boolean; Share?: { sendDefault: (opts: unknown) => void } } }).Kakao
      if (kakao?.isInitialized?.() && kakao.Share) {
        kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: shareTitle,
            description: `${a.member.name}님, 아래 버튼으로 ${sessionIdx + 1}차 OT 수업 내용을 확인하고 서명해주세요.`,
            imageUrl: `${window.location.origin}/api/icon?size=512`,
            link: { mobileWebUrl: signUrl, webUrl: signUrl },
          },
          buttons: [
            { title: '수업 내용 보기 · 서명하기', link: { mobileWebUrl: signUrl, webUrl: signUrl } },
          ],
        })
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: signUrl })
      } else {
        await navigator.clipboard?.writeText(shareText).catch(() => {})
        alert(`링크가 클립보드에 복사되었습니다. 카카오톡으로 회원님께 전송해주세요.\n\n${signUrl}`)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('세션 공유 실패', err)
        alert('공유에 실패했습니다.')
      }
    } finally {
      setSharing(false)
    }
  }

  const handleCapture = async () => {
    if (!captureRef.current) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      const link = document.createElement('a')
      link.download = `OT_프로그램_${a.member.name}_${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('OT 이미지 저장 실패', err)
      alert('이미지 저장에 실패했습니다.')
    }
  }

  const handleShare = async () => {
    if (!captureRef.current) return
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `OT_${a.member.name}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${a.member.name} OT 프로그램`,
          files: [file],
        })
      } else {
        handleCapture()
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleCapture()
      }
    }
  }

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
      i === sIdx ? { ...s, exercises: [...s.exercises, { name: '', weight: '', reps: '', sets: '' }] } : s
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

  const handleImageUpload = async (sessionIdx: number, files: FileList, defaultLabel: 'before' | 'after' | null = null) => {
    setUploading(true)
    const supabase = createClient()
    const records: { url: string; uploaded_at: string; label: 'before' | 'after' | null }[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${a.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('ot-images').upload(path, file)
      if (error) {
        errors.push(error.message)
        continue
      }
      const { data: urlData } = supabase.storage.from('ot-images').getPublicUrl(path)
      records.push({ url: urlData.publicUrl, uploaded_at: new Date().toISOString(), label: defaultLabel })
    }
    setSessions((prev) => prev.map((s, i) =>
      i === sessionIdx
        ? {
            ...s,
            images: [...(s.images || []), ...records.map((r) => r.url)],
            image_records: [...(s.image_records ?? []), ...records],
          }
        : s,
    ))
    setUploading(false)
    if (errors.length) alert(`이미지 업로드 실패 (${errors.length}건): ${errors[0]}\n\n'ot-images' 스토리지 버킷과 Public 업로드 권한을 Supabase 대시보드에서 확인해주세요.`)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    const payload = buildSavePayload()
    const result = await upsertOtProgram(a.id, a.member_id, payload)
    setSaving(false)
    if (result.error) setError(result.error)
    else {
      lastSavedRef.current = JSON.stringify(payload)
      setSuccess(true)
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

  const handleSubmitSession = async (sessionIdx: number) => {
    const otSession = a.sessions?.find((s) => s.session_number === sessionIdx + 1)
    if (!otSession?.completed_at && !isAdmin) {
      alert(`${sessionIdx + 1}차 OT 수업이 완료되지 않았습니다.\n수업 완료 후 제출해주세요.`)
      return
    }
    const sessionData = sessions[sessionIdx]
    if (!sessionData?.signature_url && !isAdmin) {
      alert(`회원 서명이 필요합니다.\n서명을 먼저 받아주세요.`)
      return
    }
    setSaving(true)
    setError(null)
    const saveResult = await upsertOtProgram(a.id, a.member_id, buildSavePayload())
    if (saveResult.error) {
      setSaving(false)
      setError(saveResult.error)
      return
    }
    const programId = program?.id ?? (saveResult.data as { id?: string } | undefined)?.id
    if (!programId) {
      setSaving(false)
      setError('프로그램 ID를 찾을 수 없습니다.')
      return
    }
    const result = await submitOtSession(programId, sessionIdx)
    setSaving(false)
    if (result.error) setError(result.error)
    else {
      setSessions((prev) => prev.map((s, i) =>
        i === sessionIdx ? { ...s, approval_status: '제출완료', submitted_at: new Date().toISOString(), rejection_reason: null } : s,
      ))
      onSaved?.()
    }
  }

  // 현재 활성 세션 (첫 번째 미완료 세션)
  const activeSessionIdx = sessions.findIndex((s) => !s.completed)

  return (
    <div ref={captureRef} className="space-y-4">
      {/* 헤더 */}
      <div className="border-2 border-blue-400 rounded-lg overflow-hidden">
        <div className="bg-blue-50 border-b-2 border-blue-400 px-4 py-3 text-center">
          <h2 className="text-xl font-black text-gray-900">ORIENTATION PROGRAM</h2>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
            {sessions.map((s, i) => {
              if (!s.approval_status || s.approval_status === '작성중') return null
              const color = s.approval_status === '승인' ? 'bg-green-600 text-white'
                : s.approval_status === '반려' ? 'bg-red-500 text-white'
                : 'bg-yellow-500 text-white'
              return <Badge key={i} className={`${color} text-[10px]`}>{i + 1}차 {s.approval_status}</Badge>
            })}
            {a.is_sales_target && <Badge className="bg-blue-600 text-white text-[10px]">매출대상자</Badge>}
            {a.is_pt_conversion && <Badge className="bg-purple-600 text-white text-[10px]">PT전환</Badge>}
            {a.sales_status && <Badge className="bg-gray-600 text-white text-[10px]">{a.sales_status}</Badge>}
          </div>
          {program?.rejection_reason && (
            <p className="mt-1 text-xs text-red-600">반려사유: {program.rejection_reason}</p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Row 1: 회원 기본 (스택 레이아웃) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 text-sm">
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">회원이름</Label>
              <Input value={a.member.name} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">성별</Label>
              {(() => {
                const gender = a.member.gender || fullCard?.member_gender || null
                return (
                  <div className="h-8 flex items-center gap-3">
                    <span className={`text-sm ${gender === '남' ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                      {gender === '남' ? '☑' : '☐'} 남
                    </span>
                    <span className={`text-sm ${gender === '여' ? 'font-bold text-pink-600' : 'text-gray-400'}`}>
                      {gender === '여' ? '☑' : '☐'} 여
                    </span>
                  </div>
                )
              })()}
            </div>
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">나이</Label>
              <Input value={fullCard?.age ?? '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">연락처</Label>
              <Input value={fullCard?.member_phone ?? a.member.phone ?? '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
          </div>

          {/* Row 2: 일정 (상담일 / 운동시작일 / 기간 / 만료일) — 상담카드 데이터 읽기 전용 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 text-sm">
            <div>
              <Label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">상담일</Label>
              <Input value={fullCard?.consultation_date ?? '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">운동시작일</Label>
              <Input value={fullCard?.exercise_start_date || startDate || '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">등록상품</Label>
              <Input value={fullCard?.registration_product || '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">만료일</Label>
              <Input value={fullCard?.expiry_date || endDate || '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
          </div>

          {/* Row 3: 담당자 (FC = 상담 담당자) — 스택 레이아웃 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-3 text-sm">
            <div>
              <Label className="block text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">FC</Label>
              <Input value={fullCard?.fc_name ?? a.member.creator_name ?? '-'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">PT</Label>
              <Input value={a.pt_trainer?.name ?? '미배정'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
            <div>
              <Label className="block text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">PPT</Label>
              <Input value={a.ppt_trainer?.name ?? '미배정'} disabled className="h-8 text-sm bg-gray-100" />
            </div>
          </div>

          {/* Row 4: 운동목적 (상담카드 자동 프리필, 편집 가능) — 스택 레이아웃 */}
          <div>
            <Label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">운동목적</Label>
            <Input
              value={athleticGoal}
              onChange={(e) => setAthleticGoal(e.target.value)}
              placeholder={fullCard?.exercise_goals?.length ? fullCard.exercise_goals.join(', ') + (fullCard.exercise_goal_detail ? ` — ${fullCard.exercise_goal_detail}` : '') : '운동목적 입력'}
              className="h-8 text-sm"
              disabled={!canEdit}
            />
          </div>

          {/* Row 5: 참고정보 (방문경로 / 직업 / 거주지역) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-700 border-t pt-2">
            <div className="flex min-w-0 gap-2">
              <span className="w-[56px] shrink-0 font-bold">방문경로</span>
              <span className="truncate">
                {fullCard?.referral_sources?.length
                  ? fullCard.referral_sources.join(', ') + (fullCard.referral_detail ? ` — ${fullCard.referral_detail}` : '')
                  : '-'}
              </span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="w-[56px] shrink-0 font-bold">직업</span>
              <span className="truncate">{fullCard?.occupation ?? '-'}</span>
            </div>
            <div className="flex min-w-0 gap-2">
              <span className="w-[56px] shrink-0 font-bold">거주지역</span>
              <span className="truncate">{fullCard?.residence_area ?? '-'}</span>
            </div>
          </div>

          {/* 상담카드 상세 (박스 내부 펼치기) */}
          {fullCard && (
            <details className="rounded-md border border-amber-200 bg-amber-50/40">
              <summary className="cursor-pointer px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50">
                📋 상담카드 상세 (병력 / 운동경험 / 기타)
              </summary>
              <div className="px-3 pb-2 pt-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {fullCard.instagram_id && <p><span className="font-bold text-amber-900">인스타:</span> {fullCard.instagram_id}</p>}
                {fullCard.registration_product && <p><span className="font-bold text-amber-900">등록상품:</span> {fullCard.registration_product}</p>}
                {fullCard.exercise_time_preference && <p><span className="font-bold text-amber-900">운동 선호 시간:</span> {fullCard.exercise_time_preference}</p>}
                {fullCard.exercise_duration && <p><span className="font-bold text-amber-900">운동 경력:</span> {fullCard.exercise_duration}</p>}
                {fullCard.body_correction_area && <p className="md:col-span-2"><span className="font-bold text-amber-900">체형교정 부위:</span> {fullCard.body_correction_area}</p>}
                {fullCard.medical_conditions?.length > 0 && <p className="md:col-span-2"><span className="font-bold text-amber-900">병력:</span> {fullCard.medical_conditions.join(', ')}{fullCard.medical_detail ? ` (${fullCard.medical_detail})` : ''}</p>}
                {fullCard.surgery_history && <p><span className="font-bold text-amber-900">수술이력:</span> {fullCard.surgery_history}</p>}
                {fullCard.surgery_detail && <p className="md:col-span-2"><span className="font-bold text-amber-900">수술 상세:</span> {fullCard.surgery_detail}</p>}
                {fullCard.exercise_experiences?.length > 0 && <p className="md:col-span-2"><span className="font-bold text-amber-900">운동경험:</span> {fullCard.exercise_experiences.join(', ')}{fullCard.exercise_experience_detail ? ` — ${fullCard.exercise_experience_detail}` : ''}</p>}
                {fullCard.exercise_experience_history && <p className="md:col-span-2"><span className="font-bold text-amber-900">운동 이력:</span> {fullCard.exercise_experience_history}</p>}
                {fullCard.pt_satisfaction && <p><span className="font-bold text-amber-900">PT 만족도:</span> {fullCard.pt_satisfaction}</p>}
                {fullCard.pt_satisfaction_reason && <p className="md:col-span-2"><span className="font-bold text-amber-900">만족/불만 이유:</span> {fullCard.pt_satisfaction_reason}</p>}
                {fullCard.exercise_personality?.length > 0 && <p className="md:col-span-2"><span className="font-bold text-amber-900">운동 성향:</span> {fullCard.exercise_personality.join(', ')}</p>}
                {fullCard.desired_body_type && <p className="md:col-span-2"><span className="font-bold text-amber-900">원하는 체형:</span> {fullCard.desired_body_type}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* 세션들 */}
      {!hideSessionList && sessions.map((session, idx) => {
        const isCompleted = session.completed
        const isCollapsed = collapsedSessions.has(idx)
        const isExpanded = !isCollapsed
        const hasContent = session.exercises?.some((e) => e.name) || session.tip

        return (
          <Card key={idx} ref={(el) => { sessionRefs.current[idx] = el as unknown as HTMLDivElement | null }} className={`border-2 ${isCompleted ? 'border-green-400 bg-green-50/30' : idx === activeSessionIdx ? 'border-blue-400' : 'border-gray-300'}`}>
            <CardHeader className="py-2 px-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  {idx + 1}차 OT
                  {session.approval_status && session.approval_status !== '작성중' && (
                    <Badge className={`text-white text-xs ${
                      session.approval_status === '승인' ? 'bg-green-600'
                      : session.approval_status === '반려' ? 'bg-red-500'
                      : 'bg-yellow-500'
                    }`}>{session.approval_status}</Badge>
                  )}
                  {isCompleted && <Badge className="bg-green-500 text-white text-xs">완료</Badge>}
                  {idx === activeSessionIdx && !isCompleted && <Badge className="bg-blue-500 text-white text-xs">현재</Badge>}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && !isSessionLocked(session) && (
                    <Button
                      size="sm"
                      className="h-7 text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? '저장중...' : `${idx + 1}차 저장`}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold border border-yellow-500"
                    onClick={() => handleShareSession(idx)}
                    disabled={sharing}
                  >
                    <Share2 className="h-3 w-3 mr-1" />회원님께 공유
                  </Button>
                  {canEdit && (
                    <Button
                      size="sm"
                      className="h-7 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => openMemberSignPage(idx)}
                      disabled={signOpening}
                      title="회원에게 직접 기기를 건네 서명받을 때"
                    >
                      ✍️ 현장 서명 (새 창)
                    </Button>
                  )}
                  {canEdit && !isSessionLocked(session) && (session.approval_status === '작성중' || !session.approval_status || session.approval_status === '반려') && (
                    <Button
                      size="sm"
                      className={`h-7 text-xs font-bold ${(session.signature_url || isAdmin) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      onClick={() => handleSubmitSession(idx)}
                      disabled={saving || (!session.signature_url && !isAdmin)}
                      title={!session.signature_url && !isAdmin ? '회원 서명이 필요합니다' : ''}
                    >
                      <Send className="h-3 w-3 mr-1" />{!session.signature_url && !isAdmin ? '서명 필요' : `${idx + 1}차 제출`}
                    </Button>
                  )}
                  {canEdit && session.approval_status === '제출완료' && program?.id && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold border border-orange-600"
                      onClick={async () => {
                        if (!program?.id) return
                        setSaving(true)
                        await unsubmitOtSession(program.id, idx)
                        setSessions((prev) => prev.map((s, i) =>
                          i === idx ? { ...s, approval_status: '작성중', submitted_at: null, rejection_reason: null } : s,
                        ))
                        setSaving(false)
                        onSaved?.()
                      }}
                      disabled={saving}
                    >
                      제출 취소
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleSessionCollapse(idx)}>
                    {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    {isCollapsed ? '펼치기' : '접기'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              {/* 접힌 세션: 요약만 표시 */}
              {isCollapsed ? (
                <div className="text-sm text-gray-500">
                  {session.date && <span>{session.date} {session.time}</span>}
                  {hasContent && <span className="ml-2">— {session.exercises.filter((e) => e.name).map((e) => e.name).join(', ')}</span>}
                  {!hasContent && !session.date && <span className="text-gray-400">내용 없음 (펼치기 클릭)</span>}
                </div>
              ) : (
                /* 편집 가능 영역 */
                <div className="space-y-3">
                  {/* 수업 상태 변경 (미완료 세션에만 표시) */}
                  {!isCompleted && canEdit && (() => {
                    const otSession = a.sessions?.find((s) => s.session_number === idx + 1)
                    if (!otSession?.scheduled_at) return null
                    const currentStatus = (session as unknown as Record<string, unknown>).class_status as string | null | undefined
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50 rounded-lg p-2">
                        <span className="text-[10px] font-bold text-indigo-700 mr-1">수업상태:</span>
                        {(['수업완료', '노쇼', '차감노쇼', '상담', '기타'] as const).map((opt) => {
                          const isActive = currentStatus === opt
                          const baseColors: Record<string, string> = { '수업완료': 'bg-green-500 text-white', '노쇼': 'bg-red-500 text-white', '차감노쇼': 'bg-orange-500 text-white', '상담': 'bg-blue-500 text-white', '기타': 'bg-gray-500 text-white' }
                          const inactiveColors: Record<string, string> = { '수업완료': 'bg-white text-green-600 border-green-300', '노쇼': 'bg-white text-red-500 border-red-300', '차감노쇼': 'bg-white text-orange-500 border-orange-300', '상담': 'bg-white text-blue-500 border-blue-300', '기타': 'bg-white text-gray-500 border-gray-300' }
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`rounded px-2 py-1 text-[10px] font-bold border transition-colors ${isActive ? baseColors[opt] + ' ring-2 ring-offset-1 ring-gray-400' : inactiveColors[opt]} hover:opacity-80`}
                              onClick={async () => {
                                if (opt === '기타') {
                                  const reason = prompt('기타 사유를 입력하세요')
                                  if (!reason) return
                                  updateSession(idx, 'class_status' as keyof OtProgramSession, opt)
                                  updateSession(idx, 'result_note', reason)
                                  return
                                }
                                // 즉시 세션 상태 반영
                                updateSession(idx, 'class_status' as keyof OtProgramSession, isActive ? null : opt)
                                if (opt === '수업완료' && !isActive) {
                                  await upsertOtSession({
                                    ot_assignment_id: a.id,
                                    session_number: idx + 1,
                                    scheduled_at: otSession.scheduled_at ?? undefined,
                                    completed_at: new Date().toISOString(),
                                  })
                                  onSaved?.()
                                }
                              }}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs font-bold">날짜:</Label>
                      <Input type="date" value={session.date} onChange={(e) => updateSession(idx, 'date', e.target.value)} className="h-7 text-sm" disabled={!canEdit || isSessionLocked(session) || (isCompleted && !isExpanded)} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-xs font-bold">시간:</Label>
                      <Input type="time" value={session.time} onChange={(e) => updateSession(idx, 'time', e.target.value)} className="h-7 text-sm" disabled={!canEdit || isSessionLocked(session) || (isCompleted && !isExpanded)} />
                    </div>
                  </div>

                  {/* 운동 */}
                  <div>
                    <div className="grid grid-cols-[1fr_60px_60px_60px] gap-1 text-xs text-center text-gray-500 mb-1">
                      <span>운동명</span><span>무게(kg)</span><span>개수</span><span>세트</span>
                    </div>
                    {session.exercises.map((ex, eIdx) => (
                      <div key={eIdx} className="grid grid-cols-[1fr_60px_60px_60px] gap-1 mb-1">
                        <Input value={ex.name} onChange={(e) => updateExercise(idx, eIdx, 'name', e.target.value)} className="h-7 text-sm" placeholder={`운동 ${eIdx + 1}`} disabled={!canEdit || isSessionLocked(session)} />
                        <Input value={ex.weight} onChange={(e) => updateExercise(idx, eIdx, 'weight', e.target.value)} className="h-7 text-sm text-center" disabled={!canEdit || isSessionLocked(session)} />
                        <Input value={ex.reps ?? ''} onChange={(e) => updateExercise(idx, eIdx, 'reps', e.target.value)} className="h-7 text-sm text-center" disabled={!canEdit || isSessionLocked(session)} />
                        <Input value={ex.sets} onChange={(e) => updateExercise(idx, eIdx, 'sets', e.target.value)} className="h-7 text-sm text-center" disabled={!canEdit || isSessionLocked(session)} />
                      </div>
                    ))}
                    {canEdit && !isSessionLocked(session) && (
                      <button type="button" className="w-full rounded border border-dashed border-gray-300 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600" onClick={() => addExercise(idx)}>
                        + 종목 추가
                      </button>
                    )}
                  </div>

                  {/* 유산소 */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-xs font-bold">유산소:</Label>
                    {CARDIO_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-1 text-sm cursor-pointer">
                        <Checkbox checked={session.cardio.types.includes(opt)} onCheckedChange={() => toggleCardio(idx, opt)} disabled={!canEdit || isSessionLocked(session)} />
                        {opt}
                      </label>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={session.cardio.duration_min}
                        onChange={(e) => setSessions((prev) => prev.map((s, i) => i === idx ? { ...s, cardio: { ...s.cardio, duration_min: e.target.value } } : s))}
                        className="h-6 text-xs w-14" placeholder="분" disabled={!canEdit || isSessionLocked(session)}
                      />
                      <span className="text-xs">분</span>
                    </div>
                  </div>

                  {/* Tip */}
                  <div>
                    <Label className="text-xs font-bold text-red-600">트레이너 Tip:</Label>
                    <Textarea value={session.tip} onChange={(e) => updateSession(idx, 'tip', e.target.value)} className="text-sm min-h-[50px] mt-1" placeholder="트레이너 팁" disabled={!canEdit || isSessionLocked(session)} />
                  </div>

                  {/* 계획서 */}
                  {(() => {
                    const detail: OtSessionPlanDetail = session.plan_detail ?? {}
                    const roadmap: OtSessionPlanRoadmapItem[] = detail.weekly_roadmap ?? []
                    const patchDetail = (patch: Partial<OtSessionPlanDetail>) => {
                      updateSession(idx, 'plan_detail', { ...detail, ...patch })
                    }
                    const patchRoadmap = (next: OtSessionPlanRoadmapItem[]) => patchDetail({ weekly_roadmap: next })
                    const planDisabled = !canEdit || isSessionLocked(session)
                    return (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
                        <Label className="text-xs font-bold text-indigo-700">수업 계획서</Label>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-600">필요 횟수</Label>
                            <Input
                              value={detail.sessions_needed ?? ''}
                              onChange={(e) => patchDetail({ sessions_needed: e.target.value })}
                              placeholder="예) 20회"
                              className="h-8 text-sm bg-white"
                              disabled={planDisabled}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-600">기간</Label>
                            <Input
                              value={detail.duration ?? ''}
                              onChange={(e) => patchDetail({ duration: e.target.value })}
                              placeholder="예) 10주"
                              className="h-8 text-sm bg-white"
                              disabled={planDisabled}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-600">현재 몸상태</Label>
                            <Textarea
                              value={detail.current_state ?? ''}
                              onChange={(e) => patchDetail({ current_state: e.target.value })}
                              placeholder={`예) 체지방 28%, 근력 부족\n무릎 뻐근함 있음`}
                              className="text-sm min-h-[70px] bg-white"
                              disabled={planDisabled}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-600">목표 몸상태</Label>
                            <Textarea
                              value={detail.target_state ?? ''}
                              onChange={(e) => patchDetail({ target_state: e.target.value })}
                              placeholder={`예) 체지방 20%, 스쿼트 60kg\n라인 선명하게`}
                              className="text-sm min-h-[70px] bg-white"
                              disabled={planDisabled}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-gray-600">주차별 로드맵</Label>
                            {!planDisabled && (
                              <button
                                type="button"
                                onClick={() => patchRoadmap([...roadmap, { week: `${roadmap.length + 1}주차`, content: '' }])}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                              >+ 주차 추가</button>
                            )}
                          </div>
                          {roadmap.length === 0 ? (
                            <p className="text-xs text-gray-400">주차를 추가해 운동/목표 흐름을 적어주세요.</p>
                          ) : (
                            <div className="space-y-2">
                              {roadmap.map((item, rIdx) => (
                                <div key={rIdx} className="grid grid-cols-[90px_1fr_28px] gap-2 items-start">
                                  <Input
                                    value={item.week}
                                    onChange={(e) => patchRoadmap(roadmap.map((it, i) => i === rIdx ? { ...it, week: e.target.value } : it))}
                                    placeholder={`${rIdx + 1}주차`}
                                    className="h-8 text-xs bg-white text-center font-bold"
                                    disabled={planDisabled}
                                  />
                                  <Textarea
                                    value={item.content}
                                    onChange={(e) => patchRoadmap(roadmap.map((it, i) => i === rIdx ? { ...it, content: e.target.value } : it))}
                                    placeholder="이 주차의 목표·운동 구성·체크포인트"
                                    className="text-xs min-h-[44px] bg-white"
                                    disabled={planDisabled}
                                  />
                                  {!planDisabled && (
                                    <button
                                      type="button"
                                      onClick={() => patchRoadmap(roadmap.filter((_, i) => i !== rIdx))}
                                      className="h-8 w-7 flex items-center justify-center text-gray-400 hover:text-red-500"
                                      aria-label="삭제"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-gray-600">특이사항</Label>
                          <Textarea
                            value={detail.notes ?? ''}
                            onChange={(e) => patchDetail({ notes: e.target.value })}
                            placeholder={`부상 이력, 식습관, 수면, 스케줄 제약 등`}
                            className="text-sm min-h-[60px] bg-white"
                            disabled={planDisabled}
                          />
                        </div>

                        {/* 레거시 plan 문자열이 있을 경우 참고용 */}
                        {session.plan && (
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer">이전 계획서 메모 보기</summary>
                            <pre className="mt-1 whitespace-pre-wrap bg-white rounded p-2 border border-gray-200">{session.plan}</pre>
                          </details>
                        )}
                      </div>
                    )
                  })()}

                  {/* 관리자 피드백 표시 — 관리자가 입력해둔 피드백은 항상 노출 (트레이너가 볼 수 있도록) */}
                  {session.admin_feedback && (
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">📋 관리자 피드백</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{session.admin_feedback}</p>
                    </div>
                  )}

                  {/* 인바디 */}
                  <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                    <label className={`flex items-center gap-2 ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                      <Checkbox
                        checked={session.inbody}
                        onCheckedChange={(v) => updateSession(idx, 'inbody', !!v)}
                        disabled={!canEdit}
                        className="h-5 w-5"
                      />
                      <span className="text-sm font-bold text-purple-700">인바디 측정</span>
                      <span className="text-xs text-gray-500">· 이미지는 언제든 추가 가능</span>
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(session.inbody_images ?? []).map((img, imgIdx) => (
                        <div key={imgIdx} className="relative">
                          <img
                            src={img}
                            alt="인바디"
                            onClick={() => setLightboxUrl(img)}
                            className="w-20 h-20 object-cover rounded border border-purple-200 cursor-zoom-in hover:opacity-80 transition"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              onClick={() => {
                                const next = (session.inbody_images ?? []).filter((_, j) => j !== imgIdx)
                                updateSession(idx, 'inbody_images', next)
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <label className="w-20 h-20 rounded border-2 border-dashed border-purple-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 text-purple-400 hover:text-purple-600">
                          <ImagePlus className="h-5 w-5" />
                          <span className="text-[10px] mt-0.5">{uploading ? '...' : '인바디 추가'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                              if (!e.target.files) return
                              setUploading(true)
                              const supabase = createClient()
                              const uploaded: string[] = []
                              const errs: string[] = []
                              for (const file of Array.from(e.target.files)) {
                                const ext = file.name.split('.').pop()
                                const path = `${a.id}/inbody_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                                const { error } = await supabase.storage.from('ot-images').upload(path, file)
                                if (error) { errs.push(error.message); continue }
                                const { data: urlData } = supabase.storage.from('ot-images').getPublicUrl(path)
                                uploaded.push(urlData.publicUrl)
                              }
                              if (errs.length) alert(`인바디 이미지 업로드 실패: ${errs[0]}\n'ot-images' 스토리지 버킷 확인 필요`)
                              const prev = session.inbody_images ?? []
                              updateSession(idx, 'inbody_images', [...prev, ...uploaded])
                              setUploading(false)
                            }}
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* 비포/애프터 이미지 */}
                  {(() => {
                    const records = session.image_records ?? []
                    const legacyOnly = (session.images ?? []).filter((u) => !records.some((r) => r.url === u))
                    const legacyRecords = legacyOnly.map((u) => {
                      const m = u.match(/\/(\d{13})_/)
                      return { url: u, uploaded_at: m ? new Date(Number(m[1])).toISOString() : new Date(0).toISOString(), label: null as 'before' | 'after' | null }
                    })
                    const all = [...records, ...legacyRecords].sort((a2, b2) => a2.uploaded_at.localeCompare(b2.uploaded_at))
                    const before = all.filter((r) => r.label === 'before')
                    const after = all.filter((r) => r.label === 'after')
                    const unlabeled = all.filter((r) => !r.label)

                    const updateRecordLabel = (url: string, label: 'before' | 'after' | null) => {
                      setSessions((prev) => prev.map((s, i) => {
                        if (i !== idx) return s
                        const recs = s.image_records ?? []
                        const hit = recs.find((r) => r.url === url)
                        const nextRecs = hit
                          ? recs.map((r) => r.url === url ? { ...r, label } : r)
                          : [...recs, { url, uploaded_at: new Date().toISOString(), label }]
                        return { ...s, image_records: nextRecs }
                      }))
                    }
                    const removeByUrl = (url: string) => {
                      setSessions((prev) => prev.map((s, i) => i === idx ? {
                        ...s,
                        images: (s.images ?? []).filter((u) => u !== url),
                        image_records: (s.image_records ?? []).filter((r) => r.url !== url),
                      } : s))
                    }

                    const renderImage = (r: { url: string; uploaded_at: string; label?: 'before' | 'after' | null }) => (
                      <div key={r.url} className="w-28 space-y-1">
                        <div className="relative">
                          <img
                            src={r.url}
                            alt=""
                            onClick={() => setLightboxUrl(r.url)}
                            className="w-28 h-28 object-cover rounded border cursor-zoom-in hover:opacity-80 transition"
                          />
                          {canEdit && (
                            <button type="button" className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs" onClick={() => removeByUrl(r.url)}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 text-center">
                          {new Date(r.uploaded_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {canEdit && (
                          <div className="flex gap-1">
                            <button type="button"
                              className={`flex-1 h-6 rounded text-[10px] font-bold border ${r.label === 'before' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200'}`}
                              onClick={() => updateRecordLabel(r.url, r.label === 'before' ? null : 'before')}
                            >BEFORE</button>
                            <button type="button"
                              className={`flex-1 h-6 rounded text-[10px] font-bold border ${r.label === 'after' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-200'}`}
                              onClick={() => updateRecordLabel(r.url, r.label === 'after' ? null : 'after')}
                            >AFTER</button>
                          </div>
                        )}
                      </div>
                    )

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold">비포 / 애프터 이미지</Label>
                          {canEdit && !isCompleted && (
                            <label className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer">
                              + 이미지 추가
                              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImageUpload(idx, e.target.files)} disabled={uploading} />
                            </label>
                          )}
                        </div>

                        {all.length === 0 ? (
                          <p className="text-xs text-gray-400">업로드된 이미지가 없습니다. 우측 상단 &quot;+ 이미지 추가&quot;로 사진을 올리고 BEFORE/AFTER 를 지정해주세요.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2 space-y-2">
                              <p className="text-xs font-bold text-blue-700">BEFORE ({before.length})</p>
                              <div className="flex gap-2 flex-wrap">
                                {before.length === 0 && <p className="text-xs text-gray-400">-</p>}
                                {before.map(renderImage)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-green-200 bg-green-50/40 p-2 space-y-2">
                              <p className="text-xs font-bold text-green-700">AFTER ({after.length})</p>
                              <div className="flex gap-2 flex-wrap">
                                {after.length === 0 && <p className="text-xs text-gray-400">-</p>}
                                {after.map(renderImage)}
                              </div>
                            </div>
                          </div>
                        )}

                        {unlabeled.length > 0 && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2 space-y-2">
                            <p className="text-xs font-bold text-gray-600">미분류 ({unlabeled.length}) · BEFORE/AFTER 를 지정해주세요</p>
                            <div className="flex gap-2 flex-wrap">
                              {unlabeled.map(renderImage)}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}


                  {/* 세일즈 정보 */}
                  {(() => {
                    const salesDisabled = !canEdit || isSessionLocked(session)
                    const PROB_OPTIONS = [20, 40, 60, 80, 100]
                    const isPtConversion = session.sales_status === 'PT전환'
                    return (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
                        <Label className="text-xs font-bold text-emerald-700">세일즈 정보</Label>

                        {/* 매출대상자 */}
                        <button type="button" disabled={salesDisabled}
                          className={`w-full h-10 rounded-lg border-2 text-sm font-bold transition-colors ${session.is_sales_target ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-400'} disabled:opacity-50`}
                          onClick={() => updateSession(idx, 'is_sales_target', !session.is_sales_target)}
                        >★ 매출대상자 {session.is_sales_target ? '✓' : ''}</button>

                        {/* 상태: PT전환 / 클로징실패 / 스케줄미확정 */}
                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-gray-600">상태</Label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['PT전환', '클로징실패', '스케줄미확정'] as const).map((st) => {
                              const active = session.sales_status === st
                              const colors: Record<string, string> = {
                                'PT전환': active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-400',
                                '클로징실패': active ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-500 border-red-200 hover:border-red-400',
                                '스케줄미확정': active ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-200 hover:border-yellow-400',
                              }
                              return (
                                <button key={st} type="button" disabled={salesDisabled}
                                  className={`h-10 rounded-lg border-2 text-sm font-bold transition-colors ${colors[st]} disabled:opacity-50`}
                                  onClick={() => {
                                    const newStatus = active ? null : st
                                    updateSession(idx, 'sales_status', newStatus)
                                    if (st === 'PT전환') {
                                      updateSession(idx, 'is_pt_conversion', !active)
                                    } else if (active) {
                                      // 해제 시
                                    }
                                  }}
                                >{st}</button>
                              )
                            })}
                          </div>
                        </div>

                        {/* PT전환 시 회수/금액 입력 */}
                        {isPtConversion && (
                          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-2">
                            <Label className="text-xs font-bold text-purple-700">PT 등록 정보</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-gray-500">등록 회수</Label>
                                <div className="flex items-center gap-1">
                                  <Input type="number" inputMode="numeric" value={session.expected_sessions ?? ''} onChange={(e) => updateSession(idx, 'expected_sessions', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" className="h-8 text-sm bg-white" disabled={salesDisabled} />
                                  <span className="text-xs text-gray-500 shrink-0">회</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-gray-500">등록 금액</Label>
                                <div className="flex items-center gap-1">
                                  <Input type="number" inputMode="numeric" value={session.pt_sales_amount ?? ''} onChange={(e) => updateSession(idx, 'pt_sales_amount', e.target.value === '' ? null : Number(e.target.value))} placeholder="0" className="h-8 text-sm bg-white" disabled={salesDisabled} />
                                  <span className="text-xs text-gray-500 shrink-0">만원</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 클로징실패 사유 */}
                        {session.sales_status === '클로징실패' && (
                          <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-1">
                            <Label className="text-xs font-bold text-red-600">실패 사유</Label>
                            <Textarea value={session.closing_fail_reason ?? ''} onChange={(e) => updateSession(idx, 'closing_fail_reason', e.target.value)} className="text-sm min-h-[50px] bg-white" placeholder="실패 원인을 적어주세요" disabled={salesDisabled} />
                          </div>
                        )}

                        {/* 예상 매출 / 클로징 확률 (PT전환이 아닐 때) */}
                        {!isPtConversion && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs font-bold text-gray-600">예상 매출</Label>
                                <div className="flex items-center gap-1">
                                  <Input type="number" inputMode="numeric" value={session.expected_amount ?? ''} onChange={(e) => updateSession(idx, 'expected_amount', e.target.value === '' ? null : Number(e.target.value))} className="h-8 text-sm bg-white" disabled={salesDisabled} />
                                  <span className="text-xs text-gray-500">만원</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-bold text-gray-600">예상 회수</Label>
                                <div className="flex items-center gap-1">
                                  <Input type="number" inputMode="numeric" value={session.expected_sessions ?? ''} onChange={(e) => updateSession(idx, 'expected_sessions', e.target.value === '' ? null : Number(e.target.value))} className="h-8 text-sm bg-white" disabled={salesDisabled} />
                                  <span className="text-xs text-gray-500">회</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-bold text-gray-600">클로징 확률</Label>
                              <div className="flex gap-1.5">
                                {PROB_OPTIONS.map((p) => {
                                  const active = session.closing_probability === p
                                  return (
                                    <button key={p} type="button" disabled={salesDisabled}
                                      className={`flex-1 h-8 rounded-md border text-xs font-bold transition-colors ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'} disabled:opacity-50`}
                                      onClick={() => updateSession(idx, 'closing_probability', active ? null : p)}
                                    >{p}%</button>
                                  )
                                })}
                              </div>
                            </div>
                          </>
                        )}

                        <div className="space-y-1">
                          <Label className="text-xs font-bold text-gray-600">세일즈 메모</Label>
                          <Textarea value={session.sales_note ?? ''} onChange={(e) => updateSession(idx, 'sales_note', e.target.value)} className="text-sm min-h-[60px] bg-white" placeholder="다음 액션, 팔로업 일정, 특이사항 등" disabled={salesDisabled} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* 회원 서명 */}
                  {session.signature_url ? (
                    <div className="bg-green-50 border-2 border-green-400 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-green-700">✍️ 회원 서명 완료 {session.signer_name ? `· ${session.signer_name}` : ''}</p>
                        {session.signed_at && (
                          <p className="text-xs text-green-700">{new Date(session.signed_at).toLocaleString('ko')}</p>
                        )}
                      </div>
                      <div className="bg-white rounded border border-green-200 p-2">
                        <img src={session.signature_url} alt="회원 서명" className="w-full max-h-36 object-contain" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">아직 회원 서명이 없습니다. 위 <span className="font-bold text-emerald-700">✍️ 회원 서명 받기</span> 버튼을 눌러 새 창으로 서명을 받아주세요.</p>
                    </div>
                  )}

                  {/* 세션별 저장 / 완료 처리 버튼 — 완료 플로우에서 해당 차수일 때만 노출 */}
                  {onCompleteSession && completingSessionIdx === idx && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                      {!session.signature_url && !isAdmin && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                          ⚠️ 회원 서명이 필요합니다. <span className="font-bold">현장 서명</span> 버튼으로 먼저 서명을 받아주세요.
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          className="flex-1 h-10 bg-blue-500 hover:bg-blue-600 text-white font-bold"
                          disabled={saving || completeLoading}
                          onClick={handleSave}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                          저장
                        </Button>
                        <Button
                          type="button"
                          className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white font-bold disabled:bg-gray-300 disabled:text-gray-500"
                          disabled={completeLoading || (!session.signature_url && !isAdmin)}
                          onClick={() => onCompleteSession(idx)}
                          title={!session.signature_url && !isAdmin ? '회원 서명이 필요합니다' : ''}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {completeLoading ? '처리 중...' : `${idx + 1}차 완료 처리`}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* 세션 추가 */}
      {canEdit && !hideSessionList && (
        <button type="button" className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-1" onClick={addSession}>
          <Plus className="h-4 w-4" />
          {sessions.length + 1}차 OT 추가
        </button>
      )}

      {/* 공유용 숨김 카드 — 이미지 캡처 전용 */}
      <div style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none', opacity: 0 }} aria-hidden>
        {sessions.map((session, idx) => (
          <SessionShareCard
            key={idx}
            ref={(el) => { shareCardRefs.current[idx] = el }}
            memberName={a.member.name}
            trainerName={trainerName || a.pt_trainer?.name || null}
            sessionIdx={idx}
            session={session}
          />
        ))}
      </div>

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
          <Button type="button" onClick={handleCapture} className="bg-gray-900 hover:bg-black text-white font-bold border border-gray-900">
            <Download className="h-4 w-4 mr-2" />이미지 저장
          </Button>
          <Button type="button" onClick={handleShare} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold border border-yellow-500">
            <Share2 className="h-4 w-4 mr-2" />공유하기
          </Button>
          {canEdit && (
            <>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                저장
              </Button>
            </>
          )}
          {/* 승인/반려는 OT 승인 페이지에서 관리 */}
        </div>
      )}

      {/* 이미지 Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); setLightboxUrl(null) }}
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="확대 보기"
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  )
})
