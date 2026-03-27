import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nwyxawtqpdqbsqkpjucu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXhhd3RxcGRxYnNxa3BqdWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDk5ODMsImV4cCI6MjA4OTI4NTk4M30.2I4Nr9t_6sf5OLyHTax-mPhi5E7ZDm3pNgdU5tNbTO8'

const supabase = createClient(supabaseUrl, supabaseKey)

// ── 3월 스케줄 데이터 ──
const scheduleData = [
  {
    name: '이서윤', phone: '010-4180-7604',
    pt: { trainer: '박규민', sessions: [{ n: 1, date: '2026-03-19 18:00' }] },
    ppt: { trainer: '구은솔', sessions: [{ n: 1, date: '2026-03-11 17:30' }] },
  },
  {
    name: '박은진', phone: '010-9620-1818',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-09 11:00' }, { n: 2, date: '2026-03-11 10:00' }] },
    ppt: null,
  },
  {
    name: '정현진', phone: '010-4558-8356',
    pt: { trainer: '김석현', sessions: [{ n: 1, date: '2026-03-11 21:00' }, { n: 2, date: '2026-03-14 17:00' }, { n: 3, date: '2026-03-19 21:30' }] },
    ppt: null,
  },
  {
    name: '이현숙', phone: '010-9241-6495',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-04 21:00' }, { n: 2, date: '2026-03-11 18:00' }] },
    ppt: { trainer: '정가윤', sessions: [] },
  },
  {
    name: '조현명', phone: '010-7673-3239',
    pt: { trainer: '유창욱', sessions: [{ n: 1, date: '2026-03-14 11:00' }, { n: 2, date: '2026-03-17 20:00' }] },
    ppt: null,
  },
  {
    name: '김세영', phone: '010-4555-6897',
    pt: { trainer: '박규민', sessions: [{ n: 1, date: '2026-03-17 20:00' }, { n: 2, date: '2026-03-23 09:00' }] },
    ppt: null,
  },
  {
    name: '서정원', phone: '010-9314-5082',
    pt: { trainer: '김석현', sessions: [{ n: 1, date: '2026-03-10 16:00' }, { n: 2, date: '2026-03-15 11:00' }, { n: 3, date: '2026-03-25 20:30' }] },
    ppt: null,
  },
  {
    name: '서기윤', phone: '010-9108-8421',
    pt: { trainer: '유창욱', sessions: [{ n: 1, date: '2026-03-16 21:00' }] },
    ppt: null,
  },
  {
    name: '박준영', phone: '010-5295-8935',
    pt: { trainer: '유창욱', sessions: [{ n: 1, date: '2026-03-14 10:00' }] },
    ppt: { trainer: '정가윤', sessions: [] },
  },
  {
    name: '김혜원', phone: '010-6384-7701',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-24 19:00' }] },
    ppt: null,
  },
  {
    name: '김지현', phone: '010-5893-9595',
    pt: { trainer: '김석현', sessions: [{ n: 1, date: '2026-03-16 18:00' }, { n: 2, date: '2026-03-25 18:00' }] },
    ppt: null,
  },
  {
    name: '강성은', phone: '010-9489-0651',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-18 09:00' }, { n: 2, date: '2026-03-24 10:00' }] },
    ppt: null,
  },
  {
    name: '조아란', phone: '010-9338-3598',
    pt: { trainer: '유창욱', sessions: [{ n: 1, date: '2026-03-19 18:00' }] },
    ppt: null,
  },
  {
    name: '장세준', phone: '010-5519-7654',
    pt: { trainer: '오종민', sessions: [] },
    ppt: { trainer: '정가윤', sessions: [{ n: 1, date: '2026-03-24 18:00' }] },
  },
  {
    name: '강영준', phone: '010-2666-8526',
    pt: { trainer: '유창욱', sessions: [{ n: 1, date: '2026-03-23 20:00' }, { n: 2, date: '2026-03-25 21:00' }] },
    ppt: null,
  },
  {
    name: '김윤지', phone: '010-6623-3762',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-18 20:00' }, { n: 2, date: '2026-03-22 18:00' }, { n: 3, date: '2026-03-25 21:00' }] },
    ppt: null,
  },
  {
    name: '김은환', phone: '010-8339-6224',
    pt: { trainer: '김석현', sessions: [{ n: 1, date: '2026-03-21 14:00' }] },
    ppt: null,
  },
  {
    name: '하동수', phone: '010-2533-8908',
    pt: { trainer: '김석현', sessions: [{ n: 1, date: '2026-03-20 21:30' }] },
    ppt: null,
  },
  {
    name: '권세윤', phone: '010-5027-3117',
    pt: { trainer: '오종민', sessions: [{ n: 1, date: '2026-03-24 21:00' }, { n: 2, date: '2026-03-26 07:00' }] },
    ppt: { trainer: '구은솔', sessions: [] },
  },
]

async function main() {
  console.log('=== 3월 스케줄 데이터 입력 시작 ===\n')

  // 1. 트레이너 목록 조회
  const { data: trainers, error: trainerErr } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['trainer', 'admin', '팀장'])

  if (trainerErr) {
    console.error('트레이너 조회 실패:', trainerErr.message)
    return
  }

  console.log('등록된 트레이너 목록:')
  trainers.forEach(t => console.log(`  - ${t.name} (${t.role}) [${t.id}]`))
  console.log()

  // 트레이너 이름 → ID 매핑
  const trainerMap = {}
  for (const t of trainers) {
    // 이름에서 TR, T, 팀장 등 제거하고 매핑
    const cleanName = t.name.replace(/(TR|T|팀장|트레이너|선생님)$/g, '').trim()
    trainerMap[cleanName] = t.id
    trainerMap[t.name] = t.id // 원본 이름도 매핑
  }

  console.log('트레이너 매핑:', trainerMap)
  console.log()

  let successCount = 0
  let errorCount = 0

  for (const item of scheduleData) {
    console.log(`\n── ${item.name} (${item.phone}) ──`)

    // 2. 회원 upsert (phone 기준)
    const { data: existingMember } = await supabase
      .from('members')
      .select('id, name')
      .eq('phone', item.phone)
      .maybeSingle()

    let memberId
    if (existingMember) {
      memberId = existingMember.id
      console.log(`  회원 존재: ${existingMember.name} [${memberId}]`)
    } else {
      // 회원이 없으면 새로 생성
      const otCategory = item.ppt ? (item.pt?.sessions?.length > 0 ? '헬스,필라' : '필라') : '헬스'
      const { data: newMember, error: memberErr } = await supabase
        .from('members')
        .insert({
          name: item.name,
          phone: item.phone,
          sports: otCategory === '헬스,필라' ? ['헬스', '필라'] : [otCategory],
          ot_category: otCategory,
          registered_at: '2026-03-01',
        })
        .select('id')
        .single()

      if (memberErr) {
        console.error(`  회원 생성 실패: ${memberErr.message}`)
        errorCount++
        continue
      }
      memberId = newMember.id
      console.log(`  회원 생성: [${memberId}]`)
    }

    // 3. PT OT 배정
    if (item.pt && item.pt.trainer) {
      const ptTrainerId = trainerMap[item.pt.trainer]
      if (!ptTrainerId) {
        console.error(`  PT 트레이너 "${item.pt.trainer}" 매핑 실패`)
        errorCount++
      } else {
        // 기존 PT 배정 확인
        const { data: existingPtAssign } = await supabase
          .from('ot_assignments')
          .select('id')
          .eq('member_id', memberId)
          .eq('ot_category', '헬스')
          .not('status', 'in', '("완료","거부")')
          .maybeSingle()

        let ptAssignId
        if (existingPtAssign) {
          ptAssignId = existingPtAssign.id
          // 트레이너 업데이트
          await supabase
            .from('ot_assignments')
            .update({ pt_trainer_id: ptTrainerId })
            .eq('id', ptAssignId)
          console.log(`  PT 배정 업데이트: [${ptAssignId}]`)
        } else {
          const status = item.pt.sessions.length >= 3 ? '완료' : item.pt.sessions.length > 0 ? '진행중' : '배정완료'
          const { data: newAssign, error: assignErr } = await supabase
            .from('ot_assignments')
            .insert({
              member_id: memberId,
              status,
              ot_category: '헬스',
              pt_trainer_id: ptTrainerId,
              pt_assign_status: '배정완료',
            })
            .select('id')
            .single()

          if (assignErr) {
            console.error(`  PT 배정 생성 실패: ${assignErr.message}`)
            errorCount++
          } else {
            ptAssignId = newAssign.id
            console.log(`  PT 배정 생성 (${status}): [${ptAssignId}]`)
          }
        }

        // PT 세션 입력
        if (ptAssignId && item.pt.sessions.length > 0) {
          for (const sess of item.pt.sessions) {
            const scheduledAt = new Date(sess.date.replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2:00+09:00')).toISOString()
            const { error: sessErr } = await supabase
              .from('ot_sessions')
              .upsert({
                ot_assignment_id: ptAssignId,
                session_number: sess.n,
                scheduled_at: scheduledAt,
              }, { onConflict: 'ot_assignment_id,session_number' })

            if (sessErr) {
              console.error(`  PT ${sess.n}차 세션 실패: ${sessErr.message}`)
              errorCount++
            } else {
              console.log(`  PT ${sess.n}차: ${sess.date}`)
              successCount++
            }
          }
        }
      }
    }

    // 4. PPT(필라) OT 배정
    if (item.ppt && item.ppt.trainer) {
      const pptTrainerId = trainerMap[item.ppt.trainer]
      if (!pptTrainerId) {
        console.error(`  PPT 트레이너 "${item.ppt.trainer}" 매핑 실패`)
        errorCount++
      } else {
        // 기존 PPT 배정 확인
        const { data: existingPptAssign } = await supabase
          .from('ot_assignments')
          .select('id')
          .eq('member_id', memberId)
          .eq('ot_category', '필라')
          .not('status', 'in', '("완료","거부")')
          .maybeSingle()

        let pptAssignId
        if (existingPptAssign) {
          pptAssignId = existingPptAssign.id
          await supabase
            .from('ot_assignments')
            .update({ ppt_trainer_id: pptTrainerId })
            .eq('id', pptAssignId)
          console.log(`  PPT 배정 업데이트: [${pptAssignId}]`)
        } else {
          const status = item.ppt.sessions.length >= 3 ? '완료' : item.ppt.sessions.length > 0 ? '진행중' : '배정완료'
          const { data: newAssign, error: assignErr } = await supabase
            .from('ot_assignments')
            .insert({
              member_id: memberId,
              status,
              ot_category: '필라',
              ppt_trainer_id: pptTrainerId,
              ppt_assign_status: '배정완료',
            })
            .select('id')
            .single()

          if (assignErr) {
            console.error(`  PPT 배정 생성 실패: ${assignErr.message}`)
            errorCount++
          } else {
            pptAssignId = newAssign.id
            console.log(`  PPT 배정 생성 (${status}): [${pptAssignId}]`)
          }
        }

        // PPT 세션 입력
        if (pptAssignId && item.ppt.sessions.length > 0) {
          for (const sess of item.ppt.sessions) {
            const scheduledAt = new Date(sess.date.replace(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/, '$1T$2:00+09:00')).toISOString()
            const { error: sessErr } = await supabase
              .from('ot_sessions')
              .upsert({
                ot_assignment_id: pptAssignId,
                session_number: sess.n,
                scheduled_at: scheduledAt,
              }, { onConflict: 'ot_assignment_id,session_number' })

            if (sessErr) {
              console.error(`  PPT ${sess.n}차 세션 실패: ${sessErr.message}`)
              errorCount++
            } else {
              console.log(`  PPT ${sess.n}차: ${sess.date}`)
              successCount++
            }
          }
        }
      }
    }
  }

  console.log(`\n=== 완료 ===`)
  console.log(`성공: ${successCount}건, 실패: ${errorCount}건`)
}

main().catch(console.error)
