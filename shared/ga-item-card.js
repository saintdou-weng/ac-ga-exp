/* ga-item-card.js — 收貨／庫存「物品資訊卡」2026-11-13
   像 PSJHR 員工資料：在物品清單點一下 → 出現這個物品的資訊卡（庫存、單價、今年收／用、每月進出、
   進出記錄），可按 ‹ › 換上一個／下一個物品，記錄可依 收貨／領用、部門、關鍵字 篩選，
   也可直接跳到同類別的其他物品。原本的「編輯」「刪除」按鈕照舊；卡片裡也有「編輯」。
   只讀頁面現有的 items / records，不改資料。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || !document.getElementById('items-view-container')) return;
  function L(zh, en, km) { var l; try { l = lang; } catch (e) { l = GA.lang; } return l === 'zh' ? zh : l === 'km' ? (km || en) : en; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  var S = { id: null, tab: 'info', type: '', dept: '', q: '', year: String(new Date().getFullYear()) };

  var css = document.createElement('style');
  css.textContent = '.ic-ov{position:fixed;inset:0;background:#0f172a99;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}.ic-sheet{background:#f8fafc;border-radius:16px;width:100%;max-width:780px;overflow:hidden;box-shadow:0 20px 60px #0006}' +
    '.ic-h{background:#1e3a5f;color:#fff;padding:12px 12px;display:flex;gap:9px;align-items:center}.ic-h img,.ic-h .ph{width:46px;height:46px;border-radius:9px;object-fit:cover;background:#ffffff22;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}.ic-h h3{margin:0;font-size:16px;line-height:1.25;flex:1;min-width:0}.ic-h h3 small{display:block;font-size:11px;font-weight:600;opacity:.88;margin-top:2px}.ic-h button{background:#ffffff2e;border:0;color:#fff;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;flex:none}.ic-h button:disabled{opacity:.3}' +
    '.ic-k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 12px 0}.ic-k div{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;border-top:4px solid var(--c,#2563eb);min-width:0}.ic-k b{display:block;font-size:19px;line-height:1.15;color:var(--c,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ic-k small{font-size:10.5px;color:#64748b;font-weight:700}' +
    '.ic-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0;margin-top:10px}.ic-tabs button{flex:1;border:0;background:none;padding:10px 4px;font:inherit;font-weight:800;font-size:13px;color:#64748b;border-bottom:3px solid transparent;cursor:pointer}.ic-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}.ic-b{padding:12px;max-height:56vh;overflow:auto}' +
    '.ic-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ic-f{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.ic-f small{display:block;font-size:10.5px;color:#64748b;font-weight:700}.ic-f b{font-size:13.5px;word-break:break-word}.ic-f.w{grid-column:1/-1}' +
    '.ic-note{border-radius:9px;padding:8px 10px;font-size:12.5px;margin-bottom:8px;border:1px solid}.ic-note.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.ic-note.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}.ic-note.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}' +
    '.ic-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.ic-chip{border:1px solid #cbd5e1;background:#fff;border-radius:14px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.ic-chip.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.ic-row{display:flex;gap:7px;margin-bottom:8px}.ic-row input,.ic-row select{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;min-width:0;flex:1;background:#fff}' +
    '.ic-rec{display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-left:4px solid var(--c);border-radius:9px;padding:7px 10px;margin-bottom:6px;font-size:12.5px}.ic-rec .q{font-weight:800;font-size:15px;color:var(--c);white-space:nowrap}.ic-rec small{color:#64748b;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ic-m{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff}.ic-m th,.ic-m td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:right}.ic-m th:first-child,.ic-m td:first-child{text-align:left}.ic-m th{background:#f1f5f9;font-size:11px}.ic-bar{height:7px;border-radius:4px;display:block;min-width:1px}' +
    '.ic-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0}.ic-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 13px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer}.ic-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}.ic-sib{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}' +
    '#items-view-container tr[id^="row-"]{cursor:pointer}' +
    '@media(max-width:720px){.ic-ov{padding:0;overflow:hidden}.ic-sheet{border-radius:0;height:100vh;height:100dvh;display:flex;flex-direction:column}.ic-b{max-height:none;flex:1}.ic-k{grid-template-columns:repeat(2,1fr)}.ic-k b{font-size:17px}}';
  document.head.appendChild(css);

  function list() { try { return (filteredItems && filteredItems.length ? filteredItems : items) || []; } catch (e) { return []; } }
  function item(id) { try { return items.filter(function (x) { return String(x.id) === String(id); })[0]; } catch (e) { return null; } }
  function recs(x) { try { return records.filter(function (r) { return String(r.itemId) === String(x.id); }); } catch (e) { return []; } }
  function ver(x) { try { return recvItemVersionFor(x, localYMD().slice(0, 7)) || x; } catch (e) { return x; } }
  function photo(x) { try { var ev = recvItemEvidenceFor(x, localYMD().slice(0, 7)); return ev && (ev.previewUrl || ev.url || ev.dataUrl) || ''; } catch (e) { return ''; } }
  function cat(c) { try { return recvCatLabel(c); } catch (e) { return c || '—'; } }
  function low(x) { var th = 5; try { th = GA.num(x.minStock) || settings.lowThreshold || 5; } catch (e) {} return GA.num(x.stock) < th; }
  function sum(a, type, pred) { return a.reduce(function (s, r) { return r.type === type && (!pred || pred(r)) ? s + GA.num(r.qty) : s; }, 0); }
  function F(label, val, wide) { if (val === '' || val == null) return ''; return '<div class="ic-f' + (wide ? ' w' : '') + '"><small>' + esc(label) + '</small><b>' + esc(val) + '</b></div>'; }

  function open(id, keepTab) {
    var x = item(id); if (!x) return; S.id = x.id; if (!keepTab) { S.type = ''; S.dept = ''; S.q = ''; }
    var old = document.getElementById('ic-ov'); if (old) old.remove();
    var ls = list(), idx = ls.findIndex(function (i) { return String(i.id) === String(x.id); }), v = ver(x), rs = recs(x), ph = photo(x), unit = GA.num(v && v.unitPrice), yr = S.year;
    var inY = sum(rs, 'receive', function (r) { return String(r.date || '').slice(0, 4) === yr; }), outY = sum(rs, 'issue', function (r) { return String(r.date || '').slice(0, 4) === yr; });
    var isLow = low(x), ov = document.createElement('div'); ov.className = 'ic-ov'; ov.id = 'ic-ov';
    ov.innerHTML = '<div class="ic-sheet"><div class="ic-h"><button data-a="prev"' + (idx > 0 ? '' : ' disabled') + '>‹</button>' + (ph ? '<img src="' + esc(ph) + '" alt="">' : '<div class="ph">📦</div>') +
      '<h3>' + esc(x.name) + '<small>' + esc(cat(x.category)) + ((v && v.brand) || x.brand ? ' · ' + esc((v && v.brand) || x.brand) : '') + ((v && v.size) || x.size ? ' · ' + esc((v && v.size) || x.size) : '') + (idx >= 0 ? ' · ' + (idx + 1) + ' / ' + ls.length : '') + '</small></h3><button data-a="next"' + (idx >= 0 && idx < ls.length - 1 ? '' : ' disabled') + '>›</button><button data-a="close">×</button></div>' +
      '<div class="ic-k"><div style="--c:' + (isLow ? '#dc2626' : '#059669') + '"><b>' + esc(x.stock) + '</b><small>' + (isLow ? '⚠️ ' + esc(L('庫存偏低', 'Low stock', 'ស្តុកទាប')) : esc(L('目前庫存', 'In stock', 'ស្តុក'))) + '</small></div>' +
      '<div style="--c:#059669"><b>+' + inY + '</b><small>' + yr + ' ' + esc(L('收貨', 'received', 'ទទួល')) + '</small></div><div style="--c:#2563eb"><b>−' + outY + '</b><small>' + yr + ' ' + esc(L('領用', 'issued', 'បើក')) + '</small></div>' +
      '<div style="--c:#d97706"><b>' + (unit ? GA.money(unit, 2) : '—') + '</b><small>' + esc(L('單價', 'Unit price', 'តម្លៃឯកតា')) + (unit ? ' · ' + esc(L('庫存值 ', 'stock value ', 'តម្លៃស្តុក ')) + GA.money(unit * GA.num(x.stock), 0) : '') + '</small></div></div>' +
      '<div class="ic-tabs"><button data-t="info">📋 ' + esc(L('資料', 'Details', 'ព័ត៌មាន')) + '</button><button data-t="month">📈 ' + esc(L('每月', 'Monthly', 'ប្រចាំខែ')) + '</button><button data-t="rec">🧾 ' + esc(L('進出記錄', 'Records', 'កំណត់ត្រា')) + ' (' + rs.length + ')</button></div><div class="ic-b" id="ic-b"></div>' +
      '<div class="ic-foot"><div class="ic-sib" id="ic-sib"></div><button class="ic-btn pri" data-a="edit">✏️ ' + esc(L('編輯', 'Edit', 'កែ')) + '</button></div></div>';
    document.body.appendChild(ov);
    var sib = ls.filter(function (i) { return i.category === x.category && i.id !== x.id; }).slice(0, 12);
    document.getElementById('ic-sib').innerHTML = sib.length ? '<span style="font-size:11px;font-weight:700;color:#64748b;white-space:nowrap;align-self:center">' + esc(L('同類', 'Same category', 'ប្រភេទដូចគ្នា')) + '</span>' + sib.map(function (i) { return '<button class="ic-chip" data-go="' + esc(i.id) + '">' + esc(String(i.name).slice(0, 18)) + '</button>'; }).join('') : '';
    show(S.tab);
    ov.onclick = function (e) {
      if (e.target === ov) { close(); return; }
      var g = e.target.closest('[data-go]'); if (g) { open(g.getAttribute('data-go'), true); return; }
      var t = e.target.closest('.ic-tabs [data-t]'); if (t) { show(t.getAttribute('data-t')); return; }
      var c = e.target.closest('[data-f]'); if (c) { var k = c.getAttribute('data-f'), val = c.getAttribute('data-v'); S[k] = S[k] === val ? '' : val; show('rec'); return; }
      var y = e.target.closest('[data-y]'); if (y) { S.year = y.getAttribute('data-y'); open(x.id, true); return; }
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') close(); else if (act === 'prev' && idx > 0) open(ls[idx - 1].id, true); else if (act === 'next' && idx < ls.length - 1) open(ls[idx + 1].id, true);
      else if (act === 'edit') { close(); try { editItem(x.id); } catch (er) {} }
    };
  }
  function close() { var o = document.getElementById('ic-ov'); if (o) o.remove(); S.id = null; }
  function show(t) {
    S.tab = t; var x = item(S.id), b = document.getElementById('ic-b'); if (!x || !b) return;
    document.querySelectorAll('#ic-ov .ic-tabs button').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-t') === t); });
    b.innerHTML = t === 'month' ? monthHtml(x) : t === 'rec' ? recHtml(x) : infoHtml(x);
    var q = document.getElementById('ic-q'); if (q) { q.oninput = function () { S.q = this.value; var l = document.getElementById('ic-list'); if (l) l.innerHTML = recList(x); }; }
  }
  function check(x) {
    /* 數字對不對得上：期初 + 全部收貨 − 全部領用 應該等於目前庫存（有期初資料才比） */
    var rs = recs(x); if (x.openingBalance === undefined || x.openingBalance === null || x.openingBalance === '') return rs.length ? '' : '<div class="ic-note warn">🟡 ' + esc(L('這個物品還沒有任何進出記錄。', 'No receive / issue records for this item yet.', 'មិនទាន់មានកំណត់ត្រា')) + '</div>';
    var exp = GA.num(x.openingBalance) + sum(rs, 'receive') - sum(rs, 'issue'), st = GA.num(x.stock);
    if (Math.abs(Math.max(0, exp) - st) < 0.0001) return '<div class="ic-note ok">🟢 ' + esc(L('數字對得上：期初 ', 'Figures reconcile: opening ', 'តួលេខត្រូវគ្នា៖ ដើមគ្រា ')) + GA.num(x.openingBalance) + ' + ' + esc(L('收 ', 'received ', 'ទទួល ')) + sum(rs, 'receive') + ' − ' + esc(L('用 ', 'issued ', 'បើក ')) + sum(rs, 'issue') + ' = ' + st + '</div>';
    return '<div class="ic-note warn">🟡 ' + esc(L('數字請核對：記錄推算 ', 'Please check the figures: records give ', 'តួលេខមិនត្រូវគ្នា៖ កំណត់ត្រា ')) + exp + esc(L('，目前庫存 ', ', stock shows ', ', ស្តុក ')) + st + esc(L('（差 ', ' (difference ', ' (ខុស ')) + (st - exp) + '）</div>';
  }
  function infoHtml(x) {
    var v = ver(x), rs = recs(x), last = rs.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), lr = last.filter(function (r) { return r.type === 'receive'; })[0], li = last.filter(function (r) { return r.type === 'issue'; })[0], th = 5; try { th = GA.num(x.minStock) || settings.lowThreshold || 5; } catch (e) {}
    var months = {}; rs.forEach(function (r) { if (r.type === 'issue') months[String(r.date || '').slice(0, 7)] = 1; }); var nm = Object.keys(months).length, avg = nm ? sum(rs, 'issue') / nm : 0, cover = avg ? GA.num(x.stock) / avg : 0;
    return check(x) + '<div class="ic-g">' + F(L('編號', 'No.', 'លេខ'), x.no) + F(L('類別', 'Category', 'ប្រភេទ'), cat(x.category)) + F(L('品牌', 'Brand', 'ម៉ាក'), (v && v.brand) || x.brand) + F(L('規格／尺寸', 'Size', 'ទំហំ'), (v && v.size) || x.size) +
      F(L('最低庫存', 'Minimum stock', 'ស្តុកអប្បបរមា'), th) + F(L('期初庫存', 'Opening balance', 'ដើមគ្រា'), x.openingBalance) +
      F(L('平均每月領用', 'Average issued per month', 'មធ្យមប្រចាំខែ'), avg ? (Math.round(avg * 10) / 10) + (cover ? '  ·  ' + L('約可用 ', 'covers about ', 'គ្រប់ប្រមាណ ') + (Math.round(cover * 10) / 10) + L(' 個月', ' months', ' ខែ') : '') : '') +
      F(L('最近收貨', 'Last received', 'ទទួលចុងក្រោយ'), lr ? lr.date + '  ·  +' + lr.qty : '') + F(L('最近領用', 'Last issued', 'បើកចុងក្រោយ'), li ? li.date + '  ·  −' + li.qty + (li.dept ? '  ·  ' + li.dept : '') : '') +
      F(L('備註', 'Remarks', 'កំណត់ចំណាំ'), (v && v.remarks) || x.remarks, true) + '</div>';
  }
  function monthHtml(x) {
    var rs = recs(x), years = {}; rs.forEach(function (r) { var y = String(r.date || '').slice(0, 4); if (/^\d{4}$/.test(y)) years[y] = 1; }); years[S.year] = 1;
    var ys = Object.keys(years).sort().reverse(), rows = [], mx = 1;
    for (var m = 1; m <= 12; m++) { var k = S.year + '-' + (m < 10 ? '0' + m : m), a = sum(rs, 'receive', function (r) { return String(r.date || '').slice(0, 7) === k; }), b = sum(rs, 'issue', function (r) { return String(r.date || '').slice(0, 7) === k; }); rows.push([m, a, b]); mx = Math.max(mx, a, b); }
    var ta = rows.reduce(function (s, r) { return s + r[1]; }, 0), tb = rows.reduce(function (s, r) { return s + r[2]; }, 0);
    return '<div class="ic-chips">' + ys.map(function (y) { return '<button class="ic-chip' + (y === S.year ? ' on' : '') + '" data-y="' + y + '">' + y + '</button>'; }).join('') + '</div><table class="ic-m"><tr><th>' + esc(L('月', 'Month', 'ខែ')) + '</th><th>' + esc(L('收貨', 'Received', 'ទទួល')) + '</th><th>' + esc(L('領用', 'Issued', 'បើក')) + '</th><th style="width:42%;text-align:left">' + esc(L('比較', 'Compare', 'ប្រៀបធៀប')) + '</th></tr>' +
      rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td style="color:#059669;font-weight:700">' + (r[1] || '—') + '</td><td style="color:#2563eb;font-weight:700">' + (r[2] || '—') + '</td><td style="text-align:left"><span class="ic-bar" style="width:' + Math.round(r[1] / mx * 100) + '%;background:#10b981;margin-bottom:2px"></span><span class="ic-bar" style="width:' + Math.round(r[2] / mx * 100) + '%;background:#3b82f6"></span></td></tr>'; }).join('') +
      '<tr><th>' + esc(L('合計', 'Total', 'សរុប')) + '</th><th style="color:#059669">' + ta + '</th><th style="color:#2563eb">' + tb + '</th><th></th></tr></table>';
  }
  function recList(x) {
    var q = (S.q || '').toLowerCase(), rs = recs(x).filter(function (r) { if (S.type && r.type !== S.type) return false; if (S.dept && String(r.dept || '—') !== S.dept) return false; if (q && [r.date, r.dept, r.requester, r.inspector, r.remarks].join(' ').toLowerCase().indexOf(q) < 0) return false; return true; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (!rs.length) return '<div style="text-align:center;color:#64748b;padding:22px">' + esc(L('沒有符合的記錄', 'No matching records', 'គ្មានកំណត់ត្រា')) + '</div>';
    var tot = '<div style="font-size:12px;font-weight:700;color:#475569;margin-bottom:6px">' + rs.length + ' ' + esc(L('筆', 'records', 'កំណត់ត្រា')) + ' · +' + sum(rs, 'receive') + ' / −' + sum(rs, 'issue') + '</div>';
    return tot + rs.slice(0, 200).map(function (r) { var inn = r.type === 'receive'; return '<div class="ic-rec" style="--c:' + (inn ? '#059669' : '#2563eb') + '"><span style="font-weight:700">' + esc(String(r.date || '').slice(2)) + '</span><span><b>' + (inn ? '📥 ' + esc(L('收貨', 'Received', 'ទទួល')) : '📤 ' + esc(L('領用', 'Issued', 'បើក'))) + (r.dept ? ' · ' + esc(r.dept) : '') + '</b><small>' + esc([r.requester, r.inspector ? L('檢查 ', 'checked ', 'ពិនិត្យ ') + r.inspector : '', r.remarks].filter(Boolean).join(' · ') || '—') + '</small></span><span class="q">' + (inn ? '+' : '−') + esc(r.qty) + '</span></div>'; }).join('') + (rs.length > 200 ? '<div style="text-align:center;color:#64748b;font-size:12px">… ' + (rs.length - 200) + '</div>' : '');
  }
  function recHtml(x) {
    var rs = recs(x), by = {}; rs.forEach(function (r) { if (r.type !== 'issue') return; var d = String(r.dept || '—'); by[d] = (by[d] || 0) + GA.num(r.qty); });
    var depts = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    return '<div class="ic-chips"><button class="ic-chip' + (S.type === 'receive' ? ' on' : '') + '" data-f="type" data-v="receive">📥 ' + esc(L('收貨', 'Received', 'ទទួល')) + ' ' + sum(rs, 'receive') + '</button><button class="ic-chip' + (S.type === 'issue' ? ' on' : '') + '" data-f="type" data-v="issue">📤 ' + esc(L('領用', 'Issued', 'បើក')) + ' ' + sum(rs, 'issue') + '</button>' +
      depts.map(function (d) { return '<button class="ic-chip' + (S.dept === d[0] ? ' on' : '') + '" data-f="dept" data-v="' + esc(d[0]) + '">' + esc(d[0]) + ' ' + d[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ic-row"><input id="ic-q" type="search" value="' + esc(S.q) + '" placeholder="🔍 ' + esc(L('日期／部門／領用人／備註', 'Date / dept / requester / remarks', 'ថ្ងៃ / ផ្នែក / អ្នកស្នើ')) + '"></div><div id="ic-list">' + recList(x) + '</div>';
  }

  /* 點清單任一列（或卡片）→ 資訊卡；列上的編輯／刪除／勾選照舊 */
  document.getElementById('items-view-container').addEventListener('click', function (e) {
    if (e.target.closest('button,input,select,a,label,.row-actions')) return;
    var tr = e.target.closest('tr[id^="row-"]'), id = tr ? tr.id.slice(4) : '';
    if (!id) { var c = e.target.closest('[onclick^="editItem("]'); var m = c && (c.getAttribute('onclick') || '').match(/editItem\('([^']+)'\)/); if (m) id = m[1]; }
    if (!id || !item(id)) return;
    e.stopPropagation(); e.preventDefault(); open(id);
  }, true);
  document.addEventListener('keydown', function (e) { if (!S.id) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') { var p = document.querySelector('#ic-ov [data-a="prev"]'); if (p && !p.disabled) p.click(); } else if (e.key === 'ArrowRight') { var n = document.querySelector('#ic-ov [data-a="next"]'); if (n && !n.disabled) n.click(); } });
  root.GAItemCard = { open: open, close: close };
})(window);
