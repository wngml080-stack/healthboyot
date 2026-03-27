// ═══════════════════════════════════════════════════════════
// OT 연동 전용 코드 (기존 Code.gs와 분리)
// ═══════════════════════════════════════════════════════════
// 파일: OT연동.gs
// 트리거: onEditOT (별도 설치형 트리거로 등록)
// ═══════════════════════════════════════════════════════════

// ── 설정값 ────────────────────────────────────────────────
var OT_SUPABASE_URL = 'https://nwyxawtqpdqbsqkpjucu.supabase.co/functions/v1/sync-member';
var OT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXhhd3RxcGRxYnNxa3BqdWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDk5ODMsImV4cCI6MjA4OTI4NTk4M30.2I4Nr9t_6sf5OLyHTax-mPhi5E7ZDm3pNgdU5tNbTO8';

var OT_SOURCE_SHEET = 'FC,PT일지';
var OT_TARGET_SHEET = 'OT배정';

// FC,PT일지 컬럼 번호
var OT_SRC_DATE     = 5;   // E열: 등록날짜
var OT_SRC_NAME     = 6;   // F열: 이름
var OT_SRC_PHONE    = 7;   // G열: 번호
var OT_SRC_SPORT    = 8;   // H열: 종목
var OT_SRC_DURATION = 10;  // J열: 운동기간
var OT_SRC_REQUEST  = 11;  // K열: OT신청종목

// OT배정시트 컬럼 번호
var OT_DST_DATE     = 1;   // A열: 등록날짜
var OT_DST_SPORT    = 2;   // B열: 종목
var OT_DST_NAME     = 3;   // C열: 이름
var OT_DST_PHONE    = 4;   // D열: 연락처
var OT_DST_CATEGORY = 5;   // E열: OT신청종목
var OT_DST_DURATION = 6;   // F열: 운동기간
var OT_DST_TIME     = 7;   // G열: 운동시간 (수동)
var OT_DST_PURPOSE  = 8;   // H열: 운동목적 (수동)
var OT_DST_NOTES    = 9;   // I열: 특이사항 (수동)

// 유효한 OT 신청값
var OT_VALID_VALUES = ['헬스', '필라', '헬스,필라', '필라,헬스'];

// ═══════════════════════════════════════════════════════════
// 메인 함수 (설치형 트리거로 등록)
// ═══════════════════════════════════════════════════════════
function onEditOT(e) {
  try {
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();

    if (sheetName === OT_SOURCE_SHEET) {
      otHandleSourceEdit(e, sheet);
      return;
    }

    if (sheetName === OT_TARGET_SHEET) {
      otHandleTargetEdit(e, sheet);
      return;
    }
  } catch (err) {
    Logger.log('onEditOT 오류: ' + err.toString());
  }
}

// ═══════════════════════════════════════════════════════════
// FC,PT일지 K열 입력 → OT배정시트에 자동 행 추가
// K열 삭제 → OT배정시트에서 삭제
// K열 변경 → OT배정시트 업데이트
// ═══════════════════════════════════════════════════════════
function otHandleSourceEdit(e, sheet) {
  if (e.range.getColumn() !== OT_SRC_REQUEST) return;

  var row = e.range.getRow();
  if (row <= 1) return;

  var otValue = String(e.value || '').trim();

  // 값 삭제 시 → 색상 초기화 + OT배정에서도 삭제
  if (!otValue) {
    e.range.setBackground(null);
    var phone = String(sheet.getRange(row, OT_SRC_PHONE).getValue()).replace(/\D/g, '');
    if (phone) otRemoveFromSheet(e.source, phone);
    return;
  }

  var isValid = false;
  for (var i = 0; i < OT_VALID_VALUES.length; i++) {
    if (otValue === OT_VALID_VALUES[i]) { isValid = true; break; }
  }
  if (!isValid) {
    e.range.setBackground(null);
    return;
  }

  var name = sheet.getRange(row, OT_SRC_NAME).getValue();
  var rawPhone = sheet.getRange(row, OT_SRC_PHONE).getDisplayValue(); // 표시값 그대로 (0 유지)
  var phone = String(rawPhone).replace(/\D/g, '');
  // 앞자리 0이 빠진 경우 복구 (10자리이고 0으로 안 시작하면)
  if (phone.length === 10 && phone.charAt(0) !== '0') phone = '0' + phone;
  if (!name || !phone) return;

  var registeredAt = sheet.getRange(row, OT_SRC_DATE).getValue();
  var sportType = sheet.getRange(row, OT_SRC_SPORT).getValue();
  var duration = sheet.getRange(row, OT_SRC_DURATION).getValue();

  var ss = e.source;
  var otSheet = ss.getSheetByName(OT_TARGET_SHEET);

  if (!otSheet) {
    otSheet = ss.insertSheet(OT_TARGET_SHEET);
    otSheet.getRange(1, 1, 1, 9).setValues([[
      '등록날짜', '종목', '이름', '연락처', 'OT신청종목',
      '운동기간', '운동시간', '운동목적', '특이사항'
    ]]).setFontWeight('bold').setBackground('#f3f4f6');
  }

  // 기존 행 찾기 (같은 연락처)
  var existingRow = 0;
  if (otSheet.getLastRow() > 1) {
    var phones = otSheet.getRange(2, OT_DST_PHONE, otSheet.getLastRow() - 1, 1).getValues();
    for (var j = 0; j < phones.length; j++) {
      if (String(phones[j][0]).replace(/\D/g, '') === phone) {
        existingRow = j + 2;
        break;
      }
    }
  }

  if (existingRow > 0) {
    // 기존 행 업데이트 (종목 변경 등)
    otSheet.getRange(existingRow, OT_DST_DATE).setValue(registeredAt);
    otSheet.getRange(existingRow, OT_DST_SPORT).setValue(sportType);
    otSheet.getRange(existingRow, OT_DST_CATEGORY).setValue(otValue);
    otSheet.getRange(existingRow, OT_DST_DURATION).setValue(duration);
  } else {
    // 새 행 추가
    var newRow = otSheet.getLastRow() + 1;
    otSheet.getRange(newRow, OT_DST_DATE).setValue(registeredAt);
    otSheet.getRange(newRow, OT_DST_SPORT).setValue(sportType);
    otSheet.getRange(newRow, OT_DST_NAME).setValue(name);
    otSheet.getRange(newRow, OT_DST_PHONE).setValue(phone);
    otSheet.getRange(newRow, OT_DST_CATEGORY).setValue(otValue);
    otSheet.getRange(newRow, OT_DST_DURATION).setValue(duration);
    existingRow = newRow;
  }

  // OT종목 색상
  var catCell = otSheet.getRange(existingRow, OT_DST_CATEGORY);
  if (otValue.indexOf('헬스') !== -1 && otValue.indexOf('필라') !== -1) {
    catCell.setBackground('#dbeafe');
  } else if (otValue.indexOf('헬스') !== -1) {
    catCell.setBackground('#93c5fd');
  } else if (otValue.indexOf('필라') !== -1) {
    catCell.setBackground('#fde68a');
  }

  // 성공 표시
  e.range.setBackground('#d9ead3');
}

// ═══════════════════════════════════════════════════════════
// OT배정시트에서 수동 수정 → 운동시간(G열) 입력 시 Supabase 전송
// ═══════════════════════════════════════════════════════════
function otHandleTargetEdit(e, sheet) {
  var row = e.range.getRow();
  if (row <= 1) return;

  var name = sheet.getRange(row, OT_DST_NAME).getValue();
  var rawPhone = sheet.getRange(row, OT_DST_PHONE).getDisplayValue();
  var phone = String(rawPhone).replace(/\D/g, '');
  if (phone.length === 10 && phone.charAt(0) !== '0') phone = '0' + phone;
  var exerciseTime = sheet.getRange(row, OT_DST_TIME).getValue();

  // 운동시간이 입력되어야만 Supabase로 전송
  if (!name || !phone || !exerciseTime) return;

  otSendToSupabase(
    sheet.getRange(row, OT_DST_DATE).getValue(),
    sheet.getRange(row, OT_DST_SPORT).getValue(),
    name, phone,
    sheet.getRange(row, OT_DST_CATEGORY).getValue() || '',
    sheet.getRange(row, OT_DST_DURATION).getValue(),
    exerciseTime,
    sheet.getRange(row, OT_DST_PURPOSE).getValue(),
    sheet.getRange(row, OT_DST_NOTES).getValue()
  );

  // 성공 표시
  sheet.getRange(row, OT_DST_NAME).setBackground('#d9ead3');
}

// ═══════════════════════════════════════════════════════════
// Supabase 전송 공통 함수
// ═══════════════════════════════════════════════════════════
function otSendToSupabase(registeredAt, sportType, name, phone, otCategory, duration, exerciseTime, purpose, notes) {
  var data = {
    registered_at: otFormatDate(registeredAt),
    log_type: String(sportType) || 'FC',
    name: name,
    phone: String(phone).replace(/\D/g, ''),
    ot_category: String(otCategory),
    duration: String(duration),
    exercise_time: String(exerciseTime),
    purpose: String(purpose),
    notes: String(notes),
    ot_status: '신청'
  };

  try {
    var response = UrlFetchApp.fetch(OT_SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OT_SUPABASE_KEY
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    });

    var status = response.getResponseCode();
    if (status === 200 || status === 201) {
      Logger.log('Supabase 전송 성공: ' + name);
    } else {
      Logger.log('Supabase 전송 실패: ' + response.getContentText());
    }
  } catch (err) {
    Logger.log('Supabase 전송 오류: ' + err.toString());
  }
}

// ═══════════════════════════════════════════════════════════
// OT배정시트에서 해당 연락처 행 삭제
// ═══════════════════════════════════════════════════════════
function otRemoveFromSheet(ss, phone) {
  var otSheet = ss.getSheetByName(OT_TARGET_SHEET);
  if (!otSheet || otSheet.getLastRow() <= 1) return;

  var phones = otSheet.getRange(2, OT_DST_PHONE, otSheet.getLastRow() - 1, 1).getValues();
  for (var i = phones.length - 1; i >= 0; i--) {
    if (String(phones[i][0]).replace(/\D/g, '') === phone) {
      otSheet.deleteRow(i + 2);
    }
  }
}

// ── 날짜 포맷 헬퍼 ──
function otFormatDate(value) {
  if (!value) return null;
  var d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// ═══════════════════════════════════════════════════════════
// ★ 트리거 설치 (1회만 실행)
// ═══════════════════════════════════════════════════════════
function setupOtTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditOT') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditOT')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  Logger.log('OT 트리거 설치 완료!');
}

// ── 권한 요청용 (1회 실행 후 삭제 가능) ──
function requestPermission() {
  var response = UrlFetchApp.fetch('https://httpbin.org/get');
  Logger.log('권한 성공: ' + response.getResponseCode());
}
