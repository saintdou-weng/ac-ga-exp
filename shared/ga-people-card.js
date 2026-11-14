/* ga-people-card.js — 司機／車牌資訊卡（交通車、ETC 頁）2026-11-14
   在記錄表點「司機」或「車牌」那一格 → 資訊卡：本期與今年趟數／里程（ETC 為通行費）、常用車牌或司機、用途比例（一條分色條）、
   每月趟數／里程、行程清單（可搜尋）、照片（標準照＋證件／文件＋異常，依月份、不重複）。
   照片存在雲端 PROFILES_DB（key：driver:姓名、plate:車牌），上傳走既有 recvItemAttachment（Drive）。左右滑換人／換車；滑到底接下一個。 */
(function (root) {
  'use strict';
  var GA = root.GA, TP = root.GATransport; if (!GA || !TP) return;
  function L(zh, en, km) { var l = GA.lang; return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  var ETC = TP.kind === 'etc', S = { type: 'driver', name: '', tab: 'info', year: new Date().getFullYear(), q: '' }, PKEY = 'ga_profiles_v1', P = {};
  try { P = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch (e) { P = {}; }
  var css = document.createElement('style');
  css.textContent = '.pp-ov{position:fixed;inset:0;background:#0f172a99;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}.pp-sheet{background:#f8fafc;border-radius:16px;width:100%;max-width:780px;overflow:hidden;box-shadow:0 20px 60px #0006;color:#1e293b;font-size:14px}' +
    '.pp-h{background:#0f3d5e;color:#fff;padding:12px;display:flex;gap:9px;align-items:center}.pp-h img,.pp-h .ph{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#ffffff22;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}.pp-h h3{margin:0;font-size:16px;line-height:1.25;flex:1;min-width:0}.pp-h h3 small{display:block;font-size:11px;font-weight:600;opacity:.88;margin-top:2px}.pp-h button{background:#ffffff2e;border:0;color:#fff;border-radius:8px;width:36px;height:36px;font-size:18px;cursor:pointer;flex:none;padding:0}.pp-h button:disabled{opacity:.3}' +
    '.pp-k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 12px 0}.pp-k div{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;border-top:4px solid var(--c,#2563eb);min-width:0}.pp-k b{display:block;font-size:19px;color:var(--c,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pp-k small{font-size:10.5px;color:#64748b;font-weight:700}' +
    '.pp-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0;margin-top:10px}.pp-tabs button{flex:1;border:0;background:none;padding:10px 3px;font:inherit;font-weight:800;font-size:12.5px;color:#64748b;border-bottom:3px solid transparent;cursor:pointer;border-radius:0}.pp-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}.pp-b{padding:12px;max-height:56vh;overflow:auto}' +
    '.pp-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pp-f{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.pp-f small{display:block;font-size:10.5px;color:#64748b;font-weight:700}.pp-f b{font-size:13.5px;word-break:break-word}.pp-f.w{grid-column:1/-1}' +
    '.pp-bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:6px 0}.pp-bar i{display:block;height:100%}.pp-leg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px}.pp-leg span:before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;background:var(--c);vertical-align:-1px}' +
    '.pp-m{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff}.pp-m th,.pp-m td{border-bottom:1px solid #e2e8f0;padding:6px 7px;text-align:right}.pp-m th:first-child,.pp-m td:first-child{text-align:left}.pp-m th{background:#f1f5f9;font-size:11px}' +
    '.pp-rec{display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-left:4px solid var(--c,#2563eb);border-radius:9px;padding:7px 10px;margin-bottom:6px;font-size:12.5px}.pp-rec small{color:#64748b;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pp-rec .q{font-weight:800;font-size:14px;white-space:nowrap}' +
    '.pp-q{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;margin-bottom:8px}' +
    '.pp-ph2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pp-phbox{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px;min-width:0}.pp-phbox h5{margin:0 0 6px;font-size:12px;color:#475569}.pp-phimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;color:#94a3b8}' +
    '.pp-btns{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.pp-btns button{flex:1;min-width:110px}.pp-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer}.pp-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}' +
    '.pp-mo{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;margin-bottom:8px}.pp-mo h5{margin:0 0 6px;font-size:12.5px;display:flex;justify-content:space-between}.pp-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px}.pp-thumbs a{position:relative;display:block}.pp-thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}.pp-tag{position:absolute;left:4px;top:4px;font-size:9.5px;font-weight:800;color:#fff;border-radius:6px;padding:1px 5px}' +
    '.pp-next{margin:14px 0 2px;padding:12px;border:1px dashed #93c5fd;border-radius:12px;background:#eff6ff;text-align:center;font-weight:800;color:#1d4ed8;cursor:pointer;font-size:13px}.pp-next small{display:block;font-weight:600;color:#64748b;margin-top:2px}' +
    'td.pp-link{cursor:pointer;color:#1d4ed8;text-decoration:underline dotted;text-underline-offset:3px}' +
    '@media(max-width:720px){.pp-ov{padding:0;overflow:hidden}.pp-sheet{border-radius:0;height:100vh;height:100dvh;display:flex;flex-direction:column}.pp-b{max-height:none;flex:1}.pp-k{grid-template-columns:repeat(2,1fr)}.pp-k b{font-size:17px}}';
  document.head.appendChild(css);
  var COL = ['#2b8fbd', '#2e9c6a', '#f2a93b', '#8e6cc9', '#e35d5b', '#3fb9c9', '#c97c2e', '#94a3b8'];
  function rows() { try { return (TP.rows() || []).filter(function (r) { return r && !r._deleted; }); } catch (e) { return []; } }
  function txt(v) { return v == null ? '' : String(v).trim(); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function mine(r) { return S.type === 'driver' ? txt(r.driver).toLowerCase() === S.name.toLowerCase() : txt(r.plate).toLowerCase() === S.name.toLowerCase(); }
  function list() { var c = {}; rows().forEach(function (r) { var k = txt(S.type === 'driver' ? r.driver : r.plate); if (k) c[k] = (c[k] || 0) + 1; }); return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }); }
  function pk() { return S.type + ':' + S.name; }
  function prof() { return P[pk()] || {}; }
  function phUrl(e) { return e && (e.previewUrl || e.url) || ''; }
  function phKey(e) { return String(e && (e.hash || e.fileId || e.url) || ''); }
  function photos() { var p = prof(), seen = {}, out = []; function add(e, kind) { var k = phKey(e); if (!e || !phUrl(e) || !k || seen[k]) return; seen[k] = 1; out.push({ e: e, ym: String(e.ym || '').slice(0, 7), kind: kind }); } if (p.photo) add(p.photo, 'std'); (p.monthPhotos || []).forEach(function (m) { add(m, m.kind || 'doc'); }); return out; }
  var KIND = { std: ['#059669', '標準照', 'Standard', 'ស្តង់ដារ'], doc: ['#2563eb', '證件文件', 'Document', 'ឯកសារ'], bad: ['#dc2626', '異常', 'Abnormal', 'មិនប្រក្រតី'] };
  function kl(k) { var d = KIND[k] || KIND.doc; return L(d[1], d[2], d[3]); }
  function value(r) { return ETC ? num(r.charge) : num(r.km); }
  function unit() { return ETC ? 'USD' : 'km'; }
  function fmt(v) { return ETC ? '$' + (Math.round(v * 100) / 100).toLocaleString('en-US') : Math.round(v).toLocaleString('en-US'); }
  function F(label, v, wide) { if (v === '' || v == null) return ''; return '<div class="pp-f' + (wide ? ' w' : '') + '"><small>' + esc(label) + '</small><b>' + esc(v) + '</b></div>'; }
  function routeName(v) { try { return TP.route(v) || v || L('未分類', 'Unclassified', 'មិនបានចាត់'); } catch (e) { return v || '—'; } }

  async function loadProfiles() { try { if (GA.backend && GA.backend.require) await GA.backend.require('profiles', { action: 'profilesLoad' }); var r = await GA.gasGet('profilesLoad'), d = r && r.data; if (d && d.profiles) { Object.keys(d.profiles).forEach(function (k) { var a = P[k], b = d.profiles[k]; if (!a || Date.parse(b.updatedAt || 0) >= Date.parse(a.updatedAt || 0)) P[k] = b; }); try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} if (S.name) open(S.type, S.name, true); } } catch (e) {} }
  async function saveProfile(k) { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} var o = {}; o[k] = P[k]; var r = await GA.gasPost('profilesSave', { profiles: o }), d = r && r.data; if (d && d.profiles) { Object.keys(d.profiles).forEach(function (x) { P[x] = d.profiles[x]; }); try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} } }

  function open(type, name, keep) {
    S.type = type; S.name = txt(name); if (!S.name) return; if (!keep) { S.q = ''; }
    var old = document.getElementById('pp-ov'); if (old) old.remove();
    var ls = list(), idx = ls.findIndex(function (x) { return x.toLowerCase() === S.name.toLowerCase(); }), pr = TP.period(), all = rows().filter(mine), cur = all.filter(function (r) { return GA.inPeriod(r.date, pr.key, pr.period); }), yr = String(new Date().getFullYear()), yrs = all.filter(function (r) { return String(r.date || '').slice(0, 4) === yr; });
    var sum = function (a) { return a.reduce(function (s, r) { return s + value(r); }, 0); }, ph = prof().photo, pl = GA.periodLabel ? GA.periodLabel(pr.key, pr.period) : pr.key;
    var ov = document.createElement('div'); ov.className = 'pp-ov'; ov.id = 'pp-ov';
    ov.innerHTML = '<div class="pp-sheet"><div class="pp-h"><button data-a="prev"' + (idx > 0 ? '' : ' disabled') + '>‹</button>' + (ph ? '<img src="' + esc(phUrl(ph)) + '" alt="">' : '<div class="ph">' + (type === 'driver' ? '👤' : '🚐') + '</div>') +
      '<h3>' + esc(S.name) + '<small>' + esc(type === 'driver' ? L('司機', 'Driver', 'អ្នកបើកបរ') : L('車牌', 'Vehicle plate', 'ផ្លាកលេខ')) + ' · ' + esc(ETC ? 'ETC' : L('交通車', 'Transportation', 'ដឹកជញ្ជូន')) + (idx >= 0 ? ' · ' + (idx + 1) + ' / ' + ls.length : '') + '</small></h3><button data-a="next"' + (idx >= 0 && idx < ls.length - 1 ? '' : ' disabled') + '>›</button><button data-a="close">×</button></div>' +
      '<div class="pp-k"><div style="--c:#2563eb"><b>' + cur.length + '</b><small>' + esc(L('本期趟數', 'Trips this period', 'ដំណើរ')) + '</small></div><div style="--c:#0d9488"><b>' + fmt(sum(cur)) + '</b><small>' + esc((ETC ? L('本期通行費', 'Toll this period', 'ថ្លៃផ្លូវ') : L('本期里程 km', 'KM this period', 'គីឡូម៉ែត្រ'))) + '</small></div><div style="--c:#475569"><b>' + yrs.length + '</b><small>' + esc(yr + L(' 年趟數', ' trips', ' ដំណើរ')) + '</small></div><div style="--c:#d97706"><b>' + fmt(sum(yrs)) + '</b><small>' + esc(yr + (ETC ? L(' 年通行費', ' toll', ' ថ្លៃផ្លូវ') : L(' 年里程', ' km', ' គម'))) + '</small></div></div>' +
      '<div class="pp-tabs"><button data-t="info">📋 ' + esc(L('資料', 'Details', 'ព័ត៌មាន')) + '</button><button data-t="month">📈 ' + esc(L('每月', 'Monthly', 'ប្រចាំខែ')) + '</button><button data-t="trip">🧾 ' + esc(L('行程', 'Trips', 'ដំណើរ')) + ' (' + cur.length + ')</button><button data-t="photo">📷 ' + esc(L('照片', 'Photos', 'រូបថត')) + ' (' + photos().length + ')</button></div><div class="pp-b" id="pp-b"></div></div>';
    ov._pl = pl; document.body.appendChild(ov); show(S.tab);
    var sheet = ov.querySelector('.pp-sheet'), x0 = 0, y0 = 0;
    sheet.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (!t) return; var dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !(e.target.closest && e.target.closest('table'))) { if (dx < 0 && idx < ls.length - 1) open(type, ls[idx + 1], true); else if (dx > 0 && idx > 0) open(type, ls[idx - 1], true); } }, { passive: true });
    ov.onclick = function (e) {
      if (e.target === ov) { close(); return; }
      var t = e.target.closest('.pp-tabs [data-t]'); if (t) { show(t.getAttribute('data-t')); return; }
      var y = e.target.closest('[data-y]'); if (y) { S.year = Number(y.getAttribute('data-y')); show('month'); return; }
      var go = e.target.closest('[data-go]'); if (go) { open(go.getAttribute('data-gt'), go.getAttribute('data-go')); return; }
      var ph2 = e.target.closest('[data-ph]'); if (ph2) { pick(ph2.getAttribute('data-ph')); return; }
      var nx = e.target.closest('[data-nextgo]'); if (nx) { if (idx < ls.length - 1) open(type, ls[idx + 1], true); return; }
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') close(); else if (act === 'prev' && idx > 0) open(type, ls[idx - 1], true); else if (act === 'next' && idx < ls.length - 1) open(type, ls[idx + 1], true);
    };
  }
  function close() { var o = document.getElementById('pp-ov'); if (o) o.remove(); S.name = ''; }
  function show(t) {
    S.tab = t; var b = document.getElementById('pp-b'); if (!b) return;
    document.querySelectorAll('#pp-ov .pp-tabs button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-t') === t); });
    b.innerHTML = (t === 'month' ? monthHtml() : t === 'trip' ? tripHtml() : t === 'photo' ? photoHtml() : infoHtml()) + nextHtml();
    var q = document.getElementById('pp-q'); if (q) q.oninput = function () { S.q = this.value; var l = document.getElementById('pp-list'); if (l) l.innerHTML = tripList(); };
    var pull = 0, tm = null, ty = 0; function atEnd() { return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; } function go() { var nx = b.querySelector('[data-nextgo]'); if (nx) nx.click(); }
    b.onwheel = function (e) { if (e.deltaY > 0 && atEnd()) { pull += e.deltaY; clearTimeout(tm); tm = setTimeout(function () { pull = 0; }, 400); if (pull > 220) { pull = 0; go(); } } };
    b.ontouchstart = function (e) { ty = e.touches[0].clientY; }; b.ontouchend = function (e) { var dy = ty - ((e.changedTouches[0] || {}).clientY || ty); if (atEnd() && dy > 90) go(); };
  }
  function shareBar(parts, total) { if (!total) return ''; return '<div class="pp-bar">' + parts.map(function (p, i) { return '<i style="width:' + (p[1] / total * 100) + '%;background:' + COL[i % COL.length] + '"></i>'; }).join('') + '</div><div class="pp-leg">' + parts.map(function (p, i) { return '<span style="--c:' + COL[i % COL.length] + '">' + esc(p[0]) + ' ' + p[1] + ' (' + Math.round(p[1] / total * 100) + '%)</span>'; }).join('') + '</div>'; }
  function infoHtml() {
    var pr = TP.period(), all = rows().filter(mine), cur = all.filter(function (r) { return GA.inPeriod(r.date, pr.key, pr.period); }), base = cur.length ? cur : all;
    var other = S.type === 'driver' ? 'plate' : 'driver', oc = {}, rc = {}; base.forEach(function (r) { var o = txt(r[other]); if (o) oc[o] = (oc[o] || 0) + 1; var k = ETC ? (txt(r.to) || txt(r.reason) || '—') : routeName(r.routeType); rc[k] = (rc[k] || 0) + 1; });
    var op = Object.keys(oc).map(function (k) { return [k, oc[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), rp = Object.keys(rc).map(function (k) { return [k, rc[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 7);
    var srt = all.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), last = srt[0], first = srt[srt.length - 1], days = {}; base.forEach(function (r) { days[r.date] = 1; });
    var h = '<div style="font-size:11.5px;color:#64748b;margin-bottom:6px">' + esc((cur.length ? L('以下為本期：', 'This period: ', 'រយៈពេលនេះ៖ ') + (document.getElementById('pp-ov') || {})._pl : L('本期沒有行程，以下為全部期間', 'No trips this period — showing all periods', 'គ្មានដំណើរ — បង្ហាញទាំងអស់'))) + '</div>';
    h += '<div class="pp-f w" style="margin-bottom:8px"><small>' + esc(ETC ? L('目的地', 'Destinations', 'គោលដៅ') : L('用途比例', 'Purpose mix', 'គោលបំណង')) + '</small>' + shareBar(rp, base.length) + '</div>';
    h += '<div class="pp-g">' + F(L('出車天數', 'Days with trips', 'ថ្ងៃ'), Object.keys(days).length) + F(ETC ? L('平均每趟通行費', 'Average toll per trip', 'មធ្យម') : L('平均每趟 km', 'Average km per trip', 'មធ្យម km'), base.length ? fmt(base.reduce(function (s, r) { return s + value(r); }, 0) / base.length) : '') +
      F(L('最近一趟', 'Last trip', 'ចុងក្រោយ'), last ? last.date + '  ·  ' + (txt(last[other]) || '—') + '  ·  ' + (ETC ? (txt(last.from) + ' → ' + txt(last.to)) : routeName(last.routeType)) : '', true) + F(L('第一筆記錄', 'First record', 'ដំបូង'), first ? first.date : '') + F(L('全部趟數', 'All trips', 'សរុប'), all.length) + '</div>';
    if (op.length) h += '<div style="font-weight:800;font-size:12.5px;margin:10px 0 6px">' + esc(S.type === 'driver' ? L('🚐 開過的車', '🚐 Vehicles driven', '🚐 រថយន្ត') : L('👤 開這台車的司機', '👤 Drivers of this vehicle', '👤 អ្នកបើកបរ')) + '</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + op.slice(0, 12).map(function (o) { return '<button class="pp-btn" data-gt="' + other + '" data-go="' + esc(o[0]) + '">' + (other === 'plate' ? '🚐 ' : '👤 ') + esc(o[0]) + ' · ' + o[1] + '</button>'; }).join('') + '</div>';
    return h;
  }
  function monthHtml() {
    var y = S.year, all = rows().filter(mine), r = [], mx = 1;
    for (var m = 1; m <= 12; m++) { var k = y + '-' + (m < 10 ? '0' + m : m), a = all.filter(function (x) { return String(x.date || '').slice(0, 7) === k; }), v = a.reduce(function (s, x) { return s + value(x); }, 0); r.push([m, a.length, v]); mx = Math.max(mx, v); }
    var ys = {}; all.forEach(function (x) { var yy = String(x.date || '').slice(0, 4); if (/^\d{4}$/.test(yy)) ys[yy] = 1; }); ys[y] = 1;
    return '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' + Object.keys(ys).sort().reverse().map(function (yy) { return '<button class="pp-btn' + (Number(yy) === y ? ' pri' : '') + '" data-y="' + yy + '">' + yy + '</button>'; }).join('') + '</div><table class="pp-m"><tr><th>' + esc(L('月', 'Month', 'ខែ')) + '</th><th>' + esc(L('趟數', 'Trips', 'ដំណើរ')) + '</th><th>' + esc(ETC ? L('通行費', 'Toll', 'ថ្លៃផ្លូវ') : 'km') + '</th><th style="text-align:left;width:42%"></th></tr>' +
      r.map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + (x[1] || '—') + '</td><td><b>' + (x[2] ? fmt(x[2]) : '—') + '</b></td><td style="text-align:left"><span style="display:block;height:8px;border-radius:4px;background:#2b8fbd;width:' + Math.round(x[2] / mx * 100) + '%"></span></td></tr>'; }).join('') +
      '<tr><th>' + esc(L('合計', 'Total', 'សរុប')) + '</th><th>' + r.reduce(function (s, x) { return s + x[1]; }, 0) + '</th><th>' + fmt(r.reduce(function (s, x) { return s + x[2]; }, 0)) + '</th><th></th></tr></table>';
  }
  function tripList() {
    var pr = TP.period(), q = S.q.toLowerCase(), other = S.type === 'driver' ? 'plate' : 'driver', a = rows().filter(mine).filter(function (r) { return GA.inPeriod(r.date, pr.key, pr.period) && (!q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0); }).sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); });
    if (!a.length) return '<div style="text-align:center;color:#64748b;padding:20px">' + esc(L('本期沒有行程', 'No trips this period', 'គ្មានដំណើរ')) + '</div>';
    return a.slice(0, 300).map(function (r, i) { var c = COL[Math.abs(String(r.routeType || r.to || '').split('').reduce(function (s, ch) { return s + ch.charCodeAt(0); }, 0)) % 6]; return '<div class="pp-rec" style="--c:' + c + '"><span style="font-weight:700">' + esc(String(r.date || '').slice(5)) + '</span><span><b>' + esc(ETC ? (txt(r.from) + ' → ' + txt(r.to)) : routeName(r.routeType)) + ' · ' + (other === 'plate' ? '🚐 ' : '👤 ') + esc(txt(r[other]) || '—') + '</b><small>' + esc([r.reason, r.users, r.remarks].filter(Boolean).join(' · ') || '—') + '</small></span><span class="q">' + (value(r) ? fmt(value(r)) + (ETC ? '' : ' km') : '—') + '</span></div>'; }).join('');
  }
  function tripHtml() { return '<input class="pp-q" id="pp-q" type="search" value="' + esc(S.q) + '" placeholder="🔍 ' + esc(L('原因／車牌／地點', 'Reason / plate / place', 'មូលហេតុ / ផ្លាក')) + '"><div id="pp-list">' + tripList() + '</div>'; }
  function photoHtml() {
    var all = photos(), st = prof().photo, docs = all.filter(function (p) { return p.kind !== 'std'; });
    var box = function (title, p, empty) { return '<div class="pp-phbox"><h5>' + esc(title) + '</h5>' + (p ? '<a href="' + esc(p.e.url || phUrl(p.e)) + '" target="_blank" rel="noopener"><img class="pp-phimg" loading="lazy" src="' + esc(phUrl(p.e)) + '" alt=""></a>' : '<div class="pp-phimg">📷</div>') + '<div style="font-size:10.5px;color:#64748b;margin-top:4px">' + esc(p ? (p.ym + ' ' + kl(p.kind)) : empty) + '</div></div>'; };
    var h = '<div class="pp-ph2">' + box(S.type === 'driver' ? L('👤 標準照（本人）', '👤 Standard photo', '👤 រូបស្តង់ដារ') : L('🚐 標準照（車輛）', '🚐 Standard photo', '🚐 រូបស្តង់ដារ'), st ? { e: st, ym: String(st.ym || ''), kind: 'std' } : null, L('還沒有標準照', 'No standard photo yet', 'មិនទាន់មាន')) + box(L('🗂 最近的證件／異常', '🗂 Latest document / abnormal', '🗂 ឯកសារចុងក្រោយ'), docs[docs.length - 1] || null, L('還沒有', 'None yet', 'គ្មាន')) + '</div>' +
      '<div class="pp-btns"><button class="pp-btn pri" data-ph="std">📷 ' + esc(st ? L('換標準照', 'Replace standard photo', 'ប្តូរ') : L('加標準照', 'Add standard photo', 'បន្ថែម')) + '</button><button class="pp-btn" data-ph="doc">🪪 ' + esc(S.type === 'driver' ? L('駕照／證件', 'Licence / ID', 'ប័ណ្ណបើកបរ') : L('行照／保險', 'Registration / insurance', 'ប័ណ្ណ / ធានារ៉ាប់រង')) + '</button><button class="pp-btn" data-ph="bad">🟥 ' + esc(L('異常', 'Abnormal', 'មិនប្រក្រតី')) + '</button></div>';
    var by = {}, order = []; all.forEach(function (p) { var k = p.ym || '—'; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(p); }); order.sort().reverse();
    if (!order.length) return h + '<div style="text-align:center;color:#64748b;padding:14px">' + esc(L('還沒有照片。先加一張標準照。', 'No photos yet. Add a standard photo first.', 'មិនទាន់មានរូបថត')) + '</div>';
    return h + order.map(function (k) { return '<div class="pp-mo"><h5><span>🗓 ' + esc(k) + '</span><span>' + by[k].length + '</span></h5><div class="pp-thumbs">' + by[k].map(function (p) { return '<a href="' + esc(p.e.url || phUrl(p.e)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(phUrl(p.e)) + '" alt=""><span class="pp-tag" style="background:' + (KIND[p.kind] || KIND.doc)[0] + '">' + esc(kl(p.kind)) + '</span></a>'; }).join('') + '</div>' + by[k].filter(function (p) { return p.e.note; }).map(function (p) { return '<div style="font-size:11.5px;color:#475569;margin-top:4px">📝 ' + esc(p.e.note) + '</div>'; }).join('') + '</div>'; }).join('');
  }
  function nextHtml() { var ls = list(), i = ls.findIndex(function (x) { return x.toLowerCase() === S.name.toLowerCase(); }), nx = i >= 0 ? ls[i + 1] : null; return nx ? '<div class="pp-next" data-nextgo="1">⬇ ' + esc(L('下一個', 'Next', 'បន្ទាប់')) + '：' + esc(nx) + '<small>' + esc(L('往下拉或點這裡', 'pull down or tap', 'ទាញចុះ ឬចុច')) + '</small></div>' : ''; }
  function compress(f) { return new Promise(function (res) { var fr = new FileReader(); fr.onerror = function () { res(null); }; fr.onload = function () { var src = String(fr.result || ''); if (!/^image\//.test(f.type)) { res({ data: src, mime: f.type }); return; } var im = new Image(); im.onload = function () { var k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', 0.75), mime: 'image/jpeg' }); }; im.onerror = function () { res({ data: src, mime: f.type }); }; im.src = src; }; fr.readAsDataURL(f); }); }
  function pick(kind) {
    var note = ''; if (kind !== 'std') { note = window.prompt(kind === 'bad' ? L('異常說明（例：車損、證件過期）', 'Describe the problem (e.g. vehicle damage, expired document)', 'ពិពណ៌នាបញ្ហា') : L('說明（例：駕照到期日、保險公司）', 'Note (e.g. licence expiry, insurer)', 'កំណត់ចំណាំ'), ''); if (note === null) return; }
    var key = pk(), inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      var hash = [f.name, f.size, f.lastModified].join('|'); if (photos().some(function (p) { return p.e.hash === hash; })) { GA.toast(L('這張照片已經有了，不重複加', 'This photo is already there', 'មានរួចហើយ')); return; }
      GA.toast('⏳ ' + L('上傳中…', 'Uploading…', 'កំពុងផ្ទុក…'));
      try {
        if (GA.backend && GA.backend.require) await GA.backend.require('profiles', { action: 'profilesSave' });
        var c = await compress(f); if (!c || !c.data) throw new Error(L('讀不到照片', 'Cannot read the photo', 'មិនអាចអាន'));
        var r = await GA.gasPost('recvItemAttachment', { itemId: key.replace(/[^\w.-]+/g, '_'), effectiveFrom: GA.ymd(new Date()).slice(0, 7), fileName: f.name || 'photo.jpg', mimeType: c.mime, data: c.data.replace(/^data:[^;]+;base64,/, ''), hash: hash }), d = (r && r.data) || r || {};
        if (!d.url) throw new Error('no file URL');
        var e = Object.assign({ hash: hash, ym: GA.ymd(new Date()).slice(0, 7), createdAt: new Date().toISOString() }, d), p = Object.assign({}, P[key] || {});
        if (kind === 'std') p.photo = e; else { e.kind = kind; e.note = note || ''; p.monthPhotos = (p.monthPhotos || []).concat([e]); }
        p.updatedAt = new Date().toISOString(); P[key] = p; await saveProfile(key);
        GA.toast('✅ ' + L('照片已存到雲端', 'Photo saved to the cloud', 'បានរក្សាទុក'));
        open(S.type, S.name, true); show('photo');
      } catch (er) { GA.toast('❌ ' + L('上傳失敗，請再試一次：', 'Upload failed, please retry: ', 'បរាជ័យ៖ ') + (er.message || er), 'err'); }
    };
    inp.click();
  }
  /* 記錄表：司機、車牌那兩格可點 */
  var fields = TP.fields || [], di = fields.indexOf('driver'), pi = fields.indexOf('plate');
  function mark() { var b = document.getElementById('body'); if (!b) return; Array.prototype.forEach.call(b.rows, function (tr) { [di, pi].forEach(function (i) { var td = tr.cells[i]; if (td && txt(td.textContent)) td.classList.add('pp-link'); }); }); }
  var body = document.getElementById('body');
  if (body) { new MutationObserver(mark).observe(body, { childList: true }); mark(); body.addEventListener('click', function (e) { var td = e.target.closest('td.pp-link'); if (!td) return; var i = td.cellIndex, v = txt(td.textContent).replace(/\s*⚠$/, ''); if (i === di) open('driver', v); else if (i === pi) open('plate', v); }); }
  document.addEventListener('keydown', function (e) { if (!S.name) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') { var p = document.querySelector('#pp-ov [data-a="prev"]'); if (p && !p.disabled) p.click(); } else if (e.key === 'ArrowRight') { var n = document.querySelector('#pp-ov [data-a="next"]'); if (n && !n.disabled) n.click(); } });
  setTimeout(loadProfiles, 1500);
  root.GAPeopleCard = { open: open, close: close };
})(window);
