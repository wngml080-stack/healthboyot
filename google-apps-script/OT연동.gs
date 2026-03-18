// ═══════════════════════════════════════════════════════════
// OT 연동 전용 코드 (기존 Code.gs와 분리)
// ═══════════════════════════════════════════════════════════
// 파일: OT연동.gs
// 트리거: onEditOT (별도 설치형 트리거로 등록)
// ═══════════════════════════════════════════════════════════

// ── 설정값 ────────────────────────────────────────────────
var OT_SUPABASE_URL = 'https://nwyxawtqpdqbsqkpjucu.supabase.co/functions/v1/sync-member';
var OT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXhhd3RxcGRxYnNxa3BqdWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDk5ODMsImV4cCI6MjA4OTI4NTk4M30.2I4Nr9t_6sf5OLyHTax-mPhi5E7ZDm3pNgdU5tNbTO8';

var OT_SOURCE_SHEET = 'FC,PT일지';   // 일지 시트 이름
var OT_TARGET_SHEET = 'OT배정';       // OT배정 시트 이름

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

    // FC,PT일지에서 K열 수정 → OT배정시트에 자동 복사
    if (sheetName === OT_SOURCE_SHEET) {
      otHandleSourceEdit(e, sheet);
      return;
    }

    // OT배정시트에서 수정 → Supabase 전송
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
// ═══════════════════════════════════════════════════════════
function otHandleSourceEdit(e, sheet) {
  // K열이 아니면 무시
  if (e.range.getColumn() !== OT_SRC_REQUEST) return;

  var row = e.range.getRow();
  if (row <= 1) return;

  var otValue = String(e.value || '').trim();

  // 유효한 값인지 확인
  var isValid = false;
  for (var i = 0; i < OT_VALID_VALUES.length; i++) {
    if (otValue === OT_VALID_VALUES[i]) { isValid = true; break; }
  }
  if (!isValid) return;

  // 원본 데이터 읽기
  var name = sheet.getRange(row, OT_SRC_NAME).getValue();
  var phone = String(sheet.getRange(row, OT_SRC_PHONE).getValue()).replace(/\D/g, '');
  if (!name || !phone) return;

  var registeredAt = sheet.getRange(row, OT_SRC_DATE).getValue();
  var sportType = sheet.getRange(row, OT_SRC_SPORT).getValue();
  var duration = sheet.getRange(row, OT_SRC_DURATION).getValue();

  // OT배정시트 가져오기 (없으면 생성)
  var ss = e.source;
  var otSheet = ss.getSheetByName(OT_TARGET_SHEET);

  if (!otSheet) {
    otSheet = ss.insertSheet(OT_TARGET_SHEET);
    otSheet.getRange(1, 1, 1, 9).setValues([[
      '등록날짜', '종목', '이름', '연락처', 'OT신청종목',
      '운동기간', '운동시간', '운동목적', '특이사항'
    ]]).setFontWeight('bold').setBackground('#f3f4f6');
  }

  // 중복 체크 (같은 연락처)
  if (otSheet.getLastRow() > 1) {
    var phones = otSheet.getRange(2, OT_DST_PHONE, otSheet.getLastRow() - 1, 1).getValues();
    for (var j = 0; j < phones.length; j++) {
      if (String(phones[j][0]).replace(/\D/g, '') === phone) {
        e.range.setBackground('#fff2cc'); // 노란색 = 중복
        return;
      }
    }
  }

  // 새 행 추가
  var newRow = otSheet.getLastRow() + 1;
  otSheet.getRange(newRow, OT_DST_DATE).setValue(registeredAt);
  otSheet.getRange(newRow, OT_DST_SPORT).setValue(sportType);
  otSheet.getRange(newRow, OT_DST_NAME).setValue(name);
  otSheet.getRange(newRow, OT_DST_PHONE).setValue(phone);
  otSheet.getRange(newRow, OT_DST_CATEGORY).setValue(otValue);
  otSheet.getRange(newRow, OT_DST_DURATION).setValue(duration);

  // OT종목 색상
  var catCell = otSheet.getRange(newRow, OT_DST_CATEGORY);
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
// OT배정시트에서 수정 → Supabase에 전송
// ═══════════════════════════════════════════════════════════
function otHandleTargetEdit(e, sheet) {
  var row = e.range.getRow();
  if (row <= 1) return;

  // 필수값 확인
  var otCategory = sheet.getRange(row, OT_DST_CATEGORY).getValue();
  var name = sheet.getRange(row, OT_DST_NAME).getValue();
  var phone = String(sheet.getRange(row, OT_DST_PHONE).getValue()).replace(/\D/g, '');
  if (!name || !phone || !otCategory) return;

  var data = {
    registered_at: otFormatDate(sheet.getRange(row, OT_DST_DATE).getValue()),
    log_type: String(sheet.getRange(row, OT_DST_SPORT).getValue()) || 'FC',
    name: name,
    phone: phone,
    ot_category: String(otCategory),
    duration: String(sheet.getRange(row, OT_DST_DURATION).getValue()),
    exercise_time: String(sheet.getRange(row, OT_DST_TIME).getValue()),
    purpose: String(sheet.getRange(row, OT_DST_PURPOSE).getValue()),
    notes: String(sheet.getRange(row, OT_DST_NOTES).getValue()),
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

    if (response.getResponseCode() === 200 || response.getResponseCode() === 201) {
      sheet.getRange(row, OT_DST_NAME).setBackground('#d9ead3'); // 연두색 = 성공
    } else {
      sheet.getRange(row, OT_DST_NAME).setBackground('#f4cccc'); // 빨간색 = 실패
      Logger.log('OT Sync 실패: ' + response.getContentText());
    }
  } catch (err) {
    sheet.getRange(row, OT_DST_NAME).setBackground('#f4cccc');
    Logger.log('OT Sync 오류: ' + err.toString());
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
  // 기존 onEditOT 트리거 제거
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditOT') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 새 트리거 등록
  ScriptApp.newTrigger('onEditOT')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  Logger.log('OT 트리거 설치 완료!');
}
