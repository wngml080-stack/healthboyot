-- 직원 근무시간 설정 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_start_time TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS work_end_time TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.work_start_time IS '근무 시작 시간 (HH:MM 형식, 예: 09:00)';
COMMENT ON COLUMN profiles.work_end_time IS '근무 종료 시간 (HH:MM 형식, 예: 18:00)';
