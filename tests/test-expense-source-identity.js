const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('work/expense.html', 'utf8');
function loadFunction(name) {
  const match = html.match(new RegExp(`function ${name}\\([^\\n]+`));
  if (!match) throw new Error(`Missing function ${name}`);
  vm.runInThisContext(match[0], { filename: `expense.html:${name}` });
}

global.text = v => String(v == null ? '' : v).trim();
global.num = v => Number(v || 0);
global.GA = { fingerprint: parts => JSON.stringify(parts) };
global.window = global;
loadFunction('sourceFileBase');
loadFunction('sourceIdentity');
loadFunction('sameImportedRow');
loadFunction('collapseSourceDuplicates');
loadFunction('classifyFile');

const a = { sourceFile: 'VRT General Expense 2026(5).xlsb', sourceSheet: 'cleaning', sourceRow: 17 };
const b = { sourceFile: 'VRT General Expense 2026(6).xlsb', sourceSheet: 'cleaning', sourceRow: 17 };
const c = { sourceFile: 'VRT General Expense 2026.xlsx', sourceSheet: 'cleaning', sourceRow: 17 };
if (sourceIdentity(a, 'general', {}) !== sourceIdentity(b, 'general', {})) {
  throw new Error('Version suffixes produced different source identities');
}
if (sourceIdentity(a, 'general', {}) !== sourceIdentity(c, 'general', {})) {
  throw new Error('XLSB and converted XLSX produced different source identities');
}
global.SRC_META = {
  repair: { file: /other|repair|maintain|fix|維修/i },
  purchase: { file: /purchas|purchase|採購/i },
  general: { file: /general|expense|費用|支出/i }
};
if (classifyFile('VRT General Expense 2026.xlsx') !== 'general') {
  throw new Error('Converted XLSX was not routed to General Expense');
}
if (!sameImportedRow({ date:'2026-02-02', item:'Bleach', amount:3 }, { date:'2026-02-02', item:'Bleach', amount:3 })) {
  throw new Error('Equal source rows were not recognised');
}
if (sameImportedRow({ date:'2026-02-02', item:'Bleach', amount:3 }, { date:'2026-02-02', item:'Bleach', amount:4 })) {
  throw new Error('Changed amount was not recognised as an update');
}
global.EXP3 = { general: [
  Object.assign({ amount: 3 }, a),
  Object.assign({ amount: 4 }, b)
] };
if (collapseSourceDuplicates('general') !== 1 || EXP3.general.length !== 1 || EXP3.general[0].amount !== 4) {
  throw new Error('Existing rows from versioned filenames were not collapsed to the newest row');
}
console.log('expense source identity/update tests OK');
