-- trainer_schedules 복합 인덱스: 주간 스케줄 조회 최적화
-- 기존 개별 인덱스(trainer_id, scheduled_date)보다 복합 인덱스가 훨씬 효율적
-- 쿼리 패턴: .eq('trainer_id', id).gte('scheduled_date', start).lte('scheduled_date', end).order('start_time')

CREATE INDEX IF NOT EXISTS idx_trainer_schedules_trainer_date_time
  ON trainer_schedules (trainer_id, scheduled_date, start_time);

-- ot_assignments 자주 사용되는 필터 인덱스
CREATE INDEX IF NOT EXISTS idx_ot_assignments_status
  ON ot_assignments (status);

CREATE INDEX IF NOT EXISTS idx_ot_assignments_pt_trainer
  ON ot_assignments (pt_trainer_id);

CREATE INDEX IF NOT EXISTS idx_ot_assignments_ppt_trainer
  ON ot_assignments (ppt_trainer_id);

CREATE INDEX IF NOT EXISTS idx_ot_assignments_created_at
  ON ot_assignments (created_at DESC);

-- members 등록일 정렬 인덱스
CREATE INDEX IF NOT EXISTS idx_members_registered_at
  ON members (registered_at DESC);
