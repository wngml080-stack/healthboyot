-- =============================================
-- 기존 회원의 기존 배정에 스케줄(세션)만 추가
-- 이미 완료된 세션은 건드리지 않음
-- =============================================

DO $$
DECLARE
  v_assign_id UUID;
BEGIN

  -- #1 이서윤 (PT 1차 03.19 18:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01041807604' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-19 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '이서윤 완료';
  END IF;

  -- #2 박은진 (PT 1차 03.09 11:00, 2차 03.11 10:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01096201818' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-09 11:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-11 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '박은진 완료';
  END IF;

  -- #3 정현진 (PT 1차 03.11 21:00, 2차 03.14 17:00, 3차 03.19 21:30)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01045588356' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-11 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-14 17:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 3, '2026-03-19 21:30:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '정현진 완료';
  END IF;

  -- #4 이현숙 (PT 1차 03.04 21:00, 2차 03.11 18:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01092416495' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-04 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-11 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '이현숙 완료';
  END IF;

  -- #5 조현명 (PT 1차 03.14 11:00, 2차 03.17 20:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01076733239' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-14 11:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-17 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '조현명 완료';
  END IF;

  -- #6 김세영 (PT 1차 03.17 20:00, 2차 03.23 09:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01045556897' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-17 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-23 09:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김세영 완료';
  END IF;

  -- #7 서정원 - 회원 목록에 없음, 건너뜀

  -- #8 서기윤 (PT 1차 03.16 21:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01091088421' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-16 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '서기윤 완료';
  END IF;

  -- #9 박준영 (PT 1차 03.14 10:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01052958935' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-14 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '박준영 완료';
  END IF;

  -- #10 김혜원 (PT 1차 03.24 19:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01063847701' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 19:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김혜원 완료';
  END IF;

  -- #11 김지현 (PT 1차 03.16 18:00, 2차 03.25 18:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01058939595' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-16 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-25 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김지현 완료';
  END IF;

  -- #12 강성은 (PT 1차 03.18 09:00, 2차 03.24 10:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01094890651' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-18 09:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-24 10:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '강성은 완료';
  END IF;

  -- #13 조아란 (PT 1차 03.19 18:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01093383598' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-19 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '조아란 완료';
  END IF;

  -- #14 장세준 (PPT 1차 03.24 18:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01055197654' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '장세준 완료';
  END IF;

  -- #15 강영준 (PT 1차 03.23 20:00, 2차 03.25 21:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01026668526' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-23 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-25 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '강영준 완료';
  END IF;

  -- #16 김윤지 (PT 1차 03.18 20:00, 2차 03.22 18:00, 3차 03.25 21:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01066233762' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-18 20:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-22 18:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 3, '2026-03-25 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김윤지 완료';
  END IF;

  -- #17 김은환 (PT 1차 03.21 14:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01083396224' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-21 14:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '김은환 완료';
  END IF;

  -- #18 하동수 (PT 1차 03.20 21:30)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01025338908' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-20 21:30:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '하동수 완료';
  END IF;

  -- #19 권세윤 (PT 1차 03.24 21:00, 2차 03.26 07:00)
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01050273117' AND oa.status NOT IN ('거부') ORDER BY oa.created_at DESC LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 1, '2026-03-24 21:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    INSERT INTO ot_sessions (ot_assignment_id, session_number, scheduled_at) VALUES
      (v_assign_id, 2, '2026-03-26 07:00:00+09')
    ON CONFLICT (ot_assignment_id, session_number) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at WHERE ot_sessions.completed_at IS NULL;
    RAISE NOTICE '권세윤 완료';
  END IF;

  RAISE NOTICE '=== 18명 스케줄 입력 완료 (서정원 제외) ===';
END;
$$;

-- 확인 쿼리
SELECT
  m.name AS 회원명,
  oa.status AS 상태,
  (SELECT string_agg(os.session_number::text || '차:' || to_char(os.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ', ' ORDER BY os.session_number) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id) AS 세션상세
FROM ot_assignments oa
JOIN members m ON m.id = oa.member_id
WHERE m.name IN ('이서윤','박은진','정현진','이현숙','조현명','김세영','서기윤','박준영','김혜원','김지현','강성은','조아란','장세준','강영준','김윤지','김은환','하동수','권세윤')
ORDER BY m.name;
