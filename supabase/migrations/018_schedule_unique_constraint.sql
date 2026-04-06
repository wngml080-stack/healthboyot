-- =============================================
-- 018: trainer_schedules 동시성 안전 보장
-- trainer_id + ot_session_id 유니크 제약 추가
-- 동시 저장 시 중복 방지 (upsert 사용 가능)
-- =============================================

-- trainer_id + ot_session_id 유니크 (OT 세션당 트레이너당 1개)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_schedules_unique_ot
  ON trainer_schedules(trainer_id, ot_session_id)
  WHERE ot_session_id IS NOT NULL;
