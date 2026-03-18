'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { OtCategoryBadge } from './ot-category-badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateOtAssignment } from '@/actions/ot'
import type { OtAssignmentWithDetails } from '@/types'

function getProgressLabel(a: OtAssignmentWithDetails): string {
  if (a.status === '거부') return '거부'
  if (a.status === '추후결정') return '추후결정'
  if (a.notes?.includes('PT 전환')) return 'PT전환'
  const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
  if (done >= 3 || a.status === '완료') return '3차완료'
  if (done === 2) return '2차완료'
  if (done === 1) return '1차완료'
  return '미진행'
}

function getProgressColor(label: string): string {
  switch (label) {
    case '1차완료': return 'bg-blue-100 text-blue-700'
    case '2차완료': return 'bg-indigo-100 text-indigo-700'
    case '3차완료': return 'bg-green-100 text-green-700'
    case 'PT전환': return 'bg-purple-100 text-purple-700'
    case '추후결정': return 'bg-orange-100 text-orange-700'
    case '거부': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function formatMoney(v: number): string {
  if (!v) return '-'
  return v >= 10000 ? `${(v / 10000).toLocaleString()}만` : v.toLocaleString()
}

interface Props {
  assignments: OtAssignmentWithDetails[]
}

export function TrainerOtTable({ assignments }: Props) {
  const router = useRouter()

  const handleStatusChange = async (id: string, value: string) => {
    if (value === 'PT전환') await updateOtAssignment(id, { status: '완료', notes: 'PT 전환 희망' })
    else if (value === '추후결정') await updateOtAssignment(id, { status: '추후결정' })
    else if (value === '거부') await updateOtAssignment(id, { status: '거부' })
    else if (value === '3차완료') await updateOtAssignment(id, { status: '완료' })
    else await updateOtAssignment(id, { status: '진행중' })
    router.refresh()
  }

  if (assignments.length === 0) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground">표시할 회원이 없습니다</div>
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
      <Table className="min-w-[1400px]">
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-center text-gray-700">이름</TableHead>
            <TableHead className="text-center text-gray-700">등록구분</TableHead>
            <TableHead className="text-center text-gray-700">등록경로</TableHead>
            <TableHead className="text-center text-gray-700">1차</TableHead>
            <TableHead className="text-center text-gray-700">2차</TableHead>
            <TableHead className="text-center text-gray-700">3차</TableHead>
            <TableHead className="text-center text-gray-700">회원권시작일</TableHead>
            <TableHead className="text-center text-gray-700">종목</TableHead>
            <TableHead className="text-center text-gray-700">특이사항</TableHead>
            <TableHead className="text-center text-gray-700">예상매출</TableHead>
            <TableHead className="text-center text-gray-700">등록매출</TableHead>
            <TableHead className="text-center text-gray-700">마지막OT</TableHead>
            <TableHead className="text-center text-gray-700">진행상태</TableHead>
            <TableHead className="text-center text-gray-700">상태변경</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => {
            const progressLabel = getProgressLabel(a)
            const progressColor = getProgressColor(progressLabel)
            const s1 = a.sessions?.find((s) => s.session_number === 1)
            const s2 = a.sessions?.find((s) => s.session_number === 2)
            const s3 = a.sessions?.find((s) => s.session_number === 3)
            const sd = (s: typeof s1) => {
              if (!s?.scheduled_at) return '-'
              const d = format(new Date(s.scheduled_at), 'M/d')
              return s.completed_at ? `${d} ✓` : d
            }

            return (
              <TableRow key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/ot/${a.id}`)}>
                <TableCell className="text-center font-medium text-gray-900">
                  {a.member.name}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-900">{a.registration_type ?? '-'}</TableCell>
                <TableCell className="text-center text-sm text-gray-900">{a.registration_route ?? '-'}</TableCell>
                <TableCell className={`text-center text-sm ${s1?.completed_at ? 'text-green-600 font-medium' : 'text-gray-900'}`}>{sd(s1)}</TableCell>
                <TableCell className={`text-center text-sm ${s2?.completed_at ? 'text-green-600 font-medium' : 'text-gray-900'}`}>{sd(s2)}</TableCell>
                <TableCell className={`text-center text-sm ${s3?.completed_at ? 'text-green-600 font-medium' : 'text-gray-900'}`}>{sd(s3)}</TableCell>
                <TableCell className="text-center text-sm text-gray-900">{a.membership_start_date ? format(new Date(a.membership_start_date), 'yy.M.d') : '-'}</TableCell>
                <TableCell className="text-center"><OtCategoryBadge category={a.member.ot_category ?? a.ot_category} /></TableCell>
                <TableCell className="text-center text-sm text-gray-700 max-w-[120px] truncate" title={a.member.notes ?? ''}>{a.member.notes ?? '-'}</TableCell>
                <TableCell className="text-center text-sm text-gray-900">{formatMoney(a.expected_sales)}</TableCell>
                <TableCell className="text-center text-sm font-medium text-green-700">{formatMoney(a.actual_sales)}</TableCell>
                <TableCell className="text-center text-sm">
                  {(() => {
                    const completedSessions = a.sessions?.filter((s) => s.completed_at).sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))
                    const lastSession = completedSessions?.[0]
                    if (!lastSession?.completed_at) return <span className="text-gray-400">-</span>
                    const lastDate = new Date(lastSession.completed_at)
                    const today = new Date()
                    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
                    const dateStr = format(lastDate, 'M/d')
                    const dDay = diffDays === 0 ? 'D-Day' : `D+${diffDays}`
                    const color = diffDays <= 3 ? 'text-green-600' : diffDays <= 7 ? 'text-yellow-600' : 'text-red-600'
                    return (
                      <div>
                        <p className="text-gray-900">{dateStr}</p>
                        <p className={`text-xs font-bold ${color}`}>{dDay}</p>
                      </div>
                    )
                  })()}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${progressColor}`}>{progressLabel}</span>
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Select onValueChange={(v) => handleStatusChange(a.id, v)}>
                    <SelectTrigger className="h-7 w-24 text-xs bg-white text-gray-700 border-gray-300 mx-auto">
                      <SelectValue placeholder="변경" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1차완료">1차완료</SelectItem>
                      <SelectItem value="2차완료">2차완료</SelectItem>
                      <SelectItem value="3차완료">3차완료</SelectItem>
                      <SelectItem value="PT전환">PT전환</SelectItem>
                      <SelectItem value="추후결정">추후결정</SelectItem>
                      <SelectItem value="거부">거부</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
