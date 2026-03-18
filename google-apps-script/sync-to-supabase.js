// ═══════════════════════════════════════════════════════════
// 업무일지 → OT배정시트 자동복사 + Supabase 연동
// ═══════════════════════════════════════════════════════════
// [흐름]
// 1. FC일지/PT일지에서 K열(OT신청종목)에 값 입력
//    → OT배정시트에 자동 행 추가
// 2. OT배정시트에서 수동 보완 (운동시간, 운동목적, 특이사항)
//    → I열(특이사항) 입력 완료 시 Supabase로 전송
// ═══════════════════════════════════════════════════════════

// ── 설정값 ────────────────────────────────────────────────
const SUPABASE_FUNCTION_URL = 'https://nwyxawtqpdqbsqkpjucu.supabase.co/functions/v1/sync-member'
const SUPABASE_ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXhhd3RxcGRxYnNxa3BqdWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDk5ODMsImV4cCI6MjA4OTI4NTk4M30.2I4Nr9t_6sf5OLyHTax-mPhi5E7ZDm3pNgdU5tNbTO8'

// 일지 시트 이름 (여러 개 가능)
const SOURCE_SHEETS = ['FC,PT일지']
const OT_SHEET_NAME = 'OT배정'

// ── FC/PT일지 컬럼 번호 ──
const SRC = {
  REGISTERED_AT: 5,   // E열: 등록날짜
  NAME: 6,            // F열: 이름
  PHONE: 7,           // G열: 번호
  SPORT_TYPE: 8,      // H열: 종목
  DURATION: 10,       // J열: 운동기간
  OT_REQUEST: 11,     // K열: OT신청종목
}

// ── OT배정시트 컬럼 번호 ──
const OT = {
  REGISTERED_AT: 1,   // A열: 등록날짜
  SPORT_TYPE: 2,      // B열: 종목
  NAME: 3,            // C열: 이름
  PHONE: 4,           // D열: 연락처
  OT_CATEGORY: 5,     // E열: OT신청종목
  DURATION: 6,        // F열: 운동기간
  EXERCISE_TIME: 7,   // G열: 운동시간 (수동)
  PURPOSE: 8,         // H열: 운동목적 (수동)
  NOTES: 9,           // I열: 특이사항 (수동)
}

// ── 유효한 OT신청종목 ──
const VALID_OT_VALUES = ['헬스', '필라', '헬스,필라', '필라,헬스']

// ═══════════════════════════════════════════════════════════
// 메인 onEdit 함수
// ═══════════════════════════════════════════════════════════
function onEdit(e) {
  var sheet = e.source.getActiveSheet()
  var sheetName = sheet.getName()

  // ── 1. FC/PT일지 → OT배정시트 자동복사 ──
  if (SOURCE_SHEETS.indexOf(sheetName) !== -1) {
    handleSourceSheetEdit(e, sheet, sheetName)
    return
  }

  // ── 2. OT배정시트 → Supabase 전송 ──
  if (sheetName === OT_SHEET_NAME) {
    handleOtSheetEdit(e, sheet)
    return
  }
}

// ═══════════════════════════════════════════════════════════
// FC/PT일지에서 K열 입력 → OT배정시트에 자동 행 추가
// ═══════════════════════════════════════════════════════════
function handleSourceSheetEdit(e, sheet, sheetName) {
  // K열(OT신청종목)이 아니면 무시
  if (e.range.getColumn() !== SRC.OT_REQUEST) return

  var row = e.range.getRow()
  if (row <= 1) return // 헤더 무시

  var otValue = String(e.value || '').trim()

  // 유효한 OT 신청값인지 확인
  var isValid = false
  for (var i = 0; i < VALID_OT_VALUES.length; i++) {
    if (otValue === VALID_OT_VALUES[i]) {
      isValid = true
      break
    }
  }
  if (!isValid) return

  // 원본 데이터 읽기
  var name = sheet.getRange(row, SRC.NAME).getValue()
  var phone = String(sheet.getRange(row, SRC.PHONE).getValue()).replace(/\D/g, '')

  if (!name || !phone) {
    SpreadsheetApp.getUi().alert('이름(F열)과 연락처(G열)를 먼저 입력해주세요.')
    return
  }

  var registeredAt = sheet.getRange(row, SRC.REGISTERED_AT).getValue()
  var sportType = sheet.getRange(row, SRC.SPORT_TYPE).getValue()
  var duration = sheet.getRange(row, SRC.DURATION).getValue()

  // OT배정시트에 행 추가
  var ss = e.source
  var otSheet = ss.getSheetByName(OT_SHEET_NAME)

  if (!otSheet) {
    // OT배정시트가 없으면 생성
    otSheet = ss.insertSheet(OT_SHEET_NAME)
    otSheet.getRange(1, OT.REGISTERED_AT).setValue('등록날짜')
    otSheet.getRange(1, OT.SPORT_TYPE).setValue('종목')
    otSheet.getRange(1, OT.NAME).setValue('이름')
    otSheet.getRange(1, OT.PHONE).setValue('연락처')
    otSheet.getRange(1, OT.OT_CATEGORY).setValue('OT신청종목')
    otSheet.getRange(1, OT.DURATION).setValue('운동기간')
    otSheet.getRange(1, OT.EXERCISE_TIME).setValue('운동시간')
    otSheet.getRange(1, OT.PURPOSE).setValue('운동목적')
    otSheet.getRange(1, OT.NOTES).setValue('특이사항')
    // 헤더 스타일
    otSheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f4f6')
  }

  // 중복 체크 (같은 연락처가 이미 있는지)
  var existingPhones = otSheet.getRange(2, OT.PHONE, Math.max(otSheet.getLastRow() - 1, 1), 1).getValues()
  for (var j = 0; j < existingPhones.length; j++) {
    if (String(existingPhones[j][0]).replace(/\D/g, '') === phone) {
      // 이미 있으면 셀 노란색 표시
      e.range.setBackground('#fff2cc')
      return
    }
  }

  // 새 행 추가
  var newRow = otSheet.getLastRow() + 1
  otSheet.getRange(newRow, OT.REGISTERED_AT).setValue(registeredAt)
  otSheet.getRange(newRow, OT.SPORT_TYPE).setValue(sportType)
  otSheet.getRange(newRow, OT.NAME).setValue(name)
  otSheet.getRange(newRow, OT.PHONE).setValue(phone)
  otSheet.getRange(newRow, OT.OT_CATEGORY).setValue(otValue)
  otSheet.getRange(newRow, OT.DURATION).setValue(duration)

  // OT신청종목에 따라 색상 표시
  var categoryCell = otSheet.getRange(newRow, OT.OT_CATEGORY)
  if (otValue.indexOf('헬스') !== -1 && otValue.indexOf('필라') !== -1) {
    categoryCell.setBackground('#dbeafe') // 둘 다
  } else if (otValue.indexOf('헬스') !== -1) {
    categoryCell.setBackground('#93c5fd') // 파랑
  } else if (otValue.indexOf('필라') !== -1) {
    categoryCell.setBackground('#fde68a') // 노랑
  }

  // 원본 셀 연두색 표시 (성공)
  e.range.setBackground('#d9ead3')
}

// ═══════════════════════════════════════════════════════════
// OT배정시트에서 수동 입력 완료 → Supabase 전송
// (E열 OT신청종목 입력 시 자동 전송)
// ═══════════════════════════════════════════════════════════
function handleOtSheetEdit(e, sheet) {
  var col = e.range.getColumn()
  var row = e.range.getRow()
  if (row <= 1) return // 헤더 무시

  // E열(OT신청종목) 값이 있는 행이면 Supabase에 전송
  var otCategory = sheet.getRange(row, OT.OT_CATEGORY).getValue()
  if (!otCategory) return

  var name = sheet.getRange(row, OT.NAME).getValue()
  var phone = String(sheet.getRange(row, OT.PHONE).getValue()).replace(/\D/g, '')
  if (!name || !phone) return

  var data = {
    registered_at: formatDate(sheet.getRange(row, OT.REGISTERED_AT).getValue()),
    log_type: String(sheet.getRange(row, OT.SPORT_TYPE).getValue()) || 'FC',
    name: name,
    phone: phone,
    ot_category: String(otCategory),
    duration: String(sheet.getRange(row, OT.DURATION).getValue()),
    exercise_time: String(sheet.getRange(row, OT.EXERCISE_TIME).getValue()),
    purpose: String(sheet.getRange(row, OT.PURPOSE).getValue()),
    notes: String(sheet.getRange(row, OT.NOTES).getValue()),
    ot_status: '신청',
  }

  try {
    var response = UrlFetchApp.fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
    })

    var status = response.getResponseCode()
    if (status === 200 || status === 201) {
      // 성공 → C열(이름) 셀 연두색
      sheet.getRange(row, OT.NAME).setBackground('#d9ead3')
    } else {
      sheet.getRange(row, OT.NAME).setBackground('#f4cccc')
      console.error('Sync 실패:', response.getContentText())
    }
  } catch (err) {
    sheet.getRange(row, OT.NAME).setBackground('#f4cccc')
    console.error('네트워크 오류:', err)
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return null
  var d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}
