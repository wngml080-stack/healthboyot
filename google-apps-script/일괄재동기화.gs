// ═══════════════════════════════════════════════════════════
// OT배정 시트 전체 재동기화 (1회 실행)
// ═══════════════════════════════════════════════════════════
function resyncAllToSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var otSheet = ss.getSheetByName('OT배정');

  if (!otSheet || otSheet.getLastRow() <= 1) {
    Logger.log('OT배정 시트에 데이터가 없습니다');
    return;
  }

  var lastRow = otSheet.getLastRow();
  var data = otSheet.getRange(2, 1, lastRow - 1, 9).getValues();

  var success = 0;
  var fail = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var name = row[2];     // C열: 이름
    var phone = String(row[3]).replace(/\D/g, ''); // D열: 연락처

    // 전화번호 앞자리 0 복구
    if (phone.length === 10 && phone.charAt(0) !== '0') phone = '0' + phone;

    if (!name || !phone) continue;

    var registeredAt = row[0]; // A열: 등록날짜
    var sportType = row[1];    // B열: 종목
    var otCategory = row[4];   // E열: OT신청종목
    var duration = row[5];     // F열: 운동기간
    var exerciseTime = row[6]; // G열: 운동시간
    var purpose = row[7];      // H열: 운동목적
    var notes = row[8];        // I열: 특이사항

    try {
      otSendToSupabase(
        registeredAt,
        sportType,
        name,
        phone,
        String(otCategory),
        String(duration),  // 텍스트 그대로 전송
        String(exerciseTime),
        String(purpose),
        String(notes)
      );
      success++;

      // API 호출 간격 (rate limit 방지)
      Utilities.sleep(200);
    } catch (err) {
      Logger.log('실패: ' + name + ' - ' + err.toString());
      fail++;
    }
  }

  Logger.log('재동기화 완료! 성공: ' + success + '건, 실패: ' + fail + '건');
  SpreadsheetApp.getUi().alert('재동기화 완료!\n성공: ' + success + '건\n실패: ' + fail + '건');
}
