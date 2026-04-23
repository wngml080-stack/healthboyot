'use server'

/**
 * OT 세션 복구 (one-time recovery)
 *
 * 배경: weekly-calendar.tsx의 nextN 계산 버그(완료된 세션만 카운트)로 인해
 * 사용자가 1차/2차/3차를 잡으려고 해도 모두 session_number=1로 덮어써졌음.
 * → ot_sessions에는 마지막 1건만 존재, 이전 시도들은 손실.
 *
 * 다행히 upsertOtSession이 매번 change_logs에 'N차 OT 일정 등록' 액션과
 * 'M/d HH:mm' 시간이 적힌 note를 남겨놨기 때문에, 이를 파싱해서 복원 가능.
 *
 * 복구 전략:
 * 1. 각 ot_assignment마다 change_logs에서 'OT 일정 등록' 액션 가져오기
 * 2. note에서 M/d HH:mm 파싱 (year는 log의 created_at 기준)
 * 3. 동일 시간은 dedup, 가장 빠른 log_created_at 기준으로 정렬
 * 4. 완료된 세션이 있으면 SKIP (사용자 진행분 보호)
 * 5. 시간이 1개 이하면 SKIP (복구 불필요)
 * 6. 최대 3개까지 → session_number 1, 2, 3 순서로 ot_sessions + trainer_schedules 동기화
 *
 * 모드:
 * - dryRun=true: 변경 미리보기만, DB 변경 없음
 * - dryRun=false: 실제 적용
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from './auth'

interface RecoveryItem {
  assignment_id: string
  member_name: string
  pt_trainer_id: string | null
  ppt_trainer_id: string | null
  current_sessions: { session_number: number; scheduled_at: string | null }[]
  recovered_times: string[] // ISO strings, KST 기준
  reason: 'will_recover' | 'skip_completed' | 'skip_single' | 'skip_no_logs'
}

export interface RecoveryResult {
  total_assignments: number
  to_recover: number
  skipped_completed: number
  skipped_single: number
  skipped_no_logs: number
  items: RecoveryItem[]
  applied: boolean
  errors: string[]
}

/**
 * note 문자열에서 "M/d HH:mm" 패턴 파싱
 * 예: "김민재 회원 — 4/11 12:00 / 박트레이너 담당"
 *      → { month: 4, day: 11, hour: 12, minute: 0 }
 */
function parseTimeFromNote(note: string | null): { month: number; day: number; hour: number; minute: number } | null {
  if (!note) return null
  const match = note.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/)
  if (!match) return null
  return {
    month: Number(match[1]),
    day: Number(match[2]),
    hour: Number(match[3]),
    minute: Number(match[4]),
  }
}

/**
 * KST 기준 (year, month, day, hour, minute) → ISO UTC string
 */
function kstToIsoUtc(year: number, month: number, day: number, hour: number, minute: number): string {
  // KST는 UTC+9. KST 시각을 UTC로 변환하려면 -9시간.
  const utcMillis = Date.UTC(year, month - 1, day, hour - 9, minute, 0)
  return new Date(utcMillis).toISOString()
}

export async function recoverOtSessionsFromChangeLogs(dryRun: boolean): Promise<RecoveryResult> {
  // 1. 관리자 권한 확인
  const profile = await getCurrentProfile()
  if (!profile || (profile.role !== 'admin' && profile.role !== '관리자')) {
    return {
      total_assignments: 0,
      to_recover: 0,
      skipped_completed: 0,
      skipped_single: 0,
      skipped_no_logs: 0,
      items: [],
      applied: false,
      errors: ['관리자만 실행할 수 있습니다'],
    }
  }

  const supabase = await createClient()

  // 2. 모든 ot_assignments 가져오기 (member_name 포함)
  const { data: assignments, error: assignErr } = await supabase
    .from('ot_assignments')
    .select(`
      id, pt_trainer_id, ppt_trainer_id,
      member:members!inner(id, name),
      sessions:ot_sessions(id, session_number, scheduled_at, completed_at)
    `)
    .limit(1000)

  if (assignErr || !assignments) {
    return {
      total_assignments: 0,
      to_recover: 0,
      skipped_completed: 0,
      skipped_single: 0,
      skipped_no_logs: 0,
      items: [],
      applied: false,
      errors: [`ot_assignments 조회 실패: ${assignErr?.message ?? 'unknown'}`],
    }
  }

  const result: RecoveryResult = {
    total_assignments: assignments.length,
    to_recover: 0,
    skipped_completed: 0,
    skipped_single: 0,
    skipped_no_logs: 0,
    items: [],
    applied: false,
    errors: [],
  }

  // 3. 완료 세션 없는 assignment만 필터링
  const candidateAssignments = assignments.filter((a) => {
    const sessions = (a.sessions ?? []) as { completed_at: string | null }[]
    const hasCompleted = sessions.some((s) => s.completed_at)
    if (hasCompleted) { result.skipped_completed++; return false }
    return true
  })

  // 4. 해당 assignment들의 change_logs를 한 번에 조회 (N+1 제거)
  const candidateIds = candidateAssignments.map((a) => a.id)
  const { data: allLogs } = candidateIds.length > 0
    ? await supabase
        .from('change_logs')
        .select('id, action, note, created_at, target_id')
        .in('target_id', candidateIds)
        .eq('target_type', 'ot_session')
        .ilike('action', '%OT 일정 등록%')
        .order('created_at', { ascending: true })
    : { data: [] as { id: string; action: string; note: string; created_at: string; target_id: string }[] }

  // target_id별로 그룹핑
  const logsByAssignment = new Map<string, typeof allLogs>()
  for (const log of (allLogs ?? [])) {
    const list = logsByAssignment.get(log.target_id) ?? []
    list.push(log)
    logsByAssignment.set(log.target_id, list)
  }

  for (const a of candidateAssignments) {
    const member = a.member as unknown as { id: string; name: string }
    const sessions = (a.sessions ?? []) as { id: string; session_number: number; scheduled_at: string | null; completed_at: string | null }[]

    const logs = logsByAssignment.get(a.id)
    if (!logs || logs.length === 0) {
      result.skipped_no_logs++
      continue
    }

    // note에서 시간 파싱 + dedup
    const seenTimes = new Map<string, { iso: string; logCreatedAt: string }>()
    for (const log of logs) {
      const parsed = parseTimeFromNote(log.note)
      if (!parsed) continue
      const logYear = new Date(log.created_at).getUTCFullYear()
      const iso = kstToIsoUtc(logYear, parsed.month, parsed.day, parsed.hour, parsed.minute)
      if (!seenTimes.has(iso)) {
        seenTimes.set(iso, { iso, logCreatedAt: log.created_at })
      }
    }

    const distinctTimes = Array.from(seenTimes.values())
      .sort((x, y) => x.logCreatedAt.localeCompare(y.logCreatedAt))
      .map((x) => x.iso)
      .slice(0, 3)

    if (distinctTimes.length <= 1) {
      result.skipped_single++
      continue
    }

    const item: RecoveryItem = {
      assignment_id: a.id,
      member_name: member.name,
      pt_trainer_id: a.pt_trainer_id as string | null,
      ppt_trainer_id: a.ppt_trainer_id as string | null,
      current_sessions: sessions.map((s) => ({ session_number: s.session_number, scheduled_at: s.scheduled_at })),
      recovered_times: distinctTimes,
      reason: 'will_recover',
    }
    result.items.push(item)
    result.to_recover++

    if (!dryRun) {
      try {
        await applyRecoveryForAssignment(supabase, a.id, distinctTimes, a.pt_trainer_id as string | null, a.ppt_trainer_id as string | null, member)
      } catch (err) {
        result.errors.push(`${member.name} (${a.id}): ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  result.applied = !dryRun
  return result
}

/**
 * 한 assignment에 대해 ot_sessions와 trainer_schedules를 복구된 시간 목록으로 재구성.
 * - ot_sessions: session_number 1, 2, 3 순서로 upsert
 * - trainer_schedules: 기존 OT 행 정리 후 새로 insert (PT/PPT 트레이너별)
 */
async function applyRecoveryForAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  distinctTimesIso: string[],
  ptTrainerId: string | null,
  pptTrainerId: string | null,
  member: { id: string; name: string },
) {
  // 1. 기존 미완료 ot_sessions + trainer_schedules 병렬 삭제
  const trainerIds = [ptTrainerId, pptTrainerId].filter(Boolean) as string[]
  const deleteOps: PromiseLike<unknown>[] = [
    supabase.from('ot_sessions').delete().eq('ot_assignment_id', assignmentId).is('completed_at', null)
      .then(({ error }) => { if (error) throw new Error(`ot_sessions 삭제 실패: ${error.message}`) }),
    ...trainerIds.map((tid) =>
      supabase.from('trainer_schedules').delete().eq('trainer_id', tid).eq('schedule_type', 'OT').eq('member_name', member.name)
    ),
  ]
  await Promise.all(deleteOps)

  // 2. 새 ot_sessions 일괄 insert
  const sessionRows = distinctTimesIso.map((iso, i) => ({
    ot_assignment_id: assignmentId,
    session_number: i + 1,
    scheduled_at: iso,
  }))
  const { data: insertedSessions, error: sessErr } = await supabase
    .from('ot_sessions')
    .insert(sessionRows)
    .select('id, scheduled_at')
  if (sessErr) throw new Error(`ot_sessions insert 실패: ${sessErr.message}`)

  // 3. trainer_schedules 일괄 insert (병렬)
  if (trainerIds.length > 0 && insertedSessions) {
    const scheduleRows = insertedSessions.flatMap((sess) => {
      const kst = new Date(new Date(sess.scheduled_at).getTime() + 9 * 60 * 60 * 1000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`
      const timeStr = `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`
      return trainerIds.map((tid) => ({
        trainer_id: tid,
        schedule_type: 'OT' as const,
        member_name: member.name,
        member_id: member.id,
        ot_session_id: sess.id,
        scheduled_date: dateStr,
        start_time: timeStr,
        duration: 50,
      }))
    })
    await supabase.from('trainer_schedules').insert(scheduleRows)
  }

  // 4. assignment 상태가 신청대기/배정완료면 진행중으로 전환
  await supabase
    .from('ot_assignments')
    .update({ status: '진행중' })
    .eq('id', assignmentId)
    .in('status', ['신청대기', '배정완료'])
}
