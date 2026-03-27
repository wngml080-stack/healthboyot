-- =============================================
-- 예상 회수 컬럼 추가
-- =============================================

ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS expected_sessions integer NOT NULL DEFAULT 0;
