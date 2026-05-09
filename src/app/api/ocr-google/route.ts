import { NextRequest, NextResponse } from 'next/server'
import vision from '@google-cloud/vision'

export const maxDuration = 30

type Word = { text: string; cx: number; cy: number; x: number; y: number; w: number; h: number }

function buildClient() {
  const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON
  if (!keyJson) throw new Error('GOOGLE_CLOUD_KEY_JSON 환경변수가 설정되지 않았습니다')
  const credentials = JSON.parse(keyJson)
  return new vision.ImageAnnotatorClient({
    credentials,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || credentials.project_id,
  })
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const NOISE_TOKENS = new Set([
  '월', '화', '수', '목', '금', '토', '일',
  'OT', 'OFF', 'Off', 'off',
  '오전', '오후',
  '수업', '신청/변경', '신청', '변경', '일반', '노쇼',
])

function timeLabelToHour(label: string): number | null {
  const match = label.match(/(오전|오후)?\s*(\d{1,2})\s*시/)
  if (!match) return null
  const period = match[1]
  let hour = parseInt(match[2], 10)
  if (period === '오후' && hour < 12) hour += 12
  if (period === '오전' && hour === 12) hour = 0
  return hour
}

function isNoise(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (NOISE_TOKENS.has(t)) return true
  if (/^\d+$/.test(t)) return true                     // 날짜/숫자
  if (/^(오전|오후)?\s*\d{1,2}\s*시$/.test(t)) return true  // 시간 라벨
  if (/^\d{1,2}:\d{2}$/.test(t)) return true            // 시계
  if (t.length > 6) return true                         // 너무 긴 텍스트(이름은 보통 2~4자)
  return false
}

function findHeaderColumns(words: Word[]): { day: string; cx: number; cy: number }[] {
  const dayWords = words.filter((w) => DAY_LABELS.includes(w.text.trim()))
  if (dayWords.length === 0) return []
  const minY = Math.min(...dayWords.map((w) => w.cy))
  const headerBand = dayWords.filter((w) => w.cy <= minY + 60)
  const byDay = new Map<string, Word>()
  for (const w of headerBand) {
    const t = w.text.trim()
    if (!byDay.has(t)) byDay.set(t, w)
  }
  return DAY_LABELS
    .map((d) => ({ day: d, word: byDay.get(d) }))
    .filter((x) => x.word)
    .map((x) => ({ day: x.day, cx: x.word!.cx, cy: x.word!.cy }))
}

function findRowHours(words: Word[]): { hour: number; cy: number }[] {
  const rows: { hour: number; cy: number }[] = []
  for (const w of words) {
    const hour = timeLabelToHour(w.text.trim())
    if (hour !== null) rows.push({ hour, cy: w.cy })
  }
  rows.sort((a, b) => a.cy - b.cy)
  const dedup: { hour: number; cy: number }[] = []
  for (const r of rows) {
    if (!dedup.find((d) => Math.abs(d.cy - r.cy) < 15 && d.hour === r.hour)) dedup.push(r)
  }
  return dedup
}

function nearestColumn(cx: number, cols: { day: string; cx: number; cy: number }[]): { day: string; cx: number; cy: number } | null {
  if (cols.length === 0) return null
  let best = cols[0]
  let bestDist = Math.abs(cx - cols[0].cx)
  for (const c of cols) {
    const d = Math.abs(cx - c.cx)
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

function nearestRow(cy: number, rows: { hour: number; cy: number }[]): { hour: number; cy: number } | null {
  if (rows.length === 0) return null
  let best = rows[0]
  let bestDist = Math.abs(cy - rows[0].cy)
  for (const r of rows) {
    const d = Math.abs(cy - r.cy)
    if (d < bestDist) { bestDist = d; best = r }
  }
  return best
}

function findHeaderDates(words: Word[], cols: { day: string; cx: number; cy: number }[], headerY: number): Map<string, number> {
  const result = new Map<string, number>()
  const candidateY = headerY + 60
  const dateWords = words.filter(
    (w) => /^\d{1,2}$/.test(w.text.trim()) && w.cy > headerY && w.cy < candidateY + 60
  )
  for (const c of cols) {
    let best: Word | null = null
    let bestDist = Infinity
    for (const w of dateWords) {
      const d = Math.abs(w.cx - c.cx)
      if (d < bestDist && d < 40) { bestDist = d; best = w }
    }
    if (best) result.set(c.day, parseInt(best.text.trim(), 10))
  }
  return result
}

function findMonth(words: Word[]): number | null {
  for (const w of words) {
    const m = w.text.trim().match(/^(\d{1,2})월$/)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: '이미지가 없습니다' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const content = Buffer.from(bytes)

    const client = buildClient()
    const [result] = await client.documentTextDetection({ image: { content } })
    const fullText = result.fullTextAnnotation
    if (!fullText || !fullText.pages || fullText.pages.length === 0) {
      return NextResponse.json({ error: '텍스트를 인식하지 못했습니다' }, { status: 422 })
    }

    // 모든 단어 좌표 추출
    const words: Word[] = []
    for (const page of fullText.pages) {
      for (const block of page.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const w of para.words ?? []) {
            const text = (w.symbols ?? []).map((s) => s.text ?? '').join('')
            const verts = w.boundingBox?.vertices ?? []
            if (verts.length < 4) continue
            const xs = verts.map((v) => v.x ?? 0)
            const ys = verts.map((v) => v.y ?? 0)
            const x = Math.min(...xs)
            const y = Math.min(...ys)
            const w2 = Math.max(...xs) - x
            const h = Math.max(...ys) - y
            words.push({ text, x, y, w: w2, h, cx: x + w2 / 2, cy: y + h / 2 })
          }
        }
      }
    }

    // 인접 단어 병합 (같은 줄, 가까운 X)
    words.sort((a, b) => (a.cy === b.cy ? a.cx - b.cx : a.cy - b.cy))
    const merged: Word[] = []
    for (const w of words) {
      const last = merged[merged.length - 1]
      if (last && Math.abs(last.cy - w.cy) < 12 && w.x - (last.x + last.w) < 12) {
        const x = Math.min(last.x, w.x)
        const y = Math.min(last.y, w.y)
        const right = Math.max(last.x + last.w, w.x + w.w)
        const bottom = Math.max(last.y + last.h, w.y + w.h)
        last.text += w.text
        last.x = x; last.y = y
        last.w = right - x; last.h = bottom - y
        last.cx = x + last.w / 2
        last.cy = y + last.h / 2
      } else {
        merged.push({ ...w })
      }
    }

    // 1) 헤더 요일 컬럼 좌표
    const cols = findHeaderColumns(merged)
    if (cols.length < 5) {
      return NextResponse.json({ error: '요일 헤더를 찾지 못했습니다' }, { status: 422 })
    }
    const headerY = Math.max(...cols.map((c) => c.cy))

    // 2) 시간 행 좌표
    const rows = findRowHours(merged)
    if (rows.length < 3) {
      return NextResponse.json({ error: '시간축을 찾지 못했습니다' }, { status: 422 })
    }

    // 3) 헤더 날짜 매핑 (요일 → 날짜)
    const dayToDate = findHeaderDates(merged, cols, headerY)

    // 4) 월 추출
    const month = findMonth(merged)

    // 5) 그리드 매칭: 노이즈 아닌 텍스트를 (요일, 시간)으로 분류
    const headerMaxY = Math.max(...cols.map((c) => c.cy)) + 80  // 헤더 영역 끝 (날짜까지 포함)
    const timeAxisMaxX = Math.min(...rows.map((r) => 0)) // placeholder
    const timeXs = merged.filter((w) => timeLabelToHour(w.text.trim()) !== null).map((w) => w.x + w.w)
    const timeAxisRight = timeXs.length > 0 ? Math.max(...timeXs) : 0

    const schedules: { name: string; day: number; dayOfWeek: string; time: string }[] = []

    for (const w of merged) {
      const text = w.text.trim()
      if (isNoise(text)) continue
      if (w.cy <= headerMaxY) continue              // 헤더 영역 제외
      if (w.cx <= timeAxisRight + 5) continue        // 시간축 영역 제외

      const col = nearestColumn(w.cx, cols)
      const row = nearestRow(w.cy, rows)
      if (!col || !row) continue

      const colDist = Math.abs(w.cx - col.cx)
      const rowDist = Math.abs(w.cy - row.cy)
      if (colDist > 80 || rowDist > 60) continue   // 너무 멀면 셀 밖

      const day = dayToDate.get(col.day)
      if (!day) continue

      const time = `${String(row.hour).padStart(2, '0')}:00`
      schedules.push({ name: text, day, dayOfWeek: col.day, time })
    }

    // 동일 (이름, 날짜, 시간) 중복 제거
    const uniqKey = (s: { name: string; day: number; time: string }) => `${s.name}|${s.day}|${s.time}`
    const seen = new Set<string>()
    const unique = schedules.filter((s) => {
      const k = uniqKey(s)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    return NextResponse.json({ month, schedules: unique })
  } catch (err) {
    console.error('[OCR Google API Error]', err)
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
