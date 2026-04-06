-- 상담카드 상세 필드 추가
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS exercise_goal_detail TEXT;  -- 운동목적 상세 (수기)
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS body_correction_area TEXT;  -- 체형교정 부위
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS exercise_experience_history TEXT; -- 운동경험 상세 (PT 몇회, 헬스 기간 등)
