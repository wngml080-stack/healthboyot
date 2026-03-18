-- =============================================
-- 역할 확장 + 회원가입 승인 시스템
-- =============================================

-- 기존 ENUM에 새 역할 추가
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '관리자';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '팀장';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS '강사';

-- profiles에 승인 상태 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- 신규 유저 가입 트리거 수정 (미승인 상태로 생성)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role, is_approved, folder_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'fc'::user_role,
    false,
    NEW.raw_user_meta_data->>'password'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
