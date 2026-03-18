-- =============================================
-- 헬스장 OT 관리 시스템 - 초기 스키마
-- =============================================

-- ENUM 타입 정의
CREATE TYPE user_role AS ENUM ('admin', 'trainer', 'fc');
CREATE TYPE gender_type AS ENUM ('남', '여');
CREATE TYPE ot_status AS ENUM ('신청대기', '배정완료', '진행중', '완료', '거부', '추후결정');
CREATE TYPE log_type AS ENUM ('FC', 'PT');

-- =============================================
-- 1. profiles (auth.users 1:1)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'fc',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 2. members (회원)
-- =============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  gender gender_type,
  sports TEXT[] NOT NULL DEFAULT '{}',
  duration_months INTEGER,
  available_time TEXT,
  injury_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. ot_assignments (OT 배정)
-- =============================================
CREATE TABLE ot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status ot_status NOT NULL DEFAULT '신청대기',
  pt_trainer_id UUID REFERENCES profiles(id),
  ppt_trainer_id UUID REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 OT 배정은 회원당 1개만 (완료/거부 제외)
CREATE UNIQUE INDEX idx_ot_assignments_active_member
  ON ot_assignments(member_id)
  WHERE status NOT IN ('완료', '거부');

-- =============================================
-- 4. ot_sessions (OT 세션 1/2/3차)
-- =============================================
CREATE TABLE ot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_assignment_id UUID NOT NULL REFERENCES ot_assignments(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL CHECK (session_number BETWEEN 1 AND 3),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ot_assignment_id, session_number)
);

-- =============================================
-- 5. work_logs (업무일지)
-- =============================================
CREATE TABLE work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  log_type log_type NOT NULL DEFAULT 'FC',
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_registered_at ON members(registered_at DESC);
CREATE INDEX idx_ot_assignments_status ON ot_assignments(status);
CREATE INDEX idx_ot_assignments_member ON ot_assignments(member_id);
CREATE INDEX idx_ot_assignments_pt_trainer ON ot_assignments(pt_trainer_id);
CREATE INDEX idx_ot_assignments_ppt_trainer ON ot_assignments(ppt_trainer_id);
CREATE INDEX idx_ot_sessions_assignment ON ot_sessions(ot_assignment_id);
CREATE INDEX idx_ot_sessions_scheduled ON ot_sessions(scheduled_at);
CREATE INDEX idx_work_logs_member ON work_logs(member_id);
CREATE INDEX idx_work_logs_author ON work_logs(author_id);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ot_assignments_updated_at BEFORE UPDATE ON ot_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ot_sessions_updated_at BEFORE UPDATE ON ot_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 신규 유저 가입 시 profiles 자동 생성
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'fc')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- members: 전체 읽기, admin/fc만 생성/수정
CREATE POLICY "members_select" ON members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fc'))
  );
CREATE POLICY "members_update" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fc'))
  );

-- ot_assignments: 전체 읽기, admin만 생성, admin+배정 트레이너 수정
CREATE POLICY "ot_assignments_select" ON ot_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ot_assignments_insert_admin" ON ot_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "ot_assignments_update" ON ot_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR pt_trainer_id = auth.uid()
    OR ppt_trainer_id = auth.uid()
  );

-- ot_sessions: 전체 읽기, admin 생성, admin+배정 트레이너 수정
CREATE POLICY "ot_sessions_select" ON ot_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ot_sessions_insert" ON ot_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM ot_assignments oa
      WHERE oa.id = ot_assignment_id
      AND (oa.pt_trainer_id = auth.uid() OR oa.ppt_trainer_id = auth.uid())
    )
  );
CREATE POLICY "ot_sessions_update" ON ot_sessions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM ot_assignments oa
      WHERE oa.id = ot_assignment_id
      AND (oa.pt_trainer_id = auth.uid() OR oa.ppt_trainer_id = auth.uid())
    )
  );

-- work_logs: 전체 읽기, 본인만 생성
CREATE POLICY "work_logs_select" ON work_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "work_logs_insert" ON work_logs
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- =============================================
-- Realtime 활성화 (OT 관련 테이블)
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE ot_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE ot_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
