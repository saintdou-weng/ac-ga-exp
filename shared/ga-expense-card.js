/* ga-expense-card.js — 費用「明細卡」2026-11-13
   和收貨的物品資訊卡同一種做法：在費用明細表點任一列 → 這筆費用的卡片（日期、分類、金額、數量×單價、
   供應商、用途、部門、來源），可按 ‹ › 看上一筆／下一筆；「相關」分頁可切 同項目／同供應商／同分類，
   看歷次金額、平均、上次價格，並可直接跳到那一筆。列上的分類下拉與按鈕照舊；卡片裡也有「編輯」。
   只讀頁面現有資料（allRows / expenseFind），不改資料。 */
(function (root) {
  'use strict';
  var GA = root.GA, host = document.getElementById('exp-view'); if (!GA || !host) return;
  function L(zh, en, km) { var l = GA.lang; return l === 'zh' ? zh : l === 'km' ? (km || en) : en; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  var S = { cur: null, seq: [], tab: 'info', rel: 'item', q: '' };

  var css = document.createElement('style');
  css.textContent = '.ec-ov{position:fixed;inset:0;background:#0f172a99;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}.ec-sheet{background:#f8fafc;border-radius:16px;width:100%;max-width:760px;overflow:hidden;box-shadow:0 20px 60px #0006}' +
    '.ec-h{background:var(--c,#1e3a5f);color:#fff;padding:12px;display:flex;gap:9px;align-items:center}.ec-h h3{margin:0;font-size:16px;line-height:1.25;flex:1;min-width:0}.ec-h h3 small{display:block;font-size:11px;font-weight:600;opacity:.9;margin-top:2px}.ec-h button{background:#ffffff2e;border:0;color:#fff;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;flex:none}.ec-h button:disabled{opacity:.3}' +
    '.ec-amt{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:12px 14px;background:#fff;border-bottom:1px solid #e2e8f0}.ec-amt b{font-size:28px;line-height:1}.ec-amt span{font-size:12px;color:#475569;font-weight:700;text-align:right}' +
    '.ec-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0}.ec-tabs button{flex:1;border:0;background:none;padding:10px 4px;font:inherit;font-weight:800;font-size:13px;color:#64748b;border-bottom:3px solid transparent;cursor:pointer}.ec-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}.ec-b{padding:12px;max-height:56vh;overflow:auto}' +
    '.ec-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ec-f{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.ec-f small{display:block;font-size:10.5px;color:#64748b;font-weight:700}.ec-f b{font-size:13.5px;word-break:break-word}.ec-f.w{grid-column:1/-1}' +
    '.ec-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.ec-chip{border:1px solid #cbd5e1;background:#fff;border-radius:14px;padding:5px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}.ec-chip.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff}' +
    '.ec-st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.ec-st div{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:6px 8px;min-width:0}.ec-st b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ec-st small{font-size:10px;color:#64748b;font-weight:700}' +
    '.ec-q{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;margin-bottom:8px;background:#fff}' +
    '.ec-rec{display:grid;grid-template-columns:62px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:7px 10px;margin-bottom:6px;font-size:12.5px;cursor:pointer}.ec-rec:hover{border-color:#93c5fd}.ec-rec.me{border-color:#1d4ed8;background:#eff6ff}.ec-rec small{color:#64748b;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ec-rec .a{font-weight:800;font-size:14px;white-space:nowrap}' +
    '.ec-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0}.ec-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 13px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer}.ec-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}' +
    '#exp-view table.exp-table tbody tr{cursor:pointer}' +
    '@media(max-width:720px){.ec-ov{padding:0;overflow:hidden}.ec-sheet{border-radius:0;height:100vh;height:100dvh;display:flex;flex-direction:column}.ec-b{max-height:none;flex:1}.ec-st{grid-template-columns:repeat(2,1fr)}.ec-amt b{font-size:24px}}';
  document.head.appendChild(css);

  function keyOfRow(tr) { if (tr && tr.getAttribute && tr.getAttribute('data-ec-id')) { var di = tr.getAttribute('data-ec-id'); try { di = decodeURIComponent(di); } catch (e) {} return { src: tr.getAttribute('data-ec-src') || 'legacy', id: di }; } var s = tr && tr.querySelector('select.exp-cat-select'), m = s && (s.getAttribute('onchange') || '').match(/quickExpenseCategory\('([^']*)','([^']*)'/); if (!m) return null; var id = m[2]; try { id = decodeURIComponent(id); } catch (e) {} return { src: m[1], id: id }; }
  function find(k) { try { var f = k && expenseFind(k.src, k.id); return f ? f.row : null; } catch (e) { return null; } }
  function all() { try { return allRows(); } catch (e) { return []; } }
  function val(r) { try { return value(r); } catch (e) { return GA.num(r.amount); } }
  function name(r) { try { return expItemName(r); } catch (e) { return r.item || r.purpose || '—'; } }
  function catDef(r) { try { return expenseCatDef(r.expenseCategory || 'other') || {}; } catch (e) { return {}; } }
  function catLabel(r) { var d = catDef(r); return (d.icon ? d.icon + ' ' : '') + L(d.zh || r.expenseCategory || '—', d.en || r.expenseCategory || '—', d.km || d.en || '—'); }
  function srcLabel(r) { try { return expSourceText(r._source, GA.lang); } catch (e) { return r._source || ''; } }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function F(label, v, wide) { if (v === '' || v == null) return ''; return '<div class="ec-f' + (wide ? ' w' : '') + '"><small>' + esc(label) + '</small><b>' + esc(v) + '</b></div>'; }
  var COLORS = { electricity: '#a16207', water: '#0369a1' };

  function open(k, keep) {
    var r = find(k); if (!r) return; S.cur = k; if (!keep) { S.q = ''; }
    var old = document.getElementById('ec-ov'); if (old) old.remove();
    var idx = S.seq.findIndex(function (x) { return x.src === k.src && String(x.id) === String(k.id); }), c = COLORS[r.expenseCategory] || '#1e3a5f';
    var qty = GA.num(r.qty), price = GA.num(r.price || r.unitPrice), calc = qty && price ? Math.round(qty * price * 100) / 100 : 0, okMath = !calc || Math.abs(calc - val(r)) < 0.011;
    var ov = document.createElement('div'); ov.className = 'ec-ov'; ov.id = 'ec-ov'; ov.style.setProperty('--c', c);
    ov.innerHTML = '<div class="ec-sheet"><div class="ec-h"><button data-a="prev"' + (idx > 0 ? '' : ' disabled') + '>‹</button><h3>' + esc(name(r)) + '<small>' + esc(catLabel(r)) + ' · ' + esc(r.date || '—') + (idx >= 0 ? ' · ' + (idx + 1) + ' / ' + S.seq.length : '') + '</small></h3><button data-a="next"' + (idx >= 0 && idx < S.seq.length - 1 ? '' : ' disabled') + '>›</button><button data-a="close">×</button></div>' +
      '<div class="ec-amt"><b style="color:' + c + '">' + GA.money(val(r), 2) + '</b><span>' + (qty || price ? esc((qty || '—') + (r.unit ? ' ' + r.unit : '') + ' × ' + (price ? GA.money(price, 2) : '—')) + '<br>' : '') + (calc ? (okMath ? '🟢 ' + esc(L('數量×單價＝金額', 'qty × price = amount', 'បរិមាណ × តម្លៃ = ចំនួន')) : '🔴 ' + esc(L('數量×單價＝', 'qty × price = ', 'បរិមាណ × តម្លៃ = ')) + GA.money(calc, 2) + esc(L('，與金額不符', ', differs from amount', ' មិនស្មើ'))) : '') + '</span></div>' +
      '<div class="ec-tabs"><button data-t="info">📋 ' + esc(L('資料', 'Details', 'ព័ត៌មាន')) + '</button><button data-t="rel">🔗 ' + esc(L('相關記錄', 'Related', 'ពាក់ព័ន្ធ')) + '</button></div><div class="ec-b" id="ec-b"></div>' +
      '<div class="ec-foot"><button class="ec-btn pri" data-a="edit">✏️ ' + esc(L('編輯', 'Edit', 'កែ')) + '</button></div></div>';
    document.body.appendChild(ov); show(S.tab);
    ov.onclick = function (e) {
      if (e.target === ov) { close(); return; }
      var t = e.target.closest('.ec-tabs [data-t]'); if (t) { show(t.getAttribute('data-t')); return; }
      var rl = e.target.closest('[data-rel]'); if (rl) { S.rel = rl.getAttribute('data-rel'); show('rel'); return; }
      var go = e.target.closest('[data-go]'); if (go) { var p = go.getAttribute('data-go').split('|'); open({ src: p[0], id: decodeURIComponent(p[1]) }, true); return; }
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') close(); else if (act === 'prev' && idx > 0) open(S.seq[idx - 1], true); else if (act === 'next' && idx < S.seq.length - 1) open(S.seq[idx + 1], true);
      else if (act === 'edit') { close(); try { openExpenseEdit(k.src, encodeURIComponent(k.id)); } catch (er) {} }
    };
  }
  function close() { var o = document.getElementById('ec-ov'); if (o) o.remove(); S.cur = null; }
  function show(t) {
    S.tab = t; var r = find(S.cur), b = document.getElementById('ec-b'); if (!r || !b) return;
    document.querySelectorAll('#ec-ov .ec-tabs button').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-t') === t); });
    b.innerHTML = t === 'rel' ? relHtml(r) : infoHtml(r);
    var q = document.getElementById('ec-q'); if (q) q.oninput = function () { S.q = this.value; var l = document.getElementById('ec-list'); if (l) l.innerHTML = relList(r); };
  }
  function infoHtml(r) {
    return '<div class="ec-g">' + F(L('日期', 'Date', 'ថ្ងៃ'), r.date) + F(L('分類', 'Category', 'ប្រភេទ'), catLabel(r)) + F(L('項目', 'Item', 'មុខ'), r.item, true) + F(L('設備', 'Equipment', 'ឧបករណ៍'), r.equipment) +
      F(L('部門', 'Department', 'ផ្នែក'), r.dept) + F(L('供應商', 'Supplier', 'អ្នកផ្គត់ផ្គង់'), r.supplier) + F(L('數量', 'Quantity', 'បរិមាណ'), r.qty ? r.qty + (r.unit ? ' ' + r.unit : '') : '') + F(L('單價', 'Unit price', 'តម្លៃឯកតា'), GA.num(r.price || r.unitPrice) ? GA.money(r.price || r.unitPrice, 2) : '') +
      F(L('金額', 'Amount', 'ទឹកប្រាក់'), GA.money(val(r), 2)) + F(L('單號／發票', 'PO / invoice no.', 'លេខ PO / វិក្កយបត្រ'), r.poNo || r.po || r.invoice || r.invoiceNo || r.ref) +
      F(L('用途', 'Purpose', 'គោលបំណង'), r.purpose, true) + F(L('備註', 'Remarks', 'កំណត់ចំណាំ'), r.remarks || r.remark || r.note, true) +
      F(L('來源', 'Source', 'ប្រភព'), [srcLabel(r), r.sourceFile, r.sourceSheet || r.sheet, r.sourceRow ? L('第 ', 'row ', 'ជួរ ') + r.sourceRow + L(' 列', '', '') : ''].filter(Boolean).join(' · '), true) + '</div>';
  }
  function related(r) {
    var A = all(), me = norm(name(r)), sup = norm(r.supplier), cat = r.expenseCategory || 'other';
    if (S.rel === 'sup') return sup ? A.filter(function (x) { return norm(x.supplier) === sup; }) : [];
    if (S.rel === 'cat') return A.filter(function (x) { return (x.expenseCategory || 'other') === cat && String(x.date || '').slice(0, 7) === String(r.date || '').slice(0, 7); });
    return A.filter(function (x) { return norm(name(x)) === me; });
  }
  function relList(r) {
    var q = norm(S.q), rs = related(r).filter(function (x) { return !q || norm([x.date, name(x), x.supplier, x.purpose, x.dept].join(' ')).indexOf(q) >= 0; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || val(b) - val(a); });
    if (!rs.length) return '<div style="text-align:center;color:#64748b;padding:22px">' + esc(L('沒有相關記錄', 'No related records', 'គ្មានកំណត់ត្រា')) + '</div>';
    return rs.slice(0, 200).map(function (x) { var me = x._source === S.cur.src && String(x.recordId) === String(S.cur.id), p = GA.num(x.price || x.unitPrice); return '<div class="ec-rec' + (me ? ' me' : '') + '" data-go="' + esc(x._source) + '|' + encodeURIComponent(x.recordId || '') + '"><span style="font-weight:700">' + esc(String(x.date || '').slice(2)) + '</span><span><b>' + esc(S.rel === 'item' ? (x.supplier || x.dept || catLabel(x)) : name(x)) + '</b><small>' + esc([x.qty ? x.qty + (x.unit ? ' ' + x.unit : '') + (p ? ' × ' + GA.money(p, 2) : '') : '', S.rel === 'item' ? x.purpose : x.supplier, x.dept].filter(Boolean).join(' · ') || '—') + '</small></span><span class="a">' + GA.money(val(x), 2) + '</span></div>'; }).join('') + (rs.length > 200 ? '<div style="text-align:center;color:#64748b;font-size:12px">… ' + (rs.length - 200) + '</div>' : '');
  }
  function relHtml(r) {
    var keep = S.rel, cnt = {}; ['item', 'sup', 'cat'].forEach(function (k) { S.rel = k; cnt[k] = related(r).length; }); S.rel = keep;
    if (S.rel === 'sup' && !cnt.sup) S.rel = 'item';
    var rs = related(r), vals = rs.map(val), tot = vals.reduce(function (a, b) { return a + b; }, 0), sorted = rs.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var prev = sorted.filter(function (x) { return String(x.date) < String(r.date) || (String(x.date) === String(r.date) && !(x._source === S.cur.src && String(x.recordId) === String(S.cur.id))); })[0], diff = '';
    if (S.rel === 'item' && prev) { var pp = GA.num(prev.price || prev.unitPrice), cp = GA.num(r.price || r.unitPrice), a = pp && cp ? cp - pp : val(r) - val(prev), base = pp && cp ? pp : val(prev); diff = (a > 0 ? '🔴 +' : a < 0 ? '🟢 −' : '＝ ') + (a ? GA.money(Math.abs(a), 2) : '') + (base && a ? ' (' + (a > 0 ? '+' : '−') + Math.abs(Math.round(a / base * 1000) / 10) + '%)' : ''); }
    return '<div class="ec-chips"><button class="ec-chip' + (S.rel === 'item' ? ' on' : '') + '" data-rel="item">🏷 ' + esc(L('同項目', 'Same item', 'មុខដូចគ្នា')) + ' ' + cnt.item + '</button>' + (r.supplier ? '<button class="ec-chip' + (S.rel === 'sup' ? ' on' : '') + '" data-rel="sup">🏪 ' + esc(String(r.supplier).slice(0, 22)) + ' ' + cnt.sup + '</button>' : '') + '<button class="ec-chip' + (S.rel === 'cat' ? ' on' : '') + '" data-rel="cat">' + esc(catLabel(r)) + ' · ' + esc(String(r.date || '').slice(0, 7)) + ' ' + cnt.cat + '</button></div>' +
      '<div class="ec-st"><div><b>' + rs.length + '</b><small>' + esc(L('筆數', 'Records', 'ចំនួន')) + '</small></div><div><b>' + GA.money(tot, 2) + '</b><small>' + esc(L('合計', 'Total', 'សរុប')) + '</small></div><div><b>' + GA.money(rs.length ? tot / rs.length : 0, 2) + '</b><small>' + esc(L('平均每筆', 'Average', 'មធ្យម')) + '</small></div><div><b>' + (S.rel === 'item' ? (diff || '—') : GA.money(vals.length ? Math.max.apply(null, vals) : 0, 2)) + '</b><small>' + esc(S.rel === 'item' ? L('與上次比', 'vs previous', 'ធៀបលើកមុន') : L('最大一筆', 'Largest', 'ធំបំផុត')) + '</small></div></div>' +
      '<input class="ec-q" id="ec-q" type="search" value="' + esc(S.q) + '" placeholder="🔍 ' + esc(L('日期／項目／供應商／用途', 'Date / item / supplier / purpose', 'ថ្ងៃ / មុខ / អ្នកផ្គត់ផ្គង់')) + '"><div id="ec-list">' + relList(r) + '</div>';
  }

  /* 點明細表任一列 → 明細卡；分類下拉、按鈕照舊 */
  host.addEventListener('click', function (e) {
    if (e.target.closest('button,input,select,a,label,option')) return;
    var tr = e.target.closest('table.exp-table tbody tr'), k = keyOfRow(tr); if (!k || !find(k)) return;
    S.seq = Array.prototype.map.call(tr.parentNode.children, keyOfRow).filter(Boolean);
    e.stopPropagation(); e.preventDefault(); open(k);
  }, true);
  document.addEventListener('keydown', function (e) { if (!S.cur) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') { var p = document.querySelector('#ec-ov [data-a="prev"]'); if (p && !p.disabled) p.click(); } else if (e.key === 'ArrowRight') { var n = document.querySelector('#ec-ov [data-a="next"]'); if (n && !n.disabled) n.click(); } });
  root.GAExpenseCard = { open: open, close: close };
})(window);
