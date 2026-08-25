/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP · shared/ga-vrt-parsers.js   v1.1
   VRT 真實 Excel 格式專用解析器
   ─────────────────────────────────────────────────────────────────
   針對 Paul 實際在用的檔案格式，這些格式通用解析器讀不到：

   1. VRT General Expense 2026.xlsx / VRT_General_Expense_2026.xlsb
      · 「月份分頁(Jan/Feb/Mar)」+「類別分頁(Electric/Water/Security...)」
      · 類別分頁為寬表：一列一個月，欄位 Old/New/Consum/Unit price/Amount
      · 同一分頁左右並排多區塊（Factory / Expat staff house）

   2. VRT_Purchasing_Record_2026.xlsb › 'purchase '
      · 表頭在第 2 列（不是第 1 列），日期為 Excel serial
      · 欄位：Received Date | Desc | Brand | Size/spec | Q'ty | unit |
              Supplier | UP | TTL | Stock | last time | Remark

   3. VRT_other_repair-_expenses_2026_New2.xlsx › 'expenses'
      · 表頭在第 2 列，欄位：Date | Desc./Item | Brand | Spec. | Q'ty |
        Unit | Unit price | Total | Suppliers | Purpose

   4. VRT_Repair-Maintainance_*.xlsb › 'Forklift'
      · 左右並排兩台堆高機（#1 在 B~I 欄、#2 在 K~N 欄）
      · 月份只寫在該月第一列，後續列留空需向下填滿

   .xlsx 與 .xlsb 均已依 VRT General Expense 2026 實檔驗證；分類頁會依實際格式分流。
   ════════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';
var GA = global.GA; if (!GA) { console.error('ga-vrt-parsers.js 需先載入 ga-core.js'); return; }

var EXPENSE_PARSER_VERSION = '3.10';

var MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function monthNum(v){
  var s = String(v||'').trim().toLowerCase().slice(0,3);
  return MONTHS[s] || 0;
}
function n(v){ return GA.num(v); }
function txt(v){ return String(v===null||v===undefined?'':v).trim(); }
/* 這些檔案的日期多為 Excel serial（數字），統一轉 YYYY-MM-DD */
function d(v){
  var s = txt(v), m = s.match(/^(\d{1,2})-(\d{1,2})--(20\d{2})$/);
  if (m) return m[3] + '-' + String(+m[2]).padStart(2,'0') + '-' + String(+m[1]).padStart(2,'0');
  return GA.excelDate(v);
}

function hn(v){
  return txt(v).toLowerCase().replace(/[\s_\-\.\/()（）'’`,:：\n]/g,'');
}
function firstHead(head, re){
  for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i;
  return -1;
}
function numericHead(rows, hi, cols){
  var best = -1, bestScore = -1;
  (cols || []).forEach(function (c) {
    var score = 0;
    for (var r = hi + 1; r < Math.min(rows.length, hi + 40); r++) {
      var v = (rows[r] || [])[c];
      if (typeof v === 'number' && isFinite(v)) score++;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return best;
}
function expenseYear(rows){
  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var line = (rows[i] || []).map(txt).join(' '), m = line.match(/(20\d{2})/);
    if (m) return +m[1];
  }
  return new Date().getFullYear();
}

var VRT = GA.vrtParsers = { version: EXPENSE_PARSER_VERSION };
global.VRT = VRT; // Expense 舊介面使用 window.VRT；保留相容入口，確保專用解析器真的被呼叫。
VRT.version = '3.6';
/* 被跳過的列（負數、缺資料等），匯入後可查：GA.vrtParsers.skipped */
VRT.skipped = [];
VRT.resetSkipped = function () { VRT.skipped = []; };

/* ══════════ 1. 採購記錄 purchase ══════════
   表頭在第 2 列，資料自第 5 列起（第 3 列是 Date 子標、第 4 列是 TTL 合計） */
VRT.parsePurchase = function (rows, meta) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || [];
    var date = d(r[0]);
    var desc = txt(r[1]);
    if (!desc) continue;
    // 跳過標題／合計列
    if (/^(received|desc|date|ttl|total)$/i.test(desc)) continue;
    if (!date && !n(r[4])) continue;
    var qty = n(r[4]), up = n(r[7]), ttl = n(r[8]);
    out.push({
      date: date,
      item: desc,
      brand: txt(r[2]),
      spec: txt(r[3]),
      qty: qty,
      unit: txt(r[5]),
      supplier: txt(r[6]),
      price: up,
      amount: ttl || (qty * up),
      stock: n(r[9]),
      remarks: txt(r[11]),
      category: 'purchase',
      dept: 'GA',
      sourceModule: 'excel',
      _row: i + 1
    });
  }
  return out;
};

/* ══════════ 2. 其他維修費用 expenses ══════════
   表頭在第 2 列（Date | Desc./Item | Brand | Spec. | Q'ty | Unit |
   Unit price | Total | Suppliers | Purpose），資料自第 4 列起 */
VRT.parseOtherExpenses = function (rows, meta) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i] || [];
    var date = d(r[0]);
    var desc = txt(r[1]);
    if (!desc || !date) continue;
    if (/^(date|desc|item|ttl|total)/i.test(desc)) continue;
    var qty = n(r[4]), up = n(r[6]), ttl = n(r[7]);
    out.push({
      date: date,
      item: desc,
      brand: txt(r[2]),
      spec: txt(r[3]),
      qty: qty,
      unit: txt(r[5]),
      price: up,
      amount: ttl || (qty * up),
      supplier: txt(r[8]),
      purpose: txt(r[9]),
      category: 'repair',
      dept: 'GA',
      sourceModule: 'excel',
      _row: i + 1
    });
  }
  return out;
};

/* ══════════ 3. 費用類別分頁（Electric / Water / Security ...）══════════
   寬表：一列一個月。自動找出 Amount 欄，向左找 Consum/Unit price。
   同一分頁可能左右並排多區塊（Factory / Expat staff house）→ 各自產生記錄。 */
VRT.parseExpenseCategorySheet = function (rows, meta) {
  var out = [];
  var sheetName = ((meta && meta.sheetName) || '').trim();
  var catKey = sheetName.toLowerCase().replace(/\s+/g,'_');

  // 找表頭列（含 Amount 或 Consum 字樣）
  var hi = -1;
  for (var i = 0; i < Math.min(8, rows.length); i++) {
    var joined = (rows[i]||[]).map(function(c){return txt(c).toLowerCase();}).join('|');
    if (/amount|consum|unit\s*price/.test(joined)) { hi = i; break; }
  }
  if (hi < 0) return out;

  var head = (rows[hi]||[]).map(function(c){ return txt(c).toLowerCase().replace(/\s|\n/g,''); });
  // 幣別列（表頭下一列可能標 Riels / $）
  var curRow = (rows[hi+1]||[]).map(function(c){ return txt(c).toLowerCase(); });

  /* 找出「美金金額欄」。規則：
     · 表頭是 amount($) → 直接用
     · 表頭是 amount(r)/amount 但幣別列標 riels → 該欄是瑞爾，
       真正的美金在右邊標 '$' 的那一欄
     避免把瑞爾金額（動輒數十萬）當成美金加總。 */
  var amtCols = [];
  head.forEach(function (h, idx) {
    if (!/^amount/.test(h)) return;
    var isUSD = /\$/.test(h);
    var isRiel = /\(r\)|riel/.test(h) || /riel/.test(curRow[idx]||'');
    if (isUSD) { amtCols.push({ col: idx, usd: true }); return; }
    if (isRiel || /riel/.test(curRow[idx]||'')) {
      // 往右找標 $ 的欄（通常緊鄰）
      for (var c = idx+1; c <= idx+3 && c < curRow.length; c++) {
        if (/^\$$/.test((curRow[c]||'').trim())) { amtCols.push({ col: c, usd: true, rielCol: idx }); return; }
      }
      return;   // 找不到美金欄就跳過，寧可不匯入也不要匯錯幣別
    }
    // 未標幣別：檢查該欄下方數值是否明顯是瑞爾（>10000 且有對應 $ 欄）
    var big = false;
    for (var r2 = hi+1; r2 < Math.min(hi+8, rows.length); r2++) {
      if (n((rows[r2]||[])[idx]) > 10000) { big = true; break; }
    }
    if (big) {
      for (var c2 = idx+1; c2 <= idx+3 && c2 < curRow.length; c2++) {
        if (/^\$$/.test((curRow[c2]||'').trim())) { amtCols.push({ col: c2, usd: true, rielCol: idx }); return; }
      }
      return;
    }
    amtCols.push({ col: idx, usd: true });
  });
  if (!amtCols.length) return out;

  // 區塊標題（表頭上一列，如 Factory / Expat staff house）
  var blockRow = hi > 0 ? (rows[hi-1]||[]) : [];
  function blockName(col) {
    for (var c = col; c >= 0; c--) { var t = txt(blockRow[c]); if (t) return t; }
    return '';
  }
  // 月份欄
  var monCol = -1;
  for (var rr = hi+1; rr < Math.min(hi+14, rows.length); rr++) {
    var row = rows[rr]||[];
    for (var c3 = 0; c3 < 4; c3++) { if (monthNum(row[c3])) { monCol = c3; break; } }
    if (monCol >= 0) break;
  }
  if (monCol < 0) monCol = 1;
  var newCols = [];
  head.forEach(function (h, idx) { if (/^new/.test(h)) newCols.push(idx); });

  var year = 0;
  for (var y = 0; y <= hi; y++) {
    var line = (rows[y]||[]).map(txt).join(' ');
    var m = line.match(/(20\d{2})/);
    if (m) { year = +m[1]; break; }
  }
  if (!year) year = new Date().getFullYear();

  var curMon = 0, curMonthHasReading = true;
  for (var i2 = hi+1; i2 < rows.length; i2++) {
    var r2b = rows[i2] || [];
    var label = txt(r2b[monCol]);
    var mo = monthNum(label);
    if (mo) {
      curMon = mo;
      // Electric / Water 後續月份預先留有公式與固定 0.25 等模板值；
      // 只有填入 New meter reading 的月份才視為真實資料。
      curMonthHasReading = !/electric|water/i.test(sheetName) || !newCols.length || newCols.some(function (c0) { return n(r2b[c0]) > 0; });
    }
    if (!curMon) continue;
    if (!curMonthHasReading) continue;
    if (/^(g\.?ttl|ttl|total)/i.test(label)) continue;   // 跳過合計列

    amtCols.forEach(function (ac) {
      // TTL 小計列不取（該區塊左側寫 TTL）
      var blockLabel = '';
      for (var c4 = ac.col; c4 >= 0 && c4 >= ac.col-6; c4--) {
        var t4 = txt(r2b[c4]);
        if (/^(ttl|total)$/i.test(t4)) { blockLabel = 'TTL'; break; }
      }
      if (blockLabel === 'TTL') return;

      var amt = n(r2b[ac.col]);
      if (!amt) return;
      // 負數＝來源檔該月「New」度數尚未填寫，公式算出負值（非真實支出）→ 跳過不匯入
      if (amt < 0) {
        VRT.skipped.push({ sheet: sheetName, row: i2 + 1,
          reason: '金額為負（該月讀數未填，公式殘留）', amount: amt });
        return;
      }
      var cons = 0, up = 0;
      for (var c5 = ac.col-1; c5 >= 0 && c5 >= ac.col-5; c5--) {
        var h5 = head[c5] || '';
        if (/^unitprice/.test(h5) && !up) up = n(r2b[c5]);
        if (/^consum/.test(h5) && !cons) cons = n(r2b[c5]);
      }
      out.push({
        date: year + '-' + String(curMon).padStart(2,'0') + '-01',
        category: catKey,
        categoryLabel: sheetName,
        item: blockName(ac.col) || sheetName,
        dept: blockName(ac.col) || '',
        amount: Math.round(amt*100)/100,
        estAmount: Math.round(amt*100)/100,
        consumption: cons,
        consUnit: /electric/i.test(sheetName) ? 'KW' : (/water/i.test(sheetName) ? 'm3' : ''),
        price: up,
        currency: 'USD',
        sourceModule: 'excel',
        _row: i2 + 1
      });
    });
  }
  return out;
};

/* 一般費用逐筆明細：Purchase date / Item / Q'ty / Unit Price / TTL amount。
   同一份 General Expense 內大多數分類（Cleaning、Stationery、Gasoline…）
   都是這種格式，不能用月份寬表解析。 */
VRT.parseExpenseDetailSheet = function (rows, meta) {
  var out = [], hi = -1, sheetName = txt((meta && (meta.sheetName || meta.sheet)) || 'General Expense');
  for (var i = 0; i < Math.min(15, rows.length); i++) {
    var hh = (rows[i] || []).map(hn), dc0 = firstHead(hh, /date|receiveddate|purchasedate|printdate|daterefill/);
    var ic0 = firstHead(hh, /^(item|description|desc|descitem|name|part)$/);
    if (ic0 < 0) ic0 = firstHead(hh, /^brand$/);
    var ac0 = firstHead(hh, /ttlamount|totalamount|^amount|amountusd/);
    if (dc0 >= 0 && ic0 >= 0 && ac0 >= 0) { hi = i; break; }
  }
  if (hi < 0) return out;

  var head = (rows[hi] || []).map(hn);
  var dc = firstHead(head, /date|receiveddate|purchasedate|printdate|daterefill/);
  var ic = firstHead(head, /^(item|description|desc|descitem|name|part)$/);
  if (ic < 0) ic = firstHead(head, /^brand$/);
  var bc = firstHead(head, /^brand$/), sc = firstHead(head, /^spec|size/);
  var qc = firstHead(head, /^qty$|quantity/), supc = firstHead(head, /supplier|vendor/);
  var rc = firstHead(head, /purpose|remarks?|notes?|location/);
  var ac = firstHead(head, /ttlamount|totalamount|^amount|amountusd/);
  var priceCols = [], unitCols = [];
  head.forEach(function (h, idx) {
    if (/^unitprice|^up|priceusd/.test(h)) priceCols.push(idx);
    if (/^unit$/.test(h)) unitCols.push(idx);
  });
  var pc = numericHead(rows, hi, priceCols);
  var uc = unitCols.length ? unitCols[0] : -1;
  // Gas 分頁有兩個都叫 Unit Price 的表頭：前一欄實際是 Unit（drum），後一欄才是單價。
  if (uc < 0 && priceCols.length > 1) {
    priceCols.forEach(function (c) { if (c !== pc && uc < 0) uc = c; });
  }
  var sourceYear = expenseYear(rows);

  for (var rix = hi + 1; rix < rows.length; rix++) {
    var r = rows[rix] || [], date = d(r[dc]), item = txt(r[ic]);
    if (!date || !item || /^(ttl|g\.?ttl|total|date|item|description)$/i.test(item)) continue;
    var qty = qc >= 0 ? n(r[qc]) : 0, price = pc >= 0 ? n(r[pc]) : 0;
    var amount = ac >= 0 ? n(r[ac]) : 0;
    if (!amount && qty && price) amount = qty * price;
    if (!(amount > 0)) continue;
    var brand = bc >= 0 && bc !== ic ? txt(r[bc]) : '', spec = sc >= 0 ? txt(r[sc]) : '';
    var specParts = []; if (brand) specParts.push(brand); if (spec && spec !== brand) specParts.push(spec);
    var warn = '', dy = +(String(date).slice(0,4) || 0);
    if (sourceYear >= 2020 && dy && dy !== sourceYear) warn = '日期年份與本表年份不同 / Date year differs from source year';
    out.push({
      date: date, category: sheetName.toLowerCase().replace(/\s+/g,'_'), categoryLabel: sheetName,
      item: item, brand: brand, spec: specParts.join(' · '), qty: qty || 1,
      unit: uc >= 0 ? txt(r[uc]) : '', price: price, amount: Math.round(amount * 100) / 100,
      estAmount: Math.round(amount * 100) / 100, supplier: supc >= 0 ? txt(r[supc]) : '',
      purpose: rc >= 0 ? txt(r[rc]) : '', currency: 'USD', sourceModule: 'excel',
      _warn: warn, _row: rix + 1
    });
  }
  return out;
};

/* 簡單月份表：Clinic 一欄金額；Security 則拆成 Factory / Staff House，
   不再只匯入總額而失去區域明細。 */
VRT.parseExpenseSimpleMonthly = function (rows, meta) {
  var out = [], hi = -1, sheetName = txt((meta && (meta.sheetName || meta.sheet)) || 'General Expense');
  for (var i = 0; i < Math.min(12, rows.length); i++) {
    var h0 = (rows[i] || []).map(hn);
    if (firstHead(h0, /^month$/) >= 0) { hi = i; break; }
  }
  if (hi < 0) return out;
  var head = (rows[hi] || []).map(hn), mc = firstHead(head, /^month$/);
  var tc = firstHead(head, /^total$|ttlamount|totalamount|^amount/);
  var rc = firstHead(head, /remarks?|notes?|purpose/), year = expenseYear(rows);
  var sub = rows[hi + 1] || [], valueCols = [];
  if (tc > mc + 1) {
    for (var c = mc + 1; c < tc; c++) if (txt(sub[c])) valueCols.push(c);
  }
  if (!valueCols.length) {
    for (var c2 = mc + 1; c2 < (rows[hi] || []).length; c2++) {
      if (c2 === rc || c2 === tc) continue;
      if (txt((rows[hi] || [])[c2])) { valueCols.push(c2); break; }
    }
  }
  if (!valueCols.length && tc >= 0) valueCols.push(tc);
  if (!valueCols.length) return out;

  for (var rix = hi + 1; rix < rows.length; rix++) {
    var r = rows[rix] || [], mo = monthNum(r[mc]); if (!mo) continue;
    valueCols.forEach(function (c3) {
      var amount = n(r[c3]); if (!(amount > 0)) return;
      var label = txt(sub[c3]) || txt((rows[hi] || [])[c3]) || sheetName;
      out.push({
        date: year + '-' + String(mo).padStart(2,'0') + '-01',
        category: sheetName.toLowerCase().replace(/\s+/g,'_'), categoryLabel: sheetName,
        item: label, qty: 1, price: amount, amount: Math.round(amount * 100) / 100,
        estAmount: Math.round(amount * 100) / 100, purpose: rc >= 0 ? txt(r[rc]) : '',
        currency: 'USD', sourceModule: 'excel', _row: rix + 1
      });
    });
  }
  return out;
};

/* General Expense 單一入口：依每張工作表的真實結構選解析器。 */
VRT.parseExpenseSheet = function (rows, meta) {
  rows = rows || []; meta = meta || {};
  var sn = txt(meta.sheetName || meta.sheet), low = sn.toLowerCase();
  if (/^chart|supplier list|stop supply|staff house break down/.test(low)) return [];
  var fileYear = +(String(meta.fileName || meta.file || '').match(/20\d{2}/) || [0])[0];
  var sheetYear = expenseYear(rows);
  // 2026 活頁簿仍保留 Jan/Feb/Mar 2020 舊頁及 Electric/Water 2024 舊頁；避免混入本年。
  if (fileYear && sheetYear && sheetYear < fileYear && (monthNum(sn) || /^(electric|water)\s*$/.test(low))) return [];
  var detail = VRT.parseExpenseDetailSheet(rows, meta); if (detail.length) return detail;
  var monthly = VRT.parseExpenseSimpleMonthly(rows, meta); if (monthly.length) return monthly;
  return VRT.parseExpenseCategorySheet(rows, meta);
};

/* ══════════ 4. 堆高機維修 Forklift ══════════
   左右並排兩台：#1 約在 B~I 欄、#2 約在 K~N 欄。
   月份只寫在該月第一列 → 需向下填滿。 */
VRT.parseForklift = function (rows, meta) {
  var out = [];
  // 找標題列（含 2025 Forklift #1 之類）
  var titleRow = -1, blocks = [];
  for (var i = 0; i < Math.min(8, rows.length); i++) {
    var row = rows[i]||[];
    row.forEach(function (c, idx) {
      var t = txt(c);
      if (/forklift\s*#?\d/i.test(t)) { blocks.push({ name: t, col: idx }); titleRow = i; }
    });
    if (blocks.length) break;
  }
  if (!blocks.length) blocks = [{ name: 'Forklift', col: 1 }];

  var year = 0;
  for (var y = 0; y < Math.min(6, rows.length); y++) {
    var line = (rows[y]||[]).map(txt).join(' ');
    var m = line.match(/(20\d{2})/);
    if (m) { year = +m[1]; break; }
  }
  if (!year) year = new Date().getFullYear();

  // 每個區塊：col = Mnth，col+1 = Description，col+2 = U/P，col+3 = Amount
  //           （#1 另有 col+4 = Date maintenance、col+5 = Supplier）
  blocks.forEach(function (blk) {
    var mc = blk.col, dc = mc+1, uc = mc+2, ac = mc+3, datec = mc+4, supc = mc+5;
    var curMon = 0;
    for (var i2 = (titleRow<0?0:titleRow)+1; i2 < rows.length; i2++) {
      var r = rows[i2] || [];
      var mo = monthNum(r[mc]);
      if (mo) curMon = mo;                  // 向下填滿月份
      var desc = txt(r[dc]);
      var amt = n(r[ac]);
      if (!desc || !amt) continue;
      if (/^(description|repair|mnth|ttl|total)$/i.test(desc)) continue;
      var md = d(r[datec]);
      out.push({
        date: md || (year + '-' + String(curMon||1).padStart(2,'0') + '-01'),
        item: desc,
        issue: desc,
        equipment: blk.name,
        location: blk.name,
        price: n(r[uc]),
        amount: amt,
        qty: 1,
        supplier: txt(r[supc]),
        category: 'forklift_repair',
        dept: 'Maintenance',
        sourceModule: 'excel',
        _row: i2 + 1
      });
    }
  });
  return out;
};

/* ══════════ 5. 月份分頁（Jan/Feb/Mar）══════════
   多區塊並排（Clinic / Security / Paper / Toilet Paper / Water），
   第 2 列為類別、第 3 列為 Shop1/Shop2、第 5 列起為金額。 */
VRT.parseExpenseMonthSheet = function (rows, meta) {
  var out = [];
  var sheetName = (meta && meta.sheetName) || '';
  var mo = monthNum(sheetName);
  if (!mo) return out;

  // 年份：第 1 列常寫 "Jan,2020"
  var year = new Date().getFullYear();
  var first = (rows[0]||[]).map(txt).join(' ');
  var ym = first.match(/(20\d{2})/); if (ym) year = +ym[1];

  var catRow  = rows[1] || [];   // 類別：Clinic / Security / Paper / TOILET PAPER / WATER
  var shopRow = rows[2] || [];   // Shop1 / Shop2
  var subRow  = rows[3] || [];   // 子表頭（WATER 才有：Old/New/Consumsion/U/P/Total Price）
  var dataRow = null;
  for (var i = 4; i < Math.min(rows.length, 10); i++) {
    if ((rows[i]||[]).some(function (c) { return n(c) > 0; })) { dataRow = rows[i]; break; }
  }
  if (!dataRow) return out;

  // 類別起訖欄
  var cats = [];
  catRow.forEach(function (c, idx) { var t = txt(c); if (t) cats.push({ name: t, col: idx }); });
  if (!cats.length) return out;

  cats.forEach(function (cat, ci) {
    var endCol = cats[ci+1] ? cats[ci+1].col : dataRow.length;
    var catLabel = cat.name.trim();
    var catKey = catLabel.toLowerCase().replace(/\s+/g,'_');
    var isWater = /water/i.test(catLabel);

    for (var c = cat.col; c < endCol; c++) {
      var sub = txt(subRow[c]).toLowerCase().replace(/\s|\n/g,'');
      var amt = n(dataRow[c]);

      if (isWater) {
        // WATER 有子表：只取 "Total Price"，其餘（Old/New/Consumsion/U/P）不是金額
        if (!/^totalprice/.test(sub)) continue;
        if (!amt) continue;
        // 幣別：標題含 Riels → 換算需匯率，這裡標記幣別交由使用者確認
        var isRiel = /riel/i.test(txt(subRow[c]));
        // 往左取用量
        var cons = 0;
        for (var cc = c-1; cc >= cat.col; cc--) {
          if (/^consum/.test(txt(subRow[cc]).toLowerCase().replace(/\s|\n/g,''))) { cons = n(dataRow[cc]); break; }
        }
        out.push({
          date: year + '-' + String(mo).padStart(2,'0') + '-01',
          category: catKey, categoryLabel: catLabel,
          item: txt(shopRow[c]) || catLabel,
          dept: txt(shopRow[c]) || '',
          amount: isRiel ? 0 : Math.round(amt*100)/100,     // 瑞爾不直接當美金
          amountRiel: isRiel ? amt : 0,
          currency: isRiel ? 'KHR' : 'USD',
          consumption: cons, consUnit: 'm3',
          _warn: isRiel ? '金額為瑞爾，需確認匯率' : '',
          sourceModule: 'excel', _row: 5
        });
        if (isRiel) VRT.skipped.push({ sheet: sheetName, row: 5,
          reason: 'WATER 金額為瑞爾（' + amt + ' R），需確認匯率後換算', amount: amt });
        continue;
      }

      // 一般類別：該欄有金額即為一筆（Shop1 / Shop2）
      if (subRow.length && sub) continue;   // 有子表頭者非金額欄
      if (!amt) continue;
      out.push({
        date: year + '-' + String(mo).padStart(2,'0') + '-01',
        category: catKey, categoryLabel: catLabel,
        item: txt(shopRow[c]) || catLabel,
        dept: txt(shopRow[c]) || '',
        amount: Math.round(amt*100)/100,
        estAmount: Math.round(amt*100)/100,
        currency: 'USD',
        sourceModule: 'excel', _row: 5
      });
    }
  });
  return out;
};

/* ══════════ 註冊到智慧匯入 ══════════ */
function reg(type, detectFn, parseFn) {
  GA.smartImport.register(type, { detect: detectFn, parse: parseFn });
}

// 採購記錄
reg('po', function (ctx) {
  var sn = String(ctx.sheetName||'').toLowerCase();
  var h = (ctx.headers||[]).join('|');
  if (/^purchase/.test(sn.trim()) && /desc|q'?ty|supplier/.test(h)) return 1;
  return 0;
}, function (ctx) {
  return VRT.parsePurchase(ctx.rows, ctx);
});

// 其他維修費用（expenses 分頁）
reg('repair', function (ctx) {
  var sn = String(ctx.sheetName||'').toLowerCase().trim();
  var h = (ctx.headers||[]).join('|');
  if (sn === 'expenses' && /desc|q'?ty|supplier|purpose/.test(h)) return 1;
  if (/forklift/.test(sn) && !/chart/.test(sn)) return 1;
  return 0;
}, function (ctx) {
  var sn = String(ctx.sheetName||'').toLowerCase().trim();
  if (/forklift/.test(sn)) return VRT.parseForklift(ctx.rows, ctx);
  return VRT.parseOtherExpenses(ctx.rows, ctx);
});

// 費用（類別分頁 + 月份分頁）
reg('expense', function (ctx) {
  var sn = String(ctx.sheetName||'').trim();
  var low = sn.toLowerCase();
  if (/^chart/.test(low)) return 0;                       // 圖表分頁略過
  if (monthNum(sn)) return 1;                             // Jan/Feb/Mar
  // 類別分頁：Electric / Water / Security / Paper ...
  var known = ['electric','water','security','paper','mask','toilet paper','cleaning',
    'stationery','other','kitchen & food','banner-sign','gasoline','guest-auditor','gas',
    'application form-document','fire ext','training','donation','business trip',
    'independent','decoration','covid','clinic','staff house break down'];
  if (known.indexOf(low.trim()) >= 0) return 1;
  return 0;
}, function (ctx) {
  return VRT.parseExpenseSheet(ctx.rows, ctx);
});

})(window);
