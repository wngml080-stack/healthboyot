import type { Profile } from '@/types'

// 데모 계정 목록
export const DEMO_ACCOUNTS: Record<string, { password: string; profile: Profile }> = {
  'admin@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-admin-001',
      name: '김팀장',
      email: 'admin@demo.com',
      role: 'admin',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
      work_start_time: null,
      work_end_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  'trainer@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-trainer-001',
      name: '박트레이너',
      email: 'trainer@demo.com',
      role: 'trainer',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
      work_start_time: null,
      work_end_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  'fc@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-fc-001',
      name: '이FC',
      email: 'fc@demo.com',
      role: 'fc',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
      work_start_time: null,
      work_end_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
}

export const DEMO_COOKIE_NAME = 'demo-session'

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR_PROJECT_ID')
}
