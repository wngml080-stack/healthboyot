'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
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
import { FileText, Camera, Plus, Trash2, Target, CheckCircle2, Circle } from 'lucide-react'
import { updateOtAssignment } from '@/actions/ot'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  assignments: OtAssignmentWithDetails[]
  trainerName: string
}

function fmtMan(v: number): string { if (!v) return '-'; return v >= 10000 ? `${(v / 10000).toLocaleString()}만` : `${v.toLocaleString()}` }

interface GoalItem {
  id: string
  text: string
  done: boolean
}

interface WeeklyGoals {
  weekly: GoalItem[]
  daily: Record<string, GoalItem[]> // key: 'mon','tue',...
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS_KR = ['월', '화', '수', '목', '금', '토', '일'] as const

function useGoals(storageKey: string) {
  const [goals, setGoals] = useState<WeeklyGoals>({ weekly: [], daily: {} })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setGoals(JSON.parse(saved))
    } catch {}
  }, [storageKey])

  const save = useCallback((next: WeeklyGoals) => {
    setGoals(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }, [storageKey])

  const addWeekly = (text: string) => {
    const next = { ...goals, weekly: [...goals.weekly, { id: crypto.randomUUID(), text, done: false }] }
    save(next)
  }
  const addDaily = (dayKey: string, text: string) => {
    const dayItems = goals.daily[dayKey] ?? []
    const next = { ...goals, daily: { ...goals.daily, [dayKey]: [...dayItems, { id: crypto.randomUUID(), text, done: false }] } }
    save(next)
  }
  const toggleWeekly = (id: string) => {
    const next = { ...goals, weekly: goals.weekly.map((g) => g.id === id ? { ...g, done: !g.done } : g) }
    save(next)
  }
  const toggleDaily = (dayKey: string, id: string) => {
    const dayItems = (goals.daily[dayKey] ?? []).map((g) => g.id === id ? { ...g, done: !g.done } : g)
    const next = { ...goals, daily: { ...goals.daily, [dayKey]: dayItems } }
    save(next)
  }
  const removeWeekly = (id: string) => {
    const next = { ...goals, weekly: goals.weekly.filter((g) => g.id !== id) }
    save(next)
  }
  const removeDaily = (dayKey: string, id: string) => {
    const dayItems = (goals.daily[dayKey] ?? []).filter((g) => g.id !== id)
    const next = { ...goals, daily: { ...goals.daily, [dayKey]: dayItems } }
    save(next)
  }

  return { goals, addWeekly, addDaily, toggleWeekly, toggleDaily, removeWeekly, removeDaily }
}

export function WeeklyReport({ assignments, trainerName }: Props) {
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [now] = useState(() => new Date())
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const weekNum = Math.ceil(now.getDate() / 7)
  const storageKey = `goals_${trainerName}_${format(weekStart, 'yyyyMMdd')}`
  const { goals, addWeekly, addDaily, toggleWeekly, toggleDaily, removeWeekly, removeDaily } = useGoals(storageKey)
  const [newWeeklyGoal, setNewWeeklyGoal] = useState('')
  const [newDailyGoals, setNewDailyGoals] = useState<Record<string, string>>({})

  // 결과 입력 다이얼로그
  const [resultTarget, setResultTarget] = useState<OtAssignmentWithDetails | null>(null)
  const [resultText, setResultText] = useState('')
  const [resultLoading, setResultLoading] = useState(false)

  // 이번 주 세일즈 결과 (완료된 세션이 있는 것)
  const weekResults = assignments.filter((a) => {
    return a.sessions?.some((s) => {
      if (!s.completed_at) return false
      const d = new Date(s.completed_at)
      return d >= weekStart && d <= weekEnd
    })
  })

  // 이번 주 / 금주 대상자 (예정된 세션 + 매출대상자 중 미완료)
  const weekTargets = assignments.filter((a) => {
    const hasWeekSession = a.sessions?.some((s) => {
      if (!s.scheduled_at || s.completed_at) return false
      const d = new Date(s.scheduled_at)
      return d >= weekStart && d <= weekEnd
    })
    const isSalesTarget = a.is_sales_target && a.status !== '완료' && a.status !== '거부'
    return hasWeekSession || isSalesTarget
  })

  // 차후 스케줄 (다음 주 이후)
  const futureTargets = assignments.filter((a) => {
    return a.sessions?.some((s) => {
      if (!s.scheduled_at || s.completed_at) return false
      const d = new Date(s.scheduled_at)
      return d > weekEnd
    })
  })

  // 매출 요약
  const totalSales = assignments.filter((a) => a.status === '완료').reduce((s, a) => s + (a.actual_sales ?? 0), 0)
  const weekExpected = assignments.reduce((s, a) => s + (a.expected_amount ?? 0), 0)
  const otCount = assignments.filter((a) => a.sessions?.some((s) => s.completed_at)).length
  const salesTargetCount = assignments.filter((a) => a.is_sales_target).length

  const getSessionInfo = (a: OtAssignmentWithDetails, type: 'completed' | 'scheduled') => {
    const session = type === 'completed'
      ? a.sessions?.filter((s) => s.completed_at).sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))[0]
      : a.sessions?.filter((s) => s.scheduled_at && !s.completed_at).sort((x, y) => (x.scheduled_at ?? '').localeCompare(y.scheduled_at ?? ''))[0]
    return session
  }

  const handleResultSave = async () => {
    if (!resultTarget) return
    setResultLoading(true)
    await updateOtAssignment(resultTarget.id, {
      sales_note: resultText || null,
    })
    setResultTarget(null)
    setResultText('')
    setResultLoading(false)
    router.refresh()
  }

  const handleCapture = async () => {
    if (!reportRef.current) return
    setCapturing(true)
    try {
      const el = reportRef.current
      const { toPng } = await import('html-to-image')
      const origMinW = el.style.minWidth; const origW = el.style.width; const origMaxW = el.style.maxWidth
      el.style.minWidth = 'max-content'; el.style.width = 'max-content'; el.style.maxWidth = 'none'
      void el.offsetHeight
      const captureW = Math.max(el.scrollWidth, el.offsetWidth) + 48
      const captureH = Math.max(el.scrollHeight, el.offsetHeight) + 48
      const dataUrl = await toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: captureW,
        height: captureH,
        style: { padding: '20px', overflow: 'visible' },
      })
      el.style.minWidth = origMinW; el.style.width = origW; el.style.maxWidth = origMaxW

      // 모바일이면 공유, PC면 다운로드
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], `주간보고서_${trainerName}_${format(now, 'yyyyMMdd')}.png`, { type: 'image/png' })
        await navigator.share({ files: [file], title: `주간보고서 - ${trainerName}` })
      } else {
        const link = document.createElement('a')
        link.download = `주간보고서_${trainerName}_${format(now, 'yyyyMMdd')}.png`
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error('캡처 실패:', err)
    }
    setCapturing(false)
  }

  return (
    <>
      <div>
        {/* 이미지 저장 버튼 */}
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCapture}
            disabled={capturing}
            className="bg-white text-gray-700 border-gray-300"
          >
            <Camera className="h-4 w-4 mr-1" />
            {capturing ? '저장 중...' : '이미지 저장'}
          </Button>
        </div>

      <div ref={reportRef} className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              주간 업무 REPORT
            </CardTitle>
            <div className="text-xs text-gray-500">
              {weekNum}주차 · {format(weekStart, 'M/d', { locale: ko })}~{format(weekEnd, 'M/d', { locale: ko })} · 담당자: {trainerName}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* 매출 요약 바 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-gray-50 p-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-500">현재 매출</p>
              <p className="text-sm font-bold text-gray-900">{fmtMan(totalSales)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">예상 매출</p>
              <p className="text-sm font-bold text-pink-600">{fmtMan(weekExpected)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">OT 갯수</p>
              <p className="text-sm font-bold text-blue-600">{otCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">매출대상</p>
              <p className="text-sm font-bold text-green-600">{salesTargetCount}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 좌측: 세일즈 결과 */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">결과 (성공/실패사례/클로징과정)</p>
              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">날짜</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">시간</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">이름</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">차수</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">금액</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">결과</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekResults.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-gray-400 text-xs py-4">이번 주 결과 없음</TableCell></TableRow>
                    ) : weekResults.map((a) => {
                      const s = getSessionInfo(a, 'completed')
                      return (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-yellow-50" onClick={() => { setResultTarget(a); setResultText(a.sales_note ?? '') }}>
                          <TableCell className="text-center text-xs px-2">{s?.completed_at ? format(new Date(s.completed_at), 'M/d') : '-'}</TableCell>
                          <TableCell className="text-center text-xs px-2">{s?.completed_at ? format(new Date(s.completed_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell className="text-center text-xs font-medium px-2">{a.member.name}</TableCell>
                          <TableCell className="text-center text-xs px-2">OT{s?.session_number ?? '-'}</TableCell>
                          <TableCell className="text-center text-xs px-2">{fmtMan(a.expected_amount ?? 0)}</TableCell>
                          <TableCell className="text-center text-xs px-2 max-w-[100px] truncate" title={a.sales_note ?? ''}>
                            {a.sales_note ? (
                              <span className="text-blue-600">{a.sales_note.length > 10 ? a.sales_note.slice(0, 10) + '...' : a.sales_note}</span>
                            ) : (
                              <span className="text-gray-300">클릭하여 입력</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 우측: 금주 대상자 */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">금주 대상자</p>
              <div className="rounded-md border border-gray-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">날짜</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">시간</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">이름</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">차수</TableHead>
                      <TableHead className="text-center text-[10px] text-gray-700 px-2">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekTargets.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-gray-400 text-xs py-4">이번 주 예정 없음</TableCell></TableRow>
                    ) : weekTargets.map((a) => {
                      const s = getSessionInfo(a, 'scheduled')
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-center text-xs px-2">{s?.scheduled_at ? format(new Date(s.scheduled_at), 'M/d') : '-'}</TableCell>
                          <TableCell className="text-center text-xs px-2">{s?.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell className="text-center text-xs font-medium px-2">{a.member.name}</TableCell>
                          <TableCell className="text-center text-xs px-2">OT{s?.session_number ?? '-'}</TableCell>
                          <TableCell className="text-center text-xs px-2">{fmtMan(a.expected_amount ?? 0)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 차후 스케줄 */}
              {futureTargets.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-gray-700 mb-2">차후 스케줄</p>
                  <div className="rounded-md border border-gray-200 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-green-50">
                          <TableHead className="text-center text-[10px] text-gray-700 px-2">날짜</TableHead>
                          <TableHead className="text-center text-[10px] text-gray-700 px-2">시간</TableHead>
                          <TableHead className="text-center text-[10px] text-gray-700 px-2">이름</TableHead>
                          <TableHead className="text-center text-[10px] text-gray-700 px-2">차수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {futureTargets.map((a) => {
                          const s = getSessionInfo(a, 'scheduled')
                          return (
                            <TableRow key={a.id}>
                              <TableCell className="text-center text-xs px-2">{s?.scheduled_at ? format(new Date(s.scheduled_at), 'M/d (EEE)', { locale: ko }) : '-'}</TableCell>
                              <TableCell className="text-center text-xs px-2">{s?.scheduled_at ? format(new Date(s.scheduled_at), 'HH:mm') : '-'}</TableCell>
                              <TableCell className="text-center text-xs font-medium px-2">{a.member.name}</TableCell>
                              <TableCell className="text-center text-xs px-2">OT{s?.session_number ?? '-'}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 주간/일일 목표 체크리스트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-yellow-500" />
            이번 주 매출 목표
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 주간 목표 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">주간 목표</p>
            <div className="space-y-1.5">
              {goals.weekly.map((g) => (
                <div key={g.id} className="flex items-center gap-2 group">
                  <button onClick={() => toggleWeekly(g.id)} className="shrink-0">
                    {g.done
                      ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                      : <Circle className="h-5 w-5 text-gray-300" />
                    }
                  </button>
                  <span className={`text-sm flex-1 ${g.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{g.text}</span>
                  <button onClick={() => removeWeekly(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newWeeklyGoal}
                onChange={(e) => setNewWeeklyGoal(e.target.value)}
                placeholder="주간 목표 입력..."
                className="text-sm bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWeeklyGoal.trim()) {
                    addWeekly(newWeeklyGoal.trim())
                    setNewWeeklyGoal('')
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
                disabled={!newWeeklyGoal.trim()}
                onClick={() => { addWeekly(newWeeklyGoal.trim()); setNewWeeklyGoal('') }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {goals.weekly.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((goals.weekly.filter((g) => g.done).length / goals.weekly.length) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {goals.weekly.filter((g) => g.done).length}/{goals.weekly.length}
                </span>
              </div>
            )}
          </div>

          {/* 일일 목표 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">일일 목표</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {DAY_KEYS.map((dayKey, i) => {
                const dayDate = addDays(weekStart, i)
                const isToday = format(dayDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
                const dayItems = goals.daily[dayKey] ?? []
                const doneCount = dayItems.filter((g) => g.done).length

                return (
                  <div key={dayKey} className={`rounded-lg border p-3 ${isToday ? 'border-yellow-400 bg-yellow-50/50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${isToday ? 'text-yellow-700' : 'text-gray-600'}`}>
                        {DAY_LABELS_KR[i]} ({format(dayDate, 'M/d')})
                        {isToday && <span className="ml-1 text-yellow-500">TODAY</span>}
                      </span>
                      {dayItems.length > 0 && (
                        <span className="text-[10px] text-gray-400">{doneCount}/{dayItems.length}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayItems.map((g) => (
                        <div key={g.id} className="flex items-center gap-1.5 group">
                          <button onClick={() => toggleDaily(dayKey, g.id)} className="shrink-0">
                            {g.done
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <Circle className="h-4 w-4 text-gray-300" />
                            }
                          </button>
                          <span className={`text-xs flex-1 ${g.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{g.text}</span>
                          <button onClick={() => removeDaily(dayKey, g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      <Input
                        value={newDailyGoals[dayKey] ?? ''}
                        onChange={(e) => setNewDailyGoals({ ...newDailyGoals, [dayKey]: e.target.value })}
                        placeholder="목표 추가..."
                        className="text-xs h-7 bg-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (newDailyGoals[dayKey] ?? '').trim()) {
                            addDaily(dayKey, newDailyGoals[dayKey].trim())
                            setNewDailyGoals({ ...newDailyGoals, [dayKey]: '' })
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-7 w-7 p-0 bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
                        disabled={!(newDailyGoals[dayKey] ?? '').trim()}
                        onClick={() => { addDaily(dayKey, newDailyGoals[dayKey].trim()); setNewDailyGoals({ ...newDailyGoals, [dayKey]: '' }) }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
      </div>

      {/* 결과 입력 다이얼로그 */}
      <Dialog open={!!resultTarget} onOpenChange={() => setResultTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{resultTarget?.member.name} — 세일즈 결과</DialogTitle>
            <DialogDescription>성공/실패 사례, 클로징 과정을 기록하세요</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>결과 (성공사례 / 실패사례 / 클로징과정)</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="예: PT 생각이 있었는데 필라테스를 끊어버려서 돈이 아까워서 고민이 된다고 함"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleResultSave}
              disabled={resultLoading}
            >
              {resultLoading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
