-- 신규회원 상담카드 테이블
CREATE TABLE IF NOT EXISTS consultation_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- STEP 1: FC 상담 정보
  fc_name TEXT,                          -- 담당 FC
  consultation_date DATE,                -- 상담일
  registration_product TEXT,             -- 등록상품
  expiry_date DATE,                      -- 만료날짜

  -- 개인정보
  age TEXT,
  occupation TEXT,                       -- 직업
  exercise_time_preference TEXT,         -- 운동시간대
  instagram_id TEXT,                     -- 인스타아이디
  residence_area TEXT,                   -- 거주지역
  desired_body_type TEXT,                -- 자신이 원하는 체형 (서술)

  -- 유입경로 (복수선택)
  referral_sources TEXT[] DEFAULT '{}',  -- ['직장','거주지','인터넷','파워링크','인스타','외부간판','지인소개','네이버지도','네이버블로그','전단지']
  referral_detail TEXT,                  -- 지인소개 등 상세

  -- 운동목적 (복수선택)
  exercise_goals TEXT[] DEFAULT '{}',    -- ['다이어트(체지방감소)','근육량증가','체력향상','체형교정','통증개선','재활','기구사용']

  -- 병력사항 (복수선택)
  medical_conditions TEXT[] DEFAULT '{}', -- ['없음','호흡기질환','소화기질환','척추질환','관절질환','당뇨','고혈압']
  medical_detail TEXT,                    -- 기타 병력
  surgery_history TEXT,                   -- 과거or최근수술 / 그외질환
  surgery_detail TEXT,                    -- 수술내용 or 그외병력

  -- 운동경험 (복수선택)
  exercise_experiences TEXT[] DEFAULT '{}', -- ['없음','PT','헬스','필라테스','요가','골프','수영','구기']
  exercise_experience_detail TEXT,          -- 기타
  exercise_duration TEXT,                   -- 운동경력: '없음','3개월미만','3-6개월','6-12개월','1년이상'
  pt_satisfaction TEXT,                     -- PT만족도: '없음','상','중','하'
  pt_satisfaction_reason TEXT,              -- PT만족/불만족 이유

  -- 운동성격형태 (복수선택)
  exercise_personality TEXT[] DEFAULT '{}',
  -- ['지루함을 쉽게 느낀다','꾸준히 하나 식사조절 안됨','활동적인 운동 선호','차분한 운동 선호','힘들어야 한것같다','적당한 강도 선호']

  -- STEP 2: 트레이너 평가
  trainer_name TEXT,                      -- 담당 트레이너

  -- Inbody
  current_weight NUMERIC,
  target_weight NUMERIC,
  current_body_fat NUMERIC,
  target_body_fat NUMERIC,
  current_muscle_mass NUMERIC,
  target_muscle_mass NUMERIC,
  current_bmr NUMERIC,                    -- 기초대사량
  target_bmr NUMERIC,

  -- 근력평가 (JSONB로 유연하게)
  strength_eval_gender TEXT,              -- '남' | '여'
  strength_evaluations JSONB DEFAULT '[]', -- [{name, weight_kg, reps_kg, reps, rating}]

  -- 정적자세 평가
  posture_check_point TEXT,

  -- 분석 및 운동컨설팅
  analysis_content TEXT,                  -- 평가분석 내용
  recommended_program TEXT,               -- 트레이너 권장 운동프로그램
  recommended_duration TEXT,              -- 최종 기간 컨설팅: '3개월','6개월','12개월'

  -- 메타
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_consultation_cards_member ON consultation_cards(member_id);

-- RLS
ALTER TABLE consultation_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_cards_select" ON consultation_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "consultation_cards_insert" ON consultation_cards
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "consultation_cards_update" ON consultation_cards
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "consultation_cards_delete" ON consultation_cards
  FOR DELETE TO authenticated USING (true);
