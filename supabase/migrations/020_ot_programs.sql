-- OT 프로그램 (Orientation Program) 테이블
CREATE TABLE IF NOT EXISTS ot_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ot_assignment_id UUID NOT NULL REFERENCES ot_assignments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- 프로그램 기본 정보
  trainer_name TEXT,                       -- 담당트레이너
  athletic_goal TEXT,                      -- 운동 목표
  total_sets_per_day INTEGER,              -- 총 1일 세트
  recommended_days_per_week INTEGER,       -- 권장운동일 (주 N회)
  exercise_duration_min INTEGER,           -- 운동 시간 (분)
  target_heart_rate INTEGER,               -- 목표심박수
  member_start_date DATE,                  -- 회원 시작일
  member_end_date DATE,                    -- 회원 만료일

  -- 1차~3차 세션 데이터 (JSONB)
  -- 각 세션: { date, time, exercises: [{name, weight, sets}], tip, next_ot_date, cardio: {types: [], duration_min} }
  session_1 JSONB DEFAULT '{}',
  session_2 JSONB DEFAULT '{}',
  session_3 JSONB DEFAULT '{}',

  -- 승인 상태
  approval_status TEXT DEFAULT '작성중' CHECK (approval_status IN ('작성중', '제출완료', '승인', '반려')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  -- 메타
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_ot_programs_assignment ON ot_programs(ot_assignment_id);
CREATE INDEX idx_ot_programs_member ON ot_programs(member_id);
CREATE INDEX idx_ot_programs_approval ON ot_programs(approval_status);

-- RLS
ALTER TABLE ot_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ot_programs_select" ON ot_programs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ot_programs_insert" ON ot_programs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ot_programs_update" ON ot_programs
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "ot_programs_delete" ON ot_programs
  FOR DELETE TO authenticated USING (true);
