const fs = require('fs');
const vm = require('vm');

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error('Usage: node test-expense-parser.js workbook.xlsb|workbook-rows.json');

global.window = global;
global.GA = {
  num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  },
  excelDate(v) {
    if (!v) return '';
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    return '';
  },
  smartImport: { register() {} }
};

vm.runInThisContext(fs.readFileSync('work/shared/ga-vrt-parsers.js', 'utf8'), { filename: 'ga-vrt-parsers.js' });
let fixture;
if (/\.json$/i.test(workbookPath)) {
  fixture = JSON.parse(fs.readFileSync(workbookPath, 'utf8'));
} else {
  const XLSX = require('../shared/xlsx.full.min.js');
  const workbook = XLSX.read(fs.readFileSync(workbookPath), { type: 'buffer', cellDates: true });
  fixture = { sheetNames: workbook.SheetNames, sheets: {} };
  for (const sheetName of workbook.SheetNames) {
    fixture.sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, raw: true, defval: ''
    });
  }
}
const records = [];
for (const sheetName of fixture.sheetNames) {
  const rows = fixture.sheets[sheetName] || [];
  const parsed = GA.vrtParsers.parseExpenseSheet(rows, {
    sheetName,
    sheet: sheetName,
    fileName: workbookPath.split('/').pop(),
    file: workbookPath.split('/').pop()
  });
  parsed.forEach(r => records.push({ ...r, sourceSheet: sheetName.trim() }));
}

const byMonth = {};
for (const r of records) {
  const month = String(r.date || '').slice(0, 7);
  if (!byMonth[month]) byMonth[month] = { count: 0, total: 0 };
  byMonth[month].count += 1;
  byMonth[month].total += Number(r.amount || 0);
}
for (const month of Object.keys(byMonth).sort()) byMonth[month].total = Math.round(byMonth[month].total * 100) / 100;

const detailSheets = new Set(records.map(r => r.sourceSheet));
const latest = records.map(r => r.date).filter(Boolean).sort().pop();
const olderWorkbook = /2026\s*\([125]\)\.xlsb$/i.test(workbookPath);
const expectedRecords = olderWorkbook ? 572 : 486;
if (records.length !== expectedRecords) throw new Error(`Unexpected expense record count: ${records.length}`);
if (!detailSheets.has('cleaning') || !detailSheets.has('stationery') || !detailSheets.has('Electric') || !detailSheets.has('Water')) {
  throw new Error(`Missing expected sheets: ${Array.from(detailSheets).join(', ')}`);
}
if (latest !== (olderWorkbook ? '2026-06-24' : '2026-05-28')) throw new Error(`Unexpected latest detail date: ${latest}`);
if ((byMonth['2026-05'] || {}).count < 50) throw new Error('May 2026 details were not fully parsed');
if ((!olderWorkbook && byMonth['2026-06']) || byMonth['2026-07'] || byMonth['2026-08']) throw new Error('Blank utility template months were imported');
const expectedMayTotal = olderWorkbook ? 10380.67 : 10356.27;
if (Math.abs((byMonth['2026-05'] || {}).total - expectedMayTotal) > 0.001) throw new Error(`May 2026 total does not reconcile: ${(byMonth['2026-05'] || {}).total}`);

const outOfYear = records.filter(r => !String(r.date).startsWith('2026-')).map(r => ({ date: r.date, sheet: r.sourceSheet, item: r.item, amount: r.amount }));
const warnings = records.filter(r => r._warn).length;
console.log(JSON.stringify({ records: records.length, sheets: detailSheets.size, latest, warnings, byMonth, outOfYear }, null, 2));
