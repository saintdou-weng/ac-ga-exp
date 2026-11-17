/* ga-item-master.js — 採購／收貨「物品對照」2026-11-14
   兩邊各自保存自己的物品資料（採購寫採購、收貨寫收貨），這裡把同一個品項配在一起比對：
   名稱、分類、單位／規格、安全存量、月底庫存、標準照。
   配對：① 手動確認的配對（雲端 PROFILES_DB key＝itemlink:<採購ID>）② 名稱完全相同（英文或中文）
         ③ 名稱相似（拼字不同，數字必須一樣）→ 標「待確認」，按 ✓ 是同一項 / ✗ 不是。
   採購頁：多一個「🏷️ 物品對照」分頁；收貨頁／採購頁的物品卡片「資料」分頁下方顯示對照。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || GA.ItemMaster) return;
  var BASE = [[4, "Baby Powder", "嬰兒爽身粉", "cleaning", "🧴"], [8, "Big Poly Bag", "大垃圾袋", "cleaning", "🗑️"], [15, "Bleach", "漂白水", "cleaning", "🧪"], [21, "Face Mask", "口罩", "cleaning", "😷"], [22, "Hand Wash", "洗手液", "cleaning", "🧴"], [24, "Insect Killer", "殺蟲劑", "cleaning", "🦟"], [27, "Mr. Muscle", "威猛先生", "cleaning", "💪"], [28, "Mop", "拖把", "cleaning", "🪣"], [31, "Plastic Glove", "膠手套", "cleaning", "🧤"], [35, "Plastic Broom", "塑膠掃把", "cleaning", "🪠"], [66, "Broom", "掃把", "cleaning", "🧹"], [38, "Soap Powder", "洗衣粉", "cleaning", "🫧"], [39, "Small Poly Bag", "小垃圾袋", "cleaning", "🛍️"], [49, "Tissue Paper", "紙巾", "cleaning", "🧻"], [50, "Toilet Bleach", "廁所漂白水", "cleaning", "🚽"], [56, "Fresher Spray", "空氣清新劑", "cleaning", "🌸"], [58, "Toilet Paper", "廁紙", "cleaning", "🧻"], [60, "Clear Plastic Bag", "透明膠袋", "cleaning", "🛍️"], [1, "A4 Paper", "A4 紙", "stationery", "📄"], [2, "A4 Paper (Color)", "A4 彩色紙", "stationery", "🗒️"], [3, "Battery AAA", "AAA 電池", "stationery", "🔋"], [9, "Battery AA", "AA 電池", "stationery", "🔋"], [5, "Big Book", "大本筆記", "stationery", "📔"], [6, "Brown Envelope A4", "牛皮信封 A4", "stationery", "✉️"], [7, "Brown Envelope A5", "牛皮信封 A5", "stationery", "✉️"], [10, "Blue Pen", "藍色原子筆", "stationery", "🖊️"], [11, "Binder Clip 19mm", "長尾夾 19mm", "stationery", "🖇️"], [12, "Binder Clip 32mm", "長尾夾 32mm", "stationery", "🖇️"], [13, "Binder Clip 41mm", "長尾夾 41mm", "stationery", "🖇️"], [14, "Binder Clip 51mm", "長尾夾 51mm", "stationery", "🖇️"], [16, "Correction Pen", "塗改筆", "stationery", "🖊️"], [17, "Clip File", "夾文件", "stationery", "📁"], [18, "Dry Correction Pen", "乾式塗改帶", "stationery", "📝"], [19, "Double Tape", "雙面膠紙", "stationery", "📎"], [20, "Envelope", "信封", "stationery", "✉️"], [23, "High Lighter", "螢光筆", "stationery", "🖍️"], [25, "Stamp Ink", "印台墨水", "stationery", "🔏"], [26, "Whiteboard Marker", "白板筆", "stationery", "🖊️"], [29, "Note Book", "筆記本", "stationery", "📓"], [30, "Pencil", "鉛筆", "stationery", "✏️"], [32, "Paper Clip", "萬字夾", "stationery", "📎"], [33, "Permanent Marker Blue", "油性筆（藍）", "stationery", "🖊️"], [34, "Permanent Marker Black", "油性筆（黑）", "stationery", "🖊️"], [36, "Ruler", "間尺", "stationery", "📏"], [37, "Red Pen", "紅色原子筆", "stationery", "🔴"], [40, "Staple #10", "訂書針 #10", "stationery", "📌"], [41, "Clear Tape", "透明膠紙", "stationery", "🔲"], [65, "Small Clear Tape", "小透明膠紙", "stationery", "🔲"], [42, "Tailor Chalk", "裁縫粉筆", "stationery", "🪡"], [43, "Tape Measure", "皮尺", "stationery", "📐"], [51, "Yellow Tape", "黃色膠紙", "stationery", "📏"], [52, "Case ID Card", "員工証套", "stationery", "🪪"], [53, "ID Card", "員工証", "stationery", "🪪"], [54, "Clipboard", "夾板", "stationery", "📋"], [55, "Plastic Clear Sheet", "透明膠套", "stationery", "📄"], [57, "String Folder", "繩子文件夾", "stationery", "📁"], [61, "Binder Clip 25mm", "長尾夾 25mm", "stationery", "🖇️"], [62, "Glue Stick", "固體膠", "stationery", "🖊️"], [63, "A4 Paper (180g)", "A4紙 180g", "stationery", "📄"], [64, "Clear Plastic Folder", "透明文件夾", "stationery", "📁"], [44, "Toner 79A", "碳粉 79A", "toner", "🖨️"], [45, "Toner 63", "碳粉 63", "toner", "🖨️"], [46, "Toner 85A", "碳粉 85A", "toner", "🖨️"], [47, "Toner 61A", "碳粉 61A", "toner", "🖨️"], [48, "Toner A45", "碳粉 A45", "toner", "🖨️"], [59, "Toner HP110", "碳粉 HP110", "toner", "🖨️"]]; /* [id, name, 中文, catKey, emoji] — 採購頁內建品項（收貨頁沒有 CATS 時使用） */
  var PCAT = { cleaning: ['清潔用品', 'Cleaning', 'សម្ភារៈសម្អាត'], stationery: ['文具', 'Stationery', 'សម្ភារៈការិយាល័យ'], toner: ['碳粉', 'Toner', 'ទឹកថ្នាំ'] };
  var RCAT = { cleaning: 'Cleaning', stationery: 'Stationary', toner: 'Stationary' };
  var isProc = !!document.getElementById('page-po'), isRecv = !isProc && /receiving/i.test(location.pathname);
  var S = { recv: null, recvRecs: null, recvAt: 0, proc: null, filter: 'todo', q: '', busy: false, err: '' };

  function L(z, e, k) { var l = (typeof lang !== 'undefined' && lang) || GA.lang || 'zh'; return l === 'zh' ? z : l === 'km' ? (k || e) : e; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function fmt(v) { var n = num(v); return Math.round(n * 100) / 100; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s\-_.,:;'"()（）\[\]【】/\\|+&#]+/g, '').trim(); }
  function digits(s) { return (String(s || '').match(/\d+/g) || []).join('/'); }
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').trim().split(' ').filter(function (w) { return w && !/^\d/.test(w); }); }
  function lev(a, b) { if (a === b) return 0; var m = a.length, n = b.length, p = [], i, j; for (j = 0; j <= n; j++) p[j] = j; for (i = 1; i <= m; i++) { var prev = p[0], c; p[0] = i; for (j = 1; j <= n; j++) { c = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = c; } } return p[n]; }
  /* 名稱相似度 0–1；數字（尺寸、型號）不同一律 0，避免 19mm 配到 25mm、79A 配到 85A */
  function sim(a, b) {
    var na = norm(a), nb = norm(b); if (!na || !nb) return 0; if (na === nb) return 1;
    if (digits(a) !== digits(b)) return 0;
    var r = 1 - lev(na, nb) / Math.max(na.length, nb.length);
    var wa = words(a), wb = words(b), sub = function (x, y) { return x.length && x.every(function (w) { return y.some(function (v) { return v === w || (w.length > 4 && 1 - lev(w, v) / Math.max(w.length, v.length) >= 0.8); }); }); };
    if (sub(wa, wb) || sub(wb, wa)) r = Math.max(r, 0.8);
    return r;
  }

  /* ---------- 配對（存在 PROFILES_DB，key＝itemlink:<採購ID>） ---------- */
  function links() { var o = {}, P = GA.SharedPhoto && GA.SharedPhoto.raw ? GA.SharedPhoto.raw() : {}; Object.keys(P).forEach(function (k) { if (k.indexOf('itemlink:') === 0 && P[k]) o[k.slice(9)] = P[k]; }); return o; }
  function setLink(procId, r, p) {
    if (!GA.SharedPhoto || !GA.SharedPhoto.put) return Promise.resolve(false); var o = {};
    o['itemlink:' + procId] = { recvId: r ? String(r.id) : 'none', recvName: r ? r.name : '', procName: p ? p.name : '', updatedAt: new Date().toISOString() };
    return GA.SharedPhoto.put(o);
  }

  /* ---------- 採購端資料 ---------- */
  function procItems() {
    if (isProc && typeof allItems === 'function') {
      try {
        var m = typeof invDisplayMonth === 'number' ? invDisplayMonth : (new Date().getMonth() + 11) % 12, key = typeof getMonthKey === 'function' ? getMonthKey(m, YEAR) : '', inv = (typeof invRecords !== 'undefined' && invRecords[key]) || {};
        var a = allItems().map(function (it) { var st = (itemSettings || {})[it.id] || {}, cat = it.catKey || catOf(it.id) || 'stationery', r = inv[it.id]; if (r && !num(r.close) && !num(r.open) && !num(r.purchase) && !num(r.used)) r = null; return { id: it.id, name: it.name || '', cn: it.cn || '', e: it.e || '📦', cat: cat, unit: st.unit || it.unit || 'pcs', safety: num(st.safetyStock), monthly: !!st.monthly, close: r ? num(r.close) : null, month: m, year: YEAR }; });
        try { localStorage.setItem('ga_proc_items_v1', JSON.stringify({ at: Date.now(), items: a })); } catch (e) {}
        return a;
      } catch (e) {}
    }
    if (S.proc) return S.proc;
    try { var c = JSON.parse(localStorage.getItem('ga_proc_items_v1') || 'null'); if (c && c.items) return c.items; } catch (e) {}
    return BASE.map(function (b) { return { id: b[0], name: b[1], cn: b[2], cat: b[3], e: b[4], unit: 'pcs', safety: 0, close: null }; });
  }
  function catOf(id) { try { var k = Object.keys(CATS).filter(function (k) { return (CATS[k].items || []).some(function (i) { return String(i.id) === String(id); }); })[0]; return k; } catch (e) { return ''; } }
  /* 收貨頁讀採購設定（唯讀） */
  function loadProc() {
    if (isProc) return Promise.resolve(procItems());
    return GA.gasGet('getState').then(function (j) {
      var d = (j && j.data) || {}, set = d.itemSettings || {}, hid = d.hiddenItems || {}, cus = d.customItems || [];
      var a = BASE.map(function (b) { return { id: b[0], name: b[1], cn: b[2], cat: b[3], e: b[4] }; }).concat(cus.map(function (c) { return { id: c.id, name: c.name || '', cn: c.cn || '', cat: c.catKey || 'stationery', e: c.e || '📦', unit: c.unit }; }));
      S.proc = a.filter(function (i) { return !hid[i.id]; }).map(function (i) { var st = set[i.id] || {}; i.unit = st.unit || i.unit || 'pcs'; i.safety = num(st.safetyStock); i.monthly = !!st.monthly; i.close = null; return i; });
      try { localStorage.setItem('ga_proc_items_v1', JSON.stringify({ at: Date.now(), items: S.proc })); } catch (e) {}
      return S.proc;
    }).catch(function () { return procItems(); });
  }

  /* ---------- 收貨端資料 ---------- */
  function localRecv() {
    if (isRecv) { try { return { items: items, records: records }; } catch (e) {} }
    try { var d = JSON.parse(localStorage.getItem('vrt_receive_data') || 'null'); if (d && d.items) return { items: d.items, records: d.records || [] }; } catch (e) {}
    return { items: [], records: [] };
  }
  function ts(x) { var n = Date.parse(x && (x.updatedAt || x.modifiedAt) || ''); return isNaN(n) ? 0 : n; }
  /* 採購頁讀收貨的物品主檔（唯讀）：本機有就先用，再從雲端讀「物品」與這幾個月的進出，不動收貨頁的同步狀態 */
  function loadRecv(force) {
    if (isRecv) { var l = localRecv(); S.recv = l.items; S.recvRecs = l.records; return Promise.resolve(S.recv); }
    if (S.recv && !force && Date.now() - S.recvAt < 120000) return Promise.resolve(S.recv);
    var loc = localRecv(); if (!S.recv && loc.items.length) { S.recv = loc.items; S.recvRecs = loc.records; }
    S.busy = true; S.err = '';
    return GA.gasGet('smartManifest', { tool: 'receiving' }).then(function (j) {
      var d = (j && j.data) || j || {}, h = d.hashes || {}, cnt = d.counts || {}, ks = Object.keys(h);
      var cats = ks.filter(function (k) { return k.indexOf('catalog:') === 0; });
      var p = procItems()[0] || {}, m0 = (p.month == null ? (new Date().getMonth() + 11) % 12 : p.month) + 1, y0 = p.year || new Date().getFullYear();
      var after = ks.filter(function (k) { var mm = /^m:(\d{4})-(\d{2})$/.exec(k); return mm && (+mm[1] > y0 || (+mm[1] === y0 && +mm[2] > m0)); });
      return Promise.all(cats.concat(after).map(function (k) { return GA.gasGet('smartBucket', { tool: 'receiving', bucket: k }).then(function (b) { var bd = (b && b.data) || {}; return { k: k, rows: bd.records || [] }; }).catch(function () { return { k: k, rows: [], bad: 1 }; }); })).then(function (res) {
        var byId = {}, recs = {}, dead = {};
        res.forEach(function (r) { r.rows.forEach(function (x) { if (!x) return; if (x.kind === 'item' && x.row) byId[x.row.id] = x.row; else if (x.kind === 'record' && x.row) recs[x.row.id || x._syncId] = x.row; else if (x.kind === 'deleted') dead[String(x._syncId || '').replace(/^deleted:/, '')] = 1; }); });
        (loc.items || []).forEach(function (x) { var c = byId[x.id]; if (!c || ts(x) > ts(c)) byId[x.id] = x; });
        (loc.records || []).forEach(function (r) { if (r && r.id && !recs[r.id]) recs[r.id] = r; });
        var list = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (x) { return x && !dead[x.id] && !x.deleted; });
        if (list.length || !S.recv) S.recv = list;
        S.recvRecs = Object.keys(recs).map(function (k) { return recs[k]; }).filter(function (r) { return !dead[r.id]; });
        S.recvAt = Date.now(); S.busy = false; return S.recv;
      });
    }).catch(function (e) { S.busy = false; S.err = e && e.message || String(e); return S.recv || []; });
  }
  /* 收貨在「採購同一個月底」的庫存＝目前庫存 − 之後收貨 + 之後領用 */
  function recvCloseAt(r, month, year) {
    if (month == null) return null; var end = year + '-' + String(month + 1).padStart(2, '0') + '-31', st = num(r.stock);
    (S.recvRecs || []).forEach(function (x) { if (String(x.itemId) !== String(r.id) || String(x.date || '') <= end) return; if (x.type === 'receive') st -= num(x.qty); else if (x.type === 'issue') st += num(x.qty); });
    return fmt(st);
  }

  /* ---------- 比對 ---------- */
  function pairs() {
    var P = procItems(), R = (S.recv || []).filter(function (r) { return r && r.name; }), lk = links(), used = {}, out = [], byP = {};
    var rById = {}; R.forEach(function (r) { rById[String(r.id)] = r; });
    function add(p, r, how) { used[String(r.id)] = 1; byP[String(p.id)] = { p: p, r: r, how: how }; }
    P.forEach(function (p) { var l = lk[String(p.id)]; if (!l) return; if (l.recvId === 'none') { byP[String(p.id)] = { p: p, r: null, how: 'none' }; return; } var r = rById[String(l.recvId)] || R.filter(function (x) { return norm(x.name) === norm(l.recvName) && !used[String(x.id)]; })[0]; if (r && !used[String(r.id)]) add(p, r, 'link'); });
    P.forEach(function (p) { if (byP[String(p.id)]) return; var ks = [norm(p.name), norm(p.cn)].filter(Boolean); var r = R.filter(function (x) { return !used[String(x.id)] && ks.indexOf(norm(x.name)) >= 0; })[0]; if (r) add(p, r, 'name'); });
    var cand = []; P.forEach(function (p) { if (byP[String(p.id)]) return; R.forEach(function (r) { if (used[String(r.id)]) return; var rn = rname2(r), s = Math.max(sim(p.name, r.name), sim(p.cn, r.name), rn ? sim(p.name, rn) : 0); if (s >= 0.75) cand.push({ p: p, r: r, s: s }); }); });
    cand.sort(function (a, b) { return b.s - a.s; }).forEach(function (c) { if (byP[String(c.p.id)] || used[String(c.r.id)]) return; add(c.p, c.r, 'fuzzy'); });
    P.forEach(function (p) { var x = byP[String(p.id)] || { p: p, r: null, how: '' }; out.push(diff(x)); });
    R.forEach(function (r) { if (!used[String(r.id)]) out.push(diff({ p: null, r: r, how: '' })); });
    out.forEach(function (x) { if (x.state === 'recv') { var d = dupOf(x, out); if (d) x.dup = d.r.name + (d.p && norm(d.p.name) !== norm(d.r.name) ? ' / ' + d.p.name : ''); } });
    return out;
  }
  /* 收貨名稱＋規格第一段（例如 Brown Envelop + A4、Battery + AAA）再比一次 */
  function rname2(r) { var t = String(r.size || '').trim().split(/[\s,，]+/)[0] || ''; return t && t.length <= 6 && /^[A-Za-z#]*\d*[A-Za-z]*$/.test(t) && !/pcs|box|pack|roll|ctn|btl/i.test(t) ? r.name + ' ' + t : ''; }
  /* 只有收貨的品項：看看是不是和另一個收貨品項重複（同一個東西建了兩筆） */
  function dupOf(x, all) { var best = null, bs = 0; all.forEach(function (y) { if (y === x || !y.r || !y.p) return; var s = Math.max(levr(x.r.name, y.r.name), levr(x.r.name, y.p.name), rname2(x.r) ? levr(rname2(x.r), y.p.name) : 0); if (s > bs) { bs = s; best = y; } }); return bs >= 0.85 ? best : null; }
  function levr(a, b) { var na = norm(a), nb = norm(b); if (!na || !nb || digits(a) !== digits(b)) return 0; return 1 - lev(na, nb) / Math.max(na.length, nb.length); }
  function diff(x) {
    var p = x.p, r = x.r, rows = [], bad = 0;
    x.state = !p ? 'recv' : !r ? 'proc' : x.how === 'fuzzy' ? 'check' : 'ok';
    if (p && r) {
      var rc = String(r.category || ''), okCat = RCAT[p.cat] && norm(RCAT[p.cat]) === norm(rc) || (p.cat === 'toner' && /toner/i.test(rc)) || (p.cat === 'stationery' && /station/i.test(rc));
      rows.push({ k: 'name', l: L('名稱', 'Name', 'ឈ្មោះ'), a: p.name + (p.cn && p.cn !== p.name ? ' · ' + p.cn : ''), b: r.name, ok: norm(p.name) === norm(r.name) || norm(p.cn) === norm(r.name), soft: 1 });
      rows.push({ k: 'cat', l: L('分類', 'Category', 'ប្រភេទ'), a: (PCAT[p.cat] || [p.cat])[0], b: rc || '—', ok: !!okCat, hint: /^po$|^other$|^$/i.test(rc) ? L('收貨分類還沒設（' + (rc || '空白') + '）', 'Receiving category not set (' + (rc || 'blank') + ')', '') : '' });
      rows.push({ k: 'unit', l: L('單位／規格', 'Unit / size', 'ឯកតា'), a: p.unit || 'pcs', b: [r.size, r.brand].filter(Boolean).join(' · ') || '—', ok: true, info: 1 });
      var sa = num(p.safety), sb = num(r.minStock);
      rows.push({ k: 'safety', l: L('安全存量', 'Safety stock', 'ស្តុកសុវត្ថិភាព'), a: sa || '—', b: sb || '—', ok: sa === sb, av: sa, bv: sb });
      if (p.close != null) { var rcl = recvCloseAt(r, p.month, p.year); rows.push({ k: 'stock', l: (p.month + 1) + L('月底庫存', ' month-end stock', ' ស្តុកចុងខែ'), a: fmt(p.close), b: rcl == null ? fmt(r.stock) : rcl, ok: rcl == null || fmt(p.close) === rcl }); }
      else rows.push({ k: 'stock', l: L('收貨目前庫存', 'Receiving stock now', 'ស្តុកបច្ចុប្បន្ន'), a: '—', b: fmt(r.stock), ok: true, info: 1 });
      rows.forEach(function (w) { if (!w.ok && !w.soft && !w.info) bad++; });
      if (x.state === 'ok' && bad) x.state = 'diff';
    }
    var ph = GA.SharedPhoto && GA.SharedPhoto.get([p && p.name, p && p.cn, r && r.name].filter(Boolean)); x.photo = ph && (ph.previewUrl || ph.url) || '';
    x.rows = rows; x.bad = bad; x.name = p ? (p.cn && L(1, 0) ? p.cn + ' · ' + p.name : p.name) : r.name; return x;
  }
  var ST = {
    ok: { c: '#16a34a', i: '🟢', z: '一致', e: 'Match' },
    diff: { c: '#d97706', i: '🟡', z: '有不同', e: 'Different' },
    check: { c: '#2563eb', i: '🔵', z: '名稱相似·待確認', e: 'Similar name · confirm' },
    proc: { c: '#7c3aed', i: '🟣', z: '只有採購', e: 'Procurement only' },
    recv: { c: '#ea580c', i: '🟠', z: '只有收貨', e: 'Receiving only' }
  };
  function stLabel(s) { var t = ST[s]; return t.i + ' ' + L(t.z, t.e, t.e); }

  /* ---------- 動作（各自只寫自己那邊） ---------- */
  function procSetSafety(id, v) { itemSettings[id] = Object.assign({}, itemSettings[id] || {}, { safetyStock: num(v), autoSafety: false }); saveState(); try { if (typeof renderInv === 'function') renderInv(); } catch (e) {} }
  function procAddFromRecv(r) {
    var catKey = /clean/i.test(r.category || '') ? 'cleaning' : /toner/i.test((r.name || '') + (r.category || '')) ? 'toner' : 'stationery';
    var id = 'cust_' + String(GA.fingerprint ? GA.fingerprint([r.name, r.id]) : Date.now()).replace(/^\w\w/, '').slice(0, 8);
    if (allItems().some(function (i) { return String(i.id) === id; })) return null;
    customItems.push({ id: id, name: r.name, cn: '', e: '📦', catKey: catKey, unit: 'pcs', sz: r.size || '' });
    ords[id] = { qty: 0, note: '' }; itemSettings[id] = { unit: 'pcs', safetyStock: num(r.minStock) || 5 }; saveState();
    try { if (typeof renderItems === 'function') renderItems(); } catch (e) {}
    return id;
  }
  function recvSetMin(r, v) { var x = (items || []).filter(function (i) { return String(i.id) === String(r.id); })[0]; if (!x) return; x.minStock = num(v); x.updatedAt = new Date().toISOString(); try { saveLocal(); } catch (e) {} try { scheduleReceivingAutoUpload('itemMaster'); } catch (e) {} try { renderItemsTable(); } catch (e) {} }

  /* ---------- 對照表（共用 HTML） ---------- */
  function table(x, side) {
    if (!x.p || !x.r) return '';
    return '<table class="im-t"><tr><th></th><th>🛒 ' + esc(L('採購', 'Procurement', 'ការទិញ')) + '</th><th>📦 ' + esc(L('收貨', 'Receiving', 'ការទទួល')) + '</th></tr>' + x.rows.map(function (w) {
      var mk = w.info ? '' : w.ok ? '<i class="ok">✓</i>' : w.soft ? '<i class="sf">≈</i>' : '<i class="bd">≠</i>';
      return '<tr class="' + (w.ok || w.info ? '' : w.soft ? 'soft' : 'bad') + '"><td>' + mk + esc(w.l) + '</td><td>' + esc(w.a) + '</td><td>' + esc(w.b) + (w.hint ? '<small>' + esc(w.hint) + '</small>' : '') + '</td></tr>';
    }).join('') + '</table>';
  }
  function actions(x, side) {
    var b = [], sf = x.rows.filter(function (w) { return w.k === 'safety'; })[0];
    if (x.state === 'check') b.push('<button class="im-b pri" data-im="yes">✓ ' + esc(L('是同一項', 'Same item', 'ដូចគ្នា')) + '</button><button class="im-b" data-im="no">✗ ' + esc(L('不是', 'Not the same', 'មិនមែន')) + '</button>');
    if (x.how === 'link' || x.how === 'name') b.push('<button class="im-b ghost" data-im="no">✗ ' + esc(L('不是同一項', 'Not the same item', 'មិនមែន')) + '</button>');
    if (sf && !sf.ok && side === 'proc' && sf.bv) b.push('<button class="im-b" data-im="safety" data-v="' + sf.bv + '">⬅ ' + esc(L('安全存量用收貨的 ', 'Use receiving safety ', '')) + sf.bv + '</button>');
    if (sf && !sf.ok && side === 'recv' && sf.av) b.push('<button class="im-b" data-im="min" data-v="' + sf.av + '">⬅ ' + esc(L('安全存量用採購的 ', 'Use procurement safety ', '')) + sf.av + '</button>');
    if (x.state === 'recv' && side === 'proc') b.push('<button class="im-b pri" data-im="add">➕ ' + esc(L('加入採購品項', 'Add to procurement', 'បន្ថែម')) + '</button><button class="im-b" data-im="pick">🔗 ' + esc(L('配對採購品項', 'Link to an item', 'ភ្ជាប់')) + '</button>');
    if (x.state === 'proc' && side === 'proc') b.push('<button class="im-b" data-im="pick">🔗 ' + esc(L('配對收貨品項', 'Link receiving item', 'ភ្ជាប់')) + '</button>' + (x.how === 'none' ? '<button class="im-b ghost" data-im="reset">↺ ' + esc(L('重新自動配對', 'Auto match again', '')) + '</button>' : ''));
    return b.length ? '<div class="im-acts">' + b.join('') + '</div>' : '';
  }
  function css() {
    if (document.getElementById('im-css')) return; var st = document.createElement('style'); st.id = 'im-css';
    st.textContent = '.im-wrap{max-width:1040px;margin:0 auto}.im-kpi{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 8px}.im-kpi button{border:1px solid #e2e8f0;border-left:4px solid var(--c);background:#fff;border-radius:10px;padding:7px 8px;text-align:left;cursor:pointer}.im-kpi button.on{background:#eff6ff;border-color:var(--c)}.im-kpi b{display:block;font-size:20px;color:var(--c)}.im-kpi small{font-size:11px;color:#475569}' +
      '.im-bar{display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:8px;background:#e2e8f0}.im-bar span{display:block}.im-tool{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.im-tool input{flex:1;min-width:160px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}.im-note{font-size:12px;color:#475569;margin:0 0 8px;line-height:1.5}' +
      '.im-card{background:#fff;border:1px solid #e2e8f0;border-left:4px solid var(--c);border-radius:10px;padding:8px 10px;margin-bottom:6px}.im-h{display:flex;gap:8px;align-items:center}.im-h img,.im-h .ph{width:38px;height:38px;border-radius:8px;object-fit:cover;flex:none;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px}.im-h .nm{flex:1;min-width:0;font-weight:700;font-size:14px;cursor:pointer}.im-h .nm small{display:block;font-weight:400;color:#64748b;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.im-tag{font-size:11px;font-weight:700;color:var(--c);white-space:nowrap}' +
      '.im-t{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.im-t th{font-size:11px;color:#64748b;text-align:left;font-weight:600;padding:2px 4px}.im-t td{padding:3px 4px;border-top:1px solid #f1f5f9;vertical-align:top}.im-t td:first-child{color:#475569;white-space:nowrap;width:1%}.im-t td small{display:block;color:#b45309}.im-t tr.bad td{background:#fff7ed}.im-t tr.bad td:not(:first-child){color:#b45309;font-weight:700}.im-t tr.soft td{background:#eff6ff}.im-t i{font-style:normal;display:inline-block;width:14px;font-weight:700}.im-t i.ok{color:#16a34a}.im-t i.bd{color:#dc2626}.im-t i.sf{color:#2563eb}' +
      '.im-line{font-size:12px;color:#475569;margin-top:4px}.im-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.im-b{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 10px;font-size:12.5px;cursor:pointer}.im-b.pri{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.im-b.ghost{border-style:dashed;color:#64748b}.im-pick{margin-top:6px;display:flex;gap:6px}.im-pick select{flex:1;min-width:0;padding:6px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px}' +
      '.im-box{margin-top:10px;border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;padding:8px 10px}.im-box h4{margin:0;font-size:13px;display:flex;justify-content:space-between;gap:6px}' +
      '@media(max-width:720px){.im-kpi{grid-template-columns:repeat(3,1fr)}.im-kpi b{font-size:17px}}';
    document.head.appendChild(st);
  }

  /* ---------- 採購頁「🏷️ 物品對照」分頁 ---------- */
  function mountProc() {
    var tabs = document.getElementById('page-tabs'), inv = document.getElementById('pt-inv'); if (!tabs || !inv || document.getElementById('pt-items')) return;
    var t = document.createElement('div'); t.className = 'ptab'; t.id = 'pt-items'; t.onclick = function () { showPage('items'); };
    t.innerHTML = '<span>🏷️ ' + esc(L('物品對照', 'Items', 'មុខទំនិញ')) + '</span>'; inv.parentNode.insertBefore(t, inv.nextSibling);
    var pg = document.createElement('div'); pg.className = 'page'; pg.id = 'page-items'; pg.innerHTML = '<div class="im-wrap" id="im-wrap"></div>';
    var po = document.getElementById('page-po'); po.parentNode.insertBefore(pg, po.nextSibling);
    var sp = root.showPage; root.showPage = function (p) { if (p !== 'items') { var r = sp.apply(this, arguments); return r; } sp.call(this, 'po'); document.querySelectorAll('.page').forEach(function (e) { e.classList.remove('on'); }); document.querySelectorAll('.ptab').forEach(function (e) { e.classList.remove('on'); }); pg.classList.add('on'); t.classList.add('on'); var h = document.getElementById('htitle'); if (h) h.textContent = L('物品對照（採購 ⇄ 收貨）', 'Items (Procurement ⇄ Receiving)', 'មុខទំនិញ'); draw(); loadRecv(true).then(draw); };
    try { showPage = root.showPage; } catch (e) {}
  }
  function draw() {
    var w = document.getElementById('im-wrap'); if (!w) return; css();
    var all = pairs(), c = { ok: 0, diff: 0, check: 0, proc: 0, recv: 0 }; all.forEach(function (x) { c[x.state]++; });
    var todo = all.length - c.ok, q = norm(S.q), f = S.filter;
    var list = all.filter(function (x) { return (f === 'all' || (f === 'todo' ? x.state !== 'ok' : x.state === f)) && (!q || norm([x.p && x.p.name, x.p && x.p.cn, x.r && x.r.name].join(' ')).indexOf(q) >= 0); });
    var order = { check: 0, diff: 1, recv: 2, proc: 3, ok: 4 }; list.sort(function (a, b) { return order[a.state] - order[b.state] || String(a.name).localeCompare(String(b.name)); });
    var kp = ['ok', 'diff', 'check', 'proc', 'recv'];
    var h = '<div class="im-kpi">' + kp.map(function (k) { return '<button data-f="' + k + '" class="' + (f === k ? 'on' : '') + '" style="--c:' + ST[k].c + '"><b>' + c[k] + '</b><small>' + esc(stLabel(k)) + '</small></button>'; }).join('') + '</div>' +
      '<div class="im-bar" title="' + all.length + '">' + kp.map(function (k) { return c[k] ? '<span style="width:' + (c[k] * 100 / Math.max(1, all.length)).toFixed(1) + '%;background:' + ST[k].c + '"></span>' : ''; }).join('') + '</div>' +
      '<div class="im-tool"><input id="im-q" placeholder="🔍 ' + esc(L('搜尋物品', 'Search items', 'ស្វែងរក')) + '" value="' + esc(S.q) + '"><button class="im-b' + (f === 'todo' ? ' pri' : '') + '" data-f="todo">⚠️ ' + esc(L('要處理 ', 'To check ', '')) + todo + '</button><button class="im-b' + (f === 'all' ? ' pri' : '') + '" data-f="all">' + esc(L('全部 ', 'All ', '')) + all.length + '</button><button class="im-b" data-f="reload">↻</button></div>' +
      '<p class="im-note">' + esc(L('採購 ' + procItems().length + ' 項 · 收貨 ' + (S.recv || []).length + ' 項。兩邊各自存自己的資料；名稱相同自動配對，拼字相近的請按「是同一項／不是」確認一次就記住。≠ 表示兩邊不一樣，可一鍵改成對方的數字（只改採購這邊）。',
        'Procurement ' + procItems().length + ' · Receiving ' + (S.recv || []).length + ' items. Same names match automatically; confirm similar names once. ≠ marks a difference; one tap copies the other side’s value (procurement side only).', '')) +
      (S.busy ? ' ⏳ ' + esc(L('讀取收貨雲端資料…', 'Loading receiving data…', '')) : '') + (S.err ? ' ⚠️ ' + esc(S.err) : '') + '</p>' +
      (list.length ? list.map(function (x, i) { return card(x, i); }).join('') : '<p class="im-note">✅ ' + esc(L('沒有要處理的物品', 'Nothing to check', '')) + '</p>');
    w.innerHTML = h; w._list = list;
    var qi = document.getElementById('im-q'); if (qi) qi.oninput = function () { S.q = this.value; clearTimeout(qi._t); qi._t = setTimeout(function () { draw(); var n = document.getElementById('im-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
    w.onclick = function (e) {
      var fb = e.target.closest('[data-f]'); if (fb) { var v = fb.getAttribute('data-f'); if (v === 'reload') { loadRecv(true).then(draw); draw(); return; } S.filter = S.filter === v && v !== 'todo' && v !== 'all' ? 'todo' : v; draw(); return; }
      var cd = e.target.closest('.im-card'); if (!cd) return; var x = w._list[+cd.getAttribute('data-i')]; if (!x) return;
      if (e.target.closest('.nm') && x.p && root.GAProcCard) { GAProcCard.open(x.p.id); return; }
      if (e.target.closest('.nm') && !x.p) { location.href = 'receiving.html'; return; }
      var b = e.target.closest('[data-im]'); if (!b) return; act(x, b.getAttribute('data-im'), b, cd);
    };
    w.onchange = function (e) { var s = e.target.closest('select[data-pick]'); if (!s || !s.value) return; var cd = s.closest('.im-card'), x = w._list[+cd.getAttribute('data-i')], R = S.recv || [], P = procItems();
      if (x.p) { var r = R.filter(function (i) { return String(i.id) === s.value; })[0]; setLink(x.p.id, r, x.p).then(draw); }
      else { var p = P.filter(function (i) { return String(i.id) === s.value; })[0]; setLink(p.id, x.r, p).then(draw); }
      draw(); };
  }
  function card(x, i) {
    var t = ST[x.state], p = x.p, r = x.r, sub = p && r ? (norm(p.name) === norm(r.name) ? '' : L('收貨名稱：', 'Receiving name: ', '') + r.name) : p ? L('收貨頁沒有這個品項', 'Not in receiving', '') + ' · ' + (PCAT[p.cat] || [p.cat])[0] + ' · ' + (p.unit || 'pcs') + ' · ' + L('安全存量 ', 'safety ', '') + (p.safety || '—') + (p.close != null ? ' · ' + (p.month + 1) + L('月底 ', ' end ', '') + fmt(p.close) : '') : L('採購頁沒有這個品項', 'Not in procurement', '') + (x.dup ? ' · ⚠️ ' + L('可能和收貨的「' + x.dup + '」重複', 'may duplicate “' + x.dup + '”', '') : '') + ' · ' + (r.category || '—') + (r.size ? ' · ' + r.size : '') + ' · ' + L('庫存 ', 'stock ', '') + fmt(r.stock) + ' · ' + L('安全存量 ', 'min ', '') + (r.minStock || '—');
    var body = '';
    if (p && r) body = x.state === 'ok' ? '<div class="im-line">' + x.rows.filter(function (w) { return w.k !== 'name'; }).map(function (w) { return esc(w.l) + ' <b>' + esc(w.a) + '</b>' + (String(w.a) === String(w.b) ? '' : ' / ' + esc(w.b)); }).join(' · ') + '</div>' : table(x, 'proc');
    return '<div class="im-card" data-i="' + i + '" style="--c:' + t.c + '"><div class="im-h">' + (x.photo ? '<img src="' + esc(x.photo) + '" alt="">' : '<div class="ph">' + esc(p && p.e || '📦') + '</div>') + '<div class="nm">' + esc(x.name) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><span class="im-tag">' + esc(stLabel(x.state)) + (x.bad ? ' ' + x.bad : '') + '</span></div>' + body + actions(x, 'proc') + '</div>';
  }
  function act(x, a, b, cd) {
    if (a === 'yes') { setLink(x.p.id, x.r, x.p).then(redraw); redraw(); return; }
    if (a === 'no') { setLink(x.p.id, null, x.p).then(redraw); redraw(); return; }
    if (a === 'reset') { var o = {}; o['itemlink:' + x.p.id] = { recvId: '', reset: 1, updatedAt: new Date().toISOString() }; GA.SharedPhoto.put(o).then(redraw); redraw(); return; }
    if (a === 'safety') { procSetSafety(x.p.id, b.getAttribute('data-v')); redraw(); toast2(L('已更新採購安全存量', 'Safety stock updated', '')); return; }
    if (a === 'min') { recvSetMin(x.r, b.getAttribute('data-v')); redraw(); toast2(L('已更新收貨安全存量', 'Min stock updated', '')); return; }
    if (a === 'add') { var id = procAddFromRecv(x.r); if (id) { setLink(id, x.r, { name: x.r.name }).then(redraw); toast2(L('已加入採購品項：', 'Added: ', '') + x.r.name); } redraw(); return; }
    if (a === 'pick') {
      if (cd.querySelector('.im-pick')) return; var opts;
      if (x.p) { var R = (S.recv || []).slice().sort(function (u, v) { return Math.max(sim(x.p.name, v.name), sim(x.p.cn, v.name)) - Math.max(sim(x.p.name, u.name), sim(x.p.cn, u.name)) || String(u.name).localeCompare(String(v.name)); }); opts = R.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name + (r.size ? ' · ' + r.size : '') + ' · ' + (r.category || '')) + '</option>'; }); }
      else { var P = procItems().slice().sort(function (u, v) { return Math.max(sim(v.name, x.r.name), sim(v.cn, x.r.name)) - Math.max(sim(u.name, x.r.name), sim(u.cn, x.r.name)) || String(u.name).localeCompare(String(v.name)); }); opts = P.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name + (p.cn ? ' · ' + p.cn : '')) + '</option>'; }); }
      var d = document.createElement('div'); d.className = 'im-pick'; d.innerHTML = '<select data-pick="1"><option value="">' + esc(L('選擇要配對的品項…', 'Choose the matching item…', '')) + '</option>' + opts.join('') + '</select>'; cd.appendChild(d); return;
    }
  }
  function redraw() { draw(); refreshCards(); }
  function toast2(m) { try { if (typeof toast === 'function') toast(m, 'success'); else if (GA.toast) GA.toast(m); } catch (e) {} }

  /* ---------- 物品卡片內的對照區塊 ---------- */
  function find(side, id) { var all = pairs(); return all.filter(function (x) { return side === 'proc' ? x.p && String(x.p.id) === String(id) : x.r && String(x.r.id) === String(id); })[0]; }
  function boxHtml(side, id) {
    css(); var x = find(side, id), t; if (!x) return '';
    t = ST[x.state];
    var other = side === 'proc' ? L('收貨', 'Receiving', '') : L('採購', 'Procurement', '');
    var msg = x.state === 'proc' && side === 'proc' ? L('收貨頁沒有這個品項（或還沒配對）。', 'Not found in receiving (or not linked yet).', '') : x.state === 'recv' && side === 'recv' ? L('採購頁沒有這個品項（或還沒配對）。可到 採購 → 🏷️ 物品對照 加入或配對。', 'Not in procurement (or not linked). Use Procurement → 🏷️ Items to add or link.', '') : '';
    return '<div class="im-box" data-imbox="' + side + '" data-id="' + esc(id) + '" style="border-left:4px solid ' + t.c + '"><h4><span>🔗 ' + esc(other) + L('對照', ' comparison', '') + '</span><span style="color:' + t.c + '">' + esc(stLabel(x.state)) + (x.bad ? ' ' + x.bad : '') + '</span></h4>' + (msg ? '<div class="im-line">' + esc(msg) + '</div>' : '') + table(x, side) + actions(x, side) + (side === 'proc' && x.state !== 'ok' ? '' : '') + '</div>';
  }
  function bindBox(rootEl) {
    var bx = rootEl && rootEl.querySelector('.im-box'); if (!bx || bx._b) return; bx._b = 1;
    bx.addEventListener('click', function (e) { var b = e.target.closest('[data-im]'); if (!b) return; e.stopPropagation(); var side = bx.getAttribute('data-imbox'), x = find(side, bx.getAttribute('data-id')); if (!x) return;
      if (b.getAttribute('data-im') === 'pick' || b.getAttribute('data-im') === 'add') { if (isProc) { try { GAProcCard.close(); } catch (er) {} showPage('items'); S.q = x.name; draw(); } return; }
      act(x, b.getAttribute('data-im'), b, bx); });
  }
  function refreshCards() {
    ['pc-b', 'ic-b'].forEach(function (id) { var b = document.getElementById(id); if (!b) return; var o = b.querySelector('.im-box'); if (!o) return; var d = document.createElement('div'); d.innerHTML = boxHtml(o.getAttribute('data-imbox'), o.getAttribute('data-id')); if (d.firstChild) { o.parentNode.replaceChild(d.firstChild, o); bindBox(b); } });
  }
  /* 卡片「資料」分頁顯示時加上對照區塊 */
  function hookCards() {
    var mo = new MutationObserver(function () {
      [['pc-b', 'proc', function () { return root.GAProcCardCurrent && GAProcCardCurrent(); }], ['ic-b', 'recv', function () { return root.GAItemCardCurrent && GAItemCardCurrent(); }]].forEach(function (c) {
        var b = document.getElementById(c[0]); if (!b || b.querySelector('.im-box')) return; var cur = c[2](); if (!cur || cur.tab !== 'info' || cur.id == null) return;
        var h = boxHtml(c[1], cur.id); if (!h) return; var nx = b.querySelector('.ic-next,.pc-next'), d = document.createElement('div'); d.innerHTML = h;
        if (nx) b.insertBefore(d.firstChild, nx); else b.appendChild(d.firstChild); bindBox(b);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  GA.ItemMaster = { pairs: pairs, sim: sim, loadRecv: loadRecv, loadProc: loadProc, draw: draw, boxHtml: boxHtml, state: S };
  function start() {
    if (isProc) { mountProc(); loadRecv().then(function () { draw(); refreshCards(); }); }
    else if (isRecv) { loadRecv(); loadProc().then(refreshCards); }
    hookCards();
    if (GA.SharedPhoto) GA.SharedPhoto.onLoad(function () { draw(); refreshCards(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 300); }); else setTimeout(start, 300);
})(window);
