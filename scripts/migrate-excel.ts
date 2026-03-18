/**
 * 기존 엑셀 데이터 → Supabase 마이그레이션 스크립트
 *
 * 사용법:
 *   1. 기존 OT 엑셀 파일을 scripts/data.xlsx 로 복사
 *   2. npx tsx scripts/migrate-excel.ts
 *
 * 엑셀 컬럼 매핑 (필요 시 아래 COLUMN_MAP 수정):
 *   A: 등록일, B: 이름, C: 연락처, D: 성별,
 *   E: 종목, F: 운동기간, G: 가능시간, H: 부상/특이사항,
 *   I: OT상태, J: PT담당자
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'

// ── 설정 ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const EXCEL_PATH = path.join(__dirname, 'data.xlsx')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── 컬럼 인덱스 (0-based) ────────────────────────────────
const COL = {
  REGISTERED_AT: 0,  // A
  NAME: 1,           // B
  PHONE: 2,          // C
  GENDER: 3,         // D
  SPORTS: 4,         // E
  DURATION: 5,       // F
  AVAILABLE_TIME: 6, // G
  NOTES: 7,          // H
  OT_STATUS: 8,      // I
  PT_TRAINER: 9,     // J
}

// ── 상태 매핑 ─────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  '신청': '신청대기',
  '신청대기': '신청대기',
  '배정': '배정완료',
  '배정완료': '배정완료',
  '진행': '진행중',
  '진행중': '진행중',
  '완료': '완료',
  '거부': '거부',
  '추후결정': '추후결정',
  '추후': '추후결정',
}

async function main() {
  console.log('📂 엑셀 파일 읽는 중...', EXCEL_PATH)

  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // 헤더 제외
  const dataRows = rows.slice(1).filter((row) => row[COL.NAME])

  console.log(`📊 ${dataRows.length}건 발견`)

  // 트레이너 이름 → ID 매핑
  const { data: trainers } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['trainer', 'admin'])

  const trainerMap = new Map<string, string>()
  for (const t of trainers ?? []) {
    trainerMap.set(t.name, t.id)
  }

  let success = 0
  let skipped = 0
  let failed = 0

  for (const row of dataRows) {
    const name = String(row[COL.NAME] ?? '').trim()
    const phone = String(row[COL.PHONE] ?? '').replace(/\D/g, '')

    if (!name || !phone) {
      skipped++
      continue
    }

    try {
      // 회원 upsert
      const { data: member, error: memberErr } = await supabase
        .from('members')
        .upsert(
          {
            name,
            phone,
            gender: parseGender(row[COL.GENDER]),
            sports: parseSports(row[COL.SPORTS]),
            duration_months: parseDuration(row[COL.DURATION]),
            available_time: String(row[COL.AVAILABLE_TIME] ?? '') || null,
            injury_tags: parseInjuryTags(row[COL.NOTES]),
            notes: String(row[COL.NOTES] ?? '') || null,
            registered_at: parseDate(row[COL.REGISTERED_AT]),
          },
          { onConflict: 'phone', ignoreDuplicates: false }
        )
        .select()
        .single()

      if (memberErr) {
        console.error(`  ❌ 회원 ${name}: ${memberErr.message}`)
        failed++
        continue
      }

      // OT 배정 생성
      const otStatus = STATUS_MAP[String(row[COL.OT_STATUS] ?? '')] ?? '신청대기'
      const trainerName = String(row[COL.PT_TRAINER] ?? '').trim()
      const trainerId = trainerMap.get(trainerName) ?? null

      const { error: otErr } = await supabase
        .from('ot_assignments')
        .insert({
          member_id: member.id,
          status: otStatus,
          pt_trainer_id: trainerId,
        })

      if (otErr && !otErr.message.includes('duplicate')) {
        console.error(`  ⚠️ OT ${name}: ${otErr.message}`)
      }

      success++
      if (success % 10 === 0) console.log(`  ✅ ${success}건 완료...`)
    } catch (err) {
      console.error(`  ❌ ${name}: ${(err as Error).message}`)
      failed++
    }
  }

  console.log('\n── 마이그레이션 완료 ──')
  console.log(`  ✅ 성공: ${success}건`)
  console.log(`  ⏭️ 스킵: ${skipped}건 (이름/연락처 없음)`)
  console.log(`  ❌ 실패: ${failed}건`)
}

// ── 헬퍼 ──────────────────────────────────────────────────
function parseDate(value: unknown): string {
  if (!value) return new Date().toISOString().split('T')[0]
  if (typeof value === 'number') {
    // 엑셀 날짜 시리얼 → JS Date
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  return d.toISOString().split('T')[0]
}

function parseGender(value: unknown): '남' | '여' | null {
  const s = String(value ?? '').trim()
  if (s.includes('남') || s === 'M') return '남'
  if (s.includes('여') || s === 'F') return '여'
  return null
}

function parseSports(value: unknown): string[] {
  if (!value) return []
  return String(value).split(/[,\/·\s]+/).map((s) => s.trim()).filter(Boolean)
}

function parseDuration(value: unknown): number | null {
  if (!value) return null
  const num = parseInt(String(value).replace(/\D/g, ''))
  return isNaN(num) ? null : num
}

function parseInjuryTags(value: unknown): string[] {
  if (!value) return []
  const text = String(value)
  const keywords = ['허리', '무릎', '어깨', '목', '손목', '발목', '디스크', '재활', '수술']
  return keywords.filter((k) => text.includes(k))
}

main().catch(console.error)
