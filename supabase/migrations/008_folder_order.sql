-- 폴더 정렬 순서 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS folder_order INTEGER DEFAULT 0;

-- 기존 폴더들에 순서 부여 (이름순)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM profiles
  WHERE has_folder = true
)
UPDATE profiles SET folder_order = ordered.rn
FROM ordered WHERE profiles.id = ordered.id;
