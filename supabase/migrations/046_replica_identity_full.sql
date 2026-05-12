-- trainer_schedules / ot_assignments / ot_sessions DELETE 이벤트가
-- Supabase Realtime 필터를 통과하도록 REPLICA IDENTITY FULL 설정.
--
-- 배경: 기본 REPLICA IDENTITY DEFAULT는 primary key 컬럼만 변경 페이로드에 포함.
-- DELETE 이벤트 페이로드에 trainer_id 같은 필터링 컬럼이 빠져서 필터 통과 못함 →
-- 다른 디바이스에서 스케줄 삭제 시 실시간으로 안 사라지는 문제.
-- FULL로 설정하면 변경 row의 전체 컬럼이 페이로드에 포함되어 모든 필터가 작동.

ALTER TABLE trainer_schedules REPLICA IDENTITY FULL;
ALTER TABLE ot_sessions REPLICA IDENTITY FULL;
ALTER TABLE ot_assignments REPLICA IDENTITY FULL;
