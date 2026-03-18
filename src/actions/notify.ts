'use server'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OT 알림 발송 (카카오 알림톡 / 문자 대체 발송)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 카카오 알림톡 연동 시:
// 1. 카카오 비즈니스 채널 가입
// 2. 알림톡 템플릿 등록 (OT일정안내, OT일정변경, OT완료안내)
// 3. API 키를 .env.local에 추가
// 4. sendKakaoAlimtalk 함수 구현
//
// 현재: 콘솔 로그 + DB 기록으로 대체

import { isDemoMode } from '@/lib/demo'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export interface NotifyResult {
  success: boolean
  method: 'kakao' | 'sms' | 'log'
  error?: string
}

// OT 일정 확정 알림
export async function notifyScheduleConfirmed(params: {
  memberName: string
  memberPhone: string
  trainerName: string
  sessionNumber: number
  scheduledAt: string
}): Promise<NotifyResult> {
  const { memberName, memberPhone, trainerName, sessionNumber, scheduledAt } = params
  const dateStr = format(new Date(scheduledAt), 'M월 d일 (EEE) HH:mm', { locale: ko })

  const message = `[HEALTHBOYGYM] ${memberName}님 OT 안내\n\n${sessionNumber}차 OT가 예약되었습니다.\n\n일시: ${dateStr}\n담당: ${trainerName} 트레이너\n\n변경/취소는 센터로 연락주세요.`

  return await sendNotification(memberPhone, message)
}

// OT 일정 변경 알림
export async function notifyScheduleChanged(params: {
  memberName: string
  memberPhone: string
  sessionNumber: number
  oldDate: string
  newDate: string
}): Promise<NotifyResult> {
  const { memberName, memberPhone, sessionNumber, oldDate, newDate } = params
  const oldStr = format(new Date(oldDate), 'M월 d일 HH:mm', { locale: ko })
  const newStr = format(new Date(newDate), 'M월 d일 HH:mm', { locale: ko })

  const message = `[HEALTHBOYGYM] ${memberName}님 일정 변경\n\n${sessionNumber}차 OT 일정이 변경되었습니다.\n\n변경 전: ${oldStr}\n변경 후: ${newStr}\n\n문의: 센터 연락`

  return await sendNotification(memberPhone, message)
}

// OT 완료 + PT 안내
export async function notifyOtCompleted(params: {
  memberName: string
  memberPhone: string
}): Promise<NotifyResult> {
  const { memberName, memberPhone } = params

  const message = `[HEALTHBOYGYM] ${memberName}님\n\nOT가 모두 완료되었습니다!\n운동 목표에 맞는 맞춤 PT 프로그램을 안내드립니다.\n\n자세한 상담은 센터로 연락주세요.`

  return await sendNotification(memberPhone, message)
}

// ── 발송 실행 ──
async function sendNotification(phone: string, message: string): Promise<NotifyResult> {
  if (isDemoMode()) {
    console.log(`[알림 발송] ${phone}: ${message}`)
    return { success: true, method: 'log' }
  }

  // 카카오 알림톡 API 키가 있으면 알림톡 발송
  const kakaoKey = process.env.KAKAO_ALIMTALK_KEY
  if (kakaoKey) {
    // TODO: 카카오 알림톡 API 호출
    // const result = await sendKakaoAlimtalk(phone, message, kakaoKey)
    // return result
  }

  // 문자 발송 API가 있으면 문자 발송 (NHN Cloud, CoolSMS 등)
  const smsKey = process.env.SMS_API_KEY
  if (smsKey) {
    // TODO: SMS API 호출
    // const result = await sendSms(phone, message, smsKey)
    // return result
  }

  // DB에 발송 내역 기록
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    await supabase.from('work_logs').insert({
      log_type: 'FC',
      content: `[자동알림] ${phone}: ${message.substring(0, 100)}...`,
    })
  } catch {}

  console.log(`[알림 발송 대기] ${phone}: ${message}`)
  return { success: true, method: 'log' }
}
