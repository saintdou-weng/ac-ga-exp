/* ga-photo-chart.js — 照片表 Excel（編號＋內嵌照片）直接匯入成物品標準照（2026-11-19）
   Paul 11/19：有編號的總務用品做成可放圖的 Excel，讓人貼照片，之後直接匯入。
   ・讀 .xlsx 裡的圖片（浮動圖片用圖片垂直中心對到哪一列；也支援「放在儲存格內」的圖片）＋同一列的文字。
   ・對物品：灰色 ID 欄（recv:… / proc:…）最準；沒有就用「編號」對收貨物品 No.，再用品名。
   ・匯入前先列出「每張照片 → 哪個物品」給人確認；同一張照片不重複上傳。
   ・照片壓縮後上傳 Drive（recvItemAttachment），設成⭐標準照，採購與收貨共用（GA.SharedPhoto）。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || root.GAPhotoChart) return;
  function L(z, e, k) { var l = (typeof lang !== 'undefined' && lang) || GA.lang || 'zh'; return l === 'zh' ? z : l === 'km' ? (k || e) : e; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s\-_.,:;'"()（）\[\]【】/\\|+&#]+/g, ''); }

  /* ── xlsx 解壓（瀏覽器內建 DecompressionStream）── */
  async function unzip(buf) {
    var dv = new DataView(buf), eo = -1, i; for (i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; } }
    if (eo < 0) throw new Error(L('不是 .xlsx 檔', 'Not an .xlsx file', 'មិនមែន .xlsx'));
    var n = dv.getUint16(eo + 10, true), p = dv.getUint32(eo + 16, true), F = {}, td = new TextDecoder();
    for (var k = 0; k < n; k++) { if (dv.getUint32(p, true) !== 0x02014b50) break; var m = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true); F[td.decode(new Uint8Array(buf, p + 46, nl))] = { m: m, cs: cs, lo: lo }; p += 46 + nl + el + cl; }
    async function get(name) { var f = F[name]; if (!f) return null; var a = dv.getUint16(f.lo + 26, true), b = dv.getUint16(f.lo + 28, true), d = new Uint8Array(buf, f.lo + 30 + a + b, f.cs); if (f.m === 0) return d.slice(); var out = await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer(); return new Uint8Array(out); }
    return { get: get, text: async function (nm) { var u = await get(nm); return u ? td.decode(u) : ''; } };
  }
  function xml(s) { return new DOMParser().parseFromString(s || '<x/>', 'application/xml'); }
  function tags(node, name) { return Array.prototype.slice.call(node.getElementsByTagNameNS('*', name)); }
  function resolve(base, t) { if (t.charAt(0) === '/') return t.slice(1); var p = base.split('/'); p.pop(); t.split('/').forEach(function (s) { if (s === '..') p.pop(); else if (s !== '.') p.push(s); }); return p.join('/'); }
  async function rels(z, path) { var p = path.split('/'), f = p.pop(), doc = xml(await z.text(p.concat(['_rels', f + '.rels']).join('/'))), o = {}; tags(doc, 'Relationship').forEach(function (r) { o[r.getAttribute('Id')] = { t: resolve(path, r.getAttribute('Target')), type: r.getAttribute('Type') || '' }; }); return o; }
  function rid(el) { for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if (/(^|:)(embed|id)$/.test(a.name) && /^rId/.test(a.value)) return a.value; } return ''; }
  function cr(ref) { var m = String(ref).match(/^([A-Z]+)(\d+)/); if (!m) return [0, 0]; var c = 0; for (var i = 0; i < m[1].length; i++) c = c * 26 + m[1].charCodeAt(i) - 64; return [c - 1, +m[2] - 1]; }
  function mime(n) { return /\.png$/i.test(n) ? 'image/png' : /\.gif$/i.test(n) ? 'image/gif' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.bmp$/i.test(n) ? 'image/bmp' : ''; }

  /* 回傳 [{sheet,row,cells:{欄:字},head:{欄:表頭},blob}] */
  async function read(file) {
    var z = await unzip(await file.arrayBuffer()), out = [], ss = [];
    tags(xml(await z.text('xl/sharedStrings.xml')), 'si').forEach(function (si) { ss.push(tags(si, 't').map(function (t) { return t.textContent; }).join('')); });
    var wb = xml(await z.text('xl/workbook.xml')), wrel = await rels(z, 'xl/workbook.xml'), rvRel = [], rv = [];
    try { var rr = await rels(z, 'xl/richData/richValueRel.xml'); rvRel = tags(xml(await z.text('xl/richData/richValueRel.xml')), 'rel').map(function (r) { return (rr[rid(r)] || {}).t; }); rv = tags(xml(await z.text('xl/richData/rdrichvalue.xml')), 'rv').map(function (x) { var v = tags(x, 'v')[0]; return v ? +v.textContent : -1; }); } catch (e) {}
    var sheets = tags(wb, 'sheet');
    for (var si2 = 0; si2 < sheets.length; si2++) {
      var sh = sheets[si2], rel = wrel[rid(sh)]; if (!rel) continue;
      var path = rel.t, doc = xml(await z.text(path)), rows = {}, inCell = [];
      tags(doc, 'c').forEach(function (c) { var rc = cr(c.getAttribute('r')), t = c.getAttribute('t'), v = '', x; if (t === 's') { x = tags(c, 'v')[0]; v = x ? ss[+x.textContent] || '' : ''; } else if (t === 'inlineStr') v = tags(c, 't').map(function (q) { return q.textContent; }).join(''); else { x = tags(c, 'v')[0]; v = x ? x.textContent : ''; }
        var vm = c.getAttribute('vm'); if (vm && rv.length) { var media = rvRel[rv[+vm - 1]]; if (media) inCell.push({ media: media, row: rc[1] }); v = ''; }
        v = String(v).trim(); if (v && v !== '📷') { (rows[rc[1]] = rows[rc[1]] || {})[rc[0]] = v; } });
      var fmt = tags(doc, 'sheetFormatPr')[0], defH = (fmt && +fmt.getAttribute('defaultRowHeight')) || 15, RH = {}, HID = {};
      tags(doc, 'row').forEach(function (r) { var i = +r.getAttribute('r') - 1, h = r.getAttribute('ht'); if (h) RH[i] = +h; if (r.getAttribute('hidden') === '1') HID[i] = 1; });
      var rowH = function (r) { return HID[r] ? 0 : (RH[r] != null ? RH[r] : defH) * 12700; }, yOf = function (r, off) { var y = 0; for (var k = 0; k < r; k++) y += rowH(k); return y + (+off || 0); };
      var rowAt = function (y) { var acc = 0; for (var k = 0; k < 20000; k++) { var h = rowH(k); if (h && y < acc + h) return k; acc += h; } return 0; };
      var imgs = [], srel = await rels(z, path);
      for (var id in srel) { if (!/drawing$/.test(srel[id].type)) continue; var dpath = srel[id].t, ddoc = xml(await z.text(dpath)), drel = await rels(z, dpath);
        tags(ddoc, 'twoCellAnchor').concat(tags(ddoc, 'oneCellAnchor')).forEach(function (a) { var fr = tags(a, 'from')[0], to = tags(a, 'to')[0], blip = tags(a, 'blip')[0]; if (!fr || !blip) return; var m = drel[rid(blip)]; if (!m) return;
          var num = function (el, nm) { var q = el && tags(el, nm)[0]; return q ? +q.textContent : 0; }, y0 = yOf(num(fr, 'row'), num(fr, 'rowOff')), y1 = y0;
          if (to) y1 = yOf(num(to, 'row'), num(to, 'rowOff')); else { var ext = tags(a, 'ext')[0]; y1 = y0 + (ext ? +ext.getAttribute('cy') || 0 : 0); }
          imgs.push({ media: m.t, row: y1 > y0 ? rowAt((y0 + y1) / 2) : num(fr, 'row') }); }); }
      inCell.forEach(function (x) { imgs.push(x); });
      if (!imgs.length) continue;
      /* 表頭：第一張照片上面、最近一列有 2 格以上字的 */
      var first = Math.min.apply(null, imgs.map(function (x) { return x.row; })), head = {};
      for (var r = first - 1; r >= 0 && r >= first - 15; r--) { var cc = rows[r] || {}; if (Object.keys(cc).length >= 2) { head = cc; break; } }
      for (var j = 0; j < imgs.length; j++) { var im = imgs[j], bytes = await z.get(im.media), mt = mime(im.media); if (!bytes || !mt) continue; out.push({ sheet: sh.getAttribute('name'), row: im.row, cells: rows[im.row] || {}, head: head, blob: new Blob([bytes], { type: mt }), media: im.media }); }
    }
    return out;
  }
  /* 依表頭找欄：ID、編號、品名 */
  function col(head, re) { for (var k in head) if (re.test(head[k])) return +k; return -1; }
  function fields(r) { var h = r.head, c = r.cells, get = function (re) { var k = col(h, re); return k >= 0 ? c[k] || '' : ''; };
    return { id: get(/\bID\b/), code: get(/編號|code|key\s*no|^no\.?$|編碼|កូដ|លេខ/i), name: get(/品名|item|名稱|name|ឈ្មោះ/i), cn: get(/中文|chinese/i) }; }
  async function sha(blob) { var b = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()); return Array.prototype.map.call(new Uint8Array(b).slice(0, 12), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function compress(blob, max, q) { max = max || 1280; q = q || 0.75; return new Promise(function (res) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { var s = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); res(cv.toDataURL('image/jpeg', q)); }; im.onerror = function () { URL.revokeObjectURL(u); res(null); }; im.src = u; }); }

  /* ── 總務物品（收貨＋採購）── */
  function recvList() { try { return items || []; } catch (e) { try { var d = JSON.parse(localStorage.getItem('vrt_receive_data') || 'null'); return d && d.items || []; } catch (er) { return []; } } }
  function procList() { try { if (typeof allItems === 'function') return allItems(); } catch (e) {} try { var c = JSON.parse(localStorage.getItem('ga_proc_items_v1') || 'null'); return c && c.items || []; } catch (e) { return []; } }
  function match(f) {
    var R = recvList(), P = procList(), m = { r: null, p: null };
    String(f.id || '').split('|').forEach(function (t) { var a = t.split(':'); if (a[0] === 'recv') m.r = R.filter(function (x) { return String(x.id) === a[1]; })[0] || null; if (a[0] === 'proc') m.p = P.filter(function (x) { return String(x.id) === a[1]; })[0] || (f.name ? { id: /^\d+$/.test(a[1]) ? +a[1] : a[1], name: f.name, cn: f.cn } : null); });
    if (!m.r && !m.p && f.code) { var no = String(f.code).replace(/-PO$/i, ''); m.r = R.filter(function (x) { return String(x.no) === no && (/-PO$/i.test(f.code) ? x.category === 'PO' : x.category !== 'PO'); })[0] || null; if (!m.r) m.r = R.filter(function (x) { return String(x.no) === no; })[0] || null; }
    if (!m.r && !m.p && f.name) { var n = norm(f.name); m.r = R.filter(function (x) { return norm(x.name) === n; })[0] || null; if (!m.r) m.p = P.filter(function (x) { return norm(x.name) === n || (f.cn && norm(x.cn) === norm(f.cn)); })[0] || null; }
    if (m.r && m.p && f.name && norm(m.r.name) !== norm(f.name) && norm(m.p.name) === norm(f.name)) {} /* 兩邊都對到就兩邊都放 */
    return m;
  }
  function has(m, h) { var p = m.r && m.r.photo; if (p && p.hash === h) return true; try { var s = m.p && itemSettings[m.p.id]; if (s && s.photo && s.photo.hash === h) return true; } catch (e) {} return false; }

  function css() { if (document.getElementById('pcx-css')) return; var s = document.createElement('style'); s.id = 'pcx-css';
    s.textContent = '#pcx-ov{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9600;display:flex;align-items:center;justify-content:center}.pcx{background:#fff;width:min(900px,96vw);max-height:92vh;border-radius:14px;display:flex;flex-direction:column}.pcx-h{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e2e8f0}.pcx-b{overflow:auto;padding:12px 14px}.pcx-f{padding:10px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.pcx table{width:100%;border-collapse:collapse;font-size:13px}.pcx td,.pcx th{border-bottom:1px solid #f1f5f9;padding:4px 6px;text-align:left;vertical-align:middle}.pcx img{width:56px;height:56px;object-fit:cover;border-radius:8px}.pcx tr.ok td{background:#f0fdf4}.pcx tr.no td{background:#fef2f2}.pcx tr.dup td{background:#f8fafc;color:#94a3b8}.pcx .btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:13px}.pcx .btn.pri{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.pcx-note{font-size:12.5px;color:#475569;line-height:1.5}';
    document.head.appendChild(s); }
  function open() {
    css(); var ov = document.createElement('div'); ov.id = 'pcx-ov';
    ov.innerHTML = '<div class="pcx"><div class="pcx-h"><b>📥 ' + esc(L('匯入照片表（Excel 編號＋照片）', 'Import photo chart (Excel code + photo)', 'នាំចូលតារាងរូបភាព')) + '</b><button class="btn" data-x>✕</button></div><div class="pcx-b" id="pcx-b"><p class="pcx-note">' +
      esc(L('選「總務用品照片表」或任何「一列一個編號＋照片」的 Excel。系統會讀出每張照片對到哪個物品，先給你看，確認後才匯入；照片設成⭐標準照，收貨與採購共用。', 'Choose the GA Supplies Photo Chart or any Excel with one code + photo per row. You review the matches first; photos become the shared ⭐ standard photo.', 'ជ្រើស Excel ដែលមានលេខកូដ និងរូប')) +
      '</p><label class="btn pri">📂 ' + esc(L('選 Excel 檔', 'Choose Excel file', 'ជ្រើសឯកសារ')) + '<input type="file" accept=".xlsx,.xlsm" id="pcx-file" style="display:none"></label></div><div class="pcx-f" id="pcx-f"></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
    document.body.appendChild(ov);
    ov.querySelector('#pcx-file').onchange = function () { var f = this.files && this.files[0]; if (f) load(f); };
  }
  var ROWS = [];
  async function load(file) {
    var b = document.getElementById('pcx-b'); b.innerHTML = '⏳ ' + esc(L('讀取中…', 'Reading…', 'កំពុងអាន…'));
    try {
      var rs = await read(file); ROWS = [];
      for (var i = 0; i < rs.length; i++) { var r = rs[i], f = fields(r), m = match(f), h = await sha(r.blob); ROWS.push({ f: f, m: m, h: h, blob: r.blob, url: URL.createObjectURL(r.blob), row: r.row + 1, sheet: r.sheet, on: !!(m.r || m.p) && !has(m, h), dup: has(m, h) }); }
      /* 同一個物品出現兩張照片：只留最後一張 */
      var seen = {}; ROWS.slice().reverse().forEach(function (x) { var k = (x.m.r ? 'r' + x.m.r.id : '') + (x.m.p ? 'p' + x.m.p.id : ''); if (!k) return; if (seen[k]) x.on = false; seen[k] = 1; });
      paint();
    } catch (e) { b.innerHTML = '❌ ' + esc(e.message || e); }
  }
  function paint() {
    var b = document.getElementById('pcx-b'), ok = ROWS.filter(function (x) { return x.on; }).length, no = ROWS.filter(function (x) { return !x.m.r && !x.m.p; }).length, dup = ROWS.filter(function (x) { return x.dup; }).length;
    b.innerHTML = '<p class="pcx-note">🖼️ ' + ROWS.length + L(' 張照片 · 🟢 會匯入 ', ' photos · 🟢 to import ', ' រូប · 🟢 ') + ok + ' · ⚪ ' + L('已經有了 ', 'already set ', 'មានរួច ') + dup + ' · 🔴 ' + L('對不到物品 ', 'no match ', 'រកមិនឃើញ ') + no + '</p>' +
      '<table><tr><th></th><th>' + esc(L('照片', 'Photo', 'រូប')) + '</th><th>' + esc(L('列', 'Row', 'ជួរ')) + '</th><th>' + esc(L('編號／品名（Excel）', 'Code / item (Excel)', 'កូដ / ទំនិញ')) + '</th><th>' + esc(L('對到', 'Matched to', 'ផ្គូផ្គង')) + '</th></tr>' +
      ROWS.map(function (x, i) { var m = x.m, t = m.r || m.p ? [m.r ? '📦 ' + esc((m.r.no ? m.r.no + ' · ' : '') + m.r.name) : '', m.p ? '🛒 ' + esc(m.p.name + (m.p.cn ? ' · ' + m.p.cn : '')) : ''].filter(Boolean).join('<br>') : '🔴 ' + esc(L('對不到（請檢查編號）', 'No match (check the code)', 'រកមិនឃើញ'));
        return '<tr class="' + (x.dup ? 'dup' : m.r || m.p ? 'ok' : 'no') + '"><td><input type="checkbox" data-i="' + i + '"' + (x.on ? ' checked' : '') + (m.r || m.p ? '' : ' disabled') + '></td><td><img src="' + x.url + '"></td><td>' + x.row + '</td><td>' + esc(x.f.code) + ' ' + esc(x.f.name) + (x.f.cn ? ' · ' + esc(x.f.cn) : '') + '</td><td>' + t + (x.dup ? ' <small>（' + esc(L('同一張已經是標準照', 'same photo already set', 'មានរួច')) + '）</small>' : '') + '</td></tr>'; }).join('') + '</table>';
    b.querySelectorAll('input[data-i]').forEach(function (c) { c.onchange = function () { ROWS[+c.getAttribute('data-i')].on = c.checked; foot(); }; });
    foot();
  }
  function foot() { var n = ROWS.filter(function (x) { return x.on; }).length, f = document.getElementById('pcx-f'); f.innerHTML = '<button class="btn pri" id="pcx-go"' + (n ? '' : ' disabled') + '>✅ ' + esc(L('匯入 ', 'Import ', 'នាំចូល ')) + n + esc(L(' 張', ' photos', ' រូប')) + '</button><span class="pcx-note" id="pcx-st"></span>'; var g = document.getElementById('pcx-go'); if (g) g.onclick = go; }
  async function go() {
    var list = ROWS.filter(function (x) { return x.on; }), st = document.getElementById('pcx-st'), g = document.getElementById('pcx-go'), done = 0, fail = 0, recvChanged = false, procChanged = false; g.disabled = true;
    for (var i = 0; i < list.length; i++) {
      var x = list[i], m = x.m; st.textContent = '⏳ ' + (i + 1) + ' / ' + list.length;
      try {
        var data = await compress(x.blob); if (!data) throw new Error('image');
        var r = await GA.gasPost('recvItemAttachment', { itemId: m.r ? m.r.id : 'proc_' + m.p.id, effectiveFrom: '0000-01', fileName: (x.f.code || 'item') + '.jpg', mimeType: 'image/jpeg', data: data.replace(/^data:[^;]+;base64,/, ''), hash: x.h }), d = (r && r.data) || r || {};
        if (!d.url) throw new Error('no file URL');
        var e = Object.assign({ fileName: (x.f.code || 'item') + '.jpg', mimeType: 'image/jpeg', hash: x.h, createdAt: new Date().toISOString(), source: 'photo-chart' }, d);
        var names = []; if (m.r) { names.push(m.r.name); try { var live = items.filter(function (y) { return String(y.id) === String(m.r.id); })[0]; if (live) { live.photo = e; live.updatedAt = e.createdAt; recvChanged = true; } } catch (er) {} }
        if (m.p) { names.push(m.p.name, m.p.cn); try { itemSettings[m.p.id] = Object.assign({}, itemSettings[m.p.id] || {}, { photo: e }); procChanged = true; } catch (er) {} }
        if (GA.SharedPhoto) await GA.SharedPhoto.set(names.filter(Boolean), e);
        x.on = false; x.dup = true; done++;
      } catch (er) { fail++; x.err = er && er.message || String(er); console.warn('photo chart', er); }
    }
    try { if (recvChanged) { saveLocal(); scheduleReceivingAutoUpload('photo-chart'); renderItemsTable(); } } catch (e) {}
    try { if (procChanged) { saveState(); if (typeof renderInv === 'function') renderInv(); } } catch (e) {}
    try { if (GA.ItemMaster) GA.ItemMaster.draw(); } catch (e) {}
    paint(); document.getElementById('pcx-st').textContent = '✅ ' + L('已匯入 ', 'Imported ', 'បាននាំចូល ') + done + (fail ? ' · ❌ ' + L('失敗 ', 'failed ', 'បរាជ័យ ') + fail + L('（可再按一次重試）', ' (press again to retry)', '') : '');
  }
  /* 入口：收貨頁、採購頁右下角（💡 按鈕上面）一顆小按鈕 */
  function btn() {
    if (document.getElementById('pcx-btn')) return; css();
    var b = document.createElement('button'); b.id = 'pcx-btn'; b.type = 'button'; b.title = L('匯入照片表', 'Import photo chart', 'នាំចូលតារាងរូបភាព'); b.innerHTML = '📥🖼️';
    b.style.cssText = 'position:fixed;right:14px;bottom:70px;z-index:9000;border:0;border-radius:999px;background:#0f766e;color:#fff;font-size:15px;padding:9px 12px;box-shadow:0 6px 18px rgba(15,118,110,.35);cursor:pointer';
    b.onclick = open; document.body.appendChild(b);
  }
  root.GAPhotoChart = { read: read, open: open, fields: fields };
  if (/receiving|procurement/i.test(location.pathname)) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(btn, 900); }); else setTimeout(btn, 900); }
})(window);
