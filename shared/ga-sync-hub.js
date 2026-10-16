/* AC-GA-EXP Sync Hub v3.9.32 — platform home: update every module's cloud data at once, or only the ticked ones.
 * Each module is synced with its OWN code (no duplicated sync logic):
 *   - fuel / transport / etc  → the shared mobility outbox store (GAMobilityStore.sync)
 *   - expense / receiving / maintenance / damage → the module page is opened in a hidden frame; its own
 *     GAAutoSync start-up run downloads cloud changes and uploads anything still pending, exactly as when
 *     the page is opened by hand.  Conflict prompts inside the frame answer "merge both sides" (never overwrite).
 *   - procurement → saved straight to the cloud on every change; the hub only checks the cloud copy loads.
 */
(function (g) {
  'use strict';
  if (g.GASyncHub) return;
  var MODS = [
    { k: 'procurement', ico: '📋', page: 'procurement.html', type: 'cloud', zh: '每月採購 PO', en: 'Monthly PO', km: 'PO ប្រចាំខែ' },
    { k: 'receiving', ico: '📦', page: 'receiving.html', type: 'frame', key: 'receiving', zh: '收貨／收發', en: 'Receiving', km: 'ទទួលទំនិញ' },
    { k: 'maintenance', ico: '🔧', page: 'maintenance.html', type: 'frame', key: 'maintenance', zh: '維修／臨採', en: 'Repair / Temp PO', km: 'ជួសជុល' },
    { k: 'damage', ico: '⚠️', page: 'damage.html', type: 'frame', key: 'damage', zh: '損壞／遺失', en: 'Damage / Lost', km: 'ខូច/បាត់' },
    { k: 'fuel', ico: '⛽', page: 'fuel.html', type: 'mob', mod: 'fuel', zh: '柴油', en: 'Diesel', km: 'ប្រេងម៉ាស៊ូត' },
    { k: 'transport', ico: '🚐', page: 'transportation.html', type: 'mob', mod: 'transport', zh: '行車紀錄', en: 'Transportation', km: 'ការធ្វើដំណើរ' },
    { k: 'etc', ico: '🛣️', page: 'etc.html', type: 'mob', mod: 'etc', zh: 'ETC 通行', en: 'ETC', km: 'ETC' },
    { k: 'expense', ico: '💰', page: 'expense.html', type: 'frame', key: 'expense', zh: '費用中心', en: 'Expense', km: 'ចំណាយ' }
  ];
  var SEL_KEY = 'gaexp_hub_sel_v1', LAST_KEY = 'gaexp_hub_last_v1', stores = {}, running = false, live = {};
  function lang() { return (g.GA && GA.lang) || 'zh'; }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function name(m) { return L(m.zh, m.en, m.km); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function hhmm(t) { if (!t) return ''; var d = new Date(t), now = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; var s = p(d.getHours()) + ':' + p(d.getMinutes()); return d.toDateString() === now.toDateString() ? s : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + s; }
  function selected() { var s = readJSON(SEL_KEY, null); return Array.isArray(s) ? s : MODS.map(function (m) { return m.k; }); }

  /* ── pending counts (read-only; no sync is started) ── */
  function mobilityPending() {
    return new Promise(function (resolve) {
      var out = {};
      try {
        var r = indexedDB.open('ga-exp-mobility-v1', 1);
        r.onupgradeneeded = function () { try { r.result.createObjectStore('state'); } catch (_) {} };
        r.onerror = function () { resolve(out); };
        r.onsuccess = function () {
          var db = r.result, left = 3;
          try {
            var tx = db.transaction('state', 'readonly'), st = tx.objectStore('state');
            ['fuel', 'transport', 'etc'].forEach(function (mod) {
              var q = st.get(mod);
              q.onsuccess = function () { var v = q.result || {}; out[mod] = { pending: Object.keys(v.pending || {}).length, conflicts: (v.conflicts || []).length, rows: (v.rows || []).length }; };
            });
            tx.oncomplete = function () { db.close(); resolve(out); };
            tx.onerror = function () { db.close(); resolve(out); };
          } catch (_) { db.close(); resolve(out); }
        };
      } catch (_) { resolve(out); }
    });
  }
  async function pendingInfo() {
    var mob = await mobilityPending(), out = {};
    MODS.forEach(function (m) {
      if (m.type === 'mob') { var x = mob[m.mod] || {}; out[m.k] = { pending: x.pending || 0, conflicts: x.conflicts || 0 }; }
      else if (m.type === 'frame') { var p = null; try { p = localStorage.getItem('gaexp:auto2:' + m.key); } catch (_) {} out[m.k] = { pending: p ? 1 : 0, conflicts: 0 }; }
      else out[m.k] = { pending: 0, conflicts: 0 };
    });
    return out;
  }

  /* ── runners ── */
  function loadStoreLib() {
    if (g.GAMobilityStore) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'shared/ga-mobility-store.js?v=3.9.29';
      s.onload = function () { resolve(); }; s.onerror = function () { reject(new Error('ga-mobility-store.js')); };
      document.head.appendChild(s);
    });
  }
  async function runMob(m) {
    await loadStoreLib();
    var st = stores[m.mod] || (stores[m.mod] = GAMobilityStore.create(m.mod, { status: function () {} }));
    await st.loaded;
    var ok = await st.sync(), c = st.conflicts().length, p = st.pending(), n = st.rows().length;
    if (c) return { ok: false, msg: L(c + ' 筆雲端與本機不同，請開頁選擇', c + ' conflicts — open the page to choose', c + ' ខុសគ្នា') };
    if (p || ok === false) return { ok: false, msg: L('尚有 ' + p + ' 筆未上傳，稍後自動重試', p + ' changes still pending; will retry', p + ' រង់ចាំ') };
    return { ok: true, msg: L(n.toLocaleString() + ' 筆', n.toLocaleString() + ' records', n.toLocaleString()) };
  }
  async function runCloud(m) {
    var r = await GA.gasGet('getState', { _t: Date.now() });
    if (!r || r.ok === false) throw new Error((r && r.msg) || 'getState');
    return { ok: true, msg: L('雲端即時存檔，已確認可讀取', 'Saved live to cloud; read check OK', 'Cloud OK') };
  }
  function runFrame(m) {
    return new Promise(function (resolve) {
      var f = document.createElement('iframe'), loadedAt = 0, done = false, iv = null, to = null;
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1024px;height:700px;border:0;opacity:0;pointer-events:none';
      function finish(ok, msg) {
        if (done) return; done = true; clearInterval(iv); clearTimeout(to);
        setTimeout(function () { try { f.remove(); } catch (_) {} }, 400);
        resolve({ ok: ok, msg: msg });
      }
      f.onload = function () {
        loadedAt = Date.now();
        try { var w = f.contentWindow; w.confirm = function () { return true; }; w.alert = function () {}; } catch (_) {}
      };
      iv = setInterval(function () {
        if (!loadedAt) return;
        var w; try { w = f.contentWindow; } catch (_) { return; }
        if (!w || !w.GAAutoSync) { if (Date.now() - loadedAt > 20000) finish(false, L('頁面沒有載入同步模組', 'Page sync module not loaded', 'Sync module missing')); return; }
        var st = w.GAAutoSync.state(m.key);
        if (!st || !st.lastRun || Date.now() - loadedAt < 1200) return;
        if (/^(synced|checked)$/.test(st.state)) {
          var pend = w.GAAutoSync.pending(m.key);
          if (pend) return; /* a queued change is still being sent */
          var txt = ''; try { txt = ((w.document.getElementById('ga-cloud') || {}).textContent || '').replace(/^[●○◐◑\s]+/, '').trim(); } catch (_) {}
          finish(true, txt || L('已同步', 'Synced', 'Synced'));
        } else if (/^(retry|incompatible|offline)$/.test(st.state)) {
          var d = String(st.detail || st.state);
          if (/Download failed/i.test(d)) d = L('下載失敗，已暫停上傳以保護雲端資料', 'Download failed; upload paused to protect cloud data', 'Download failed');
          finish(false, d);
        }
      }, 500);
      to = setTimeout(function () { finish(false, L('逾時（3 分鐘），請開頁查看', 'Timed out (3 min) — open the page', 'អស់ពេល')); }, 180000);
      f.src = m.page + (m.page.indexOf('?') < 0 ? '?' : '&') + 'hubSync=1&_t=' + Date.now();
      document.body.appendChild(f);
    });
  }
  async function runOne(m) {
    live[m.k] = { state: 'run' }; render();
    var res;
    try {
      if (!GA.gasUrl || !GA.gasUrl()) throw new Error(L('尚未設定 GAS 網址', 'GAS URL not set', 'GAS URL'));
      if (!navigator.onLine) throw new Error(L('沒有網路', 'Offline', 'Offline'));
      res = m.type === 'mob' ? await runMob(m) : m.type === 'cloud' ? await runCloud(m) : await runFrame(m);
    } catch (e) { res = { ok: false, msg: (e && e.message) || String(e) }; }
    var last = readJSON(LAST_KEY, {}); last[m.k] = { at: Date.now(), ok: !!res.ok, msg: res.msg || '' }; writeJSON(LAST_KEY, last);
    live[m.k] = { state: res.ok ? 'ok' : 'err' }; render();
    return res;
  }
  async function run(keys) {
    if (running) return; keys = (keys || []).filter(function (k) { return MODS.some(function (m) { return m.k === k; }); });
    if (!keys.length) { if (GA.toast) GA.toast(L('請先勾選模組', 'Tick at least one module', 'សូមជ្រើស'), 'warn'); return; }
    running = true; render();
    try { if (GA.cloud) GA.cloud.set('sync', L('同步中…', 'Syncing…', 'Syncing…')); } catch (_) {}
    var list = MODS.filter(function (m) { return keys.indexOf(m.k) >= 0; });
    list.forEach(function (m) { live[m.k] = { state: 'wait' }; });
    render();
    /* light modules in parallel, page frames one at a time (memory on phones) */
    var fast = list.filter(function (m) { return m.type !== 'frame'; }), frames = list.filter(function (m) { return m.type === 'frame'; });
    var results = await Promise.all(fast.map(runOne));
    for (var i = 0; i < frames.length; i++) results.push(await runOne(frames[i]));
    var bad = results.filter(function (r) { return !r.ok; }).length;
    running = false; live = {};
    try { pend = await pendingInfo(); } catch (_) {}
    render();
    try {
      if (GA.cloud) GA.cloud.set(bad ? 'warn' : 'ok', bad ? L(bad + ' 個模組需處理', bad + ' modules need attention', bad + ' ត្រូវពិនិត្យ') : L('全部已同步', 'All synced', 'All synced'));
      GA.toast(bad ? '⚠️ ' + L('完成，' + bad + ' 個模組需處理', 'Done — ' + bad + ' need attention', 'Done') : '✅ ' + L('已全部同步 ' + results.length + ' 個模組', 'Synced ' + results.length + ' modules', 'Synced'), bad ? 'warn' : 'success');
    } catch (_) {}
    if (typeof g.refreshDashboard === 'function') try { g.refreshDashboard(); } catch (_) {}
  }

  /* ── UI ── */
  var root = null, pend = {};
  function css() {
    if (document.getElementById('ga-sync-hub-css')) return;
    var s = document.createElement('style'); s.id = 'ga-sync-hub-css';
    s.textContent = '.shub{background:#fff;border:1px solid var(--ga-line);border-radius:14px;padding:14px 14px 10px;box-shadow:0 1px 2px rgba(15,23,42,.04)}' +
      '.shub-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}' +
      '.shub-bar .sp{flex:1}.shub-all{font-size:12.5px;color:var(--ga-txt2);display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-weight:600}' +
      '.shub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}' +
      '.shub-row{display:flex;align-items:center;gap:9px;border:1px solid var(--ga-line);border-radius:10px;padding:9px 10px;min-height:44px;cursor:pointer;transition:.15s;background:#fff}' +
      '.shub-row:hover{border-color:var(--ga-sky)}.shub-row.on{background:var(--ga-sky-l);border-color:#bae6fd}' +
      '.shub-row input{width:18px;height:18px;accent-color:var(--ga-sky);flex:none;cursor:pointer}' +
      '.shub-ico{font-size:18px;flex:none}.shub-txt{flex:1;min-width:0}.shub-n{font-size:13px;font-weight:700;color:var(--ga-txt)}' +
      '.shub-m{font-size:11px;color:var(--ga-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.shub-pill{font-size:11px;font-weight:700;border-radius:999px;padding:3px 8px;white-space:nowrap;flex:none}' +
      '.p-ok{background:#ecfdf5;color:#047857}.p-err{background:#fff7ed;color:#c2410c}.p-run{background:#eff6ff;color:#2563eb}.p-wait{background:#f1f5f9;color:#64748b}.p-pend{background:#fffbeb;color:#b45309}.p-idle{background:#f8fafc;color:#94a3b8}' +
      '.shub-open{font-size:11px;color:var(--ga-sky);text-decoration:none;flex:none;padding:4px}' +
      '.shub-note{font-size:11px;color:var(--ga-mut);margin-top:8px}';
    document.head.appendChild(s);
  }
  function pill(m) {
    var lv = live[m.k], last = readJSON(LAST_KEY, {})[m.k], p = pend[m.k] || {};
    if (lv && lv.state === 'run') return '<span class="shub-pill p-run">◐ ' + L('同步中', 'Syncing', 'Syncing') + '</span>';
    if (lv && lv.state === 'wait') return '<span class="shub-pill p-wait">… ' + L('排隊中', 'Queued', 'Queued') + '</span>';
    if (p.conflicts) return '<span class="shub-pill p-err">⚠ ' + p.conflicts + ' ' + L('衝突', 'conflicts', 'conflicts') + '</span>';
    if (p.pending) return '<span class="shub-pill p-pend">☁ ' + L('待上傳', 'Pending', 'Pending') + (p.pending > 1 ? ' ' + p.pending : '') + '</span>';
    if (last) return last.ok ? '<span class="shub-pill p-ok">✓ ' + L('已同步', 'Synced', 'Synced') + '</span>' : '<span class="shub-pill p-err">⚠ ' + L('需處理', 'Check', 'Check') + '</span>';
    return '<span class="shub-pill p-idle">' + L('未檢查', 'Not checked', '—') + '</span>';
  }
  function render() {
    if (!root) return;
    var sel = selected(), last = readJSON(LAST_KEY, {});
    var all = sel.length === MODS.length;
    root.innerHTML =
      '<div class="shub-bar">' +
      '<label class="shub-all"><input type="checkbox" id="shub-all" ' + (all ? 'checked' : '') + (running ? ' disabled' : '') + '> ' + L('全選', 'Select all', 'ជ្រើសទាំងអស់') + '</label>' +
      '<span class="sp"></span>' +
      '<button class="pbtn" id="shub-sel" ' + (running || !sel.length ? 'disabled' : '') + '>☑️ ' + L('更新所選', 'Update selected', 'ធ្វើបច្ចុប្បន្នភាពដែលបានជ្រើស') + ' (' + sel.length + ')</button>' +
      '<button class="pbtn primary" id="shub-run" ' + (running ? 'disabled' : '') + '>' + (running ? '◐ ' + L('同步中…', 'Syncing…', 'Syncing…') : '🔄 ' + L('全部更新', 'Update all', 'ធ្វើបច្ចុប្បន្នភាពទាំងអស់')) + '</button>' +
      '</div><div class="shub-grid">' +
      MODS.map(function (m) {
        var on = sel.indexOf(m.k) >= 0, l = last[m.k];
        var meta = l ? hhmm(l.at) + ' · ' + esc(l.msg || '') : L('尚未更新', 'Not updated yet', '—');
        return '<label class="shub-row' + (on ? ' on' : '') + '" title="' + esc(l && l.msg || '') + '">' +
          '<input type="checkbox" data-k="' + m.k + '" ' + (on ? 'checked' : '') + (running ? ' disabled' : '') + '>' +
          '<span class="shub-ico">' + m.ico + '</span><span class="shub-txt"><div class="shub-n">' + esc(name(m)) + '</div><div class="shub-m">' + meta + '</div></span>' +
          pill(m) + '<a class="shub-open" href="' + m.page + '" onclick="event.stopPropagation()" title="' + esc(L('開啟', 'Open', 'បើក')) + '">↗</a></label>';
      }).join('') +
      '</div><div class="shub-note">' + L('只做「下載雲端新資料＋上傳本機未傳資料」，不會刪除或覆蓋另一邊較多的資料；有衝突時兩邊都保留。',
        'Downloads new cloud data and uploads anything not yet sent — never overwrites the side with more data; conflicts keep both.',
        'ទាញយក និងផ្ទុកឡើងតែទិន្នន័យថ្មី មិនសរសេរជាន់ទេ') + '</div>';
    var allBox = root.querySelector('#shub-all');
    if (allBox) allBox.onchange = function () { writeJSON(SEL_KEY, allBox.checked ? MODS.map(function (m) { return m.k; }) : []); render(); };
    root.querySelectorAll('input[data-k]').forEach(function (b) {
      b.onchange = function () { var s = selected().filter(function (k) { return k !== b.dataset.k; }); if (b.checked) s.push(b.dataset.k); writeJSON(SEL_KEY, MODS.map(function (m) { return m.k; }).filter(function (k) { return s.indexOf(k) >= 0; })); render(); };
    });
    var btn = root.querySelector('#shub-run'); if (btn) btn.onclick = function () { run(MODS.map(function (m) { return m.k; })); };
    var bs = root.querySelector('#shub-sel'); if (bs) bs.onclick = function () { run(selected()); };
  }
  async function mount(anchor) {
    css();
    var host = typeof anchor === 'string' ? document.querySelector(anchor) : anchor; if (!host) return;
    var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'shub-sect';
    root = document.createElement('div'); root.className = 'shub'; root.id = 'ga-sync-hub';
    host.parentNode.insertBefore(sect, host.nextSibling); sect.parentNode.insertBefore(root, sect.nextSibling);
    var title = function () { sect.innerHTML = '☁️ <span>' + L('雲端同步', 'Cloud Sync', 'Cloud Sync') + '</span> · <span>' + L('全部或選擇模組更新', 'update all or selected modules', 'ទាំងអស់ ឬជ្រើស') + '</span>'; };
    title(); render();
    try { if (GA.on) GA.on('lang', function () { title(); render(); }); } catch (_) {}
    pend = await pendingInfo(); render();
    document.addEventListener('visibilitychange', function () { if (!document.hidden && !running) pendingInfo().then(function (p) { pend = p; render(); }); });
  }
  g.GASyncHub = { version: '3.9.32', modules: MODS, mount: mount, run: run, runOne: function (k) { var m = MODS.filter(function (x) { return x.k === k; })[0]; return m ? runOne(m) : Promise.resolve(null); } };
})(window);
