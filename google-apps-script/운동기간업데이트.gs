// ═══════════════════════════════════════════════════════════
// 운동기간만 Supabase에 업데이트 (전화번호 기준)
// ═══════════════════════════════════════════════════════════
function updateDurationOnly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var otSheet = ss.getSheetByName('OT배정');

  if (!otSheet || otSheet.getLastRow() <= 1) {
    Logger.log('OT배정 시트에 데이터가 없습니다');
    return;
  }

  var SUPABASE_URL = 'https://nwyxawtqpdqbsqkpjucu.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXhhd3RxcGRxYnNxa3BqdWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDk5ODMsImV4cCI6MjA4OTI4NTk4M30.2I4Nr9t_6sf5OLyHTax-mPhi5E7ZDm3pNgdU5tNbTO8';

  var lastRow = otSheet.getLastRow();
  var data = otSheet.getRange(2, 3, lastRow - 1, 4).getValues(); // C~F열: 이름, 연락처, OT종목, 운동기간

  var success = 0;
  var fail = 0;
  var skip = 0;

  for (var i = 0; i < data.length; i++) {
    var name = data[i][0];           // C열: 이름
    var rawPhone = String(data[i][1]); // D열: 연락처
    var duration = String(data[i][3]); // F열: 운동기간

    var phone = rawPhone.replace(/\D/g, '');
    if (phone.length === 10 && phone.charAt(0) !== '0') phone = '0' + phone;

    if (!phone || !duration || duration === 'undefined' || duration === '') {
      skip++;
      continue;
    }

    try {
      // Supabase REST API로 직접 UPDATE (전화번호 기준)
      var response = UrlFetchApp.fetch(
        SUPABASE_URL + '/rest/v1/members?phone=eq.' + phone,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'apikey': SUPABASE_KEY,
            'Prefer': 'return=minimal'
          },
          payload: JSON.stringify({
            duration_months: duration.trim()
          }),
          muteHttpExceptions: true
        }
      );

      var status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        success++;
      } else {
        Logger.log('실패 (' + status + '): ' + name + ' ' + phone + ' → ' + response.getContentText());
        fail++;
      }

      Utilities.sleep(100);
    } catch (err) {
      Logger.log('에러: ' + name + ' - ' + err.toString());
      fail++;
    }
  }

  Logger.log('운동기간 업데이트 완료! 성공: ' + success + ', 실패: ' + fail + ', 건너뜀: ' + skip);
  SpreadsheetApp.getUi().alert('운동기간 업데이트 완료!\n성공: ' + success + '건\n실패: ' + fail + '건\n건너뜀: ' + skip + '건');
}
