import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const mode = url.searchParams.get('mode') ?? 'diagnose'
  const trainerId = 'd892d9a2-aeab-426e-8768-761a357303ab'

  const results: string[] = []

  const { data: schedules } = await supabase
    .from('trainer_schedules')
    .select('id, trainer_id, scheduled_date, start_time, duration, member_name, ot_session_id, schedule_type')
    .eq('trainer_id', trainerId)
    .eq('schedule_type', 'OT')
    .order('scheduled_date')
    .order('start_time')

  results.push('스케줄 수: ' + (schedules?.length ?? 0))

  const toDelete: { id: string; info: string }[] = []

  for (const s of schedules ?? []) {
    let info = s.scheduled_date + ' ' + s.start_time + ' ' + s.member_name + ' (sid:' + (s.ot_session_id ?? 'NULL') + ')'

    if (s.ot_session_id) {
      const { data: session } = await supabase
        .from('ot_sessions')
        .select('id, session_number, scheduled_at, completed_at')
        .eq('id', s.ot_session_id)
        .single()

      if (session) {
        const isCompleted = !!session.completed_at
        info += ' → ' + session.session_number + '차 completed=' + isCompleted
        if (isCompleted) {
          toDelete.push({ id: s.id, info: '완료된세션: ' + info })
        }
      } else {
        toDelete.push({ id: s.id, info: '고아: ' + info })
      }
    }

    results.push(info)
  }

  // 중복 체크
  for (const s of schedules ?? []) {
    const dups = (schedules ?? []).filter(o =>
      o.id !== s.id && o.member_name === s.member_name && o.scheduled_date === s.scheduled_date && o.start_time === s.start_time
    )
    if (dups.length > 0 && !s.ot_session_id && !toDelete.find(d => d.id === s.id)) {
      toDelete.push({ id: s.id, info: '중복: ' + s.scheduled_date + ' ' + s.member_name })
    }
  }

  const unique = Array.from(new Map(toDelete.map(d => [d.id, d])).values())
  results.push('')
  results.push('삭제대상: ' + unique.length + '건')
  unique.forEach(d => results.push('  X ' + d.info))

  if (mode === 'fix') {
    let n = 0
    for (const d of unique) {
      const { error } = await supabase.from('trainer_schedules').delete().eq('id', d.id)
      if (!error) n++
    }
    results.push('삭제완료: ' + n + '건')
  } else {
    results.push('삭제하려면 ?mode=fix')
  }

  return NextResponse.json({ results })
}
