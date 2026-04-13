-- 공개 상담카드 폼: 비인증 사용자(anon)도 상담카드 조회/수정 가능
-- ID를 알고 있는 경우에만 접근 가능 (UUID 추측 불가)

CREATE POLICY "Allow public read consultation_cards by id"
  ON consultation_cards FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public update consultation_cards"
  ON consultation_cards FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
