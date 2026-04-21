'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { PageTitle } from '@/components/shared/page-title'
import { Download, Target } from 'lucide-react'
import { upsertSalesTarget } from '@/actions/sales-target'
import type { StatsData } from '@/actions/stats'
import type { SalesTarget } from '@/actions/sales-target'

interface Props {
  stats: StatsData
  target: SalesTarget | null
}

function fmtMoney(v: number): string { return v ? v.toLocaleString() : '0' }
function fmtMan(v: number): string { return v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v ? v.toLocaleString() : '0' }

export function StatsView({ stats, target }: Props) {
  const router = useRouter()
  const [showTarget, setShowTarget] = useState(false)
  const [targetAmount, setTargetAmount] = useState(target?.target_amount ?? 0)
  const [w1, setW1] = useState(target?.week1_target ?? 0)
  const [w2, setW2] = useState(target?.week2_target ?? 0)
  const [w3, setW3] = useState(target?.week3_target ?? 0)
  const [w4, setW4] = useState(target?.week4_target ?? 0)
  const [saving, setSaving] = useState(false)

  const achieveRate = target?.target_amount ? Math.round((stats.totalSales / target.target_amount) * 100) : 0

  const handleSaveTarget = async () => {
    setSaving(true)
    const now = new Date()
    await upsertSalesTarget({
      year: now.getFullYear(), month: now.getMonth() + 1,
      target_amount: targetAmount, week1_target: w1, week2_target: w2, week3_target: w3, week4_target: w4,
    })
    setSaving(false)
    setShowTarget(false)
    router.refresh()
  }

  const handleExcelDownload = async () => {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    utils.book_append_sheet(wb, utils.json_to_sheet([
      { '구분': '신규 매출', '금액': stats.newSales },
      { '구분': '당월 총 매출', '금액': stats.totalSales },
      { '구분': '목표 매출', '금액': target?.target_amount ?? 0 },
      { '구분': '달성율', '금액': `${achieveRate}%` },
    ]), '매출요약')

    utils.book_append_sheet(wb, utils.json_to_sheet([
      { '항목': '진행중', '값': stats.otStatus.inProgress },
      { '항목': '거부자', '값': stats.otStatus.rejected },
      { '항목': '등록완료', '값': stats.otStatus.registered },
      { '항목': '스케줄미확정', '값': stats.otStatus.scheduleUndecided },
      { '항목': '연락두절', '값': stats.otStatus.noContact },
      { '항목': '클로싱실패', '값': stats.otStatus.closingFailed },
    ]), 'OT현황')

    utils.book_append_sheet(wb, utils.json_to_sheet(
      stats.trainerStats.map((t) => ({
        '이름': t.name, 'OT배정': t.배정인원 ?? 0, '플로팅': t.플로팅 ?? 0,
        '총인원': t.총인원 ?? 0, 'PT전환자': t.PT전환자 ?? 0,
        '등록인원': t.등록인원, '클로징율': `${t.클로징율}%`, '등록매출': t.newSales,
      }))
    ), '트레이너별')

    const now = new Date()
    writeFile(wb, `HEALTHBOYGYM_${now.getFullYear()}년${now.getMonth()+1}월_리포트.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <PageTitle>통계 · 보고서</PageTitle>
        <Button variant="outline" size="sm" onClick={handleExcelDownload} className="bg-white text-gray-700 border-gray-300">
          <Download className="h-4 w-4 mr-1" />엑셀
        </Button>
      </div>

      {/* OT 현황 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-gray-900">OT 현황</CardTitle>
            <span className="text-xs text-gray-400">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="총 인원" value={stats.otStatus.inProgress + stats.otStatus.rejected + stats.otStatus.registered} bg="bg-gray-50" text="text-gray-900" />
            <StatBox label="진행중" value={stats.otStatus.inProgress} bg="bg-green-50" text="text-green-700" />
            <StatBox label="등록완료" value={stats.otStatus.registered} bg="bg-blue-50" text="text-blue-700" />
            <StatBox label="거부자" value={stats.otStatus.rejected} bg="bg-orange-50" text="text-orange-700" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="1차 완료" value={stats.otStatus.session1Done} bg="bg-emerald-50" text="text-emerald-700" />
            <StatBox label="2차 완료" value={stats.otStatus.session2Done} bg="bg-emerald-50" text="text-emerald-700" />
            <StatBox label="3차+ 완료" value={stats.otStatus.session3Done} bg="bg-emerald-50" text="text-emerald-700" />
          </div>
          <div className="border-t border-gray-100" />
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="연락두절" value={stats.otStatus.noContact} bg="bg-gray-50" text="text-gray-600" />
            <StatBox label="클로싱실패" value={stats.otStatus.closingFailed} bg="bg-red-50" text="text-red-600" />
            <StatBox label="스케줄미확정" value={stats.otStatus.scheduleUndecided} bg="bg-yellow-50" text="text-yellow-700" />
            <StatBox label="매출대상자" value={stats.salesSummary.진행인원} bg="bg-blue-50" text="text-blue-700" />
            <StatBox label="PT전환" value={stats.salesSummary.등록인원} bg="bg-purple-50" text="text-purple-700" />
            <StatBox label="클로징율" value={`${stats.salesSummary.클로징율}%`} bg="bg-pink-50" text="text-pink-700" />
          </div>
        </CardContent>
      </Card>

      {/* 당월 목표매출 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-bold text-gray-900">당월 목표매출</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-center text-xs text-gray-700 font-bold">구분</TableHead>
                  <TableHead className="text-center text-xs text-gray-600">1주차</TableHead>
                  <TableHead className="text-center text-xs text-gray-600">2주차</TableHead>
                  <TableHead className="text-center text-xs text-gray-600">3주차</TableHead>
                  <TableHead className="text-center text-xs text-gray-600">4주차</TableHead>
                  <TableHead className="text-center text-xs text-gray-700 font-bold">합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-gray-900 bg-gray-50">배정인원</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`as${w.week}`} className="text-center text-xs text-gray-900">{w.assignedCount ?? 0}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-gray-900">{stats.weeklyData.reduce((s, w) => s + (w.assignedCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-gray-900 bg-gray-50">OT수업인원</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`ot${w.week}`} className="text-center text-xs text-gray-900">{w.otSessionCount ?? 0}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-gray-900">{stats.weeklyData.reduce((s, w) => s + (w.otSessionCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-purple-700 bg-purple-50/50">PT전환자</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`pt${w.week}`} className="text-center text-xs text-purple-700">{w.ptConversionCount ?? 0}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-purple-700">{stats.weeklyData.reduce((s, w) => s + (w.ptConversionCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-pink-700 bg-pink-50/50">예상매출</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`e${w.week}`} className="text-center text-xs text-pink-700">{fmtMan(w.expectedSales)}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-pink-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.expectedSales, 0))}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center text-xs font-medium text-green-700 bg-green-50/50">등록매출</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`a${w.week}`} className="text-center text-xs text-green-700">{fmtMan(w.actualSales)}</TableCell>)}
                  <TableCell className="text-center text-xs font-bold text-green-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.actualSales, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 요일별 OT 현황 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-bold text-gray-900">요일별 OT 현황</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {stats.dailyData.map((d) => {
              const maxCount = Math.max(...stats.dailyData.map((x) => x.count), 1)
              const width = (d.count / maxCount) * 100
              const isWeekend = d.day === '토' || d.day === '일'
              return (
                <div key={d.day} className="flex items-center gap-3">
                  <span className={`w-6 text-center text-xs font-bold ${isWeekend ? 'text-red-500' : 'text-gray-700'}`}>{d.day}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isWeekend ? 'bg-red-300' : 'bg-yellow-400'}`} style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right">{d.count}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 목표 설정 다이얼로그 */}
      <Dialog open={showTarget} onOpenChange={setShowTarget}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>당월 목표 설정</DialogTitle>
            <DialogDescription>{new Date().getFullYear()}년 {new Date().getMonth() + 1}월 · 전체 + 강사별 목표</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold text-sm">전체 목표매출</Label>
              <Input type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300 h-9" placeholder="전체 목표 금액" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['1주차', w1, setW1], ['2주차', w2, setW2], ['3주차', w3, setW3], ['4주차', w4, setW4]].map(([label, val, setter]) => (
                <div key={label as string} className="space-y-1">
                  <Label className="text-xs text-gray-600">{label as string}</Label>
                  <Input type="number" value={val as number} onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300 h-8" />
                </div>
              ))}
            </div>
            {stats.trainerStats.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-gray-700 font-bold text-sm">강사별 개별 목표</Label>
                <p className="text-xs text-gray-400">각 강사의 당월 목표를 설정하세요.</p>
                <div className="space-y-2">
                  {stats.trainerStats.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-900 w-14 shrink-0 truncate">{t.name}</span>
                      <Input type="number" placeholder="목표 금액" className="bg-white text-gray-900 border-gray-300 h-8 text-xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" className="text-gray-900 bg-gray-100 h-8" onClick={() => setShowTarget(false)}>취소</Button>
              <Button size="sm" onClick={handleSaveTarget} disabled={saving} className="bg-yellow-400 text-black hover:bg-yellow-500 h-8">
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatBox({ label, value, bg, text }: { label: string; value: number | string; bg: string; text: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${bg}`}>
      <span className={`text-xs font-medium ${text}`}>{label}</span>
      <span className={`text-base font-bold ${text}`}>{value}</span>
    </div>
  )
}
