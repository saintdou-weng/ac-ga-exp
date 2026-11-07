/* DEL-GUARD BEGIN — 人按刪除才要 Paul 核可 v2.0（2026-11-07）
 * 共用於 VRT HR、HRA-PAY、HRA Portal、GASCheck、GA-EXP、VRT ERP；原始檔在 psjhr/tools/del-guard.js，各平台貼在第一個載入的 js 最前面。
 * v1.0（11/6）把正常同步也當成刪除、一直私訊 Paul，11/7 停用；v2.0 照 Paul 的規則重做：
 *  1) 只攔「有人按了刪除」：刪除類動作（delete、deleteBatch、warnDelete、img_del、hr_photo_del…）
 *     且在按鍵／確認視窗 8 秒內送出。系統匯入、同步、重新匯入（hr_drop／erp_drop）、整理區塊、自動去重一律不攔。
 *  2) 私訊 Paul 一則：哪個平台哪一頁、誰按的、要刪哪幾筆（姓名／工號／房號／日期），附核可連結（按鈕＋文字連結）。
 *  3) Paul 在 VRT HR 核可頁按 ✅ → 這台裝置自動把那次刪除重送出去；按 ❌ → 雲端保留。
 *  4) 等核可期間，那幾筆的「刪除記號」不會被同步上雲（雲端保留原資料）。
 */
(function (g) {
  'use strict';
  if (g.__delGuard) return; g.__delGuard = 2;
  var doc = g.document;
  var PSJHR_GAS = 'https://script.google.com/macros/s/AKfycbx9Pdt5vu_AcTHCrlLH4lcVONXS_VoE47SEjDUn7Iv27C2CRgoADRLpalVIJQHWBcqK/exec';
  var PSJHR_KEY = '12345';
  var APPROVE_PAGE = 'https://saintdou-weng.github.io/psjhr/#delok/';
  var path = String(g.location && g.location.pathname || '');
  var PLAT = /ac-hra-pay/i.test(path) ? 'HRA-PAY' : /ac-hra-portal/i.test(path) ? 'HRA Portal' : /ac-gascheck/i.test(path) ? 'GASCheck' : /ac-ga-exp/i.test(path) ? 'GA-EXP' : /psjerp/i.test(path) ? 'VRT ERP' : /psjhr/i.test(path) ? 'VRT HR' : (g.location && g.location.hostname || 'web');
  var PAGE = (path.split('/').pop() || 'index.html') + (g.location && g.location.hash ? g.location.hash.split('?')[0].slice(0, 30) : '');
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  var realFetch = g.fetch ? g.fetch.bind(g) : null;
  if (!realFetch) return;
  /* v1 留下的待核可紀錄與提示全部清掉 */
  try { ['dg_req_v1', 'dg_man_v1'].forEach(function (k) { localStorage.removeItem(k); }); } catch (_) {}

  /* ---------- 人是不是剛按了東西（按鍵、確認視窗）---------- */
  var lastUser = 0;
  function markUser() { lastUser = Date.now(); }
  if (doc) { doc.addEventListener('click', markUser, true); doc.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') markUser(); }, true); doc.addEventListener('touchend', markUser, true); }
  if (typeof g.confirm === 'function') { var rc = g.confirm.bind(g); g.confirm = function (m) { var r = rc(m); if (r) markUser(); return r; }; }
  function byUser() { return Date.now() - lastUser < 8000; }

  /* ---------- 小工具 ---------- */
  function hash(s) { var h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); }
  function parseBody(b) {
    if (b == null) return {};
    try {
      if (typeof b === 'string') { var s = b.trim(); if (s[0] === '{') return JSON.parse(s); var o = {}; new URLSearchParams(s).forEach(function (v, k) { o[k] = v; }); if (o.payload) { try { return JSON.parse(o.payload); } catch (_) {} } return o; }
      if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) { var o2 = {}; b.forEach(function (v, k) { o2[k] = v; }); if (o2.payload) { try { return JSON.parse(o2.payload); } catch (_) {} } return o2; }
      if (typeof FormData !== 'undefined' && b instanceof FormData) { var o3 = {}; b.forEach(function (v, k) { if (typeof v === 'string') o3[k] = v; }); if (o3.payload) { try { return JSON.parse(o3.payload); } catch (_) {} } return o3; }
    } catch (_) {}
    return {};
  }
  function queryOf(url) { var o = {}; try { new URL(url, g.location.href).searchParams.forEach(function (v, k) { o[k] = v; }); } catch (_) {} return o; }
  function isGas(url) { return /script\.google(usercontent)?\.com\/macros\//.test(url); }
  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); } catch (_) { return ''; } }
  function nowTxt() { var d = new Date(); function p(n) { return ('0' + n).slice(-2); } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  /* ---------- 只認「刪除類」動作；hr_drop／erp_drop 是重新匯入時的替換，不算 ---------- */
  var USER_DEL = /^(delete|deletebatch|deleterecord|deleterow|tempdelete|warndelete|voidpo|recordarchive|img_del|hr_photo_del|remove|removerecord|purge|wipe)$/i;
  function idsOf(p) {
    var out = [];
    ['id', 'recordId', 'rowId', 'sk', 'key', 'no', 'empId', 'employeeId'].forEach(function (k) { if (p[k] != null && p[k] !== '' && typeof p[k] !== 'object') out.push(String(p[k])); });
    ['ids', 'keys', 'rows', 'items'].forEach(function (k) { var v = p[k]; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = v.split(','); } } if (Array.isArray(v)) v.forEach(function (x) { out.push(String(x && typeof x === 'object' ? (x.id || x.key || x.sk || '') : x)); }); });
    return out.filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; });
  }

  /* ---------- 找出要刪的是誰／什麼（從頁面已載入的資料找）---------- */
  var NAME_KEYS = ['name', 'empName', 'employeeName', 'fullName', 'title', 'item', 'itemName', 'location'];
  var ID_KEYS = ['idNo', 'employeeId', 'empId', 'empNo', 'staffId', 'code', 'poNo', 'style'];
  var MORE_KEYS = ['roomNo', 'room', 'department', 'dept', 'type', 'reason', 'amount'];
  var DATE_KEYS = ['date', 'period', 'month', 'issueDate', 'createdAt', 'timestamp'];
  function summarize(r) {
    if (!r || typeof r !== 'object') return '';
    var bits = [];
    function first(keys) { for (var i = 0; i < keys.length; i++) { var v = r[keys[i]]; if (v != null && v !== '' && typeof v !== 'object') return String(v).slice(0, 40); } return ''; }
    var n = first(NAME_KEYS), id = first(ID_KEYS), more = first(MORE_KEYS), dt = first(DATE_KEYS);
    if (n) bits.push(n); if (id && id !== n) bits.push(id); if (more) bits.push(more); if (dt) bits.push(dt.slice(0, 10));
    return bits.join(' · ');
  }
  function findLocal(ids) {
    var want = {}; ids.forEach(function (x) { want[x] = 1; });
    var found = {}, roots = [];
    try { if (g.state && typeof g.state.db === 'function') roots.push(g.state.db()); } catch (_) {}
    ['DB', 'STATE', 'S', 'DATA', 'APP'].forEach(function (k) { try { if (g[k] && typeof g[k] === 'object') roots.push(g[k]); } catch (_) {} });
    var seen = 0;
    roots.forEach(function (root) {
      Object.keys(root).forEach(function (k) {
        var arr = root[k]; if (!Array.isArray(arr)) return;
        for (var i = 0; i < arr.length && seen < 200000; i++, seen++) {
          var r = arr[i]; if (!r || typeof r !== 'object') continue;
          var rid = String(r.id || r._id || r.key || r._k || r.sk || '');
          if (rid && want[rid] && !found[rid]) found[rid] = summarize(r);
        }
      });
    });
    return found;
  }
  function describe(p, ids) {
    var loc = findLocal(ids), lines = [];
    ids.forEach(function (id) { lines.push(loc[id] ? loc[id] : '（編號 ' + id + '）'); });
    if (!ids.length) { var s = summarize(p); lines.push(s || '（沒有帶編號）'); }
    return lines;
  }

  /* ---------- 誰按的：每台裝置第一次刪除時問一次名字 ---------- */
  function who() {
    var w = LS.get('dg_who', '');
    if (!w) { try { w = (g.prompt && g.prompt('刪除要 Paul 核可，請輸入你的名字（之後這台裝置不會再問）\nYour name (asked once on this device):', '') || '').trim(); } catch (_) { w = ''; } if (w) LS.set('dg_who', w); }
    return w || ('未具名裝置 ' + (LS.get('dg_dev', '') || (function () { var d = Math.random().toString(36).slice(2, 6).toUpperCase(); LS.set('dg_dev', d); return d; })()));
  }

  /* ---------- 判斷 ---------- */
  function classify(url, method, p) {
    var a = String(p.action || p.type || p.op || '').trim();
    if (!a || !USER_DEL.test(a)) return null;
    if (!byUser()) return null;                                   // 不是人按的（自動去重、排程、同步）→ 不攔
    var tool = String(p.tool || p.module || p.sheet || '');
    var ids = idsOf(p);
    var sig = hash(PLAT + '|' + a + '|' + tool + '|' + ids.slice().sort().join(',') + '|' + (ids.length ? '' : JSON.stringify(p).slice(0, 300)));
    return { sig: sig, action: a, tool: tool, ids: ids };
  }

  /* ---------- 核可狀態：讀 VRT HR 雲端設定裡 Paul 的決定 ---------- */
  var OK = LS.get('dg_ok_v1', { at: 0, map: {} });
  var refreshing = null;
  function refreshOK(force) {
    if (!force && Date.now() - (OK.at || 0) < 90000) return Promise.resolve(OK.map);
    if (refreshing) return refreshing;
    refreshing = realFetch(PSJHR_GAS + '?k=' + PSJHR_KEY + '&action=hr_get&key=config&offset=0&limit=5', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var rows = (j && j.rows) || []; var map = {};
      rows.forEach(function (a) { var data = Array.isArray(a) ? a[3] : a && a.data; try { var c = JSON.parse(data || '{}'); if (c && c.delok) map = c.delok; } catch (_) {} });
      OK = { at: Date.now(), map: map }; LS.set('dg_ok_v1', OK); return map;
    }).catch(function () { return OK.map; }).then(function (m) { refreshing = null; settle(); return m; });
    return refreshing;
  }
  var REQ = LS.get('dg_req_v2', {});   // sig → {at, ids, tool, action, url, method, body, who, items}
  function saveReq() { var cut = Date.now() - 30 * 864e5; Object.keys(REQ).forEach(function (k) { if ((REQ[k].at || 0) < cut) delete REQ[k]; }); LS.set('dg_req_v2', REQ); }
  function pendingIds() { var s = {}; Object.keys(REQ).forEach(function (k) { var d = OK.map[k]; if (d && d.st === 'ok') return; (REQ[k].ids || []).forEach(function (id) { s[id] = 1; }); }); return s; }

  /* 核可了 → 把當時那次刪除重送；不核可 → 留著（刪除記號一直不上雲） */
  function settle() {
    Object.keys(REQ).forEach(function (sig) {
      var r = REQ[sig], d = OK.map[sig];
      if (!d || d.st !== 'ok' || r.replayed) return;
      r.replayed = Date.now(); saveReq();
      var init = { method: r.method || 'POST', redirect: 'follow' }; if (r.body != null && init.method !== 'GET') { init.body = r.body; init.headers = { 'Content-Type': r.ct || 'text/plain;charset=utf-8' }; }
      realFetch(r.url, init).then(function () { delete REQ[sig]; saveReq(); banner(); }).catch(function () { r.replayed = 0; saveReq(); });
    });
    banner();
  }

  function ask(c, url, method, body) {
    var items = describe(c.p || {}, c.ids), by = who(), at = nowTxt();
    var sb = null, ct = 'text/plain;charset=utf-8';
    if (typeof body === 'string') sb = body;
    else if (body != null && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) { sb = body.toString(); ct = 'application/x-www-form-urlencoded'; }
    else if (body != null && typeof FormData !== 'undefined' && body instanceof FormData) { var u = new URLSearchParams(); body.forEach(function (v, k) { if (typeof v === 'string') u.append(k, v); }); sb = u.toString(); ct = 'application/x-www-form-urlencoded'; }
    else if (body != null) sb = JSON.stringify(c.p);
    REQ[c.sig] = { at: Date.now(), ids: c.ids, tool: c.tool, action: c.action, url: url, method: method, body: sb, ct: ct, who: by, items: items };
    saveReq();
    var w = by + ' 要刪 ' + items.length + ' 筆：' + items.slice(0, 4).join('；') + (items.length > 4 ? '…' : '');
    var info = { sig: c.sig, p: PLAT, pg: PAGE, a: c.action, t: c.tool, w: w.slice(0, 200), at: at };
    var link = APPROVE_PAGE + b64(JSON.stringify(info));
    var text = '🗑 刪除申請（要你核可）\n' +
      '平台：' + PLAT + '（' + PAGE + '）\n' +
      '誰按的：' + by + '\n' +
      '時間：' + at + '\n' +
      '要刪 ' + items.length + ' 筆：\n' + items.slice(0, 15).map(function (x) { return '• ' + x; }).join('\n') + (items.length > 15 ? '\n…另 ' + (items.length - 15) + ' 筆' : '') +
      '\n\n核可前雲端資料保留不動。打開下面連結按 ✅ 核可／❌ 不核可：\n' + link;
    realFetch(PSJHR_GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'psjhr', k: PSJHR_KEY, action: 'hr_tg', to: 'paul', text: text, buttons: [[['✅／❌ 打開核可', link]]] }) }).catch(function () {});
    try { (g.toast || g.showToast || function (m) { console.warn(m); })('🗑 已送 Paul 核可，核可後自動刪除；核可前雲端保留'); } catch (_) {}
  }
  function fakeResponse(c, st) {
    var msg = st === 'no' ? 'Paul 不核可刪除，雲端資料保留' : '刪除要 Paul 核可（已私訊），核可後自動刪除；核可前雲端保留';
    var body = JSON.stringify({ ok: false, success: false, pendingApproval: true, approval: st || 'pending', error: msg, message: msg, msg: msg, sig: c.sig });
    try { return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }); } catch (_) { return { ok: true, status: 200, json: function () { return Promise.resolve(JSON.parse(body)); }, text: function () { return Promise.resolve(body); } }; }
  }

  /* ---------- 等核可期間：同步上傳時，把那幾筆的刪除記號先拿掉（雲端保留原資料）---------- */
  function stripPending(p) {
    var pend = pendingIds(); if (!Object.keys(pend).length) return null;
    var changed = false;
    function fix(b) {
      if (!b || typeof b !== 'object') return;
      ['records', 'rows', 'items'].forEach(function (k) {
        if (!Array.isArray(b[k])) return;
        var keep = b[k].filter(function (r) { var del = r && (r._deleted === true || r._deleted === 'true' || r.deleted === true); var id = r && String(r.id || r._id || r.key || r._k || ''); return !(del && pend[id]); });
        if (keep.length !== b[k].length) { b[k] = keep; changed = true; if (b.count != null) b.count = keep.length; }
      });
    }
    if (Array.isArray(p.buckets)) p.buckets.forEach(fix); else fix(p);
    return changed ? p : null;
  }

  /* ---------- 畫面提示（只算真的有人按刪除、還沒核可的）---------- */
  function banner() {
    if (!doc || !doc.body) return;
    var pend = Object.keys(REQ).filter(function (k) { var d = OK.map[k]; return !d || d.st !== 'ok'; });
    var el = doc.getElementById('dg-banner');
    if (!pend.length) { if (el) el.remove(); return; }
    if (!el) { el = doc.createElement('div'); el.id = 'dg-banner'; el.style.cssText = 'position:fixed;left:8px;bottom:62px;z-index:2147482999;max-width:min(520px,calc(100vw - 16px));background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-radius:12px;padding:8px 10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15)'; doc.body.appendChild(el); el.onclick = function () { el.style.display = 'none'; setTimeout(function () { el.style.display = ''; }, 600000); }; }
    var no = pend.filter(function (k) { return OK.map[k] && OK.map[k].st === 'no'; }).length;
    el.textContent = '🗑 ' + (pend.length - no) + ' 個刪除等 Paul 核可（核可前雲端保留）' + (no ? '；' + no + ' 個 Paul 不核可' : '') + '（點一下收起）';
  }

  /* ---------- 攔截 fetch ---------- */
  g.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!isGas(url) || url.indexOf(PSJHR_GAS) === 0 && !/hr_photo_del/.test(String(init && init.body || ''))) return realFetch(input, init);
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var body = init && init.body;
    var p = Object.assign({}, queryOf(url), method === 'GET' ? {} : parseBody(body));
    var c = null; try { c = classify(url, method, p); } catch (_) { c = null; }
    if (!c) {
      /* 同步上傳：拿掉等核可那幾筆的刪除記號 */
      if (method !== 'GET' && typeof body === 'string' && /"_deleted"\s*:\s*(true|"true")/.test(body)) {
        try { var np = stripPending(p); if (np) init = Object.assign({}, init, { body: JSON.stringify(np) }); } catch (_) {}
      }
      return realFetch(input, init);
    }
    c.p = p;
    return refreshOK(false).then(function (map) {
      var d = map[c.sig];
      if (d && d.st === 'ok') return realFetch(input, init).then(function (res) { delete REQ[c.sig]; saveReq(); banner(); return res; });
      if (!(d && d.st === 'no') && !REQ[c.sig]) ask(c, url, method, body);
      setTimeout(banner, 50);
      return fakeResponse(c, d && d.st);
    });
  };

  /* 只有這台裝置真的有等核可的刪除，才去讀 Paul 的決定（平常不多打任何請求） */
  function boot() { if (Object.keys(REQ).length) refreshOK(true); else banner(); setInterval(function () { if (Object.keys(REQ).length) refreshOK(false); }, 120000); }
  if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
  g.DelGuard = { classify: classify, refresh: function () { return refreshOK(true); }, pending: function () { return REQ; }, platform: PLAT, version: 2 };
})(window);
/* DEL-GUARD END */
/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP Platform · shared/ga-core.js   v2.1
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
GA.VERSION = '2.1';
GA.PLATFORM_VERSION = '3.9.24';

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

var CFG_MEM = null; /* v3.9.25: settings that could not be written (storage full) stay valid for this session */
GA.cfg = function () {
  var c;
  try { c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; }
  catch (e) { c = {}; }
  if (CFG_MEM) for (var k in CFG_MEM) if (CFG_MEM.hasOwnProperty(k)) c[k] = CFG_MEM[k];
  return c;
};
GA.saveCfg = function (patch) {
  var c = GA.cfg();
  for (var k in patch) if (patch.hasOwnProperty(k)) c[k] = patch[k];
  try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); CFG_MEM = null; }
  catch (e) {
    CFG_MEM = c;
    try {
      var l = GA.lang || 'zh', msg = l === 'en' ? 'Storage full — settings kept in this session only; please sync / clear old photos'
        : l === 'km' ? 'ទំហំផ្ទុកពេញ — ការកំណត់នៅក្នុងវគ្គនេះប៉ុណ្ណោះ' : '本機儲存空間已滿 — 設定只保留在本次畫面，請同步或清除舊照片';
      if (GA.toast && !GA._cfgQuotaToast) { GA._cfgQuotaToast = 1; setTimeout(function () { GA._cfgQuotaToast = 0; }, 8000); GA.toast(msg, 'err'); }
      else if (!GA.toast && typeof console !== 'undefined') console.warn('[GA.saveCfg]', e);
    } catch (_) {}
  }
  return c;
};
GA.gasUrl = function () {
  var u = String(GA.cfg().gasUrl || '').trim();
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
  if (!t) throw new Error(backendText('雲端沒有回應內容 / Empty response from GAS','The cloud sent an empty reply — please try again','Cloud មិនបានផ្ញើទិន្នន័យ — សូមព្យាយាមម្ដងទៀត'));
  if (t.charAt(0) === '<') {
    var missing=/找不到網頁|找不到网页|page not found|file does not exist|requested file does not exist|404/i.test(t);
    var login=/accounts\.google\.com|sign in|登入|登錄|authorization required|access denied|permission denied/i.test(t);
    var message=missing?backendText('雲端網址回覆「找不到網頁」；請檢查此瀏覽器儲存的部署網址。','The cloud URL returned Page not found. Check the deployment URL saved in this browser.','រកមិនឃើញទំព័រ Cloud។ សូមពិនិត្យតំណ deployment។'):login?backendText('雲端回覆登入／權限頁；請檢查原 Apps Script 網頁應用程式的存取權限。','Cloud returned a sign-in or access page. Check the original Apps Script web app access settings.','Cloud តម្រូវឱ្យចូលគណនី ឬសិទ្ធិចូលប្រើ។'):backendText('雲端回傳網頁，未回傳資料；請檢查連線設定並重試。','Cloud returned HTML instead of data. Check the connection and retry.','Cloud ផ្ញើទំព័រ HTML ជំនួសទិន្នន័យ។');
    var htmlError=new Error(message);htmlError.code=missing?'CLOUD_HTML_NOT_FOUND':login?'CLOUD_HTML_AUTH':'CLOUD_HTML';throw htmlError;
  }
  var d;
  try { d = JSON.parse(t); }
  catch (e) { throw new Error(backendText('GAS 回應非 JSON：','Cloud reply could not be read: ','មិនអាចអានការឆ្លើយតបពី Cloud៖ ') + t.slice(0, 120)); }
  if (d && d.ok === false) {
    var err = new Error(d.error || d.msg || backendText('GAS error','Cloud error','កំហុស Cloud'));
    err.code = d.code; err.payload = d;
    throw err;
  }
  return d;
}

GA.requestJSON = function (url, options, timeoutMs) {
  options = Object.assign({cache:'no-store'}, options || {});
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer, opts = Object.assign({}, options || {});
  if (controller) opts.signal = controller.signal;
  var deadline = new Promise(function (_, reject) {
    timer = setTimeout(function () {
      var te = new Error(backendText('雲端回應逾時；資料保留本機，請稍後重試 / Cloud response timed out; retry to confirm the result','Cloud response timed out — please try again','Cloud មិនឆ្លើយតបទាន់ពេល — សូមព្យាយាមម្ដងទៀត'));
      te.code = 'TIMEOUT'; reject(te);
      if (controller) controller.abort();
    }, timeoutMs || 45000);
  });
  var request = Promise.resolve().then(function () {
    /* v3.9.26: a raw fetch rejection ("Failed to fetch", "offline") becomes a translated no-internet message */
    return Promise.resolve().then(function () { return fetch(url, opts); }).catch(function (e) { throw GA.networkError(e); });
  }).then(function (r) {
    return r.text().then(function (raw) {
      var data = parseEnvelope(raw);
      if (r.ok === false) throw new Error('HTTP ' + r.status + ': ' + backendText('cloud request failed','cloud request failed','សំណើ Cloud បរាជ័យ'));
      if (!data || data.ok !== true) throw new Error(backendText('雲端未確認成功','Cloud did not confirm success','Cloud មិនបានបញ្ជាក់ថាជោគជ័យ'));
      return data;
    });
  });
  return Promise.race([request, deadline]).finally(function () { clearTimeout(timer); });
};

GA.gasGet = function (action, params) {
  var destination = GA.gasUrl();
  function send() {
    if(destination !== GA.gasUrl()) throw new Error(backendText('連線設定已變更，請重試','Connection settings changed — please try again','ការកំណត់ការតភ្ជាប់បានផ្លាស់ប្ដូរ — សូមព្យាយាមម្ដងទៀត'));
    var base = destination;
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action);
    params = params || {};
    for (var k in params) {
      if (!params.hasOwnProperty(k)) continue;
      var v = params[k];
      if (v === undefined || v === null || v === '') continue;
      url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }
    var s = GA.session(); if (s) url += '&session=' + encodeURIComponent(s);
    return GA.requestJSON(url + '&_fresh=' + Date.now().toString(36) + Math.random().toString(36).slice(2,7));
  }
  /* ping is the read-only contract probe itself. Every other named request
     first requires a backend that rejects unknown actions; otherwise an old
     deployment can return a generic ok:true and make a missing download look
     successful. */
  var gate = action === 'ping' || !GA.backend || !GA.backend.require
    ? Promise.resolve() : GA.backend.require('strictActionErrors', { action:action });
  return gate.then(send).catch(function (e) {
    throw GA.normalizeCloudError(e, action);
  });
};

GA.gasPost = function (action, payload, extra) {
  var destination = GA.gasUrl();
  function send() {
    if(destination !== GA.gasUrl()) throw new Error(backendText('連線設定已變更，請重試','Connection settings changed — please try again','ការកំណត់ការតភ្ជាប់បានផ្លាស់ប្ដូរ — សូមព្យាយាមម្ដងទៀត'));
    var body = { action: action, data: payload };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) body[k] = extra[k];
    var s = GA.session(); if (s) body.session = s;
    return GA.requestJSON(GA.gasUrl(), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }   // 避免 CORS preflight
    }).then(function (r) {
      /* AC_GA_EXP.gs signs every handled response with revision. A bare
         {ok:true} is the legacy fall-through that caused phantom saves. */
      if (!r || r.revision === undefined || r.revision === null) {
        var e = new Error(GA.backendMessage(action));
        e.code = 'BACKEND_OUTDATED'; e.action = action; e.payload = r;
        throw e;
      }
      return r;
    });
  }
  var gate = !GA.backend || !GA.backend.require
    ? Promise.resolve() : GA.backend.require('strictActionErrors', { action:action });
  return gate.then(send).catch(function (e) {
    throw GA.normalizeCloudError(e, action);
  });
};

/* ── Backend contract / compatibility ──────────────────────────────
   A cached HTML page can be newer than the user's saved GAS Web App.
   In that state an unknown POST must never be treated as a successful save.
   Keep the current data destination unchanged, retain the local outbox, and
   tell the user exactly which deployed capability is missing.              */
var BACKEND_CACHE = {};
function backendLang() {
  var l = GA.lang || GA.cfg().lang || 'zh';
  return l === 'en' || l === 'km' ? l : 'zh';
}
function backendText(zh, en, km) {
  var l = backendLang(); return l === 'en' ? en : l === 'km' ? km : zh;
}
/* v3.9.26: per-language text helper + friendly network errors for staff screens */
GA.tri = function (zh, en, km) { return backendText(zh, en, km === undefined ? en : km); };
GA.netText = function (saved) {
  return saved
    ? backendText('沒有網路 — 已存在本機，恢復連線後會自動傳送', 'No internet — saved on this device, will send automatically', 'គ្មានអ៊ីនធឺណិត — បានរក្សាទុកក្នុងឧបករណ៍នេះ ហើយនឹងផ្ញើដោយស្វ័យប្រវត្តិ')
    : backendText('沒有網路 — 請稍後再試', 'No internet — please try again', 'គ្មានអ៊ីនធឺណិត — សូមព្យាយាមម្ដងទៀត');
};
GA.isNetworkError = function (e) {
  if (!e) return false;
  if (e.code === 'NETWORK' || e.code === 'TIMEOUT') return true;
  return /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|^(error: )?offline$/i.test(String(e.originalMessage || e.message || e).trim());
};
GA.networkError = function (e) {
  if (e && (e.name === 'AbortError' || e.code === 'NETWORK' || e.code === 'TIMEOUT' || e.code === 'BACKEND_OUTDATED' || /^CLOUD_HTML/.test(e.code || ''))) return e;
  var x = new Error(GA.netText(false));
  x.code = 'NETWORK'; x.originalMessage = (e && e.message) || String(e || ''); x.cause = e;
  return x;
};
/* Text for a caught error: network failures become a plain translated sentence.
   saved=true only when the flow really keeps the data on the device and retries automatically. */
GA.errText = function (e, saved) {
  if (e && e.code === 'TIMEOUT') return e.message;
  if (GA.isNetworkError(e)) return GA.netText(!!saved);
  return (e && e.message) || String(e || '');
};
function isCompatibilityMessage(v) {
  return /unknown\s+action|unsupported\s+(?:action|module|capability)|not\s+implemented|client[_\s-]*update|does\s+not\s+support/i.test(String(v || ''));
}
GA.isBackendCompatibilityError = function (e) {
  return !!(e && (e.code === 'BACKEND_OUTDATED' || e.code === 'UNKNOWN_ACTION' || e.code === 'CLIENT_UPDATE' || isCompatibilityMessage(e.message)));
};
GA.backendMessage = function (action, version) {
  var labels={smartSync:backendText('資料同步','data sync','សមកាលកម្មទិន្នន័យ'),'smart sync':backendText('資料同步','data sync','សមកាលកម្មទិន្នន័យ'),smartCommitToken:backendText('上傳版本比對','upload version check','ពិនិត្យកំណែផ្ទុកឡើង'),monthlyPoReceiptGuard:backendText('Monthly PO 收貨及數量核對','Monthly PO receipt validation','ផ្ទៀងផ្ទាត់ការទទួល Monthly PO'),strictActionErrors:backendText('雲端版本驗證','cloud version verification','ការផ្ទៀងផ្ទាត់កំណែ Cloud'),getState:backendText('採購與收發紀錄','PO and receipt records','កំណត់ត្រាទិញ និងទទួល'),saveState:backendText('採購與收發儲存','PO and receipt save','រក្សាទុកការទិញ និងទទួល'),dashboard:backendText('首頁資料','dashboard data','ទិន្នន័យទំព័រដើម')};
  var name = labels[action] || action || 'cloud action';
  var suffix = version ? ' (GS ' + version + ')' : '';
  return backendText(
    '目前連線尚未確認「' + name + '」' + (version ? suffix : '（雲端未回報版本）') + '。請按「檢查連線設定」，核對瀏覽器目前儲存的網址與實際版本；本機資料及待傳內容保留。',
    'The saved GAS deployment does not support "' + name + '"' + suffix + '. Data remains local and is not marked synced. Update the existing Apps Script deployment with this package\'s AC_GA_EXP.gs, then retry.',
    'GAS ដែលបានរក្សាទុកមិនគាំទ្រ "' + name + '"' + suffix + '។ ទិន្នន័យនៅក្នុងម៉ាស៊ីន ហើយមិនត្រូវបានសម្គាល់ថា Sync ទេ។ សូមដាក់ AC_GA_EXP.gs កំណែថ្មីទៅ deployment ដដែល ហើយសាកម្ដងទៀត។'
  );
};
GA.showBackendIssue = function (action, detail) {
  if (!global.document || !document.body) return;
  var id = 'ga-backend-alert', box = document.getElementById(id);
  if (!box) {
    box = document.createElement('div'); box.id = id; box.setAttribute('role', 'alert');
    box.style.cssText = 'position:sticky;top:0;z-index:10000;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#fff1f2;color:#9f1239;border:1px solid #fda4af;font:600 12px/1.5 system-ui,sans-serif;box-shadow:0 2px 10px rgba(15,23,42,.12)';
    box.innerHTML = '<span data-ga-backend-text></span><button type="button" data-ga-backend-retry style="margin-left:auto;border:1px solid #be123c;background:#fff;color:#9f1239;border-radius:7px;padding:5px 9px;font-weight:700;cursor:pointer">' +
      backendText('重新檢查','Retry check','ពិនិត្យម្ដងទៀត') + '</button>';
    document.body.insertBefore(box, document.body.firstChild);
    box.querySelector('[data-ga-backend-retry]').onclick = function () {
      GA.backend.check(true).then(function (info) {
        var required = box.getAttribute('data-capability') || '';
        if (!required || info.capabilities.indexOf(required) >= 0 || ((info.actions.get||[]).concat(info.actions.post||[])).indexOf(required)>=0) {
          box.remove(); try { global.dispatchEvent(new CustomEvent('ga-backend-ready', { detail: info })); } catch (_) {}
        } else box.querySelector('[data-ga-backend-text]').textContent = GA.backendMessage(required, info.version);
      }).catch(function (e) { box.querySelector('[data-ga-backend-text]').textContent = e.message; });
    };
  }
  if(!box.querySelector('[data-ga-backend-settings]')){var settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.setAttribute('data-ga-backend-settings','');settingsButton.textContent=backendText('檢查連線設定','Check connection settings','ពិនិត្យការតភ្ជាប់');settingsButton.style.cssText='border:1px solid #be123c;background:#fff;color:#9f1239;border-radius:7px;padding:5px 9px;font-weight:700;cursor:pointer';settingsButton.onclick=function(){if(GA.openCloudDiagnostic)GA.openCloudDiagnostic();};box.appendChild(settingsButton);}
  box.setAttribute('data-capability', action || '');
  box.querySelector('[data-ga-backend-text]').textContent = '⚠ ' + (detail || GA.backendMessage(action));
};
GA.normalizeCloudError = function (e, action) {
  e = e instanceof Error ? e : new Error(String(e || 'Cloud error'));
  e.action = e.action || action || '';
  if(/^CLOUD_HTML/.test(e.code||''))GA.showBackendIssue('strictActionErrors',e.message);
  if (GA.isBackendCompatibilityError(e) && (!e.backend || !e.backend.url || e.backend.url===GA.gasUrl())) {
    if (!e.originalMessage) e.originalMessage = e.message;
    e.code = 'BACKEND_OUTDATED';
    e.message = GA.backendMessage(e.capability || action || e.action, e.backend && e.backend.version);
    GA.showBackendIssue(e.capability || action || e.action, e.message);
  }
  return e;
};
GA.backend = {
  probe: function(url){
    var u=String(url||'').trim();
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u))return Promise.reject(new Error(backendText('請使用 Apps Script 正式部署 /exec 網址（不是編輯器或 /dev 網址）','Use the deployed Apps Script /exec URL, not the editor or /dev URL','សូមប្រើតំណ Apps Script /exec')));
    // Read-only probe: no session, no configuration changes, no writes.
    return GA.requestJSON(u+'?action=ping&_t='+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),{cache:'no-store'},25000).then(function(r){
      var d=r&&r.data&&typeof r.data==='object'?Object.assign({},r,r.data):(r||{});
      return {ok:true,url:u,version:String(d.version||''),capabilities:Array.isArray(d.capabilities)?d.capabilities.slice():[],actions:d.actions||{},dataStore:String(d.dataStore||''),checkedAt:new Date().toISOString(),raw:r};
    });
  },
  check: function (force) {
    var url = GA.gasUrl(), hit = BACKEND_CACHE[url];
    if (!force && hit && Date.now() - hit.at < 60000) return hit.promise;
    var p = GA.backend.probe(url).then(function(info){
      if(url===GA.gasUrl()){
        var box=document.getElementById('ga-backend-alert'),required=box&&box.getAttribute('data-capability');
        if(box&&info.capabilities.indexOf(required)>=0)box.remove();
      }
      return info;
    });
    BACKEND_CACHE[url] = { at:Date.now(), promise:p };
    return p.catch(function (e) { delete BACKEND_CACHE[url]; throw e; });
  },
  require: function (capability, opt) {
    opt = opt || {};
    return this.check(!!opt.force).then(function (info) {
      if (info.capabilities.indexOf(capability) < 0) {
        var e = new Error(GA.backendMessage(opt.action || capability, info.version));
        e.code = 'BACKEND_OUTDATED'; e.action = opt.action || capability; e.capability = capability; e.backend = info;
        if(info.url===GA.gasUrl())GA.showBackendIssue(capability, e.message); throw e;
      }
      return info;
    });
  },
  clear: function () { BACKEND_CACHE = {}; }
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
    cloudIdle: '未連線', cloudSynced: '已同步', cloudWarn: '需注意', cloudSync: '同步中…', cloudUp: '上傳成功',
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
    cloudIdle: 'Not connected', cloudSynced: 'Synced', cloudWarn: 'Attention', cloudSync: 'Syncing…', cloudUp: 'Upload OK',
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
    cloudIdle: 'មិនបានតភ្ជាប់', cloudSynced: 'បានសមកាលកម្ម', cloudWarn: 'ត្រូវពិនិត្យ', cloudSync: 'កំពុងធ្វើសមកាលកម្ម…', cloudUp: 'ផ្ទុកឡើងជោគជ័យ',
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
  var d=new Date(+m[1],+m[2]-1,+m[3]); return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;
};
/* Excel serial date → 'YYYY-MM-DD'（用 UTC getter 讀 serial，避免本地時區偏移） */
GA.excelDate = function (v) { /* v3.9.25: validated result; '' = invalid date (callers must reject/list it) */
  if (v === null || v === undefined || v === '') return '';
  function ok(y, mo, d) {
    y = +y; mo = +mo; d = +d;
    if (!(y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
    var t = new Date(y, mo - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return '';
    return y + '-' + p2(mo) + '-' + p2(d);
  }
  if (v instanceof Date) {
    if (isNaN(v)) return '';
    /* SheetJS cellDates:true returns e.g. 23:59:56 of the previous local day → snap to the nearest midnight when within 2 min */
    var ms = ((v.getHours() * 60 + v.getMinutes()) * 60 + v.getSeconds()) * 1000 + v.getMilliseconds();
    var dd = new Date(v.getTime());
    if (ms > 86400000 - 120000) dd = new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1);
    return ok(dd.getFullYear(), dd.getMonth() + 1, dd.getDate());
  }
  if (typeof v === 'number') {
    if (!isFinite(v) || v < 1 || v > 60000) return '';
    var d = new Date(Math.round((v - 25569) * 86400000));
    return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  var s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s) && +s >= 20000 && +s <= 60000) return GA.excelDate(+s);
  var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return ok(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);          // DD/MM/YYYY only (ambiguous/US order is rejected)
  if (m) return ok(m[3], m[2], m[1]);
  if (/^\d{1,2}[-\/.]\d{1,2}([-\/.]\d{1,4})?$/.test(s)) return '';  // short / partial numeric forms are ambiguous
  var d2 = new Date(s);
  return isNaN(d2) ? '' : ok(d2.getFullYear(), d2.getMonth() + 1, d2.getDate());
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
  if (type === 'week') { var ws = GA.weekStart(d), th=new Date(ws); th.setDate(th.getDate()+3); return th.getFullYear() + '-W' + p2(GA.isoWeek(ws)); }
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
    var wk = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'][d.getDay()];
    return key + (L === 'zh' ? '（週' + wz + '）' : ' (' + (L === 'km' ? wk : wd) + ')');
  }
  if (type === 'week') {
    var m = key.match(/^(\d{4})-W(\d+)$/); if (!m) return key;
    var r = GA.weekRange(key);
    var w = L === 'zh' ? '第' + (+m[2]) + '週' : L === 'km' ? 'សប្តាហ៍ ' + (+m[2]) : 'W' + (+m[2]);
    return m[1] + ' ' + w + (r ? (L === 'zh' ? '（' + r.start + ' ~ ' + r.end + '）' : ' (' + r.start + ' ~ ' + r.end + ')') : '');
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
    return GA.periodKey(GA.ymd(b),'week');
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
    if (opt.layout === 'nav') {
      /* v3.9.35 sewing-style bar: [日][週][月][年]  ◀ [期間下拉] ▶ 最新 — dropdown lists only periods with data */
      host.innerHTML =
        '<div class="ga-pc nav">' +
          '<div class="ga-pc-seg">' + types.map(function (t) {
            return '<button class="ga-pc-t' + (t === st.type ? ' on' : '') + '" data-type="' + t + '">' + GA.T(t) + '</button>';
          }).join('') + '</div>' +
          '<div class="ga-pc-go">' +
            '<button class="ga-pc-nav" data-act="prev" title="' + GA.T('prev') + '">◀</button>' +
            '<select class="ga-pc-sel">' + opts.map(function (k) {
              return '<option value="' + k + '"' + (k === st.key ? ' selected' : '') + '>' + GA.periodLabel(k, st.type) + (keys.indexOf(k) < 0 ? ' · —' : '') + '</option>';
            }).join('') + '</select>' +
            '<button class="ga-pc-nav" data-act="next" title="' + GA.T('next') + '">▶</button>' +
            '<button class="ga-pc-today" data-act="latest">' + (GA.lang === 'en' ? 'Latest' : GA.lang === 'km' ? 'ថ្មីបំផុត' : '最新') + '</button>' +
          '</div>' +
        '</div>';
      host.querySelectorAll('[data-type]').forEach(function (b) {
        b.onclick = function () {
          var anchor = st.type === 'day' ? st.key
            : st.type === 'week' ? (GA.weekRange(st.key) || {}).start
            : st.type === 'month' ? st.key + '-01' : st.key + '-01-01';
          st.type = b.getAttribute('data-type');
          var k = GA.periodKey(anchor || GA.ymd(new Date()), st.type) || GA.currentPeriod(st.type), ks = availableKeys();
          if (ks.length && ks.indexOf(k) < 0) { var near = ks.filter(function (x) { return x <= k; })[0]; k = near || ks[ks.length - 1]; }
          st.key = k; fire();
        };
      });
      /* ◀ ▶ step through periods that have data (keys are sorted newest first) */
      var step = function (dir) {
        var ks = availableKeys();
        if (!ks.length) { st.key = GA.shiftPeriod(st.key, st.type, dir); return fire(); }
        var older = ks.filter(function (x) { return x < st.key; }), newer = ks.filter(function (x) { return x > st.key; });
        if (dir < 0 && older.length) st.key = older[0];
        else if (dir > 0 && newer.length) st.key = newer[newer.length - 1];
        else return;
        fire();
      };
      host.querySelector('[data-act="prev"]').onclick = function () { step(-1); };
      host.querySelector('[data-act="next"]').onclick = function () { step(1); };
      host.querySelector('[data-act="latest"]').onclick = function () { var ks = availableKeys(); st.key = ks[0] || GA.currentPeriod(st.type); fire(); };
      host.querySelector('.ga-pc-sel').onchange = function () { st.key = this.value; fire(); };
      return;
    }
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
      conflict: { i: '⚠', t: GA.T('cloudConflict'), c: 'warn' },
      /* v3.9.30: smart-sync reports busy / ok / warn — they used to fall back to "Not connected" */
      synced:   { i: '●', t: GA.T('cloudSynced'),   c: 'ok' },
      warn:     { i: '⚠', t: GA.T('cloudWarn'),     c: 'warn' }
    };
    map.busy = map.sync; map.ok = map.synced;
    var m = map[state] || map.idle;
    /* v3.9.26: module status details are often Chinese-only; never show them in EN / KM */
    if (detail && GA.lang !== 'zh' && /[\u3400-\u9fff]/.test(String(detail))) detail = '';
    if (detail && GA.isNetworkError({ message: String(detail) })) detail = GA.netText(false);
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
  /* v3.9.25: only libraries the page actually includes are checked (index no longer loads SheetJS / Chart.js) */
  function included(re) { try { return Array.prototype.some.call(document.getElementsByTagName('script'), function (s) { return re.test(s.getAttribute('src') || ''); }); } catch (e) { return true; } }
  if (typeof XLSX === 'undefined' && included(/xlsx/i)) miss.push('SheetJS (' + backendText('Excel 匯入匯出', 'Excel import / export', 'នាំចូល / នាំចេញ Excel') + ')');
  if (typeof Chart === 'undefined' && included(/chart/i)) miss.push('Chart.js (' + backendText('圖表', 'charts', 'តារាងក្រាហ្វិក') + ')');
  if (miss.length) {
    var bar = document.createElement('div');
    bar.className = 'ga-cdn-warn';
    bar.innerHTML = backendText('⚠️ 下列元件載入失敗，相關功能暫停但其餘仍可使用：', '⚠️ These parts did not load; those features are paused, everything else still works: ', '⚠️ ផ្នែកខាងក្រោមមិនបានផ្ទុក មុខងារទាំងនោះផ្អាក តែផ្នែកផ្សេងនៅប្រើបាន៖ ') + '<b>' +
      miss.join(backendText('、', ', ', ', ')) + '</b>　' + backendText('請檢查網路或改用可連外的裝置。', 'Check the internet or use another device.', 'សូមពិនិត្យអ៊ីនធឺណិត ឬប្រើឧបករណ៍ផ្សេង។');
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

  /* v3.9.26: opt.name / opt.title may be {zh,en,km} so the header and tab title follow the language */
  function pick(v) { return v && typeof v === 'object' ? (v[GA.lang] || v.en || v.zh || '') : (v || ''); }
  function hdName() { return GA.esc(opt.icon || '') + ' ' + GA.esc(pick(opt.name)); }
  function hdTitle() { if (opt.title) try { document.title = pick(opt.title); } catch (e) {} }
  hdTitle();
  host.innerHTML =
    '<div class="ga-hd">' +
      '<a class="ga-hd-home" href="index.html" data-t-title="home" title="' + GA.T('home') + '">🏠</a>' +
      '<div class="ga-hd-id">' +
        '<div class="ga-hd-name">' + hdName() + '</div>' +
        '<div class="ga-hd-ver">AC-GA-EXP ' + GA.esc('v'+GA.PLATFORM_VERSION) + '</div>' +
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
    var nm = host.querySelector('.ga-hd-name'); if (nm) nm.innerHTML = hdName();
    hdTitle();
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
