-- =============================================
-- 028: members.phone NULL 허용
-- PT 회원은 전화번호 없이도 등록 가능해야 함
-- UNIQUE 제약은 유지 (PostgreSQL은 NULL을 여러 개 허용)
-- =============================================

ALTER TABLE members
  ALTER COLUMN phone DROP NOT NULL;
