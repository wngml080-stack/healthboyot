import type { OtCategory, OtStatus, Role } from '@/types'

// ── OT 상태 ──
export const OT_STATUS = {
  PENDING: '신청대기',
  ASSIGNED: '배정완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  REJECTED: '거부',
  DEFERRED: '추후결정',
} as const

export const OT_STATUS_OPTIONS: OtStatus[] = [
  '신청대기', '배정완료', '진행중', '완료', '거부', '추후결정',
]

export const OT_STATUS_COLOR: Record<OtStatus, string> = {
  '신청대기': 'bg-yellow-400 text-black border-yellow-400',
  '배정완료': 'bg-blue-500 text-white border-blue-500',
  '진행중': 'bg-green-500 text-white border-green-500',
  '완료': 'bg-gray-500 text-white border-gray-500',
  '거부': 'bg-red-500 text-white border-red-500',
  '추후결정': 'bg-purple-500 text-white border-purple-500',
}

// ── 역할 ──
export const ROLE_OPTIONS: Role[] = ['admin', '관리자', '팀장', 'trainer', '강사', 'fc']

export const ROLE_LABEL: Record<Role, string> = {
  admin: '개발자',
  '관리자': '관리자',
  '팀장': '팀장',
  trainer: '트레이너',
  '강사': '강사',
  fc: 'FC',
}

// 모든 메뉴를 볼 수 있는 역할
export const FULL_ACCESS_ROLES: Role[] = ['admin', '관리자']

// 권한 없음 팝업이 뜨는 메뉴별 차단 역할
// 팀장/트레이너/강사: 회원관리, 직원관리, 통계 접근 시 팝업
// FC: 직원관리, 통계 접근 시 팝업
export const MENU_ACCESS: Record<string, Role[]> = {
  '/ot': ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'],
  '/schedules': ['admin', '관리자'],
  '/dashboard': ['admin', '관리자', 'fc'],
  '/consultations': ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'],
  '/approvals': ['admin', '관리자'],
  '/staff': ['admin', '관리자'],
  '/stats': ['admin', '관리자'],
}

// ── 네비게이션 (모든 역할에 표시, 접근 제어는 클라이언트에서) ──
export const NAV_ITEMS = [
  { href: '/ot', label: '트레이너 관리', icon: 'ClipboardList' as const, roles: ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'] as Role[] },
  { href: '/consultations', label: '상담카드', icon: 'FileText' as const, roles: ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'] as Role[] },
  { href: '/schedules', label: '스케줄 총괄', icon: 'CalendarDays' as const, roles: ['admin', '관리자'] as Role[] },
  { href: '/dashboard', label: 'OT회원', icon: 'LayoutDashboard' as const, roles: ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'] as Role[] },
  { href: '/approvals', label: 'OT 승인', icon: 'CheckSquare' as const, roles: ['admin', '관리자'] as Role[] },
  { href: '/staff', label: '직원 관리', icon: 'Users' as const, roles: ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'] as Role[] },
  { href: '/stats', label: '통계', icon: 'BarChart3' as const, roles: ['admin', '관리자', '팀장', 'trainer', '강사', 'fc'] as Role[] },
]

// ── 종목 옵션 ──
export const SPORTS_OPTIONS = ['헬스', '필라테스', 'PT등록', '수영', '골프', 'GX'] as const

// ── OT 종목 (스프레드시트 색상 기준) ──
export const OT_CATEGORY_OPTIONS: OtCategory[] = ['헬스', '필라', '헬스,필라', 'PT등록', '거부']

export const OT_CATEGORY_COLOR: Record<OtCategory, string> = {
  '헬스': 'bg-blue-500 text-white',
  '필라': 'bg-pink-500 text-white',
  '헬스,필라': 'bg-emerald-500 text-white',
  'PT등록': 'bg-red-500 text-white',
  '거부': 'bg-gray-400 text-white',
}
