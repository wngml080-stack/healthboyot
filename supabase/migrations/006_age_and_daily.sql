-- 회원 나이/생년월일 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS age_group TEXT; -- 10대/20대/30대/40대/50대+
