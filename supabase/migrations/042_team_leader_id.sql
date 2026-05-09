-- 팀장-팀원 관계: profiles.team_leader_id
-- 팀원에게 소속 팀장 id를 저장 → 팀장은 팀원 폴더에 비밀번호 없이 접근 가능

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS team_leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_team_leader_id
  ON profiles(team_leader_id)
  WHERE team_leader_id IS NOT NULL;
