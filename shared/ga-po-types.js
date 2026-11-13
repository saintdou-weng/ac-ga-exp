/* ga-po-types.js — GA Temp PO / ME PO / PROD PO（2026-11-13）
   三種 PO 走同一張表單、同一套核可流程、同一個 Temp_PO 工作表；只多「PO 類別」與「需求人」。
     GA   總務自己要用的臨時採購（辦公室／宿舍／廚房／清潔／保安／車輛）      費用歸總務
     ME   工務請總務代買（機修零件、水電材料、設備保養用品）                  費用歸工務，需求人必填
     PROD 生產請總務代買（產線耗材、工具、輔料）                              費用歸生產，需求人必填
   舊資料沒有類別 → 一律算 GA。記錄頁可分開看，摘要也可分開發。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA) return;
  function LG() { try { return lang; } catch (e) { return GA.lang || 'zh'; } }
  function L(zh, en, km) { var l = LG(); return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  var esc = function (v) { return GA.esc(v == null ? '' : v); };
  var TYPES = {
    GA:   { icon: '🛒', color: '#d97706', bg: '#fffbeb', name: 'GA Temp PO', zh: '總務臨時採購', en: 'GA temporary purchase', km: 'ការទិញបន្ទាន់ GA',
            dzh: '總務自己要用的：辦公室、宿舍、廚房、清潔、保安、車輛。費用算總務。', den: 'Items GA itself needs: office, dormitory, canteen, cleaning, security, vehicles. Charged to GA.', dkm: 'សម្រាប់ GA ប្រើផ្ទាល់៖ ការិយាល័យ អន្តេវាសិកដ្ឋាន ផ្ទះបាយ អនាម័យ សន្តិសុខ។ គិតលើ GA។' },
    ME:   { icon: '⚙️', color: '#2563eb', bg: '#eff6ff', name: 'ME PO', zh: '工務請購', en: 'Maintenance (ME) request', km: 'សំណើផ្នែកជួសជុល ME',
            dzh: '工務請總務代買的：機修零件、水電材料、設備保養用品。費用算工務，要填「需求人」。', den: 'Bought for Maintenance: machine parts, electrical / plumbing materials, upkeep supplies. Charged to ME; Requester is required.', dkm: 'ទិញជូនផ្នែកជួសជុល៖ គ្រឿងបន្លាស់ សម្ភារៈអគ្គិសនី ទឹក។ គិតលើ ME ត្រូវបំពេញអ្នកត្រូវការ។' },
    PROD: { icon: '🏭', color: '#7c3aed', bg: '#f5f3ff', name: 'PROD PO', zh: '生產請購', en: 'Production request', km: 'សំណើផ្នែកផលិតកម្ម',
            dzh: '生產請總務代買的：產線耗材、工具、輔料。費用算生產，要填「需求人」。', den: 'Bought for Production: line consumables, tools, accessories. Charged to Production; Requester is required.', dkm: 'ទិញជូនផ្នែកផលិតកម្ម៖ សម្ភារៈប្រើប្រាស់ ឧបករណ៍។ គិតលើផលិតកម្ម ត្រូវបំពេញអ្នកត្រូវការ។' }
  };
  function norm(v) { v = String(v == null ? '' : v).trim().toUpperCase(); return v === 'ME' ? 'ME' : (v === 'PROD' || v === 'PRODUCTION') ? 'PROD' : 'GA'; }
  function typeOf(row) { return norm(row && row[22]); }
  root.mtPoType = 'GA'; root.mtPoRecType = ''; root.mtPoTypeNorm = norm; root.MT_PO_TYPES = TYPES;

  var css = document.createElement('style');
  css.textContent = '.pt-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}.pt-seg.four{grid-template-columns:repeat(4,1fr)}.pt-b{border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px 8px;text-align:left;cursor:pointer;font:inherit;min-width:0}.pt-b b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-b small{display:block;font-size:11px;color:#64748b;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pt-b.on{border-color:var(--pc);background:var(--pb)}.pt-b.on b{color:var(--pc)}' +
    '.pt-def{border-left:5px solid var(--pc,#d97706);background:var(--pb,#fffbeb);border-radius:8px;padding:8px 11px;font-size:12.5px;line-height:1.5;margin-bottom:10px}.pt-def a{color:#1d4ed8;font-weight:700;cursor:pointer;white-space:nowrap}' +
    '.pt-cmp{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;background:#fff}.pt-cmp th,.pt-cmp td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left;vertical-align:top}.pt-cmp th{background:#f1f5f9}' +
    '.pt-tag{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:800;color:#fff;margin-right:5px;vertical-align:middle}' +
    '@media(min-width:721px){#po-stats:not([style*="none"]),#rep-stats:not([style*="none"]){display:grid!important;grid-template-columns:repeat(5,1fr);gap:8px}}' +
    '@media(max-width:720px){.pt-seg.four{grid-template-columns:repeat(2,1fr)}.pt-b{padding:8px 6px}.pt-b b{font-size:13px}}';
  document.head.appendChild(css);

  /* ── 表單：類別選擇 ── */
  function formSeg() {
    var box = document.getElementById('po-type-box'); if (!box) return;
    var t = TYPES[root.mtPoType];
    box.style.setProperty('--pc', t.color); box.style.setProperty('--pb', t.bg);
    box.innerHTML = '<div class="pt-seg">' + Object.keys(TYPES).map(function (k) { var x = TYPES[k]; return '<button type="button" class="pt-b' + (k === root.mtPoType ? ' on' : '') + '" data-pt="' + k + '" style="--pc:' + x.color + ';--pb:' + x.bg + '"><b>' + x.icon + ' ' + x.name + '</b><small>' + esc(L(x.zh, x.en, x.km)) + '</small></button>'; }).join('') + '</div>' +
      '<div class="pt-def"><b>' + t.icon + ' ' + t.name + '</b> — ' + esc(L(t.dzh, t.den, t.dkm)) + ' <a id="pt-cmp-a">' + esc(L('三種差在哪？', 'How do the three differ?', 'ខុសគ្នាយ៉ាងណា?')) + '</a><div id="pt-cmp" style="display:none">' + compareHtml() + '</div></div>';
    box.querySelectorAll('[data-pt]').forEach(function (b) { b.onclick = function () { setType(b.getAttribute('data-pt')); }; });
    var a = document.getElementById('pt-cmp-a'); if (a) a.onclick = function () { var c = document.getElementById('pt-cmp'); c.style.display = c.style.display === 'none' ? 'block' : 'none'; };
  }
  function compareHtml() {
    var R = [
      [L('誰要用', 'Who needs it', 'អ្នកប្រើ'), L('總務自己', 'GA itself', 'GA ផ្ទាល់'), L('工務', 'Maintenance (ME)', 'ផ្នែកជួសជុល'), L('生產', 'Production', 'ផលិតកម្ម')],
      [L('買什麼', 'Typical items', 'ទំនិញ'), L('辦公、宿舍、廚房、清潔、保安用品', 'Office, dorm, canteen, cleaning, security supplies', 'សម្ភារៈការិយាល័យ អន្តេវាសិកដ្ឋាន'), L('機修零件、水電材料、保養用品', 'Machine parts, electrical / plumbing, upkeep', 'គ្រឿងបន្លាស់ អគ្គិសនី ទឹក'), L('產線耗材、工具、輔料', 'Line consumables, tools, accessories', 'សម្ភារៈផលិតកម្ម ឧបករណ៍')],
      [L('費用算誰', 'Charged to', 'គិតលើ'), 'GA', 'ME', 'Production'],
      [L('需求人', 'Requester', 'អ្នកត្រូវការ'), L('不用填', 'Not needed', 'មិនចាំបាច់'), L('必填（工務誰要的）', 'Required (who in ME)', 'ចាំបាច់'), L('必填（哪條線／誰要的）', 'Required (which line / who)', 'ចាំបាច់')],
      [L('用途欄寫', 'Write in "Using for"', 'សរសេរក្នុង "ប្រើសម្រាប់"'), L('用在哪裡', 'Where it is used', 'ប្រើនៅណា'), L('哪台機器／哪個位置', 'Which machine / location', 'ម៉ាស៊ីន / ទីតាំង'), L('哪條線／哪張單', 'Which line / order', 'ខ្សែ / បញ្ជាទិញ')]
    ];
    return '<table class="pt-cmp"><tr><th></th><th>🛒 GA Temp PO</th><th>⚙️ ME PO</th><th>🏭 PROD PO</th></tr>' + R.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>'; }).join('') +
      '<tr><th>' + esc(L('相同', 'Same for all', 'ដូចគ្នា')) + '</th><td colspan="3">' + esc(L('都由總務填單、一張最多 4 項、送出後發到核可群組由核可人按核可／退件、核可後自動產生報告、都存在同一份 PO 記錄。', 'GA fills in the form, up to 4 items per request, sent to the approval group for Approve / Reject, a report is generated after approval, and all are kept in the same PO records.', 'GA បំពេញ អតិបរមា 4 មុខ ផ្ញើទៅក្រុមអនុម័ត បង្កើតរបាយការណ៍ក្រោយអនុម័ត។')) + '</td></tr></table>';
  }
  function setType(k, keepDept) {
    root.mtPoType = norm(k); var t = TYPES[root.mtPoType], need = root.mtPoType !== 'GA';
    formSeg();
    var rc = document.getElementById('po-requester-cell'); if (rc) rc.style.display = need ? '' : 'none';
    var rl = document.getElementById('po-l-requester'); if (rl) rl.textContent = L('需求人 Requester', 'Requester', 'អ្នកត្រូវការ');
    var rq = document.getElementById('po-requester'); if (rq) rq.placeholder = root.mtPoType === 'ME' ? L('工務誰要的', 'Who in ME asked', 'អ្នកស្នើក្នុង ME') : L('哪條線／誰要的', 'Which line / who asked', 'ខ្សែ / អ្នកស្នើ');
    var dept = document.getElementById('po-dept');
    if (dept && !keepDept) { if (root.mtPoType === 'ME') dept.value = '工務部 ME'; else if (root.mtPoType === 'PROD') dept.value = '生產部 Production'; else if (dept.value === '工務部 ME' || dept.value === '生產部 Production') dept.value = ''; }
    var h2 = document.getElementById('po-h2'); if (h2) h2.textContent = t.name + ' · ' + L('採購品項', 'Purchase items', 'ធាតុទិញ');
    var bl = document.getElementById('po-btn-label'); if (bl) bl.textContent = L('提交 ', 'Submit ', 'ដាក់ស្នើ ') + t.name + L(' 申請', ' request', '');
    var ht = document.getElementById('po-h-title'); if (ht) ht.textContent = t.name + ' · ' + L('上次採購記錄（已核可）', 'last approved purchases', 'ការទិញចុងក្រោយ (អនុម័ត)');
    try { lastQ.po = ''; } catch (e) {}
    var hp = document.getElementById('po-history-panel'); if (hp) hp.classList.remove('show');
    document.body.style.setProperty('--po', t.color);
  }
  root.mtSetPoType = setType;

  /* ── 記錄：類別篩選 ── */
  function recSeg() {
    var box = document.getElementById('porec-type-seg'); if (!box) return;
    var all = (root.currentDataPoAll || currentData.po || []), cnt = { GA: 0, ME: 0, PROD: 0 }, seen = {};
    /* 筆數＝目前期間內（與下方列表同一期間），作廢不算 */
    var tb = document.querySelector('#po-period .ga-pc-t.on'), sel = document.querySelector('#po-period .ga-pc-sel'), pt = tb ? tb.getAttribute('data-type') : '', pk = sel ? sel.value : '';
    all.forEach(function (r) { if (!Array.isArray(r)) return; if (pt && pk && !GA.inPeriod(String(r[0] || '').slice(0, 10), pk, pt)) return; if (mtStatus(r[13]) === '已作廢') return; var k = (String(r[3] || '').trim() || [r[0], r[1], r[2]].join('|')) + '#' + typeOf(r); if (seen[k]) return; seen[k] = 1; cnt[typeOf(r)]++; });
    var total = cnt.GA + cnt.ME + cnt.PROD;
    box.innerHTML = '<div class="pt-seg four"><button type="button" class="pt-b' + (root.mtPoRecType === '' ? ' on' : '') + '" data-pt="" style="--pc:#334155;--pb:#f1f5f9"><b>📊 ' + esc(L('全部 PO', 'All PO', 'PO ទាំងអស់')) + '</b><small>' + total + ' ' + esc(L('筆申請', 'requests', 'សំណើ')) + '</small></button>' +
      Object.keys(TYPES).map(function (k) { var x = TYPES[k]; return '<button type="button" class="pt-b' + (root.mtPoRecType === k ? ' on' : '') + '" data-pt="' + k + '" style="--pc:' + x.color + ';--pb:' + x.bg + '"><b>' + x.icon + ' ' + x.name + '</b><small>' + cnt[k] + ' ' + esc(L('筆申請', 'requests', 'សំណើ')) + '</small></button>'; }).join('') + '</div>';
    box.querySelectorAll('[data-pt]').forEach(function (b) { b.onclick = function () { root.mtPoRecType = b.getAttribute('data-pt'); renderFiltered('po'); }; });
  }
  /* 既有的列表／統計／匯出都讀 currentData.po；類別篩選時暫時換成該類別的資料再呼叫原函式。 */
  function withType(fn) {
    var all = currentData.po || []; root.currentDataPoAll = all;
    if (!root.mtPoRecType) { try { return fn(); } finally { root.currentDataPoAll = null; } }
    currentData.po = all.filter(function (r) { return typeOf(r) === root.mtPoRecType; });
    try { return fn(); } finally { currentData.po = all; root.currentDataPoAll = null; }
  }
  var _rf = root.renderFiltered;
  root.renderFiltered = function (sys) { if (sys !== 'po') return _rf(sys); recSeg(); return withType(function () { return _rf(sys); }); };
  var _rr = root.renderRecords;
  root.renderRecords = function (sys, records) {
    _rr(sys, records); if (sys !== 'po') return;
    var gs = Array.isArray(records) && records.length && records[0] && records[0].rows ? records : null; if (!gs) return;
    var cards = document.querySelectorAll('#po-rec-wrap .mt-request-card');
    gs.forEach(function (g, i) { var c = cards[i]; if (!c) return; var k = typeOf(g.first), t = TYPES[k], ref = c.querySelector('.mt-request-ref'); if (!ref) return;
      var tag = document.createElement('span'); tag.className = 'pt-tag'; tag.style.background = t.color; tag.textContent = t.name; ref.textContent = String(ref.textContent).replace(/^🛒\s*/, ''); ref.insertBefore(tag, ref.firstChild);
      if (g.first[23]) { var body = c.querySelector('.mt-request-body'); if (body) { var d = document.createElement('div'); d.className = 'mt-request-field'; d.innerHTML = '<small>' + esc(L('需求人', 'Requester', 'អ្នកត្រូវការ')) + '</small><b>' + esc(g.first[23]) + '</b>'; body.insertBefore(d, body.children[2] || null); } } });
  };
  var _ex = root.exportExcel;
  root.exportExcel = function (sys) {
    if (sys !== 'po') return _ex(sys);
    /* PO 匯出＝畫面上目前看到的申請（期間／狀態／搜尋／類別），多 PO 類別與需求人兩欄 */
    var data = poExportOrder().filter(Boolean);
    if (!data.length) { showToast(T('noData')); return; }
    var hdrs = ['時間戳記', '申請人', '部門', 'PO號', '品項名稱', '品牌/規格', '尺寸', '數量', '庫存', '用途', '供應商', '項目總額', '備註', '狀態', '核可人', '核可時間', '檢查人', '預估單價', '項目總額', '報告連結', 'PO類別 Type', '需求人 Requester'];
    var ws = XLSX.utils.aoa_to_sheet([hdrs].concat(data.map(function (r) { return r.slice(0, 20).concat([TYPES[typeOf(r)].name, r[23] || '']); })));
    ws['!cols'] = hdrs.map(function (_, i) { return { wch: i === 0 ? 18 : i === 4 || i === 9 ? 24 : 14 }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'PO_Records');
    var fn = 'AC_GA_EXP_' + (root.mtPoRecType ? TYPES[root.mtPoRecType].name.replace(/ /g, '') : 'AllPO') + '_' + GA.ymd(new Date()) + '.xlsx';
    XLSX.writeFile(wb, fn); showToast('✅ ' + fn);
  };
  /* 畫面上目前列出的列（順序相同）：用隱藏的明細表對回原始資料 */
  function poExportOrder() {
    var out = [], wrap = document.querySelectorAll('#po-rec-wrap .mt-request-table tbody tr');
    var rows = currentData.po || [], byRow = {}; rows.forEach(function (r) { byRow[Number(r[21]) || 0] = r; });
    wrap.forEach(function (tr) { var b = tr.querySelector('.mt-edit-btn'), m = b && (b.getAttribute('onclick') || '').match(/,(\d+)\)/); out.push(m ? byRow[Number(m[1])] : null); });
    return out;
  }

  /* ── 編輯視窗：可更正類別／需求人 ── */
  root.mtEditPoField = function (id) { var sys = (document.getElementById('mt-edit-sys') || {}).value; if (sys !== 'po') return undefined; var e = document.getElementById(id); return e ? e.value : undefined; };
  var _oe = root.mtOpenEdit;
  root.mtOpenEdit = function (sys, rowNumber) {
    _oe(sys, rowNumber);
    var w1 = document.getElementById('mt-edit-potype-wrap'), w2 = document.getElementById('mt-edit-requester-wrap'); if (!w1 || !w2) return;
    w1.style.display = w2.style.display = sys === 'po' ? '' : 'none'; if (sys !== 'po') return;
    var row = (root.currentDataPoAll || currentData.po || []).find(function (r) { return Number(r[21]) === Number(rowNumber); }); if (!row) return;
    document.getElementById('mt-edit-potype').value = typeOf(row); document.getElementById('mt-edit-requester').value = row[23] || '';
  };

  /* ── 表單重設 / 語言切換 / 分頁 ── */
  var _reset = root.resetForm;
  root.resetForm = function (sys) { var r = _reset(sys); if (sys === 'po') { var q = document.getElementById('po-requester'); if (q) q.value = ''; setType(root.mtPoType); } return r; };
  var _sl = root.setLang;
  root.setLang = function (l) { var r = _sl.apply(this, arguments); try { setType(root.mtPoType, true); recSeg(); if (root.GAWorks) root.GAWorks.render(); var wl = document.getElementById('tab-works-lbl'); if (wl) wl.textContent = L('工程進度', 'Works Log', 'វឌ្ឍនភាពការងារ'); } catch (e) {} return r; };
  var _sw = root.switchTab;
  root.switchTab = function (t) { _sw(t); if (t === 'works') { document.getElementById('tb-icon').textContent = '🏗'; if (root.GAWorks) root.GAWorks.show(); } if (t === 'po') setType(root.mtPoType, true); };

  /* ── 摘要：維修／全部 PO／GA／ME／PROD／工程進度（最新格式） ── */
  function grp(rows) { var m = {}, o = []; rows.forEach(function (r) { var key = (String(r[3] || '').trim() || [r[0], r[1], r[2]].join('|')) + '#' + (r[22] || ''); if (!m[key]) { m[key] = []; o.push(key); } m[key].push(r); }); return o.map(function (k) { var rs = m[k], s = rs.map(function (r) { return mtStatus(r[13]); }); var st = s.indexOf('已核可') >= 0 ? '已核可' : s.indexOf('已退件') >= 0 ? '已退件' : s.indexOf('已退回') >= 0 ? '已退回' : '待審核'; return { rows: rs, first: rs[0], status: st }; }); }
  function amt(isRep, g) { return g.rows.reduce(function (a, r) { return a + GA.num(isRep ? (r[19] || r[11]) : (r[18] || r[11])); }, 0); }
  function scopeRows(st) {
    var isRep = st.scope === 'rep', src = isRep ? (currentData.rep || []) : (currentData.po || []);
    var rows = src.filter(function (r) { return Array.isArray(r) && GA.inPeriod(String(r[0] || '').slice(0, 10), st.period, st.ptype) && mtStatus(r[13]) !== '已作廢'; });
    if (!isRep && st.scope !== 'po') rows = rows.filter(function (r) { return typeOf(r) === st.scope.toUpperCase(); });
    return rows;
  }
  function sumText(st) {
    if (st.scope === 'works') return root.GAWorks ? root.GAWorks.summaryText(st) : '';
    var TG = GA.telegram, Lg = st.lang || 'both', T = function (zh, en, km) { return TG.label(zh, en, km, Lg); }, isRep = st.scope === 'rep', gs = grp(scopeRows(st));
    var n = function (s) { return gs.filter(function (g) { return g.status === s; }).length; }, total = gs.reduce(function (a, g) { return a + amt(isRep, g); }, 0), rej = n('已退件') + n('已退回');
    var t = isRep ? null : TYPES[st.scope.toUpperCase()], name = isRep ? null : (t ? t.name : 'PO');
    var rows = [{ zh: '申請數', en: 'Requests', km: 'សំណើ', v: gs.length }, { zh: '已核可', en: 'Approved', km: 'បានអនុម័ត', v: n('已核可'), tone: 'ok' }, { zh: '待審', en: 'Pending', km: 'រង់ចាំ', v: n('待審核'), tone: n('待審核') ? 'warn' : 'ok' }, { zh: '已退件', en: 'Rejected', km: 'បានបដិសេធ', v: rej, tone: rej ? 'bad' : '' }];
    if (isRep) { var urg = gs.filter(function (g) { return g.rows.some(function (r) { return /urgent|critical|緊急|重大/i.test(String(r[9] || '')); }); }).length; rows.push({ zh: '緊急', en: 'Urgent', km: 'បន្ទាន់', v: urg, tone: urg ? 'bad' : '' }); }
    rows.push({ zh: '預估總額', en: 'Estimated total', km: 'សរុបប៉ាន់ស្មាន', v: GA.money(total, 2) });
    if (st.scope === 'po') { rows.push('-'); Object.keys(TYPES).forEach(function (k) { var sub = gs.filter(function (g) { return typeOf(g.first) === k; }), a = sub.reduce(function (x, g) { return x + amt(false, g); }, 0); rows.push({ zh: TYPES[k].icon + ' ' + TYPES[k].name + ' · ' + sub.length + ' 筆', en: TYPES[k].icon + ' ' + TYPES[k].name + ' · ' + sub.length, km: TYPES[k].icon + ' ' + TYPES[k].name + ' · ' + sub.length, v: GA.money(a, 2) }); }); }
    gs.slice(0, 10).forEach(function (g, i) {
      var r = g.first, sIcon = g.status === '已核可' ? '🟢' : g.status === '待審核' ? '🟡' : '🔴', items = g.rows.map(function (x) { var q = isRep ? GA.num(x[17] || 1) : x[7]; return (x[4] || '—') + (q && String(q) !== '1' ? ' ×' + q : ''); }).join(' · ');
      rows.push('-');
      rows.push({ head: true, zh: (i + 1) + '. ' + (r[3] || items).toString().slice(0, 40), en: (i + 1) + '. ' + (r[3] || items).toString().slice(0, 40), km: (i + 1) + '. ' + (r[3] || items).toString().slice(0, 40), v: sIcon + ' ' + GA.money(amt(isRep, g), 2) });
      rows.push({ text: true, zh: isRep ? '設備' : '品項', en: isRep ? 'Equipment' : 'Items', km: isRep ? 'ឧបករណ៍' : 'ទំនិញ', v: items });
      rows.push({ text: true, zh: isRep ? '故障' : '用途', en: isRep ? 'Issue' : 'Using for', km: isRep ? 'បញ្ហា' : 'ប្រើសម្រាប់', v: (isRep ? (r[7] || r[8]) : r[9]) || '—' });
      rows.push({ text: true, zh: '申請', en: 'By', km: 'ស្នើដោយ', v: String(r[0] || '').slice(5, 10) + ' · ' + (r[1] || '—') + ' · ' + (r[2] || '—') + (!isRep && st.scope === 'po' ? ' · ' + TYPES[typeOf(r)].name : '') + (!isRep && r[23] ? ' · ' + T('需求人', 'requester', 'អ្នកត្រូវការ') + ' ' + r[23] : '') });
    });
    if (gs.length > 10) rows.push('-', { zh: '其餘未列', en: 'More not listed', km: 'មិនបានរាយ', v: gs.length - 10 });
    return TG.buildSummary({ icon: isRep ? '🔧' : (t ? t.icon : '🛒'), titleZh: isRep ? '維修摘要' : name + ' 摘要', titleEn: isRep ? 'Repair Summary' : name + ' Summary', titleKm: isRep ? 'សង្ខេបការជួសជុល' : 'សង្ខេប ' + name, lang: Lg, period: TG.periodLabel(st.period, st.ptype, Lg), rows: rows, footer: '🕐 ' + GA.ymd(new Date()) + ' · AC-GA-EXP' + (gs.length ? '' : ' · ' + T('本期沒有資料', 'no data in this period', 'គ្មានទិន្នន័យ')) });
  }
  function sumChart(st) {
    if (st.scope === 'works') return root.GAWorks ? root.GAWorks.summaryChart(st) : null;
    var TG = GA.telegram, Lg = st.lang || 'zh', T = function (zh, en, km) { return TG.label(zh, en, km, Lg); }, isRep = st.scope === 'rep', gs = grp(scopeRows(st)); if (!gs.length) return null;
    var n = function (s) { return gs.filter(function (g) { return g.status === s; }).length; }, total = gs.reduce(function (a, g) { return a + amt(isRep, g); }, 0), rej = n('已退件') + n('已退回'), t = isRep ? null : TYPES[st.scope.toUpperCase()], name = isRep ? T('維修', 'Repair', 'ជួសជុល') : (t ? t.name : 'PO');
    var blocks = [{ type: 'stats', items: [{ label: T('申請', 'Requests', 'សំណើ'), value: gs.length }, { label: T('已核可', 'Approved', 'អនុម័ត'), value: n('已核可'), color: '#2e9c6a' }, { label: T('待審', 'Pending', 'រង់ចាំ'), value: n('待審核'), color: '#f2a93b' }, { label: T('已退件', 'Rejected', 'បដិសេធ'), value: rej, color: rej ? '#e35d5b' : '#6c8ea4' }, { label: T('預估總額', 'Est. total', 'សរុប'), value: GA.money(total, 0) }] }];
    if (st.scope === 'po') blocks.push({ type: 'bars', span: 2, title: T('各類 PO 金額', 'Amount by PO type', 'ចំនួនតាមប្រភេទ PO'), items: Object.keys(TYPES).map(function (k) { var sub = gs.filter(function (g) { return typeOf(g.first) === k; }), a = sub.reduce(function (x, g) { return x + amt(false, g); }, 0); return { label: TYPES[k].name + ' (' + sub.length + ')', value: a, color: TYPES[k].color, text: GA.money(a, 0) }; }) });
    var by = {}; gs.forEach(function (g) { var d = String(g.first[2] || '—').replace(/^[㐀-鿿\s]+(?=[A-Za-z])/, Lg === 'zh' ? '$&' : ''); by[d] = (by[d] || 0) + amt(isRep, g); });
    var top = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    if (top.length > 1) blocks.push({ type: 'bars', span: 2, title: T('各部門金額', 'Amount by dept', 'ចំនួនតាមផ្នែក'), items: top.map(function (x) { return { label: x[0], value: x[1], text: GA.money(x[1], 0) }; }) });
    blocks.push({ type: 'table', title: T('申請清單', 'Requests', 'បញ្ជីសំណើ'), head: [T('日期', 'Date', 'ថ្ងៃ'), isRep ? T('設備', 'Equipment', 'ឧបករណ៍') : T('品項', 'Items', 'ទំនិញ'), T('部門', 'Dept', 'ផ្នែក'), T('金額', 'Amount', 'ទឹកប្រាក់'), T('狀態', 'Status', 'ស្ថានភាព')], align: ['l', 'l', 'l', 'r', 'l'], widths: [0.8, 2.6, 1.4, 1.1, 1],
      rows: gs.slice(0, 10).map(function (g) { var r = g.first, c = g.status === '已核可' ? '#2e9c6a' : g.status === '待審核' ? '#c97c2e' : '#e35d5b'; return [String(r[0] || '').slice(5, 10), g.rows.map(function (x) { return x[4]; }).join(' · ').slice(0, 44), String(r[2] || '—'), { text: GA.money(amt(isRep, g), 0), bold: true }, { text: g.status === '已核可' ? T('核可', 'OK', 'អនុម័ត') : g.status === '待審核' ? T('待審', 'Pending', 'រង់ចាំ') : T('退件', 'Rejected', 'បដិសេធ'), color: c, bold: true }]; }) });
    return { title: (isRep ? '🔧 ' : (t ? t.icon : '🛒') + ' ') + name + ' ' + T('摘要', 'Summary', 'សង្ខេប'), subtitle: TG.periodLabel(st.period, st.ptype, Lg).replace(/ \/ /g, ' '), theme: 'navy', blocks: blocks, footer: 'AC-GA-EXP · ' + GA.ymd(new Date()) };
  }
  root.mtTelegram = function () {
    var active = (document.querySelector('.tab.active') || {}).id || '';
    try { GA.setLang(LG()); } catch (e) {}
    var S = { rep: { v: 'rep', zh: '維修', en: 'Repair', km: 'ជួសជុល' }, po: { v: 'po', zh: '全部 PO', en: 'All PO', km: 'PO ទាំងអស់' }, ga: { v: 'ga', zh: 'GA Temp PO', en: 'GA Temp PO', km: 'GA Temp PO' }, me: { v: 'me', zh: 'ME PO', en: 'ME PO', km: 'ME PO' }, prod: { v: 'prod', zh: 'PROD PO', en: 'PROD PO', km: 'PROD PO' }, works: { v: 'works', zh: '工程進度', en: 'Works', km: 'ការងារ' } };
    var first = active === 'tab-works' ? 'works' : (active === 'tab-po' || active === 'tab-porec') ? (root.mtPoRecType ? root.mtPoRecType.toLowerCase() : active === 'tab-po' ? root.mtPoType.toLowerCase() : 'po') : 'rep';
    var order = [first].concat(['rep', 'po', 'ga', 'me', 'prod', 'works'].filter(function (k) { return k !== first; }));
    var lastSt = null;
    GA.telegram.open({ module: 'maintenance', canApprove: false, scopes: order.map(function (k) { return S[k]; }),
      periods: function (type) { return (currentData.rep || []).concat(currentData.po || []).map(function (r) { return GA.periodKey(String(r[0] || '').slice(0, 10), type); }).concat([GA.currentPeriod(type)]); },
      summary: function (st) { lastSt = { scope: st.scope, ptype: st.ptype, period: st.period }; return sumText(st); }, chart: sumChart,
      beforeSend: async function () { if (lastSt && lastSt.scope === 'works' && root.GAWorks && !root.GAWorks.hasData(lastSt)) throw new Error(L('這個期間沒有工程記錄，不發送', 'No works in this period — not sent', 'គ្មានការងារ មិនផ្ញើ')); return true; } });
  };
  root.mtPoSummaryText = sumText; root.mtPoSummaryChart = sumChart;

  /* ── 啟動 ── */
  function init() {
    var p = new URLSearchParams(location.search), f = (p.get('form') || '').toLowerCase(), q = (p.get('po') || '').toLowerCase();
    var want = q === 'me' || f === 'mepo' || f === 'me' ? 'ME' : (q === 'prod' || f === 'prodpo' || f === 'prod') ? 'PROD' : 'GA';
    setType(want, want === 'GA');
    if (f === 'mepo' || f === 'me' || f === 'prodpo' || f === 'prod') root.switchTab('po');
    if (f === 'works' || f === 'work') root.switchTab('works');
    recSeg();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 150); }); else setTimeout(init, 150);
})(window);
