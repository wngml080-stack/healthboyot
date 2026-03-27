-- =============================================
-- 트레이너도 회원 생성 가능 + 이전 고객 구분
-- =============================================

-- 1. members에 이전 고객 여부 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_existing_member BOOLEAN NOT NULL DEFAULT false;

-- 2. RLS: trainer도 members INSERT 허용
DROP POLICY IF EXISTS "members_insert" ON members;
CREATE POLICY "members_insert" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fc', 'trainer'))
  );

-- 3. RLS: trainer도 members UPDATE 허용
DROP POLICY IF EXISTS "members_update" ON members;
CREATE POLICY "members_update" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fc', 'trainer'))
  );

-- 4. RLS: trainer도 ot_assignments INSERT 허용
DROP POLICY IF EXISTS "ot_assignments_insert_admin" ON ot_assignments;
DROP POLICY IF EXISTS "ot_assignments_insert" ON ot_assignments;
CREATE POLICY "ot_assignments_insert" ON ot_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fc', 'trainer'))
  );
