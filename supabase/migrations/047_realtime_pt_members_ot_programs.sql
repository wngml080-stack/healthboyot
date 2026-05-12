-- PC ↔ 모바일 양방향 즉시 동기화를 위해 publication에 pt_members / ot_programs 추가.
-- 변경 행의 전체 컬럼이 페이로드에 들어가도록 REPLICA IDENTITY FULL도 함께 적용.
--
-- 이미 publication에 있는 테이블: ot_assignments, ot_sessions, members,
-- trainer_schedules, change_logs (001, 013에서 등록됨).
-- 추가: pt_members, ot_programs.
-- REPLICA IDENTITY FULL: trainer_schedules, ot_sessions, ot_assignments는
-- 046에서 처리. 여기선 신규 두 개 + members.

ALTER PUBLICATION supabase_realtime ADD TABLE pt_members;
ALTER PUBLICATION supabase_realtime ADD TABLE ot_programs;

ALTER TABLE pt_members REPLICA IDENTITY FULL;
ALTER TABLE ot_programs REPLICA IDENTITY FULL;
ALTER TABLE members REPLICA IDENTITY FULL;
