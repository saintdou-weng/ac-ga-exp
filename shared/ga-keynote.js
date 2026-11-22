/* ga-keynote.js — 紀錄清單＋詳細卡（2026-11-22 Paul：學 AC Security 消防設備的詳細卡／HRA portal sewing）
 * ① 清單：一筆一行（照片｜單號＋品項｜部門／申請人｜金額＋狀態），整列可點
 * ② 點一行 → 詳細卡：上面 n/N ◀ ▶ ✕（手機可左右滑換筆），分頁：
 *      📋 現況（原本的卡片內容與按鈕：編輯／送審／核可…照舊）
 *      🗓 歷史（同一設備／同一地點的所有紀錄，依月份分組）
 *      📷 照片（有照片才出現；依月份分組，點照片看大圖）
 * 用在：維修中心（維修記錄／PO 記錄）、損壞／遺失財物報告（記錄）。
 * 原本的資料、篩選（日週月年、狀態、搜尋）、按鈕和函式都不動；原本的卡片仍在畫面裡（隱藏），詳細卡裡的按鈕就是原本那一顆。
 */
(function (root) {
  'use strict';
  if (root.GAKeynote) return;
  var GA = root.GA || {};
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  function L(zh, en, km) { var l = GA.lang || 'zh'; return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(v) { var n = Number(v) || 0; try { return GA.money ? GA.money(n, 2) : '$' + n.toFixed(2); } catch (e) { return '$' + n.toFixed(2); } }
  function month(d) { var m = String(d || '').match(/(\d{4})[-\/.](\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '—'; }
  function day(d) { var m = String(d || '').match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(d || '').slice(0, 10); }
  function thumb(u, w) { try { if (root.vrtDriveThumb && /drive\.google|googleusercontent|docs\.google\.com\/uc/.test(u)) return root.vrtDriveThumb(u, w || 400); } catch (e) {} return u; }
  var ST = { ok: ['#dcfce7', '#166534'], wait: ['#fef3c7', '#92400e'], bad: ['#fee2e2', '#991b1b'], mute: ['#e2e8f0', '#475569'] };
  function badge(st) { var c = ST[st.cls] || ST.mute; return '<span class="gk-badge" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(st.t) + '</span>'; }

  var CSS = '' +
    '.gk-list{display:flex;flex-direction:column;border:1px solid #dbe3ef;border-radius:12px;background:#fff;overflow:hidden;margin-top:8px}' +
    '.gk-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-bottom:1px solid #eef2f7;cursor:pointer;text-align:left;background:#fff;-webkit-tap-highlight-color:rgba(2,132,199,.12)}' +
    '.gk-row:last-child{border-bottom:none}.gk-row:hover{background:#f8fafc}.gk-row:active{background:#eff6ff}' +
    '.gk-row .gk-sel{flex:none;width:18px;height:18px;margin:0}' +
    '.gk-th{flex:none;width:44px;height:44px;border-radius:9px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;position:relative}' +
    '.gk-th img{width:100%;height:100%;object-fit:cover}.gk-th i{position:absolute;right:1px;bottom:1px;font-style:normal;font-size:9px;font-weight:800;background:rgba(15,23,42,.75);color:#fff;border-radius:5px;padding:0 3px}' +
    '.gk-mid{flex:1 1 auto;min-width:0}.gk-t{font-size:13.5px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.gk-t small{font-weight:700;color:#64748b;font-size:11px;margin-right:5px}' +
    '.gk-s{font-size:11.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}' +
    '.gk-r{flex:none;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}.gk-r b{font-size:13px;color:#0f172a;font-variant-numeric:tabular-nums}' +
    '.gk-badge{display:inline-block;font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;white-space:nowrap}' +
    '.gk-hide{display:none!important}#recordCards.hide+.gk-list{display:none!important}' +
    /* 詳細卡 */
    '.gk-mask{position:fixed;inset:0;z-index:9400;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.gk-sheet{background:#f1f5f9;width:min(760px,100%);max-height:92vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35)}' +
    '@media(max-width:720px){.gk-mask{padding:0;align-items:flex-end}.gk-sheet{width:100%;height:100%;max-height:100%;border-radius:0}}' +
    '.gk-top{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e2e8f0}' +
    '.gk-idx{font-weight:800;color:#475569;font-variant-numeric:tabular-nums;flex:none}.gk-ttl{flex:1 1 auto;min-width:0;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.gk-nb{flex:none;width:40px;height:40px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-size:16px;cursor:pointer}.gk-nb:disabled{opacity:.35}' +
    '.gk-tabs{display:flex;gap:4px;background:#fff;border-bottom:1px solid #e2e8f0;overflow-x:auto;scrollbar-width:none;padding:0 8px}.gk-tabs::-webkit-scrollbar{display:none}' +
    '.gk-tab{flex:none;border:none;background:none;padding:11px 12px;font-size:14px;font-weight:700;color:#64748b;border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}' +
    '.gk-tab.on{color:#0f172a;border-bottom-color:#1e5f8e}.gk-tab em{font-style:normal;font-size:11px;background:#e2e8f0;border-radius:999px;padding:1px 7px;margin-left:5px;color:#475569}' +
    '.gk-body{flex:1 1 auto;overflow:auto;padding:12px;-webkit-overflow-scrolling:touch}' +
    '.gk-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:10px}' +
    '.gk-id{display:flex;gap:12px;padding:12px}.gk-face{flex:none;width:96px;height:96px;border-radius:12px;background:#f8fafc;border:2px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:34px;overflow:hidden;cursor:default}' +
    '.gk-face.ph{border:none;cursor:zoom-in}.gk-face img{width:100%;height:100%;object-fit:cover}' +
    '.gk-who{min-width:0;flex:1}.gk-chip{display:inline-block;background:#f1f5f9;border-radius:8px;padding:2px 9px;font-weight:800;font-size:13px;color:#334155}' +
    '.gk-name{font-size:18px;font-weight:800;color:#0f172a;margin:5px 0 3px;overflow-wrap:anywhere}.gk-sub{font-size:12.5px;color:#64748b;overflow-wrap:anywhere}' +
    '.gk-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;align-items:center}.gk-amt{font-weight:800;font-size:15px;color:#0f172a}' +
    '.gk-orig{padding:0}.gk-orig>*{margin:0!important;border:none!important;box-shadow:none!important;border-radius:0!important;width:auto!important;max-width:none!important}' +
    '.gk-sum{display:flex;flex-wrap:wrap;gap:8px;padding:12px;border-bottom:1px solid #eef2f7}.gk-sum span{font-size:12.5px;font-weight:800;border-radius:999px;padding:4px 10px;background:#f1f5f9;color:#334155}' +
    '.gk-mon{font-size:13px;font-weight:800;color:#64748b;padding:12px 12px 4px}' +
    '.gk-h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #f1f5f9}.gk-h:last-child{border-bottom:none}.gk-h.cur{background:#eff6ff}' +
    '.gk-h .d{font-weight:800;font-variant-numeric:tabular-nums;flex:none}.gk-h .w{flex:1 1 auto;min-width:0;font-size:12.5px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gk-h .a{flex:none;font-weight:800;font-size:12.5px}' +
    '.gk-h.go{cursor:pointer}.gk-h.go:hover{background:#f8fafc}' +
    '.gk-pg{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;padding:6px 12px 12px}' +
    '.gk-pg a{display:block;border-radius:10px;overflow:hidden;background:#f1f5f9;aspect-ratio:1/1;position:relative}.gk-pg img{width:100%;height:100%;object-fit:cover}' +
    '.gk-pg a span{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(15,23,42,.75));color:#fff;font-size:10.5px;font-weight:700;padding:10px 6px 4px}' +
    '.gk-none{padding:18px 12px;color:#64748b;text-align:center;font-size:13px}' +
    '.gk-rel{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px}.gk-rel b{width:100%;font-size:11.5px;color:#64748b}.gk-rel button{border:1px dashed #94a3b8;background:#f8fafc;border-radius:999px;padding:6px 11px;font-size:12.5px;font-weight:700;color:#1e3a8a;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gk-rel button em{font-style:normal;color:#64748b;margin-left:4px}' +
    '.gk-strip{display:flex;gap:6px;overflow-x:auto;padding:8px 10px;background:#fff;border-top:1px solid #e2e8f0;scrollbar-width:none;flex:none}.gk-strip::-webkit-scrollbar{display:none}.gk-strip button{flex:none;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 13px;font-size:13px;font-weight:700;color:#334155;cursor:pointer;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gk-strip button.on{background:#4f46e5;border-color:#4f46e5;color:#fff}' +
    '.gk-back{flex:none;height:40px;border:1px solid #cbd5e1;border-radius:10px;background:#eef2ff;color:#3730a3;font-weight:800;padding:0 10px;cursor:pointer;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.gk-links{display:flex;flex-wrap:wrap;gap:8px;padding:0 12px 12px}.gk-links a,.gk-links button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 12px;font-weight:700;font-size:13px;color:#1e40af;text-decoration:none;cursor:pointer}';

  function addCss() { if (document.getElementById('gk-css')) return; var s = document.createElement('style'); s.id = 'gk-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- 清單 ---------- */
  function rowHtml(r, i, opt) {
    var p = r.photos && r.photos[0];
    var th = '<div class="gk-th">' + (p ? '<img loading="lazy" src="' + esc(thumb(p.u, 200)) + '" alt="">' + (r.photos.length > 1 ? '<i>' + r.photos.length + '</i>' : '') : esc(r.icon || '📄')) + '</div>';
    return '<div class="gk-row ui-nomo" data-gk="' + i + '" role="button" tabindex="0">' + (opt.select ? '<input type="checkbox" class="gk-sel ' + esc(opt.select) + '" value="' + esc(r.key) + '">' : '') + th +
      '<div class="gk-mid"><div class="gk-t">' + esc(r.title || '—') + '</div><div class="gk-s">' + esc([r.ref, day(r.date), r.sub].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div class="gk-r">' + (r.amount != null && r.amount !== '' ? '<b>' + money(r.amount) + '</b>' : '') + badge(r.status) + '</div></div>';
  }
  function list(host, recs, opt) {
    addCss(); opt = opt || {};
    var box = host.querySelector(':scope>.gk-list');
    if (!box) { box = document.createElement('div'); box.className = 'gk-list'; host.insertBefore(box, opt.before || host.firstChild); }
    if (!recs.length) { box.classList.add('gk-hide'); return box; }
    box.classList.remove('gk-hide');
    box.innerHTML = recs.map(function (r, i) { return rowHtml(r, i, opt); }).join('');
    box.onclick = function (e) {
      if (e.target.closest('input,button,a,select,label')) return;
      var row = e.target.closest('.gk-row'); if (!row) return;
      open(recs, +row.getAttribute('data-gk'), opt);
    };
    box.onkeydown = function (e) { if (e.key === 'Enter') { var row = e.target.closest('.gk-row'); if (row) open(recs, +row.getAttribute('data-gk'), opt); } };
    return box;
  }

  /* ---------- 詳細卡 ---------- */
  var cur = null;
  function close() { var m = document.querySelector('.gk-mask'); if (m) m.remove(); document.removeEventListener('keydown', onKey); cur = null; try { document.documentElement.style.overflow = ''; } catch (e) {} }
  function onKey(e) { if (!cur) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
  function go(d) { if (!cur) return; var n = cur.i + d; if (n < 0 || n >= cur.recs.length) return; cur.i = n; draw(); }
  function open(recs, i, opt, ctx) {
    addCss(); close();
    cur = { recs: recs, i: i, opt: opt || {}, tab: 'cur', stack: [], ctx: ctx || '' };
    var m = document.createElement('div'); m.className = 'gk-mask';
    m.innerHTML = '<div class="gk-sheet" role="dialog" aria-modal="true"><div class="gk-top"><span class="gk-idx"></span><span class="gk-ttl"></span>' +
      '<button class="gk-nb ui-nomo" data-a="p" aria-label="Previous">◀</button><button class="gk-nb ui-nomo" data-a="n" aria-label="Next">▶</button><button class="gk-nb ui-nomo" data-a="x" aria-label="Close">✕</button></div>' +
      '<div class="gk-tabs"></div><div class="gk-body"></div><div class="gk-strip"></div></div>';
    document.body.appendChild(m);
    try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
    m.addEventListener('click', function (e) {
      if (e.target === m) { close(); return; }
      var a = e.target.closest('[data-a]'); if (a) { var k = a.getAttribute('data-a'); if (k === 'p') go(-1); else if (k === 'n') go(1); else if (k === 'x') close(); return; }
      var t = e.target.closest('.gk-tab'); if (t) { cur.tab = t.getAttribute('data-t'); draw(); return; }
      var h = e.target.closest('.gk-h.go'); if (h) { var j = +h.getAttribute('data-j'); if (j >= 0) { cur.i = j; cur.tab = 'cur'; draw(); } else { var hk = h.getAttribute('data-k'), HH = cur.lastH || [], hi = HH.findIndex(function (x) { return x.key === hk; }); if (hi >= 0) drill(HH, hi, '🗓 ' + (cur.recs[cur.i].groupLabel || cur.recs[cur.i].title || '')); } return; }
      var rl = e.target.closest('.gk-rel button'); if (rl) { var R = cur.lastRel && cur.lastRel[+rl.getAttribute('data-r')]; if (R) { var LL = R.list(), li = LL.findIndex(function (x) { return x.key === cur.recs[cur.i].key; }); drill(LL, li < 0 ? 0 : li, R.icon + ' ' + R.label); } return; }
      var sp = e.target.closest('.gk-strip button'); if (sp) { cur.i = +sp.getAttribute('data-s'); draw(); return; }
      if (e.target.closest('.gk-back')) { var top = cur.stack.pop(); if (top) { cur.recs = top.recs; cur.i = top.i; cur.tab = top.tab; cur.ctx = top.ctx; draw(); } return; }
    });
    /* 原卡片裡的按鈕（編輯／送審／核可…）：先關掉詳細卡，再讓原本的動作照常執行 */
    m.addEventListener('click', function (e) {
      var b = e.target.closest('.gk-orig button,.gk-orig a[onclick],.gk-act');
      if (b && !b.closest('[data-a]')) setTimeout(close, 0);
    }, true);
    var x0 = null, y0 = 0;
    m.addEventListener('touchstart', function (e) { if (e.touches.length === 1 && !e.target.closest('.gk-tabs,.gk-pg')) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    m.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1); }, { passive: true });
    document.addEventListener('keydown', onKey);
    draw();
  }
  function drill(recs, i, ctx) { if (!cur || !recs || !recs.length) return; cur.stack.push({ recs: cur.recs, i: cur.i, tab: cur.tab, ctx: cur.ctx }); cur.recs = recs; cur.i = Math.max(0, i); cur.tab = 'cur'; cur.ctx = ctx || ''; draw(); }
  function rels(r) { var o = []; try { o = (cur.opt.rel ? cur.opt.rel(r) : []) || []; } catch (e) { o = []; } return o.filter(function (x) { return x && x.label && x.n > 1; }); }
  function hist(r) { var h = []; try { h = (cur.opt.history ? cur.opt.history(r) : []) || []; } catch (e) { h = []; } return h; }
  function draw() {
    var m = document.querySelector('.gk-mask'); if (!m || !cur) return;
    var r = cur.recs[cur.i], H = hist(r), photos = [];
    H.forEach(function (h) { (h.photos || []).forEach(function (p) { photos.push({ u: p.u, name: p.name, date: p.date || h.date, ref: h.ref }); }); });
    if (!H.length) (r.photos || []).forEach(function (p) { photos.push({ u: p.u, name: p.name, date: p.date || r.date, ref: r.ref }); });
    cur.lastH = H;
    m.querySelector('.gk-idx').textContent = (cur.i + 1) + '/' + cur.recs.length;
    var bk = m.querySelector('.gk-back');
    if (cur.stack.length) { if (!bk) { bk = document.createElement('button'); bk.className = 'gk-back ui-nomo'; m.querySelector('.gk-top').insertBefore(bk, m.querySelector('.gk-top').firstChild); } bk.textContent = '‹ ' + (cur.ctx || L('返回', 'Back', 'ត្រឡប់')); bk.title = L('回上一層', 'Back', 'ត្រឡប់'); }
    else if (bk) bk.remove();
    var strip = m.querySelector('.gk-strip');
    if (cur.recs.length > 1) { strip.style.display = ''; strip.innerHTML = cur.recs.slice(0, 300).map(function (x, j) { return '<button class="ui-nomo' + (j === cur.i ? ' on' : '') + '" data-s="' + j + '">' + esc(x.chip || x.ref || x.title || (j + 1)) + '</button>'; }).join(''); var on = strip.querySelector('.on'); if (on) try { strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2; } catch (e) {} }
    else strip.style.display = 'none';
    m.querySelector('.gk-ttl').textContent = (r.icon ? r.icon + ' ' : '') + (r.ref || '') + ' ' + (r.title || '');
    m.querySelector('[data-a=p]').disabled = cur.i <= 0; m.querySelector('[data-a=n]').disabled = cur.i >= cur.recs.length - 1;
    if (cur.tab === 'ph' && !photos.length) cur.tab = 'cur';
    var tabs = [['cur', '📋 ' + L('現況', 'Current', 'បច្ចុប្បន្ន'), ''], ['his', '🗓 ' + L('歷史', 'History', 'ប្រវត្តិ'), H.length]];
    if (photos.length) tabs.push(['ph', '📷 ' + L('照片', 'Photos', 'រូបថត'), photos.length]);
    m.querySelector('.gk-tabs').innerHTML = tabs.map(function (t) { return '<button class="gk-tab ui-nomo' + (cur.tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + (t[2] !== '' ? '<em>' + t[2] + '</em>' : '') + '</button>'; }).join('');
    var body = m.querySelector('.gk-body'), p0 = r.photos && r.photos[0];
    var idHtml = '<div class="gk-card"><div class="gk-id"><div class="gk-face' + (p0 ? ' ph' : '') + '"' + (p0 ? ' data-big="' + esc(p0.u) + '"' : '') + '>' + (p0 ? '<img src="' + esc(thumb(p0.u, 600)) + '" alt="">' : esc(r.icon || '📄')) + '</div>' +
      '<div class="gk-who"><span class="gk-chip">' + esc(r.ref || '—') + '</span><div class="gk-name">' + esc(r.title || '—') + '</div><div class="gk-sub">' + esc([day(r.date), r.sub].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="gk-meta">' + badge(r.status) + (r.amount != null && r.amount !== '' ? '<span class="gk-amt">' + money(r.amount) + '</span>' : '') + '</div></div></div>' +
      ((r.links && r.links.length) || (r.acts && r.acts.length) ? '<div class="gk-links">' + (r.links || []).map(function (k) { return '<a target="_blank" rel="noopener" href="' + esc(k.u) + '">' + esc(k.t) + '</a>'; }).join('') + (r.acts || []).map(function (k, j) { return '<button class="gk-act ui-nomo" data-act="' + j + '">' + esc(k.t) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    if (cur.tab === 'cur') {
      var RL = rels(r); cur.lastRel = RL;
      var relHtml = RL.length ? '<div class="gk-card"><div class="gk-rel" style="padding-top:12px"><b>🔗 ' + esc(L('相關紀錄（點了看這一組）', 'Related (tap to browse)', 'ពាក់ព័ន្ធ')) + '</b>' + RL.map(function (x, j) { return '<button class="ui-nomo" data-r="' + j + '">' + esc(x.icon + ' ' + x.label) + '<em>' + x.n + '</em></button>'; }).join('') + '</div></div>' : '';
      body.innerHTML = idHtml + relHtml + '<div class="gk-card gk-orig"></div>';
      var o = body.querySelector('.gk-orig'), el = null;
      try { el = r.orig ? r.orig() : null; } catch (e) { el = null; }
      if (el) { o.appendChild(el); Array.prototype.forEach.call(o.querySelectorAll('input[type=checkbox]'), function (c) { c.remove(); }); } else o.remove();
      Array.prototype.forEach.call(body.querySelectorAll('.gk-act'), function (b) { b.onclick = function () { var a = r.acts[+b.getAttribute('data-act')]; if (a && a.fn) a.fn(r); }; });
    } else if (cur.tab === 'his') {
      var ok = H.filter(function (h) { return h.status.cls === 'ok'; }).length, wait = H.filter(function (h) { return h.status.cls === 'wait'; }).length;
      var sorted = H.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var html = '<div class="gk-card"><div class="gk-sum"><span>🗓 ' + esc(r.groupLabel || r.title || '') + '</span><span style="background:#dcfce7;color:#166534">✅ ' + ok + '</span>' + (wait ? '<span style="background:#fef3c7;color:#92400e">⏳ ' + wait + '</span>' : '') +
        (sorted[0] ? '<span>📅 ' + L('最近', 'Latest', 'ចុងក្រោយ') + ' ' + esc(day(sorted[0].date)) + '</span>' : '') + '</div>';
      if (!sorted.length) html += '<div class="gk-none">' + esc(L('沒有其他紀錄', 'No other records', 'គ្មានកំណត់ត្រា')) + '</div>';
      var lastM = '';
      sorted.forEach(function (h) {
        var mm = month(h.date); if (mm !== lastM) { html += '<div class="gk-mon">' + esc(mm) + '</div>'; lastM = mm; }
        var j = cur.recs.indexOf(h); if (j < 0) j = cur.recs.findIndex(function (x) { return x.key === h.key; });
        html += '<div class="gk-h' + (h.key === r.key ? ' cur' : ' go') + '" data-j="' + j + '" data-k="' + esc(h.key) + '"><span class="d">' + esc(day(h.date)) + '</span>' + badge(h.status) +
          '<span class="w">' + esc([h.ref, h.title !== r.title ? h.title : '', h.who].filter(Boolean).join(' · ')) + '</span>' + (h.amount != null && h.amount !== '' ? '<span class="a">' + money(h.amount) + '</span>' : '') + '</div>';
        if (h.photos && h.photos.length) html += '<div class="gk-pg" style="padding-top:0">' + h.photos.slice(0, 4).map(function (p) { return '<a href="' + esc(p.u) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(thumb(p.u, 300)) + '" alt=""></a>'; }).join('') + '</div>';
      });
      body.innerHTML = idHtml.replace(/<div class="gk-links">[\s\S]*<\/div><\/div>$/, '</div>') + html + '</div>';
    } else {
      var byM = {}; photos.forEach(function (p) { var mm = month(p.date); (byM[mm] = byM[mm] || []).push(p); });
      body.innerHTML = '<div class="gk-card">' + Object.keys(byM).sort().reverse().map(function (mm) {
        return '<div class="gk-mon">' + esc(mm) + ' · ' + byM[mm].length + '</div><div class="gk-pg">' + byM[mm].map(function (p) { return '<a href="' + esc(p.u) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(thumb(p.u, 400)) + '" alt=""><span>' + esc(day(p.date)) + (p.ref ? ' · ' + esc(p.ref) : '') + '</span></a>'; }).join('') + '</div>';
      }).join('') + '</div>';
    }
    var f = body.querySelector('.gk-face.ph'); if (f) f.onclick = function () { try { root.open(f.getAttribute('data-big'), '_blank'); } catch (e) {} };
    body.scrollTop = 0;
  }

  /* ================= 各頁接法 ================= */
  function wrapGlobal(name, after) {
    var tries = 0;
    (function hook() {
      var fn = root[name];
      if (typeof fn !== 'function') { if (++tries < 60) setTimeout(hook, 250); return; }
      if (fn.__gk) return;
      var w = function () { var out = fn.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { console.warn('[ga-keynote]', e); } return out; };
      w.__gk = true; root[name] = w;
    })();
  }
  function isImg(u) { return /^https?:\/\//.test(u) && !/docs\.google\.com\/(spreadsheets|document|presentation)/.test(u) && /drive\.google|googleusercontent|\.(jpe?g|png|webp|gif)(\?|$)/i.test(u); }

  /* 相關紀錄：同一欄位值的所有紀錄（新的在前） */
  function relBy(all, r, defs) {
    var out = [];
    defs.forEach(function (d) {
      var vals = [].concat(d.get(r) || []).map(function (v) { return String(v || '').trim(); }).filter(function (v) { return v && v !== '—' && v !== 'N/A'; });
      vals.forEach(function (v) {
        var lv = v.toLowerCase();
        var L2 = function () { return all().filter(function (x) { return [].concat(d.get(x) || []).some(function (y) { return String(y || '').trim().toLowerCase() === lv; }); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }); };
        var n = L2().length; out.push({ icon: d.icon, label: v, n: n, list: L2 });
      });
    });
    return out;
  }

  /* ---- 維修中心：維修記錄（rep）、PO 記錄（po） ---- */
  if (page === 'maintenance.html') {
    var mtStat = function (s) {
      var v = root.mtStatus ? root.mtStatus(s) : s, t = root.mtStatusLabel ? root.mtStatusLabel(v) : v;
      return { t: (v === '已核可' ? '✅ ' : v === '待審核' ? '⏳ ' : v === '已退件' ? '❌ ' : '') + t, cls: v === '已核可' ? 'ok' : v === '待審核' ? 'wait' : v === '已退件' ? 'bad' : 'mute' };
    };
    var groupOf = function (rows) {
      var m = {}, o = [];
      rows.forEach(function (r) { var k = String(r[3] || '').trim() || [r[0], r[1], r[2]].join('|'); if (!m[k]) { m[k] = []; o.push(k); } m[k].push(r); });
      return o.map(function (k) { return { key: k, rows: m[k], first: m[k][0] }; });
    };
    var statusOf = function (rows) {
      var ss = rows.map(function (r) { return root.mtStatus ? root.mtStatus(r[13]) : r[13]; });
      if (ss.indexOf('待審核') >= 0) return '待審核'; if (ss.indexOf('已退件') >= 0) return '已退件'; if (ss.indexOf('已退回') >= 0) return '已退回';
      if (ss.indexOf('已核可') >= 0) return '已核可'; return ss[0] || '';
    };
    var toRec = function (sys, g, i, cards) {
      var r = g.first, rows = g.rows.filter(function (x) { var s = root.mtStatus ? root.mtStatus(x[13]) : x[13]; return s !== '已作廢'; }); if (!rows.length) rows = g.rows;
      var names = [], photos = [];
      rows.forEach(function (x) { var n = String(x[4] || '').trim(); if (n && names.indexOf(n) < 0) names.push(n); x.forEach(function (c) { var u = String(c || ''); if (isImg(u)) photos.push({ u: u, date: x[0] }); }); });
      var amt = rows.reduce(function (s, x) { return s + (Number(sys === 'rep' ? (x[19] || x[11]) : (x[18] || x[11])) || 0); }, 0);
      var link = String((sys === 'rep' ? r[20] : r[19]) || '');
      var dept = root.mtDeptLabel ? root.mtDeptLabel(r[2]) : r[2];
      return {
        key: sys + ':' + g.key, ref: r[3] || '', chip: r[3] || names[0] || '', dept: dept, loc: sys === 'rep' ? r[6] : '', nameList: names, icon: sys === 'rep' ? '🔧' : '🛒', title: names.join(' · ') || '—', names: names.map(function (n) { return n.toLowerCase(); }),
        sub: [dept, r[1], sys === 'rep' ? r[6] : ''].filter(Boolean).join(' · '), who: r[1], date: r[0], amount: amt, status: mtStat(g.status || statusOf(g.rows)), photos: photos,
        links: /^https?:/.test(link) ? [{ t: '📄 ' + L('報告', 'Report', 'របាយការណ៍'), u: link }] : [],
        orig: cards ? function () { var c = cards[i]; if (!c) return null; var k = c.cloneNode(true); k.classList.remove('gk-hide'); return k; } : null
      };
    };
    var cdata = function () { try { /* eslint-disable-next-line no-undef */ return typeof currentData !== 'undefined' ? currentData : root.currentData; } catch (e) { return root.currentData; } };
    var allRecs = function (sys) { var d = cdata(); return groupOf((d && d[sys]) || []).map(function (g) { return toRec(sys, g, -1, null); }); };
    wrapGlobal('renderRecords', function (sys, records) {
      var wrap = document.getElementById(sys + '-rec-wrap'); if (!wrap) return;
      var cardsBox = wrap.querySelector('.mt-request-cards'); if (!cardsBox) { var old = wrap.querySelector('.gk-list'); if (old) old.remove(); return; }
      var gs = Array.isArray(records) && records.length && records[0] && records[0].rows ? records : groupOf(records || []);
      var cards = Array.prototype.slice.call(cardsBox.querySelectorAll('.mt-request-card'));
      var recs = gs.map(function (g, i) { return toRec(sys, g, i, cards); });
      if (recs.length) cardsBox.classList.add('gk-hide');
      var cache = null;
      var allMerged = function () { if (!cache) cache = allRecs(sys); return cache.map(function (x) { return recs.find(function (y) { return y.key === x.key; }) || x; }); };
      list(wrap, recs, { before: cardsBox, rel: function (r) {
        return relBy(allMerged, r, [{ icon: sys === 'rep' ? '🔧' : '📦', get: function (x) { return x.nameList; } }, { icon: '👤', get: function (x) { return x.who; } }, { icon: '🏢', get: function (x) { return x.dept; } }, { icon: '📍', get: function (x) { return x.loc; } }]);
      }, history: function (r) {
        if (!cache) cache = allRecs(sys);
        var h = cache.filter(function (x) { return x.names.some(function (n) { return r.names.indexOf(n) >= 0; }); });
        return h.map(function (x) { return recs.find(function (y) { return y.key === x.key; }) || x; });
      } });
    });
  }

  /* ---- 損壞／遺失財物報告：記錄（卡片檢視） ---- */
  if (page === 'damage.html') {
    var dStat = function (s) {
      var t = root.statusLabel ? root.statusLabel(s) : s;
      return { t: t, cls: s === 'approved' ? 'ok' : (s === 'pending_review' || s === 'reviewed') ? 'wait' : s === 'rejected' ? 'bad' : 'mute' };
    };
    var dRec = function (r) {
      var ph = (r.attachments || []).map(function (a) { var u = a.url || a.previewUrl || a.data || ''; if (a.fileId && !/^data:/.test(u)) u = 'https://drive.google.com/file/d/' + a.fileId + '/view'; return u ? { u: u, name: a.fileName, date: r.incidentDate || r.date } : null; }).filter(Boolean);
      var items = ''; try { items = root.formatItems ? root.formatItems(r, GA.lang || 'zh') : ''; } catch (e) {}
      var typ = r.type === 'lost' ? L('遺失', 'Lost', 'បាត់') : L('損壞', 'Damage', 'ខូច');
      var links = [];
      if (r.reportLinks) { if (r.reportLinks.pdfUrl) links.push({ t: '📄 PDF', u: r.reportLinks.pdfUrl }); if (r.reportLinks.url) links.push({ t: '📊 Sheet', u: r.reportLinks.url }); }
      return { key: r.id, ref: typ, chip: day(r.incidentDate || r.date).slice(5) + ' ' + String((items && items !== '—' ? items : '') || r.loc || r.id).slice(0, 18), dept: r.dept, locRaw: r.loc, icon: r.type === 'lost' ? '❓' : '⚠️', title: (items && items !== '—' ? items : '') || r.loc || r.desc || r.id, sub: [r.loc, r.name, r.dept].filter(Boolean).join(' · '),
        who: r.name, date: r.incidentDate || r.date, amount: r.lossAmount, status: dStat(r.status), photos: ph, loc: String(r.loc || '').trim().toLowerCase(), groupLabel: r.loc || '',
        links: links, acts: root.openDetail ? [{ t: '🔎 ' + L('流程與完整明細', 'Workflow & full detail', 'លម្អិត'), fn: function () { root.openDetail(r.id); } }] : [],
        orig: function () { if (!root.recordCardHtml) return null; var d = document.createElement('div'); d.innerHTML = root.recordCardHtml(r); return d.firstElementChild; } };
    };
    var dAll = function () { return (root.DB || []).filter(function (x) { return x.status !== 'deleted'; }).map(dRec); };
    var dOpt = function (recs) {
      return { select: 'sel', rel: function (r) {
        return relBy(function () { var A = dAll(); return A.map(function (x) { return recs.find(function (y) { return y.key === x.key; }) || x; }); }, r, [{ icon: '📍', get: function (x) { return x.locRaw; } }, { icon: '👤', get: function (x) { return x.who; } }, { icon: '🏢', get: function (x) { return x.dept; } }]);
      }, history: function (r) {
        var all = (root.DB || []).filter(function (x) { return x.status !== 'deleted'; });
        var h = all.filter(function (x) { return r.loc && String(x.loc || '').trim().toLowerCase() === r.loc; }).map(function (x) { return recs.find(function (y) { return y.key === x.id; }) || dRec(x); });
        return h.length ? h : [r];
      } };
    };
    /* 儀表板與「表格」檢視的列：點了也開這張詳細卡（原本開的是沒有照片分頁的通用卡） */
    document.addEventListener('click', function (e) {
      var tr = e.target.closest && e.target.closest('tr'); if (!tr || !tr.parentElement || tr.parentElement.tagName !== 'TBODY') return;
      if (e.target.closest('button,a,input,select,label,textarea')) return;
      if (tr.closest('.gk-mask,.cmp-mask,#detail,.modal')) return;
      var DB0 = root.DB || [];
      var idOf = function (t) {
        var cb = t.querySelector('input.sel'); if (cb && cb.value && DB0.some(function (x) { return x.id === cb.value; })) return cb.value;
        var tds = t.querySelectorAll('td'); for (var q = 0; q < tds.length; q++) { var v = (tds[q].textContent || '').trim(); if (v && DB0.some(function (x) { return x.id === v; })) return v; }
        return '';
      };
      var id0 = idOf(tr); if (!id0) return;
      e.stopPropagation(); e.preventDefault();
      var ids = [];
      Array.prototype.forEach.call(tr.parentElement.children, function (t) { var v = idOf(t); if (v && ids.indexOf(v) < 0) ids.push(v); });
      var recs = ids.map(function (id) { return dRec(DB0.find(function (x) { return x.id === id; })); });
      open(recs, Math.max(0, ids.indexOf(id0)), dOpt(recs));
    }, true);
    wrapGlobal('renderRecords', function () {
      var box = document.getElementById('recordCards'); if (!box || !root.currentFiltered) return;
      var arr = root.currentFiltered() || [];
      var recs = arr.map(dRec);
      box.classList.toggle('gk-hide', recs.length > 0);
      var o = dOpt(recs); o.before = box.nextSibling;
      list(box.parentNode, recs, o);
    });
  }

  root.GAKeynote = { open: open, list: list, close: close };
})(window);
