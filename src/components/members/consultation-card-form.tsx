'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Save, Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { upsertConsultationCard, updateStandaloneCard } from '@/actions/consultation'
import type { ConsultationCard, Member, Profile } from '@/types'

// ── 옵션 상수 ──
const REFERRAL_OPTIONS = [
  '직장', '거주지', '인터넷', '파워링크', '인스타', '외부간판',
  '지인소개', '네이버지도', '네이버블로그', '전단지',
]
const EXERCISE_GOAL_OPTIONS = [
  '다이어트(체지방감소)', '근육량증가', '체력향상', '체형교정', '통증개선', '재활', '기구사용',
]
const MEDICAL_OPTIONS = [
  '없음', '호흡기질환(천식or알러지)', '소화기질환', '척추질환', '관절질환', '당뇨', '고혈압',
]
const EXPERIENCE_OPTIONS = [
  '없음', 'PT', '헬스', '필라테스', '요가', '골프', '수영', '구기',
]
const DURATION_OPTIONS = ['없음', '3개월미만', '3-6개월', '6-12개월', '1년이상']
const SATISFACTION_OPTIONS = ['없음', '상', '중', '하']
const PERSONALITY_OPTIONS = [
  '운동에 지루함을 쉽게느낀다',
  '운동은 꾸준히 하나, 식사 조절이 안된다',
  '매우 활동적인 운동이 좋다',
  '차분하게 운동하는 것이 좋다',
  '힘들어야 운동을 한것 같다',
  '너무 힘든 것 보다는 적당한 강도가 좋다',
]

interface Props {
  member: Pick<Member, 'id' | 'name' | 'phone' | 'gender'>
  card: ConsultationCard | null
  onSaved?: () => void
  isStandalone?: boolean
  cardId?: string
  staffList?: Pick<Profile, 'id' | 'name'>[]
  onGenderChange?: (gender: '남' | '여') => void
}

export function ConsultationCardForm({ member, card, onSaved, isStandalone, cardId, staffList = [], onGenderChange }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── STEP 1 state ──
  const [fcName, setFcName] = useState(card?.fc_name ?? '')
  const [consultDate, setConsultDate] = useState(card?.consultation_date ?? '')
  const [regProduct, setRegProduct] = useState(card?.registration_product ?? '')
  const [exerciseStartDate, setExerciseStartDate] = useState(card?.exercise_start_date ?? '')
  const [expiryDate, setExpiryDate] = useState(card?.expiry_date ?? '')
  const [durationValue, setDurationValue] = useState('')
  const [durationUnit, setDurationUnit] = useState<'month' | 'day'>('month')
  const [age, setAge] = useState(card?.age ?? '')
  const [occupation, setOccupation] = useState(card?.occupation ?? '')
  const [exerciseTimePref, setExerciseTimePref] = useState(card?.exercise_time_preference ?? '')
  const [instagramId, setInstagramId] = useState(card?.instagram_id ?? '')
  const [residenceArea, setResidenceArea] = useState(card?.residence_area ?? '')
  const [desiredBodyType, setDesiredBodyType] = useState(card?.desired_body_type ?? '')
  const [referralSources, setReferralSources] = useState<string[]>(card?.referral_sources ?? [])
  const [referralDetail, setReferralDetail] = useState(card?.referral_detail ?? '')
  const [exerciseGoals, setExerciseGoals] = useState<string[]>(card?.exercise_goals ?? [])
  const [exerciseGoalDetail, setExerciseGoalDetail] = useState(card?.exercise_goal_detail ?? '')
  const [bodyCorrectionArea, setBodyCorrectionArea] = useState(card?.body_correction_area ?? '')
  const [medicalConditions, setMedicalConditions] = useState<string[]>(card?.medical_conditions ?? [])
  const [medicalDetail, setMedicalDetail] = useState(card?.medical_detail ?? '')
  const [surgeryHistory, setSurgeryHistory] = useState(card?.surgery_history ?? '')
  const [surgeryDetail, setSurgeryDetail] = useState(card?.surgery_detail ?? '')
  const [exerciseExperiences, setExerciseExperiences] = useState<string[]>(card?.exercise_experiences ?? [])
  const [exerciseExpDetail, setExerciseExpDetail] = useState(card?.exercise_experience_detail ?? '')
  const [exerciseExpHistory, setExerciseExpHistory] = useState(card?.exercise_experience_history ?? '')
  const [exerciseDuration, setExerciseDuration] = useState(card?.exercise_duration ?? '')
  const [ptSatisfaction, setPtSatisfaction] = useState(card?.pt_satisfaction ?? '')
  const [ptSatisfactionReason, setPtSatisfactionReason] = useState(card?.pt_satisfaction_reason ?? '')
  const [exercisePersonality, setExercisePersonality] = useState<string[]>(card?.exercise_personality ?? [])
  const [memberName, setMemberName] = useState(card?.member_name || member.name || '')
  const [memberPhone, setMemberPhone] = useState(card?.member_phone || member.phone || '')

  const toggleArray = useCallback((arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const values = {
      member_name: memberName || null,
      member_phone: memberPhone || null,
      fc_name: fcName || null,
      consultation_date: consultDate || null,
      registration_product: regProduct || null,
      exercise_start_date: exerciseStartDate || null,
      expiry_date: expiryDate || null,
      age: age || null,
      occupation: occupation || null,
      exercise_time_preference: exerciseTimePref || null,
      instagram_id: instagramId || null,
      residence_area: residenceArea || null,
      desired_body_type: desiredBodyType || null,
      referral_sources: referralSources,
      referral_detail: referralDetail || null,
      exercise_goals: exerciseGoals,
      exercise_goal_detail: exerciseGoalDetail || null,
      body_correction_area: bodyCorrectionArea || null,
      medical_conditions: medicalConditions,
      medical_detail: medicalDetail || null,
      surgery_history: surgeryHistory || null,
      surgery_detail: surgeryDetail || null,
      exercise_experiences: exerciseExperiences,
      exercise_experience_detail: exerciseExpDetail || null,
      exercise_experience_history: exerciseExpHistory || null,
      exercise_duration: exerciseDuration || null,
      pt_satisfaction: ptSatisfaction || null,
      pt_satisfaction_reason: ptSatisfactionReason || null,
      exercise_personality: exercisePersonality,
    }

    const result = isStandalone && cardId
      ? await updateStandaloneCard(cardId, values)
      : await upsertConsultationCard(member.id, values)

    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onSaved?.()
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="border-2 border-black rounded-lg overflow-hidden">
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">STEP.1 신규회원 상담 카드</h2>
          <div className="flex items-center gap-4 text-sm">
            <span>등록담당자 :</span>
            {staffList.length > 0 ? (
              <Select value={fcName || 'none'} onValueChange={(v) => setFcName(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-32 h-7 bg-white text-black text-sm">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={fcName}
                onChange={(e) => setFcName(e.target.value)}
                className="w-28 h-7 bg-white text-black text-sm"
                placeholder="이름"
              />
            )}
          </div>
        </div>

        {/* 개인정보 */}
        <div className="p-4 border-b border-gray-300">
          <p className="text-sm font-semibold text-gray-500 mb-3">&lt;개인정보 Personal Information&gt;</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-bold whitespace-nowrap w-16 shrink-0">등록일:</Label>
              <Input type="date" value={consultDate} onChange={(e) => setConsultDate(e.target.value)} className="h-8 text-sm flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-bold whitespace-nowrap shrink-0">등록상품:</Label>
              <Input value={regProduct} onChange={(e) => setRegProduct(e.target.value)} className="h-8 text-sm flex-1" placeholder="예: 기필5, PT30회 등" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-bold whitespace-nowrap shrink-0">운동시작일:</Label>
              <Input type="date" value={exerciseStartDate} onChange={(e) => setExerciseStartDate(e.target.value)} className="h-8 text-sm flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-bold whitespace-nowrap shrink-0">만료일:</Label>
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={durationValue}
                  onChange={(e) => {
                    setDurationValue(e.target.value)
                    const n = Number(e.target.value)
                    if (n > 0 && exerciseStartDate) {
                      const [y, m, d] = exerciseStartDate.split('-').map(Number)
                      const base = new Date(y, m - 1, d)
                      const end = durationUnit === 'month'
                        ? new Date(base.getFullYear(), base.getMonth() + n, base.getDate())
                        : new Date(base.getTime() + n * 86400000)
                      setExpiryDate(end.toISOString().slice(0, 10))
                    }
                  }}
                  placeholder="기간"
                  className="h-8 text-sm w-16"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => {
                    const unit = e.target.value as 'month' | 'day'
                    setDurationUnit(unit)
                    const n = Number(durationValue)
                    if (n > 0 && exerciseStartDate) {
                      const [y, m, d] = exerciseStartDate.split('-').map(Number)
                      const base = new Date(y, m - 1, d)
                      const end = unit === 'month'
                        ? new Date(base.getFullYear(), base.getMonth() + n, base.getDate())
                        : new Date(base.getTime() + n * 86400000)
                      setExpiryDate(end.toISOString().slice(0, 10))
                    }
                  }}
                  className="h-8 text-sm rounded-md border border-gray-300 px-2 bg-white"
                >
                  <option value="month">개월</option>
                  <option value="day">일</option>
                </select>
                <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-8 text-sm flex-1" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 mb-2">【신규등록 회원님 작성란】</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">이름:</Label>
                <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} className="h-7 text-sm font-medium" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">성별:</Label>
                <button type="button" className={`px-3 py-0.5 rounded border text-sm font-medium transition-colors ${member.gender === '남' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'}`} onClick={() => onGenderChange?.('남')}>남</button>
                <button type="button" className={`px-3 py-0.5 rounded border text-sm font-medium transition-colors ${member.gender === '여' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-500 border-gray-300 hover:border-pink-400'}`} onClick={() => onGenderChange?.('여')}>여</button>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">나이:</Label>
                <Input value={age} onChange={(e) => setAge(e.target.value)} className="h-7 text-sm w-20" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">직업:</Label>
                <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} className="h-7 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">운동시간대:</Label>
                <Input value={exerciseTimePref} onChange={(e) => setExerciseTimePref(e.target.value)} className="h-7 text-sm" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">인스타:</Label>
                <Input value={instagramId} onChange={(e) => setInstagramId(e.target.value)} className="h-7 text-sm" placeholder="@" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">연락처:</Label>
                <Input value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} className="h-7 text-sm font-medium" />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-sm whitespace-nowrap">거주지역:</Label>
                <Input value={residenceArea} onChange={(e) => setResidenceArea(e.target.value)} className="h-7 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-sm whitespace-nowrap">자신이 원하는 체형은? (구체적으로):</Label>
              <Input value={desiredBodyType} onChange={(e) => setDesiredBodyType(e.target.value)} className="h-7 text-sm flex-1" />
            </div>
          </div>
        </div>

        {/* 유입경로 */}
        <div className="p-4 border-b border-gray-300">
          <p className="text-sm font-semibold mb-2">헬스보이짐을 알게된 유입경로? <span className="text-blue-600 text-xs">(중복체크가능)</span></p>
          <div className="flex flex-wrap gap-3">
            {REFERRAL_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={referralSources.includes(opt)} onCheckedChange={() => toggleArray(referralSources, setReferralSources, opt)} />
                {opt}
              </label>
            ))}
          </div>
          {referralSources.includes('지인소개') && (
            <Input value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} className="h-7 text-sm w-48 mt-2" placeholder="소개인 이름" />
          )}
        </div>

        {/* 회원권담당 상담자 작성란 */}
        <div className="p-4">
          <p className="text-xs font-semibold text-gray-600 mb-3">【회원권담당 상담자 작성란】</p>

          {/* 운동목적 */}
          <div className="mb-4">
            <p className="text-sm font-bold mb-2">운동목적</p>
            <div className="flex flex-wrap gap-3">
              {EXERCISE_GOAL_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={exerciseGoals.includes(opt)} onCheckedChange={() => toggleArray(exerciseGoals, setExerciseGoals, opt)} />
                  {opt}
                </label>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">▶운동목적 상세:</span>
                <Input value={exerciseGoalDetail} onChange={(e) => setExerciseGoalDetail(e.target.value)} className="h-7 text-sm flex-1" placeholder="구체적인 운동 목적을 작성해주세요" />
              </div>
              {exerciseGoals.includes('체형교정') && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-600">▶체형교정 부위:</span>
                  <Input value={bodyCorrectionArea} onChange={(e) => setBodyCorrectionArea(e.target.value)} className="h-7 text-sm flex-1" placeholder="예: 거북목, 골반 틀어짐, 어깨 높이 차이" />
                </div>
              )}
            </div>
          </div>

          {/* 병력사항 */}
          <div className="mb-4">
            <p className="text-sm font-bold mb-2">병력사항</p>
            <div className="flex flex-wrap gap-3 mb-2">
              {MEDICAL_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={medicalConditions.includes(opt)} onCheckedChange={() => toggleArray(medicalConditions, setMedicalConditions, opt)} />
                  {opt}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">기타:</span>
              <Input value={medicalDetail} onChange={(e) => setMedicalDetail(e.target.value)} className="h-7 text-sm flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">▶과거or최근수술 / 그외질환?</span>
              <label className="flex items-center gap-1 text-sm cursor-pointer">
                <Checkbox checked={surgeryHistory === '없음'} onCheckedChange={() => setSurgeryHistory(surgeryHistory === '없음' ? '' : '없음')} />
                없음
              </label>
              <span className="text-sm">수술내용 or 그외병력:</span>
              <Input value={surgeryDetail} onChange={(e) => setSurgeryDetail(e.target.value)} className="h-7 text-sm flex-1" />
            </div>
          </div>

          {/* 운동경험 */}
          <div className="mb-4">
            <p className="text-sm font-bold mb-2">운동경험</p>
            <div className="space-y-2">
              <div>
                <p className="text-sm mb-1">▶운동경험은?</p>
                <div className="flex flex-wrap gap-3">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={exerciseExperiences.includes(opt)} onCheckedChange={() => toggleArray(exerciseExperiences, setExerciseExperiences, opt)} />
                      {opt}
                    </label>
                  ))}
                  <div className="flex items-center gap-1">
                    <span className="text-sm">기타:</span>
                    <Input value={exerciseExpDetail} onChange={(e) => setExerciseExpDetail(e.target.value)} className="h-7 text-sm w-32" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm">▶운동경험 상세:</span>
                  <Input value={exerciseExpHistory} onChange={(e) => setExerciseExpHistory(e.target.value)} className="h-7 text-sm flex-1" placeholder="예: PT 20회 경험, 헬스 6개월, 필라테스 3개월" />
                </div>
              </div>
              <div>
                <p className="text-sm mb-1">▶운동경력은?</p>
                <div className="flex flex-wrap gap-3">
                  {DURATION_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={exerciseDuration === opt} onCheckedChange={() => setExerciseDuration(exerciseDuration === opt ? '' : opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm mb-1">▶PT(개인레슨) 경험이 있다면 만족도는?</p>
                <div className="flex flex-wrap gap-3">
                  {SATISFACTION_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={ptSatisfaction === opt} onCheckedChange={() => setPtSatisfaction(ptSatisfaction === opt ? '' : opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm">▶PT에대한 만족 or 불만족이 있다면 그 이유는?</span>
                <Input value={ptSatisfactionReason} onChange={(e) => setPtSatisfactionReason(e.target.value)} className="h-7 text-sm mt-1" placeholder="서술형" />
              </div>
            </div>
          </div>

          {/* 운동성격형태 */}
          <div>
            <p className="text-sm font-bold mb-2">운동성격형태 <span className="text-blue-600 text-xs">▶중복 체크 가능</span></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PERSONALITY_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={exercisePersonality.includes(opt)} onCheckedChange={() => toggleArray(exercisePersonality, setExercisePersonality, opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex items-center justify-end gap-3 pb-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">저장되었습니다!</p>}
        <Button onClick={handleSave} disabled={saving} className="px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          상담카드 저장
        </Button>
      </div>
    </div>
  )
}
