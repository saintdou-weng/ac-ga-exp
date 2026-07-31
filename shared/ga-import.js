/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP Platform · shared/ga-import.js   v2.0
   智慧匯入 Smart Import
   ─────────────────────────────────────────────────────────────────
   目標：使用者不必先把 Excel 拆成 PO / 收貨 / 維修 / 燃油 / 費用。
        一次丟多個檔、一個活頁簿多張工作表，系統自行分派。

   判定順序：工作表名 → 表頭關鍵字 → 檔名 → 資料特徵
   判不出來 → 進入「欄位配對」畫面請使用者確認，絕不靜默丟棄。

   Excel 日期一律 { cellDates:false, raw:true } + GA.excelDate()，
   不受瀏覽器時區影響。
   ════════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';
var GA = global.GA; if (!GA) { console.error('ga-import.js 需要先載入 ga-core.js'); return; }

var SI = GA.smartImport = {};

/* ═══════════ 1. 類型定義 ═══════════ */
/* 每個 type：關鍵字（工作表名／檔名）、必要表頭、canonical 轉換 */
var TYPES = {
  po: {
    module: 'procurement', icon: '📋',
    label: { zh: '月度採購 PO', en: 'Monthly PO', km: 'ការទិញប្រចាំខែ' },
    nameHints: ['po', 'purchase', 'ga po', '採購', '請購', 'order'],
    headHints: [['item', '品項', '品名', 'description'], ['qty', '數量', 'quantity']],
    negHints: ['repair', '維修', 'diesel', 'fuel', '柴油'],
    approval: true
  },
  temppo: {
    module: 'maintenance', icon: '🛒',
    label: { zh: '臨時採購 Temp PO', en: 'Temp PO', km: 'ការទិញបន្ទាន់' },
    nameHints: ['temp', 'temppo', 'temp po', '臨時', '臨採', 'urgent purchase'],
    headHints: [['item', '品項', '品名'], ['qty', '數量']],
    approval: true
  },
  repair: {
    module: 'maintenance', icon: '🔧',
    label: { zh: '維修申請 Repair', en: 'Repair Request', km: 'ស្នើសុំជួសជុល' },
    nameHints: ['repair', '維修', '報修', 'maintenance', 'fix'],
    headHints: [['issue', '故障', '問題', 'problem', 'fault'], ['location', '地點', '位置', 'room']],
    approval: true
  },
  receiving: {
    module: 'receiving', icon: '📦',
    label: { zh: '收貨／領用', en: 'Receiving / Issue', km: 'ទទួល / ចេញ' },
    nameHints: ['receive', 'receiving', 'issue', '收貨', '領用', '入庫', '出庫', 'stock', 'balance'],
    headHints: [['item', '品項', '品名'], ['receive', 'issue', '收', '領', 'in', 'out', 'balance', '結存']],
    approval: false
  },
  inventory: {
    module: 'procurement', icon: '🗃️',
    label: { zh: '品項／庫存', en: 'Item / Inventory', km: 'ទំនិញ / ស្តុក' },
    nameHints: ['inventory', 'item list', '品項', '庫存', 'master', 'stock list'],
    headHints: [['item', '品項', '品名'], ['unit', '單位', 'safety', '安全庫存', 'category', '分類']],
    approval: false
  },
  fuel_driver: {
    module: 'fuel', icon: '🚗',
    label: { zh: '司機柴油', en: 'Driver Diesel', km: 'សាំងអ្នកបើកបរ' },
    nameHints: ['driver', '司機', 'car', 'vehicle', '車輛'],
    headHints: [['km', 'kilometer', '公里'], ['liter', 'litre', 'diesel', '升', '公升']],
    approval: false, wide: true
  },
  fuel_forklift: {
    module: 'fuel', icon: '🏗️',
    label: { zh: '叉車柴油', en: 'Forklift Diesel', km: 'សាំងឡានស្ទូច' },
    nameHints: ['forklift', '叉車', 'fork lift'],
    headHints: [['hour', '時數', '小時'], ['liter', 'diesel', '升']],
    approval: false, wide: true
  },
  fuel_generator: {
    module: 'fuel', icon: '⚡',
    label: { zh: '發電機柴油', en: 'Generator Diesel', km: 'សាំងម៉ាស៊ីនភ្លើង' },
    nameHints: ['generator', '發電機', 'genset'],
    headHints: [['hour', '時數'], ['liter', 'diesel', '升']],
    approval: false, wide: true
  },
  expense: {
    module: 'expense', icon: '💰',
    label: { zh: '費用 Expense', en: 'Expense', km: 'ចំណាយ' },
    nameHints: ['expense', '費用', 'cost', '支出', 'budget', '預算'],
    headHints: [['amount', '金額', 'cost', '費用'], ['category', '類別', '分類', 'date', '日期']],
    approval: false
  }
};
SI.TYPES = TYPES;
SI.typeLabel = function (t) {
  var d = TYPES[t]; if (!d) return t;
  return (d.label[GA.lang] || d.label.zh);
};

/* ═══════════ 2. 自訂解析器登錄 ═══════════
   模組可覆寫特定 type 的解析（例如 fuel 的寬表多工作表格式）：
     GA.smartImport.register('fuel_driver', {
       detect: function(ctx){ return 0.9 },          // 選填，回信心值
       parse:  function(ctx){ return [ ...records ] }
     });                                                            */
var CUSTOM = {};
SI.register = function (type, handler) { CUSTOM[type] = handler; };

/* ═══════════ 3. 表頭偵測 ═══════════ */
function norm(v) {
  return String(v === null || v === undefined ? '' : v).trim().toLowerCase()
    .replace(/[\s_\-\.\/()（）]/g, '');
}
/* 找出最像表頭的那一列（前 15 列中，非空字串最多且不含大量數字者） */
function findHeaderRow(rows) {
  var best = -1, bestScore = 0;
  for (var i = 0; i < Math.min(15, rows.length); i++) {
    var r = rows[i] || [];
    var txt = 0, num = 0;
    for (var j = 0; j < r.length; j++) {
      var c = r[j];
      if (c === null || c === undefined || c === '') continue;
      if (typeof c === 'number') num++; else txt++;
    }
    var score = txt - num * 0.5;
    if (txt >= 2 && score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
function headerCells(rows, hi) {
  if (hi < 0) return [];
  return (rows[hi] || []).map(norm);
}

/* ═══════════ 4. 類型判定 ═══════════ */
SI.detect = function (ctx) {
  // ctx = {fileName, sheetName, rows, headerRow, headers}
  var scores = {}, reasons = {};
  var sn = norm(ctx.sheetName), fn = norm(ctx.fileName);
  var heads = ctx.headers || [];
  var headStr = heads.join('|');

  Object.keys(TYPES).forEach(function (t) {
    var d = TYPES[t], s = 0, why = [];

    (d.nameHints || []).forEach(function (h) {
      var nh = norm(h);
      if (nh && sn.indexOf(nh) >= 0) { s += 3; why.push('工作表名含「' + h + '」'); }
      else if (nh && fn.indexOf(nh) >= 0) { s += 2; why.push('檔名含「' + h + '」'); }
    });
    (d.negHints || []).forEach(function (h) {
      var nh = norm(h);
      if (nh && (sn.indexOf(nh) >= 0 || fn.indexOf(nh) >= 0)) { s -= 3; }
    });
    (d.headHints || []).forEach(function (grp) {
      var hit = grp.some(function (h) { return headStr.indexOf(norm(h)) >= 0; });
      if (hit) { s += 2; why.push('表頭含「' + grp[0] + '」'); }
    });

    if (CUSTOM[t] && CUSTOM[t].detect) {
      try {
        var cs = CUSTOM[t].detect(ctx);
        if (cs > 0) { s += cs * 5; why.push('模組解析器辨識'); }
      } catch (e) {}
    }
    scores[t] = s; reasons[t] = why;
  });

  var best = null, bestS = 0;
  Object.keys(scores).forEach(function (t) { if (scores[t] > bestS) { bestS = scores[t]; best = t; } });

  // 月份工作表（Jan/Feb…）常見於燃油與費用寬表，額外提示
  var isMonthSheet = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(String(ctx.sheetName).trim());

  return {
    type: bestS >= 3 ? best : null,
    module: bestS >= 3 ? TYPES[best].module : null,
    confidence: Math.min(1, bestS / 8),
    score: bestS,
    reason: bestS >= 3 ? (reasons[best] || []).join('、') : '無法判定，需人工配對',
    isMonthSheet: isMonthSheet,
    candidates: Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; }).slice(0, 4)
  };
};

/* ═══════════ 5. 通用長表解析（一列一筆）═══════════ */
var FIELD_ALIASES = {
  date:      ['date', '日期', 'day', 'transactiondate', '交易日期', 'docdate'],
  item:      ['item', 'itemname', '品項', '品名', 'description', 'desc', 'material', '物料', 'product'],
  qty:       ['qty', 'quantity', '數量', 'pcs', 'amountqty'],
  unit:      ['unit', '單位', 'uom'],
  price:     ['price', 'unitprice', '單價', 'cost'],
  amount:    ['amount', '金額', 'total', 'totalamount', '合計', 'subtotal', 'value'],
  dept:      ['dept', 'department', '部門', '需求部門', 'section'],
  applicant: ['applicant', '申請人', 'requester', 'requestedby', 'by', 'name', 'staff'],
  supplier:  ['supplier', '供應商', 'vendor', 'shop'],
  remarks:   ['remark', 'remarks', '備註', 'note', 'notes', 'comment'],
  status:    ['status', '狀態', 'state'],
  poNo:      ['pono', 'po', 'ponumber', 'po號', '採購單號', 'ordernumber', 'docno'],
  repairNo:  ['repairno', '維修號', 'repairnumber', 'jobno', 'workorder'],
  location:  ['location', '地點', '位置', 'room', 'area', 'place', 'site'],
  issue:     ['issue', '故障', '故障描述', 'problem', 'fault', 'symptom', 'description'],
  action:    ['action', '處理', '處理方式', 'solution', 'remedy'],
  urgency:   ['urgency', '緊急', '緊急程度', 'priority'],
  category:  ['category', '類別', '分類', 'type', 'group'],
  liters:    ['liter', 'litre', 'liters', 'litres', '升', '公升', 'diesel', 'disel', 'fuel'],
  km:        ['km', 'kilometer', 'kilometre', '公里', 'mileage', 'odometer'],
  hours:     ['hour', 'hours', '時數', '小時', 'runhour', 'meter'],
  plate:     ['plate', '車牌', 'platno', 'vehicleno', 'carno', 'number'],
  driver:    ['driver', '司機', 'operator'],
  type:      ['type', '類型', 'kind', 'inout', '收發']
};
function mapHeaders(headers) {
  var map = {};
  headers.forEach(function (h, i) {
    if (!h) return;
    Object.keys(FIELD_ALIASES).forEach(function (f) {
      if (map[f] !== undefined) return;
      if (FIELD_ALIASES[f].some(function (a) { return h === norm(a); })) map[f] = i;
    });
  });
  // 第二輪：部分包含
  headers.forEach(function (h, i) {
    if (!h) return;
    Object.keys(FIELD_ALIASES).forEach(function (f) {
      if (map[f] !== undefined) return;
      if (FIELD_ALIASES[f].some(function (a) { var n = norm(a); return n.length > 2 && h.indexOf(n) >= 0; })) map[f] = i;
    });
  });
  return map;
}
SI.mapHeaders = mapHeaders;

/* 略過列：空列、合計列、簽核列 */
function isSkipRow(cells) {
  var joined = cells.map(norm).join('');
  if (!joined) return 'empty';
  if (/^(total|合計|總計|小計|subtotal|grandtotal|sum)/.test(joined)) return 'total';
  if (/(prepared|checked|approved|signature|簽核|核准|製表|審核)by?$/.test(joined) && cells.filter(function (c) { return c !== '' && c !== null; }).length <= 3) return 'sign';
  return null;
}

SI.parseLong = function (ctx, type) {
  var rows = ctx.rows, hi = ctx.headerRow;
  if (hi < 0) return { records: [], skipped: [{ reason: 'no-header', n: rows.length }] };
  var map = mapHeaders(ctx.headers);
  var out = [], skip = { empty: 0, total: 0, sign: 0, noDate: 0, noKey: 0 }, errs = [];

  for (var i = hi + 1; i < rows.length; i++) {
    var r = rows[i] || [];
    var sk = isSkipRow(r);
    if (sk) { skip[sk]++; continue; }

    var rec = { _row: i + 1 };
    Object.keys(map).forEach(function (f) {
      var v = r[map[f]];
      if (v === undefined || v === null || v === '') return;
      if (f === 'date') rec.date = GA.excelDate(v);
      else if (['qty', 'price', 'amount', 'liters', 'km', 'hours'].indexOf(f) >= 0) rec[f] = GA.num(v);
      else rec[f] = String(v).trim();
    });

    // 公式殘留（SheetJS raw 讀到 formula 物件）
    if (rec.item && /^=/.test(rec.item)) { errs.push({ row: i + 1, msg: '公式未計算' }); continue; }

    var keyField = (type === 'repair') ? (rec.item || rec.issue)
                 : (type === 'expense') ? (rec.category || rec.item)
                 : rec.item;
    if (!keyField) { skip.noKey++; continue; }
    if (!rec.date && TYPES[type] && !TYPES[type].wide) {
      // 日期缺漏不丟棄，標記待確認
      rec._warn = 'no-date';
      skip.noDate++;
    }
    out.push(rec);
  }
  return { records: out, skip: skip, errors: errs, map: map };
};

/* ═══════════ 6. 去重指紋 ═══════════ */
SI.fingerprintOf = function (type, r) {
  switch (type) {
    case 'po':
      return r.poNo ? GA.fingerprint(['po', r.poNo, r.item, r.qty])
                    : GA.fingerprint(['po', r.applicant, r.dept, r.date, r.item, r.qty]);
    case 'temppo':
      return r.poNo ? GA.fingerprint(['tpo', r.poNo, r.item, r.qty])
                    : GA.fingerprint(['tpo', r.applicant, r.dept, r.date, r.item, r.qty]);
    case 'repair':
      return r.repairNo ? GA.fingerprint(['rep', r.repairNo, r.item])
                        : GA.fingerprint(['rep', r.date, r.applicant, r.dept, r.item, r.location, r.issue]);
    case 'receiving':
      return GA.fingerprint(['recv', r.date, r.type, r.item, r.qty, r.dept, r.applicant, r._row]);
    case 'fuel_driver':
    case 'fuel_forklift':
    case 'fuel_generator':
      return GA.fingerprint(['fuel', r.cat || type, r.date, r.plate || r.driver || r.unit, r.liters, r.km || r.hours, r._row]);
    case 'expense':
      return GA.fingerprint(['exp', r.sourceModule || 'manual', r.sourceRecordId || '', r.date, r.category, r.amount]);
    default:
      return GA.fingerprint([type, r.date, r.item, r.qty, r.amount, r._row]);
  }
};

/* ═══════════ 7. 讀檔 ═══════════ */
SI.readFile = function (file) {
  return new Promise(function (resolve, reject) {
    var rd = new FileReader();
    rd.onerror = function () { reject(new Error('讀取失敗：' + file.name)); };
    rd.onload = function (e) {
      try {
        if (typeof XLSX === 'undefined') throw new Error('SheetJS 未載入，無法解析 Excel');
        var wb = XLSX.read(new Uint8Array(e.target.result), {
          type: 'array', cellDates: false, raw: true      // 日期不受時區影響
        });
        resolve(wb);
      } catch (err) { reject(err); }
    };
    rd.readAsArrayBuffer(file);
  });
};

/* ═══════════ 8. 掃描（不寫入，只產生預覽）═══════════ */
SI.scan = function (files) {
  var batchId = GA.uid('imp');
  var jobs = Array.prototype.slice.call(files).map(function (f) {
    return SI.readFile(f).then(function (wb) {
      return wb.SheetNames.map(function (sn) {
        var ws = wb.Sheets[sn];
        if (!ws || !ws['!ref']) return null;
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        if (!rows.length) return null;
        var hi = findHeaderRow(rows);
        var ctx = {
          fileName: f.name, sheetName: sn, rows: rows,
          headerRow: hi, headers: headerCells(rows, hi), workbook: wb
        };
        var det = SI.detect(ctx);
        var parsed = { records: [], skip: {}, errors: [] };
        if (det.type) {
          try {
            parsed = (CUSTOM[det.type] && CUSTOM[det.type].parse)
              ? { records: CUSTOM[det.type].parse(ctx) || [], skip: {}, errors: [] }
              : SI.parseLong(ctx, det.type);
          } catch (err) {
            parsed = { records: [], skip: {}, errors: [{ row: '-', msg: err.message }] };
          }
        }
        (parsed.records || []).forEach(function (r) {
          r._fp = SI.fingerprintOf(det.type, r);
          GA.stamp(r, {
            source: 'excel', sourceFile: f.name, sourceSheet: sn,
            sourceRow: r._row, importBatchId: batchId,
            prefix: det.type || 'rec'
          });
          if (!r.status) r.status = 'draft';       // 匯入預設草稿，絕不自動核可
        });
        return {
          file: f.name, sheet: sn, detect: det,
          totalRows: rows.length,
          headerRow: hi,
          headers: ctx.headers,
          records: parsed.records || [],
          skip: parsed.skip || {}, errors: parsed.errors || [],
          rawCtx: ctx
        };
      }).filter(Boolean);
    }).catch(function (err) {
      return [{ file: f.name, sheet: '-', detect: { type: null, reason: err.message },
                totalRows: 0, records: [], skip: {}, errors: [{ row: '-', msg: err.message }] }];
    });
  });

  return Promise.all(jobs).then(function (arrs) {
    var sheets = [].concat.apply([], arrs);
    return { batchId: batchId, sheets: sheets };
  });
};

/* ═══════════ 9. 與現有資料比對（新增／更新／重複）═══════════
   existingFn(type) 需回傳該 type 目前已有的 records（含 _fp 或可重算） */
SI.diff = function (sheets, existingFn) {
  var seen = {};
  sheets.forEach(function (sh) {
    var t = sh.detect.type;
    var exist = (existingFn && t) ? (existingFn(t) || []) : [];
    var idx = {};
    exist.forEach(function (r) {
      var fp = r._fp || SI.fingerprintOf(t, r);
      idx[fp] = r;
    });
    sh.stat = { add: 0, update: 0, dup: 0, warn: 0 };
    sh.records.forEach(function (r) {
      if (seen[r._fp]) { r._act = 'dup'; sh.stat.dup++; return; }
      seen[r._fp] = 1;
      var old = idx[r._fp];
      if (!old) { r._act = 'add'; sh.stat.add++; }
      else if (JSON.stringify(stripMeta(old)) === JSON.stringify(stripMeta(r))) { r._act = 'dup'; sh.stat.dup++; }
      else { r._act = 'update'; r._oldId = old.recordId; sh.stat.update++; }
      if (r._warn) sh.stat.warn++;
    });
  });
  return sheets;
};
function stripMeta(r) {
  var o = {};
  Object.keys(r).forEach(function (k) {
    if (k.charAt(0) === '_' || ['recordId', 'createdAt', 'updatedAt', 'version', 'importBatchId', 'sourceRow', 'sourceFile', 'sourceSheet', 'source'].indexOf(k) >= 0) return;
    o[k] = r[k];
  });
  return o;
}

/* ═══════════ 10. 匯入預覽 UI ═══════════ */
SI.openModal = function (opt) {
  opt = opt || {};
  var ov = document.createElement('div');
  ov.className = 'ga-ov on';
  ov.innerHTML =
    '<div class="ga-modal" style="max-width:860px">' +
      '<div class="ga-modal-h">' +
        '<b>📥 ' + GA.T('imp') + ' Smart Import</b>' +
        '<button class="ga-x" data-close>&times;</button>' +
      '</div>' +
      '<div class="ga-modal-b" id="si-body">' +
        '<div class="ga-dz" id="si-dz">' +
          '<input type="file" id="si-file" multiple accept=".xlsx,.xls,.xlsm,.csv">' +
          '<div class="ga-dz-i">📄</div>' +
          '<div class="ga-dz-t">' +
            (GA.lang === 'zh' ? '拖放或點選：可一次選多個檔案<br><small>xlsx / xls / xlsm / csv — 不必先分成 PO、維修、燃油、費用</small>'
             : GA.lang === 'km' ? 'អូសទម្លាក់ ឬចុចដើម្បីជ្រើសរើសឯកសារច្រើន<br><small>xlsx / xls / xlsm / csv</small>'
             : 'Drag & drop or click — select multiple files at once<br><small>xlsx / xls / xlsm / csv — no need to split by type first</small>') +
          '</div>' +
        '</div>' +
        '<div id="si-result"></div>' +
      '</div>' +
      '<div class="ga-modal-f">' +
        '<button class="ga-btn" data-close>' + GA.T('cancel') + '</button>' +
        '<button class="ga-btn" id="si-draft" disabled>📝 ' +
          (GA.lang === 'zh' ? '匯入為草稿' : GA.lang === 'km' ? 'នាំចូលជាព្រាង' : 'Import as draft') + '</button>' +
        (opt.allowSubmit ? '<button class="ga-btn primary" id="si-submit" disabled>📨 ' +
          (GA.lang === 'zh' ? '匯入並送核可' : GA.lang === 'km' ? 'នាំចូល និងដាក់ស្នើ' : 'Import & submit') + '</button>' : '') +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  var scanned = null;

  function close() { ov.remove(); }
  ov.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
  ov.onclick = function (e) { if (e.target === ov) close(); };

  var dz = ov.querySelector('#si-dz');
  var fi = ov.querySelector('#si-file');
  dz.onclick = function (e) { if (e.target !== fi) fi.click(); };
  dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = function () { dz.classList.remove('over'); };
  dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('over'); handle(e.dataTransfer.files); };
  fi.onchange = function () { handle(fi.files); };

  function handle(files) {
    if (!files || !files.length) return;
    var res = ov.querySelector('#si-result');
    res.innerHTML = '<div class="ga-si-load">⏳ ' + GA.T('loading') + '</div>';
    SI.scan(files)
      .then(function (r) {
        scanned = SI.diff(r.sheets, opt.existing) && r;
        render(res, r);
      })
      .catch(function (e) {
        res.innerHTML = '<div class="ga-si-err">❌ ' + GA.esc(e.message) + '</div>';
      });
  }

  function render(res, r) {
    var known = r.sheets.filter(function (s) { return s.detect.type; });
    var unknown = r.sheets.filter(function (s) { return !s.detect.type; });
    var totalRec = known.reduce(function (a, s) { return a + s.records.length; }, 0);

    res.innerHTML =
      '<div class="ga-si-sum">' +
        '<span>📄 ' + r.sheets.length + ' ' + (GA.lang === 'zh' ? '張工作表' : 'sheets') + '</span>' +
        '<span>✅ ' + known.length + ' ' + (GA.lang === 'zh' ? '已辨識' : 'detected') + '</span>' +
        '<span>❓ ' + unknown.length + ' ' + (GA.lang === 'zh' ? '待配對' : 'need mapping') + '</span>' +
        '<span>📊 ' + totalRec + ' ' + GA.T('records') + '</span>' +
      '</div>' +
      r.sheets.map(function (s, si) {
        var d = s.detect;
        var st = s.stat || { add: 0, update: 0, dup: 0, warn: 0 };
        return '<div class="ga-si-card' + (d.type ? '' : ' unk') + '">' +
          '<div class="ga-si-hd">' +
            '<b>' + (d.type ? TYPES[d.type].icon + ' ' + SI.typeLabel(d.type) : '❓ ' + (GA.lang === 'zh' ? '無法判定' : 'Unknown')) + '</b>' +
            '<span class="ga-si-src">' + GA.esc(s.file) + ' › ' + GA.esc(s.sheet) + '</span>' +
          '</div>' +
          '<div class="ga-si-why">' + (GA.lang === 'zh' ? '判定理由：' : 'Reason: ') + GA.esc(d.reason || '-') +
            (d.confidence ? '　(' + Math.round(d.confidence * 100) + '%)' : '') + '</div>' +
          (d.type
            ? '<div class="ga-si-stat">' +
                '<span class="add">+' + st.add + ' ' + (GA.lang === 'zh' ? '新增' : 'add') + '</span>' +
                '<span class="upd">↻' + st.update + ' ' + (GA.lang === 'zh' ? '更新' : 'update') + '</span>' +
                '<span class="dup">=' + st.dup + ' ' + (GA.lang === 'zh' ? '重複' : 'dup') + '</span>' +
                (st.warn ? '<span class="warn">⚠' + st.warn + ' ' + (GA.lang === 'zh' ? '待確認' : 'check') + '</span>' : '') +
                (s.errors.length ? '<span class="err">✕' + s.errors.length + ' ' + (GA.lang === 'zh' ? '錯誤' : 'error') + '</span>' : '') +
                '<span class="tot">' + (GA.lang === 'zh' ? '總列數 ' : 'rows ') + s.totalRows + '</span>' +
              '</div>' +
              preview(s)
            : '<div class="ga-si-map">' +
                '<label>' + (GA.lang === 'zh' ? '請指定類型：' : 'Assign type: ') + '</label>' +
                '<select data-si="' + si + '">' +
                  '<option value="">— ' + (GA.lang === 'zh' ? '略過此表' : 'skip') + ' —</option>' +
                  Object.keys(TYPES).map(function (t) {
                    return '<option value="' + t + '">' + TYPES[t].icon + ' ' + SI.typeLabel(t) + '</option>';
                  }).join('') +
                '</select>' +
                '<div class="ga-si-heads">' + (GA.lang === 'zh' ? '偵測表頭：' : 'Headers: ') +
                  GA.esc((s.headers || []).filter(Boolean).slice(0, 12).join(', ') || '(none)') + '</div>' +
              '</div>') +
        '</div>';
      }).join('');

    res.querySelectorAll('[data-si]').forEach(function (sel) {
      sel.onchange = function () {
        var s = r.sheets[+sel.getAttribute('data-si')];
        if (!this.value) { s.detect.type = null; return; }
        s.detect.type = this.value;
        s.detect.module = TYPES[this.value].module;
        s.detect.reason = GA.lang === 'zh' ? '使用者指定' : 'user assigned';
        try {
          var p = (CUSTOM[this.value] && CUSTOM[this.value].parse)
            ? { records: CUSTOM[this.value].parse(s.rawCtx) || [] }
            : SI.parseLong(s.rawCtx, this.value);
          s.records = p.records;
          s.skip = p.skip || {}; s.errors = p.errors || [];
          s.records.forEach(function (rr) {
            rr._fp = SI.fingerprintOf(s.detect.type, rr);
            GA.stamp(rr, { source: 'excel', sourceFile: s.file, sourceSheet: s.sheet,
                           sourceRow: rr._row, importBatchId: r.batchId, prefix: s.detect.type });
            if (!rr.status) rr.status = 'draft';
          });
          SI.diff([s], opt.existing);
        } catch (e) { s.errors = [{ row: '-', msg: e.message }]; }
        render(res, r);
      };
    });

    var any = r.sheets.some(function (s) { return s.detect.type && s.records.length; });
    var bd = ov.querySelector('#si-draft'), bs = ov.querySelector('#si-submit');
    if (bd) { bd.disabled = !any; bd.onclick = function () { finish('draft'); }; }
    if (bs) { bs.disabled = !any; bs.onclick = function () { finish('submitted'); }; }
  }

  function preview(s) {
    var rs = s.records.slice(0, 10);
    if (!rs.length) return '<div class="ga-si-none">' + GA.T('noData') + '</div>';
    var cols = Object.keys(rs[0]).filter(function (k) { return k.charAt(0) !== '_' && ['recordId', 'source', 'sourceFile', 'sourceSheet', 'sourceRow', 'importBatchId', 'createdAt', 'updatedAt', 'version'].indexOf(k) < 0; }).slice(0, 8);
    return '<details class="ga-si-pv"><summary>' + GA.T('preview') + ' (' + Math.min(10, s.records.length) + '/' + s.records.length + ')</summary>' +
      '<div class="ga-tbl-scroll"><table class="ga-tbl sm"><thead><tr><th>#</th>' +
      cols.map(function (c) { return '<th>' + GA.esc(c) + '</th>'; }).join('') + '<th>' + GA.T('status') + '</th></tr></thead><tbody>' +
      rs.map(function (r) {
        return '<tr><td>' + (r._row || '') + '</td>' +
          cols.map(function (c) { return '<td>' + GA.esc(r[c] === undefined ? '' : r[c]) + '</td>'; }).join('') +
          '<td>' + (r._act === 'add' ? '➕' : r._act === 'update' ? '↻' : '=') + (r._warn ? ' ⚠' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function finish(mode) {
    if (!scanned) return;
    var payload = {};
    scanned.sheets.forEach(function (s) {
      if (!s.detect.type) return;
      var keep = s.records.filter(function (r) { return r._act !== 'dup'; });
      if (!keep.length) return;
      keep.forEach(function (r) { r.status = mode === 'submitted' ? 'submitted' : 'draft'; });
      (payload[s.detect.type] = payload[s.detect.type] || []).push.apply(payload[s.detect.type], keep);
    });
    close();
    if (opt.onImport) opt.onImport(payload, { batchId: scanned.batchId, mode: mode, sheets: scanned.sheets });
  }

  return { close: close };
};

})(window);
