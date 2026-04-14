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
import { Download, Settings, Target } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <PageTitle>통계 · 보고서</PageTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTarget(true)} className="bg-white text-gray-700 border-gray-300">
            <Settings className="h-4 w-4 mr-1" />
            목표 설정
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcelDownload} className="bg-white text-gray-700 border-gray-300">
            <Download className="h-4 w-4 mr-1" />
            엑셀
          </Button>
        </div>
      </div>

      {/* 목표 달성율 */}
      {target && (
        <Card className="border-yellow-400">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-yellow-500" />
                <p className="text-sm font-medium text-gray-900">당월 목표매출</p>
              </div>
              <p className="text-sm text-gray-500">목표 {fmtMoney(target.target_amount)}원</p>
            </div>
            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${achieveRate >= 100 ? 'bg-green-500' : achieveRate >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(achieveRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-sm text-gray-900 font-bold">{fmtMoney(stats.totalSales)}원</p>
              <p className={`text-sm font-bold ${achieveRate >= 100 ? 'text-green-600' : achieveRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                {achieveRate}% 달성
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OT 현황 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-900">[ 신규 ] OT 현황</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <StatusRow label="진행중" value={stats.otStatus.inProgress} color="bg-green-100 text-green-700" />
          <StatusRow label="거부자" value={stats.otStatus.rejected} color="bg-orange-100 text-orange-700" />
          <StatusRow label="등록완료" value={stats.otStatus.registered} color="bg-blue-100 text-blue-700" />
          <StatusRow label="스케줄미확정" value={stats.otStatus.scheduleUndecided} color="bg-yellow-100 text-yellow-700" />
          <StatusRow label="연락두절" value={stats.otStatus.noContact} color="bg-gray-100 text-gray-700" />
          <StatusRow label="클로싱실패" value={stats.otStatus.closingFailed} color="bg-red-100 text-red-700" />
          <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
            <StatusRow label="매출대상자" value={stats.salesSummary.진행인원} color="bg-blue-50 text-blue-700" />
            <StatusRow label="PT전환" value={stats.salesSummary.등록인원} color="bg-purple-50 text-purple-700" />
            <StatusRow label="클로징율" value={`${stats.salesSummary.클로징율}%`} color="bg-yellow-50 text-yellow-700" isText />
          </div>
        </CardContent>
      </Card>

      {/* 당월 목표매출 — 재구성 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-900">당월 목표매출</CardTitle></CardHeader>
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
                  <TableCell className="text-center font-medium text-gray-900 bg-gray-50">배정인원</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`as${w.week}`} className="text-center text-sm text-gray-900">{w.assignedCount ?? 0}</TableCell>)}
                  <TableCell className="text-center font-bold text-gray-900">{stats.weeklyData.reduce((s, w) => s + (w.assignedCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center font-medium text-gray-900 bg-gray-50">OT수업인원</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`ot${w.week}`} className="text-center text-sm text-gray-900">{w.otSessionCount ?? 0}</TableCell>)}
                  <TableCell className="text-center font-bold text-gray-900">{stats.weeklyData.reduce((s, w) => s + (w.otSessionCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-center font-medium text-purple-700 bg-purple-50">PT전환자</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`pt${w.week}`} className="text-center text-sm text-purple-700">{w.ptConversionCount ?? 0}</TableCell>)}
                  <TableCell className="text-center font-bold text-purple-700">{stats.weeklyData.reduce((s, w) => s + (w.ptConversionCount ?? 0), 0)}</TableCell>
                </TableRow>
                <TableRow className="bg-pink-50">
                  <TableCell className="text-center font-medium text-pink-700 bg-pink-100">예상매출</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`e${w.week}`} className="text-center text-sm text-pink-700">{fmtMan(w.expectedSales)}</TableCell>)}
                  <TableCell className="text-center font-bold text-pink-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.expectedSales, 0))}</TableCell>
                </TableRow>
                <TableRow className="bg-green-50">
                  <TableCell className="text-center font-medium text-green-700 bg-green-100">등록매출</TableCell>
                  {stats.weeklyData.map((w) => <TableCell key={`a${w.week}`} className="text-center text-sm text-green-700">{fmtMan(w.actualSales)}</TableCell>)}
                  <TableCell className="text-center font-bold text-green-700">{fmtMan(stats.weeklyData.reduce((s, w) => s + w.actualSales, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 트레이너별 매출 — 재구성 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-900">트레이너별 매출</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-gray-50">
                <TableHead className="text-center text-gray-700">이름</TableHead>
                <TableHead className="text-center text-gray-700">OT배정</TableHead>
                <TableHead className="text-center text-gray-700">플로팅</TableHead>
                <TableHead className="text-center text-gray-700">총인원</TableHead>
                <TableHead className="text-center text-gray-700">PT전환자</TableHead>
                <TableHead className="text-center text-gray-700">등록인원</TableHead>
                <TableHead className="text-center text-gray-700">클로징율</TableHead>
                <TableHead className="text-center text-gray-700">등록매출</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {stats.trainerStats.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-4">데이터 없음</TableCell></TableRow>
                ) : stats.trainerStats.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="text-center font-medium text-gray-900">{t.name}</TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{t.배정인원 ?? 0}</TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{t.플로팅 ?? 0}</TableCell>
                    <TableCell className="text-center text-sm font-bold text-gray-900">{t.총인원 ?? 0}</TableCell>
                    <TableCell className="text-center text-sm text-purple-700">{t.PT전환자 ?? 0}</TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{t.등록인원}</TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{t.클로징율}%</TableCell>
                    <TableCell className="text-center text-sm font-bold text-green-700">{fmtMoney(t.newSales)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 요일별 OT 현황 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base text-gray-900">요일별 OT 현황</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.dailyData.map((d) => {
              const maxCount = Math.max(...stats.dailyData.map((x) => x.count), 1)
              const width = (d.count / maxCount) * 100
              const isWeekend = d.day === '토' || d.day === '일'
              return (
                <div key={d.day} className="flex items-center gap-3">
                  <span className={`w-6 text-center text-sm font-bold ${isWeekend ? 'text-red-500' : 'text-gray-900'}`}>{d.day}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isWeekend ? 'bg-red-400' : 'bg-yellow-400'}`} style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-sm text-gray-900 w-8 text-right">{d.count}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 목표 설정 다이얼로그 */}
      <Dialog open={showTarget} onOpenChange={setShowTarget}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>당월 목표매출 설정</DialogTitle>
            <DialogDescription>{new Date().getFullYear()}년 {new Date().getMonth() + 1}월</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">총 목표매출</Label>
              <Input type="number" value={targetAmount} onChange={(e) => setTargetAmount(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">1주차</Label>
                <Input type="number" value={w1} onChange={(e) => setW1(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">2주차</Label>
                <Input type="number" value={w2} onChange={(e) => setW2(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">3주차</Label>
                <Input type="number" value={w3} onChange={(e) => setW3(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">4주차</Label>
                <Input type="number" value={w4} onChange={(e) => setW4(Number(e.target.value))} className="bg-white text-gray-900 border-gray-300" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="text-gray-900 bg-gray-100" onClick={() => setShowTarget(false)}>취소</Button>
              <Button onClick={handleSaveTarget} disabled={saving} className="bg-yellow-400 text-black hover:bg-yellow-500">
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
