-- =============================================
-- 3월 스케줄 데이터 입력 (기존 회원 대상)
-- 기존 회원의 기존 배정에 세션만 upsert
-- Supabase SQL Editor에서 실행
-- =============================================

-- [선행] 트레이너 ID 확인 쿼리 (먼저 실행해서 확인)
-- SELECT id, name, role FROM profiles ORDER BY name;

DO $$
DECLARE
  v_박규민 UUID;
  v_오종민 UUID;
  v_김석현 UUID;
  v_유창욱 UUID;
  v_정가윤 UUID;
  v_구은솔 UUID;
  v_member_id UUID;
  v_assign_id UUID;
BEGIN
  -- ── 트레이너 ID 조회 ──
  SELECT id INTO v_박규민 FROM profiles WHERE name LIKE '%박규민%' LIMIT 1;
  SELECT id INTO v_오종민 FROM profiles WHERE name LIKE '%오종민%' LIMIT 1;
  SELECT id INTO v_김석현 FROM profiles WHERE name LIKE '%김석현%' LIMIT 1;
  SELECT id INTO v_유창욱 FROM profiles WHERE name LIKE '%유창욱%' LIMIT 1;
  SELECT id INTO v_정가윤 FROM profiles WHERE name LIKE '%정가윤%' LIMIT 1;
  SELECT id INTO v_구은솔 FROM profiles WHERE name LIKE '%구은솔%' LIMIT 1;

  RAISE NOTICE '트레이너: 박규민=%, 오종민=%, 김석현=%, 유창욱=%, 정가윤=%, 구은솔=%',
    v_박규민, v_오종민, v_김석현, v_유창욱, v_정가윤, v_구은솔;

  -- =============================================
  -- 헬퍼: 기존 회원의 활성 배정을 찾거나, 없으면 새로 생성
  -- 세션은 upsert (ON CONFLICT)로 기존 데이터 보존
  -- =============================================

  -- #1 이서윤 (PT: 박규민 1차 03.19 18:00 / PPT: 구은솔 1차 03.11 17:30)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-4180-7604';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_박규민, v_구은솔, '배정완료', '배정완료')
      RETURNING id INTO v_assign_id;
    ELSE
      UPDATE ot_assignments SET pt_trainer_id = COALESCE(pt_trainer_id, v_박규민), ppt_trainer_id = COALESCE(ppt_trainer_id, v_구은솔) WHERE id = v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at)
    VALUES (v_assign_id, 1, '2026-03-19 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '이서윤 처리 완료';
  ELSE
    RAISE NOTICE '이서윤 회원 없음 - 건너뜀';
  END IF;

  -- #2 박은진 (PT: 오종민 1차 03.09 11:00, 2차 03.11 10:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9620-1818';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-09 11:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-11 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '박은진 처리 완료';
  END IF;

  -- #3 정현진 (PT: 김석현 1차 03.11 21:00, 2차 03.14 17:00, 3차 03.19 21:30)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-4558-8356';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('거부') ORDER BY created_at DESC LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_김석현, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-11 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-14 17:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 3, '2026-03-19 21:30:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '정현진 처리 완료';
  END IF;

  -- #4 이현숙 (PT: 오종민 1차 03.04 21:00, 2차 03.11 18:00 / PPT담당: 정가윤)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9241-6495';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, v_정가윤, '배정완료', '배정완료')
      RETURNING id INTO v_assign_id;
    ELSE
      UPDATE ot_assignments SET ppt_trainer_id = COALESCE(ppt_trainer_id, v_정가윤) WHERE id = v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-04 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-11 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '이현숙 처리 완료';
  END IF;

  -- #5 조현명 (PT: 유창욱 1차 03.14 11:00, 2차 03.17 20:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-7673-3239';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_유창욱, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-14 11:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-17 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '조현명 처리 완료';
  END IF;

  -- #6 김세영 (PT: 박규민 1차 03.17 20:00, 2차 03.23 09:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-4555-6897';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_박규민, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-17 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-23 09:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김세영 처리 완료';
  END IF;

  -- #7 서정원 (PT: 김석현 1차 03.10 16:00, 2차 03.15 11:00, 3차 03.25 20:30)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9314-5082';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('거부') ORDER BY created_at DESC LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_김석현, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-10 16:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-15 11:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 3, '2026-03-25 20:30:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '서정원 처리 완료';
  END IF;

  -- #8 서기윤 (PT: 유창욱 1차 03.16 21:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9108-8421';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_유창욱, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-16 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '서기윤 처리 완료';
  END IF;

  -- #9 박준영 (PT: 유창욱 1차 03.14 10:00 / PPT담당: 정가윤)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-5295-8935';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_유창욱, v_정가윤, '배정완료', '배정완료')
      RETURNING id INTO v_assign_id;
    ELSE
      UPDATE ot_assignments SET ppt_trainer_id = COALESCE(ppt_trainer_id, v_정가윤) WHERE id = v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-14 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '박준영 처리 완료';
  END IF;

  -- #10 김혜원 (PT: 오종민 1차 03.24 19:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-6384-7701';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 19:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김혜원 처리 완료';
  END IF;

  -- #11 김지현 (PT: 김석현 1차 03.16 18:00, 2차 03.25 18:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-5893-9595';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_김석현, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-16 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-25 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김지현 처리 완료';
  END IF;

  -- #12 강성은 (PT: 오종민 1차 03.18 09:00, 2차 03.24 10:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9489-0651';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-18 09:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-24 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '강성은 처리 완료';
  END IF;

  -- #13 조아란 (PT: 유창욱 1차 03.19 18:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-9338-3598';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_유창욱, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-19 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '조아란 처리 완료';
  END IF;

  -- #14 장세준 (PT담당: 오종민 / PPT: 정가윤 1차 03.24 18:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-5519-7654';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, v_정가윤, '배정완료', '배정완료')
      RETURNING id INTO v_assign_id;
    ELSE
      UPDATE ot_assignments SET ppt_trainer_id = COALESCE(ppt_trainer_id, v_정가윤) WHERE id = v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '장세준 처리 완료';
  END IF;

  -- #15 강영준 (PT: 유창욱 1차 03.23 20:00, 2차 03.25 21:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-2666-8526';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_유창욱, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-23 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-25 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '강영준 처리 완료';
  END IF;

  -- #16 김윤지 (PT: 오종민 1차 03.18 20:00, 2차 03.22 18:00, 3차 03.25 21:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-6623-3762';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('거부') ORDER BY created_at DESC LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-18 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-22 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 3, '2026-03-25 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김윤지 처리 완료';
  END IF;

  -- #17 김은환 (PT: 김석현 1차 03.21 14:00)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-8339-6224';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_김석현, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-21 14:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김은환 처리 완료';
  END IF;

  -- #18 하동수 (PT: 김석현 1차 03.20 21:30)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-2533-8908';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, pt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_김석현, '배정완료')
      RETURNING id INTO v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-20 21:30:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '하동수 처리 완료';
  END IF;

  -- #19 권세윤 (PT: 오종민 1차 03.24 21:00, 2차 03.26 07:00 / PPT담당: 구은솔)
  SELECT id INTO v_member_id FROM members WHERE phone = '010-5027-3117';
  IF v_member_id IS NOT NULL THEN
    SELECT id INTO v_assign_id FROM ot_assignments WHERE member_id = v_member_id AND status NOT IN ('완료','거부') LIMIT 1;
    IF v_assign_id IS NULL THEN
      INSERT INTO ot_assignments (member_id, status, ot_category, pt_trainer_id, ppt_trainer_id, pt_assign_status, ppt_assign_status)
      VALUES (v_member_id, '진행중', '헬스', v_오종민, v_구은솔, '배정완료', '배정완료')
      RETURNING id INTO v_assign_id;
    ELSE
      UPDATE ot_assignments SET ppt_trainer_id = COALESCE(ppt_trainer_id, v_구은솔) WHERE id = v_assign_id;
    END IF;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-26 07:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '권세윤 처리 완료';
  END IF;

  RAISE NOTICE '=== 3월 스케줄 처리 완료 ===';
END;
$$;

-- 확인 쿼리
SELECT
  m.name AS 회원명,
  m.phone AS 전화번호,
  oa.status AS 상태,
  pt.name AS PT담당,
  ppt.name AS PPT담당,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id) AS 세션수,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id AND os.completed_at IS NOT NULL) AS 완료수
FROM ot_assignments oa
JOIN members m ON m.id = oa.member_id
LEFT JOIN profiles pt ON pt.id = oa.pt_trainer_id
LEFT JOIN profiles ppt ON ppt.id = oa.ppt_trainer_id
WHERE m.phone IN (
  '010-4180-7604','010-9620-1818','010-4558-8356','010-9241-6495',
  '010-7673-3239','010-4555-6897','010-9314-5082','010-9108-8421',
  '010-5295-8935','010-6384-7701','010-5893-9595','010-9489-0651',
  '010-9338-3598','010-5519-7654','010-2666-8526','010-6623-3762',
  '010-8339-6224','010-2533-8908','010-5027-3117'
)
ORDER BY m.name;
