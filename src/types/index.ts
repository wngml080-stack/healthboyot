// ── 역할 ──
export type Role = 'admin' | '관리자' | '팀장' | 'trainer' | '강사' | 'fc'

// ── OT 상태 ──
export type OtStatus = '신청대기' | '배정완료' | '진행중' | '완료' | '거부' | '추후결정'

// ── OT 종목 ──
export type OtCategory = '헬스' | 'PT등록' | '필라' | '거부'

// ── 성별 ──
export type Gender = '남' | '여'

// ── 업무일지 타입 ──
export type LogType = 'FC' | 'PT'

// ── DB 테이블 타입 ──
export interface Profile {
  id: string
  name: string
  role: Role
  avatar_url: string | null
  folder_password: string | null
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  name: string
  phone: string
  gender: Gender | null
  sports: string[]
  duration_months: number | null
  exercise_time: string | null
  injury_tags: string[]
  notes: string | null
  ot_category: OtCategory | null
  detail_info: string | null
  start_date: string | null
  is_completed: boolean
  registered_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OtAssignment {
  id: string
  member_id: string
  status: OtStatus
  ot_category: OtCategory | null
  pt_trainer_id: string | null
  ppt_trainer_id: string | null
  assigned_by: string | null
  notes: string | null
  registration_type: string | null
  registration_route: string | null
  expected_sales: number
  actual_sales: number
  week_number: number | null
  membership_start_date: string | null
  contact_status: string
  created_at: string
  updated_at: string
}

export interface OtSession {
  id: string
  ot_assignment_id: string
  session_number: 1 | 2 | 3
  scheduled_at: string | null
  completed_at: string | null
  feedback: string | null
  created_at: string
  updated_at: string
}

export interface WorkLog {
  id: string
  member_id: string
  author_id: string | null
  log_type: LogType
  content: string | null
  created_at: string
}

// ── JOIN 결과 타입 ──
export interface OtAssignmentWithDetails extends OtAssignment {
  member: Member
  pt_trainer: Pick<Profile, 'id' | 'name'> | null
  ppt_trainer: Pick<Profile, 'id' | 'name'> | null
  sessions: OtSession[]
}
