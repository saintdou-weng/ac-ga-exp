/* AC-GA-EXP Smart Import v3.9.33 — platform home: drop Excel files once, each goes to the right module.
 * Detection only decides the destination (the user can change it before importing).  The import itself runs
 * the module's OWN importer inside a hidden frame, so de-duplication, date rules and prompts stay exactly as on
 * the module page; any question the module asks is shown here to the user.  After importing, the module's own
 * auto-sync uploads the new data; the hub waits until the module reports it is synced.
 * A file that was already imported (same content) is flagged and left unticked, so nothing is imported twice.
 */
(function (g) {
  'use strict';
  if (g.GAImportHub) return;
  var DEST = {
    expense: { ico: '💰', page: 'expense.html', key: 'expense', zh: '費用中心（一般費用／採購／維修）', en: 'Expense (general / purchasing / repair)', km: 'ចំណាយ' },
    mobility: { ico: '⛽', page: 'fuel.html', key: '', zh: '柴油／行車／ETC', en: 'Diesel / Transport / ETC', km: 'ប្រេង / ធ្វើដំណើរ / ETC' },
    receiving: { ico: '📦', page: 'receiving.html', key: 'receiving', zh: '收貨／收發（庫存）', en: 'Receiving / Issue (stock)', km: 'ទទួលទំនិញ' },
    damage: { ico: '⚠️', page: 'damage.html', key: 'damage', zh: '損壞／遺失', en: 'Damage / Lost', km: 'ខូច/បាត់' }
  };
  var ORDER = ['expense', 'mobility', 'receiving', 'damage'];
  var LOG_KEY = 'gaexp_import_log_v1', XLSX_SRC = 'shared/xlsx.full.min.js?v=0.18.5-local-20260824';
  var items = [], busy = false, root = null, seq = 0;
  function lang() { return (g.GA && GA.lang) || 'zh'; }
  function L(zh, en, km) { var l = lang(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function readJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function destName(k) { var d = DEST[k]; return d ? L(d.zh, d.en, d.km) : L('（不匯入）', '(skip)', '(skip)'); }
  function when(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function loadXLSX() {
    if (g.XLSX) return Promise.resolve();
    return new Promise(function (resolve, reject) { var s = document.createElement('script'); s.src = XLSX_SRC; s.onload = resolve; s.onerror = function () { reject(new Error('xlsx')); }; document.head.appendChild(s); });
  }
  async function hashOf(buf) {
    try { var d = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(d), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); } catch (_) { return ''; }
  }
  /* destination by file name + sheet names + the first rows' text */
  function classify(name, wb) {
    var n = String(name || '').toLowerCase(), sheets = (wb && wb.SheetNames || []).map(function (s) { return String(s).toLowerCase(); }), txt = '';
    if (wb) wb.SheetNames.slice(0, 4).forEach(function (sn) {
      try { var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true }).slice(0, 12); txt += ' ' + rows.map(function (r) { return r.slice(0, 14).join(' '); }).join(' '); } catch (_) {}
    });
    txt = txt.toLowerCase(); var all = n + ' ' + sheets.join(' ') + ' ' + txt;
    if (sheets.indexOf('ga_data') >= 0) {
      if (/incidentdate|damage|lost/.test(txt)) return 'damage';
      if (/\bcat\b|liters|driver|plate/.test(txt)) return 'mobility';
    }
    /* 1) the file name decides first (a repair workbook has a "Forklift" sheet, a diesel book does not say "repair") */
    if (/diesel|disel|fuel|柴油|transport|行車|vehicle record|\betc\b|toll|通行費/.test(n)) return 'mobility';
    if (/damage|lost item|損壞|遺失/.test(n)) return 'damage';
    if (/inventory control|stock control|收發|收貨|receiving/.test(n)) return 'receiving';
    if (/general expense|expenses?|purchas|repair|maint[ae]?in|維修|採購|費用/.test(n)) return 'expense';
    if (/fork ?lil?ft|generator/.test(n)) return 'mobility';
    /* 2) then the sheets and their first rows */
    if (sheets.indexOf('chart') >= 0 && /inventory|stock|issue|receiv/.test(all)) return 'receiving';
    if (/diesel|disel|liter|litre/.test(txt)) return 'mobility';
    if (/purchas|repair|maintenance|expense/.test(all)) return 'expense';
    return '';
  }
  async function addFiles(fileList) {
    var log = readJSON(LOG_KEY, {});
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i], it = { id: ++seq, file: f, name: f.name, size: f.size, dest: '', on: true, state: 'detect', msg: '' };
      items.push(it); render();
      try {
        if (/\.(pdf|jpe?g|png|heic|webp)$/i.test(f.name)) { it.on = false; it.state = 'later'; it.msg = L('PDF／照片匯入下一階段提供', 'PDF / photo import comes in the next stage', 'PDF/រូបថត ដំណាក់កាលបន្ទាប់'); render(); continue; }
        var buf = await f.arrayBuffer(); it.hash = await hashOf(buf);
        if (/\.json$/i.test(f.name)) { it.dest = /incident|damage/i.test(new TextDecoder().decode(buf.slice(0, 4000))) ? 'damage' : ''; }
        else { await loadXLSX(); var wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true, bookSheets: false }); it.dest = classify(f.name, wb); }
        var prev = it.hash && log[it.hash];
        if (prev) { it.on = false; it.state = 'done-before'; it.msg = L('此檔 ' + when(prev.at) + ' 已匯入過（' + destName(prev.dest) + '）', 'Already imported ' + when(prev.at), 'បាននាំចូលរួច'); if (!it.dest) it.dest = prev.dest; }
        else { it.state = it.dest ? 'ready' : 'pick'; if (!it.dest) { it.on = false; it.msg = L('認不出是哪個模組，請選擇', 'Choose the module', 'ជ្រើសម៉ូឌុល'); } }
      } catch (e) { it.on = false; it.state = 'err'; it.msg = L('讀不到檔案：', 'Cannot read: ', 'អានមិនបាន: ') + (e && e.message || e); }
      render();
    }
  }

  /* ── run a module page in a hidden frame ── */
  function openFrame(dest, it) {
    return new Promise(function (resolve, reject) {
      var f = document.createElement('iframe'), d = DEST[dest];
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px;height:760px;border:0;opacity:0;pointer-events:none';
      var to = setTimeout(function () { reject(new Error(L('模組頁開啟逾時', 'Module page timed out', 'Timeout'))); }, 60000);
      f.onload = function () {
        clearTimeout(to);
        var w = f.contentWindow, tag = '［' + destName(dest) + '］\n';
        /* the module's questions go to the user, its messages are collected for the result line */
        w.confirm = function (m) { return g.confirm(tag + m); };
        w.alert = function (m) { it.notes.push(String(m)); };
        var wrapToast = function (obj, key) { var orig = obj && obj[key]; if (typeof orig !== 'function') return; obj[key] = function (m, type) { try { it.notes.push(String(m)); } catch (_) {} return orig.apply(this, arguments); }; };
        try { wrapToast(w.GA, 'toast'); wrapToast(w, 'toast'); } catch (_) {}
        resolve({ frame: f, win: w });
      };
      f.src = d.page + '?hubImport=1&_t=' + Date.now();
      document.body.appendChild(f);
    });
  }
  async function waitFor(fn, ms, step) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 60000)) { try { if (await fn()) return true; } catch (_) {} await sleep(step || 400); } return false; }
  async function waitSynced(w, key, since) {
    if (!key) return true;
    var result = false;
    await waitFor(function () {
      var a = w.GAAutoSync; if (!a) return false; var st = a.state(key) || {};
      if (!(st.lastRun >= since)) return false;
      if (/^(synced|checked)$/.test(st.state) && !a.pending(key)) { result = true; return true; }
      if (/^(retry|offline|incompatible)$/.test(st.state)) { result = false; return true; } /* failed: the module keeps it pending and retries by itself */
      return false;
    }, 150000, 600);
    return result;
  }
  async function importBatch(dest, list) {
    list.forEach(function (it) { it.state = 'run'; it.msg = L('匯入中…', 'Importing…', 'Importing…'); it.notes = []; }); render();
    var host = { notes: [] }; list.forEach(function (it) { it.notes = host.notes; });
    var fr = await openFrame(dest, host), w = fr.win, res = '', ok = true, t0;
    /* hand the module files that belong to ITS window (Excel readers check "instanceof ArrayBuffer" per window) */
    var files = [];
    for (var fi = 0; fi < list.length; fi++) {
      var src = list[fi].file, ab = await src.arrayBuffer(), u8 = new w.Uint8Array(ab.byteLength); u8.set(new Uint8Array(ab));
      files.push(new w.File([u8], src.name, { type: src.type || '', lastModified: src.lastModified || Date.now() }));
    }
    try {
      if (dest === 'expense') {
        await waitFor(function () { return w.EXP_DATA_READY && w.doExpenseImport; }, 30000); await w.EXP_DATA_READY;
        t0 = Date.now(); var r = await w.doExpenseImport(files);
        ok = !!(r && r.ok !== false);
        res = r ? L('新增 ' + (r.added || 0) + '、更新 ' + (r.updated || 0) + '、相同略過 ' + (r.skipped || 0), 'Added ' + (r.added || 0) + ', updated ' + (r.updated || 0) + ', unchanged ' + (r.skipped || 0), '+' + (r.added || 0)) : '';
        if (ok && ((r.added || 0) + (r.updated || 0))) { if (!(await waitSynced(w, 'expense', t0))) { ok = false; res += ' · ' + L('雲端尚未確認，稍後自動重試', 'cloud not confirmed yet; will retry', 'retry'); } else res += ' · ' + L('已上傳雲端', 'uploaded', 'uploaded'); }
      } else if (dest === 'mobility') {
        await waitFor(function () { return w.processFiles && w.confirmImport && w.fuelFlush; }, 30000);
        await w.processFiles(files);
        await w.confirmImport();
        var ok2 = await w.fuelFlush();
        var al = w.document.querySelector('#importPreview .al-ok');
        res = al ? al.innerText.replace(/\n+/g, ' · ') : L('已處理', 'Done', 'Done');
        if (ok2 === false) { ok = false; res += ' · ' + L('雲端尚未確認，稍後自動重試', 'cloud not confirmed yet; will retry', 'retry'); } else res += ' · ' + L('已上傳雲端', 'uploaded', 'uploaded');
      } else if (dest === 'receiving') {
        await waitFor(function () { return w.importExcel; }, 30000); await sleep(800);
        for (var i = 0; i < files.length; i++) {
          t0 = Date.now(); var n0 = host.notes.length;
          w.importExcel({ files: [files[i]], value: '' });
          await waitFor(function () { return host.notes.length > n0; }, 60000);
        }
        res = host.notes.filter(function (m) { return /✅|完成|匯入|錯誤|import|mapped|error|នាំចូល/i.test(m); }).slice(-1)[0] || '';
        ok = !/錯誤|error/i.test(res);
        if (ok && !(await waitSynced(w, 'receiving', t0))) { ok = false; res += ' · ' + L('雲端尚未確認，稍後自動重試', 'cloud not confirmed yet; will retry', 'retry'); } else if (ok) res += ' · ' + L('已上傳雲端', 'uploaded', 'uploaded');
      } else if (dest === 'damage') {
        await waitFor(function () { return w.importFile; }, 30000); await sleep(800);
        t0 = Date.now();
        for (var j = 0; j < files.length; j++) await w.importFile(files[j]);
        res = host.notes.slice(-1)[0] || L('已處理', 'Done', 'Done');
        ok = !/錯誤|error|無效|invalid/i.test(res);
        if (ok && !(await waitSynced(w, 'damage', t0))) { ok = false; res += ' · ' + L('雲端尚未確認，稍後自動重試', 'cloud not confirmed yet; will retry', 'retry'); } else if (ok) res += ' · ' + L('已上傳雲端', 'uploaded', 'uploaded');
      }
    } catch (e) { ok = false; res = (e && e.message) || String(e); }
    finally { setTimeout(function () { try { fr.frame.remove(); } catch (_) {} }, 500); }
    var log = readJSON(LOG_KEY, {});
    list.forEach(function (it) {
      it.state = ok ? 'ok' : 'err'; it.msg = res; it.on = false;
      if (ok && it.hash) log[it.hash] = { name: it.name, dest: dest, at: Date.now(), result: res };
    });
    var keys = Object.keys(log); if (keys.length > 400) keys.sort(function (a, b) { return log[a].at - log[b].at; }).slice(0, keys.length - 400).forEach(function (k) { delete log[k]; });
    writeJSON(LOG_KEY, log); render();
    return ok;
  }
  async function run() {
    if (busy) return;
    var todo = items.filter(function (it) { return it.on && it.dest && DEST[it.dest]; });
    if (!todo.length) { try { GA.toast(L('沒有勾選要匯入的檔案', 'Nothing ticked to import', 'គ្មានឯកសារ'), 'warn'); } catch (_) {} return; }
    if (!GA.gasUrl || !GA.gasUrl()) { try { GA.toast(L('尚未設定 GAS 網址', 'GAS URL not set', 'GAS URL'), 'err'); } catch (_) {} return; }
    busy = true; render();
    var bad = 0;
    for (var i = 0; i < ORDER.length; i++) {
      var list = todo.filter(function (it) { return it.dest === ORDER[i]; });
      if (list.length && !(await importBatch(ORDER[i], list))) bad++;
    }
    busy = false; render();
    try { GA.toast(bad ? '⚠️ ' + L('匯入完成，有 ' + bad + ' 個模組需處理', 'Done — ' + bad + ' need attention', 'Done') : '✅ ' + L('匯入並上傳完成', 'Imported and uploaded', 'Done'), bad ? 'warn' : 'success'); } catch (_) {}
    if (typeof g.refreshDashboard === 'function') try { g.refreshDashboard(); } catch (_) {}
  }

  /* ── UI ── */
  function css() {
    if (document.getElementById('ga-import-hub-css')) return;
    var s = document.createElement('style'); s.id = 'ga-import-hub-css';
    s.textContent = '.ihub{background:#fff;border:1px solid var(--ga-line);border-radius:14px;padding:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}' +
      '.ihub-drop{border:2px dashed #bae6fd;background:var(--ga-sky-l);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:.15s;color:var(--ga-txt2);font-size:13px}' +
      '.ihub-drop:hover,.ihub-drop.over{border-color:var(--ga-sky);background:#e0f2fe}.ihub-drop b{color:var(--ga-sky);font-size:14px}.ihub-drop small{display:block;color:var(--ga-mut);margin-top:4px;font-size:11px}' +
      '.ihub-list{margin-top:10px;display:flex;flex-direction:column;gap:7px}' +
      '.ihub-row{display:flex;align-items:center;gap:9px;border:1px solid var(--ga-line);border-radius:10px;padding:8px 10px;flex-wrap:wrap}' +
      '.ihub-row input[type=checkbox]{width:18px;height:18px;accent-color:var(--ga-sky);flex:none}' +
      '.ihub-name{flex:1;min-width:160px;font-size:13px;font-weight:700;color:var(--ga-txt);word-break:break-all}.ihub-name small{display:block;font-weight:400;color:var(--ga-mut);font-size:11px}' +
      '.ihub-row select{border:1px solid var(--ga-line);border-radius:8px;padding:7px 8px;font-size:12.5px;min-height:36px;max-width:100%;background:#fff}' +
      '.ihub-msg{flex-basis:100%;font-size:11.5px;color:var(--ga-mut);padding-left:27px}.ihub-msg.ok{color:#047857}.ihub-msg.err{color:#c2410c}.ihub-msg.run{color:#2563eb}' +
      '.ihub-bar{display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}';
    document.head.appendChild(s);
  }
  function render() {
    if (!root) return;
    var html = '<div class="ihub-drop" id="ihub-drop" role="button" tabindex="0"><b>📥 ' + L('把檔案拖進來，或點這裡選檔', 'Drop files here or click to choose', 'ទម្លាក់ឯកសារ ឬចុចជ្រើស') + '</b>' +
      '<small>' + L('Excel 會自動判斷要進哪個模組（可以改），匯入後自動上傳雲端；匯過的檔不會重複匯入。', 'Excel files are routed to the right module (you can change it) and uploaded; files already imported are skipped.', 'Excel នឹងទៅម៉ូឌុលត្រឹមត្រូវ') + '</small></div>' +
      '<input type="file" id="ihub-file" multiple accept=".xlsx,.xls,.xlsb,.csv,.json,.pdf,image/*" style="display:none">';
    if (items.length) {
      html += '<div class="ihub-list">' + items.map(function (it) {
        var dis = busy || it.state === 'later' || it.state === 'detect' || it.state === 'run' ? ' disabled' : '';
        var opts = '<option value="">' + esc(L('（不匯入）', '(skip)', '(skip)')) + '</option>' + ORDER.map(function (k) { return '<option value="' + k + '"' + (it.dest === k ? ' selected' : '') + '>' + DEST[k].ico + ' ' + esc(destName(k)) + '</option>'; }).join('');
        var cls = it.state === 'ok' ? 'ok' : it.state === 'err' || it.state === 'pick' ? 'err' : it.state === 'run' || it.state === 'detect' ? 'run' : '';
        var msg = it.state === 'detect' ? L('判斷中…', 'Checking…', '…') : it.state === 'ok' ? '✓ ' + it.msg : it.state === 'err' ? '⚠ ' + it.msg : it.msg;
        return '<div class="ihub-row"><input type="checkbox" data-i="' + it.id + '"' + (it.on ? ' checked' : '') + dis + '>' +
          '<span class="ihub-name">' + esc(it.name) + '<small>' + kb(it.size) + '</small></span>' +
          '<select data-d="' + it.id + '"' + dis + '>' + opts + '</select>' +
          (msg ? '<div class="ihub-msg ' + cls + '">' + esc(msg) + '</div>' : '') + '</div>';
      }).join('') + '</div><div class="ihub-bar">' +
        '<button class="pbtn" id="ihub-clear"' + (busy ? ' disabled' : '') + '>🧹 ' + L('清除清單', 'Clear list', 'សម្អាត') + '</button>' +
        '<button class="pbtn primary" id="ihub-run"' + (busy ? ' disabled' : '') + '>' + (busy ? '◐ ' + L('匯入中…', 'Importing…', '…') : '⬆️ ' + L('匯入並上傳', 'Import & upload', 'នាំចូល') + ' (' + items.filter(function (it) { return it.on && it.dest; }).length + ')') + '</button></div>';
    }
    root.innerHTML = html;
    var drop = root.querySelector('#ihub-drop'), inp = root.querySelector('#ihub-file');
    drop.onclick = function () { if (!busy) { inp.value = ''; inp.click(); } };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop.onclick(); } };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = function () { drop.classList.remove('over'); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove('over'); if (!busy && e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };
    inp.onchange = function () { if (inp.files.length) addFiles(Array.prototype.slice.call(inp.files)); };
    root.querySelectorAll('input[data-i]').forEach(function (b) { b.onchange = function () { var it = items.filter(function (x) { return x.id === +b.dataset.i; })[0]; if (it) { it.on = b.checked; render(); } }; });
    root.querySelectorAll('select[data-d]').forEach(function (s) { s.onchange = function () { var it = items.filter(function (x) { return x.id === +s.dataset.d; })[0]; if (it) { it.dest = s.value; it.on = !!s.value; if (it.state === 'pick' && s.value) { it.state = 'ready'; it.msg = ''; } render(); } }; });
    var rb = root.querySelector('#ihub-run'); if (rb) rb.onclick = run;
    var cb = root.querySelector('#ihub-clear'); if (cb) cb.onclick = function () { items = []; render(); };
  }
  function mount(anchor) {
    css();
    var host = typeof anchor === 'string' ? document.querySelector(anchor) : anchor; if (!host) return;
    var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'ihub-sect';
    root = document.createElement('div'); root.className = 'ihub'; root.id = 'ga-import-hub';
    host.parentNode.insertBefore(sect, host.nextSibling); sect.parentNode.insertBefore(root, sect.nextSibling);
    var title = function () { sect.innerHTML = '📥 <span>' + L('智慧匯入', 'Smart Import', 'នាំចូលឆ្លាតវៃ') + '</span> · <span>' + L('一個入口，自動分到各模組', 'one place, routed to each module', 'កន្លែងតែមួយ') + '</span>'; };
    title(); render();
    try { if (GA.on) GA.on('lang', function () { title(); render(); }); } catch (_) {}
  }
  g.GAImportHub = { version: '3.9.33', mount: mount, classify: classify, addFiles: addFiles, run: run, items: function () { return items; } };
})(window);
