-- =============================================
-- session_number 제한 해제 (1~3 → 1 이상)
-- 4차, 5차, 6차 등 추가 세션 지원
-- =============================================

ALTER TABLE ot_sessions DROP CONSTRAINT IF EXISTS ot_sessions_session_number_check;
ALTER TABLE ot_sessions ADD CONSTRAINT ot_sessions_session_number_check CHECK (session_number >= 1);
