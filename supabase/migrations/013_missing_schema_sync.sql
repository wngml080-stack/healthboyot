-- =============================================
-- 013: 코드 ↔ DB 스키마 동기화
-- TypeScript 타입에는 있지만 DB에 누락된 모든 컬럼/테이블 추가
-- =============================================

-- ─────────────────────────────────────────────
-- 1. ot_assignments: 세일즈/클로징 관련 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS registration_type TEXT;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS registration_route TEXT;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS expected_sales INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS actual_sales INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS membership_start_date DATE;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT '';
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS sales_status TEXT NOT NULL DEFAULT '';
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS expected_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS closing_probability INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS closing_fail_reason TEXT;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS sales_note TEXT;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS is_sales_target BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS is_pt_conversion BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS pt_assign_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS ppt_assign_status TEXT NOT NULL DEFAULT 'none';

-- ─────────────────────────────────────────────
-- 2. members: is_renewal 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 3. profiles: has_folder 컬럼 추가
-- ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_folder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- trainer / admin 역할은 기본으로 폴더 생성
UPDATE profiles SET has_folder = true WHERE role IN ('admin', 'trainer') AND has_folder = false;

-- ─────────────────────────────────────────────
-- 4. change_logs 테이블 (변경 이력 추적)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  changed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;

-- 전체 읽기 허용
DO $$ BEGIN
  CREATE POLICY "change_logs_select" ON change_logs
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 인증된 사용자 INSERT 허용
DO $$ BEGIN
  CREATE POLICY "change_logs_insert" ON change_logs
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_change_logs_target ON change_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_created ON change_logs(created_at DESC);

-- ─────────────────────────────────────────────
-- 5. trainer_schedules 테이블 (트레이너 일정)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL DEFAULT 'OT',
  member_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trainer_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "trainer_schedules_select" ON trainer_schedules
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "trainer_schedules_insert" ON trainer_schedules
    FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "trainer_schedules_update" ON trainer_schedules
    FOR UPDATE TO authenticated USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR trainer_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "trainer_schedules_delete" ON trainer_schedules
    FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      OR trainer_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_trainer_schedules_trainer ON trainer_schedules(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_schedules_date ON trainer_schedules(scheduled_date);

-- updated_at 트리거
CREATE TRIGGER trg_trainer_schedules_updated_at BEFORE UPDATE ON trainer_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE trainer_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE change_logs;

-- ─────────────────────────────────────────────
-- 6. 성능 인덱스
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ot_assignments_sales_status ON ot_assignments(sales_status) WHERE sales_status != '';
CREATE INDEX IF NOT EXISTS idx_ot_assignments_is_sales_target ON ot_assignments(is_sales_target) WHERE is_sales_target = true;
CREATE INDEX IF NOT EXISTS idx_ot_assignments_week ON ot_assignments(week_number);

-- ─────────────────────────────────────────────
-- 7. work_logs: member_id nullable로 변경 (알림 로그용)
-- ─────────────────────────────────────────────
ALTER TABLE work_logs ALTER COLUMN member_id DROP NOT NULL;
