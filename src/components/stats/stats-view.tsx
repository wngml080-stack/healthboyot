'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { PageTitle } from '@/components/shared/page-title'
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import type { StatsData } from '@/actions/stats'

interface Props {
  stats: StatsData
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

export function StatsView({ stats }: Props) {
  const handleExcelDownload = async () => {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()
    const ws = utils.json_to_sheet([
      { '구분': '신규 매출', '금액': stats.newSales },
      { '구분': '재등록 매출', '금액': stats.renewSales },
      { '구분': '당월 총 매출', '금액': stats.totalSales },
    ])
    utils.book_append_sheet(wb, ws, '매출요약')
    writeFile(wb, `통계_${format(new Date(), 'yyyyMMdd')}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle>통계 · 보고서</PageTitle>
        <Button variant="outline" size="sm" onClick={handleExcelDownload} className="bg-white text-gray-700 border-gray-300">
          <Download className="h-4 w-4 mr-1" />
          엑셀 다운로드
        </Button>
      </div>

      {/* 1. 매출 요약 (상단 3칸) */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="border-yellow-400">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">신규 매출</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmtMoney(stats.newSales)}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-400">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">재등록 매출</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{fmtMoney(stats.renewSales)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-400 bg-red-50">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-500">당월 총 매출</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{fmtMoney(stats.totalSales)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. 당월 목표매출 테이블 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">당월 목표매출</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-yellow-50">
                  <TableHead className="text-center text-gray-700 font-bold">구분</TableHead>
                  <TableHead className="text-center text-gray-700">1주차</TableHead>
                  <TableHead className="text-center text-gray-700">2주차</TableHead>
                  <TableHead className="text-center text-gray-700">3주차</TableHead>
                  <TableHead className="text-center text-gray-700">4주차</TableHead>
                  <TableHead className="text-center text-gray-700 font-bold">합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-center font-medium text-gray-900 bg-yellow-50">신규</TableCell>
                  {stats.weeklyData.map((w) => (
                    <TableCell key={`new-${w.week}`} className="text-center text-sm text-gray-900">{fmtMan(w.newSales)}</TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-gray-900">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.newSales, 0))}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center font-medium text-gray-900 bg-yellow-50">리뉴</TableCell>
                  {stats.weeklyData.map((w) => (
                    <TableCell key={`renew-${w.week}`} className="text-center text-sm text-gray-900">{fmtMan(w.renewSales)}</TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-gray-900">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.renewSales, 0))}</TableCell>
                </TableRow>
                <TableRow className="bg-pink-50">
                  <TableCell className="text-center font-medium text-pink-700 bg-pink-100">예상매출</TableCell>
                  {stats.weeklyData.map((w) => (
                    <TableCell key={`exp-${w.week}`} className="text-center text-sm text-pink-700">{fmtMan(w.expectedSales)}</TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-pink-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.expectedSales, 0))}</TableCell>
                </TableRow>
                <TableRow className="bg-green-50">
                  <TableCell className="text-center font-medium text-green-700 bg-green-100">등록매출</TableCell>
                  {stats.weeklyData.map((w) => (
                    <TableCell key={`act-${w.week}`} className="text-center text-sm text-green-700">{fmtMan(w.actualSales)}</TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-green-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.actualSales, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 3. 신규 OT 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">[ 신규 ] OT 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <StatusRow label="OT진행중" value={stats.otStatus.inProgress} color="bg-blue-100 text-blue-700" />
              <StatusRow label="OT거부자" value={stats.otStatus.rejected} color="bg-red-100 text-red-700" />
              <StatusRow label="등록완료" value={stats.otStatus.registered} color="bg-green-100 text-green-700" />
              <StatusRow label="스케줄미확정" value={stats.otStatus.scheduleUndecided} color="bg-orange-100 text-orange-700" />
              <StatusRow label="연락두절" value={stats.otStatus.noContact} color="bg-gray-100 text-gray-700" />
              <StatusRow label="클로싱실패" value={stats.otStatus.closingFailed} color="bg-red-50 text-red-600" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
              <StatusRow label="세일즈 진행인원" value={stats.salesSummary.진행인원} color="bg-blue-50 text-blue-700" />
              <StatusRow label="등록인원" value={stats.salesSummary.등록인원} color="bg-green-50 text-green-700" />
              <StatusRow label="클로징율" value={`${stats.salesSummary.클로징율}%`} color="bg-yellow-50 text-yellow-700" isText />
              <StatusRow label="객단가" value={fmtMoney(stats.salesSummary.객단가)} color="bg-purple-50 text-purple-700" isText />
            </div>
          </CardContent>
        </Card>

        {/* 4. 경로별 매출 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-900">경로별 매출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-center text-gray-700">경로</TableHead>
                    <TableHead className="text-center text-gray-700">등록매출</TableHead>
                    <TableHead className="text-center text-gray-700">진행인원</TableHead>
                    <TableHead className="text-center text-gray-700">등록인원</TableHead>
                    <TableHead className="text-center text-gray-700">클로징율</TableHead>
                    <TableHead className="text-center text-gray-700">객단가</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.routeSales.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-4">데이터 없음</TableCell></TableRow>
                  ) : (
                    stats.routeSales.map((r) => (
                      <TableRow key={r.route}>
                        <TableCell className="text-center font-medium text-gray-900">{r.route}</TableCell>
                        <TableCell className="text-center text-sm text-gray-900">{fmtMoney(r.등록매출)}</TableCell>
                        <TableCell className="text-center text-sm text-gray-900">{r.진행인원}</TableCell>
                        <TableCell className="text-center text-sm text-gray-900">{r.등록인원}</TableCell>
                        <TableCell className="text-center text-sm text-gray-900">{r.클로징율}%</TableCell>
                        <TableCell className="text-center text-sm text-gray-900">{fmtMoney(r.객단가)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. 트레이너별 매출 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">트레이너별 매출</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-center text-gray-700">이름</TableHead>
                  <TableHead className="text-center text-gray-700">신규 매출</TableHead>
                  <TableHead className="text-center text-gray-700">재등록 매출</TableHead>
                  <TableHead className="text-center text-gray-700">당월 총 매출</TableHead>
                  <TableHead className="text-center text-gray-700">등록인원</TableHead>
                  <TableHead className="text-center text-gray-700">클로징율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.trainerStats.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-4">데이터 없음</TableCell></TableRow>
                ) : (
                  stats.trainerStats.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="text-center font-medium text-gray-900">{t.name}</TableCell>
                      <TableCell className="text-center text-sm text-gray-900">{fmtMoney(t.newSales)}</TableCell>
                      <TableCell className="text-center text-sm text-gray-900">{fmtMoney(t.renewSales)}</TableCell>
                      <TableCell className="text-center text-sm font-bold text-gray-900">{fmtMoney(t.totalSales)}</TableCell>
                      <TableCell className="text-center text-sm text-gray-900">{t.등록인원}</TableCell>
                      <TableCell className="text-center text-sm text-gray-900">{t.클로징율}%</TableCell>
                    </TableRow>
                  ))
                )}
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
