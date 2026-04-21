'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
}

function fmtMoney(v: number): string { return v ? v.toLocaleString() : '0' }
function fmtMan(v: number): string { if (!v) return '0'; return v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString() }
function autoWeek(c: string): number { const d = new Date(c).getDate(); if (d <= 7) return 1; if (d <= 14) return 2; if (d <= 21) return 3; return 4 }

export function OtSummaryCards({ assignments }: Props) {
  const completed = assignments.filter((a) => a.status === '완료')
  const newSales = completed.reduce((s, a) => s + (a.actual_sales ?? 0), 0)
  const totalExpected = assignments.reduce((s, a) => s + (a.expected_amount ?? a.expected_sales ?? 0), 0)

  // OT 현황
  const otInProgress = assignments.filter((a) => ['진행중', '배정완료'].includes(a.status)).length
  const otRejected = assignments.filter((a) => a.status === '거부').length
  const registered = completed.length
  const scheduleUndecided = assignments.filter((a) => (a.sales_status ?? a.contact_status) === '스케줄미확정').length
  const noContact = assignments.filter((a) => (a.sales_status ?? a.contact_status) === '연락두절').length
  const closingFailed = assignments.filter((a) => (a.sales_status ?? a.contact_status) === '클로징실패').length

  const totalCount = assignments.length
  const salesTargetCount = assignments.filter((a) => a.is_sales_target).length
  const ptConversionCount = assignments.filter((a) => a.is_pt_conversion).length
  const activeCount = assignments.filter((a) => ['배정완료', '진행중'].includes(a.status)).length
  const 클로징율 = activeCount > 0 ? Math.round((ptConversionCount / activeCount) * 100) : 0

  // 주차별
  const weeklyData = [1, 2, 3, 4].map((week) => {
    const wa = assignments.filter((a) => (a.week_number ?? autoWeek(a.created_at)) === week)
    const wc = wa.filter((a) => a.status === '완료')
    const sessioned = wa.filter((a) => a.sessions?.some((s) => s.completed_at))
    const ptConverted = wa.filter((a) => a.is_pt_conversion)
    return {
      week,
      assignedCount: wa.length,
      otSessionCount: sessioned.length,
      ptConversionCount: ptConverted.length,
      expectedSales: wa.reduce((s, a) => s + (a.expected_amount ?? a.expected_sales ?? 0), 0),
      actualSales: wc.reduce((s, a) => s + (a.actual_sales ?? 0), 0),
    }
  })

  return (
    <div className="space-y-6">
      {/* 매출 요약 */}
      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-gray-500">예상 매출</p>
            <p className="text-xl font-bold text-pink-600 mt-1">{fmtMoney(totalExpected)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-400">
          <CardContent className="pt-5 text-center">
            <p className="text-xs text-gray-500">등록 매출</p>
            <p className="text-xl font-bold text-green-700 mt-1">{fmtMoney(newSales)}</p>
          </CardContent>
        </Card>
      </div>

      {/* OT 현황 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900">[ 신규 ] OT 현황</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatusRow label="진행중" value={otInProgress} color="bg-green-100 text-green-700" />
          <StatusRow label="거부자" value={otRejected} color="bg-orange-100 text-orange-700" />
          <StatusRow label="등록완료" value={registered} color="bg-blue-100 text-blue-700" />
          <StatusRow label="스케줄미확정" value={scheduleUndecided} color="bg-yellow-100 text-yellow-700" />
          <StatusRow label="연락두절" value={noContact} color="bg-gray-100 text-gray-700" />
          <StatusRow label="클로싱실패" value={closingFailed} color="bg-red-100 text-red-700" />
          <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
            <StatusRow label="매출대상자" value={salesTargetCount} color="bg-blue-50 text-blue-700" />
            <StatusRow label="PT전환" value={ptConversionCount} color="bg-purple-50 text-purple-700" />
            <StatusRow label="클로징율" value={`${클로징율}%`} color="bg-yellow-50 text-yellow-700" isText />
          </div>
        </CardContent>
      </Card>

      {/* 당월 목표매출 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900">주차별 현황</CardTitle>
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
                  <TableCell className="text-center text-xs font-medium text-gray-900 bg-gray-50">배정인원</TableCell>
                  {weeklyData.map((w) => <TableCell key={`as${w.week}`} className="text-center text-xs text-gray-900">{w.assignedCount}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-gray-900">{weeklyData.reduce((s, w) => s + w.assignedCount, 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-gray-900 bg-gray-50">OT수업인원</TableCell>
                  {weeklyData.map((w) => <TableCell key={`ot${w.week}`} className="text-center text-xs text-gray-900">{w.otSessionCount}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-gray-900">{weeklyData.reduce((s, w) => s + w.otSessionCount, 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-purple-700 bg-purple-50">PT전환자</TableCell>
                  {weeklyData.map((w) => <TableCell key={`pt${w.week}`} className="text-center text-xs text-purple-700">{w.ptConversionCount}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-purple-700">{weeklyData.reduce((s, w) => s + w.ptConversionCount, 0)}</TableCell>
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

      {/* 전체 인원 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-900">인원 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
              <p className="text-xs text-gray-500">총 인원</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{salesTargetCount}</p>
              <p className="text-xs text-gray-500">매출대상자</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{ptConversionCount}</p>
              <p className="text-xs text-gray-500">PT전환</p>
            </div>
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
