-- 성능 최적화 인덱스 추가
-- 자주 사용되는 쿼리 패턴에 맞춘 복합 인덱스

-- ot_assignments: 트레이너별 조회 (폴더뷰, 상세뷰)
CREATE INDEX IF NOT EXISTS idx_ot_assignments_pt_trainer
  ON ot_assignments (pt_trainer_id) WHERE pt_trainer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ot_assignments_ppt_trainer
  ON ot_assignments (ppt_trainer_id) WHERE ppt_trainer_id IS NOT NULL;

-- ot_assignments: 상태별 조회
CREATE INDEX IF NOT EXISTS idx_ot_assignments_status
  ON ot_assignments (status);

-- ot_assignments: 제외회원 필터링
CREATE INDEX IF NOT EXISTS idx_ot_assignments_excluded
  ON ot_assignments (is_excluded);

-- ot_sessions: assignment별 세션 조회
CREATE INDEX IF NOT EXISTS idx_ot_sessions_assignment
  ON ot_sessions (ot_assignment_id);

-- trainer_schedules: 날짜+트레이너별 조회 (캘린더, 폴더뷰)
CREATE INDEX IF NOT EXISTS idx_trainer_schedules_date_trainer
  ON trainer_schedules (scheduled_date, trainer_id);

-- consultation_cards: 회원별 조회
CREATE INDEX IF NOT EXISTS idx_consultation_cards_member
  ON consultation_cards (member_id);

-- ot_programs: assignment별 조회
CREATE INDEX IF NOT EXISTS idx_ot_programs_assignment
  ON ot_programs (ot_assignment_id);

-- profiles: 폴더 조회 (승인 + 폴더 활성)
CREATE INDEX IF NOT EXISTS idx_profiles_folder
  ON profiles (is_approved, has_folder) WHERE has_folder = true;

-- members: 이름 검색
CREATE INDEX IF NOT EXISTS idx_members_name
  ON members (name);

-- change_logs: 타겟별 조회
CREATE INDEX IF NOT EXISTS idx_change_logs_target
  ON change_logs (target_id, created_at DESC);
