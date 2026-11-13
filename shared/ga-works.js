/* ga-works.js — 工程進度作業（Works progress log）2026-11-13
   放在 maintenance.html 的「工程進度」分頁。記錄工廠正在進行的工程：誰做（工務／外部廠商／總務）、
   何時開始、用途、部門、費用、外包或自辦、人數、材料，並可逐日寫進度、附照片或 PDF（進度／完工／驗收）。
   · 本機 localStorage 先存，再與雲端 WORKS_DB 逐筆合併（同 id 取較新；刪除用墓碑）。
   · Excel 匯入（先預覽新增／更新幾筆）、匯出、空白範本。
   · 期間：日／週／月／年；工程只要在該期間內有施工（開始～完工區間重疊）或有進度記錄就列出。
   · 摘要：有資料才能發；沒有就不發。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA) return;
  var KEY = 'ga_works_v1', W = { records: [], filter: { status: '', exec: '', q: '' }, pc: null, mounted: false, syncing: false, dirty: false, lastSync: 0 };

  function LG() { try { return typeof lang !== 'undefined' ? lang : GA.lang; } catch (e) { return GA.lang || 'zh'; } }
  function L(zh, en, km) { var l = LG(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function L1(zh, en, km) { var l = LG(); return l === 'en' ? en : l === 'km' ? km : zh; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  function uid() { try { return 'w_' + crypto.randomUUID(); } catch (e) { return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2); } }
  function today() { return GA.ymd(new Date()); }
  function toast(m, t) { try { GA.toast(m, t); } catch (e) { if (root.showToast) root.showToast(m); } }

  var STATUS = {
    planned:   { c: '#64748b', i: '📝', zh: '規劃中', en: 'Planned', km: 'គ្រោង' },
    ongoing:   { c: '#2563eb', i: '🚧', zh: '進行中', en: 'Ongoing', km: 'កំពុងធ្វើ' },
    paused:    { c: '#f59e0b', i: '⏸', zh: '暫停', en: 'Paused', km: 'ផ្អាក' },
    done:      { c: '#10b981', i: '✅', zh: '已完工', en: 'Completed', km: 'បានបញ្ចប់' },
    accepted:  { c: '#0d9488', i: '🏁', zh: '已驗收', en: 'Accepted', km: 'បានទទួល' },
    cancelled: { c: '#94a3b8', i: '🚫', zh: '取消', en: 'Cancelled', km: 'បោះបង់' }
  };
  var EXEC = {
    me:     { i: '⚙️', zh: '工務', en: 'ME', km: 'ផ្នែកជួសជុល' },
    vendor: { i: '🏢', zh: '外部廠商', en: 'Vendor', km: 'អ្នកម៉ៅការ' },
    ga:     { i: '🧹', zh: '總務', en: 'GA', km: 'រដ្ឋបាល' },
    mixed:  { i: '🤝', zh: '共同', en: 'Mixed', km: 'រួមគ្នា' }
  };
  var MODE = { inhouse: { zh: '自辦', en: 'In-house', km: 'ធ្វើខ្លួនឯង' }, outsource: { zh: '外包', en: 'Outsourced', km: 'ម៉ៅការ' }, mixed: { zh: '部分外包', en: 'Partly outsourced', km: 'ម៉ៅការខ្លះ' } };
  var CAT = {
    build: { zh: '新建／增建', en: 'New build', km: 'សាងសង់ថ្មី' }, improve: { zh: '改善／整修', en: 'Improvement', km: 'កែលម្អ' },
    repair: { zh: '維修保養', en: 'Repair / maintenance', km: 'ជួសជុល' }, install: { zh: '設備安裝', en: 'Installation', km: 'ដំឡើង' },
    electric: { zh: '水電／消防', en: 'Electrical / water / fire', km: 'អគ្គិសនី ទឹក' }, civil: { zh: '土木／道路', en: 'Civil works', km: 'សំណង់ស៊ីវិល' },
    remove: { zh: '拆除／清運', en: 'Removal', km: 'រុះរើ' }, other: { zh: '其他', en: 'Other', km: 'ផ្សេងៗ' }
  };
  var STAGE = { progress: { i: '📷', zh: '進度', en: 'Progress', km: 'វឌ្ឍនភាព' }, done: { i: '✅', zh: '完工', en: 'Completion', km: 'បញ្ចប់' }, accept: { i: '🏁', zh: '驗收', en: 'Acceptance', km: 'ទទួល' }, doc: { i: '📄', zh: '文件', en: 'Document', km: 'ឯកសារ' } };
  function lab(map, k) { var e = map[k]; return e ? L(e.zh, e.en, e.km) : (k || '—'); }
  function lab1(map, k) { var e = map[k]; return e ? L1(e.zh, e.en, e.km) : (k || '—'); }

  /* ── 儲存 ── */
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || '{}'); W.records = Array.isArray(d.records) ? d.records : []; W.dirty = !!d.dirty; } catch (e) { W.records = []; } }
  function save(markDirty) {
    if (markDirty) W.dirty = true;
    try { localStorage.setItem(KEY, JSON.stringify({ records: W.records, dirty: W.dirty })); }
    catch (e) { toast('⚠️ ' + L('本機儲存空間已滿', 'Device storage is full', 'ទំហំផ្ទុកពេញ'), 'err'); }
  }
  function live() { return W.records.filter(function (r) { return r && !r._deleted; }); }
  function ts(r) { var n = Date.parse(r && r.updatedAt || ''); return isNaN(n) ? 0 : n; }
  function mergeIn(list) {
    var map = {}, order = [];
    W.records.concat(Array.isArray(list) ? list : []).forEach(function (r) {
      if (!r || !r.id) return; var k = String(r.id);
      if (!map[k]) { map[k] = r; order.push(k); } else if (ts(r) > ts(map[k])) map[k] = r;
    });
    W.records = order.map(function (k) { return map[k]; });
  }
  function touch(r) { r.updatedAt = new Date().toISOString(); return r; }

  /* ── 雲端 ── */
  var pushTimer = null;
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(function () { sync(true); }, 900); }
  async function sync(silent) {
    if (W.syncing) return; W.syncing = true; setSyncBadge('…');
    try {
      if (GA.backend && GA.backend.require) await GA.backend.require('worksLog', { action: 'worksLoad' });
      if (W.dirty) {
        var r = await GA.gasPost('worksSave', { records: W.records });
        var d = r.data || {}; if (Array.isArray(d.records)) { mergeIn(d.records); }
        W.dirty = false;
      } else {
        var g = await GA.gasGet('worksLoad'); var gd = g && g.data;
        if (gd && Array.isArray(gd.records)) mergeIn(gd.records);
      }
      save(false); W.lastSync = Date.now(); setSyncBadge('ok'); render();
      if (!silent) toast('☁️ ' + L('工程進度已同步', 'Works log synced', 'បានសមកាលកម្ម'));
    } catch (e) {
      setSyncBadge('err');
      if (!silent) toast('❌ ' + L('同步失敗：', 'Sync failed: ', 'សមកាលកម្មបរាជ័យ៖ ') + (e.message || ''), 'err');
    } finally { W.syncing = false; }
  }
  function setSyncBadge(s) { var b = document.getElementById('gw-sync'); if (!b) return; b.textContent = s === 'ok' ? '☁️✓' : s === 'err' ? '☁️⚠' : '☁️…'; b.title = s === 'err' ? L('尚未上雲，稍後會重試', 'Not uploaded yet; will retry', 'មិនទាន់ផ្ទុកឡើង') : ''; b.style.color = s === 'err' ? '#dc2626' : ''; }

  /* ── 期間 ── */
  function pRange(key, type) {
    if (!key || key === 'ALL') return { s: '0000-00-00', e: '9999-99-99' };
    if (type === 'day') return { s: key, e: key };
    if (type === 'week') { var w = GA.weekRange(key); return w ? { s: w.start, e: w.end } : { s: key, e: key }; }
    if (type === 'month') { var m = key.split('-'), last = new Date(+m[0], +m[1], 0).getDate(); return { s: key + '-01', e: key + '-' + (last < 10 ? '0' + last : last) }; }
    return { s: key + '-01-01', e: key + '-12-31' };
  }
  function span(r) {
    var s = r.startDate || (r.createdAt || '').slice(0, 10) || today();
    var open = r.status === 'ongoing' || r.status === 'paused' || r.status === 'planned';
    var e = r.actualEnd || (open ? (today() > s ? today() : s) : (r.planEnd || s));
    if (e < s) e = s; return { s: s, e: e };
  }
  function inPeriod(r, st) {
    if (!st) return true; var p = pRange(st.key, st.type), sp = span(r);
    if (sp.s <= p.e && sp.e >= p.s) return true;
    return (r.logs || []).some(function (g) { return g.date >= p.s && g.date <= p.e; });
  }
  function overdue(r) { return !!(r.planEnd && r.planEnd < today() && (r.status === 'ongoing' || r.status === 'paused' || r.status === 'planned')); }
  function pState() { return W.pc ? W.pc.state() : { type: 'month', key: GA.currentPeriod('month') }; }
  function filtered(st) {
    st = st || pState(); var f = W.filter, q = (f.q || '').toLowerCase();
    return live().filter(function (r) {
      if (!inPeriod(r, st)) return false;
      if (f.status === 'overdue' ? !overdue(r) : (f.status && r.status !== f.status)) return false;
      if (f.exec && r.exec !== f.exec) return false;
      if (q && [r.title, r.location, r.dept, r.vendor, r.owner, r.purpose, r.refNo, r.materials].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { var o = { ongoing: 0, paused: 1, planned: 2, done: 3, accepted: 4, cancelled: 5 }; return (o[a.status] - o[b.status]) || String(b.startDate || '').localeCompare(String(a.startDate || '')); });
  }
  function cost(r) { return GA.num(r.actualCost) || 0; }
  function budget(r) { return GA.num(r.budget) || 0; }
  function prog(r) { var p = Math.round(GA.num(r.progress) || 0); if (r.status === 'done' || r.status === 'accepted') p = 100; return Math.max(0, Math.min(100, p)); }
  function md(d) { return d ? String(d).slice(5) : '—'; }
  function lastLog(r) { var a = (r.logs || []).slice().sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); }); return a[0] || null; }
  function allFiles(r) { var out = (r.files || []).slice(); (r.logs || []).forEach(function (g) { (g.files || []).forEach(function (f) { out.push(f); }); }); return out; }

  /* ── 畫面 ── */
  var CSS = '.gw-wrap{max-width:1180px;margin:0 auto}.gw-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:8px 0}.gw-kpi{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:10px 12px;border-top:4px solid var(--kc,#2563eb);cursor:pointer}.gw-kpi b{display:block;font-size:22px;line-height:1.1}.gw-kpi small{font-size:11px;color:#64748b;font-weight:700}.gw-kpi.on{outline:2px solid var(--kc,#2563eb)}' +
    '.gw-tools{background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:10px;margin:8px 0}.gw-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:8px}.gw-row select,.gw-row input{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;background:#fff;min-width:0}.gw-row input{flex:1;min-width:140px}' +
    '.gw-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}.gw-btn.pri{background:#2563eb;border-color:#2563eb;color:#fff}.gw-btn.red{color:#dc2626;border-color:#fecaca}.gw-btn:disabled{opacity:.5}' +
    '.gw-more{position:relative}.gw-menu{display:none;position:absolute;right:0;top:calc(100% + 4px);background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 8px 24px #0f172a22;z-index:50;min-width:200px;padding:4px}.gw-menu.on{display:block}.gw-menu button{display:block;width:100%;text-align:left;border:0;background:none;padding:10px 12px;font:inherit;font-size:13px;border-radius:7px;cursor:pointer}.gw-menu button:hover{background:#f1f5f9}' +
    '.gw-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px}.gw-card{background:#fff;border:1px solid #dbe3ef;border-left:6px solid var(--sc,#94a3b8);border-radius:12px;padding:11px 12px;cursor:pointer;transition:box-shadow .15s}.gw-card:hover{box-shadow:0 4px 14px #0f172a1a}.gw-card h4{margin:0;font-size:15px;line-height:1.3}.gw-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}' +
    '.gw-pill{display:inline-block;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:800;color:#fff;background:var(--sc,#64748b);white-space:nowrap}.gw-pill.od{background:#dc2626}.gw-meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:12px;color:#334155;margin-top:7px}.gw-meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.gw-bar{height:8px;background:#e2e8f0;border-radius:5px;overflow:hidden;margin-top:8px}.gw-bar i{display:block;height:100%;background:var(--sc,#2563eb);border-radius:5px}.gw-pct{font-size:11px;font-weight:800;color:#475569;display:flex;justify-content:space-between;margin-top:3px}.gw-last{font-size:11.5px;color:#475569;background:#f8fafc;border-radius:7px;padding:5px 8px;margin-top:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.gw-empty{text-align:center;color:#64748b;padding:34px 12px;background:#fff;border:1px dashed #cbd5e1;border-radius:12px}.gw-empty .i{font-size:34px}' +
    '.gw-ov{position:fixed;inset:0;background:#0f172a99;z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}.gw-sheet{background:#f8fafc;border-radius:16px;width:100%;max-width:760px;overflow:hidden;box-shadow:0 20px 60px #0006}.gw-sh{background:var(--sc,#2563eb);color:#fff;padding:12px 14px;display:flex;gap:8px;align-items:center}.gw-sh h3{margin:0;font-size:16px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.gw-sh button{background:#ffffff33;border:0;color:#fff;border-radius:8px;width:36px;height:36px;font-size:17px;cursor:pointer;flex:none}' +
    '.gw-tabs{display:flex;background:#fff;border-bottom:1px solid #e2e8f0}.gw-tabs button{flex:1;border:0;background:none;padding:10px 4px;font:inherit;font-weight:800;font-size:13px;color:#64748b;border-bottom:3px solid transparent;cursor:pointer}.gw-tabs button.on{color:#1d4ed8;border-bottom-color:#1d4ed8}.gw-body{padding:12px;max-height:70vh;overflow:auto}' +
    '.gw-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gw-f{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.gw-f small{display:block;font-size:10.5px;color:#64748b;font-weight:700}.gw-f b{font-size:13.5px;word-break:break-word}.gw-f.w{grid-column:1/-1}' +
    '.gw-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gw-form label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;font-weight:700;color:#475569;min-width:0}.gw-form label.w{grid-column:1/-1}.gw-form input,.gw-form select,.gw-form textarea{border:1px solid #cbd5e1;border-radius:8px;padding:9px 10px;font:inherit;font-size:14px;background:#fff;min-width:0;width:100%;box-sizing:border-box}.gw-form textarea{min-height:60px}.gw-sec{grid-column:1/-1;font-size:12px;font-weight:800;color:#1d4ed8;margin-top:6px;border-bottom:1px solid #dbeafe;padding-bottom:3px}.gw-req{color:#dc2626}' +
    '.gw-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0;flex-wrap:wrap}' +
    '.gw-log{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:10px;padding:8px 10px;margin-bottom:8px}.gw-log .d{font-size:11.5px;font-weight:800;color:#1d4ed8;display:flex;justify-content:space-between;gap:8px}.gw-log p{margin:4px 0 0;font-size:13.5px;white-space:pre-wrap;word-break:break-word}' +
    '.gw-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:6px}.gw-file{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;text-decoration:none;color:#334155;display:block}.gw-file img{width:100%;height:86px;object-fit:cover;display:block;background:#e2e8f0}.gw-file .pdf{height:86px;display:flex;align-items:center;justify-content:center;font-size:30px;background:#fef2f2}.gw-file span{display:block;font-size:10.5px;padding:3px 6px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gw-file button{position:absolute;right:3px;top:3px;border:0;background:#0f172acc;color:#fff;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer}' +
    '.gw-tbl{width:100%;border-collapse:collapse;font-size:12px;background:#fff}.gw-tbl th,.gw-tbl td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left}.gw-tbl th{background:#f1f5f9}' +
    '@media(max-width:720px){.gw-kpis{grid-template-columns:repeat(3,1fr)}.gw-kpi b{font-size:19px}.gw-list{grid-template-columns:1fr}.gw-ov{padding:0;overflow:hidden}.gw-sheet{border-radius:0;height:100vh;height:100dvh;display:flex;flex-direction:column}.gw-body{max-height:none;flex:1;overflow:auto;-webkit-overflow-scrolling:touch}.gw-form{grid-template-columns:1fr}.gw-form label{grid-column:1/-1}}';

  function mount() {
    var host = document.getElementById('works-root'); if (!host) return false;
    if (W.mounted) return true;
    var st = document.createElement('style'); st.id = 'gw-css'; st.textContent = CSS; document.head.appendChild(st);
    host.innerHTML = '<div class="gw-wrap"><div class="gw-tools"><div id="gw-period" class="mt-compact-period"></div><div class="gw-row" id="gw-bar"></div></div><div class="gw-kpis" id="gw-kpis"></div><div id="gw-list"></div></div>';
    load();
    W.pc = GA.periodControl('#gw-period', { id: 'gw_works', type: 'month',
      dates: function () { var ds = [today()]; live().forEach(function (r) { if (r.startDate) ds.push(r.startDate); if (r.actualEnd) ds.push(r.actualEnd); (r.logs || []).forEach(function (g) { if (g.date) ds.push(g.date); }); }); return ds; },
      onChange: function () { renderList(); } });
    W.mounted = true; renderBar(); return true;
  }
  function renderBar() {
    var bar = document.getElementById('gw-bar'); if (!bar) return; var f = W.filter;
    bar.innerHTML = '<button class="gw-btn pri" id="gw-add">➕ ' + L('新增工程', 'New work', 'បន្ថែម') + '</button>' +
      '<select id="gw-fs"><option value="">' + L('全部狀態', 'All statuses', 'ស្ថានភាពទាំងអស់') + '</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '">' + STATUS[k].i + ' ' + esc(lab(STATUS, k)) + '</option>'; }).join('') + '<option value="overdue">⏰ ' + L('逾期', 'Overdue', 'ហួសកាលកំណត់') + '</option></select>' +
      '<select id="gw-fe"><option value="">' + L('全部執行單位', 'All executors', 'អ្នកអនុវត្តទាំងអស់') + '</option>' + Object.keys(EXEC).map(function (k) { return '<option value="' + k + '">' + EXEC[k].i + ' ' + esc(lab(EXEC, k)) + '</option>'; }).join('') + '</select>' +
      '<input id="gw-q" type="search" placeholder="🔍 ' + esc(L('工程／地點／廠商／負責人', 'Work / location / vendor / owner', 'ការងារ / ទីតាំង')) + '">' +
      '<button class="gw-btn" id="gw-tg">✈️ ' + L('摘要', 'Summary', 'សង្ខេប') + '</button>' +
      '<div class="gw-more"><button class="gw-btn" id="gw-morebtn">⋯ ' + L('更多', 'More', 'ច្រើនទៀត') + ' <span id="gw-sync">☁️</span></button><div class="gw-menu" id="gw-menu">' +
      '<button data-a="imp">📥 ' + L('匯入 Excel', 'Import Excel', 'នាំចូល Excel') + '</button><button data-a="exp">📤 ' + L('匯出 Excel', 'Export Excel', 'នាំចេញ Excel') + '</button><button data-a="tpl">📄 ' + L('下載空白範本', 'Download blank template', 'ទាញយកគំរូ') + '</button><button data-a="sync">☁️ ' + L('立即同步（上傳／下載）', 'Sync now (upload / download)', 'សមកាលកម្មឥឡូវ') + '</button><button data-a="json">💾 ' + L('備份 JSON', 'Backup JSON', 'បម្រុងទុក JSON') + '</button></div></div>' +
      '<input type="file" id="gw-file" style="display:none">';
    var q = function (id) { return document.getElementById(id); };
    q('gw-fs').value = f.status; q('gw-fe').value = f.exec; q('gw-q').value = f.q;
    q('gw-add').onclick = function () { openEdit(null); };
    q('gw-fs').onchange = function () { f.status = this.value; renderList(); };
    q('gw-fe').onchange = function () { f.exec = this.value; renderList(); };
    q('gw-q').oninput = function () { f.q = this.value; renderList(); };
    q('gw-tg').onclick = openSummary;
    q('gw-morebtn').onclick = function (e) { e.stopPropagation(); q('gw-menu').classList.toggle('on'); };
    document.addEventListener('click', function () { var m = q('gw-menu'); if (m) m.classList.remove('on'); });
    q('gw-menu').onclick = function (e) { var a = e.target && e.target.getAttribute('data-a'); if (!a) return; if (a === 'imp') { q('gw-file').value = ''; q('gw-file').click(); } else if (a === 'exp') exportXlsx(); else if (a === 'tpl') templateXlsx(); else if (a === 'sync') { W.dirty = true; sync(false); } else if (a === 'json') backupJson(); };
    q('gw-file').onchange = function () { if (this.files && this.files[0]) importXlsx(this.files[0]); };
    setSyncBadge(W.dirty ? 'err' : 'ok');
  }
  function renderList() {
    var box = document.getElementById('gw-list'), kp = document.getElementById('gw-kpis'); if (!box) return;
    var st = pState(), f = W.filter, keep = { status: f.status }; f.status = ''; var base = filtered(st); f.status = keep.status;
    var rows = filtered(st), n = function (s) { return base.filter(function (r) { return r.status === s; }).length; };
    var od = base.filter(overdue).length, totalCost = base.reduce(function (a, r) { return a + cost(r); }, 0), totalBud = base.reduce(function (a, r) { return a + budget(r); }, 0);
    var K = [['', '#334155', base.length, L('本期工程', 'Works in period', 'ការងារ')], ['ongoing', '#2563eb', n('ongoing'), L('進行中', 'Ongoing', 'កំពុងធ្វើ')], ['done', '#10b981', n('done') + n('accepted'), L('完工／驗收', 'Completed', 'បានបញ្ចប់')], ['overdue', '#dc2626', od, L('逾期', 'Overdue', 'ហួសកំណត់')], ['$', '#d97706', GA.money(totalCost, 0), L('已花費', 'Spent', 'បានចំណាយ') + (totalBud ? ' / ' + GA.money(totalBud, 0) : '')]];
    kp.innerHTML = K.map(function (k) { var on = k[0] !== '$' && (f.status === k[0] || (k[0] === 'done' && f.status === 'accepted')); return '<div class="gw-kpi' + (on && k[0] ? ' on' : '') + '" style="--kc:' + k[1] + '" data-k="' + k[0] + '"><b style="color:' + k[1] + '">' + k[2] + '</b><small>' + esc(k[3]) + '</small></div>'; }).join('');
    kp.onclick = function (e) { var t = e.target.closest('.gw-kpi'); if (!t) return; var k = t.getAttribute('data-k'); if (k === '$') return; f.status = f.status === k ? '' : k; var s = document.getElementById('gw-fs'); if (s) s.value = f.status; renderList(); };
    if (!rows.length) {
      box.innerHTML = '<div class="gw-empty"><div class="i">🏗</div><div style="font-weight:800;margin-top:6px">' + (live().length ? L('這個期間沒有工程記錄', 'No works in this period', 'គ្មានការងារក្នុងរយៈពេលនេះ') : L('還沒有工程記錄', 'No works recorded yet', 'មិនទាន់មានកំណត់ត្រា')) + '</div><div style="font-size:12px;margin-top:4px">' + L('按「新增工程」開始記錄，或用「更多 → 匯入 Excel」。沒有工程就不用填，也不會發摘要。', 'Tap "New work" to start, or use More → Import Excel. Nothing to record means nothing is sent.', 'ចុច "បន្ថែម" ដើម្បីចាប់ផ្តើម') + '</div></div>';
      return;
    }
    W.view = rows.map(function (r) { return r.id; });
    box.innerHTML = '<div class="gw-list">' + rows.map(card).join('') + '</div>';
    box.onclick = function (e) { var c = e.target.closest('.gw-card'); if (c) openDetail(c.getAttribute('data-id')); };
  }
  function card(r) {
    var s = STATUS[r.status] || STATUS.planned, p = prog(r), ll = lastLog(r), nf = allFiles(r).length, od = overdue(r);
    return '<div class="gw-card" data-id="' + esc(r.id) + '" style="--sc:' + s.c + '"><div class="gw-top"><h4>' + esc(r.title || '—') + '</h4><span class="gw-pill' + (od ? ' od' : '') + '">' + (od ? '⏰ ' + esc(L('逾期', 'Overdue', 'ហួសកំណត់')) : s.i + ' ' + esc(lab(STATUS, r.status))) + '</span></div>' +
      '<div class="gw-meta"><span>' + (EXEC[r.exec] ? EXEC[r.exec].i : '👷') + ' ' + esc(lab(EXEC, r.exec)) + (r.vendor ? ' · ' + esc(r.vendor) : '') + '</span><span>📍 ' + esc(r.location || '—') + '</span><span>📅 ' + esc(md(r.startDate)) + ' → ' + esc(md(r.actualEnd || r.planEnd)) + (r.actualEnd ? '' : r.planEnd ? ' (' + esc(L1('預計', 'plan', 'គ្រោង')) + ')' : '') + '</span><span>🏭 ' + esc(r.dept || '—') + '</span><span>👷 ' + esc(r.headcount || '—') + ' · ' + esc(lab(MODE, r.mode)) + '</span><span>💵 ' + (cost(r) ? GA.money(cost(r), 2) : '—') + (budget(r) ? ' / ' + GA.money(budget(r), 0) : '') + '</span></div>' +
      '<div class="gw-bar"><i style="width:' + p + '%"></i></div><div class="gw-pct"><span>' + p + '%</span><span>' + (nf ? '📎 ' + nf : '') + ((r.logs || []).length ? ' · 📝 ' + r.logs.length : '') + '</span></div>' +
      (ll ? '<div class="gw-last">🕐 ' + esc(md(ll.date)) + ' ' + esc(ll.text || '') + '</div>' : '') + '</div>';
  }
  function render() { if (!W.mounted) return; if (W.pc && W.pc.refresh) try { W.pc.refresh(); } catch (e) {} renderList(); }

  /* ── 詳細卡（可上一筆／下一筆） ── */
  function byId(id) { return W.records.filter(function (r) { return String(r.id) === String(id); })[0]; }
  function closeOv(id) { var o = document.getElementById(id); if (o) o.remove(); }
  function openDetail(id, tab) {
    var r = byId(id); if (!r) return; closeOv('gw-detail');
    var s = STATUS[r.status] || STATUS.planned, view = W.view || [], idx = view.indexOf(r.id);
    var ov = document.createElement('div'); ov.className = 'gw-ov'; ov.id = 'gw-detail'; ov.style.setProperty('--sc', s.c);
    ov.innerHTML = '<div class="gw-sheet"><div class="gw-sh"><button data-a="prev"' + (idx > 0 ? '' : ' disabled style="opacity:.35"') + '>‹</button><h3>' + s.i + ' ' + esc(r.title || '—') + '<div style="font-size:11px;font-weight:600;opacity:.9">' + esc(lab(STATUS, r.status)) + ' · ' + prog(r) + '%' + (idx >= 0 ? ' · ' + (idx + 1) + ' / ' + view.length : '') + '</div></h3><button data-a="next"' + (idx >= 0 && idx < view.length - 1 ? '' : ' disabled style="opacity:.35"') + '>›</button><button data-a="close">×</button></div>' +
      '<div class="gw-tabs"><button data-t="info">📋 ' + L('資料', 'Details', 'ព័ត៌មាន') + '</button><button data-t="log">📝 ' + L('進度日誌', 'Progress log', 'កំណត់ហេតុ') + ' (' + (r.logs || []).length + ')</button><button data-t="file">📎 ' + L('照片文件', 'Photos / files', 'រូបថត') + ' (' + allFiles(r).length + ')</button></div><div class="gw-body" id="gw-dbody"></div>' +
      '<div class="gw-foot"><button class="gw-btn red" data-a="del">🗑 ' + L('刪除', 'Delete', 'លុប') + '</button><button class="gw-btn" data-a="edit">✏️ ' + L('編輯', 'Edit', 'កែ') + '</button><button class="gw-btn pri" data-a="addlog">➕ ' + L('寫進度', 'Add progress', 'បន្ថែមវឌ្ឍនភាព') + '</button></div></div>';
    document.body.appendChild(ov);
    function show(t) { ov.querySelectorAll('.gw-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); }); var b = document.getElementById('gw-dbody'); b.innerHTML = t === 'log' ? logHtml(r) : t === 'file' ? fileHtml(r) : infoHtml(r); ov._tab = t; }
    show(tab || 'info');
    ov.onclick = function (e) {
      if (e.target === ov) { ov.remove(); return; }
      var t = e.target.closest('[data-t]'); if (t && t.parentNode.classList.contains('gw-tabs')) { show(t.getAttribute('data-t')); return; }
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') ov.remove();
      else if (act === 'prev' && idx > 0) openDetail(view[idx - 1], ov._tab);
      else if (act === 'next' && idx < view.length - 1) openDetail(view[idx + 1], ov._tab);
      else if (act === 'edit') openEdit(r.id);
      else if (act === 'addlog') openLog(r.id);
      else if (act === 'del') { if (confirm(L('刪除這筆工程記錄？（進度與附件連結也會一起移除）', 'Delete this work record? (its progress entries and attachment links go with it)', 'លុបកំណត់ត្រានេះ?'))) { r._deleted = true; touch(r); save(true); ov.remove(); render(); schedulePush(); } }
      else if (act === 'dellog') { var lid = a.getAttribute('data-id'); if (confirm(L('刪除這則進度？', 'Delete this entry?', 'លុបធាតុនេះ?'))) { r.logs = (r.logs || []).filter(function (g) { return g.id !== lid; }); touch(r); save(true); schedulePush(); openDetail(r.id, 'log'); render(); } }
      else if (act === 'delfile') { e.preventDefault(); var fid = a.getAttribute('data-id'); if (confirm(L('移除這個附件？', 'Remove this attachment?', 'ដកឯកសារនេះ?'))) { r.files = (r.files || []).filter(function (f) { return f.fileId !== fid; }); (r.logs || []).forEach(function (g) { g.files = (g.files || []).filter(function (f) { return f.fileId !== fid; }); }); touch(r); save(true); schedulePush(); openDetail(r.id, 'file'); render(); } }
      else if (act === 'upload') { pickFiles(r, a.getAttribute('data-stage') || 'progress', null, function () { openDetail(r.id, 'file'); render(); }); }
    };
  }
  function F(label, val, wide, keep) { if ((val === '' || val == null) && !keep) return ''; return '<div class="gw-f' + (wide ? ' w' : '') + '"><small>' + esc(label) + '</small><b>' + (val === '' || val == null ? '—' : esc(val)) + '</b></div>'; }
  function infoHtml(r) {
    var p = prog(r);
    return '<div class="gw-bar" style="height:12px;margin:0 0 10px"><i style="width:' + p + '%"></i></div><div class="gw-grid">' +
      F(L('類別', 'Category', 'ប្រភេទ'), lab(CAT, r.category), false, true) + F(L('地點', 'Location', 'ទីតាំង'), r.location, false, true) +
      F(L('需求部門', 'Requesting dept', 'ផ្នែក'), r.dept, false, true) + F(L('負責人／監工', 'Owner / supervisor', 'អ្នកទទួលខុសត្រូវ'), r.owner) +
      F(L('用途／目的', 'Purpose', 'គោលបំណង'), r.purpose, true, true) +
      F(L('執行單位', 'Done by', 'អ្នកអនុវត្ត'), lab(EXEC, r.exec)) + F(L('自辦／外包', 'In-house / outsourced', 'ធ្វើខ្លួនឯង / ម៉ៅការ'), lab(MODE, r.mode)) +
      F(L('廠商', 'Vendor', 'អ្នកម៉ៅការ'), r.vendor) + F(L('廠商聯絡', 'Vendor contact', 'ទំនាក់ទំនង'), r.contact) +
      F(L('人數', 'Headcount', 'ចំនួនមនុស្ស'), r.headcount) + F(L('相關單號（PO／維修號）', 'Related no. (PO / repair)', 'លេខយោង'), r.refNo) +
      F(L('開始日', 'Start', 'ចាប់ផ្តើម'), r.startDate, false, true) + F(L('預計完工', 'Planned finish', 'គ្រោងបញ្ចប់'), r.planEnd ? r.planEnd + (overdue(r) ? ' ⏰' : '') : '') +
      F(L('實際完工', 'Actual finish', 'បញ្ចប់ជាក់ស្តែង'), r.actualEnd) + F(L('驗收（日期／驗收人）', 'Acceptance (date / by)', 'ការទទួល'), [r.acceptDate, r.acceptBy].filter(Boolean).join(' · ')) +
      F(L('預算', 'Budget', 'ថវិកា'), budget(r) ? GA.money(budget(r), 2) : '') + F(L('實際費用', 'Actual cost', 'ចំណាយជាក់ស្តែង'), cost(r) ? GA.money(cost(r), 2) + (budget(r) ? '  (' + Math.round(cost(r) / budget(r) * 100) + '%)' : '') : '') +
      F(L('材料', 'Materials', 'សម្ភារៈ'), r.materials, true) + F(L('安全／注意事項', 'Safety / notes', 'សុវត្ថិភាព'), r.safety, true) + F(L('備註', 'Remarks', 'កំណត់ចំណាំ'), r.remarks, true) + '</div>';
  }
  function filesGrid(list, canDel) {
    return '<div class="gw-files">' + list.map(function (f) { var pdf = /pdf/i.test(f.mimeType || '') || /\.pdf$/i.test(f.name || ''); return '<a class="gw-file" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + (pdf ? '<div class="pdf">📄</div>' : '<img loading="lazy" src="' + esc(f.previewUrl || f.url) + '" alt="">') + '<span>' + (STAGE[f.stage] ? STAGE[f.stage].i + ' ' + esc(lab1(STAGE, f.stage)) : '') + ' ' + esc(md(f.date)) + '</span>' + (canDel ? '<button data-a="delfile" data-id="' + esc(f.fileId) + '">×</button>' : '') + '</a>'; }).join('') + '</div>';
  }
  function logHtml(r) {
    var a = (r.logs || []).slice().sort(function (x, y) { return String(y.date).localeCompare(String(x.date)) || String(y.at || '').localeCompare(String(x.at || '')); });
    if (!a.length) return '<div class="gw-empty"><div class="i">📝</div>' + L('還沒有進度記錄。按下面「寫進度」新增。', 'No progress entries yet. Tap "Add progress".', 'មិនទាន់មានកំណត់ហេតុ') + '</div>';
    return a.map(function (g) { return '<div class="gw-log"><div class="d"><span>📅 ' + esc(g.date) + (g.progress !== '' && g.progress != null ? ' · ' + esc(g.progress) + '%' : '') + (g.headcount ? ' · 👷 ' + esc(g.headcount) : '') + (g.by ? ' · ' + esc(g.by) : '') + '</span><button class="gw-btn red" style="padding:2px 8px" data-a="dellog" data-id="' + esc(g.id) + '">🗑</button></div><p>' + esc(g.text || '') + '</p>' + ((g.files || []).length ? filesGrid(g.files, true) : '') + '</div>'; }).join('');
  }
  function fileHtml(r) {
    var all = allFiles(r), h = '<div class="gw-row" style="margin:0 0 8px">' + Object.keys(STAGE).map(function (k) { return '<button class="gw-btn" data-a="upload" data-stage="' + k + '">' + STAGE[k].i + ' ' + esc(L('加', 'Add ', 'បន្ថែម ')) + esc(lab(STAGE, k)) + '</button>'; }).join('') + '</div>';
    if (!all.length) return h + '<div class="gw-empty"><div class="i">📎</div>' + L('可放進度照、完工照、驗收照，或報價單／驗收單 PDF。', 'Add progress, completion and acceptance photos, or quotation / acceptance PDFs.', 'បន្ថែមរូបថត ឬ PDF') + '</div>';
    return h + Object.keys(STAGE).map(function (k) { var l = all.filter(function (f) { return (f.stage || 'progress') === k; }); return l.length ? '<div style="font-weight:800;font-size:12.5px;margin:10px 0 2px">' + STAGE[k].i + ' ' + esc(lab(STAGE, k)) + ' (' + l.length + ')</div>' + filesGrid(l, true) : ''; }).join('');
  }

  /* ── 附件上傳（照片先縮小；PDF 原檔） ── */
  function readAsDataUrl(file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(new Error('read failed')); }; fr.readAsDataURL(file); }); }
  function shrink(file) {
    return readAsDataUrl(file).then(function (url) {
      if (!/^image\//.test(file.type)) return { data: url, mime: file.type || 'application/pdf' };
      return new Promise(function (res) { var img = new Image(); img.onload = function () { var m = 1600, k = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res({ data: c.toDataURL('image/jpeg', 0.82), mime: 'image/jpeg' }); }; img.onerror = function () { res({ data: url, mime: file.type }); }; img.src = url; });
    });
  }
  function pickFiles(r, stage, intoLog, done) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/*,application/pdf'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = async function () {
      var fs = Array.prototype.slice.call(inp.files || []); inp.remove(); if (!fs.length) return; var ok = 0;
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i];
        if (!/^image\//.test(f.type) && !/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) { toast('⚠️ ' + f.name + ' — ' + L('只能放照片或 PDF', 'Photos or PDF only', 'តែរូបថត ឬ PDF'), 'err'); continue; }
        if (f.size > 9 * 1024 * 1024) { toast('⚠️ ' + f.name + ' — ' + L('檔案超過 9MB', 'File is over 9 MB', 'ឯកសារធំជាង 9MB'), 'err'); continue; }
        toast('⏳ ' + L('上傳中 ', 'Uploading ', 'កំពុងផ្ទុកឡើង ') + (i + 1) + '/' + fs.length);
        try {
          var s = await shrink(f), res = await GA.gasPost('worksAttachment', { recordId: r.id, fileName: f.name, mimeType: s.mime, data: s.data }), d = res.data || {};
          if (!d.fileId) throw new Error('no file id');
          var rec = { fileId: d.fileId, url: d.url, previewUrl: d.previewUrl, name: f.name, mimeType: d.mimeType || s.mime, stage: stage, date: today(), at: new Date().toISOString() };
          if (intoLog) { intoLog.files = intoLog.files || []; intoLog.files.push(rec); } else { r.files = r.files || []; r.files.push(rec); }
          ok++;
        } catch (e) { toast('❌ ' + f.name + ' — ' + (e.message || 'upload failed'), 'err'); }
      }
      if (ok) { touch(r); save(true); schedulePush(); toast('✅ ' + L('已上傳 ', 'Uploaded ', 'បានផ្ទុកឡើង ') + ok); }
      if (done) done(ok);
    };
    inp.click();
  }

  /* ── 新增／編輯 ── */
  function opt(map, cur) { return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + (map[k].i ? map[k].i + ' ' : '') + esc(lab(map, k)) + '</option>'; }).join(''); }
  function inp(id, label, val, type, wide, req, extra) { return '<label' + (wide ? ' class="w"' : '') + '>' + esc(label) + (req ? ' <span class="gw-req">*</span>' : '') + (type === 'area' ? '<textarea id="' + id + '">' + esc(val || '') + '</textarea>' : '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '"' + (extra || '') + '>') + '</label>'; }
  function openEdit(id) {
    var r = id ? byId(id) : null, n = r || { status: 'ongoing', exec: 'me', mode: 'inhouse', category: 'repair', startDate: today(), progress: 0 };
    closeOv('gw-edit');
    var ov = document.createElement('div'); ov.className = 'gw-ov'; ov.id = 'gw-edit'; ov.style.zIndex = 9100;
    ov.innerHTML = '<div class="gw-sheet"><div class="gw-sh"><h3>' + (r ? '✏️ ' + L('編輯工程', 'Edit work', 'កែការងារ') : '➕ ' + L('新增工程', 'New work', 'ការងារថ្មី')) + '</h3><button data-a="close">×</button></div><div class="gw-body"><div class="gw-form">' +
      '<div class="gw-sec">① ' + L('做什麼', 'What', 'អ្វី') + '</div>' +
      inp('gwf-title', L('工程名稱', 'Work name', 'ឈ្មោះការងារ'), n.title, 'text', true, true) +
      '<label>' + esc(L('類別', 'Category', 'ប្រភេទ')) + '<select id="gwf-category">' + opt(CAT, n.category) + '</select></label>' +
      '<label>' + esc(L('狀態', 'Status', 'ស្ថានភាព')) + '<select id="gwf-status">' + opt(STATUS, n.status) + '</select></label>' +
      inp('gwf-location', L('地點', 'Location', 'ទីតាំង'), n.location) + inp('gwf-dept', L('需求部門', 'Requesting dept', 'ផ្នែក'), n.dept, 'text', false, false, ' list="gwf-dept-l"') +
      '<datalist id="gwf-dept-l"><option>管理部 Admin</option><option>生產部 Production</option><option>工務部 ME</option><option>宿舍 Staff house</option><option>倉庫 Warehouse</option><option>廚房 Canteen</option></datalist>' +
      inp('gwf-purpose', L('用途／目的', 'Purpose', 'គោលបំណង'), n.purpose, 'area', true) +
      '<div class="gw-sec">② ' + L('誰在做', 'Who', 'អ្នកណា') + '</div>' +
      '<label>' + esc(L('執行單位', 'Done by', 'អ្នកអនុវត្ត')) + '<select id="gwf-exec">' + opt(EXEC, n.exec) + '</select></label>' +
      '<label>' + esc(L('自辦／外包', 'In-house / outsourced', 'ធ្វើខ្លួនឯង / ម៉ៅការ')) + '<select id="gwf-mode">' + opt(MODE, n.mode) + '</select></label>' +
      inp('gwf-vendor', L('廠商名稱（外包才填）', 'Vendor (if outsourced)', 'អ្នកម៉ៅការ'), n.vendor) + inp('gwf-contact', L('廠商聯絡', 'Vendor contact', 'ទំនាក់ទំនង'), n.contact) +
      inp('gwf-owner', L('負責人／監工', 'Owner / supervisor', 'អ្នកទទួលខុសត្រូវ'), n.owner) + inp('gwf-headcount', L('人數', 'Headcount', 'ចំនួនមនុស្ស'), n.headcount, 'number', false, false, ' min="0" step="1"') +
      '<div class="gw-sec">③ ' + L('時間與進度', 'Schedule', 'កាលវិភាគ') + '</div>' +
      inp('gwf-startDate', L('開始日', 'Start date', 'ថ្ងៃចាប់ផ្តើម'), n.startDate, 'date', false, true) + inp('gwf-planEnd', L('預計完工', 'Planned finish', 'គ្រោងបញ្ចប់'), n.planEnd, 'date') +
      inp('gwf-actualEnd', L('實際完工', 'Actual finish', 'បញ្ចប់ជាក់ស្តែង'), n.actualEnd, 'date') + inp('gwf-progress', L('完成度 %', 'Progress %', 'វឌ្ឍនភាព %'), n.progress, 'number', false, false, ' min="0" max="100" step="5"') +
      inp('gwf-acceptDate', L('驗收日', 'Acceptance date', 'ថ្ងៃទទួល'), n.acceptDate, 'date') + inp('gwf-acceptBy', L('驗收人', 'Accepted by', 'អ្នកទទួល'), n.acceptBy) +
      '<div class="gw-sec">④ ' + L('費用與材料', 'Cost and materials', 'ចំណាយ') + '</div>' +
      inp('gwf-budget', L('預算 USD', 'Budget USD', 'ថវិកា USD'), n.budget, 'number', false, false, ' min="0" step="0.01"') + inp('gwf-actualCost', L('實際費用 USD', 'Actual cost USD', 'ចំណាយ USD'), n.actualCost, 'number', false, false, ' min="0" step="0.01"') +
      inp('gwf-refNo', L('相關單號（PO／維修號）', 'Related no. (PO / repair)', 'លេខយោង'), n.refNo, 'text', true) +
      inp('gwf-materials', L('材料', 'Materials', 'សម្ភារៈ'), n.materials, 'area', true) + inp('gwf-safety', L('安全／注意事項（動火、高空、停電…）', 'Safety / notes (hot work, height, power cut…)', 'សុវត្ថិភាព'), n.safety, 'area', true) + inp('gwf-remarks', L('備註', 'Remarks', 'កំណត់ចំណាំ'), n.remarks, 'area', true) +
      '</div></div><div class="gw-foot"><button class="gw-btn" data-a="close">' + L('取消', 'Cancel', 'បោះបង់') + '</button><button class="gw-btn pri" data-a="save">💾 ' + L('儲存', 'Save', 'រក្សាទុក') + '</button></div></div>';
    document.body.appendChild(ov);
    var g = function (k) { var e = document.getElementById('gwf-' + k); return e ? String(e.value).trim() : ''; };
    document.getElementById('gwf-exec').onchange = function () { var m = document.getElementById('gwf-mode'); if (this.value === 'vendor') m.value = 'outsource'; else if (this.value === 'mixed') m.value = 'mixed'; else m.value = 'inhouse'; };
    document.getElementById('gwf-status').onchange = function () { if ((this.value === 'done' || this.value === 'accepted')) { var a = document.getElementById('gwf-actualEnd'); if (!a.value) a.value = today(); document.getElementById('gwf-progress').value = 100; } if (this.value === 'accepted') { var d = document.getElementById('gwf-acceptDate'); if (!d.value) d.value = today(); } };
    ov.onclick = function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') { ov.remove(); return; }
      if (act !== 'save') return;
      if (!g('title')) { toast('⚠️ ' + L('請填工程名稱', 'Enter the work name', 'សូមបញ្ចូលឈ្មោះ'), 'err'); return; }
      if (!g('startDate')) { toast('⚠️ ' + L('請填開始日', 'Enter the start date', 'សូមបញ្ចូលថ្ងៃចាប់ផ្តើម'), 'err'); return; }
      if (g('planEnd') && g('planEnd') < g('startDate')) { toast('⚠️ ' + L('預計完工不能早於開始日', 'Planned finish is before the start date', 'ថ្ងៃបញ្ចប់មុនថ្ងៃចាប់ផ្តើម'), 'err'); return; }
      if (g('actualEnd') && g('actualEnd') < g('startDate')) { toast('⚠️ ' + L('實際完工不能早於開始日', 'Actual finish is before the start date', 'ថ្ងៃបញ្ចប់មុនថ្ងៃចាប់ផ្តើម'), 'err'); return; }
      var rec = r || { id: uid(), createdAt: new Date().toISOString(), logs: [], files: [] };
      ['title', 'category', 'status', 'location', 'dept', 'purpose', 'exec', 'mode', 'vendor', 'contact', 'owner', 'headcount', 'startDate', 'planEnd', 'actualEnd', 'progress', 'acceptDate', 'acceptBy', 'budget', 'actualCost', 'refNo', 'materials', 'safety', 'remarks'].forEach(function (k) { rec[k] = g(k); });
      touch(rec); if (!r) W.records.push(rec); save(true); ov.remove(); render(); schedulePush();
      toast('✅ ' + L('已儲存', 'Saved', 'បានរក្សាទុក'));
      if (document.getElementById('gw-detail')) openDetail(rec.id); else if (!r) openDetail(rec.id);
    };
  }
  function openLog(id) {
    var r = byId(id); if (!r) return; closeOv('gw-logf');
    var draft = { id: 'l_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), files: [] }, by = ''; try { by = localStorage.getItem('gw_by') || ''; } catch (e) {}
    var ov = document.createElement('div'); ov.className = 'gw-ov'; ov.id = 'gw-logf'; ov.style.zIndex = 9100;
    ov.innerHTML = '<div class="gw-sheet" style="max-width:560px"><div class="gw-sh"><h3>📝 ' + L('寫進度', 'Add progress', 'បន្ថែមវឌ្ឍនភាព') + ' — ' + esc(r.title) + '</h3><button data-a="close">×</button></div><div class="gw-body"><div class="gw-form">' +
      inp('gwl-date', L('日期', 'Date', 'ថ្ងៃ'), today(), 'date', false, true) + inp('gwl-progress', L('完成度 %', 'Progress %', 'វឌ្ឍនភាព %'), prog(r), 'number', false, false, ' min="0" max="100" step="5"') +
      inp('gwl-text', L('今天做了什麼／問題', 'What was done / issues', 'អ្វីដែលបានធ្វើ'), '', 'area', true, true) +
      inp('gwl-headcount', L('今日人數', 'Headcount today', 'ចំនួនមនុស្ស'), r.headcount, 'number', false, false, ' min="0" step="1"') + inp('gwl-by', L('記錄人', 'Recorded by', 'អ្នកកត់ត្រា'), by) +
      '<label class="w">' + esc(L('狀態', 'Status', 'ស្ថានភាព')) + '<select id="gwl-status">' + opt(STATUS, r.status) + '</select></label>' +
      '<div class="w" style="grid-column:1/-1"><div class="gw-row" style="margin:0">' + ['progress', 'done', 'accept'].map(function (k) { return '<button class="gw-btn" data-a="up" data-stage="' + k + '">' + STAGE[k].i + ' ' + esc(lab(STAGE, k)) + esc(L('照', ' photo', '')) + '</button>'; }).join('') + '<span id="gwl-n" style="font-size:12px;font-weight:700;color:#475569"></span></div></div>' +
      '</div></div><div class="gw-foot"><button class="gw-btn" data-a="close">' + L('取消', 'Cancel', 'បោះបង់') + '</button><button class="gw-btn pri" data-a="save">💾 ' + L('儲存', 'Save', 'រក្សាទុក') + '</button></div></div>';
    document.body.appendChild(ov);
    var g = function (k) { var e = document.getElementById('gwl-' + k); return e ? String(e.value).trim() : ''; };
    ov.onclick = function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return; var act = a.getAttribute('data-a');
      if (act === 'close') { ov.remove(); return; }
      if (act === 'up') { pickFiles(r, a.getAttribute('data-stage'), draft, function () { document.getElementById('gwl-n').textContent = draft.files.length ? '📎 ' + draft.files.length : ''; }); return; }
      if (act !== 'save') return;
      if (!g('text') && !draft.files.length) { toast('⚠️ ' + L('請寫進度內容或加照片', 'Write what was done or add a photo', 'សូមសរសេរ ឬបន្ថែមរូបថត'), 'err'); return; }
      draft.date = g('date') || today(); draft.text = g('text'); draft.progress = g('progress'); draft.headcount = g('headcount'); draft.by = g('by'); draft.at = new Date().toISOString();
      try { localStorage.setItem('gw_by', draft.by); } catch (x) {}
      r.logs = r.logs || []; r.logs.push(draft);
      if (draft.progress !== '') r.progress = draft.progress;
      var ns = g('status'); if (ns && ns !== r.status) { r.status = ns; if ((ns === 'done' || ns === 'accepted') && !r.actualEnd) { r.actualEnd = draft.date; r.progress = 100; } if (ns === 'accepted' && !r.acceptDate) { r.acceptDate = draft.date; if (!r.acceptBy) r.acceptBy = draft.by; } }
      touch(r); save(true); ov.remove(); render(); schedulePush(); openDetail(r.id, 'log');
      toast('✅ ' + L('進度已記錄', 'Progress recorded', 'បានកត់ត្រា'));
    };
  }

  /* ── Excel 匯入／匯出 ── */
  var COLS = [
    ['title', '工程名稱', 'Work name', /工程名|工程$|項目|名稱|work|project|title|name|ឈ្មោះ/i], ['category', '類別', 'Category', /類別|分類|categor|type|ប្រភេទ/i], ['status', '狀態', 'Status', /狀態|status|ស្ថានភាព/i],
    ['location', '地點', 'Location', /地點|位置|locat|area|ទីតាំង/i], ['dept', '需求部門', 'Dept', /部門|dept|depart|ផ្នែក/i], ['purpose', '用途', 'Purpose', /用途|目的|purpose|reason|គោលបំណង/i],
    ['exec', '執行單位', 'Done by', /執行|施工單位|done by|executor|contractor type|អ្នកអនុវត្ត/i], ['mode', '自辦/外包', 'In-house/Outsourced', /自辦|外包|outsourc|in-?house|ម៉ៅការ/i], ['vendor', '廠商', 'Vendor', /廠商|承包|vendor|supplier|contractor|អ្នកម៉ៅការ/i], ['contact', '廠商聯絡', 'Vendor contact', /聯絡|電話|contact|phone|tel/i],
    ['owner', '負責人', 'Owner', /負責|監工|owner|pic|supervis|in charge|ទទួលខុសត្រូវ/i], ['headcount', '人數', 'Headcount', /人數|人力|head ?count|workers|manpower|people|ចំនួនមនុស្ស/i],
    ['startDate', '開始日', 'Start date', /開始|開工|start|begin|ចាប់ផ្តើម/i], ['planEnd', '預計完工', 'Planned finish', /預計|預定|plan|target|due|គ្រោង/i], ['actualEnd', '實際完工', 'Actual finish', /實際完工|完工日|actual (finish|end)|finish(ed)? date|complet|បញ្ចប់/i],
    ['progress', '完成度%', 'Progress %', /完成度|進度|progress|%/i], ['budget', '預算USD', 'Budget USD', /預算|budget|ថវិកា/i], ['actualCost', '實際費用USD', 'Actual cost USD', /實際費用|費用|金額|cost|amount|ចំណាយ/i],
    ['refNo', '相關單號', 'Related no.', /單號|po|ref|維修號|លេខ/i], ['materials', '材料', 'Materials', /材料|物料|material|សម្ភារៈ/i], ['safety', '安全注意', 'Safety notes', /安全|注意|safety|សុវត្ថិភាព/i], ['remarks', '備註', 'Remarks', /備註|說明|remark|note|ចំណាំ/i]
  ];
  function normKey(map, v, extra) { var s = String(v == null ? '' : v).trim().toLowerCase(); if (!s) return ''; for (var k in map) { var e = map[k]; if (s === k || s === e.zh.toLowerCase() || s === e.en.toLowerCase() || s === String(e.km).toLowerCase() || s.indexOf(e.zh.toLowerCase()) >= 0 || s.indexOf(e.en.toLowerCase()) >= 0) return k; } if (extra) for (var i = 0; i < extra.length; i++) if (extra[i][0].test(s)) return extra[i][1]; return ''; }
  function dateOf(v) { if (v == null || v === '') return ''; if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v))) { try { return GA.excelDate(Number(v)) || ''; } catch (e) { return ''; } } var s = String(v).trim(), m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2); m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); try { return GA.excelDate(v) || ''; } catch (e) { return ''; } }
  function parseRows(aoa) {
    var hi = -1, map = {};
    for (var i = 0; i < Math.min(aoa.length, 15) && hi < 0; i++) { var m = {}, hit = 0; (aoa[i] || []).forEach(function (h, ci) { var t = String(h == null ? '' : h).trim(); if (!t) return; for (var c = 0; c < COLS.length; c++) { if (m[COLS[c][0]] === undefined && COLS[c][3].test(t)) { m[COLS[c][0]] = ci; hit++; break; } } }); if (m.title !== undefined && hit >= 2) { hi = i; map = m; } }
    if (hi < 0) throw new Error(L('找不到標題列（至少要有「工程名稱」和另一個欄位）', 'Header row not found (need "Work name" plus at least one more column)', 'រកមិនឃើញជួរក្បាល'));
    var out = [], bad = [];
    for (var r = hi + 1; r < aoa.length; r++) {
      var row = aoa[r] || [], get = function (k) { return map[k] === undefined ? '' : row[map[k]]; }, title = String(get('title') == null ? '' : get('title')).trim();
      if (!title) continue;
      var o = { title: title }; COLS.forEach(function (c) { var k = c[0]; if (k === 'title') return; var v = get(k); o[k] = v == null ? '' : String(v).trim(); });
      ['startDate', 'planEnd', 'actualEnd'].forEach(function (k) { var raw = get(k); o[k] = dateOf(raw); if (raw !== '' && raw != null && !o[k]) bad.push((r + 1) + ': ' + k + ' = ' + raw); });
      o.status = normKey(STATUS, o.status, [[/進行|施工|on ?going|in progress|doing/, 'ongoing'], [/完工|完成|done|finish|complete/, 'done'], [/驗收|accept/, 'accepted'], [/暫停|hold|pause/, 'paused'], [/取消|cancel/, 'cancelled'], [/規劃|計畫|plan|pending/, 'planned']]) || (o.actualEnd ? 'done' : 'ongoing');
      o.exec = normKey(EXEC, o.exec, [[/工務|maint|engineer|^me\b/, 'me'], [/廠商|外|vendor|contract|supplier/, 'vendor'], [/總務|行政|admin|^ga\b/, 'ga']]) || (o.vendor ? 'vendor' : 'me');
      o.mode = normKey(MODE, o.mode, [[/外包|outsourc|contract/, 'outsource'], [/自|in-?house|internal|own/, 'inhouse']]) || (o.exec === 'vendor' ? 'outsource' : 'inhouse');
      o.category = normKey(CAT, o.category, [[/新建|增建|build|construct/, 'build'], [/改善|整修|renov|improv/, 'improve'], [/維修|保養|repair|maint/, 'repair'], [/安裝|install/, 'install'], [/水|電|消防|electr|plumb|fire/, 'electric'], [/土木|道路|civil|road/, 'civil'], [/拆|清運|remov|demol/, 'remove']]) || 'other';
      o.progress = String(o.progress || '').replace('%', '').trim(); if (o.progress !== '' && GA.num(o.progress) <= 1 && /\./.test(o.progress)) o.progress = String(Math.round(GA.num(o.progress) * 100));
      ['budget', 'actualCost', 'headcount'].forEach(function (k) { if (o[k] !== '') o[k] = String(GA.num(String(o[k]).replace(/[$,\s]/g, '')) || ''); });
      if (!o.startDate) o.startDate = today();
      out.push(o);
    }
    return { rows: out, bad: bad, cols: Object.keys(map) };
  }
  function keyOf(o) { return String(o.title || '').trim().toLowerCase() + '|' + (o.startDate || ''); }
  function importXlsx(file) {
    if (!/\.(xlsx|xlsb|xls|xlsm|csv)$/i.test(file.name)) { toast('⚠️ ' + L('請選 Excel 或 CSV 檔', 'Choose an Excel or CSV file', 'សូមជ្រើស Excel ឬ CSV'), 'err'); return; }
    if (typeof XLSX === 'undefined') { toast('❌ Excel reader not loaded', 'err'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', raw: true }), best = null, err = null;
        wb.SheetNames.forEach(function (n) { try { var p = parseRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })); if (!best || p.rows.length > best.rows.length) { best = p; best.sheet = n; } } catch (e) { err = e; } });
        if (!best) throw err || new Error('empty'); if (!best.rows.length) throw new Error(L('檔案裡沒有可匯入的工程', 'No works found in the file', 'គ្មានទិន្នន័យ'));
        var idx = {}; live().forEach(function (r) { idx[keyOf(r)] = r; });
        var add = [], upd = [], same = 0, seen = {};
        best.rows.forEach(function (o) { var k = keyOf(o); if (seen[k]) return; seen[k] = 1; var ex = idx[k]; if (!ex) { add.push(o); return; } var diff = COLS.some(function (c) { return o[c[0]] !== '' && String(ex[c[0]] == null ? '' : ex[c[0]]) !== String(o[c[0]]); }); if (diff) upd.push([ex, o]); else same++; });
        previewImport(file.name, best, add, upd, same);
      } catch (e) { toast('❌ ' + (e.message || e), 'err'); }
    };
    fr.readAsArrayBuffer(file);
  }
  function previewImport(name, best, add, upd, same) {
    closeOv('gw-imp');
    var ov = document.createElement('div'); ov.className = 'gw-ov'; ov.id = 'gw-imp'; ov.style.zIndex = 9100;
    var sample = add.concat(upd.map(function (u) { return u[1]; })).slice(0, 12);
    ov.innerHTML = '<div class="gw-sheet"><div class="gw-sh"><h3>📥 ' + L('匯入預覽', 'Import preview', 'មើលជាមុន') + ' — ' + esc(name) + '</h3><button data-a="close">×</button></div><div class="gw-body">' +
      '<div class="gw-grid">' + F(L('工作表', 'Sheet', 'សន្លឹក'), best.sheet) + F(L('讀到', 'Rows read', 'បានអាន'), best.rows.length) + F('🆕 ' + L('新增', 'New', 'ថ្មី'), add.length, false, true) + F('♻️ ' + L('更新（同名同開始日）', 'Update (same name and start date)', 'ធ្វើបច្ចុប្បន្នភាព'), upd.length, false, true) + F('＝ ' + L('相同略過', 'Unchanged, skipped', 'ដូចគ្នា'), same, false, true) + F(L('對到的欄位', 'Columns matched', 'ជួរឈរ'), best.cols.length + ' / ' + COLS.length) + '</div>' +
      (best.bad.length ? '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;font-size:12px">🔴 ' + esc(L('有日期讀不懂（開始日先填今天、其他留空，匯入後請更正）：', 'Some dates could not be read (start date set to today, others left blank; fix after import): ', 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ៖ ')) + esc(best.bad.slice(0, 6).join(' ｜ ')) + '</div>' : '') +
      (sample.length ? '<div style="overflow:auto;margin-top:10px"><table class="gw-tbl"><tr><th>' + esc(L('工程', 'Work', 'ការងារ')) + '</th><th>' + esc(L('開始', 'Start', 'ចាប់ផ្តើម')) + '</th><th>' + esc(L('狀態', 'Status', 'ស្ថានភាព')) + '</th><th>' + esc(L('執行', 'By', 'ដោយ')) + '</th><th>' + esc(L('費用', 'Cost', 'ចំណាយ')) + '</th></tr>' + sample.map(function (o) { return '<tr><td>' + esc(o.title) + '</td><td>' + esc(o.startDate) + '</td><td>' + esc(lab(STATUS, o.status)) + '</td><td>' + esc(lab(EXEC, o.exec)) + (o.vendor ? ' · ' + esc(o.vendor) : '') + '</td><td>' + (o.actualCost ? GA.money(o.actualCost, 2) : '—') + '</td></tr>'; }).join('') + '</table></div>' : '') +
      '</div><div class="gw-foot"><button class="gw-btn" data-a="close">' + L('取消', 'Cancel', 'បោះបង់') + '</button><button class="gw-btn pri" data-a="go"' + (add.length + upd.length ? '' : ' disabled') + '>✅ ' + L('確認匯入', 'Import', 'នាំចូល') + ' (' + (add.length + upd.length) + ')</button></div></div>';
    document.body.appendChild(ov);
    ov.onclick = function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      if (a.getAttribute('data-a') === 'close') { ov.remove(); return; }
      if (a.getAttribute('data-a') !== 'go') return;
      add.forEach(function (o) { o.id = uid(); o.createdAt = new Date().toISOString(); o.logs = []; o.files = []; o.source = 'excel'; touch(o); W.records.push(o); });
      upd.forEach(function (u) { COLS.forEach(function (c) { if (u[1][c[0]] !== '') u[0][c[0]] = u[1][c[0]]; }); touch(u[0]); });
      save(true); ov.remove(); render(); schedulePush();
      toast('✅ ' + L('已匯入：新增 ', 'Imported: new ', 'បាននាំចូល៖ ថ្មី ') + add.length + L('、更新 ', ', updated ', ', កែ ') + upd.length);
    };
  }
  function sheetRows(list) { return [COLS.map(function (c) { return c[1] + ' ' + c[2]; })].concat(list.map(function (r) { return COLS.map(function (c) { var k = c[0], v = r[k]; if (k === 'status') return lab1(STATUS, v); if (k === 'exec') return lab1(EXEC, v); if (k === 'mode') return lab1(MODE, v); if (k === 'category') return lab1(CAT, v); if (k === 'budget' || k === 'actualCost' || k === 'headcount' || k === 'progress') return v === '' || v == null ? '' : GA.num(v); return v == null ? '' : v; }); })); }
  function exportXlsx() {
    var list = filtered(); if (!list.length) { toast(L('這個期間沒有資料可匯出', 'Nothing to export in this period', 'គ្មានទិន្នន័យ'), 'err'); return; }
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(sheetRows(list)); ws['!cols'] = COLS.map(function (c) { return { wch: c[0] === 'title' || c[0] === 'purpose' || c[0] === 'materials' ? 28 : 14 }; }); XLSX.utils.book_append_sheet(wb, ws, 'Works');
    var logs = [['工程名稱 Work', '日期 Date', '完成度% Progress', '人數 Headcount', '內容 Notes', '記錄人 By', '附件 Files']]; list.forEach(function (r) { (r.logs || []).forEach(function (g) { logs.push([r.title, g.date, g.progress, g.headcount, g.text, g.by, (g.files || []).map(function (f) { return f.url; }).join('\n')]); }); });
    if (logs.length > 1) { var ws2 = XLSX.utils.aoa_to_sheet(logs); ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 50 }, { wch: 12 }, { wch: 40 }]; XLSX.utils.book_append_sheet(wb, ws2, 'Progress_Log'); }
    var st = pState(); XLSX.writeFile(wb, 'AC_GA_EXP_Works_' + st.key + '.xlsx');
  }
  function templateXlsx() {
    var wb = XLSX.utils.book_new(), ex = { title: '2F 廁所排水管更換', category: 'repair', status: 'ongoing', location: 'B棟 2F', dept: '生產部 Production', purpose: '排水堵塞，更換主管', exec: 'vendor', mode: 'outsource', vendor: 'ABC Plumbing', contact: '012-345-678', owner: 'Phea', headcount: 4, startDate: today(), planEnd: '', actualEnd: '', progress: 30, budget: 800, actualCost: 250, refNo: '', materials: 'PVC 4" x 12m', safety: '', remarks: '（這一列是範例，匯入前請刪除）' };
    var ws = XLSX.utils.aoa_to_sheet(sheetRows([ex])); ws['!cols'] = COLS.map(function () { return { wch: 16 }; }); XLSX.utils.book_append_sheet(wb, ws, 'Works'); XLSX.writeFile(wb, 'AC_GA_EXP_Works_Template.xlsx');
  }
  function backupJson() { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ schema: 1, savedAt: new Date().toISOString(), records: W.records }, null, 1)], { type: 'application/json' })); a.download = 'AC_GA_EXP_Works_' + today() + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); }

  /* ── 摘要（有資料才發） ── */
  function summaryRows(st) { return filtered({ type: st.ptype, key: st.period }); }
  function summaryText(st) {
    W.lastSt = { ptype: st.ptype, period: st.period };
    var TG = GA.telegram, Lg = st.lang || 'both', T = function (zh, en, km) { return TG.label(zh, en, km, Lg); }, keep = W.filter; W.filter = { status: '', exec: '', q: '' }; var list = summaryRows(st); W.filter = keep;
    if (!list.length) return '🏗 ' + T('這個期間沒有工程記錄，不需要發送。', 'No works in this period — nothing to send.', 'គ្មានការងារក្នុងរយៈពេលនេះ');
    var n = function (s) { return list.filter(function (r) { return r.status === s; }).length; }, od = list.filter(overdue).length, tc = list.reduce(function (a, r) { return a + cost(r); }, 0), tb = list.reduce(function (a, r) { return a + budget(r); }, 0), out = list.filter(function (r) { return r.mode === 'outsource' || r.mode === 'mixed'; }).length;
    var rows = [{ zh: '本期工程', en: 'Works', km: 'ការងារ', v: list.length }, { zh: '進行中', en: 'Ongoing', km: 'កំពុងធ្វើ', v: n('ongoing'), tone: n('ongoing') ? 'warn' : '' }, { zh: '完工／驗收', en: 'Completed', km: 'បានបញ្ចប់', v: n('done') + n('accepted'), tone: 'ok' }];
    if (n('planned') + n('paused')) rows.push({ zh: '規劃／暫停', en: 'Planned / paused', km: 'គ្រោង / ផ្អាក', v: n('planned') + n('paused') });
    rows.push({ zh: '逾期', en: 'Overdue', km: 'ហួសកំណត់', v: od, tone: od ? 'bad' : 'ok' }); rows.push({ zh: '外包', en: 'Outsourced', km: 'ម៉ៅការ', v: out });
    rows.push('-'); rows.push({ zh: '已花費', en: 'Spent', km: 'បានចំណាយ', v: GA.money(tc, 2) }); if (tb) rows.push({ zh: '預算', en: 'Budget', km: 'ថវិកា', v: GA.money(tb, 2), tone: tc > tb ? 'bad' : 'ok' });
    list.slice(0, 10).forEach(function (r, i) {
      var ll = lastLog(r), s = STATUS[r.status] || STATUS.planned; rows.push('-');
      rows.push({ head: true, zh: (i + 1) + '. ' + r.title, en: (i + 1) + '. ' + r.title, km: (i + 1) + '. ' + r.title, v: s.i + ' ' + prog(r) + '%' + (overdue(r) ? ' ⏰' : '') });
      rows.push({ text: true, zh: '執行', en: 'By', km: 'ដោយ', v: TG.label(EXEC[r.exec] ? EXEC[r.exec].zh : '—', EXEC[r.exec] ? EXEC[r.exec].en : '—', EXEC[r.exec] ? EXEC[r.exec].km : '—', Lg) + (r.vendor ? ' · ' + r.vendor : '') + (r.headcount ? ' · ' + r.headcount + ' ' + T('人', 'ppl', 'នាក់') : '') });
      rows.push({ text: true, zh: '期間', en: 'Dates', km: 'កាលបរិច្ឆេទ', v: md(r.startDate) + ' → ' + md(r.actualEnd || r.planEnd) + (r.actualEnd ? '' : r.planEnd ? ' ' + T('(預計)', '(plan)', '(គ្រោង)') : '') });
      rows.push({ text: true, zh: '地點／部門', en: 'Location / dept', km: 'ទីតាំង / ផ្នែក', v: (r.location || '—') + ' / ' + (r.dept || '—') });
      if (cost(r) || budget(r)) rows.push({ text: true, zh: '費用', en: 'Cost', km: 'ចំណាយ', v: GA.money(cost(r), 2) + (budget(r) ? ' / ' + GA.money(budget(r), 2) : '') });
      if (ll) rows.push({ text: true, zh: '最新進度', en: 'Latest', km: 'ថ្មីបំផុត', v: md(ll.date) + ' ' + String(ll.text || '').slice(0, 90) });
    });
    if (list.length > 10) rows.push('-', { zh: '其餘未列', en: 'More not listed', km: 'មិនបានរាយ', v: list.length - 10 });
    return TG.buildSummary({ icon: '🏗', titleZh: '工程進度摘要', titleEn: 'Works Progress Summary', titleKm: 'សង្ខេបវឌ្ឍនភាពការងារ', lang: Lg, period: TG.periodLabel(st.period, st.ptype, Lg), rows: rows, footer: '🕐 ' + today() + ' · AC-GA-EXP' });
  }
  function summaryChart(st) {
    var TG = GA.telegram, Lg = st.lang || 'zh', T = function (zh, en, km) { return TG.label(zh, en, km, Lg); }, keep = W.filter; W.filter = { status: '', exec: '', q: '' }; var list = summaryRows(st); W.filter = keep; if (!list.length) return null;
    var n = function (s) { return list.filter(function (r) { return r.status === s; }).length; }, od = list.filter(overdue).length, tc = list.reduce(function (a, r) { return a + cost(r); }, 0);
    var blocks = [{ type: 'stats', items: [{ label: T('工程', 'Works', 'ការងារ'), value: list.length }, { label: T('進行中', 'Ongoing', 'កំពុងធ្វើ'), value: n('ongoing'), color: '#2b8fbd' }, { label: T('完工', 'Completed', 'បានបញ្ចប់'), value: n('done') + n('accepted'), color: '#2e9c6a' }, { label: T('逾期', 'Overdue', 'ហួសកំណត់'), value: od, color: od ? '#e35d5b' : '#2e9c6a' }, { label: T('已花費', 'Spent', 'ចំណាយ'), value: GA.money(tc, 0) }] }];
    blocks.push({ type: 'bars', span: 2, title: T('完成度', 'Progress', 'វឌ្ឍនភាព'), max: 100, unit: '%', items: list.slice(0, 10).map(function (r) { var s = STATUS[r.status] || STATUS.planned; return { label: String(r.title).slice(0, 26), value: prog(r), color: overdue(r) ? '#e35d5b' : s.c, text: prog(r) + '%' }; }) });
    blocks.push({ type: 'table', title: T('工程清單', 'Works list', 'បញ្ជីការងារ'), head: [T('工程', 'Work', 'ការងារ'), T('執行', 'By', 'ដោយ'), T('期間', 'Dates', 'ថ្ងៃ'), T('費用', 'Cost', 'ចំណាយ')], align: ['l', 'l', 'r', 'r'], widths: [2.6, 1.6, 1.3, 1.1], rows: list.slice(0, 10).map(function (r) { var e = EXEC[r.exec] || {}; return [r.title, TG.label(e.zh || '—', e.en || '—', e.km || '—', Lg) + (r.vendor ? ' ' + r.vendor : ''), md(r.startDate) + '→' + md(r.actualEnd || r.planEnd), { text: cost(r) ? GA.money(cost(r), 0) : '—', bold: true }]; }) });
    return { title: '🏗 ' + T('工程進度', 'Works Progress', 'វឌ្ឍនភាពការងារ'), subtitle: TG.periodLabel(st.period, st.ptype, Lg).replace(/ \/ /g, ' '), theme: 'navy', blocks: blocks, footer: 'AC-GA-EXP · ' + today() };
  }
  function openSummary() {
    var st = pState(), keep = W.filter; W.filter = { status: '', exec: '', q: '' }; var has = filtered(st).length; W.filter = keep;
    if (!has) { toast('ℹ️ ' + L('這個期間沒有工程記錄，不需要發摘要', 'No works in this period — no summary to send', 'គ្មានការងារ មិនចាំបាច់ផ្ញើ')); return; }
    try { GA.setLang(LG()); } catch (e) {}
    GA.telegram.open({ module: 'maintenance', canApprove: false, ptype: st.type, period: st.key, scopes: [{ v: 'works', zh: '工程進度', en: 'Works log', km: 'វឌ្ឍនភាពការងារ' }],
      periods: function (type) { var ks = []; live().forEach(function (r) { [r.startDate, r.actualEnd].concat((r.logs || []).map(function (g) { return g.date; })).forEach(function (d) { if (d) ks.push(GA.periodKey(d, type)); }); }); ks.push(GA.currentPeriod(type)); return ks; },
      summary: summaryText, chart: summaryChart,
      beforeSend: async function () { /* 沒有資料就不發；送出前先上雲 */ if (W.lastSt && !root.GAWorks.hasData(W.lastSt)) throw new Error(L('這個期間沒有工程記錄，不發送', 'No works in this period — not sent', 'គ្មានការងារ មិនផ្ញើ')); if (W.dirty) await sync(true); return true; } });
  }

  root.GAWorks = {
    show: function () { if (!mount()) return; render(); if (Date.now() - W.lastSync > 60000) sync(true); },
    render: function () { if (W.mounted) { renderBar(); render(); } },
    summaryText: summaryText, summaryChart: summaryChart, hasData: function (st) { var keep = W.filter; W.filter = { status: '', exec: '', q: '' }; var n = filtered({ type: st.ptype, key: st.period }).length; W.filter = keep; return n > 0; },
    _state: W, _parseRows: parseRows, _inPeriod: inPeriod, _pRange: pRange
  };
})(window);
