-- 트레이너 폴더 데이터를 1회 호출로 반환하는 RPC 함수
-- 기존: profiles 쿼리 + assignments 쿼리 + schedules 쿼리 = 3회 왕복
-- 변경: 1회 RPC 호출로 모든 데이터 반환

CREATE OR REPLACE FUNCTION get_trainer_folders_data(today_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH trainer_list AS (
    SELECT id, name, role, folder_password, folder_order
    FROM profiles
    WHERE role != 'admin' AND is_approved = true AND has_folder = true
    ORDER BY folder_order ASC, name ASC
  ),
  trainer_assignments AS (
    SELECT
      a.pt_trainer_id,
      a.ppt_trainer_id,
      a.is_sales_target,
      a.is_pt_conversion,
      a.created_at,
      m.id as member_id,
      m.name as member_name
    FROM ot_assignments a
    JOIN members m ON m.id = a.member_id
    WHERE a.is_excluded = false
      AND (a.pt_trainer_id IN (SELECT id FROM trainer_list) OR a.ppt_trainer_id IN (SELECT id FROM trainer_list))
    LIMIT 2000
  ),
  today_schedules AS (
    SELECT trainer_id, member_name
    FROM trainer_schedules
    WHERE scheduled_date = today_date
      AND schedule_type = 'OT'
      AND trainer_id IN (SELECT id FROM trainer_list)
  ),
  all_staff AS (
    SELECT id, name, role, is_approved
    FROM profiles
    ORDER BY role, name
  )
  SELECT json_build_object(
    'trainers', (SELECT json_agg(row_to_json(t)) FROM trainer_list t),
    'assignments', (SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json) FROM trainer_assignments a),
    'todaySchedules', (SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) FROM today_schedules s),
    'allStaff', (SELECT json_agg(row_to_json(st)) FROM all_staff st)
  ) INTO result;

  RETURN result;
END;
$$;
