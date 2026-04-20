'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Calendar, CheckCircle, MessageSquare, ArrowRight } from 'lucide-react'
import type { OtAssignmentWithDetails } from '@/types'

interface Props {
  assignment: OtAssignmentWithDetails
}

interface TimelineEvent {
  date: string
  icon: React.ReactNode
  title: string
  description?: string
  color: string
}

export function MemberTimeline({ assignment }: Props) {
  const events: TimelineEvent[] = []
  const a = assignment

  // 등록일
  events.push({
    date: a.member.registered_at,
    icon: <UserPlus className="h-3.5 w-3.5" />,
    title: 'OT 신청',
    description: `${a.member.ot_category ?? ''} ${a.member.exercise_time ?? ''}`.trim() || undefined,
    color: 'bg-blue-500',
  })

  // 배정일
  if (a.pt_trainer?.name && a.updated_at !== a.created_at) {
    events.push({
      date: a.created_at.split('T')[0],
      icon: <ArrowRight className="h-3.5 w-3.5" />,
      title: `${a.pt_trainer.name} 트레이너 배정`,
      color: 'bg-yellow-500',
    })
  }

  // 세션별 이벤트
  const sortedSessions = [...(a.sessions ?? [])].sort((x, y) => x.session_number - y.session_number)
  for (const s of sortedSessions) {
    if (s.scheduled_at) {
      events.push({
        date: s.scheduled_at.split('T')[0],
        icon: <Calendar className="h-3.5 w-3.5" />,
        title: `${s.session_number}차 OT ${s.completed_at ? '완료' : '예정'}`,
        description: s.scheduled_at ? format(new Date(s.scheduled_at), 'M월 d일 HH:mm', { locale: ko }) : undefined,
        color: s.completed_at ? 'bg-green-500' : 'bg-gray-400',
      })
    }

    if (s.feedback) {
      events.push({
        date: (s.completed_at ?? s.scheduled_at ?? s.created_at).split('T')[0],
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        title: `${s.session_number}차 피드백`,
        description: s.feedback,
        color: 'bg-purple-500',
      })
    }
  }

  // 완료/거부/PT전환
  if (a.status === '완료') {
    events.push({
      date: a.updated_at.split('T')[0],
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      title: a.notes?.includes('PT 전환') ? 'PT 전환 완료' : 'OT 전체 완료',
      color: a.notes?.includes('PT 전환') ? 'bg-purple-600' : 'bg-green-600',
    })
  }

  // 날짜순 정렬
  events.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-gray-900">히스토리</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* 세로 선 (아이콘 중앙 정렬: left = icon-size/2 = 12px) */}
          <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gray-200" />

          <ol className="space-y-5">
            {events.map((event, i) => (
              <li key={i} className="relative flex items-start gap-4">
                {/* 아이콘 원 */}
                <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-4 ring-white ${event.color}`}>
                  {event.icon}
                </div>
                {/* 내용 */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap break-words">{event.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(event.date), 'yyyy.M.d', { locale: ko })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
