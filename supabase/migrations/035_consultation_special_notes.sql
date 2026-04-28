-- 상담카드에 특이사항 필드 추가
ALTER TABLE consultation_cards
  ADD COLUMN IF NOT EXISTS special_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN consultation_cards.special_notes IS '특이사항 (트레이너/관리자 메모)';
