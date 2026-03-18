'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
}

function fmtMoney(v: number): string {
  if (!v) return '0'
  return v.toLocaleString()
}

function fmtMan(v: number): string {
  if (!v) return '0'
  if (v >= 10000) return `${(v / 10000).toLocaleString()}만`
  return v.toLocaleString()
}

function autoWeek(c: string): number {
  const d = new Date(c).getDate()
  if (d <= 7) return 1; if (d <= 14) return 2; if (d <= 21) return 3; return 4
}

export function OtSummaryCards({ assignments }: Props) {
  const completed = assignments.filter((a) => a.status === '완료')
  const newSales = completed.reduce((s, a) => s + (a.actual_sales ?? 0), 0)
  const totalExpected = assignments.reduce((s, a) => s + (a.expected_sales ?? 0), 0)

  // OT 현황
  const otInProgress = assignments.filter((a) => ['진행중', '배정완료'].includes(a.status)).length
  const otRejected = assignments.filter((a) => a.status === '거부').length
  const registered = completed.length
  const scheduleUndecided = assignments.filter((a) => a.contact_status === '스케줄미확정').length
  const noContact = assignments.filter((a) => a.contact_status === '연락두절').length
  const closingFailed = assignments.filter((a) => a.contact_status === '클로싱실패').length

  const totalCount = assignments.length
  const 클로징율 = totalCount > 0 ? Math.round((registered / totalCount) * 100) : 0
  const 객단가 = registered > 0 ? Math.round(newSales / registered) : 0

  // 주차별
  const weeklyData = [1, 2, 3, 4].map((week) => {
    const wa = assignments.filter((a) => (a.week_number ?? autoWeek(a.created_at)) === week)
    const wc = wa.filter((a) => a.status === '완료')
    return {
      week,
      newSales: wc.reduce((s, a) => s + (a.actual_sales ?? 0), 0),
      expectedSales: wa.reduce((s, a) => s + (a.expected_sales ?? 0), 0),
      actualSales: wc.reduce((s, a) => s + (a.actual_sales ?? 0), 0),
    }
  })

  // 경로별
  const routeMap = new Map<string, { sales: number; p: number; r: number }>()
  for (const a of assignments) {
    const route = a.registration_route ?? '기타'
    const e = routeMap.get(route) ?? { sales: 0, p: 0, r: 0 }
    e.p++
    if (a.status === '완료') { e.r++; e.sales += a.actual_sales ?? 0 }
    routeMap.set(route, e)
  }

  return (
    <div className="space-y-6">
      {/* 매출 요약 */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-gray-500">신규 매출</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{fmtMoney(newSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-gray-500">예상 매출</p>
            <p className="text-xl font-bold text-pink-600 mt-1">{fmtMoney(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-400 bg-red-50">
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-gray-500">등록 매출</p>
            <p className="text-xl font-bold text-red-700 mt-1">{fmtMoney(newSales)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* OT 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-900">[ 신규 ] OT 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label="OT진행중" value={otInProgress} color="bg-blue-100 text-blue-700" />
            <StatusRow label="OT거부자" value={otRejected} color="bg-red-100 text-red-700" />
            <StatusRow label="등록완료" value={registered} color="bg-green-100 text-green-700" />
            <StatusRow label="스케줄미확정" value={scheduleUndecided} color="bg-orange-100 text-orange-700" />
            <StatusRow label="연락두절" value={noContact} color="bg-gray-100 text-gray-700" />
            <StatusRow label="클로싱실패" value={closingFailed} color="bg-red-50 text-red-600" />
            <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
              <StatusRow label="세일즈 진행인원" value={totalCount} color="bg-blue-50 text-blue-700" />
              <StatusRow label="등록인원" value={registered} color="bg-green-50 text-green-700" />
              <StatusRow label="클로징율" value={`${클로징율}%`} color="bg-yellow-50 text-yellow-700" isText />
              <StatusRow label="객단가" value={fmtMoney(객단가)} color="bg-purple-50 text-purple-700" isText />
            </div>
          </CardContent>
        </Card>

        {/* 경로별 매출 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-900">경로별 매출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-center text-gray-700 text-xs">경로</TableHead>
                    <TableHead className="text-center text-gray-700 text-xs">등록매출</TableHead>
                    <TableHead className="text-center text-gray-700 text-xs">진행</TableHead>
                    <TableHead className="text-center text-gray-700 text-xs">등록</TableHead>
                    <TableHead className="text-center text-gray-700 text-xs">클로징</TableHead>
                    <TableHead className="text-center text-gray-700 text-xs">객단가</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(routeMap.entries()).map(([route, v]) => (
                    <TableRow key={route}>
                      <TableCell className="text-center text-xs font-medium text-gray-900">{route}</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{fmtMan(v.sales)}</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{v.p}</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{v.r}</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{v.p > 0 ? Math.round((v.r / v.p) * 100) : 0}%</TableCell>
                      <TableCell className="text-center text-xs text-gray-900">{v.r > 0 ? fmtMan(Math.round(v.sales / v.r)) : '0'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 주차별 매출 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900">주차별 매출</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-yellow-50">
                  <TableHead className="text-center text-gray-700 text-xs font-bold">구분</TableHead>
                  <TableHead className="text-center text-gray-700 text-xs">1주차</TableHead>
                  <TableHead className="text-center text-gray-700 text-xs">2주차</TableHead>
                  <TableHead className="text-center text-gray-700 text-xs">3주차</TableHead>
                  <TableHead className="text-center text-gray-700 text-xs">4주차</TableHead>
                  <TableHead className="text-center text-gray-700 text-xs font-bold">합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-gray-900 bg-yellow-50">신규</TableCell>
                  {weeklyData.map((w) => <TableCell key={`n${w.week}`} className="text-center text-xs text-gray-900">{fmtMan(w.newSales)}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-gray-900">{fmtMan(weeklyData.reduce((s, w) => s + w.newSales, 0))}</TableCell>
                </TableRow>
                <TableRow className="bg-pink-50">
                  <TableCell className="text-center text-xs font-medium text-pink-700 bg-pink-100">예상매출</TableCell>
                  {weeklyData.map((w) => <TableCell key={`e${w.week}`} className="text-center text-xs text-pink-700">{fmtMan(w.expectedSales)}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-pink-700">{fmtMan(weeklyData.reduce((s, w) => s + w.expectedSales, 0))}</TableCell>
                </TableRow>
                <TableRow className="bg-green-50">
                  <TableCell className="text-center text-xs font-medium text-green-700 bg-green-100">등록매출</TableCell>
                  {weeklyData.map((w) => <TableCell key={`a${w.week}`} className="text-center text-xs text-green-700">{fmtMan(w.actualSales)}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-green-700">{fmtMan(weeklyData.reduce((s, w) => s + w.actualSales, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, value, color, isText }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${color}`}>{label}</span>
      <span className="text-sm font-bold text-gray-900">{isText ? value : value}</span>
    </div>
  )
}
