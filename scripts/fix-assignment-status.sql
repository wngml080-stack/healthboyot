-- =============================================
-- 세션이 있는 배정의 상태를 자동 보정
-- 배정완료인데 세션이 스케줄되어 있으면 → 진행중
-- 완료된 세션이 3개 이상이면 → 완료
-- =============================================

-- 1. 스케줄된 세션이 있는데 아직 '배정완료'인 배정 → '진행중'으로
UPDATE ot_assignments SET status = '진행중'
WHERE status IN ('신청대기', '배정완료')
AND EXISTS (
  SELECT 1 FROM ot_sessions os
  WHERE os.ot_assignment_id = ot_assignments.id
  AND os.scheduled_at IS NOT NULL
);

-- 2. 완료된 세션이 3개 이상인데 '완료'가 아닌 배정 → '완료'로
UPDATE ot_assignments SET status = '완료'
WHERE status NOT IN ('완료', '거부')
AND (
  SELECT COUNT(*) FROM ot_sessions os
  WHERE os.ot_assignment_id = ot_assignments.id
  AND os.completed_at IS NOT NULL
) >= 3;

-- 확인
SELECT
  m.name AS 회원명,
  oa.status AS 상태,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id AND os.scheduled_at IS NOT NULL) AS 스케줄수,
  (SELECT COUNT(*) FROM ot_sessions os WHERE os.ot_assignment_id = oa.id AND os.completed_at IS NOT NULL) AS 완료수
FROM ot_assignments oa
JOIN members m ON m.id = oa.member_id
WHERE oa.status NOT IN ('거부')
ORDER BY oa.status, m.name;
