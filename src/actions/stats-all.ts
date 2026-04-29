'use server'

import { getStats } from '@/actions/stats'
import { getSalesTarget } from '@/actions/sales-target'
import { getAdminDashboard } from '@/actions/admin-dashboard'
import { getCurrentProfile } from '@/actions/auth'
import type { StatsData } from '@/actions/stats'
import type { SalesTarget } from '@/actions/sales-target'
import type { AdminDashboardData } from '@/actions/admin-dashboard'

export interface StatsAllResult {
  stats: StatsData
  target: SalesTarget | null
  dashboard: AdminDashboardData
  isAdmin: boolean
}

/** 통계 페이지에 필요한 모든 데이터를 1번의 서버 액션 호출로 가져옴 */
export async function getStatsAll(
  period: 'weekly' | 'monthly' = 'monthly',
  offset: number = 0,
): Promise<StatsAllResult> {
  const now = new Date()
  const targetYear = now.getFullYear()
  const targetMonth = now.getMonth() + 1 + offset

  const [stats, target, dashboard, profile] = await Promise.all([
    getStats(period, offset),
    getSalesTarget(targetYear, targetMonth),
    getAdminDashboard(period, offset),
    getCurrentProfile(),
  ])

  return {
    stats,
    target,
    dashboard,
    isAdmin: !!profile && ['admin', '관리자'].includes(profile.role),
  }
}
