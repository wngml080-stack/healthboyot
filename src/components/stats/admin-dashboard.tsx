'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Users, TrendingUp, ClipboardCheck, BarChart3, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AdminDashboardData } from '@/actions/admin-dashboard'

interface Props {
  data: AdminDashboardData
  initialPeriod: 'weekly' | 'monthly'
}

export function AdminDashboard({ data: initialData, initialPeriod }: Props) {
  const router = useRouter()
  const [period, setPeriod] = useState<'weekly' | 'monthly'>(initialPeriod)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const fetchData = async (p: 'weekly' | 'monthly', o: number) => {
    setLoading(true)
    const { getAdminDashboard } = await import('@/actions/admin-dashboard')
    const result = await getAdminDashboard(p, o)
    setData(result)
    setLoading(false)
  }

  const handlePeriodChange = (p: 'weekly' | 'monthly') => {
    setPeriod(p)
    setOffset(0)
    fetchData(p, 0)
  }

  const handlePrev = () => { const o = offset - 1; setOffset(o); fetchData(period, o) }
  const handleNext = () => { const o = offset + 1; setOffset(o); fetchData(period, o) }
  const handleToday = () => { setOffset(0); fetchData(period, 0) }

  const { trainers, totals } = data

  const handleExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()
    utils.book_append_sheet(wb, utils.json_to_sheet(
      trainers.map((t) => ({
        '트레이너': t.name,
        '총 배정': t.totalMembers,
        '진행중': t.activeMembers,
        '완료': t.completedMembers,
        '거부': t.rejectedMembers,
        'OT 수업수': t.otSessionsTotal,
        '기간내 수업': t.otSessionsThisPeriod,
        '매출대상': t.salesTargets,
        'PT전환': t.ptConversions,
        '클로징율(%)': t.closingRate,
        '인바디': t.inbodyCount,
        'OT이외 인정(승인)': t.registrationCredits,
        '인정건수(대기)': t.pendingCredits,
        '등록금액(원)': t.registrationAmount,
        '연락두절': t.noContact,
        '클로징실패': t.closingFailed,
        '스케줄미확정': t.scheduleUndecided,
      }))
    ), '트레이너별 실적')
    writeFile(wb, `관리자_대시보드_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 + 기간 필터 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">관리자 대시보드</h2>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                className={`px-4 py-2 text-sm font-bold transition-colors ${period === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                onClick={() => handlePeriodChange('weekly')}
                disabled={loading}
              >주간</button>
              <button
                className={`px-4 py-2 text-sm font-bold transition-colors ${period === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                onClick={() => handlePeriodChange('monthly')}
                disabled={loading}
              >월간</button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExcel} className="bg-white text-gray-700 border-gray-300">
              <Download className="h-4 w-4 mr-1" />엑셀
            </Button>
          </div>
        </div>
        {/* 기간 네비게이션 */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={handlePrev} disabled={loading} className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={handleToday} disabled={loading} className="text-sm font-bold text-white hover:text-blue-400 min-w-[180px] text-center">
            {data.periodLabel}
          </button>
          <button onClick={handleNext} disabled={loading || offset >= 0} className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
          {offset !== 0 && (
            <button onClick={handleToday} className="text-xs text-blue-600 hover:underline font-medium">오늘</button>
          )}
        </div>
      </div>

      {/* 트레이너별 실적 비교 테이블 */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900">트레이너별 실적 종합</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-400">로딩 중...</div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-center font-bold text-gray-700 sticky left-0 bg-gray-50 z-10">트레이너</TableHead>
                    <TableHead className="text-center text-gray-600">총 배정</TableHead>
                    <TableHead className="text-center text-gray-600">진행중</TableHead>
                    <TableHead className="text-center text-gray-600">완료</TableHead>
                    <TableHead className="text-center text-gray-600">거부</TableHead>
                    <TableHead className="text-center text-blue-600 font-bold">OT수업</TableHead>
                    <TableHead className="text-center text-purple-600 font-bold">PT전환</TableHead>
                    <TableHead className="text-center text-amber-600 font-bold">클로징율</TableHead>
                    <TableHead className="text-center text-purple-600">인바디</TableHead>
                    <TableHead className="text-center text-emerald-600 font-bold">OT이외 인정</TableHead>
                    <TableHead className="text-center text-green-600 font-bold">등록금액</TableHead>
                    <TableHead className="text-center text-gray-500">연락두절</TableHead>
                    <TableHead className="text-center text-gray-500">클로징실패</TableHead>
                    <TableHead className="text-center text-gray-500">미확정</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-gray-400 py-8">데이터가 없습니다</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {trainers.map((t) => (
                        <TableRow key={t.id} className="hover:bg-gray-50">
                          <TableCell className="text-center font-bold text-gray-900 sticky left-0 bg-white z-10">{t.name}</TableCell>
                          <TableCell className="text-center text-sm">{t.totalMembers}</TableCell>
                          <TableCell className="text-center text-sm text-blue-600">{t.activeMembers}</TableCell>
                          <TableCell className="text-center text-sm text-green-600 font-bold">{t.completedMembers}</TableCell>
                          <TableCell className="text-center text-sm text-red-500">{t.rejectedMembers || '-'}</TableCell>
                          <TableCell className="text-center text-sm">
                            <span className="font-bold text-blue-700">{t.otSessionsThisPeriod}</span>
                            <span className="text-gray-400 text-xs ml-1">/{t.otSessionsTotal}</span>
                          </TableCell>
                          <TableCell className="text-center text-sm font-bold text-purple-700">{t.ptConversions || '-'}</TableCell>
                          <TableCell className="text-center text-sm">
                            <Badge className={`text-xs ${t.closingRate >= 50 ? 'bg-green-100 text-green-700' : t.closingRate >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {t.closingRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm font-bold text-purple-700">{t.inbodyCount || '-'}</TableCell>
                          <TableCell className="text-center text-sm">
                            <span className="font-bold text-emerald-700">{t.registrationCredits}</span>
                            {t.pendingCredits > 0 && <span className="text-yellow-600 text-xs ml-1">(+{t.pendingCredits})</span>}
                          </TableCell>
                          <TableCell className="text-center text-sm font-bold text-green-700">
                            {t.registrationAmount > 0 ? t.registrationAmount.toLocaleString() : '-'}
                          </TableCell>
                          <TableCell className="text-center text-sm text-gray-500">{t.noContact || '-'}</TableCell>
                          <TableCell className="text-center text-sm text-gray-500">{t.closingFailed || '-'}</TableCell>
                          <TableCell className="text-center text-sm text-gray-500">{t.scheduleUndecided || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {/* 합계 행 */}
                      <TableRow className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <TableCell className="text-center text-gray-900 sticky left-0 bg-gray-100 z-10">합계</TableCell>
                        <TableCell className="text-center">{totals.totalMembers}</TableCell>
                        <TableCell className="text-center text-blue-600">{totals.activeMembers}</TableCell>
                        <TableCell className="text-center text-green-600">{totals.completedMembers}</TableCell>
                        <TableCell className="text-center text-red-500">{totals.rejectedMembers || '-'}</TableCell>
                        <TableCell className="text-center text-blue-700">{totals.otSessionsThisPeriod}<span className="text-gray-400 font-normal text-xs ml-1">/{totals.otSessionsTotal}</span></TableCell>
                        <TableCell className="text-center text-purple-700">{totals.ptConversions}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${totals.closingRate >= 50 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{totals.closingRate}%</Badge>
                        </TableCell>
                        <TableCell className="text-center text-purple-700">{totals.inbodyCount}</TableCell>
                        <TableCell className="text-center text-emerald-700">{totals.registrationCredits}{totals.pendingCredits > 0 && <span className="text-yellow-600 text-xs ml-1">(+{totals.pendingCredits})</span>}</TableCell>
                        <TableCell className="text-center text-green-700">{totals.registrationAmount > 0 ? totals.registrationAmount.toLocaleString() : '-'}</TableCell>
                        <TableCell className="text-center text-gray-500">{trainers.reduce((s, t) => s + t.noContact, 0) || '-'}</TableCell>
                        <TableCell className="text-center text-gray-500">{trainers.reduce((s, t) => s + t.closingFailed, 0) || '-'}</TableCell>
                        <TableCell className="text-center text-gray-500">{trainers.reduce((s, t) => s + t.scheduleUndecided, 0) || '-'}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 트레이너별 카드 뷰 */}
      {(() => {
        // 클로징 순위 계산 (totalMembers > 0인 트레이너만)
        const ranked = trainers
          .filter((t) => t.totalMembers > 0)
          .map((t) => ({ id: t.id, rate: t.closingRate }))
          .sort((a, b) => b.rate - a.rate)
        const rankMap = new Map<string, number>()
        ranked.forEach((r, i) => { if (r.rate > 0) rankMap.set(r.id, i + 1) })
        const medals = ['', '🥇', '🥈', '🥉']

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* OT 현황 카드 */}
            <Card className="bg-white border-gray-200 border-2 border-yellow-400">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">OT 현황</h3>
                  <Badge className={`text-xs ${totals.closingRate >= 50 ? 'bg-green-500 text-white' : totals.closingRate >= 30 ? 'bg-yellow-500 text-white' : 'bg-gray-400 text-white'}`}>
                    클로징 {totals.closingRate}%
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <MiniStat label="배정" value={totals.totalMembers} color="text-gray-900" />
                  <MiniStat label="진행" value={totals.activeMembers} color="text-blue-600" />
                  <MiniStat label="완료" value={totals.completedMembers} color="text-green-600" />
                  <MiniStat label="거부" value={totals.rejectedMembers} color="text-red-500" />
                  <MiniStat label="OT수업" value={totals.otSessionsThisPeriod} color="text-blue-700" />
                  <MiniStat label="PT전환" value={totals.ptConversions} color="text-purple-700" />
                  <MiniStat label="인바디" value={totals.inbodyCount} color="text-purple-600" />
                  <MiniStat label="OT이외 인정" value={totals.registrationCredits} color="text-emerald-700" />
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                  <span className="text-xs text-gray-500">등록금액</span>
                  <p className="text-sm font-bold text-green-700">{totals.registrationAmount.toLocaleString()}원</p>
                </div>
              </CardContent>
            </Card>
            {trainers.map((t) => {
              const rank = rankMap.get(t.id)
              return (
                <Card key={t.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {rank && rank <= 3 && <span className="text-lg">{medals[rank]}</span>}
                        <h3 className="font-bold text-gray-900">{t.name}</h3>
                      </div>
                      <Badge className={`text-xs ${t.closingRate >= 50 ? 'bg-green-500 text-white' : t.closingRate >= 30 ? 'bg-yellow-500 text-white' : 'bg-gray-400 text-white'}`}>
                        클로징 {t.closingRate}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="배정" value={t.totalMembers} color="text-gray-900" />
                      <MiniStat label="진행" value={t.activeMembers} color="text-blue-600" />
                      <MiniStat label="완료" value={t.completedMembers} color="text-green-600" />
                      <MiniStat label="거부" value={t.rejectedMembers} color="text-red-500" />
                      <MiniStat label="OT수업" value={t.otSessionsThisPeriod} color="text-blue-700" />
                      <MiniStat label="PT전환" value={t.ptConversions} color="text-purple-700" />
                      <MiniStat label="인바디" value={t.inbodyCount} color="text-purple-600" />
                      <MiniStat label="OT이외 인정" value={t.registrationCredits} color="text-emerald-700" />
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                      <span className="text-xs text-gray-500">등록금액</span>
                      <p className="text-sm font-bold text-green-700">{t.registrationAmount.toLocaleString()}원</p>
                    </div>
                    {(t.noContact > 0 || t.closingFailed > 0 || t.scheduleUndecided > 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 justify-center flex-wrap">
                        {t.noContact > 0 && <Badge className="bg-gray-100 text-gray-600 text-[10px]">연락두절 {t.noContact}</Badge>}
                        {t.closingFailed > 0 && <Badge className="bg-red-100 text-red-600 text-[10px]">클로징실패 {t.closingFailed}</Badge>}
                        {t.scheduleUndecided > 0 && <Badge className="bg-yellow-100 text-yellow-600 text-[10px]">미확정 {t.scheduleUndecided}</Badge>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

function StatusBox({ label, value, bg, text, sub }: { label: string; value: number | string; bg: string; text: string; sub?: string }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${bg}`}>
      <div>
        <span className={`text-sm font-medium ${text}`}>{label}</span>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-lg font-bold ${text}`}>{value}</span>
    </div>
  )
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub: string }) {
  return (
    <Card className="bg-white/5 border-gray-700">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  )
}
