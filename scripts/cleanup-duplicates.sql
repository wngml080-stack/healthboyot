-- =============================================
-- 첫 번째 SQL로 잘못 생성된 배정/세션 정리
-- Supabase SQL Editor에서 실행
-- =============================================

-- [1단계] 먼저 현재 상태 확인 (실행해서 어떤 데이터가 있는지 보세요)
SELECT
  m.name AS 회원명,
  m.phone AS 전화번호,
  oa.id AS 배정ID,
  oa.status AS 상태,
  oa.created_at AS 배정생성일,
  pt.name AS PT담당,
  ppt.name AS PPT담당,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id) AS 세션수,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id AND os.completed_at IS NOT NULL) AS 완료수,
  (SELECT string_agg(os.session_number::text || '차:' || to_char(os.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI'), ', ' ORDER BY os.session_number) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id) AS 세션상세
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
ORDER BY oa.created_at DESC, m.name;

-- =============================================
-- [2단계] 첫 번째 SQL로 생성된 배정 삭제
-- 오늘(최근) 생성된 배정 중 완료된 세션이 없는 것들을 삭제
-- (세션도 CASCADE로 함께 삭제됨)
--
-- ⚠️ 주의: 1단계 결과를 보고 삭제할 배정을 확인한 후 실행하세요
-- =============================================

-- 방법 A: 오늘 생성된 배정만 삭제 (완료된 세션이 0개인 것만)
/*
DELETE FROM ot_assignments
WHERE id IN (
  SELECT oa.id
  FROM ot_assignments oa
  JOIN members m ON m.id = oa.member_id
  WHERE m.phone IN (
    '010-4180-7604','010-9620-1818','010-4558-8356','010-9241-6495',
    '010-7673-3239','010-4555-6897','010-9314-5082','010-9108-8421',
    '010-5295-8935','010-6384-7701','010-5893-9595','010-9489-0651',
    '010-9338-3598','010-5519-7654','010-2666-8526','010-6623-3762',
    '010-8339-6224','010-2533-8908','010-5027-3117'
  )
  AND oa.created_at >= CURRENT_DATE  -- 오늘 생성된 것만
  AND NOT EXISTS (
    SELECT 1 FROM ot_sessions os
    WHERE os.ot_assignment_id = oa.id AND os.completed_at IS NOT NULL
  )
);
*/

-- 방법 B: 특정 배정ID를 직접 지정해서 삭제 (1단계에서 확인한 ID 입력)
-- DELETE FROM ot_assignments WHERE id IN ('배정ID1', '배정ID2', ...);

-- 방법 C: 중복 배정이 있는 경우 - 각 회원당 가장 오래된 배정만 남기고 나머지 삭제
/*
DELETE FROM ot_assignments
WHERE id IN (
  SELECT oa.id
  FROM ot_assignments oa
  JOIN members m ON m.id = oa.member_id
  WHERE m.phone IN (
    '010-4180-7604','010-9620-1818','010-4558-8356','010-9241-6495',
    '010-7673-3239','010-4555-6897','010-9314-5082','010-9108-8421',
    '010-5295-8935','010-6384-7701','010-5893-9595','010-9489-0651',
    '010-9338-3598','010-5519-7654','010-2666-8526','010-6623-3762',
    '010-8339-6224','010-2533-8908','010-5027-3117'
  )
  AND oa.status NOT IN ('완료', '거부')
  AND oa.id NOT IN (
    -- 각 회원당 가장 오래된(원래) 활성 배정만 남김
    SELECT DISTINCT ON (oa2.member_id) oa2.id
    FROM ot_assignments oa2
    WHERE oa2.member_id = oa.member_id
    AND oa2.status NOT IN ('완료', '거부')
    ORDER BY oa2.member_id, oa2.created_at ASC
  )
);
*/
