-- =============================================
-- 027: trainer_schedules UPDATE 정책 확장
-- 드래그 이동 시 PT/PPT 양쪽 트레이너의 row를 한 번에 update할 수 있도록
-- ot_session_id가 가리키는 ot_assignment의 PT/PPT 트레이너거나 admin이면 update 허용
-- =============================================

DROP POLICY IF EXISTS "trainer_schedules_update" ON trainer_schedules;
CREATE POLICY "trainer_schedules_update" ON trainer_schedules
  FOR UPDATE TO authenticated USING (
    -- 1) admin/관리자/팀장 — 모두 허용
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', '관리자', '팀장')
    )
    -- 2) 본인 trainer_id — 자기 일정
    OR trainer_id = auth.uid()
    -- 3) 같은 ot_session에 묶인 PT/PPT 트레이너 본인 — 드래그 이동 시 양쪽 row 동기화
    OR EXISTS (
      SELECT 1 FROM ot_sessions os
      JOIN ot_assignments oa ON oa.id = os.ot_assignment_id
      WHERE os.id = trainer_schedules.ot_session_id
      AND (oa.pt_trainer_id = auth.uid() OR oa.ppt_trainer_id = auth.uid())
    )
  );
