-- 담당자 배정 시점 기록 필드 추가
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- 기존 데이터: created_at을 기본값으로 설정
UPDATE ot_assignments SET assigned_at = created_at WHERE assigned_at IS NULL;
