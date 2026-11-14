/* ga-proc-card.js — 採購（月度 PO）物品資訊卡 2026-11-14
   和收貨的物品資訊卡同一種用法：在「庫存」表點物品名稱（手機點卡片上方）→ 資訊卡。
   分頁：📋 資料／📈 每月（今年每月期初·採購·使用·期末）／🧾 採購記錄（PO 與逐筆收發）／📷 照片
   照片：標準照（最正確）＋每月「收到不同」「異常」，依月份分組、同一張不重複；存在 itemSettings[id].photo / monthPhotos，
   跟著採購頁原本的雲端狀態一起存（saveState）。左右滑換物品；滑到底接下一個。只讀現有資料，不改庫存數字。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || !document.getElementById('inv-cards-mobile')) return;
  function LG() { try { return lang; } catch (e) { return GA.lang || 'zh'; } }
  function L(zh, en, km) { var l = LG(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  var S = { id: null, tab: 'info', year: null };
  var css = document.createElement('style');
  css.textContent = '.pc-ov{position:fixed;inset:0;background:#0f172a99;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}.pc-sheet{background:#f8fafc;border-radius:16px;width:100%;max-width:780px;overflow:hidden;box-shadow:0 20px 60px #0006}' +
    '.pc-h{background:#1e3a5f;color:#fff;padding:12px;display:flex;gap:9px;align-items:center}.pc-h img,.pc-h .ph{width:46px;height:46px;border-radius:9px;object-fit:cover;background:#ffffff22;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}.pc-h h3{margin:0;font-size:16px;line-height:1.25;flex:1;min-width:0}.pc-h h3 small{display:block;font-size:11px;font-weight:600;opacity:.88;margin-top:2px}.pc-h button{background:#ffffff2e;border:0;color:#fff;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;flex:none}.pc-h button:disabled{opacity:.3}' +
    '.pc-k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 12px 0}.pc-k div{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;border-top:4px solid var(--c,#2563eb);min-width:0}.pc-k b{display:block;font-size:19px;color:var(--c,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-k small{font-size:10.5px;color:#64748b;font-weight:700}' +
    '.pc-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0;margin-top:10px}.pc-tabs button{flex:1;border:0;background:none;padding:10px 3px;font:inherit;font-weight:800;font-size:12.5px;color:#64748b;border-bottom:3px solid transparent;cursor:pointer}.pc-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}.pc-b{padding:12px;max-height:56vh;overflow:auto}' +
    '.pc-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pc-f{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.pc-f small{display:block;font-size:10.5px;color:#64748b;font-weight:700}.pc-f b{font-size:13.5px;word-break:break-word}.pc-f.w{grid-column:1/-1}' +
    '.pc-m{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff}.pc-m th,.pc-m td{border-bottom:1px solid #e2e8f0;padding:6px 7px;text-align:right}.pc-m th:first-child,.pc-m td:first-child{text-align:left}.pc-m th{background:#f1f5f9;font-size:11px}.pc-m tr.cur td{background:#fff7ed;font-weight:800}' +
    '.pc-rec{display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-left:4px solid var(--c);border-radius:9px;padding:7px 10px;margin-bottom:6px;font-size:12.5px}.pc-rec small{color:#64748b;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc-rec .q{font-weight:800;font-size:15px;color:var(--c);white-space:nowrap}' +
    '.pc-ph2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pc-phbox{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px;min-width:0}.pc-phbox h5{margin:0 0 6px;font-size:12px;color:#475569}.pc-phimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;color:#94a3b8}' +
    '.pc-btns{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.pc-btns button{flex:1;min-width:110px}.pc-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer}.pc-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}' +
    '.pc-mo{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;margin-bottom:8px}.pc-mo h5{margin:0 0 6px;font-size:12.5px;display:flex;justify-content:space-between}.pc-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px}.pc-thumbs a{position:relative;display:block}.pc-thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}.pc-tag{position:absolute;left:4px;top:4px;font-size:9.5px;font-weight:800;color:#fff;border-radius:6px;padding:1px 5px}' +
    '.pc-next{margin:14px 0 2px;padding:12px;border:1px dashed #93c5fd;border-radius:12px;background:#eff6ff;text-align:center;font-weight:800;color:#1d4ed8;cursor:pointer;font-size:13px}.pc-next small{display:block;font-weight:600;color:#64748b;margin-top:2px}' +
    '.pc-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0}#inv-tbody .itd-name,.inv-card-head{cursor:pointer}#inv-tbody .itd-name:after{content:" ›";color:#94a3b8;font-weight:400}' +
    '@media(max-width:720px){.pc-ov{padding:0;overflow:hidden}.pc-sheet{border-radius:0;height:100vh;height:100dvh;display:flex;flex-direction:column}.pc-b{max-height:none;flex:1}.pc-k{grid-template-columns:repeat(2,1fr)}.pc-k b{font-size:17px}}';
  document.head.appendChild(css);

  function items() { try { var a = [], seen = {}; Object.keys(CATS).forEach(function (k) { (CATS[k].items || []).concat((customItems || []).filter(function (c) { return c.catKey === k && !(hiddenItems || {})[c.id]; })).forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; a.push(Object.assign({ _cat: k }, it)); } }); }); return a; } catch (e) { return []; } }
  function item(id) { return items().filter(function (i) { return String(i.id) === String(id); })[0]; }
  function nm(it) { try { return IN(it); } catch (e) { return it.cn || it.name || '—'; } }
  function catName(k) { try { return CN(CATS[k]); } catch (e) { return k; } }
  function set(id) { try { return itemSettings[id] || (itemSettings[id] = { unit: 'pcs', safetyStock: 0, avgUsage: 0, autoSafety: false }); } catch (e) { return {}; } }
  function unit(id) { try { return getUnit(id); } catch (e) { return 'pcs'; } }
  function safety(id) { try { return getSafety(id); } catch (e) { return 0; } }
  function rec(m, id) { try { var r = (invRecords[getMonthKey(m, S.year || YEAR)] || {})[id]; return r || null; } catch (e) { return null; } }
  function n(v) { return Number(v) || 0; }
  function phUrl(e) { return e && (e.previewUrl || e.url) || ''; }
  function phKey(e) { return String(e && (e.hash || e.fileId || e.url) || ''); }
  function poLines(id) {
    var it = item(id), out = []; if (!it) return out; var nmL = String(it.name || '').trim().toLowerCase(), cnL = String(it.cn || '').trim().toLowerCase();
    (root.poHistoryData || (typeof poHistoryData !== 'undefined' ? poHistoryData : []) || []).forEach(function (po) { (po.items || []).forEach(function (x) { var xn = String(x.name || x.item || '').trim().toLowerCase(); if (String(x.id) === String(id) || (xn && (xn === nmL || xn === cnL))) out.push({ po: po, x: x }); }); });
    return out.sort(function (a, b) { return (n(b.po.year) * 100 + n(b.po.month)) - (n(a.po.year) * 100 + n(a.po.month)); });
  }
  function logs(id) { try { return (recvLog || []).filter(function (r) { return String(r.itemId) === String(id); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }); } catch (e) { return []; } }
  /* 2026-11-14：與收貨頁共用標準照（同名品項，英文或中文對得上），取較新的那張 */
  function std(id) { var s = set(id), own = s.photo && phUrl(s.photo) ? s.photo : null, it = item(id); return GA.SharedPhoto && it ? GA.SharedPhoto.pick(own, [it.name, it.cn]) : own; }
  function allPhotos(id) { var s = set(id), seen = {}, out = []; function add(e, ym, kind) { var k = phKey(e); if (!e || !phUrl(e) || !k || seen[k]) return; seen[k] = 1; out.push({ e: e, ym: String(ym || '').slice(0, 7), kind: kind }); } var sd = std(id); if (sd) add(sd, sd.ym, 'std'); (s.monthPhotos || []).forEach(function (m) { add(m, m.ym, m.kind === 'bad' ? 'bad' : 'diff'); }); return out; }
  var KIND = { std: ['#059669', '標準', 'Standard', 'ស្តង់ដារ'], diff: ['#d97706', '不同', 'Different', 'ខុសគ្នា'], bad: ['#dc2626', '異常', 'Abnormal', 'មិនប្រក្រតី'] };
  function kl(k) { var d = KIND[k] || KIND.diff; return L(d[1], d[2], d[3]); }
  function F(label, v, wide) { if (v === '' || v == null) return ''; return '<div class="pc-f' + (wide ? ' w' : '') + '"><small>' + esc(label) + '</small><b>' + esc(v) + '</b></div>'; }

  function open(id, keep) {
    var it = item(id); if (!it) return; S.id = it.id; if (!keep) S.tab = S.tab || 'info'; S.year = S.year || YEAR;
    var old = document.getElementById('pc-ov'); if (old) old.remove();
    var ls = items(), idx = ls.findIndex(function (x) { return String(x.id) === String(it.id); }), m = typeof invDisplayMonth === 'number' ? invDisplayMonth : new Date().getMonth(), r = rec(m, it.id) || {}, sf = safety(it.id), cl = n(r.close), low = cl > 0 && cl <= sf, ph = std(it.id), mo = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'][m];
    var ov = document.createElement('div'); ov.className = 'pc-ov'; ov.id = 'pc-ov';
    ov.innerHTML = '<div class="pc-sheet"><div class="pc-h"><button data-a="prev"' + (idx > 0 ? '' : ' disabled') + '>‹</button>' + (ph ? '<img src="' + esc(phUrl(ph)) + '" alt="">' : '<div class="ph">' + esc(it.e || '📦') + '</div>') +
      '<h3>' + esc(nm(it)) + '<small>' + esc(catName(it._cat)) + ' · ' + esc(unit(it.id)) + ' · ' + (set(it.id).monthly ? '🔁 ' + esc(L('每月固定', 'Monthly', 'ប្រចាំខែ')) : esc(L('不定期', 'Ad-hoc', 'មិនទៀងទាត់'))) + (idx >= 0 ? ' · ' + (idx + 1) + ' / ' + ls.length : '') + '</small></h3><button data-a="next"' + (idx >= 0 && idx < ls.length - 1 ? '' : ' disabled') + '>›</button><button data-a="close">×</button></div>' +
      '<div class="pc-k"><div style="--c:' + (low ? '#dc2626' : '#059669') + '"><b>' + cl + '</b><small>' + (low ? '⚠️ ' + esc(L('低於安全庫存', 'Below safety', 'ទាបជាងសុវត្ថិភាព')) : esc(mo + L('月期末', ' closing', ' ចុងគ្រា'))) + '</small></div><div style="--c:#059669"><b>' + (n(r.purchase) ? '+' + n(r.purchase) : '0') + '</b><small>' + esc(mo + L('月採購', ' purchased', ' ទិញ')) + '</small></div><div style="--c:#d97706"><b>' + (n(r.used) ? '−' + n(r.used) : '0') + '</b><small>' + esc(mo + L('月使用', ' used', ' ប្រើ')) + '</small></div><div style="--c:#2563eb"><b>' + sf + '</b><small>' + esc(L('安全庫存', 'Safety stock', 'ស្តុកសុវត្ថិភាព')) + '</small></div></div>' +
      '<div class="pc-tabs"><button data-t="info">📋 ' + esc(L('資料', 'Details', 'ព័ត៌មាន')) + '</button><button data-t="month">📈 ' + esc(L('每月', 'Monthly', 'ប្រចាំខែ')) + '</button><button data-t="rec">🧾 ' + esc(L('採購記錄', 'Purchases', 'ការទិញ')) + ' (' + poLines(it.id).length + ')</button><button data-t="photo">📷 ' + esc(L('照片', 'Photos', 'រូបថត')) + ' (' + allPhotos(it.id).length + ')</button></div><div class="pc-b" id="pc-b"></div>' +
      '<div class="pc-foot"><button class="pc-btn" data-a="unit">✏️ ' + esc(L('單位', 'Unit', 'ឯកតា')) + '</button></div></div>';
    document.body.appendChild(ov); show(S.tab);
    var sheet = ov.querySelector('.pc-sheet'), x0 = 0, y0 = 0;
    sheet.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (!t) return; var dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !(e.target.closest && e.target.closest('table'))) { if (dx < 0 && idx < ls.length - 1) open(ls[idx + 1].id, true); else if (dx > 0 && idx > 0) open(ls[idx - 1].id, true); } }, { passive: true });
    ov.onclick = function (e) {
      if (e.target === ov) { close(); return; }
      var t = e.target.closest('.pc-tabs [data-t]'); if (t) { show(t.getAttribute('data-t')); return; }
      var y = e.target.closest('[data-y]'); if (y) { S.year = Number(y.getAttribute('data-y')); show('month'); return; }
      var ph2 = e.target.closest('[data-ph]'); if (ph2) { pick(it.id, ph2.getAttribute('data-ph')); return; }
      var nx = e.target.closest('[data-nextgo]'); if (nx) { if (idx < ls.length - 1) open(ls[idx + 1].id, true); return; }
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') close(); else if (act === 'prev' && idx > 0) open(ls[idx - 1].id, true); else if (act === 'next' && idx < ls.length - 1) open(ls[idx + 1].id, true);
      else if (act === 'unit') { close(); try { openUnitEdit(it.id); } catch (er) {} }
    };
  }
  function close() { var o = document.getElementById('pc-ov'); if (o) o.remove(); S.id = null; }
  function show(t) {
    S.tab = t; var it = item(S.id), b = document.getElementById('pc-b'); if (!it || !b) return;
    document.querySelectorAll('#pc-ov .pc-tabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-t') === t); });
    b.innerHTML = (t === 'month' ? monthHtml(it) : t === 'rec' ? recHtml(it) : t === 'photo' ? photoHtml(it) : infoHtml(it)) + nextHtml(it);
    var pull = 0, tm = null, ty = 0; function atEnd() { return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; } function go() { var nx = b.querySelector('[data-nextgo]'); if (nx) nx.click(); }
    b.onwheel = function (e) { if (e.deltaY > 0 && atEnd()) { pull += e.deltaY; clearTimeout(tm); tm = setTimeout(function () { pull = 0; }, 400); if (pull > 220) { pull = 0; go(); } } };
    b.ontouchstart = function (e) { ty = e.touches[0].clientY; }; b.ontouchend = function (e) { var dy = ty - ((e.changedTouches[0] || {}).clientY || ty); if (atEnd() && dy > 90) go(); };
  }
  function infoHtml(it) {
    var s = set(it.id), pl = poLines(it.id), lp = pl[0], months = 0, used = 0;
    for (var m = 0; m < 12; m++) { var r = rec(m, it.id); if (r && n(r.used)) { months++; used += n(r.used); } }
    var avg = months ? used / months : 0, cur = rec(typeof invDisplayMonth === 'number' ? invDisplayMonth : 0, it.id) || {}, cover = avg ? n(cur.close) / avg : 0;
    return '<div class="pc-g">' + F(L('類別', 'Category', 'ប្រភេទ'), catName(it._cat)) + F(L('單位', 'Unit', 'ឯកតា'), unit(it.id)) + F(L('採購方式', 'Buying', 'ការទិញ'), s.monthly ? L('🔁 每月固定採購', '🔁 Monthly', '🔁 ប្រចាំខែ') : L('不定期', 'Ad-hoc', 'មិនទៀងទាត់')) + F(L('安全庫存', 'Safety stock', 'ស្តុកសុវត្ថិភាព'), safety(it.id)) +
      F(L('今年平均每月使用', 'Average used per month (this year)', 'មធ្យមប្រើប្រចាំខែ'), avg ? (Math.round(avg * 10) / 10) + ' ' + unit(it.id) + (cover ? '  ·  ' + L('目前庫存約可用 ', 'stock covers about ', 'គ្រប់ប្រមាណ ') + (Math.round(cover * 10) / 10) + L(' 個月', ' months', ' ខែ') : '') : '', true) +
      F(L('最近一次採購', 'Last purchase', 'ការទិញចុងក្រោយ'), lp ? (lp.po.year + '-' + String(n(lp.po.month) + 1).padStart(2, '0') + '  ·  ' + (lp.x.qty || '—') + ' ' + unit(it.id) + (lp.po.poNumber ? '  ·  ' + lp.po.poNumber : '')) : '', true) +
      F(L('英文名', 'English name', 'ឈ្មោះអង់គ្លេស'), it.name) + F(L('中文名', 'Chinese name', 'ឈ្មោះចិន'), it.cn) + F(L('備註', 'Remarks', 'កំណត់ចំណាំ'), cur.note, true) + '</div>';
  }
  function monthHtml(it) {
    var y = S.year || YEAR, rows = [], mx = 1, cm = typeof invDisplayMonth === 'number' ? invDisplayMonth : -1;
    for (var m = 0; m < 12; m++) { var r = rec(m, it.id) || {}; rows.push([m, n(r.open), n(r.purchase), n(r.used), n(r.close)]); mx = Math.max(mx, n(r.purchase), n(r.used)); }
    var tp = rows.reduce(function (a, r) { return a + r[2]; }, 0), tu = rows.reduce(function (a, r) { return a + r[3]; }, 0);
    return '<div style="display:flex;gap:6px;margin-bottom:8px">' + [YEAR - 1, YEAR].map(function (yy) { return '<button class="pc-btn' + (yy === y ? ' pri' : '') + '" data-y="' + yy + '">' + yy + '</button>'; }).join('') + '</div><table class="pc-m"><tr><th>' + esc(L('月', 'Month', 'ខែ')) + '</th><th>' + esc(L('期初', 'Open', 'ដើម')) + '</th><th style="color:#059669">' + esc(L('採購', 'Bought', 'ទិញ')) + '</th><th style="color:#d97706">' + esc(L('使用', 'Used', 'ប្រើ')) + '</th><th>' + esc(L('期末', 'Close', 'ចុង')) + '</th><th style="text-align:left;width:30%">' + esc(L('比較', 'Compare', 'ប្រៀបធៀប')) + '</th></tr>' +
      rows.map(function (r) { return '<tr class="' + (y === YEAR && r[0] === cm ? 'cur' : '') + '"><td>' + (r[0] + 1) + '</td><td>' + (r[1] || '—') + '</td><td style="color:#059669">' + (r[2] || '—') + '</td><td style="color:#d97706">' + (r[3] || '—') + '</td><td><b>' + (r[4] || '—') + '</b></td><td style="text-align:left"><span style="display:block;height:6px;border-radius:3px;background:#10b981;width:' + Math.round(r[2] / mx * 100) + '%;margin-bottom:2px"></span><span style="display:block;height:6px;border-radius:3px;background:#f59e0b;width:' + Math.round(r[3] / mx * 100) + '%"></span></td></tr>'; }).join('') +
      '<tr><th>' + esc(L('合計', 'Total', 'សរុប')) + '</th><th></th><th style="color:#059669">' + tp + '</th><th style="color:#d97706">' + tu + '</th><th></th><th></th></tr></table>' + (y !== YEAR ? '<div style="font-size:11.5px;color:#64748b;margin-top:6px">' + esc(L('去年的數字要先在頁面載入去年資料才會出現。', 'Last year\'s figures appear once last year is loaded on the page.', 'ទិន្នន័យឆ្នាំមុនត្រូវផ្ទុកជាមុន')) + '</div>' : '');
  }
  function recHtml(it) {
    var pl = poLines(it.id), lg = logs(it.id), u = unit(it.id), st = { APPROVED: ['#059669', L('已核可', 'Approved', 'អនុម័ត')], SUBMITTED: ['#d97706', L('待審', 'Pending', 'រង់ចាំ')], VERIFIED: ['#d97706', L('待 Paul', 'Waiting Paul', 'រង់ចាំ Paul')], VOIDED: ['#94a3b8', L('作廢', 'Voided', 'លុប')], REJECTED: ['#dc2626', L('退件', 'Rejected', 'បដិសេធ')] };
    var h = '<div style="font-weight:800;font-size:12.5px;margin:0 0 6px">📋 ' + esc(L('月度 PO', 'Monthly PO', 'PO ប្រចាំខែ')) + ' · ' + pl.length + '</div>';
    h += pl.length ? pl.slice(0, 60).map(function (p) { var s = st[String(p.po.status || '').toUpperCase()] || ['#64748b', p.po.status || '—']; return '<div class="pc-rec" style="--c:' + s[0] + '"><span style="font-weight:700">' + esc(p.po.year + '-' + String(n(p.po.month) + 1).padStart(2, '0')) + '</span><span><b>' + esc(p.po.poNumber || '(' + L('未編號', 'no number', 'គ្មានលេខ') + ')') + '</b><small>' + esc(s[1] + (p.po.applicant ? ' · ' + p.po.applicant : '') + (p.x.note ? ' · ' + p.x.note : '')) + '</small></span><span class="q">' + esc(p.x.qty || '—') + ' ' + esc(u) + '</span></div>'; }).join('') : '<div style="color:#64748b;padding:8px 0">' + esc(L('今年還沒有這個品項的 PO', 'No PO for this item this year', 'មិនទាន់មាន PO')) + '</div>';
    if (lg.length) h += '<div style="font-weight:800;font-size:12.5px;margin:12px 0 6px">🧾 ' + esc(L('逐筆收發', 'Receive / issue log', 'កំណត់ហេតុ')) + ' · ' + lg.length + '</div>' + lg.slice(0, 60).map(function (r) { var inn = r.type === 'receive'; return '<div class="pc-rec" style="--c:' + (inn ? '#059669' : '#d97706') + '"><span style="font-weight:700">' + esc(String(r.date || '').slice(2)) + '</span><span><b>' + (inn ? '📥 ' + esc(L('收貨', 'Received', 'ទទួល')) : '📤 ' + esc(L('領用', 'Issued', 'បើក'))) + (r.dept ? ' · ' + esc(r.dept) : '') + '</b><small>' + esc([r.requester, r.remarks].filter(Boolean).join(' · ') || '—') + '</small></span><span class="q">' + (inn ? '+' : '−') + esc(r.qty) + '</span></div>'; }).join('');
    return h;
  }
  function photoHtml(it) {
    var st = std(it.id), all = allPhotos(it.id), ym = GA.ymd(new Date()).slice(0, 7), cur = all.filter(function (p) { return p.ym === ym && p.kind !== 'std'; })[0];
    var box = function (title, p, empty) { return '<div class="pc-phbox"><h5>' + esc(title) + '</h5>' + (p ? '<a href="' + esc(p.e.url || phUrl(p.e)) + '" target="_blank" rel="noopener"><img class="pc-phimg" loading="lazy" src="' + esc(phUrl(p.e)) + '" alt=""></a>' : '<div class="pc-phimg">📷</div>') + '<div style="font-size:10.5px;color:#64748b;margin-top:4px">' + esc(p ? (p.ym + ' ' + kl(p.kind)) : empty) + '</div></div>'; };
    var h = '<div class="pc-ph2">' + box(L('📦 標準照（最正確）', '📦 Standard photo', '📦 រូបស្តង់ដារ'), st ? { e: st, ym: st.ym || '', kind: 'std' } : null, L('還沒有標準照', 'No standard photo yet', 'មិនទាន់មាន')) + box(L('🗓 本月收到的', '🗓 This month', '🗓 ខែនេះ'), cur, L('本月沒有不同或異常', 'Nothing different this month', 'គ្មានអ្វីខុសគ្នា')) + '</div>' +
      '<div class="pc-btns"><button class="pc-btn pri" data-ph="std">📷 ' + esc(st ? L('換標準照', 'Replace standard photo', 'ប្តូររូបស្តង់ដារ') : L('加標準照', 'Add standard photo', 'បន្ថែមរូបស្តង់ដារ')) + '</button><button class="pc-btn" data-ph="diff">🟧 ' + esc(L('本月收到不同', 'Different this month', 'ខុសគ្នាខែនេះ')) + '</button><button class="pc-btn" data-ph="bad">🟥 ' + esc(L('異常', 'Abnormal', 'មិនប្រក្រតី')) + '</button></div>';
    var by = {}, order = []; all.forEach(function (p) { var k = p.ym || '—'; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(p); }); order.sort().reverse();
    if (!order.length) return h + '<div style="text-align:center;color:#64748b;padding:14px">' + esc(L('還沒有照片。先加一張「標準照」，之後每月收到不同或有異常再另外加。', 'No photos yet. Add a standard photo first; add more only when a month brings something different or abnormal.', 'មិនទាន់មានរូបថត')) + '</div>';
    return h + order.map(function (k) { return '<div class="pc-mo"><h5><span>🗓 ' + esc(k) + '</span><span>' + by[k].length + '</span></h5><div class="pc-thumbs">' + by[k].map(function (p) { return '<a href="' + esc(p.e.url || phUrl(p.e)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(phUrl(p.e)) + '" alt=""><span class="pc-tag" style="background:' + (KIND[p.kind] || KIND.diff)[0] + '">' + esc(kl(p.kind)) + '</span></a>'; }).join('') + '</div>' + by[k].filter(function (p) { return p.e.note; }).map(function (p) { return '<div style="font-size:11.5px;color:#475569;margin-top:4px">📝 ' + esc(p.e.note) + '</div>'; }).join('') + '</div>'; }).join('');
  }
  function nextHtml(it) { var ls = items(), i = ls.findIndex(function (x) { return String(x.id) === String(it.id); }), nx = i >= 0 ? ls[i + 1] : null; return nx ? '<div class="pc-next" data-nextgo="1">⬇ ' + esc(L('下一個', 'Next', 'បន្ទាប់')) + '：' + esc(nm(nx)) + '<small>' + esc(catName(nx._cat)) + ' · ' + esc(L('往下拉或點這裡', 'pull down or tap', 'ទាញចុះ ឬចុច')) + '</small></div>' : ''; }
  function compress(f) {
    return new Promise(function (res) { var fr = new FileReader(); fr.onerror = function () { res(null); }; fr.onload = function () { var src = String(fr.result || ''); if (!/^image\//.test(f.type)) { res({ data: src, mime: f.type }); return; } var im = new Image(); im.onload = function () { var k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', 0.75), mime: 'image/jpeg' }); }; im.onerror = function () { res({ data: src, mime: f.type }); }; im.src = src; }; fr.readAsDataURL(f); });
  }
  function pick(id, kind) {
    var note = ''; if (kind !== 'std') { note = window.prompt(kind === 'bad' ? L('異常說明（例：破損、規格不符、數量短少）', 'Describe the problem (e.g. damaged, wrong spec, short)', 'ពិពណ៌នាបញ្ហា') : L('哪裡不同（例：換品牌、包裝、尺寸）', 'What is different (e.g. new brand, packaging, size)', 'ខុសត្រង់ណា'), ''); if (note === null) return; }
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      var hash = [f.name, f.size, f.lastModified].join('|'), ym = GA.ymd(new Date()).slice(0, 7);
      if (allPhotos(id).some(function (p) { return p.e.hash === hash; })) { GA.toast(L('這張照片已經有了，不重複加', 'This photo is already there', 'មានរួចហើយ')); return; }
      GA.toast('⏳ ' + L('上傳中…', 'Uploading…', 'កំពុងផ្ទុក…'));
      var c = await compress(f); if (!c || !c.data) { GA.toast(L('讀不到照片', 'Cannot read the photo', 'មិនអាចអាន'), 'err'); return; }
      try {
        var r = await GA.gasPost('recvItemAttachment', { itemId: 'proc_' + id, effectiveFrom: kind === 'std' ? '0000-01' : ym, fileName: f.name || 'photo.jpg', mimeType: c.mime, data: c.data.replace(/^data:[^;]+;base64,/, ''), hash: hash }), d = (r && r.data) || r || {};
        if (!d.url) throw new Error('no file URL');
        var e = Object.assign({ hash: hash, ym: ym, createdAt: new Date().toISOString() }, d), s = set(id);
        if (kind === 'std') { s.photo = e; var it2 = item(id); if (GA.SharedPhoto && it2) GA.SharedPhoto.set([it2.name, it2.cn], e); } else { e.kind = kind; e.note = note || ''; s.monthPhotos = (s.monthPhotos || []).concat([e]); }
        try { saveState(); } catch (er) {}
        GA.toast('✅ ' + L('照片已存，會自動上雲', 'Photo saved; syncing to cloud', 'បានរក្សាទុក'));
        open(id, true); show('photo');
      } catch (er) { GA.toast('❌ ' + L('上傳失敗，請再試一次：', 'Upload failed, please retry: ', 'បរាជ័យ៖ ') + (er.message || er), 'err'); }
    };
    inp.click();
  }
  function idFrom(el) { var inp = el && el.querySelector && el.querySelector('input[onchange*="updateInv("]'), m = inp && (inp.getAttribute('onchange') || '').match(/updateInv\([^,]+,\s*'([^']+)'/); return m ? m[1] : ''; }
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return; if (e.target.closest('button,input,select,a,label')) return;
    var hit = e.target.closest('#inv-tbody .itd-name') || e.target.closest('#inv-cards-mobile .inv-card-head'); if (!hit) return;
    var host = hit.closest('tr') || hit.closest('.inv-card'), id = idFrom(host); if (!id || !item(id)) return;
    e.preventDefault(); e.stopPropagation(); open(id);
  }, true);
  document.addEventListener('keydown', function (e) { if (!S.id) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') { var p = document.querySelector('#pc-ov [data-a="prev"]'); if (p && !p.disabled) p.click(); } else if (e.key === 'ArrowRight') { var n2 = document.querySelector('#pc-ov [data-a="next"]'); if (n2 && !n2.disabled) n2.click(); } });
  root.GAProcCard = { open: open, close: close };
})(window);
