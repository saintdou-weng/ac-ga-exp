/* ga-insight.js — 各頁「💡 一眼看懂」：篩選＋說明＋圖表（2026-11-17）
   Paul 11/17：收貨、採購、柴油、損壞、交通、ETC、維修 要跟費用整合摘要一樣有說明、圖表、篩選。
   右下角一顆「💡 一眼看懂」→ 打開面板：期間（月／年，預設最近有資料的月）、分組篩選、搜尋；
   4–6 句重點（本期 vs 上期、誰帶動、前幾名、資料齊不齊）；圖表三張（近 12 期分色、組成圓環、前 10 名），每張一句判讀。
   只讀資料、不改資料；各頁原本的表格與按鈕不動。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || root.__gaInsight) return; root.__gaInsight = 1;
  function L(z, e, k) { var l = (typeof lang !== 'undefined' && lang) || GA.lang || 'zh'; return l === 'zh' ? z : l === 'km' ? (k || e) : e; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function ymd(v) { if (v instanceof Date) return GA.ymd ? GA.ymd(v) : v.toISOString().slice(0, 10); var s = String(v == null ? '' : v), m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : ''; }
  var PAL = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#94a3b8'];
  var page = (location.pathname.split('/').pop() || '').replace('.html', '');

  /* ── 各頁資料轉成同一種列：{d:日期, v:數值, g:分組, n:名稱, c:組成分類, x:補充} ── */
  var A = {
    receiving: { t: ['收貨／領用', 'Receiving / Issue', 'ទទួល / ចេញ'], u: ['件', 'pcs', 'pcs'], money: false, split: true,
      rows: function () { var cat = {}; try { items.forEach(function (i) { cat[String(i.id)] = i.category || 'Other'; }); } catch (e) {} try { return records.map(function (r) { return { d: ymd(r.date), v: num(r.qty), g: r.type === 'receive' ? L('📥 收貨', '📥 Received', '📥 ទទួល') : L('📤 領用', '📤 Issued', '📤 ចេញ'), n: r.itemName || '', c: r.type === 'receive' ? (cat[String(r.itemId)] || 'Other') : (r.dept || L('未填部門', 'No dept', 'គ្មានផ្នែក')), x: r.dept || '' }; }); } catch (e) { return []; } },
      mixT: ['領用部門／收貨分類', 'Issue dept / receive category', 'ផ្នែក'] },
    procurement: { t: ['月度採購', 'Monthly PO', 'ការទិញប្រចាំខែ'], u: ['件', 'pcs', 'pcs'], money: false,
      rows: function () { var out = []; try { poHistoryData.forEach(function (po) { var m = Number(po.month), d = po.year && !isNaN(m) ? po.year + '-' + ('0' + (m + 1)).slice(-2) + '-01' : ''; (po.items || []).forEach(function (it) { out.push({ d: d, v: num(it.qty), g: String(po.status || '—').toUpperCase(), n: it.item || it.itemName || it.name || '', c: it.cat || it.category || '—', x: po.poNumber || po.poId || '' }); }); }); } catch (e) {} return out; },
      load: function () { try { if (typeof loadPOHistory === 'function' && !poHistoryData.length) return loadPOHistory(); } catch (e) {} },
      mixT: ['分類', 'Category', 'ប្រភេទ'] },
    fuel: { t: ['柴油', 'Diesel', 'ប្រេងម៉ាស៊ូត'], u: ['L', 'L', 'L'], money: false,
      rows: function () { var G = { driver: L('🚗 司機車輛', '🚗 Vehicles', '🚗 យានយន្ត'), forklift: L('🏗️ 堆高機', '🏗️ Forklift', '🏗️ ហ្វរគ្លីហ្វ'), generator: L('⚡ 發電機', '⚡ Generator', '⚡ ម៉ាស៊ីនភ្លើង') }; try { return DB.map(function (r) { return { d: ymd(r.date), v: num(r.liters), g: G[r.cat] || r.cat || '—', n: r.plate || r.forklift || r.machine || r.driver || '—', c: r.driver || r.dept || G[r.cat] || '—', x: r.km || r.totalKM || '' }; }); } catch (e) { return []; } },
      mixT: ['司機／部門', 'Driver / dept', 'អ្នកបើក / ផ្នែក'] },
    damage: { t: ['損壞／遺失', 'Damage / Lost', 'ខូចខាត / បាត់'], u: ['$', '$', '$'], money: true, count: true,
      rows: function () { try { return DB.filter(function (r) { return r && !r.deleted && r.status !== 'void'; }).map(function (r) { var nm = (r.items || []).map(function (i) { return i.name || i.item || ''; }).filter(Boolean).join(', ') || r.other || r.desc || ''; return { d: ymd(r.date || r.incidentDate), v: num(r.lossAmount), g: r.type || '—', n: nm, c: r.dept || '—', x: r.status || '' }; }); } catch (e) { return []; } },
      mixT: ['部門', 'Department', 'ផ្នែក'] },
    transportation: { t: ['行車紀錄', 'Transportation', 'ធ្វើដំណើរ'], u: ['km', 'km', 'km'], money: false, count: true,
      rows: function () { try { return GATransport.rows().map(function (r) { return { d: ymd(r.date), v: num(r.km), g: r.routeType || r.reason || '—', n: r.plate || '—', c: r.driver || '—', x: r.reason || '' }; }); } catch (e) { return []; } },
      mixT: ['司機', 'Driver', 'អ្នកបើក'] },
    etc: { t: ['ETC 通行費', 'ETC toll', 'ថ្លៃផ្លូវ ETC'], u: ['$', '$', '$'], money: true, count: true,
      rows: function () { try { return GATransport.rows().map(function (r) { return { d: ymd(r.date), v: num(r.charge), g: r.reason || '—', n: r.plate || '—', c: r.driver || '—', x: (r.from || '') + (r.to ? '→' + r.to : '') }; }); } catch (e) { return []; } },
      mixT: ['司機', 'Driver', 'អ្នកបើក'] },
    maintenance: { t: ['維修／PO', 'Repair / PO', 'ជួសជុល / PO'], u: ['$', '$', '$'], money: true, count: true,
      rows: function () { var out = []; try { ['rep', 'po'].forEach(function (sys) { (currentData[sys] || []).forEach(function (x) { if (!Array.isArray(x)) return; if (/作廢|void/i.test(String(x[13] || ''))) return; var amt = num(sys === 'rep' ? x[19] : x[18]) || num(x[11]); out.push({ d: ymd(x[0]), v: amt, g: sys === 'rep' ? L('🔧 維修', '🔧 Repair', '🔧 ជួសជុល') : '🧾 ' + (String(x[22] || '').toUpperCase() || 'GA') + ' PO', n: x[4] || '', c: x[2] || '—', x: (x[3] || '') + ' · ' + (x[13] || '') }); }); }); } catch (e) {} return out; },
      load: function () { try { var p = []; ['rep', 'po'].forEach(function (s) { if (!(currentData[s] || []).length && typeof queryRecords === 'function') p.push(queryRecords(s)); }); return Promise.all(p); } catch (e) {} },
      mixT: ['部門', 'Department', 'ផ្នែក'] }
  };
  var C = A[page]; if (!C) return;
  var S = { ym: '', type: 'month', g: '', q: '' }, charts = [];

  function u() { return L.apply(null, C.u); }
  function fmt(v) { return C.money ? '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (Math.round(v * 10) / 10).toLocaleString('en-US') + ' ' + u(); }
  function pct(a, b) { return b ? (a - b) / Math.abs(b) * 100 : null; }
  function pt(p) { return p == null ? '' : (p > 0 ? '+' : '') + p.toFixed(0) + '%'; }
  function dot(p) { return p == null ? '⚪' : p > 15 ? '🔴' : p > 5 ? '🟡' : '🟢'; }
  function keyOf(d) { return S.type === 'year' ? d.slice(0, 4) : d.slice(0, 7); }
  function shift(k, n) { if (S.type === 'year') return String(Number(k) + n); var y = +k.slice(0, 4), m = +k.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
  function sum(a) { return a.reduce(function (s, r) { return s + r.v; }, 0); }
  function by(a, f) { var o = {}; a.forEach(function (r) { var k = f(r) || '—'; if (!o[k]) o[k] = { k: k, v: 0, n: 0 }; o[k].v += r.v; o[k].n++; }); return Object.keys(o).map(function (k) { return o[k]; }).sort(function (x, y) { return y.v - x.v || y.n - x.n; }); }

  function btn() {
    if (document.getElementById('gi-btn')) return; css();
    var b = document.createElement('button'); b.id = 'gi-btn'; b.type = 'button'; b.innerHTML = '💡 <span>' + esc(L('一眼看懂', 'At a glance', 'មើលភ្លាម')) + '</span>';
    b.onclick = open; document.body.appendChild(b);
  }
  function open() {
    var ov = document.getElementById('gi-ov'); if (ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'gi-ov'; ov.innerHTML = '<div class="gi-sheet"><div class="gi-h"><b>💡 ' + esc(L.apply(null, C.t)) + ' · ' + esc(L('一眼看懂', 'At a glance', 'មើលភ្លាម')) + '</b><button data-x>✕</button></div><div class="gi-b" id="gi-b">⏳</div></div>';
    ov.onclick = function (e) { if (e.target === ov || e.target.closest('[data-x]')) close(); };
    document.body.appendChild(ov);
    Promise.resolve(C.load && C.load()).catch(function () {}).then(ensureChart).then(draw);
  }
  function ensureChart() { if (typeof Chart !== 'undefined') return; return new Promise(function (res) { var sc = document.createElement('script'); sc.src = 'shared/chart.umd.min.js?v=4.4.1-local-20260824'; sc.onload = res; sc.onerror = function () { var c = document.createElement('script'); c.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'; c.onload = res; c.onerror = res; document.head.appendChild(c); }; document.head.appendChild(sc); }); }
  function close() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; var o = document.getElementById('gi-ov'); if (o) o.remove(); }

  function draw() {
    var b = document.getElementById('gi-b'); if (!b) return; charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = [];
    var all = C.rows().filter(function (r) { return r.d; }), q = S.q.toLowerCase();
    if (!all.length) { b.innerHTML = '<div class="gi-li">⚪ ' + esc(L('這一頁還沒有資料（或還在讀取）。', 'No data on this page yet (or still loading).', 'មិនទាន់មានទិន្នន័យ')) + '</div>'; return; }
    var keys = {}; all.forEach(function (r) { keys[keyOf(r.d)] = 1; }); var ks = Object.keys(keys).sort();
    if (!S.ym || !keys[S.ym]) S.ym = ks[ks.length - 1];
    var groups = by(all, function (r) { return r.g; }).map(function (x) { return x.k; });
    var flt = function (r) { return (!S.g || r.g === S.g) && (!q || (r.n + ' ' + r.c + ' ' + r.x + ' ' + r.g).toLowerCase().indexOf(q) >= 0); };
    var rows = all.filter(flt), cur = rows.filter(function (r) { return keyOf(r.d) === S.ym; }), pk = shift(S.ym, -1), prev = rows.filter(function (r) { return keyOf(r.d) === pk; });
    var h = '<div class="gi-f"><select id="gi-type"><option value="month"' + (S.type === 'month' ? ' selected' : '') + '>' + esc(L('月', 'Month', 'ខែ')) + '</option><option value="year"' + (S.type === 'year' ? ' selected' : '') + '>' + esc(L('年', 'Year', 'ឆ្នាំ')) + '</option></select>' +
      '<button data-sh="-1">◀</button><select id="gi-ym">' + ks.slice().reverse().map(function (k) { return '<option' + (k === S.ym ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select><button data-sh="1">▶</button>' +
      '<input id="gi-q" placeholder="🔎 ' + esc(L('搜尋', 'Search', 'ស្វែងរក')) + '" value="' + esc(S.q) + '"></div>' +
      '<div class="gi-chips"><button class="' + (S.g ? '' : 'on') + '" data-g="">' + esc(L('全部', 'All', 'ទាំងអស់')) + '</button>' + groups.slice(0, 8).map(function (g, i) { return '<button class="' + (S.g === g ? 'on' : '') + '" data-g="' + esc(g) + '"><i style="background:' + PAL[i % 8] + '"></i>' + esc(g) + '</button>'; }).join('') + '</div>';
    h += '<div class="gi-sec">' + explain(cur, prev, all.filter(flt)) + '</div>';
    h += '<div class="gi-grid"><div class="gi-ch"><div class="gi-ct">📊 ' + esc(L('近 12 期（分色＝分組）', 'Last 12 periods (colour = group)', '១២ រយៈពេល')) + '</div><div class="gi-cb"><canvas id="gi-c1"></canvas></div><div class="gi-cn" id="gi-n1"></div></div>' +
      '<div class="gi-ch"><div class="gi-ct">🍩 ' + esc(L.apply(null, C.mixT)) + '</div><div class="gi-cb"><canvas id="gi-c2"></canvas></div><div class="gi-cn" id="gi-n2"></div></div>' +
      '<div class="gi-ch"><div class="gi-ct">🏆 ' + esc(L('前 10 名', 'Top 10', '១០ ដំបូង')) + '</div><div class="gi-cb tall"><canvas id="gi-c3"></canvas></div><div class="gi-cn" id="gi-n3"></div></div></div>';
    b.innerHTML = h; bind(b); charts3(rows, cur, groups);
  }
  function explain(cur, prev, rows) {
    var out = [], t = sum(cur), tp = sum(prev), p = pct(t, tp);
    if (!cur.length) return '<div class="gi-li">⚪ ' + esc(S.ym + L(' 沒有記錄。', ': no records.', ' គ្មានកំណត់ត្រា។')) + '</div>';
    if (C.split && !S.g) { var gp0 = {}; by(prev, function (r) { return r.g; }).forEach(function (x) { gp0[x.k] = x.v; }); out.push(['📦', S.ym + ' ' + by(cur, function (r) { return r.g; }).map(function (x) { var q0 = pct(x.v, gp0[x.k] || 0); return x.k + ' ' + fmt(x.v) + '（' + x.n + L(' 筆', ' rec', '') + '）' + (gp0[x.k] ? ' ' + dot(q0) + pt(q0) : ''); }).join(' · ')]); }
    else out.push([dot(p), S.ym + ' ' + L('合計 ', 'total ', 'សរុប ') + fmt(t) + '（' + cur.length + L(' 筆', ' records', ' កំណត់ត្រា') + '）' + (prev.length ? L('，上期 ', ', previous ', ', មុន ') + fmt(tp) + ' ' + pt(p) : L('，上期沒有記錄', ', no records previous period', ''))]);
    var g = by(cur, function (r) { return r.g; }), gp = {}; by(prev, function (r) { return r.g; }).forEach(function (x) { gp[x.k] = x.v; });
    if (g.length > 1 || prev.length) { var ch = g.map(function (x) { return { k: x.k, d: x.v - (gp[x.k] || 0), v: x.v }; }).sort(function (a, b) { return Math.abs(b.d) - Math.abs(a.d); }); out.push(['📊', g.slice(0, 4).map(function (x) { return x.k + ' ' + fmt(x.v) + (t ? '（' + Math.round(x.v / t * 100) + '%）' : ''); }).join('、') + (prev.length && ch[0] && ch[0].d ? L('；變化最大：', '; biggest change: ', '; ប្រែប្រួលធំ៖ ') + ch[0].k + ' ' + (ch[0].d > 0 ? '+' : '') + fmt(ch[0].d) : '')]); }
    var top = by(cur, function (r) { return r.n; }).slice(0, 3); if (top.length) out.push(['🏆', L('最多：', 'Top: ', 'ច្រើនបំផុត៖ ') + top.map(function (x) { return x.k + ' ' + fmt(x.v) + (x.n > 1 ? ' ×' + x.n : ''); }).join('、')]);
    var c = by(cur, function (r) { return r.c; }); if (c.length > 1) out.push(['👥', L.apply(null, C.mixT) + '：' + c.slice(0, 3).map(function (x) { return x.k + ' ' + (t ? Math.round(x.v / t * 100) + '%' : x.n + L('筆', '', '')); }).join('、')]);
    var big = cur.slice().sort(function (a, b) { return b.v - a.v; })[0]; if (big && t && big.v / t >= 0.3 && cur.length > 2) out.push(['⚠️', L('單筆最大 ', 'Largest single record ', 'ធំបំផុត ') + fmt(big.v) + ' · ' + big.n + ' · ' + big.d.slice(5) + L('，佔本期 ', ' = ', ' = ') + Math.round(big.v / t * 100) + '%']);
    var days = {}; cur.forEach(function (r) { days[r.d] = 1; }); var last = Object.keys(days).sort().pop();
    if (S.type === 'month') out.push(['📅', L('有記錄的天數 ', 'Days with records ', 'ថ្ងៃមានកំណត់ត្រា ') + Object.keys(days).length + L(' 天，最後一筆 ', ', latest ', ', ចុងក្រោយ ') + last]);
    return out.map(function (x) { return '<div class="gi-li"><span>' + x[0] + '</span>' + esc(x[1]) + '</div>'; }).join('');
  }
  function charts3(rows, cur, groups) {
    if (typeof Chart === 'undefined') return; var ks = []; for (var i = 11; i >= 0; i--) ks.push(shift(S.ym, -i));
    var gs = groups.slice(0, 8), ds = gs.map(function (g, i) { return { label: g, backgroundColor: PAL[i % 8], stack: C.split ? g : 's', data: ks.map(function (k) { return sum(rows.filter(function (r) { return r.g === g && keyOf(r.d) === k; })); }) }; });
    var tot = ks.map(function (_, j) { return ds.reduce(function (s, d) { return s + d.data[j]; }, 0); });
    var tick = function (v) { return C.money ? '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v) : v >= 1000 ? Math.round(v / 1000) + 'k' : v; };
    var c1 = document.getElementById('gi-c1'); if (c1) charts.push(new Chart(c1, { type: 'bar', data: { labels: ks.map(function (k) { return k.length > 4 ? k.slice(2) : k; }), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' ' + fmt(c.raw); } } } }, scales: { x: { stacked: true, ticks: { font: { size: 9 } } }, y: { stacked: true, ticks: { callback: tick } } } } }));
    var nz = tot.filter(function (v) { return v > 0; }), avg = nz.length ? nz.reduce(function (a, b) { return a + b; }, 0) / nz.length : 0, last = tot[tot.length - 1];
    note('gi-n1', nz.length ? S.ym + ' ' + fmt(last) + L('，有資料期間平均 ', ', average ', ', មធ្យម ') + fmt(avg) + ' ' + dot(pct(last, avg)) + pt(pct(last, avg)) : '');
    var mix = by(cur, function (r) { return r.c; }), m7 = mix.slice(0, 7), rest = mix.slice(7).reduce(function (s, x) { return s + x.v; }, 0), lab = m7.map(function (x) { return x.k; }), val = m7.map(function (x) { return x.v || x.n; }); if (rest) { lab.push(L('其他', 'Other', 'ផ្សេងៗ')); val.push(rest); }
    var c2 = document.getElementById('gi-c2'); if (c2 && val.length) charts.push(new Chart(c2, { type: 'doughnut', data: { labels: lab, datasets: [{ data: val, backgroundColor: PAL }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, generateLabels: function (ch) { var d = ch.data.datasets[0], s = d.data.reduce(function (a, b) { return a + b; }, 0) || 1; return ch.data.labels.map(function (l, i) { return { text: String(l).slice(0, 18) + ' ' + Math.round(d.data[i] / s * 100) + '%', fillStyle: d.backgroundColor[i], strokeStyle: '#fff', index: i }; }); } } } } } }));
    var tv = sum(cur); note('gi-n2', mix[0] ? L('最大：', 'Largest: ', 'ធំបំផុត៖ ') + mix[0].k + (tv ? ' ' + Math.round(mix[0].v / tv * 100) + '%' : '') : '');
    var top = by(cur, function (r) { return r.n; }).slice(0, 10);
    var c3 = document.getElementById('gi-c3'); if (c3 && top.length) charts.push(new Chart(c3, { type: 'bar', data: { labels: top.map(function (x) { return String(x.k).slice(0, 22); }), datasets: [{ data: top.map(function (x) { return x.v || x.n; }), backgroundColor: top.map(function (_, i) { return i < 3 ? '#2563eb' : '#93c5fd'; }) }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { var x = top[c.dataIndex]; return fmt(x.v) + ' · ' + x.n + L(' 筆', ' rec', ''); } } } }, scales: { x: { ticks: { callback: tick } }, y: { ticks: { font: { size: 10 } } } } } }));
    note('gi-n3', top.length && tv ? L('前 3 名佔 ', 'Top 3 = ', '៣ ដំបូង = ') + Math.round(top.slice(0, 3).reduce(function (s, x) { return s + x.v; }, 0) / tv * 100) + '%' : '');
  }
  function note(id, t) { var n = document.getElementById(id); if (n) n.textContent = t; }
  function bind(b) {
    b.querySelectorAll('[data-g]').forEach(function (x) { x.onclick = function () { S.g = x.getAttribute('data-g'); draw(); }; });
    b.querySelectorAll('[data-sh]').forEach(function (x) { x.onclick = function () { S.ym = shift(S.ym, +x.getAttribute('data-sh')); draw(); }; });
    var y = document.getElementById('gi-ym'); if (y) y.onchange = function () { S.ym = y.value; draw(); };
    var ty = document.getElementById('gi-type'); if (ty) ty.onchange = function () { S.type = ty.value; S.ym = ''; draw(); };
    var q = document.getElementById('gi-q'), t; if (q) q.oninput = function () { S.q = q.value; clearTimeout(t); t = setTimeout(function () { draw(); var n = document.getElementById('gi-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); };
  }
  function css() {
    if (document.getElementById('gi-css')) return; var s = document.createElement('style'); s.id = 'gi-css';
    s.textContent = '#gi-btn{position:fixed;right:14px;bottom:18px;z-index:9000;border:0;border-radius:999px;background:#1d4ed8;color:#fff;font-weight:700;font-size:14px;padding:10px 14px;box-shadow:0 6px 18px rgba(29,78,216,.35);cursor:pointer}' +
      '#gi-ov{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9500;display:flex;align-items:flex-end;justify-content:center}.gi-sheet{background:#f8fafc;width:min(1100px,100%);max-height:92vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column}.gi-h{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:15px}.gi-h button{border:0;background:#e2e8f0;border-radius:8px;padding:4px 10px;cursor:pointer}.gi-b{overflow:auto;padding:12px 14px 20px}' +
      '.gi-f{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.gi-f select,.gi-f input,.gi-f button{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font-size:13px;background:#fff}.gi-f input{flex:1;min-width:140px}.gi-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.gi-chips button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:5px}.gi-chips button.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.gi-chips i{width:9px;height:9px;border-radius:50%;display:inline-block}' +
      '.gi-sec{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:12px;padding:8px 12px;margin-bottom:10px}.gi-li{display:flex;gap:8px;font-size:14px;line-height:1.5;padding:3px 0;border-top:1px dashed #e2e8f0}.gi-li:first-child{border-top:0}.gi-li span{flex:none}' +
      '.gi-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px}.gi-ch{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;min-width:0}.gi-ct{font-weight:700;font-size:13px;margin-bottom:6px}.gi-cb{position:relative;height:230px}.gi-cn{font-size:12px;color:#475569;margin-top:6px}' +
      '@media(max-width:860px){.gi-grid{grid-template-columns:1fr}#gi-btn span{display:none}}@media print{#gi-btn{display:none}}';
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(btn, 800); }); else setTimeout(btn, 800);
})(window);
