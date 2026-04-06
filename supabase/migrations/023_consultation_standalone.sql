-- 상담카드를 회원 없이 독립 작성 가능하도록 변경
-- member_id를 nullable로 변경
ALTER TABLE consultation_cards ALTER COLUMN member_id DROP NOT NULL;

-- 상담카드 상태 필드 추가
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '미연결' CHECK (status IN ('미연결', '연결완료'));

-- 상담카드에 이름/연락처/성별 직접 저장 (회원 생성 전에도 검색 가능)
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS member_phone TEXT;
ALTER TABLE consultation_cards ADD COLUMN IF NOT EXISTS member_gender TEXT;
