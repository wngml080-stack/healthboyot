import { z } from 'zod'

// ── 회원 ──
export const memberSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .regex(/^\d{10,11}$/, '올바른 연락처 형식이 아닙니다'),
  gender: z.enum(['남', '여']).nullable().optional(),
  sports: z.array(z.string()).default([]),
  duration_months: z.string().nullable().optional(),
  exercise_time: z.string().nullable().optional(),
  injury_tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  ot_category: z.string().nullable().optional(),
  detail_info: z.string().nullable().optional(),
  is_existing_member: z.boolean().optional(),
  registered_at: z.string().optional(),
})

export type MemberFormValues = z.infer<typeof memberSchema>

// ── OT 배정 ──
export const otAssignmentSchema = z.object({
  member_id: z.string().uuid(),
  status: z.enum(['신청대기', '배정완료', '진행중', '완료', '거부', '추후결정']),
  pt_trainer_id: z.string().uuid().nullable().optional(),
  ppt_trainer_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type OtAssignmentFormValues = z.infer<typeof otAssignmentSchema>

// ── OT 세션 ──
export const otSessionSchema = z.object({
  ot_assignment_id: z.string().uuid(),
  session_number: z.coerce.number().int().min(1).max(3),
  scheduled_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  feedback: z.string().nullable().optional(),
})

export type OtSessionFormValues = z.infer<typeof otSessionSchema>

// ── 로그인 ──
export const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
