import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })
    }

    // 이미지 → base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `이 이미지는 "라포" 피트니스 앱의 주간 스케줄 화면입니다.

파란색 셀(수업)만 추출해주세요. 각 파란색 셀에는 회원 이름이 적혀 있습니다.

화면 상단에 요일과 날짜가 표시되어 있고, 왼쪽에 시간대가 표시되어 있습니다.
- 상단의 날짜/요일 행을 보고 각 열이 어떤 날짜인지 파악하세요
- 왼쪽의 시간대를 보고 각 행이 어떤 시간인지 파악하세요
- 한 시간 안에 여러 셀이 있을 수 있습니다 (30분 단위)

회색 셀, "OFF" 셀, "OT" 셀, 빈 셀은 모두 무시하세요. 파란색(수업) 셀만 추출합니다.

결과를 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:

{
  "month": 5,
  "schedules": [
    { "name": "회원이름", "day": 4, "dayOfWeek": "월", "time": "09:00" },
    { "name": "회원이름", "day": 5, "dayOfWeek": "화", "time": "10:00" }
  ]
}

주의사항:
- time은 24시간 형식 (HH:mm)
- "오전 9시" = "09:00", "오후 1시" = "13:00", "오후 2시" = "14:00" 등
- 한 시간에 위쪽 셀은 :00, 아래쪽 셀은 :30
- day는 날짜 숫자 (예: 4, 5, 6...)
- 이름이 잘 안보이면 최대한 추측하여 입력
- JSON만 반환, 마크다운 코드블록 없이`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // JSON 추출 (마크다운 코드블록 제거)
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(jsonStr)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[OCR API Error]', err)
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
