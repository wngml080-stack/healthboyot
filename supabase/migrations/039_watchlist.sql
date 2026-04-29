-- 관리대상 회원 표시 컬럼 추가
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS is_watchlist boolean NOT NULL DEFAULT false;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS watchlist_reason text;
