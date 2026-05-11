-- 종목(ot_category_type) enum에 '헬스,필라' 와 '등록후 환불' 추가
-- ALTER TYPE ADD VALUE 는 transaction block 안에서 실행 불가 → DO 블록 사용 안 함
-- IF NOT EXISTS 는 Postgres 9.6+ 에서 지원

ALTER TYPE ot_category_type ADD VALUE IF NOT EXISTS '헬스,필라';
ALTER TYPE ot_category_type ADD VALUE IF NOT EXISTS '등록후 환불';
