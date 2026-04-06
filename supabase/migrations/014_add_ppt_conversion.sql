-- PPT전환 필드 추가
ALTER TABLE ot_assignments ADD COLUMN IF NOT EXISTS is_ppt_conversion boolean DEFAULT false;
