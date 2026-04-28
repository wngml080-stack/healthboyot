-- 제외회원 기능: 관리자가 수동으로 회원을 제외 처리
ALTER TABLE ot_assignments
  ADD COLUMN IF NOT EXISTS is_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluded_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN ot_assignments.is_excluded IS '제외회원 여부 (관리자가 수동 지정)';
COMMENT ON COLUMN ot_assignments.excluded_reason IS '제외 사유';
COMMENT ON COLUMN ot_assignments.excluded_at IS '제외 처리 시각';
