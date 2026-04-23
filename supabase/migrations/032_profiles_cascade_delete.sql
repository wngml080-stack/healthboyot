-- 직원 삭제 시 연관 FK를 SET NULL로 변경 (직원 삭제 가능하도록)
-- trainer_schedules는 CASCADE DELETE (직원 삭제 시 스케줄도 삭제)

-- trainer_schedules: CASCADE
ALTER TABLE trainer_schedules DROP CONSTRAINT IF EXISTS trainer_schedules_trainer_id_fkey;
ALTER TABLE trainer_schedules ADD CONSTRAINT trainer_schedules_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ot_assignments: SET NULL
ALTER TABLE ot_assignments DROP CONSTRAINT IF EXISTS ot_assignments_pt_trainer_id_fkey;
ALTER TABLE ot_assignments ADD CONSTRAINT ot_assignments_pt_trainer_id_fkey
  FOREIGN KEY (pt_trainer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ot_assignments DROP CONSTRAINT IF EXISTS ot_assignments_ppt_trainer_id_fkey;
ALTER TABLE ot_assignments ADD CONSTRAINT ot_assignments_ppt_trainer_id_fkey
  FOREIGN KEY (ppt_trainer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ot_assignments DROP CONSTRAINT IF EXISTS ot_assignments_assigned_by_fkey;
ALTER TABLE ot_assignments ADD CONSTRAINT ot_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- members: SET NULL
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_created_by_fkey;
ALTER TABLE members ADD CONSTRAINT members_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- work_logs: SET NULL
ALTER TABLE work_logs DROP CONSTRAINT IF EXISTS work_logs_author_id_fkey;
ALTER TABLE work_logs ADD CONSTRAINT work_logs_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- sales_targets: SET NULL
ALTER TABLE sales_targets DROP CONSTRAINT IF EXISTS sales_targets_created_by_fkey;
ALTER TABLE sales_targets ADD CONSTRAINT sales_targets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- change_logs: SET NULL
ALTER TABLE change_logs DROP CONSTRAINT IF EXISTS change_logs_changed_by_fkey;
ALTER TABLE change_logs ADD CONSTRAINT change_logs_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- consultation_cards: SET NULL
ALTER TABLE consultation_cards DROP CONSTRAINT IF EXISTS consultation_cards_created_by_fkey;
ALTER TABLE consultation_cards ADD CONSTRAINT consultation_cards_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ot_programs: SET NULL
ALTER TABLE ot_programs DROP CONSTRAINT IF EXISTS ot_programs_approved_by_fkey;
ALTER TABLE ot_programs ADD CONSTRAINT ot_programs_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ot_programs DROP CONSTRAINT IF EXISTS ot_programs_created_by_fkey;
ALTER TABLE ot_programs ADD CONSTRAINT ot_programs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ot_registrations: SET NULL
ALTER TABLE ot_registrations DROP CONSTRAINT IF EXISTS ot_registrations_trainer_id_fkey;
ALTER TABLE ot_registrations ADD CONSTRAINT ot_registrations_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ot_registrations DROP CONSTRAINT IF EXISTS ot_registrations_approved_by_fkey;
ALTER TABLE ot_registrations ADD CONSTRAINT ot_registrations_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
