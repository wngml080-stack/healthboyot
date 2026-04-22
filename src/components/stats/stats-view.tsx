'use client'

import { useState, useRef, useCallback } from 'react'
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
import { Download, Target, Camera } from 'lucide-react'
import { upsertSalesTarget } from '@/actions/sales-target'
import type { StatsData } from '@/actions/stats'
import type { SalesTarget } from '@/actions/sales-target'

interface Props {
  stats: StatsData
  target: SalesTarget | null
}

function fmtMoney(v: number): string { return v ? v.toLocaleString() : '0' }
function fmtMan(v: number): string { return v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v ? v.toLocaleString() : '0' }

export function StatsView({ stats: initialStats, target }: Props) {
  const router = useRouter()
  const [stats, setStats] = useState(initialStats)
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [baseDate] = useState(() => new Date())
  const [showTarget, setShowTarget] = useState(false)
  const [targetAmount, setTargetAmount] = useState(target?.target_amount ?? 0)
  const [w1, setW1] = useState(target?.week1_target ?? 0)
  const [w2, setW2] = useState(target?.week2_target ?? 0)
  const [w3, setW3] = useState(target?.week3_target ?? 0)
  const [w4, setW4] = useState(target?.week4_target ?? 0)
  const [saving, setSaving] = useState(false)

  const fetchStats = async (p: 'weekly' | 'monthly', o: number) => {
    setLoading(true)
    const { getStats } = await import('@/actions/stats')
    const result = await getStats(p, o)
    setStats(result)
    setLoading(false)
  }

  const handlePeriodChange = (p: 'weekly' | 'monthly') => { setPeriod(p); setOffset(0); fetchStats(p, 0) }
  const handlePrev = () => { const o = offset - 1; setOffset(o); fetchStats(period, o) }
  const handleNext = () => { if (offset >= 0) return; const o = offset + 1; setOffset(o); fetchStats(period, o) }
  const handleToday = () => { setOffset(0); fetchStats(period, 0) }

  const getPeriodLabel = () => {
    if (period === 'weekly') {
      const dayOfWeek = baseDate.getDay()
      const thisMonday = new Date(baseDate)
      thisMonday.setDate(baseDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      const targetMonday = new Date(thisMonday)
      targetMonday.setDate(thisMonday.getDate() + offset * 7)
      const targetSunday = new Date(targetMonday)
      targetSunday.setDate(targetMonday.getDate() + 6)
      return `${targetMonday.getMonth() + 1}/${targetMonday.getDate()} ~ ${targetSunday.getMonth() + 1}/${targetSunday.getDate()}`
    }
    const targetMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1)
    return `${targetMonth.getFullYear()}년 ${targetMonth.getMonth() + 1}월`
  }

  const achieveRate = target?.target_amount ? Math.round((stats.totalSales / target.target_amount) * 100) : 0

  const handleSaveTarget = async () => {
    setSaving(true)
    await upsertSalesTarget({
      year: baseDate.getFullYear(), month: baseDate.getMonth() + 1,
      target_amount: targetAmount, week1_target: w1, week2_target: w2, week3_target: w3, week4_target: w4,
    })
    setSaving(false)
    setShowTarget(false)
    router.refresh()
  }

  const statsRef = useRef<HTMLDivElement>(null)
  const otRef = useRef<HTMLDivElement>(null)
  const weeklyRef = useRef<HTMLDivElement>(null)
  const dailyRef = useRef<HTMLDivElement>(null)

  const captureSection = useCallback(async (ref: React.RefObject<HTMLDivElement | null>, name: string) => {
    if (!ref.current) return
    const el = ref.current
    const { toPng } = await import('html-to-image')

    // 카메라 버튼 숨기기
    const camBtns = el.querySelectorAll<HTMLElement>('.capture-hide')
    camBtns.forEach((b) => b.style.display = 'none')

    // sticky, overflow 캡처 깨짐 방지
    const stickyEls = el.querySelectorAll<HTMLElement>('.sticky')
    const overflowEls = el.querySelectorAll<HTMLElement>('.overflow-x-auto')
    stickyEls.forEach((s) => { s.dataset.origPos = s.style.position; s.style.position = 'static' })
    overflowEls.forEach((o) => { o.dataset.origOv = o.style.overflow; o.style.overflow = 'visible' })

    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: { overflow: 'visible' },
      })

      const link = document.createElement('a')
      link.download = `${name}_${getPeriodLabel().replace(/[^가-힣0-9~/]/g, '')}.png`
      link.href = dataUrl
      link.click()
    } finally {
      camBtns.forEach((b) => b.style.display = '')
      stickyEls.forEach((s) => { s.style.position = s.dataset.origPos ?? ''; delete s.dataset.origPos })
      overflowEls.forEach((o) => { o.style.overflow = o.dataset.origOv ?? ''; delete o.dataset.origOv })
    }
  }, [period, offset]) // eslint-disable-line react-hooks/exhaustive-deps

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
      { '항목': '총 인원', '값': stats.otStatus.total },
      { '항목': '진행회원', '값': stats.otStatus.inProgress },
      { '항목': '미진행회원', '값': stats.otStatus.notStarted },
      { '항목': '1차 완료', '값': stats.otStatus.session1Done },
      { '항목': '2차 완료', '값': stats.otStatus.session2Done },
      { '항목': '3차+ 완료', '값': stats.otStatus.session3Done },
      { '항목': '연락두절', '값': stats.otStatus.noContact },
      { '항목': '스케줄미확정', '값': stats.otStatus.scheduleUndecided },
      { '항목': '매출대상자', '값': stats.otStatus.salesTargets },
      { '항목': '클로싱실패', '값': stats.otStatus.closingFailed },
      { '항목': 'PT전환', '값': stats.otStatus.ptConversions },
      { '항목': '클로징율', '값': `${stats.otStatus.closingRate}%` },
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
    <div className="space-y-4" ref={statsRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <PageTitle>통계 · 보고서</PageTitle>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button className={`px-3 py-1.5 text-xs font-bold transition-colors ${period === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={() => handlePeriodChange('weekly')} disabled={loading}>주간</button>
            <button className={`px-3 py-1.5 text-xs font-bold transition-colors ${period === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`} onClick={() => handlePeriodChange('monthly')} disabled={loading}>월간</button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExcelDownload} className="bg-white text-gray-700 border-gray-300 h-8">
            <Download className="h-4 w-4 mr-1" />엑셀
          </Button>
          <Button variant="outline" size="sm" onClick={() => captureSection(statsRef, '통계보고서')} className="bg-white text-gray-700 border-gray-300 h-8">
            <Camera className="h-4 w-4 mr-1" />이미지
          </Button>
        </div>
      </div>

      {/* 기간 네비게이션 */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={handlePrev} disabled={loading} className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 text-sm">←</button>
        <button onClick={handleToday} disabled={loading} className="text-sm font-bold text-white hover:text-blue-400 min-w-[140px] text-center">{getPeriodLabel()}</button>
        <button onClick={handleNext} disabled={loading || offset >= 0} className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-30 text-sm">→</button>
        {offset !== 0 && <button onClick={handleToday} className="text-xs text-blue-400 hover:underline font-medium">오늘</button>}
      </div>

      {/* OT 현황 */}
      <div ref={otRef}>
      <Card className={`bg-white border-gray-200 ${loading ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-gray-900">OT 현황</CardTitle>
              <button onClick={() => captureSection(otRef, 'OT현황')} className="capture-hide text-gray-400 hover:text-gray-600"><Camera className="h-3.5 w-3.5" /></button>
            </div>
            <span className="text-xs text-gray-400">{getPeriodLabel()}</span>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="총 인원" value={stats.otStatus.total} bg="bg-gray-50" text="text-gray-900" sub="회원 총인원" />
            <StatBox label="진행회원" value={stats.otStatus.inProgress} bg="bg-green-50" text="text-green-700" sub="OT 진행한 회원" />
            <StatBox label="미진행회원" value={stats.otStatus.notStarted} bg="bg-orange-50" text="text-orange-700" sub="스케줄 미잡힌 대상자" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="1차 완료" value={stats.otStatus.session1Done} bg="bg-emerald-50" text="text-emerald-700" sub="1차 수업 완료" />
            <StatBox label="2차 완료" value={stats.otStatus.session2Done} bg="bg-emerald-50" text="text-emerald-700" sub="2차 수업 완료" />
            <StatBox label="3차+ 완료" value={stats.otStatus.session3Done} bg="bg-emerald-50" text="text-emerald-700" sub="3차 이상 수업 완료" />
          </div>
          <div className="border-t border-gray-100" />
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="연락두절" value={stats.otStatus.noContact} bg="bg-gray-50" text="text-gray-600" sub="연락 안 되시는 분" />
            <StatBox label="스케줄미확정" value={stats.otStatus.scheduleUndecided} bg="bg-yellow-50" text="text-yellow-700" sub="스케줄 조율중" />
            <StatBox label="매출대상자" value={stats.otStatus.salesTargets} bg="bg-blue-50" text="text-blue-700" sub="매출 대상자" />
            <StatBox label="클로징실패" value={stats.otStatus.closingFailed} bg="bg-red-50" text="text-red-600" sub="세일즈 진행 후 실패" />
            <StatBox label="PT전환" value={stats.otStatus.ptConversions} bg="bg-purple-50" text="text-purple-700" sub="OT → PT 전환" />
            <StatBox label="클로징율" value={`${stats.otStatus.closingRate}%`} bg="bg-pink-50" text="text-pink-700" sub="진행회원 대비 PT전환" />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* 당월 목표매출 */}
      <div ref={weeklyRef}>
      <Card className={`bg-white border-gray-200 ${loading ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold text-gray-900">당월 목표매출</CardTitle>
            <button onClick={() => captureSection(weeklyRef, '목표매출')} className="capture-hide text-gray-400 hover:text-gray-600"><Camera className="h-3.5 w-3.5" /></button>
          </div>
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
      </div>

      {/* 요일별 트레이너 비중 */}
      <div ref={dailyRef}>
      <Card className={`bg-white border-gray-200 ${loading ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold text-gray-900">요일별 트레이너 비중</CardTitle>
            <button onClick={() => captureSection(dailyRef, '요일별비중')} className="capture-hide text-gray-400 hover:text-gray-600"><Camera className="h-3.5 w-3.5" /></button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {(() => {
            const colors = ['bg-blue-400', 'bg-yellow-400', 'bg-green-400', 'bg-purple-400', 'bg-pink-400', 'bg-indigo-400', 'bg-orange-400', 'bg-teal-400']
            // 전체 트레이너 이름 목록 (색상 고정용)
            const allTrainerNames = Array.from(new Set(stats.dailyData.flatMap(d => d.trainers.map(t => t.name))))
            const colorMap = new Map(allTrainerNames.map((name, i) => [name, colors[i % colors.length]]))

            return (
              <div className="space-y-4">
                {stats.dailyData.map((d) => {
                  const isWeekend = d.day === '토' || d.day === '일'
                  if (d.count === 0) return (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className={`w-6 text-center text-xs font-bold shrink-0 ${isWeekend ? 'text-red-500' : 'text-gray-700'}`}>{d.day}</span>
                      <div className="flex-1 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-[10px] text-gray-400">-</span>
                      </div>
                      <span className="text-xs text-gray-400 w-6 text-right">0</span>
                    </div>
                  )
                  return (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className={`w-6 text-center text-xs font-bold shrink-0 ${isWeekend ? 'text-red-500' : 'text-gray-700'}`}>{d.day}</span>
                      <div className="flex-1 h-8 rounded-full overflow-hidden flex bg-gray-100">
                        {d.trainers.map((t) => {
                          const pct = d.count > 0 ? t.count / d.count * 100 : 0
                          return (
                            <div key={t.name} className={`${colorMap.get(t.name) ?? 'bg-gray-300'} flex items-center justify-center`} style={{ width: `${pct}%` }}>
                              {pct >= 15 && <span className="text-[10px] font-bold text-white truncate px-0.5">{t.name} {Math.round(pct)}%</span>}
                            </div>
                          )
                        })}
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-6 text-right">{d.count}</span>
                    </div>
                  )
                })}
                {/* 범례 */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-1">
                  {allTrainerNames.map((name) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${colorMap.get(name)}`} />
                      <span className="text-xs text-gray-700">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>
      </div>

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

function StatBox({ label, value, bg, text, sub }: { label: string; value: number | string; bg: string; text: string; sub?: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${bg}`}>
      <div>
        <span className={`text-xs font-medium ${text}`}>{label}</span>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-base font-bold ${text}`}>{value}</span>
    </div>
  )
}
