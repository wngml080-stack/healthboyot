-- =============================================
-- 실제 OT 스프레드시트 형식 반영 마이그레이션
-- =============================================

-- OT 종목 ENUM
CREATE TYPE ot_category_type AS ENUM ('헬스', 'PT등록', '필라', '거부');

-- members 테이블 변경
ALTER TABLE members RENAME COLUMN available_time TO exercise_time;
ALTER TABLE members ADD COLUMN ot_category ot_category_type;
ALTER TABLE members ADD COLUMN detail_info TEXT;
ALTER TABLE members ADD COLUMN start_date DATE;
ALTER TABLE members ADD COLUMN is_completed BOOLEAN NOT NULL DEFAULT false;

-- 기존 sports 데이터 → ot_category 마이그레이션
UPDATE members SET ot_category = '헬스' WHERE '헬스' = ANY(sports);
UPDATE members SET ot_category = 'PT등록' WHERE 'PT등록' = ANY(sports) AND ot_category IS NULL;
UPDATE members SET ot_category = '필라' WHERE ('필라테스' = ANY(sports) OR '필라' = ANY(sports)) AND ot_category IS NULL;

-- 기존 injury_tags, duration_months → detail_info 마이그레이션
UPDATE members SET detail_info = CONCAT_WS(' / ',
  CASE WHEN duration_months IS NOT NULL THEN duration_months || '개월' END,
  CASE WHEN array_length(injury_tags, 1) > 0 THEN array_to_string(injury_tags, ',') END,
  notes
) WHERE detail_info IS NULL AND (duration_months IS NOT NULL OR array_length(injury_tags, 1) > 0);

-- profiles 테이블에 폴더 비밀번호 추가
ALTER TABLE profiles ADD COLUMN folder_password TEXT;

-- ot_assignments 테이블에 OT 종목 추가
ALTER TABLE ot_assignments ADD COLUMN ot_category ot_category_type;
