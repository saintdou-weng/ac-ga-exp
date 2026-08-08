/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP Platform · shared/ga-core.js   v2.0
   共用核心：設定 / GAS 客戶端 / 三語 i18n / 本地日期 / 期間控制 /
             雲端同步 / Toast / 表格 / 圖表登錄
   ─────────────────────────────────────────────────────────────────
   設計原則：
   · 純 ES5+ 無建置，<script src="shared/ga-core.js"> 即可用
   · 離線或本檔載入失敗時，各頁面須自行 fallback（見 GA.ready）
   · 所有日期一律 local getter，禁用 toISOString()（跨日錯誤）
   · 每週一律「週一 → 週日」
   · Bot Token 絕不落地瀏覽器，Telegram 一律經 GAS 轉發
   ════════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var GA = global.GA = global.GA || {};
GA.VERSION = '2.0';

/* ═══════════════════ 1. 設定 Config ═══════════════════ */
var CFG_KEY = 'ac_ga_exp_config';
var LANG_KEY = 'ac_ga_exp_lang';
var DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbxPTXdEhjb4vhAxO-fQYYLnt_m4BZNkVsPiYVmyUzA-kxgr_b4VMC9yayXQCOS7xYYWAQ/exec';

function validLang(l) { return l === 'zh' || l === 'en' || l === 'km'; }
function storedLang() {
  var c = GA.cfg();
  var shared = '';
  try { shared = localStorage.getItem(LANG_KEY) || localStorage.getItem('vrt_dsl_lang') || ''; } catch (e) {}
  return validLang(c.lang) ? c.lang : (validLang(shared) ? shared : 'zh');
}

GA.cfg = function () {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); }
  catch (e) { return {}; }
};
GA.saveCfg = function (patch) {
  var c = GA.cfg();
  for (var k in patch) if (patch.hasOwnProperty(k)) c[k] = patch[k];
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  return c;
};
GA.gasUrl = function () {
  var u = (GA.cfg().gasUrl || '').trim();
  return u || DEFAULT_GAS;
};
GA.DEFAULT_GAS = DEFAULT_GAS;

/* 平台 session token（由 GAS 簽發，含效期；非權限本身，僅供後端驗證） */
GA.session = function () { return (GA.cfg().session || ''); };
GA.setSession = function (t) { GA.saveCfg({ session: t }); };

/* ═══════════════════ 2. GAS 客戶端 ═══════════════════
   統一回應信封：{ok,data,error,code,ts,revision}
   先 text() 再安全解析——GAS 出錯時會回 HTML 錯誤頁，
   直接 .json() 會拋出無意義的 SyntaxError。            */
function parseEnvelope(raw) {
  var t = String(raw || '').trim();
  if (!t) throw new Error('Empty response from GAS');
  if (t.charAt(0) === '<') {
    var m = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    throw new Error('GAS 回傳 HTML 錯誤頁' + (m ? '：' + m[1].trim() : '（可能未部署或權限不足）'));
  }
  var d;
  try { d = JSON.parse(t); }
  catch (e) { throw new Error('GAS 回應非 JSON：' + t.slice(0, 120)); }
  if (d && d.ok === false) {
    var err = new Error(d.error || d.msg || 'GAS error');
    err.code = d.code; err.payload = d;
    throw err;
  }
  return d;
}

GA.gasGet = function (action, params) {
  var url = GA.gasUrl() + '?action=' + encodeURIComponent(action);
  params = params || {};
  for (var k in params) {
    if (!params.hasOwnProperty(k)) continue;
    var v = params[k];
    if (v === undefined || v === null || v === '') continue;
    url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }
  var s = GA.session(); if (s) url += '&session=' + encodeURIComponent(s);
  return fetch(url).then(function (r) { return r.text(); }).then(parseEnvelope);
};

GA.gasPost = function (action, payload, extra) {
  var body = { action: action, data: payload };
  if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) body[k] = extra[k];
  var s = GA.session(); if (s) body.session = s;
  return fetch(GA.gasUrl(), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }   // 避免 CORS preflight
  }).then(function (r) { return r.text(); }).then(parseEnvelope);
};

/* ═══════════════════ 3. 三語 i18n ═══════════════════ */
GA.lang = storedLang();

/* 平台共用字典（各模組再用 GA.addDict 疊加自己的） */
var DICT = {
  zh: {
    up: '上傳', down: '下載', imp: '智慧匯入', exp: '匯出', tg: 'Telegram',
    home: '首頁', settings: '設定', search: '搜尋', filter: '篩選', reset: '重設',
    day: '日', week: '週', month: '月', year: '年', today: '今天', period: '期間',
    prev: '前一期', next: '後一期', all: '全部', dept: '部門', status: '狀態',
    total: '總計', pending: '待審', approved: '已核可', rejected: '已退件',
    returned: '已退回', draft: '草稿', submitted: '已送出', verified: '已審查',
    voided: '已作廢', urgent: '緊急', amount: '金額', qty: '數量', date: '日期',
    noData: '目前沒有資料', loading: '載入中…', saving: '儲存中…',
    cloudIdle: '未連線', cloudSync: '同步中…', cloudUp: '上傳成功',
    cloudDown: '下載成功', cloudErr: '連線失敗', cloudConflict: '版本衝突',
    confirm: '確認', cancel: '取消', close: '關閉', save: '儲存', del: '刪除',
    edit: '編輯', add: '新增', records: '筆', page: '頁', of: '/',
    lastSync: '最後同步', never: '尚未同步', rows: '列', preview: '預覽'
  },
  en: {
    up: 'Upload', down: 'Download', imp: 'Smart Import', exp: 'Export', tg: 'Telegram',
    home: 'Home', settings: 'Settings', search: 'Search', filter: 'Filter', reset: 'Reset',
    day: 'Day', week: 'Week', month: 'Month', year: 'Year', today: 'Today', period: 'Period',
    prev: 'Previous', next: 'Next', all: 'All', dept: 'Dept', status: 'Status',
    total: 'Total', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    returned: 'Returned', draft: 'Draft', submitted: 'Submitted', verified: 'Verified',
    voided: 'Voided', urgent: 'Urgent', amount: 'Amount', qty: 'Qty', date: 'Date',
    noData: 'No data available', loading: 'Loading…', saving: 'Saving…',
    cloudIdle: 'Not connected', cloudSync: 'Syncing…', cloudUp: 'Upload OK',
    cloudDown: 'Download OK', cloudErr: 'Connection failed', cloudConflict: 'Version conflict',
    confirm: 'Confirm', cancel: 'Cancel', close: 'Close', save: 'Save', del: 'Delete',
    edit: 'Edit', add: 'Add', records: 'records', page: 'Page', of: '/',
    lastSync: 'Last sync', never: 'Never synced', rows: 'rows', preview: 'Preview'
  },
  km: {
    up: 'ផ្ទុកឡើង', down: 'ទាញយក', imp: 'នាំចូលឆ្លាតវៃ', exp: 'នាំចេញ', tg: 'Telegram',
    home: 'ទំព័រដើម', settings: 'ការកំណត់', search: 'ស្វែងរក', filter: 'តម្រង', reset: 'កំណត់ឡើងវិញ',
    day: 'ថ្ងៃ', week: 'សប្តាហ៍', month: 'ខែ', year: 'ឆ្នាំ', today: 'ថ្ងៃនេះ', period: 'រយៈពេល',
    prev: 'មុន', next: 'បន្ទាប់', all: 'ទាំងអស់', dept: 'ផ្នែក', status: 'ស្ថានភាព',
    total: 'សរុប', pending: 'រង់ចាំ', approved: 'អនុម័ត', rejected: 'បដិសេធ',
    returned: 'ត្រឡប់', draft: 'ព្រាង', submitted: 'បានដាក់ស្នើ', verified: 'បានពិនិត្យ',
    voided: 'បានលុបចោល', urgent: 'បន្ទាន់', amount: 'ចំនួនទឹកប្រាក់', qty: 'បរិមាណ', date: 'កាលបរិច្ឆេទ',
    noData: 'មិនមានទិន្នន័យ', loading: 'កំពុងផ្ទុក…', saving: 'កំពុងរក្សាទុក…',
    cloudIdle: 'មិនបានតភ្ជាប់', cloudSync: 'កំពុងធ្វើសមកាលកម្ម…', cloudUp: 'ផ្ទុកឡើងជោគជ័យ',
    cloudDown: 'ទាញយកជោគជ័យ', cloudErr: 'ការតភ្ជាប់បរាជ័យ', cloudConflict: 'ជម្លោះកំណែ',
    confirm: 'បញ្ជាក់', cancel: 'បោះបង់', close: 'បិទ', save: 'រក្សាទុក', del: 'លុប',
    edit: 'កែសម្រួល', add: 'បន្ថែម', records: 'កំណត់ត្រា', page: 'ទំព័រ', of: '/',
    lastSync: 'សមកាលកម្មចុងក្រោយ', never: 'មិនទាន់សមកាលកម្ម', rows: 'ជួរ', preview: 'មើលជាមុន'
  }
};

GA.addDict = function (extra) {
  ['zh', 'en', 'km'].forEach(function (l) {
    if (!extra[l]) return;
    for (var k in extra[l]) if (extra[l].hasOwnProperty(k)) DICT[l][k] = extra[l][k];
  });
};

/* T(key) — 找不到時退回中文，再退回 key 本身（永不顯示 undefined） */
GA.T = function (k) {
  var d = DICT[GA.lang] || DICT.zh;
  if (d[k] !== undefined) return d[k];
  if (DICT.zh[k] !== undefined) return DICT.zh[k];
  return k;
};

/* 套用語言：處理 data-t（內文）、data-t-title（tooltip）、data-t-ph（placeholder） */
GA.applyLang = function (root) {
  root = root || document;
  root.querySelectorAll('[data-t]').forEach(function (el) {
    el.textContent = GA.T(el.getAttribute('data-t'));
  });
  root.querySelectorAll('[data-t-title]').forEach(function (el) {
    el.setAttribute('title', GA.T(el.getAttribute('data-t-title')));
  });
  root.querySelectorAll('[data-t-ph]').forEach(function (el) {
    el.setAttribute('placeholder', GA.T(el.getAttribute('data-t-ph')));
  });
  root.querySelectorAll('[data-lg]').forEach(function (b) {
    b.classList.toggle('on', b.getAttribute('data-lg') === GA.lang);
  });
  document.documentElement.setAttribute('lang',
    GA.lang === 'zh' ? 'zh-TW' : GA.lang === 'km' ? 'km' : 'en');
};

GA.setLang = function (l) {
  if (!validLang(l)) l = 'zh';
  if (GA.lang === l) {
    GA.applyLang();
    return GA.lang;
  }
  GA.lang = l;
  GA.saveCfg({ lang: l });
  try {
    localStorage.setItem(LANG_KEY, l);
    // Keep the legacy fuel key in sync so old cached pages do not revert language.
    localStorage.setItem('vrt_dsl_lang', l);
  } catch (e) {}
  GA.applyLang();
  GA.emit('lang', l);
  return GA.lang;
};

// Keep already-open tabs synchronized without allowing a stale module default
// to overwrite the platform language on the next render.
if (global.addEventListener) global.addEventListener('storage', function (e) {
  if (e.key === LANG_KEY && validLang(e.newValue) && e.newValue !== GA.lang) GA.setLang(e.newValue);
});

/* i18n 完整性檢查（開發用：GA.i18nAudit() 會列出缺漏 key） */
GA.i18nAudit = function () {
  var miss = { en: [], km: [] };
  Object.keys(DICT.zh).forEach(function (k) {
    if (DICT.en[k] === undefined) miss.en.push(k);
    if (DICT.km[k] === undefined) miss.km.push(k);
  });
  var hard = [];
  document.querySelectorAll('button,th,label,option,h1,h2,h3').forEach(function (el) {
    if (el.hasAttribute('data-t')) return;
    var t = (el.textContent || '').trim();
    if (t && /[\u4e00-\u9fff]/.test(t) && t.length < 30) hard.push(t);
  });
  return { missing: miss, hardcodedZh: Array.from(new Set(hard)) };
};

/* ═══════════════════ 4. 事件匯流排 ═══════════════════ */
var BUS = {};
GA.on = function (evt, fn) { (BUS[evt] = BUS[evt] || []).push(fn); };
GA.emit = function (evt, payload) {
  (BUS[evt] || []).forEach(function (fn) {
    try { fn(payload); } catch (e) { console.error('[GA.' + evt + ']', e); }
  });
};

/* ═══════════════════ 5. 本地日期工具（禁用 toISOString）═══════════════════ */
function p2(n) { return String(n).padStart(2, '0'); }

GA.ymd = function (d) {
  d = d || new Date();
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
};
GA.parseYMD = function (s) {
  var m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);   // local midnight，不跨時區
};
/* Excel serial date → 'YYYY-MM-DD'（用 UTC getter 讀 serial，避免本地時區偏移） */
GA.excelDate = function (v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return GA.ymd(v);
  if (typeof v === 'number' && isFinite(v)) {
    if (v < 1 || v > 60000) return '';
    var d = new Date(Math.round((v - 25569) * 86400000));
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);          // DD/MM/YYYY
  if (m) return m[3] + '-' + p2(+m[2]) + '-' + p2(+m[1]);
  var d2 = new Date(s);
  return isNaN(d2) ? '' : GA.ymd(d2);
};

/* 週一為一週之始 */
GA.weekStart = function (d) {
  d = new Date(d || new Date());
  var day = d.getDay();                  // 0=Sun
  var diff = (day === 0 ? -6 : 1 - day); // 回推到週一
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
GA.weekEnd = function (d) {
  var s = GA.weekStart(d); s.setDate(s.getDate() + 6); return s;
};
/* ISO 週序（顯示用） */
GA.isoWeek = function (d) {
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  var wk1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - wk1) / 86400000 - 3 + ((wk1.getDay() + 6) % 7)) / 7);
};

/* 期間 key：日=YYYY-MM-DD 週=YYYY-Www 月=YYYY-MM 年=YYYY */
GA.periodKey = function (dateStr, type) {
  var d = GA.parseYMD(dateStr);
  if (!d) return '';
  if (type === 'day') return GA.ymd(d);
  if (type === 'week') { var ws = GA.weekStart(d); return ws.getFullYear() + '-W' + p2(GA.isoWeek(ws)); }
  if (type === 'month') return d.getFullYear() + '-' + p2(d.getMonth() + 1);
  return String(d.getFullYear());
};
GA.periodLabel = function (key, type) {
  if (!key) return '—';
  var L = GA.lang;
  if (type === 'day') {
    var d = GA.parseYMD(key); if (!d) return key;
    var wd = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
    var wz = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return key + (L === 'zh' ? '（週' + wz + '）' : ' (' + wd + ')');
  }
  if (type === 'week') {
    var m = key.match(/^(\d{4})-W(\d+)$/); if (!m) return key;
    var r = GA.weekRange(key);
    var w = L === 'zh' ? '第' + (+m[2]) + '週' : L === 'km' ? 'សប្តាហ៍ ' + (+m[2]) : 'W' + (+m[2]);
    return m[1] + ' ' + w + (r ? '（' + r.start + ' ~ ' + r.end + '）' : '');
  }
  if (type === 'month') {
    var mm = key.match(/^(\d{4})-(\d{2})$/); if (!mm) return key;
    var EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return L === 'zh' ? mm[1] + '年' + (+mm[2]) + '月'
         : L === 'km' ? mm[1] + ' ខែ' + (+mm[2])
         : EN[+mm[2] - 1] + ' ' + mm[1];
  }
  return L === 'zh' ? key + '年' : L === 'km' ? 'ឆ្នាំ ' + key : key;
};
/* 週 key → 實際起訖日 */
GA.weekRange = function (key) {
  var m = String(key).match(/^(\d{4})-W(\d+)$/); if (!m) return null;
  var jan4 = new Date(+m[1], 0, 4);
  var ws = GA.weekStart(jan4);
  ws.setDate(ws.getDate() + (+m[2] - 1) * 7);
  var we = new Date(ws); we.setDate(we.getDate() + 6);
  return { start: GA.ymd(ws), end: GA.ymd(we), startDate: ws, endDate: we };
};
/* 期間位移：dir = -1 / +1 */
GA.shiftPeriod = function (key, type, dir) {
  if (type === 'day') {
    var d = GA.parseYMD(key) || new Date();
    d.setDate(d.getDate() + dir); return GA.ymd(d);
  }
  if (type === 'week') {
    var r = GA.weekRange(key);
    var b = r ? r.startDate : GA.weekStart(new Date());
    b.setDate(b.getDate() + dir * 7);
    return b.getFullYear() + '-W' + p2(GA.isoWeek(b));
  }
  if (type === 'month') {
    var mm = String(key).match(/^(\d{4})-(\d{2})$/);
    var y = mm ? +mm[1] : new Date().getFullYear();
    var mo = (mm ? +mm[2] - 1 : new Date().getMonth()) + dir;
    var d2 = new Date(y, mo, 1);
    return d2.getFullYear() + '-' + p2(d2.getMonth() + 1);
  }
  return String((parseInt(key, 10) || new Date().getFullYear()) + dir);
};
GA.currentPeriod = function (type) { return GA.periodKey(GA.ymd(new Date()), type); };
/* 某日期是否落在指定期間內 */
GA.inPeriod = function (dateStr, key, type) {
  if (!key || key === 'ALL') return true;
  return GA.periodKey(dateStr, type) === key;
};

/* ═══════════════════ 5b. 未來日期偵測 ═══════════════════
   實務問題：Excel 誤植或手誤，會出現「超過今天」的記錄
   （例如 8 月卻有 9 月的柴油紀錄），彙總時會被算進去而不自知。
   規則：日期 > 今天 → 標記為異常，摘要中獨立列出要求確認。      */
GA.isFuture = function (dateStr) {
  var d = GA.parseYMD(dateStr);
  if (!d) return false;
  var today = new Date(); today.setHours(23, 59, 59, 999);
  return d.getTime() > today.getTime();
};
/* 從一批記錄挑出未來日期者
   rows: 記錄陣列; field: 日期欄位名或取值函式（預設 'date'） */
GA.futureRecords = function (rows, field) {
  var f = field || 'date';
  return (rows || []).filter(function (r) {
    var v = (typeof f === 'function') ? f(r) : r[f];
    return GA.isFuture(v);
  });
};
/* 產生「未來日期」警示文字（給摘要用；無異常回空字串）*/
GA.futureWarnText = function (rows, field, lang) {
  var fut = GA.futureRecords(rows, field);
  if (!fut.length) return '';
  var L = lang || GA.lang;
  var f = field || 'date';
  var title = L === 'en' ? '⚠️ FUTURE-DATED records (please verify)'
            : L === 'km' ? '⚠️ កាលបរិច្ឆេទអនាគត (សូមផ្ទៀងផ្ទាត់)'
            : '⚠️ 日期超過今天，請確認 Future-dated';
  var lines = fut.slice(0, 6).map(function (r) {
    var v = (typeof f === 'function') ? f(r) : r[f];
    var who = r.plate || r.driver || r.item || r.itemName || r.category || r.unit || '';
    return '  • ' + v + (who ? ' · ' + who : '');
  });
  return '\n' + title + '（' + fut.length + '）\n' + lines.join('\n') +
    (fut.length > 6 ? '\n  … +' + (fut.length - 6) : '');
};

/* ═══════════════════ 6. 期間控制列 PeriodControl ═══════════════════
   每個分頁各自保有狀態，切換分頁不互相覆蓋。
   用法：
     var pc = GA.periodControl('#pc-join', {
       id:'join', type:'month',
       dates:function(){ return rows.map(r=>r.date) },
       onChange:function(st){ render() }
     });
     pc.state() → {type,key}                                        */
var PC_STATE = {};
GA.periodControl = function (sel, opt) {
  var host = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!host) return null;
  opt = opt || {};
  var id = opt.id || (host.id || 'pc') + '_' + Math.random().toString(36).slice(2, 6);

  if (!PC_STATE[id]) {
    PC_STATE[id] = { type: opt.type || 'month', key: GA.currentPeriod(opt.type || 'month') };
  }
  var st = PC_STATE[id];

  function availableKeys() {
    var ds = [];
    try { ds = (opt.dates ? opt.dates() : []) || []; } catch (e) { ds = []; }
    var set = {};
    ds.forEach(function (d) { var k = GA.periodKey(d, st.type); if (k) set[k] = 1; });
    return Object.keys(set).sort().reverse();
  }

  function render() {
    var keys = availableKeys();
    // 目前 key 不在清單中仍保留（讓使用者能停在空期間並看到 empty state）
    var opts = keys.slice();
    if (opts.indexOf(st.key) < 0) opts.unshift(st.key);

    var types = ['day', 'week', 'month', 'year'];
    host.innerHTML =
      '<div class="ga-pc">' +
        '<button class="ga-pc-nav" data-act="prev" title="' + GA.T('prev') + '">◀</button>' +
        '<button class="ga-pc-today" data-act="today">' + GA.T('today') + '</button>' +
        '<div class="ga-pc-seg">' +
          types.map(function (t) {
            return '<button class="ga-pc-t' + (t === st.type ? ' on' : '') + '" data-type="' + t + '">' + GA.T(t) + '</button>';
          }).join('') +
        '</div>' +
        '<select class="ga-pc-sel">' +
          opts.map(function (k) {
            return '<option value="' + k + '"' + (k === st.key ? ' selected' : '') + '>' + GA.periodLabel(k, st.type) + '</option>';
          }).join('') +
        '</select>' +
        (st.type === 'day'
          ? '<input type="date" class="ga-pc-date" value="' + st.key + '">'
          : '<input type="month" class="ga-pc-date" value="' + (st.type === 'month' ? st.key : st.key.slice(0, 4) + '-01') + '"' + (st.type === 'month' ? '' : ' style="display:none"') + '>') +
        '<button class="ga-pc-nav" data-act="next" title="' + GA.T('next') + '">▶</button>' +
        '<span class="ga-pc-lbl">' + GA.periodLabel(st.key, st.type) + '</span>' +
      '</div>';

    host.querySelectorAll('[data-type]').forEach(function (b) {
      b.onclick = function () {
        var anchor = st.type === 'day' ? st.key
          : st.type === 'week' ? (GA.weekRange(st.key) || {}).start
          : st.type === 'month' ? st.key + '-01' : st.key + '-01-01';
        st.type = b.getAttribute('data-type');
        st.key = GA.periodKey(anchor || GA.ymd(new Date()), st.type) || GA.currentPeriod(st.type);
        fire();
      };
    });
    host.querySelector('[data-act="prev"]').onclick = function () { st.key = GA.shiftPeriod(st.key, st.type, -1); fire(); };
    host.querySelector('[data-act="next"]').onclick = function () { st.key = GA.shiftPeriod(st.key, st.type, 1); fire(); };
    host.querySelector('[data-act="today"]').onclick = function () { st.key = GA.currentPeriod(st.type); fire(); };
    host.querySelector('.ga-pc-sel').onchange = function () { st.key = this.value; fire(); };
    var dt = host.querySelector('.ga-pc-date');
    if (dt) dt.onchange = function () {
      if (!this.value) return;
      st.key = GA.periodKey(st.type === 'day' ? this.value : this.value + '-01', st.type);
      fire();
    };
  }

  function fire() { render(); if (opt.onChange) opt.onChange({ type: st.type, key: st.key }); }

  render();
  GA.on('lang', render);
  return {
    state: function () { return { type: st.type, key: st.key }; },
    set: function (type, key) { if (type) st.type = type; if (key) st.key = key; fire(); },
    refresh: render,
    filter: function (rows, dateField) {
      var f = dateField || 'date';
      return (rows || []).filter(function (r) {
        return GA.inPeriod(typeof f === 'function' ? f(r) : r[f], st.key, st.type);
      });
    }
  };
};

/* ═══════════════════ 7. 雲端同步指示器 ═══════════════════
   六種狀態：idle / sync / up / down / err / conflict            */
GA.cloud = {
  el: null,
  mount: function (sel) {
    this.el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    this.set('idle');
    return this;
  },
  set: function (state, detail) {
    if (!this.el) return;
    var map = {
      idle:     { i: '○', t: GA.T('cloudIdle'),     c: 'idle' },
      sync:     { i: '◐', t: GA.T('cloudSync'),     c: 'sync' },
      up:       { i: '●', t: GA.T('cloudUp'),       c: 'ok' },
      down:     { i: '●', t: GA.T('cloudDown'),     c: 'ok' },
      err:      { i: '✕', t: GA.T('cloudErr'),      c: 'err' },
      conflict: { i: '⚠', t: GA.T('cloudConflict'), c: 'warn' }
    };
    var m = map[state] || map.idle;
    this.el.className = 'ga-cloud ' + m.c;
    this.el.innerHTML = '<span class="ga-cloud-dot">' + m.i + '</span>' +
      '<span class="ga-cloud-txt">' + m.t + (detail ? ' · ' + GA.esc(detail) : '') + '</span>';
    this.el.setAttribute('title', m.t + (detail ? ' — ' + detail : ''));
  },
  /* 上傳：先比對雲端 revision，較新時要求確認，不靜默覆蓋 */
  upload: function (key, data, opt) {
    opt = opt || {};
    var self = this;
    self.set('sync');
    return GA.gasPost(key + 'Save', data, { revision: opt.revision, force: opt.force ? 1 : 0 })
      .then(function (r) {
        if (r.code === 'CONFLICT') {
          self.set('conflict', r.data && r.data.cloudTs);
          return r;
        }
        self.set('up', (r.data && r.data.rows !== undefined ? r.data.rows + ' ' + GA.T('records') : '') || r.ts);
        GA.saveCfg((function () { var o = {}; o['sync_' + key] = r.ts; return o; })());
        return r;
      })
      .catch(function (e) { self.set('err', e.message); throw e; });
  },
  download: function (key) {
    var self = this;
    self.set('sync');
    return GA.gasGet(key + 'Load')
      .then(function (r) {
        self.set('down', r.ts);
        return r;
      })
      .catch(function (e) { self.set('err', e.message); throw e; });
  }
};

/* ═══════════════════ 8. Toast / 確認視窗 ═══════════════════ */
GA.toast = function (msg, type) {
  var t = document.getElementById('ga-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ga-toast';
    document.body.appendChild(t);
  }
  t.className = 'ga-toast show ' + (type || '');
  t.textContent = msg;
  clearTimeout(t._tm);
  t._tm = setTimeout(function () { t.className = 'ga-toast ' + (type || ''); }, 3200);
};

GA.confirm = function (msg, title) {
  return new Promise(function (resolve) {
    var ov = document.createElement('div');
    ov.className = 'ga-ov on';
    ov.innerHTML =
      '<div class="ga-modal" style="max-width:400px">' +
        '<div class="ga-modal-h"><b>' + GA.esc(title || GA.T('confirm')) + '</b></div>' +
        '<div class="ga-modal-b" style="font-size:13px;line-height:1.8">' + GA.esc(msg).replace(/\n/g, '<br>') + '</div>' +
        '<div class="ga-modal-f">' +
          '<button class="ga-btn" data-r="0">' + GA.T('cancel') + '</button>' +
          '<button class="ga-btn primary" data-r="1">' + GA.T('confirm') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-r]').forEach(function (b) {
      b.onclick = function () { ov.remove(); resolve(b.getAttribute('data-r') === '1'); };
    });
    ov.onclick = function (e) { if (e.target === ov) { ov.remove(); resolve(false); } };
  });
};

/* ═══════════════════ 9. 工具 ═══════════════════ */
GA.esc = function (v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
GA.num = function (v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/[^\d.\-]/g, ''));
  return isFinite(n) ? n : 0;
};
GA.money = function (v, dp) {
  return '$' + GA.num(v).toLocaleString(undefined, {
    minimumFractionDigits: dp || 0, maximumFractionDigits: dp === undefined ? 0 : dp
  });
};
/* 安全除法：分母為 0 或資料不足時回 null，呼叫端顯示「資料不足」而非 Infinity */
GA.ratio = function (a, b) {
  a = GA.num(a); b = GA.num(b);
  if (!b) return null;
  var r = a / b;
  return isFinite(r) ? r : null;
};
GA.fmtRatio = function (v, unit, dp) {
  if (v === null || v === undefined) {
    return GA.lang === 'zh' ? '資料不足' : GA.lang === 'km' ? 'ទិន្នន័យមិនគ្រប់គ្រាន់' : 'Insufficient data';
  }
  return v.toFixed(dp === undefined ? 2 : dp) + (unit ? ' ' + unit : '');
};
GA.uid = function (prefix) {
  return (prefix || 'r') + '_' + Date.now().toString(36) + '_' +
    Math.random().toString(36).slice(2, 8);
};
/* 指紋：用於去重（穩定、可重現，不用隨機 ID） */
GA.fingerprint = function (parts) {
  var s = (parts || []).map(function (x) {
    return String(x === null || x === undefined ? '' : x).trim().toLowerCase();
  }).join('|');
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
  return 'fp' + h.toString(36) + '_' + s.length.toString(36);
};

/* canonical record 共用欄位 */
GA.stamp = function (rec, meta) {
  meta = meta || {};
  var now = GA.ymd(new Date()) + ' ' + new Date().toTimeString().slice(0, 8);
  rec.recordId     = rec.recordId || GA.uid(meta.prefix || 'rec');
  rec.source       = rec.source || meta.source || 'online';
  rec.sourceFile   = rec.sourceFile || meta.sourceFile || '';
  rec.sourceSheet  = rec.sourceSheet || meta.sourceSheet || '';
  rec.sourceRow    = rec.sourceRow !== undefined ? rec.sourceRow : (meta.sourceRow !== undefined ? meta.sourceRow : '');
  rec.importBatchId= rec.importBatchId || meta.importBatchId || '';
  rec.createdAt    = rec.createdAt || now;
  rec.updatedAt    = now;
  rec.version      = (rec.version || 0) + 1;
  return rec;
};

/* 狀態代碼 ↔ 顯示（資料庫一律存代碼，畫面才翻譯） */
GA.STATUS = ['draft', 'submitted', 'verified', 'approved', 'returned', 'rejected', 'voided'];
GA.statusLabel = function (code) {
  var c = GA.normStatus(code);
  return GA.T(c) || c;
};
/* 舊資料相容：中文/英文混存 → 統一代碼 */
GA.normStatus = function (v) {
  var s = String(v || '').trim().toLowerCase();
  if (!s) return 'draft';
  if (GA.STATUS.indexOf(s) >= 0) return s;
  var map = {
    '待審核': 'submitted', '待審': 'submitted', 'pending': 'submitted',
    '已核可': 'approved', 'approved': 'approved', '核可': 'approved',
    '已退件': 'rejected', 'rejected': 'rejected', '退件': 'rejected',
    '已退回': 'returned', 'returned': 'returned', '退回': 'returned',
    '已審查': 'verified', 'verified': 'verified',
    '已送出': 'submitted', 'submitted': 'submitted',
    '草稿': 'draft', 'draft': 'draft',
    '已作廢': 'voided', 'voided': 'voided', 'void': 'voided'
  };
  return map[s] || map[String(v).trim()] || 'draft';
};
GA.statusBadge = function (code) {
  var c = GA.normStatus(code);
  var cls = { approved: 'ok', verified: 'info', submitted: 'warn', draft: 'mute',
              returned: 'warn', rejected: 'bad', voided: 'mute' }[c] || 'mute';
  var ic = { approved: '✅', verified: '🔎', submitted: '⏳', draft: '📝',
             returned: '↩', rejected: '❌', voided: '🚫' }[c] || '';
  return '<span class="ga-badge ' + cls + '">' + ic + ' ' + GA.esc(GA.statusLabel(c)) + '</span>';
};

/* ═══════════════════ 10. 表格：排序 / 搜尋 / 分頁 ═══════════════════ */
GA.table = function (sel, opt) {
  var host = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!host) return null;
  opt = opt || {};
  var st = { sort: opt.sort || null, dir: 1, page: 1, size: opt.size || 20, q: '' };
  var rows = [];

  function view() {
    var out = rows;
    if (st.q) {
      var q = st.q.toLowerCase();
      out = out.filter(function (r) {
        return opt.cols.some(function (c) {
          return String(c.val ? c.val(r) : r[c.k] || '').toLowerCase().indexOf(q) >= 0;
        });
      });
    }
    if (st.sort) {
      var col = opt.cols.filter(function (c) { return c.k === st.sort; })[0];
      if (col) out = out.slice().sort(function (a, b) {
        var x = col.val ? col.val(a) : a[col.k], y = col.val ? col.val(b) : b[col.k];
        if (col.num) { x = GA.num(x); y = GA.num(y); return (x - y) * st.dir; }
        return String(x || '').localeCompare(String(y || '')) * st.dir;
      });
    }
    return out;
  }

  function render() {
    var all = view();
    var pages = Math.max(1, Math.ceil(all.length / st.size));
    if (st.page > pages) st.page = pages;
    var slice = all.slice((st.page - 1) * st.size, st.page * st.size);

    if (!rows.length) {
      host.innerHTML = '<div class="ga-empty"><div class="ga-empty-i">📭</div><div>' + GA.T('noData') + '</div></div>';
      return;
    }
    host.innerHTML =
      '<div class="ga-tbl-bar">' +
        '<input class="ga-tbl-q" placeholder="' + GA.T('search') + '…" value="' + GA.esc(st.q) + '">' +
        '<span class="ga-tbl-n">' + all.length + ' ' + GA.T('records') + '</span>' +
        '<select class="ga-tbl-size">' + [20, 50, 100].map(function (n) {
          return '<option value="' + n + '"' + (n === st.size ? ' selected' : '') + '>' + n + ' / ' + GA.T('page') + '</option>';
        }).join('') + '</select>' +
      '</div>' +
      '<div class="ga-tbl-scroll"><table class="ga-tbl"><thead><tr>' +
        opt.cols.map(function (c) {
          var on = st.sort === c.k ? ' class="on"' : '';
          return '<th' + on + ' data-k="' + c.k + '">' + GA.esc(c.t ? GA.T(c.t) : c.label || c.k) +
                 (st.sort === c.k ? (st.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>';
        }).join('') +
      '</tr></thead><tbody>' +
        (slice.length ? slice.map(function (r, i) {
          return '<tr' + (opt.rowClick ? ' class="clk" data-i="' + i + '"' : '') + '>' +
            opt.cols.map(function (c) {
              var v = c.html ? c.html(r) : GA.esc(c.val ? c.val(r) : r[c.k]);
              return '<td' + (c.num ? ' class="n"' : '') + '>' + (v === '' || v === undefined ? '—' : v) + '</td>';
            }).join('') + '</tr>';
        }).join('') : '<tr><td colspan="' + opt.cols.length + '" class="ga-empty-td">' + GA.T('noData') + '</td></tr>') +
      '</tbody></table></div>' +
      (pages > 1 ? '<div class="ga-pg">' +
        '<button data-p="1">«</button><button data-p="' + Math.max(1, st.page - 1) + '">‹</button>' +
        '<span>' + st.page + ' ' + GA.T('of') + ' ' + pages + '</span>' +
        '<button data-p="' + Math.min(pages, st.page + 1) + '">›</button><button data-p="' + pages + '">»</button>' +
      '</div>' : '');

    host.querySelectorAll('th[data-k]').forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-k');
        if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; }
        render();
      };
    });
    var qi = host.querySelector('.ga-tbl-q');
    if (qi) qi.oninput = function () { st.q = this.value; st.page = 1; render(); var n = host.querySelector('.ga-tbl-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
    var sz = host.querySelector('.ga-tbl-size');
    if (sz) sz.onchange = function () { st.size = +this.value; st.page = 1; render(); };
    host.querySelectorAll('[data-p]').forEach(function (b) {
      b.onclick = function () { st.page = +b.getAttribute('data-p'); render(); };
    });
    if (opt.rowClick) host.querySelectorAll('tr.clk').forEach(function (tr) {
      tr.onclick = function () { opt.rowClick(slice[+tr.getAttribute('data-i')]); };
    });
  }

  return {
    data: function (d) { rows = d || []; st.page = 1; render(); },
    render: render,
    rows: function () { return view(); }
  };
};

/* ═══════════════════ 11. 圖表登錄（切換期間必先 destroy）═══════════════════ */
var CHARTS = {};
GA.chart = function (canvasId, config) {
  if (typeof Chart === 'undefined') return null;
  var cv = document.getElementById(canvasId);
  if (!cv) return null;
  if (CHARTS[canvasId]) { try { CHARTS[canvasId].destroy(); } catch (e) {} delete CHARTS[canvasId]; }
  try { CHARTS[canvasId] = new Chart(cv.getContext('2d'), config); }
  catch (e) { console.error('[GA.chart]', canvasId, e); return null; }
  return CHARTS[canvasId];
};
GA.destroyCharts = function () {
  Object.keys(CHARTS).forEach(function (k) { try { CHARTS[k].destroy(); } catch (e) {} delete CHARTS[k]; });
};
GA.PALETTE = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
              '#f97316', '#6366f1', '#84cc16', '#ec4899', '#06b6d4', '#a3a3a3'];

/* ═══════════════════ 12. CDN 檢查 ═══════════════════ */
GA.checkCDN = function () {
  var miss = [];
  if (typeof XLSX === 'undefined') miss.push('SheetJS (Excel 匯入匯出)');
  if (typeof Chart === 'undefined') miss.push('Chart.js (圖表)');
  if (miss.length) {
    var bar = document.createElement('div');
    bar.className = 'ga-cdn-warn';
    bar.innerHTML = '⚠️ 下列元件載入失敗，相關功能暫停但其餘仍可使用：<b>' +
      miss.join('、') + '</b>　請檢查網路或改用可連外的裝置。';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  return miss;
};

/* ═══════════════════ 13. 頁首工具列 ═══════════════════
   統一產生：首頁 / 模組名 / 雲端狀態 / 上傳 / 下載 / Telegram /
             智慧匯入 / 匯出 / 三語                                   */
GA.header = function (sel, opt) {
  var host = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!host) return null;
  opt = opt || {};
  var svgUp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>';
  var svgDn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>';

  host.innerHTML =
    '<div class="ga-hd">' +
      '<a class="ga-hd-home" href="index.html" data-t-title="home" title="' + GA.T('home') + '">🏠</a>' +
      '<div class="ga-hd-id">' +
        '<div class="ga-hd-name">' + GA.esc(opt.icon || '') + ' ' + GA.esc(opt.name || '') + '</div>' +
        '<div class="ga-hd-ver">AC-GA-EXP ' + GA.esc(opt.version || 'v2.0') + '</div>' +
      '</div>' +
      '<div class="ga-cloud idle" id="ga-cloud"></div>' +
      '<div class="ga-hd-tools">' +
        (opt.cloud !== false ?
          '<button class="ga-ico sky" id="ga-btn-up"   data-t-title="up"   title="' + GA.T('up') + '">' + svgUp + '<span data-t="up">' + GA.T('up') + '</span></button>' +
          '<button class="ga-ico sky" id="ga-btn-down" data-t-title="down" title="' + GA.T('down') + '">' + svgDn + '<span data-t="down">' + GA.T('down') + '</span></button>' : '') +
        (opt.telegram !== false ?
          '<button class="ga-ico ind" id="ga-btn-tg" data-t-title="tg" title="Telegram">✈️<span>Telegram</span></button>' : '') +
        (opt.import !== false ?
          '<button class="ga-ico" id="ga-btn-imp" data-t-title="imp" title="' + GA.T('imp') + '">📥<span data-t="imp">' + GA.T('imp') + '</span></button>' : '') +
        (opt.export !== false ?
          '<button class="ga-ico" id="ga-btn-exp" data-t-title="exp" title="' + GA.T('exp') + '">📤<span data-t="exp">' + GA.T('exp') + '</span></button>' : '') +
        '<div class="ga-lang">' +
          '<button data-lg="zh" class="' + (GA.lang === 'zh' ? 'on' : '') + '">繁中</button>' +
          '<button data-lg="en" class="' + (GA.lang === 'en' ? 'on' : '') + '">EN</button>' +
          '<button data-lg="km" class="' + (GA.lang === 'km' ? 'on' : '') + '">ខ្មែរ</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  GA.cloud.mount('#ga-cloud');
  var last = GA.cfg()['sync_' + (opt.cloudKey || '')];
  if (last) GA.cloud.set('idle', GA.T('lastSync') + ' ' + last);

  host.querySelectorAll('[data-lg]').forEach(function (b) {
    b.onclick = function () { GA.setLang(b.getAttribute('data-lg')); };
  });
  function bind(id, fn) { var e = document.getElementById(id); if (e && fn) e.onclick = fn; }
  bind('ga-btn-up', opt.onUpload);
  bind('ga-btn-down', opt.onDownload);
  bind('ga-btn-tg', opt.onTelegram);
  bind('ga-btn-imp', opt.onImport);
  bind('ga-btn-exp', opt.onExport);

  GA.on('lang', function () {
    GA.applyLang(host);
    host.querySelectorAll('[data-lg]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lg') === GA.lang);
    });
  });
  return host;
};

/* ═══════════════════ 14. 就緒 ═══════════════════ */
GA.ready = true;
GA.boot = function (opt) {
  GA.applyLang();
  GA.checkCDN();
  if (opt && opt.header) GA.header(opt.header.sel || '#ga-header', opt.header);
};

})(window);
