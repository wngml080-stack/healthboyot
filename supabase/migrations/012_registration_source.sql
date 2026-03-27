-- =============================================
-- 회원 등록 출처 구분 (자동 vs 수기)
-- =============================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS registration_source TEXT NOT NULL DEFAULT '자동';

-- 기존 데이터는 모두 '자동'으로 설정 (시스템 등록)
COMMENT ON COLUMN members.registration_source IS '등록 출처: 자동(시스템/관리자) 또는 수기(트레이너 직접 등록)';
