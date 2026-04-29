-- =============================================
-- RLS 성능 최적화: auth.uid()를 (select auth.uid())로 변경
-- Supabase Linter 경고 수정:
--   1) auth_rls_initplan: 매 행마다 auth.uid() 재평가 방지
--   2) multiple_permissive_policies: profiles 중복 정책 병합
--   3) duplicate_index: profiles 중복 인덱스 제거
-- =============================================

-- ============ 1. profiles 테이블 ============

-- 기존 정책 모두 제거
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;

-- 새 정책 (select auth.uid()) 적용
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);

-- INSERT: 본인 또는 admin/관리자 (하나로 병합)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );

-- UPDATE: 본인 또는 admin/관리자 (하나로 병합)
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );

-- DELETE: admin/관리자만
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );


-- ============ 2. members 테이블 ============

DROP POLICY IF EXISTS "members_select" ON members;
DROP POLICY IF EXISTS "members_insert" ON members;
DROP POLICY IF EXISTS "members_update" ON members;
DROP POLICY IF EXISTS "members_delete" ON members;

CREATE POLICY "members_select" ON members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_insert" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자', '팀장', 'fc', 'trainer', '강사'))
  );

CREATE POLICY "members_update" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자', '팀장', 'fc', 'trainer', '강사'))
  );

CREATE POLICY "members_delete" ON members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );


-- ============ 3. ot_assignments 테이블 ============

DROP POLICY IF EXISTS "ot_assignments_select" ON ot_assignments;
DROP POLICY IF EXISTS "ot_assignments_insert" ON ot_assignments;
DROP POLICY IF EXISTS "ot_assignments_insert_admin" ON ot_assignments;
DROP POLICY IF EXISTS "ot_assignments_update" ON ot_assignments;
DROP POLICY IF EXISTS "ot_assignments_delete" ON ot_assignments;

CREATE POLICY "ot_assignments_select" ON ot_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ot_assignments_insert" ON ot_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자', 'fc', 'trainer', '팀장', '강사'))
  );

CREATE POLICY "ot_assignments_update" ON ot_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
    OR pt_trainer_id = (select auth.uid())
    OR ppt_trainer_id = (select auth.uid())
    OR assigned_by = (select auth.uid())
  );

CREATE POLICY "ot_assignments_delete" ON ot_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );


-- ============ 4. ot_sessions 테이블 ============

DROP POLICY IF EXISTS "ot_sessions_select" ON ot_sessions;
DROP POLICY IF EXISTS "ot_sessions_insert" ON ot_sessions;
DROP POLICY IF EXISTS "ot_sessions_update" ON ot_sessions;
DROP POLICY IF EXISTS "ot_sessions_delete" ON ot_sessions;

CREATE POLICY "ot_sessions_select" ON ot_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ot_sessions_insert" ON ot_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
    OR EXISTS (
      SELECT 1 FROM ot_assignments oa
      WHERE oa.id = ot_sessions.ot_assignment_id
      AND (oa.pt_trainer_id = (select auth.uid()) OR oa.ppt_trainer_id = (select auth.uid()))
    )
  );

CREATE POLICY "ot_sessions_update" ON ot_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
    OR EXISTS (
      SELECT 1 FROM ot_assignments oa
      WHERE oa.id = ot_sessions.ot_assignment_id
      AND (oa.pt_trainer_id = (select auth.uid()) OR oa.ppt_trainer_id = (select auth.uid()))
    )
  );

CREATE POLICY "ot_sessions_delete" ON ot_sessions
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );


-- ============ 5. work_logs 테이블 ============

DROP POLICY IF EXISTS "work_logs_select" ON work_logs;
DROP POLICY IF EXISTS "work_logs_insert" ON work_logs;

CREATE POLICY "work_logs_select" ON work_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "work_logs_insert" ON work_logs
  FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()));


-- ============ 6. sales_targets 테이블 ============

DROP POLICY IF EXISTS "sales_targets_select" ON sales_targets;
DROP POLICY IF EXISTS "sales_targets_insert" ON sales_targets;
DROP POLICY IF EXISTS "sales_targets_update" ON sales_targets;

CREATE POLICY "sales_targets_select" ON sales_targets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sales_targets_insert" ON sales_targets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );

CREATE POLICY "sales_targets_update" ON sales_targets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role IN ('admin', '관리자'))
  );


-- ============ 7. trainer_schedules 테이블 ============

DROP POLICY IF EXISTS "trainer_schedules_select" ON trainer_schedules;
DROP POLICY IF EXISTS "trainer_schedules_insert" ON trainer_schedules;
DROP POLICY IF EXISTS "trainer_schedules_update" ON trainer_schedules;
DROP POLICY IF EXISTS "trainer_schedules_delete" ON trainer_schedules;

CREATE POLICY "trainer_schedules_select" ON trainer_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "trainer_schedules_insert" ON trainer_schedules
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role IN ('admin', '관리자', '팀장', 'trainer', '강사')
    )
  );

CREATE POLICY "trainer_schedules_update" ON trainer_schedules
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role IN ('admin', '관리자', '팀장')
    )
    OR trainer_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM ot_sessions os
      JOIN ot_assignments oa ON oa.id = os.ot_assignment_id
      WHERE os.id = trainer_schedules.ot_session_id
      AND (oa.pt_trainer_id = (select auth.uid()) OR oa.ppt_trainer_id = (select auth.uid()))
    )
  );

CREATE POLICY "trainer_schedules_delete" ON trainer_schedules
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role IN ('admin', '관리자', '팀장')
    )
    OR trainer_id = (select auth.uid())
  );


-- ============ 8. 중복 인덱스 제거 ============

-- idx_profiles_approved_folder와 idx_profiles_folder가 중복
-- idx_profiles_folder를 유지하고 idx_profiles_approved_folder 제거
DROP INDEX IF EXISTS idx_profiles_approved_folder;
