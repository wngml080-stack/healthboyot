'use server'

// 알리고 SMS API 연동
// 환경변수: ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER (발신번호)

interface SendSmsResult {
  success: boolean
  error?: string
}

export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const apiKey = process.env.ALIGO_API_KEY
  const userId = process.env.ALIGO_USER_ID
  const sender = process.env.ALIGO_SENDER
  const proxyUrl = process.env.ALIGO_PROXY_URL // 고정IP 프록시 서버

  if (!apiKey || !userId || !sender) {
    return { success: false, error: '알리고 API 설정이 되어있지 않습니다. 환경변수를 확인해주세요.' }
  }

  // 전화번호 정리 (하이픈 제거)
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.length < 10) {
    return { success: false, error: '올바른 전화번호를 입력해주세요.' }
  }

  try {
    // 프록시 서버를 통해 알리고 API 호출 (고정IP 우회)
    if (proxyUrl) {
      const res = await fetch(`${proxyUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'healthboy-aligo-2026',
          key: apiKey,
          user_id: userId,
          sender,
          receiver: cleanPhone,
          msg: message,
          msg_type: message.length > 45 ? 'LMS' : 'SMS',
        }),
      })

      const text = await res.text()
      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        return { success: false, error: `프록시 응답 파싱 실패: ${text.slice(0, 200)}` }
      }

      if (String(data.result_code) === '1') {
        return { success: true }
      } else {
        return { success: false, error: `[${data.result_code}] ${data.message ?? '알 수 없는 오류'}` }
      }
    }

    // 프록시 없으면 직접 호출 (fallback)
    const formData = new FormData()
    formData.append('key', apiKey)
    formData.append('user_id', userId)
    formData.append('sender', sender)
    formData.append('receiver', cleanPhone)
    formData.append('msg', message)
    formData.append('msg_type', message.length > 45 ? 'LMS' : 'SMS')

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
    })

    const text = await res.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      return { success: false, error: `알리고 응답 파싱 실패: ${text.slice(0, 200)}` }
    }

    if (String(data.result_code) === '1') {
      return { success: true }
    } else {
      let ipInfo = ''
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipRes.json() as { ip: string }
        ipInfo = ` (서버IP: ${ipData.ip})`
      } catch {}
      return { success: false, error: `[${data.result_code}] ${data.message ?? '알 수 없는 오류'}${ipInfo}` }
    }
  } catch (err) {
    return { success: false, error: `네트워크 오류: ${(err as Error).message}` }
  }
}

// 상담카드 링크 문자 발송
export async function sendConsultationLinkSms(phone: string, cardId: string, memberName: string): Promise<SendSmsResult> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.healthboyot.cloud'
  const url = `${baseUrl}/form/${cardId}`

  const message = `[HEALTHBOYGYM 당산점]\n\n${memberName}님 안녕하세요!\n상담카드 작성을 부탁드립니다.\n\n아래 링크를 눌러 작성해주세요:\n${url}`

  return sendSms(phone, message)
}
