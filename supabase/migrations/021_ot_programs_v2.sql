-- OT 프로그램 세션을 무제한 확장 (session_1~3 JSONB → sessions JSONB 배열)
-- 이미지 업로드용 필드 추가
-- 상담카드 연동 필드 추가

-- 기존 session_1, session_2, session_3을 sessions 배열로 통합
ALTER TABLE ot_programs ADD COLUMN IF NOT EXISTS sessions JSONB DEFAULT '[]';

-- 상담카드 데이터 자동 연동용
ALTER TABLE ot_programs ADD COLUMN IF NOT EXISTS consultation_data JSONB DEFAULT '{}';

-- 인바디 데이터
ALTER TABLE ot_programs ADD COLUMN IF NOT EXISTS inbody_data JSONB DEFAULT '{}';

-- 이미지 URLs (Supabase Storage)
ALTER TABLE ot_programs ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- 기존 데이터 마이그레이션: session_1~3 → sessions 배열
UPDATE ot_programs
SET sessions = jsonb_build_array(
  COALESCE(session_1, '{}'::jsonb),
  COALESCE(session_2, '{}'::jsonb),
  COALESCE(session_3, '{}'::jsonb)
)
WHERE sessions = '[]'::jsonb
  AND (session_1 IS NOT NULL OR session_2 IS NOT NULL OR session_3 IS NOT NULL);

-- Supabase Storage 버킷 생성 (이미지 업로드용)
-- 주의: 이 SQL은 Supabase 대시보드 Storage에서 직접 생성해야 할 수도 있음
INSERT INTO storage.buckets (id, name, public)
VALUES ('ot-images', 'ot-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "ot_images_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ot-images');

CREATE POLICY "ot_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ot-images');

CREATE POLICY "ot_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ot-images');
