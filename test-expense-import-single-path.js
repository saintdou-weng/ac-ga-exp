const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('work/expense.html', 'utf8');

for (const marker of [
  'function doExpenseImport(files)',
  "doExpenseImport(this.files)",
  "scheduleExpenseAutoCloudSync('import')",
  "scheduleExpenseAutoCloudSync('manual')",
  "scheduleExpenseAutoCloudSync('budget')"
]) {
  if (!html.includes(marker)) throw new Error(`Missing single-path import marker: ${marker}`);
}

if (/function\s+importFiles\s*\(/.test(html)) throw new Error('Legacy importFiles declaration still exists');
if (/_expImportFilesLatest|_expAddManualLatest|_expSaveBudgetLatest/.test(html)) {
  throw new Error('Recursive same-name wrapper pattern still exists');
}

const inlineScripts = [];
const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) inlineScripts.push(m[1]);
inlineScripts.forEach((src, i) => new vm.Script(src, { filename: `expense.html:inline-${i + 1}` }));

console.log(JSON.stringify({ singlePath: true, inlineScripts: inlineScripts.length }));
