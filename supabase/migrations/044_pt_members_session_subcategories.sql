-- pt_members 세션 카테고리 세분화: 공구(공동구매) / 바챌
-- 기존 sessions_in / sessions_out와 별도로 카운트

ALTER TABLE pt_members
  ADD COLUMN IF NOT EXISTS sessions_group_purchase int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_bachal int NOT NULL DEFAULT 0;

COMMENT ON COLUMN pt_members.sessions_group_purchase IS '공동구매(공구) 진행 세션 수';
COMMENT ON COLUMN pt_members.sessions_bachal IS '바챌 진행 세션 수';
