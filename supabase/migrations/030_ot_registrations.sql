-- =============================================
-- OT 인정건수 (회원권 등록 시 트레이너가 수기 입력 → 관리자 승인)
-- =============================================
CREATE TABLE IF NOT EXISTS ot_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id),
  member_name TEXT NOT NULL,
  membership_type TEXT NOT NULL,        -- 등록 회원권 (예: 헬스3개월, PT20회)
  registration_amount INTEGER NOT NULL DEFAULT 0,  -- 등록 금액 (만원 단위)
  ot_credit INTEGER NOT NULL DEFAULT 1, -- 인정 건수

  -- 승인 워크플로우
  approval_status TEXT NOT NULL DEFAULT '제출완료' CHECK (approval_status IN ('제출완료', '승인', '반려')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ot_registrations ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 읽기/쓰기
CREATE POLICY "ot_registrations_select" ON ot_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ot_registrations_insert" ON ot_registrations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ot_registrations_update" ON ot_registrations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ot_registrations_delete" ON ot_registrations FOR DELETE TO authenticated USING (true);

-- 인덱스
CREATE INDEX idx_ot_registrations_trainer ON ot_registrations(trainer_id);
CREATE INDEX idx_ot_registrations_status ON ot_registrations(approval_status);
