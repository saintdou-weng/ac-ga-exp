/* ga-exp-summary-plus.js — 費用「整合摘要」加：💡 一眼看懂說明、篩選、圖表（2026-11-17）
   Paul 11/17：整合摘要缺圖表、說明，也少篩選。
   ・💡 說明：自動寫 4–6 句重點（總額與上期、哪一項帶動、電費水費異常、最大幾筆、資料是否不齊）。
   ・篩選：來源（全部／維修／採購／一般）、分類、關鍵字、最低金額 → 整頁（卡片、水電、重大費用、分類）一起套用。
   ・圖表：近 12 期分色堆疊（電／水／維修／採購／其他一般）、本期組成圓環（一張圖看比例）、水電分區 本期 vs 上期；每張圖下面一句判讀。
   只加畫面，不改資料。 */
(function () {
  'use strict';
  if (typeof renderSummary !== 'function' || window.__expPlus) return; window.__expPlus = 1;
  var F = { src: '', cat: '', q: '', min: '' }, charts = [];
  var C = { electricity: '#f59e0b', water: '#0ea5e9', repair: '#8b5cf6', purchase: '#10b981', general: '#64748b' };
  var PAL = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#94a3b8'];
  function L3(z, e, k) { return expMsgText(z, e, k, GA.lang); }
  function M(v) { return money(v); }
  function pct(a, b) { if (!b) return null; return (a - b) / Math.abs(b) * 100; }
  function pctTxt(p) { if (p == null) return ''; return (p > 0 ? '+' : '') + p.toFixed(1) + '%'; }
  /* 2026-11-18 Paul：+／− 看不懂 → 寫成「比上期（6 月）多／少 $x（x%）」 */
  function vsP(p, base) { return p == null ? '' : (typeof expVsWord === 'function' ? expVsWord(p, GA.lang, base) : pctTxt(p)); }
  function moreLess(d, pl) { var a = M(Math.abs(d)); return d > 0 ? L3('比' + pl + '多 ' + a, a + ' more than ' + pl, 'ច្រើនជាង ' + pl + ' ' + a) : d < 0 ? L3('比' + pl + '少 ' + a, a + ' less than ' + pl, 'តិចជាង ' + pl + ' ' + a) : L3('和' + pl + '一樣', 'same as ' + pl, 'ដូច ' + pl); }
  function prevLbl(st) { try { if (st && st.key && st.key !== 'ALL') return L3('上期', 'prev. period', 'មុន') + '（' + GA.periodLabel(GA.shiftPeriod(st.key, st.type, -1), st.type) + '）'; } catch (_) {} return L3('上期', 'prev. period', 'មុន'); }
  function dot(p) { return p == null ? '⚪' : p > 15 ? '🔴' : p > 5 ? '🟡' : '🟢'; }
  function catOf(r) { ensureExpenseCategory(r, r._source); return r.expenseCategory || 'other'; }
  function group(r) { var c = catOf(r); return c === 'electricity' || c === 'water' ? c : (r._source || 'general'); }
  function hit(r) {
    if (F.src && r._source !== F.src) return false;
    if (F.cat && catOf(r) !== F.cat) return false;
    if (F.min && value(r) < Number(F.min)) return false;
    if (F.q) { var s = [r.item, r.spec, r.supplier, r.purpose, r.dept, r.equipment, expenseCatLabel(catOf(r), GA.lang)].join(' ').toLowerCase(); if (s.indexOf(String(F.q).toLowerCase()) < 0) return false; }
    return true;
  }
  var active = function () { return !!(F.src || F.cat || F.q || F.min); };

  /* 1) 篩選：暫時把資料來源換成篩過的，再交給原本的整合摘要畫 */
  var _render = renderSummary, _all = allSourceRows;
  renderSummary = function () {
    charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = [];
    if (active()) allSourceRows = function () { return _all().filter(hit); };
    try { _render.apply(this, arguments); } finally { allSourceRows = _all; }
    try { decorate(); } catch (e) { console.warn('exp summary plus', e); }
  };
  try { window.renderSummary = renderSummary; } catch (e) {}

  function decorate() {
    var view = document.getElementById('exp-view'), first = view && view.querySelector('.exp-sec'); if (!first) return; css();
    var st = currentState(), all = _all(), rowsAll = all.filter(inCurrent), rows = rowsAll.filter(hit), hasPrev = st.key !== 'ALL';
    var prev = hasPrev ? all.filter(function (r) { return GA.inPeriod(r.date, GA.shiftPeriod(st.key, st.type, -1), st.type); }).filter(hit) : [];
    var D = expReportData(rows, prev, hasPrev);
    var a = document.createElement('div'); a.innerHTML = filterHtml(rowsAll); view.insertBefore(a.firstChild, first);
    var b = document.createElement('div'); b.innerHTML = explainHtml(D, st) + chartsHtml(); var ref = first.nextSibling;
    while (b.firstChild) view.insertBefore(b.firstChild, ref);
    bind(); draw(D, st, all);
  }

  function filterHtml(rows) {
    var cats = {}; rows.forEach(function (r) { var c = catOf(r); cats[c] = (cats[c] || 0) + value(r); });
    var opts = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) { return '<option value="' + esc(c) + '"' + (F.cat === c ? ' selected' : '') + '>' + esc(expenseCatLabel(c, GA.lang)) + ' · ' + M(cats[c]) + '</option>'; }).join('');
    var chip = function (k, t) { return '<button class="xp-chip' + (F.src === k ? ' on' : '') + '" data-src="' + k + '">' + t + '</button>'; };
    return '<div class="exp-sec xp-filter"><div class="xp-row"><b>🔎 ' + esc(L3('篩選', 'Filter', 'តម្រង')) + '</b>' + chip('', L3('全部', 'All', 'ទាំងអស់')) + chip('repair', '🔧 ' + esc(expSourceText('repair', GA.lang))) + chip('purchase', '🛒 ' + esc(expSourceText('purchase', GA.lang))) + chip('general', '🧾 ' + esc(expSourceText('general', GA.lang))) +
      '<select id="xp-cat"><option value="">' + esc(L3('全部分類', 'All categories', 'ប្រភេទទាំងអស់')) + '</option>' + opts + '</select>' +
      '<input id="xp-q" placeholder="' + esc(L3('品名／供應商／用途', 'Item / supplier / purpose', 'ទំនិញ / អ្នកផ្គត់ផ្គង់')) + '" value="' + esc(F.q) + '">' +
      '<input id="xp-min" type="number" min="0" placeholder="≥ $" value="' + esc(F.min) + '">' +
      (active() ? '<button class="xp-chip clr" data-clr="1">✕ ' + esc(L3('清除篩選', 'Clear', 'សម្អាត')) + '</button>' : '') + '</div>' +
      (active() ? '<div class="xp-note">⚠️ ' + esc(L3('目前是篩選後的數字（上方卡片、水電、重大費用、分類都一起套用）', 'Figures below are filtered (cards, utilities, major expenses and categories)', 'តួលេខខាងក្រោមត្រូវបានតម្រង')) + '</div>' : '') + '</div>';
  }

  function explainHtml(D, st) {
    var out = [], L = GA.lang, p = pct(D.total, D.prevTotal);
    if (!D.rows.length) return '<div class="exp-sec xp-exp"><div class="exp-sec-t">💡 ' + esc(L3('一眼看懂', 'At a glance', 'មើលភ្លាម')) + '</div><div class="xp-li">⚪ ' + esc(L3('這個期間沒有記錄。', 'No records in this period.', 'គ្មានកំណត់ត្រាក្នុងរយៈពេលនេះ។')) + '</div></div>';
    var PL = prevLbl(st);
    out.push([dot(p), L3('本期合計 ', 'Total ', 'សរុប ') + M(D.total) + '（' + D.rows.length + ' ' + L3('筆', 'records', 'កំណត់ត្រា') + '）' + (D.hasPrev && D.prevTotal ? L3('；', '; ', '; ') + PL + ' ' + M(D.prevTotal) + ' → ' + moreLess(D.total - D.prevTotal, L3('上期', 'prev.', 'មុន')) + '（' + vsP(p) + '）' : '')]);
    try { var nd = typeof expDupCount === 'function' ? expDupCount() : 0; if (nd) out.push(['🧹', L3('同一本帳匯入好幾個版本（09.／15 sep／New…）、電費分表、舊 seed 重複的 ' + nd + ' 筆已不重複計算（原資料保留）', nd + ' duplicate rows (same workbook imported in several versions, meter sub-sheets, old seed) are not counted twice — originals kept', 'ជួរស្ទួន ' + nd + ' មិនរាប់ពីរដង')]); } catch (_) {}
    /* 誰帶動變化 */
    if (D.hasPrev && D.prevTotal) {
      var g = {}, gp = {}; D.rows.forEach(function (r) { var k = group(r); g[k] = (g[k] || 0) + value(r); }); D.prev.forEach(function (r) { var k = group(r); gp[k] = (gp[k] || 0) + value(r); });
      var ks = Object.keys(Object.assign({}, g, gp)).map(function (k) { return { k: k, d: (g[k] || 0) - (gp[k] || 0) }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); });
      if (ks[0] && Math.abs(ks[0].d) > 0) out.push([ks[0].d > 0 ? '📈' : '📉', L3('跟' + PL + '比，變化最大的是 ', 'Vs ' + PL + ', biggest change: ', 'ធៀប ' + PL + ' ប្រែប្រួលធំបំផុត៖ ') + gname(ks[0].k) + ' ' + moreLess(ks[0].d, L3('上期', 'prev.', 'មុន')) + (ks[1] && Math.abs(ks[1].d) > 0 ? L3('；其次 ', '; then ', '; បន្ទាប់ ') + gname(ks[1].k) + ' ' + moreLess(ks[1].d, L3('上期', 'prev.', 'មុន')) : '')]);
    }
    /* 水電 */
    var ut = [];
    D.elec.list.concat(D.water.list).forEach(function (a) { var q = pct(a.amount, a.prev); if (q != null && Math.abs(q) >= 15) ut.push({ a: a, q: q, w: D.water.list.indexOf(a) >= 0 }); });
    ut.sort(function (x, y) { return Math.abs(y.q) - Math.abs(x.q); });
    if (ut.length) out.push(['⚡', ut.slice(0, 3).map(function (u) { return (u.w ? '🚰' : '⚡') + expAreaLabel(u.a.area, L) + ' ' + M(u.a.amount) + ' ' + dot(u.q) + vsP(u.q); }).join('；') + (ut.some(function (u) { return u.q <= -60; }) ? L3('（大幅下降，可能帳單還沒全部進來）', ' (big drop — bills may not all be in yet)', ' (ធ្លាក់ខ្លាំង អាចមិនទាន់បញ្ចូលវិក្កយបត្រគ្រប់)') : '')]);
    /* 最大幾筆 */
    var top = D.nonUtil.slice(0, 3); if (top.length) out.push(['🔥', L3('最大的支出：', 'Largest: ', 'ធំបំផុត៖ ') + top.map(function (r) { return expItemName(r).slice(0, 40) + ' ' + M(value(r)); }).join('、') + (D.nonUtilTotal ? L3('（前 3 筆佔非水電 ', ' (top 3 = ', ' (៣ ដំបូង = ') + Math.round(top.reduce(function (s, r) { return s + value(r); }, 0) / D.nonUtilTotal * 100) + L3('%）', '% of non-utility)', '%)') : '')]);
    /* 資料齊不齊 */
    var srcCnt = { repair: 0, purchase: 0, general: 0 }; D.rows.forEach(function (r) { if (srcCnt[r._source] != null) srcCnt[r._source]++; });
    var thin = Object.keys(srcCnt).filter(function (k) { return srcCnt[k] > 0 && srcCnt[k] <= 3; }), none = Object.keys(srcCnt).filter(function (k) { return !srcCnt[k]; });
    if (thin.length || none.length) out.push(['🟡', (none.length ? none.map(function (k) { return expSourceText(k, L); }).join('、') + L3(' 本期沒有記錄', ' — no records this period', ' — គ្មានកំណត់ត្រា') : '') + (none.length && thin.length ? '；' : '') + (thin.length ? thin.map(function (k) { return expSourceText(k, L) + ' ' + srcCnt[k] + L3(' 筆', ' rec', ' កំណត់ត្រា'); }).join('、') + L3('，筆數很少，可能還沒匯入完', ' — very few, may not be fully imported', ' — តិច អាចមិនទាន់នាំចូលគ្រប់') : '')]);
    return '<div class="exp-sec xp-exp"><div class="exp-sec-t">💡 ' + esc(L3('一眼看懂', 'At a glance', 'មើលភ្លាម')) + '<span class="sp">' + esc(GA.periodLabel(st.key, st.type)) + '</span></div>' + out.map(function (x) { return '<div class="xp-li"><span>' + x[0] + '</span>' + esc(x[1]) + '</div>'; }).join('') + '</div>';
  }
  function gname(k) { return k === 'electricity' ? '⚡' + L3('電費', 'Electricity', 'អគ្គិសនី') : k === 'water' ? '🚰' + L3('水費', 'Water', 'ទឹក') : expSourceText(k, GA.lang); }

  function chartsHtml() {
    var box = function (id, t) { return '<div class="xp-ch"><div class="xp-ct">' + t + '</div><div class="xp-cb"><canvas id="' + id + '"></canvas></div><div class="xp-cn" id="' + id + '-n"></div></div>'; };
    return '<div class="exp-sec"><div class="exp-sec-t">📈 ' + esc(L3('圖表', 'Charts', 'គំនូសតាង')) + '</div><div class="xp-grid">' +
      box('xp-trend', '📊 ' + esc(L3('近 12 期（分色＝來源）', 'Last 12 periods (colour = source)', '១២ រយៈពេលចុងក្រោយ'))) +
      box('xp-mix', '🍩 ' + esc(L3('本期組成', 'This period mix', 'សមាសភាព'))) +
      box('xp-area', '⚡🚰 ' + esc(L3('水電分區 本期 vs 上期', 'Utilities by area: this vs previous', 'ទឹកភ្លើងតាមតំបន់'))) + '</div></div>';
  }
  function note(id, t) { var n = document.getElementById(id + '-n'); if (n) n.textContent = t; }
  function draw(D, st, all) {
    if (typeof Chart === 'undefined') return; var L = GA.lang;
    /* 近 12 期 */
    var type = st.key === 'ALL' ? 'year' : st.type, key = st.key === 'ALL' ? GA.currentPeriod('year') : st.key, ks = [];
    for (var i = 11; i >= 0; i--) ks.push(GA.shiftPeriod(key, type, -i));
    var G = ['electricity', 'water', 'repair', 'purchase', 'general'], data = {}; G.forEach(function (g) { data[g] = ks.map(function () { return 0; }); });
    all.filter(hit).forEach(function (r) { for (var j = 0; j < ks.length; j++) { if (GA.inPeriod(r.date, ks[j], type)) { var g = group(r); if (data[g]) data[g][j] += value(r); break; } } });
    var tot = ks.map(function (_, j) { return G.reduce(function (s, g) { return s + data[g][j]; }, 0); });
    var c1 = document.getElementById('xp-trend');
    if (c1) charts.push(new Chart(c1, { type: 'bar', data: { labels: ks.map(function (k) { return GA.periodLabel(k, type).replace(/^20(\d\d)/, '$1'); }), datasets: G.map(function (g) { return { label: gname(g), data: data[g], backgroundColor: C[g], stack: 's', borderWidth: 0 }; }) },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' ' + M(c.raw); } } } }, scales: { x: { stacked: true, ticks: { font: { size: 9 } } }, y: { stacked: true, ticks: { callback: function (v) { return '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v); } } } } } }));
    var nz = tot.filter(function (v) { return v > 0; }), avg = nz.length ? nz.reduce(function (a, b) { return a + b; }, 0) / nz.length : 0, cur = tot[tot.length - 1], mx = Math.max.apply(null, tot), mi = tot.indexOf(mx);
    note('xp-trend', nz.length ? L3('本期 ', 'This period ', 'រយៈពេលនេះ ') + M(cur) + L3('，有資料期間平均 ', ', average of periods with data ', ', មធ្យម ') + M(avg) + ' ' + dot(pct(cur, avg)) + vsP(pct(cur, avg), 'avg') + L3('；最高是 ', '; highest ', '; ខ្ពស់បំផុត ') + GA.periodLabel(ks[mi], type) + ' ' + M(mx) : L3('沒有資料', 'No data', 'គ្មានទិន្នន័យ'));
    /* 組成 */
    var cats = D.cats.slice(0, 7), other = D.cats.slice(7).reduce(function (s, c) { return s + c.amount; }, 0), lab = cats.map(function (c) { return expenseCatLabel(c.cat, L); }), val = cats.map(function (c) { return c.amount; });
    if (other > 0) { lab.push(L3('其他', 'Other', 'ផ្សេងៗ')); val.push(other); }
    var c2 = document.getElementById('xp-mix');
    if (c2 && val.length) charts.push(new Chart(c2, { type: 'doughnut', data: { labels: lab, datasets: [{ data: val, backgroundColor: PAL, borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, generateLabels: function (ch) { var d = ch.data.datasets[0], s = d.data.reduce(function (a, b) { return a + b; }, 0); return ch.data.labels.map(function (l, i) { return { text: l + ' ' + Math.round(d.data[i] / s * 100) + '%', fillStyle: d.backgroundColor[i], strokeStyle: '#fff', index: i }; }); } } }, tooltip: { callbacks: { label: function (c) { return c.label + ' ' + M(c.raw); } } } } } }));
    note('xp-mix', D.cats.length ? L3('最大類別：', 'Largest: ', 'ធំបំផុត៖ ') + expenseCatLabel(D.cats[0].cat, L) + ' ' + M(D.cats[0].amount) + '（' + Math.round(D.cats[0].amount / Math.max(1, D.total) * 100) + '%）' + (D.cats[1] ? '、' + expenseCatLabel(D.cats[1].cat, L) + ' ' + Math.round(D.cats[1].amount / Math.max(1, D.total) * 100) + '%' : '') : L3('沒有資料', 'No data', 'គ្មានទិន្នន័យ'));
    /* 水電分區 */
    var ar = D.elec.list.map(function (a) { return { n: '⚡' + expAreaLabel(a.area, L), a: a.amount, p: a.prev }; }).concat(D.water.list.map(function (a) { return { n: '🚰' + expAreaLabel(a.area, L), a: a.amount, p: a.prev }; }));
    var c3 = document.getElementById('xp-area');
    if (c3 && ar.length) charts.push(new Chart(c3, { type: 'bar', data: { labels: ar.map(function (x) { return x.n; }), datasets: [{ label: L3('本期', 'This period', 'រយៈពេលនេះ'), data: ar.map(function (x) { return x.a; }), backgroundColor: ar.map(function (x) { var q = pct(x.a, x.p); return q == null ? '#3b82f6' : q > 15 ? '#ef4444' : q > 5 ? '#f59e0b' : '#22c55e'; }) }, { label: L3('上期', 'Previous', 'មុន'), data: ar.map(function (x) { return x.p; }), backgroundColor: '#cbd5e1' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' ' + M(c.raw); } } } }, scales: { x: { ticks: { callback: function (v) { return '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v); } } }, y: { ticks: { font: { size: 10 } } } } } }));
    else if (c3) c3.parentNode.innerHTML = '<div class="xp-empty">' + esc(L3('本期沒有水電資料', 'No utility data this period', 'គ្មានទិន្នន័យទឹកភ្លើង')) + '</div>';
    var big = ar.filter(function (x) { return x.p; }).sort(function (a, b) { return Math.abs(pct(b.a, b.p)) - Math.abs(pct(a.a, a.p)); })[0];
    note('xp-area', big ? L3('顏色＝跟上期比：🟢 持平或下降 🟡 +5–15% 🔴 >+15%。變化最大：', 'Colour vs previous: 🟢 flat/down 🟡 +5–15% 🔴 >+15%. Biggest change: ', 'ពណ៌ធៀបមុន។ ប្រែប្រួលធំបំផុត៖ ') + big.n + ' ' + vsP(pct(big.a, big.p)) : L3('沒有上期可比', 'No previous period to compare', 'គ្មានរយៈពេលមុន'));
  }

  function bind() {
    var v = document.getElementById('exp-view'); if (!v) return;
    v.querySelectorAll('.xp-filter [data-src]').forEach(function (b) { b.onclick = function () { F.src = b.getAttribute('data-src'); renderSummary(); }; });
    var clr = v.querySelector('.xp-filter [data-clr]'); if (clr) clr.onclick = function () { F = { src: '', cat: '', q: '', min: '' }; renderSummary(); };
    var c = document.getElementById('xp-cat'); if (c) c.onchange = function () { F.cat = c.value; renderSummary(); };
    var t; function deb(fn) { clearTimeout(t); t = setTimeout(fn, 400); }
    var q = document.getElementById('xp-q'); if (q) q.oninput = function () { F.q = q.value; deb(function () { renderSummary(); var n = document.getElementById('xp-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }); };
    var m = document.getElementById('xp-min'); if (m) m.oninput = function () { F.min = m.value; deb(function () { renderSummary(); var n = document.getElementById('xp-min'); if (n) n.focus(); }); };
  }
  function css() {
    if (document.getElementById('xp-css')) return; var s = document.createElement('style'); s.id = 'xp-css';
    s.textContent = '.xp-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.xp-chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;cursor:pointer}.xp-chip.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.xp-chip.clr{border-style:dashed;color:#b91c1c}.xp-row select,.xp-row input{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font-size:13px;max-width:100%}#xp-q{flex:1;min-width:150px}#xp-min{width:80px}.xp-note{margin-top:6px;font-size:12px;color:#b45309}' +
      '.xp-exp{border-left:4px solid #2563eb}.xp-li{display:flex;gap:8px;font-size:14px;line-height:1.5;padding:3px 0;border-top:1px dashed #e2e8f0}.xp-li:first-of-type{border-top:0}.xp-li span{flex:none}' +
      '.xp-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:12px}.xp-ch{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff;min-width:0}.xp-ct{font-weight:700;font-size:13px;margin-bottom:6px}.xp-cb{position:relative;height:240px}.xp-cn{font-size:12px;color:#475569;margin-top:6px;line-height:1.5}.xp-empty{height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px}' +
      '@media(max-width:900px){.xp-grid{grid-template-columns:1fr}.xp-cb{height:220px}}';
    document.head.appendChild(s);
  }
})();
