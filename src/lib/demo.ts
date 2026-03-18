import type { Profile } from '@/types'

// 데모 계정 목록
export const DEMO_ACCOUNTS: Record<string, { password: string; profile: Profile }> = {
  'admin@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-admin-001',
      name: '김팀장',
      role: 'admin',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  'trainer@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-trainer-001',
      name: '박트레이너',
      role: 'trainer',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  'fc@demo.com': {
    password: '123456',
    profile: {
      id: 'demo-fc-001',
      name: '이FC',
      role: 'fc',
      avatar_url: null,
      folder_password: null,
      is_approved: true,
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
