-- pt_members 월별 분리 저장
-- 같은 회원도 월마다 다른 row로 저장: (trainer_id, name, data_month) 조합이 유일

ALTER TABLE pt_members
  ADD COLUMN IF NOT EXISTS data_month text;

-- 기존 row는 현재 월로 백필 (KST 기준 'YYYY-MM')
UPDATE pt_members
SET data_month = TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM')
WHERE data_month IS NULL;

-- 조회 패턴: trainer_id + data_month
CREATE INDEX IF NOT EXISTS idx_pt_members_trainer_month
  ON pt_members(trainer_id, data_month);

COMMENT ON COLUMN pt_members.data_month IS '데이터 귀속 월 (YYYY-MM 형식). 같은 회원도 월마다 다른 row로 저장됨';
