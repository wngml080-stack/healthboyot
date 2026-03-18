-- 월별 매출 목표 테이블
CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_amount INTEGER NOT NULL DEFAULT 0,
  week1_target INTEGER NOT NULL DEFAULT 0,
  week2_target INTEGER NOT NULL DEFAULT 0,
  week3_target INTEGER NOT NULL DEFAULT 0,
  week4_target INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_targets_select" ON sales_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_targets_insert" ON sales_targets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', '관리자')));
CREATE POLICY "sales_targets_update" ON sales_targets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', '관리자')));
