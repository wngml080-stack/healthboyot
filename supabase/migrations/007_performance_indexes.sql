-- 성능 최적화 인덱스 추가
-- 대부분의 쿼리가 created_at DESC로 정렬하므로 인덱스 필수

-- ot_assignments: created_at DESC 정렬 인덱스
CREATE INDEX IF NOT EXISTS idx_ot_assignments_created_at
  ON ot_assignments(created_at DESC);

-- ot_assignments: status + created_at 복합 인덱스 (대시보드/목록 필터)
CREATE INDEX IF NOT EXISTS idx_ot_assignments_status_created
  ON ot_assignments(status, created_at DESC);

-- profiles: role 인덱스 (RLS 정책 + 직원 목록)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles(role);

-- profiles: 폴더 조회용 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_approved_folder
  ON profiles(is_approved, has_folder) WHERE has_folder = true;

-- ot_sessions: 완료 여부 확인용
CREATE INDEX IF NOT EXISTS idx_ot_sessions_completed
  ON ot_sessions(ot_assignment_id, completed_at);
