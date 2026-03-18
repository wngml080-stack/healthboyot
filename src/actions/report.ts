'use server'

import { getStats } from './stats'
import { getSalesTarget } from './sales-target'

export async function generateMonthlyReport(year: number, month: number) {
  const stats = await getStats()
  const target = await getSalesTarget(year, month)

  const achieveRate = target?.target_amount ? Math.round((stats.totalSales / target.target_amount) * 100) : 0

  return {
    period: `${year}년 ${month}월`,
    target: target?.target_amount ?? 0,
    achieveRate,
    ...stats,
  }
}

export async function downloadMonthlyExcel() {
  // 클라이언트에서 호출 — xlsx import는 클라이언트에서
  const now = new Date()
  const report = await generateMonthlyReport(now.getFullYear(), now.getMonth() + 1)
  return report
}
