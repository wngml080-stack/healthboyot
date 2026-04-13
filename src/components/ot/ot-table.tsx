'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OtCategoryBadge } from './ot-category-badge'
import { Check } from 'lucide-react'
import type { OtAssignmentWithDetails } from '@/types'

interface OtTableProps {
  assignments: OtAssignmentWithDetails[]
  onRowAction?: (assignment: OtAssignmentWithDetails) => void
  onToggleComplete?: (memberId: string, current: boolean) => void
}

export function OtTable({ assignments, onRowAction, onToggleComplete }: OtTableProps) {
  if (assignments.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        표시할 OT 배정이 없습니다
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[1000px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">날짜</TableHead>
            <TableHead className="w-20">회원명</TableHead>
            <TableHead className="w-14">성별</TableHead>
            <TableHead className="w-32">연락처</TableHead>
            <TableHead className="w-28">운동시간</TableHead>
            <TableHead className="w-20">OT종목</TableHead>
            <TableHead>상세정보</TableHead>
            <TableHead className="w-24">시작일</TableHead>
            <TableHead className="w-16 text-center">여부</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a) => (
            <TableRow
              key={a.id}
              className="cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => onRowAction?.(a)}
            >
              <TableCell className="text-sm">
                <Link href={`/ot/${a.id}`} className="block">
                  {format(new Date(a.member.registered_at), 'yyyy.M.d')}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/ot/${a.id}`} className="font-medium text-sm">
                  {a.member.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {a.member.gender ?? '-'}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {a.member.phone ? a.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : '-'}
              </TableCell>
              <TableCell className="text-sm">
                {a.member.exercise_time ?? '-'}
              </TableCell>
              <TableCell>
                <OtCategoryBadge category={a.member.ot_category ?? a.ot_category} />
              </TableCell>
              <TableCell className="text-xs max-w-[300px]">
                <p className="truncate" title={a.member.detail_info ?? ''}>
                  {a.member.detail_info ?? '-'}
                </p>
              </TableCell>
              <TableCell className="text-sm">
                {a.member.start_date
                  ? format(new Date(a.member.start_date), 'yy.MM.dd')
                  : '-'}
              </TableCell>
              <TableCell className="text-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleComplete?.(a.member.id, a.member.is_completed)
                  }}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                    a.member.is_completed
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {a.member.is_completed && <Check className="h-3 w-3" />}
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
