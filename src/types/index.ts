// ── 역할 ──
export type Role = 'admin' | '관리자' | '팀장' | 'trainer' | '강사' | 'fc'

// ── OT 상태 ──
export type OtStatus = '신청대기' | '배정완료' | '진행중' | '완료' | '거부' | '추후결정'

// ── OT 종목 ──
export type OtCategory = '헬스' | 'PT등록' | '필라' | '헬스,필라' | '거부'

// ── 성별 ──
export type Gender = '남' | '여'

// ── 업무일지 타입 ──
export type LogType = 'FC' | 'PT'

// ── DB 테이블 타입 ──
export interface Profile {
  id: string
  name: string
  email: string | null
  role: Role
  avatar_url: string | null
  folder_password: string | null
  is_approved: boolean
  work_start_time: string | null
  work_end_time: string | null
  has_folder?: boolean
  folder_order?: number
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  name: string
  phone: string | null
  gender: Gender | null
  sports: string[]
  duration_months: string | number | null
  exercise_time: string | null
  injury_tags: string[]
  notes: string | null
  ot_category: OtCategory | null
  detail_info: string | null
  start_date: string | null
  is_completed: boolean
  is_renewal: boolean
  is_existing_member?: boolean
  registration_source?: '자동' | '수기' | '플로팅'
  registered_at: string
  created_by: string | null
  creator_name?: string | null
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
  sales_status: string
  expected_amount: number
  expected_sessions?: number
  closing_probability: number
  closing_fail_reason: string | null
  sales_note: string | null
  is_sales_target: boolean
  is_pt_conversion: boolean
  pt_assign_status: string
  ppt_assign_status: string
  is_excluded: boolean
  excluded_reason: string | null
  excluded_at: string | null
  is_watchlist: boolean
  watchlist_reason: string | null
  assigned_at: string | null
  created_at: string
  updated_at: string
}

export type SalesStatus = 'OT진행중' | 'OT거부자' | '등록완료' | '스케줄미확정' | '연락두절' | '클로징실패' | '수업후거부'

export interface OtSession {
  id: string
  ot_assignment_id: string
  session_number: number
  scheduled_at: string | null
  completed_at: string | null
  feedback: string | null
  exercise_content: string | null
  trainer_tip: string | null
  cardio_type: string[] | null
  cardio_duration: number | null
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

// ── 신규회원 상담카드 ──
export interface ConsultationCard {
  id: string
  member_id: string | null
  status: '미연결' | '연결완료'
  member_name: string | null
  member_phone: string | null
  member_gender: string | null
  fc_name: string | null
  consultation_date: string | null
  registration_product: string | null
  expiry_date: string | null
  age: string | null
  occupation: string | null
  exercise_time_preference: string | null
  instagram_id: string | null
  residence_area: string | null
  desired_body_type: string | null
  referral_sources: string[]
  referral_detail: string | null
  exercise_goals: string[]
  medical_conditions: string[]
  medical_detail: string | null
  surgery_history: string | null
  surgery_detail: string | null
  exercise_experiences: string[]
  exercise_experience_detail: string | null
  exercise_duration: string | null
  pt_satisfaction: string | null
  pt_satisfaction_reason: string | null
  exercise_personality: string[]
  exercise_goal_detail: string | null
  body_correction_area: string | null
  exercise_experience_history: string | null
  exercise_start_date: string | null
  special_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── OT 프로그램 ──
export interface OtProgramExercise {
  name: string
  weight: string
  reps: string
  sets: string
}

export interface OtProgramSession {
  date: string
  time: string
  exercises: OtProgramExercise[]
  tip: string
  next_ot_date: string
  cardio: { types: string[]; duration_min: string }
  inbody: boolean
  images: string[]
  completed: boolean
  approval_status?: OtProgramApprovalStatus
  submitted_at?: string | null
  approved_at?: string | null
  approved_by?: string | null
  rejection_reason?: string | null
  admin_feedback?: string | null
  signature_url?: string | null
  signed_at?: string | null
  signer_name?: string | null
  plan?: string | null
  plan_detail?: OtSessionPlanDetail | null
  inbody_images?: string[] | null
  image_records?: OtSessionImageRecord[] | null
  result_category?: OtSessionResultCategory | null
  result_note?: string | null
  sales_status?: string | null
  expected_amount?: number | null
  expected_sessions?: number | null
  closing_probability?: number | null
  closing_fail_reason?: string | null
  sales_note?: string | null
  is_sales_target?: boolean | null
  is_pt_conversion?: boolean | null
  pt_sales_amount?: number | null
  is_transferred?: boolean | null
  class_duration?: number | null
}

export interface OtSessionImageRecord {
  url: string
  uploaded_at: string
  label?: 'before' | 'after' | 'video' | null
}

export type OtSessionResultCategory = '매출대상' | '등록완료' | '클로징실패' | '거부자' | '수업완료' | '노쇼' | '차감노쇼' | '서비스수업' | '수업취소' | '스케줄변경' | '기타'

export interface OtSessionPlanRoadmapItem {
  week: string
  content: string
}

export interface OtSessionPlanDetail {
  sessions_needed?: string
  duration?: string
  current_state?: string
  target_state?: string
  weekly_roadmap?: OtSessionPlanRoadmapItem[]
  notes?: string
}

export interface OtProgramConsultationData {
  exercise_goals: string[]
  exercise_goal_detail: string | null
  body_correction_area: string | null
  medical_conditions: string[]
  medical_detail: string | null
  surgery_detail: string | null
  exercise_experiences: string[]
  exercise_experience_history: string | null
  exercise_duration: string | null
  exercise_personality: string[]
  desired_body_type: string | null
}

export interface OtProgramInbodyData {
  current_weight: string
  target_weight: string
  current_body_fat: string
  target_body_fat: string
  current_muscle_mass: string
  target_muscle_mass: string
  current_bmr: string
  target_bmr: string
}

export type OtProgramApprovalStatus = '작성중' | '제출완료' | '승인' | '반려'

export interface OtProgram {
  id: string
  ot_assignment_id: string
  member_id: string
  trainer_name: string | null
  athletic_goal: string | null
  total_sets_per_day: number | null
  recommended_days_per_week: number | null
  exercise_duration_min: number | null
  target_heart_rate: number | null
  member_start_date: string | null
  member_end_date: string | null
  session_1?: OtProgramSession
  session_2?: OtProgramSession
  session_3?: OtProgramSession
  sessions: OtProgramSession[]
  consultation_data: OtProgramConsultationData
  inbody_data: OtProgramInbodyData
  images: string[]
  approval_status: OtProgramApprovalStatus
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  share_token?: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── OT 인정건수 (회원권 등록) ──
export type OtRegistrationApprovalStatus = '제출완료' | '승인' | '반려'

export interface OtRegistration {
  id: string
  trainer_id: string
  member_name: string
  membership_type: string
  registration_amount: number
  ot_credit: number
  approval_status: OtRegistrationApprovalStatus
  submitted_at: string
  approved_at: string | null
  approved_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface OtRegistrationWithTrainer extends OtRegistration {
  trainer: Pick<Profile, 'id' | 'name'> | null
}

// ── JOIN 결과 타입 ──
export interface OtAssignmentWithDetails extends OtAssignment {
  member: Member
  pt_trainer: Pick<Profile, 'id' | 'name'> | null
  ppt_trainer: Pick<Profile, 'id' | 'name'> | null
  sessions: OtSession[]
}
