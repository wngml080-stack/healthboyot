-- PT회원 페이롤 양식 필드 추가
-- 회원명/전월잔여/구분/등록금액/세션/IN/OUT/진행세션/남은세션/담당/인계세션/특수매출/환불금액/환불세션

ALTER TABLE pt_members
  ADD COLUMN IF NOT EXISTS previous_remaining int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS registration_amount int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_added int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_in int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_out int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handover_to text,
  ADD COLUMN IF NOT EXISTS handover_sessions int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_sales int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_sessions int NOT NULL DEFAULT 0;

COMMENT ON COLUMN pt_members.previous_remaining IS '전월잔여 세션';
COMMENT ON COLUMN pt_members.category IS '구분: 기존/재등록/신규/양도/인계/세션변경';
COMMENT ON COLUMN pt_members.registration_amount IS '등록금액 (원)';
COMMENT ON COLUMN pt_members.sessions_added IS '신규 등록 세션 수';
COMMENT ON COLUMN pt_members.sessions_in IS 'IN: 인계 받은 세션';
COMMENT ON COLUMN pt_members.sessions_out IS 'OUT: 진행한 세션';
COMMENT ON COLUMN pt_members.handover_to IS '인계 담당자 이름';
COMMENT ON COLUMN pt_members.handover_sessions IS '인계 세션 (음수 가능)';
COMMENT ON COLUMN pt_members.special_sales IS '특수매출 (원)';
COMMENT ON COLUMN pt_members.refund_amount IS '환불금액 (음수 가능)';
COMMENT ON COLUMN pt_members.refund_sessions IS '환불세션 (음수 가능)';
