'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OtCategoryBadge } from '@/components/ot/ot-category-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Member, OtAssignmentWithDetails, Profile } from '@/types'

export interface MemberWithOt extends Member {
  assignment?: OtAssignmentWithDetails | null
}

interface Props {
  initialMembers: MemberWithOt[]
  trainers?: Pick<Profile, 'id' | 'name'>[]
}

function getProgressLabel(a?: OtAssignmentWithDetails | null): string {
  if (!a) return '-'
  if (a.status === '신청대기') return '신청대기'
  if (a.status === '배정완료') return '배정완료'
  if (a.status === '거부') return '거부'
  if (a.status === '추후결정') return '추후결정'
  if (a.notes?.includes('PT 전환')) return 'PT전환'
  const done = a.sessions?.filter((s) => s.completed_at).length ?? 0
  if (done >= 3 || a.status === '완료') return '3차완료'
  if (done === 2) return '2차완료'
  if (done === 1) return '1차완료'
  if (a.status === '진행중') return '진행중'
  return a.status
}

function getProgressColor(label: string): string {
  switch (label) {
    case '신청대기': return 'bg-yellow-400 text-black'
    case '배정완료': return 'bg-sky-100 text-sky-700'
    case '진행중': return 'bg-blue-100 text-blue-700'
    case '1차완료': return 'bg-blue-100 text-blue-700'
    case '2차완료': return 'bg-indigo-100 text-indigo-700'
    case '3차완료': return 'bg-green-100 text-green-700'
    case 'PT전환': return 'bg-purple-100 text-purple-700'
    case '추후결정': return 'bg-orange-100 text-orange-700'
    case '거부': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-500'
  }
}

export function MemberList({ initialMembers, trainers = [] }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const pushFilters = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="이름 또는 연락처 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pushFilters({ search: e.target.value })
            }}
            className="pl-9 bg-white text-gray-900 border-gray-300 h-9"
          />
        </div>

        {/* 트레이너별 */}
        <Select
          defaultValue={searchParams.get('trainer') ?? 'all'}
          onValueChange={(v) => pushFilters({ trainer: v })}
        >
          <SelectTrigger className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm">
            <SelectValue placeholder="트레이너" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 트레이너</SelectItem>
            {trainers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
            <SelectItem value="unassigned">미배정</SelectItem>
          </SelectContent>
        </Select>

        {/* 상태별 */}
        <Select
          defaultValue={searchParams.get('status') ?? 'all'}
          onValueChange={(v) => pushFilters({ status: v })}
        >
          <SelectTrigger className="w-32 h-9 bg-white text-gray-700 border-gray-300 text-sm">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="신청대기">배정대기</SelectItem>
            <SelectItem value="배정완료">배정완료</SelectItem>
            <SelectItem value="추후결정">보류</SelectItem>
            <SelectItem value="거부">거부</SelectItem>
          </SelectContent>
        </Select>

        {/* 기간별 */}
        <Input
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(e) => pushFilters({ from: e.target.value })}
          className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm"
        />
        <span className="text-gray-400 text-sm">~</span>
        <Input
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(e) => pushFilters({ to: e.target.value })}
          className="w-36 h-9 bg-white text-gray-700 border-gray-300 text-sm"
        />
      </div>

      {/* 테이블 */}
      <div className="rounded-md border border-gray-200 bg-white overflow-x-auto">
        <Table className="min-w-[1300px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-center text-gray-700">등록일</TableHead>
              <TableHead className="text-center text-gray-700">이름</TableHead>
              <TableHead className="text-center text-gray-700">연락처</TableHead>
              <TableHead className="text-center text-gray-700">성별</TableHead>
              <TableHead className="text-center text-gray-700">종목</TableHead>
              <TableHead className="text-center text-gray-700">운동기간</TableHead>
              <TableHead className="text-center text-gray-700">운동시간</TableHead>
              <TableHead className="text-center text-gray-700">PT담당</TableHead>
              <TableHead className="text-center text-gray-700">진행상태</TableHead>
              <TableHead className="text-center text-gray-700">운동목적</TableHead>
              <TableHead className="text-center text-gray-700">특이사항</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-gray-400">
                  등록된 회원이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              initialMembers.map((m) => {
                const purpose = m.detail_info
                  ? m.detail_info.length > 25
                    ? m.detail_info.substring(0, 25) + '...'
                    : m.detail_info
                  : '-'
                const progressLabel = getProgressLabel(m.assignment)
                const progressColor = getProgressColor(progressLabel)

                return (
                  <TableRow key={m.id} className="hover:bg-gray-50">
                    <TableCell className="text-center text-sm text-gray-900">{m.registered_at}</TableCell>
                    <TableCell className="text-center font-medium text-gray-900">{m.name}</TableCell>
                    <TableCell className="text-center tabular-nums text-sm text-gray-900">
                      {m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{m.gender ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      <OtCategoryBadge category={m.ot_category} />
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-900">
                      {m.duration_months ? `${m.duration_months}개월` : '-'}
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-900">{m.exercise_time ?? '-'}</TableCell>
                    <TableCell className="text-center text-sm text-gray-900">
                      {m.assignment?.pt_trainer?.name ?? '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${progressColor}`}>
                        {progressLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-700 max-w-[150px] truncate" title={m.detail_info ?? ''}>
                      {purpose}
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-700 max-w-[120px] truncate" title={m.notes ?? ''}>
                      {m.notes ?? '-'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
