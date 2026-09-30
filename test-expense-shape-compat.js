const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('work/expense.html', 'utf8');
const start = html.indexOf('function expRowsFromAny');
const end = html.indexOf('function loadData', start);
if (start < 0 || end < 0) throw new Error('Expense shape normalizer not found');

const source = `
function normalise(r, src) { return Object.assign({ _source: src, item: r.item || r.description || r.desc || r.name || '' }, r); }
${html.slice(start, end)}
`;
const ctx = {};
vm.runInNewContext(source + '\nthis.expSourceBuckets=expSourceBuckets;', ctx);

const restored = ctx.expSourceBuckets({
  repair: { '2026-06': [{ date: '2026-06-03', item: 'Repair A', amount: 12 }] },
  purchase: { row1: { date: '2026-06-04', description: 'Purchase B', total: 20 } },
  general: [{ date: '2026-06-05', item: 'General C', amount: 30 }]
});

if (restored.repair.length !== 1 || restored.purchase.length !== 1 || restored.general.length !== 1) {
  throw new Error(`Unexpected restored counts: ${JSON.stringify(restored)}`);
}
if (restored.purchase[0].description !== 'Purchase B') throw new Error('Nested object row was not preserved');
console.log(JSON.stringify({ repair: restored.repair.length, purchase: restored.purchase.length, general: restored.general.length }));
