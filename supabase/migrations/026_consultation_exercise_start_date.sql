-- 상담카드에 운동 시작일 컬럼 추가
ALTER TABLE consultation_cards
ADD COLUMN IF NOT EXISTS exercise_start_date DATE;
