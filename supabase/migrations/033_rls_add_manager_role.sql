-- RLS 정책에 '관리자' role 추가 (admin과 동일 권한)

-- ot_assignments: UPDATE
DROP POLICY IF EXISTS ot_assignments_update ON ot_assignments;
CREATE POLICY ot_assignments_update ON ot_assignments FOR UPDATE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자')))
    OR pt_trainer_id = auth.uid()
    OR ppt_trainer_id = auth.uid()
    OR assigned_by = auth.uid()
  );

-- ot_assignments: DELETE
DROP POLICY IF EXISTS ot_assignments_delete ON ot_assignments;
CREATE POLICY ot_assignments_delete ON ot_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자'))
  );

-- ot_assignments: INSERT
DROP POLICY IF EXISTS ot_assignments_insert ON ot_assignments;
CREATE POLICY ot_assignments_insert ON ot_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자', 'fc', 'trainer', '팀장', '강사'))
  );

-- ot_sessions: INSERT
DROP POLICY IF EXISTS ot_sessions_insert ON ot_sessions;
CREATE POLICY ot_sessions_insert ON ot_sessions FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자')))
    OR (EXISTS (SELECT 1 FROM ot_assignments oa WHERE oa.id = ot_sessions.ot_assignment_id AND (oa.pt_trainer_id = auth.uid() OR oa.ppt_trainer_id = auth.uid())))
  );

-- ot_sessions: UPDATE
DROP POLICY IF EXISTS ot_sessions_update ON ot_sessions;
CREATE POLICY ot_sessions_update ON ot_sessions FOR UPDATE TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자')))
    OR (EXISTS (SELECT 1 FROM ot_assignments oa WHERE oa.id = ot_sessions.ot_assignment_id AND (oa.pt_trainer_id = auth.uid() OR oa.ppt_trainer_id = auth.uid())))
  );

-- ot_sessions: DELETE
DROP POLICY IF EXISTS ot_sessions_delete ON ot_sessions;
CREATE POLICY ot_sessions_delete ON ot_sessions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자'))
  );

-- members: DELETE
DROP POLICY IF EXISTS members_delete ON members;
CREATE POLICY members_delete ON members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자'))
  );

-- members: INSERT (관리자/팀장 추가)
DROP POLICY IF EXISTS members_insert ON members;
CREATE POLICY members_insert ON members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자', '팀장', 'fc', 'trainer', '강사'))
  );

-- members: UPDATE (관리자/팀장 추가)
DROP POLICY IF EXISTS members_update ON members;
CREATE POLICY members_update ON members FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', '관리자', '팀장', 'fc', 'trainer', '강사'))
  );
