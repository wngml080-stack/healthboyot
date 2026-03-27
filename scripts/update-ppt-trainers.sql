-- =============================================
-- PPT 트레이너 배정 업데이트
-- 기존 회원의 기존 배정에 ppt_trainer_id만 설정
-- =============================================

DO $$
DECLARE
  v_정가윤 UUID;
  v_구은솔 UUID;
  v_assign_id UUID;
BEGIN
  SELECT id INTO v_정가윤 FROM profiles WHERE name LIKE '%정가윤%' LIMIT 1;
  SELECT id INTO v_구은솔 FROM profiles WHERE name LIKE '%구은솔%' LIMIT 1;

  RAISE NOTICE '정가윤=%, 구은솔=%', v_정가윤, v_구은솔;

  -- #1 이서윤 → PPT: 구은솔
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01041807604' AND oa.status NOT IN ('거부') LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    UPDATE ot_assignments SET ppt_trainer_id = v_구은솔, ppt_assign_status = '배정완료' WHERE id = v_assign_id;
    RAISE NOTICE '이서윤 PPT→구은솔';
  END IF;

  -- #4 이현숙 → PPT: 정가윤
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01092416495' AND oa.status NOT IN ('거부') LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    UPDATE ot_assignments SET ppt_trainer_id = v_정가윤, ppt_assign_status = '배정완료' WHERE id = v_assign_id;
    RAISE NOTICE '이현숙 PPT→정가윤';
  END IF;

  -- #9 박준영 → PPT: 정가윤
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01052958935' AND oa.status NOT IN ('거부') LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    UPDATE ot_assignments SET ppt_trainer_id = v_정가윤, ppt_assign_status = '배정완료' WHERE id = v_assign_id;
    RAISE NOTICE '박준영 PPT→정가윤';
  END IF;

  -- #14 장세준 → PPT: 정가윤
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01055197654' AND oa.status NOT IN ('거부') LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    UPDATE ot_assignments SET ppt_trainer_id = v_정가윤, ppt_assign_status = '배정완료' WHERE id = v_assign_id;
    RAISE NOTICE '장세준 PPT→정가윤';
  END IF;

  -- #19 권세윤 → PPT: 구은솔
  SELECT oa.id INTO v_assign_id FROM ot_assignments oa
    JOIN members m ON m.id = oa.member_id WHERE m.phone = '01050273117' AND oa.status NOT IN ('거부') LIMIT 1;
  IF v_assign_id IS NOT NULL THEN
    UPDATE ot_assignments SET ppt_trainer_id = v_구은솔, ppt_assign_status = '배정완료' WHERE id = v_assign_id;
    RAISE NOTICE '권세윤 PPT→구은솔';
  END IF;

  RAISE NOTICE '=== PPT 트레이너 배정 완료 ===';
END;
$$;

-- 확인
SELECT m.name, pt.name AS PT담당, ppt.name AS PPT담당
FROM ot_assignments oa
JOIN members m ON m.id = oa.member_id
LEFT JOIN profiles pt ON pt.id = oa.pt_trainer_id
LEFT JOIN profiles ppt ON ppt.id = oa.ppt_trainer_id
WHERE oa.ppt_trainer_id IS NOT NULL
ORDER BY m.name;
