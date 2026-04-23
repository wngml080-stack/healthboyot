'use client'

import { useState, useCallback, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { ConsultationCard } from '@/types'

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
  card: ConsultationCard | null
  cardId?: string
}

export function PublicConsultationForm({ card: initialCard, cardId }: Props) {
  const [card, setCard] = useState<ConsultationCard | null>(initialCard)
  const [loadingCard, setLoadingCard] = useState(!initialCard)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  // 서버에서 못 가져온 경우 클라이언트에서 재시도
  useEffect(() => {
    if (card || !cardId) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.from('consultation_cards').select('*').eq('id', cardId).single()
      .then(({ data }) => {
        if (data) setCard(data as ConsultationCard)
        setLoadingCard(false)
      })
  }, [card, cardId])

  // State for all fields - initialize from card
  const [name, setName] = useState(card?.member_name ?? '')
  const [phone, setPhone] = useState(card?.member_phone ?? '')
  const [gender, setGender] = useState(card?.member_gender ?? '')
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

  const toggleArray = useCallback((arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
  }, [])

  const handleSubmit = async () => {
    if (!name) { alert('이름을 입력해주세요'); return }
    setSaving(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error: updateError } = await supabase
      .from('consultation_cards')
      .update({
        member_name: name,
        member_phone: phone,
        member_gender: gender || null,
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', card?.id ?? cardId ?? '')
    const result = updateError ? { error: updateError.message } : {}
    setSaving(false)
    if (result.error) alert('저장 실패: ' + result.error)
    else setSubmitted(true)
  }

  if (loadingCard) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto" />
          <p className="text-gray-500 text-sm">상담카드를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!card && !loadingCard) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <h1 className="text-xl font-bold text-gray-900">상담카드를 찾을 수 없습니다</h1>
          <p className="text-gray-500">링크가 올바른지 확인해주세요.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">&#x2705;</div>
          <h1 className="text-2xl font-black text-gray-900">작성 완료!</h1>
          <p className="text-gray-600">상담카드가 성공적으로 전송되었습니다.<br/>감사합니다!</p>
          <div className="pt-4">
            <p className="text-sm text-gray-400">HEALTHBOYGYM 당산점</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 text-white py-6 px-4 text-center">
        <h1 className="text-xl font-black tracking-wider italic">HEALTHBOYGYM</h1>
        <p className="text-yellow-400 text-sm mt-1">신규회원 상담카드</p>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Section: 개인정보 */}
        <Section title="개인정보">
          <Field label="이름 *">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="이름을 입력해주세요" />
          </Field>
          <Field label="연락처">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" placeholder="01012345678" />
          </Field>
          <Field label="성별">
            <div className="flex gap-3">
              <button type="button" onClick={() => setGender('남')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-base transition-all ${gender === '남' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>남</button>
              <button type="button" onClick={() => setGender('여')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-base transition-all ${gender === '여' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-500 border-gray-200'}`}>여</button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="나이"><input type="text" value={age} onChange={(e) => setAge(e.target.value)} className="form-input" placeholder="나이" /></Field>
            <Field label="직업"><input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="form-input" placeholder="직업" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="운동 희망 시간대"><input type="text" value={exerciseTimePref} onChange={(e) => setExerciseTimePref(e.target.value)} className="form-input" placeholder="예: 저녁 7시" /></Field>
            <Field label="인스타그램"><input type="text" value={instagramId} onChange={(e) => setInstagramId(e.target.value)} className="form-input" placeholder="@아이디" /></Field>
          </div>
          <Field label="거주지역"><input type="text" value={residenceArea} onChange={(e) => setResidenceArea(e.target.value)} className="form-input" placeholder="거주지역" /></Field>
        </Section>

        {/* Section: 유입경로 */}
        <Section title="어떤 경로로 오셨나요? (복수 선택)">
          <ToggleGroup options={REFERRAL_OPTIONS} selected={referralSources} onToggle={(v) => toggleArray(referralSources, setReferralSources, v)} />
          {referralSources.includes('지인소개') && (
            <Field label="소개자"><input type="text" value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} className="form-input" placeholder="소개해주신 분 성함" /></Field>
          )}
        </Section>

        {/* Section: 운동 목적 */}
        <Section title="운동 목적 (복수 선택)">
          <ToggleGroup options={EXERCISE_GOAL_OPTIONS} selected={exerciseGoals} onToggle={(v) => toggleArray(exerciseGoals, setExerciseGoals, v)} />
          <Field label="구체적인 목표"><input type="text" value={exerciseGoalDetail} onChange={(e) => setExerciseGoalDetail(e.target.value)} className="form-input" placeholder="구체적으로 적어주세요" /></Field>
          <Field label="원하는 체형"><input type="text" value={desiredBodyType} onChange={(e) => setDesiredBodyType(e.target.value)} className="form-input" placeholder="예: 마른 근육, 벌크업" /></Field>
          <Field label="교정하고 싶은 부위"><input type="text" value={bodyCorrectionArea} onChange={(e) => setBodyCorrectionArea(e.target.value)} className="form-input" placeholder="예: 골반, 어깨, 거북목" /></Field>
        </Section>

        {/* Section: 건강 상태 */}
        <Section title="건강 상태">
          <p className="text-sm text-gray-500 mb-2">해당되는 질환을 선택해주세요</p>
          <ToggleGroup options={MEDICAL_OPTIONS} selected={medicalConditions} onToggle={(v) => toggleArray(medicalConditions, setMedicalConditions, v)} />
          {medicalConditions.filter(m => m !== '없음').length > 0 && (
            <Field label="상세 내용"><input type="text" value={medicalDetail} onChange={(e) => setMedicalDetail(e.target.value)} className="form-input" placeholder="질환 상세 내용" /></Field>
          )}
          <Field label="수술 이력">
            <div className="flex gap-3 mb-2">
              <button type="button" onClick={() => setSurgeryHistory('있음')} className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${surgeryHistory === '있음' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-200 text-gray-500'}`}>있음</button>
              <button type="button" onClick={() => setSurgeryHistory('없음')} className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${surgeryHistory === '없음' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-500'}`}>없음</button>
            </div>
            {surgeryHistory === '있음' && (
              <input type="text" value={surgeryDetail} onChange={(e) => setSurgeryDetail(e.target.value)} className="form-input" placeholder="수술 부위 및 시기" />
            )}
          </Field>
        </Section>

        {/* Section: 운동 경험 */}
        <Section title="운동 경험">
          <ToggleGroup options={EXPERIENCE_OPTIONS} selected={exerciseExperiences} onToggle={(v) => toggleArray(exerciseExperiences, setExerciseExperiences, v)} />
          {exerciseExperiences.filter(e => e !== '없음').length > 0 && (
            <>
              <Field label="운동 경험 상세"><input type="text" value={exerciseExpDetail} onChange={(e) => setExerciseExpDetail(e.target.value)} className="form-input" placeholder="운동 종류, 기간 등" /></Field>
              <Field label="운동 경험 이력"><input type="text" value={exerciseExpHistory} onChange={(e) => setExerciseExpHistory(e.target.value)} className="form-input" placeholder="과거 PT 경험 등" /></Field>
            </>
          )}
          <Field label="운동 기간">
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button key={d} type="button" onClick={() => setExerciseDuration(d)} className={`px-4 py-2 rounded-lg border-2 text-sm font-medium ${exerciseDuration === d ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>{d}</button>
              ))}
            </div>
          </Field>
          <Field label="PT 만족도">
            <div className="flex gap-2">
              {SATISFACTION_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => setPtSatisfaction(s)} className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${ptSatisfaction === s ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white text-gray-500 border-gray-200'}`}>{s}</button>
              ))}
            </div>
            {ptSatisfaction && ptSatisfaction !== '없음' && (
              <input type="text" value={ptSatisfactionReason} onChange={(e) => setPtSatisfactionReason(e.target.value)} className="form-input mt-2" placeholder="이유를 알려주세요" />
            )}
          </Field>
        </Section>

        {/* Section: 운동 성향 */}
        <Section title="운동 성향 (복수 선택)">
          <ToggleGroup options={PERSONALITY_OPTIONS} selected={exercisePersonality} onToggle={(v) => toggleArray(exercisePersonality, setExercisePersonality, v)} />
        </Section>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !name}
          className="w-full py-4 rounded-xl bg-yellow-400 text-black font-black text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-500 transition-colors"
        >
          {saving ? '전송 중...' : '상담카드 제출하기'}
        </button>
        <p className="text-center text-xs text-gray-400 pb-8">HEALTHBOYGYM 당산점</p>
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 16px;
          outline: none;
          transition: border-color 0.2s;
          background: white;
          color: #111827;
          -webkit-text-fill-color: #111827;
        }
        .form-input::placeholder {
          color: #9ca3af;
          -webkit-text-fill-color: #9ca3af;
        }
        .form-input:focus {
          border-color: #facc15;
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h2 className="text-base font-black text-gray-900 border-b border-gray-100 pb-2">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-gray-700">{label}</label>
      {children}
    </div>
  )
}

function ToggleGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
            selected.includes(opt)
              ? 'bg-yellow-400 text-black border-yellow-400 font-bold'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
