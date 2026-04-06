-- =============================================
-- 017: trainer_schedules 스키마 개선
-- ot_session_id 추가로 OT 세션과 정확한 연결
-- member_name 외에 member_id 참조 추가
-- RLS 정책 보강 (관리자/팀장/강사 역할 포함)
-- =============================================

-- 1. ot_session_id 컬럼 추가 (OT 세션과 1:1 매핑)
ALTER TABLE trainer_schedules
  ADD COLUMN IF NOT EXISTS ot_session_id UUID REFERENCES ot_sessions(id) ON DELETE SET NULL;

-- 2. member_id 컬럼 추가 (문자열 매칭 대신 FK 사용)
ALTER TABLE trainer_schedules
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_trainer_schedules_ot_session
  ON trainer_schedules(ot_session_id) WHERE ot_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_schedules_member
  ON trainer_schedules(member_id) WHERE member_id IS NOT NULL;

-- 4. RLS 정책 보강: 관리자/팀장/강사 역할도 INSERT/UPDATE/DELETE 허용
-- 기존 INSERT 정책 삭제 후 재생성
DROP POLICY IF EXISTS "trainer_schedules_insert" ON trainer_schedules;
CREATE POLICY "trainer_schedules_insert" ON trainer_schedules
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', '관리자', '팀장', 'trainer', '강사')
    )
  );

-- 기존 UPDATE 정책 삭제 후 재생성
DROP POLICY IF EXISTS "trainer_schedules_update" ON trainer_schedules;
CREATE POLICY "trainer_schedules_update" ON trainer_schedules
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', '관리자', '팀장')
    )
    OR trainer_id = auth.uid()
  );

-- 기존 DELETE 정책 삭제 후 재생성
DROP POLICY IF EXISTS "trainer_schedules_delete" ON trainer_schedules;
CREATE POLICY "trainer_schedules_delete" ON trainer_schedules
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', '관리자', '팀장')
    )
    OR trainer_id = auth.uid()
  );
