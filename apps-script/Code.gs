/**
 * 경향신문 설문·신청 공통 접수 창구 (kh-forms)
 * - 구글시트에 연결된 Apps Script에 붙여 넣고 '웹 앱'으로 배포합니다.
 * - 페이지가 보낸 formId 별로 시트 탭을 자동으로 만들고, 들어온 항목대로 열을 만듭니다.
 * - 새 설문을 추가할 때는 아래 FORMS 에 한 줄만 추가하면 됩니다.
 */

const FORMS = {
  'finance-class': {
    title: '찾아가는 금융교실 신청',
    prefix: 'FIN',                         // 접수번호 머리글 → FIN-2026-0001
    notify: ['visionmaker@khan.kr'],       // 새 신청 알림 받을 메일 (여러 명 가능)
    confirmField: '이메일',                 // 신청자에게 확인 메일 보낼 항목 이름 (없으면 '')
    manageCols: ['진행상태', '확정일자', '배정강사', '신복위전달', '담당메모'],
    replyName: '경향신문 열린경제교육프로젝트',
    contact: '02-3701-1601~2'
  }
  // 'musical-2027': { title: '경향뮤지컬콩쿠르 설문', prefix: 'MUS', notify: [...], confirmField: '이메일', manageCols: ['진행상태','메모'], replyName: '경향뮤지컬콩쿠르', contact: '...' },
};

const BASE_COLS = ['접수번호', '접수일시'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse(e.postData.contents);
    const formId = String(body.formId || '');
    const cfg = FORMS[formId];
    if (!cfg) return json({ ok: false, error: '등록되지 않은 설문입니다.' });

    const data = sanitize(body.data || {});
    const sheet = getSheet(formId, cfg);
    const receiptNo = nextReceiptNo(sheet, cfg.prefix);
    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

    // 머리글: 기본열 + 데이터 항목 + 관리열. 새 항목이 오면 관리열 앞에 끼워 넣음
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Object.keys(data).forEach(k => {
      if (headers.indexOf(k) === -1) {
        const insertAt = headers.indexOf(cfg.manageCols[0]);
        if (insertAt === -1) {
          sheet.getRange(1, headers.length + 1).setValue(k);
        } else {
          sheet.insertColumnBefore(insertAt + 1);
          sheet.getRange(1, insertAt + 1).setValue(k);
        }
        styleHeader(sheet, cfg);
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
    });

    const row = headers.map(h => {
      if (h === '접수번호') return receiptNo;
      if (h === '접수일시') return now;
      if (h === '진행상태') return '접수';
      return data[h] !== undefined ? data[h] : '';
    });
    sheet.appendRow(row);

    notifyAdmin(cfg, receiptNo, data);
    if (cfg.confirmField && data[cfg.confirmField]) sendConfirm(cfg, receiptNo, data);

    return json({ ok: true, receiptNo: receiptNo });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: '서버 처리 중 오류가 발생했습니다.' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, message: 'kh-forms 접수 창구가 동작 중입니다.' });
}

/* ---------- 시트 ---------- */

function getSheet(formId, cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(formId);
  if (!sh) {
    sh = ss.insertSheet(formId);
    sh.getRange(1, 1, 1, BASE_COLS.length + cfg.manageCols.length)
      .setValues([BASE_COLS.concat(cfg.manageCols)]);
    styleHeader(sh, cfg);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);
    // 진행상태 드롭다운
    const statusCol = BASE_COLS.length + cfg.manageCols.indexOf('진행상태') + 1;
    if (cfg.manageCols.indexOf('진행상태') > -1) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['접수', '확인중', '일정확정', '교육완료', '취소'], true).build();
      sh.getRange(2, statusCol, 1000, 1).setDataValidation(rule);
    }
  }
  return sh;
}

function styleHeader(sh, cfg) {
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  sh.getRange(1, 1, 1, lastCol).setFontWeight('bold').setFontColor('#ffffff').setBackground('#14325c');
  headers.forEach((h, i) => {
    if (cfg.manageCols.indexOf(h) > -1) sh.getRange(1, i + 1).setBackground('#0f8a7e'); // 관리열은 초록
  });
}

function nextReceiptNo(sheet, prefix) {
  const year = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy');
  const props = PropertiesService.getScriptProperties();
  const key = 'seq_' + prefix + '_' + year;
  const n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  return prefix + '-' + year + '-' + ('000' + n).slice(-4);
}

/* ---------- 메일 ---------- */

function notifyAdmin(cfg, receiptNo, data) {
  if (!cfg.notify || !cfg.notify.length) return;
  const rows = Object.keys(data).map(k =>
    '<tr><th style="text-align:left;padding:6px 10px;background:#f4f6f9;border:1px solid #dfe4ea">' + esc(k) +
    '</th><td style="padding:6px 10px;border:1px solid #dfe4ea">' + esc(data[k]) + '</td></tr>').join('');
  MailApp.sendEmail({
    to: cfg.notify.join(','),
    subject: '[' + cfg.title + '] 새 접수 ' + receiptNo + ' - ' + (data['기관명'] || data['이름'] || ''),
    htmlBody: '<p><b>' + esc(cfg.title) + '</b> 새 접수가 들어왔습니다.</p><p>접수번호: <b>' + receiptNo + '</b></p>' +
      '<table style="border-collapse:collapse;font-size:14px">' + rows + '</table>' +
      '<p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">시트에서 보기</a></p>'
  });
}

function sendConfirm(cfg, receiptNo, data) {
  const to = data[cfg.confirmField];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;
  const who = data['담당자'] || data['이름'] || '신청자';
  MailApp.sendEmail({
    to: to,
    name: cfg.replyName,
    replyTo: cfg.notify && cfg.notify[0],
    subject: '[' + cfg.title + '] 신청이 접수되었습니다 (' + receiptNo + ')',
    htmlBody:
      '<div style="font-family:sans-serif;font-size:15px;line-height:1.7">' +
      '<p>' + esc(who) + '님, 안녕하세요.</p>' +
      '<p><b>' + esc(cfg.title) + '</b> 신청이 정상적으로 접수되었습니다.</p>' +
      '<p style="font-size:18px">접수번호 <b>' + receiptNo + '</b></p>' +
      '<p>신청 내용을 확인한 뒤 담당자가 연락드려 일정을 확정하겠습니다.<br>문의: ' + esc(cfg.contact) + '</p>' +
      '<p style="color:#5b6675">' + esc(cfg.replyName) + '</p></div>'
  });
}

/* ---------- 유틸 ---------- */

function sanitize(obj) {
  const out = {};
  Object.keys(obj).slice(0, 80).forEach(k => {
    let v = String(obj[k] == null ? '' : obj[k]).slice(0, 3000);
    if (/^[=+\-@]/.test(v)) v = "'" + v;   // 시트 수식 주입 방지
    out[String(k).slice(0, 60)] = v;
  });
  return out;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 배포 전에 한 번 실행해서 권한 승인 + 시트 탭 생성 확인용 */
function testSetup() {
  const sh = getSheet('finance-class', FORMS['finance-class']);
  Logger.log('시트 준비 완료: ' + sh.getName());
}
