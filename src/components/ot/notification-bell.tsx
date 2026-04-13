'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { OtAssignmentWithDetails, OtProgram } from '@/types'

interface Notification {
  id: string
  type: 'warning' | 'info' | 'schedule' | 'feedback'
  title: string
  message: string
  color: string
  href?: string
}

interface Props {
  assignments: OtAssignmentWithDetails[]
  programs?: (OtProgram & { member_name?: string })[]
}

export function NotificationBell({ assignments, programs = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const notifications: Notification[] = []
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 1. D+3일 이상 미진행 경고
  for (const a of assignments) {
    if (['거부', '완료', '추후결정'].includes(a.status)) continue
    const completedSessions = a.sessions?.filter((s) => s.completed_at) ?? []
    const lastDate = completedSessions.length > 0
      ? new Date(completedSessions.sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))[0].completed_at!)
      : new Date(a.created_at)

    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays >= 7) {
      notifications.push({
        id: `warn-${a.id}`,
        type: 'warning',
        title: `${a.member.name} 회원 D+${diffDays}일`,
        message: '7일 이상 OT 미진행 — 즉시 연락 필요',
        color: 'bg-red-500',
      })
    } else if (diffDays >= 3) {
      notifications.push({
        id: `warn-${a.id}`,
        type: 'warning',
        title: `${a.member.name} 회원 D+${diffDays}일`,
        message: '3일 이상 OT 미진행 — 스케줄 확인 필요',
        color: 'bg-orange-500',
      })
    }
  }

  // 2. 신규 배정 알림
  const recentAssigned = assignments.filter((a) => {
    const created = new Date(a.created_at)
    const diff = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= 1 && a.status === '진행중'
  })
  for (const a of recentAssigned) {
    notifications.push({
      id: `new-${a.id}`,
      type: 'info',
      title: `신규 배정: ${a.member.name}`,
      message: `${a.member.ot_category ?? 'OT'} 신규 회원이 배정되었습니다`,
      color: 'bg-blue-500',
    })
  }

  // 3. 오늘 스케줄 알림
  const todaySessions = assignments.flatMap((a) =>
    (a.sessions ?? [])
      .filter((s) => s.scheduled_at?.startsWith(todayStr) && !s.completed_at)
      .map((s) => ({ ...s, memberName: a.member.name }))
  )
  for (const s of todaySessions) {
    const time = s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
    notifications.push({
      id: `sched-${s.id}`,
      type: 'schedule',
      title: `오늘 ${time} — ${s.memberName}`,
      message: `${s.session_number}차 OT 예정`,
      color: 'bg-yellow-500',
    })
  }

  // 4. OT 승인/반려 피드백 알림
  for (const prog of programs) {
    if (prog.approval_status === '승인') {
      const feedbackCount = prog.sessions?.filter((s) => s.tip).length ?? 0
      notifications.push({
        id: `approve-${prog.id}`,
        type: 'feedback',
        title: `${prog.member_name ?? '회원'} OT 승인완료`,
        message: feedbackCount > 0 ? `피드백 ${feedbackCount}건이 있습니다` : '승인되었습니다',
        color: 'bg-green-500',
        href: `/ot/${prog.ot_assignment_id}`,
      })
    } else if (prog.approval_status === '반려') {
      notifications.push({
        id: `reject-${prog.id}`,
        type: 'feedback',
        title: `${prog.member_name ?? '회원'} OT 반려`,
        message: prog.rejection_reason ?? '반려되었습니다',
        color: 'bg-red-500',
        href: `/ot/${prog.ot_assignment_id}`,
      })
    }
  }

  const count = notifications.length

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-gray-400 hover:text-white hover:bg-white/10 h-8 px-2"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>알림 ({count})</DialogTitle>
            <DialogDescription>OT 관련 알림입니다</DialogDescription>
          </DialogHeader>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">새로운 알림이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 rounded-lg border border-gray-200 p-3 ${n.href ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
                  onClick={() => {
                    if (n.href) {
                      setOpen(false)
                      router.push(n.href)
                    }
                  }}
                >
                  <div className={`w-2 rounded-full shrink-0 ${n.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500">{n.message}</p>
                  </div>
                  {n.href && <span className="text-xs text-blue-500 self-center">바로가기 →</span>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
