const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('work/expense.html', 'utf8');
const requiredAssets = [
  'shared/xlsx.full.min.js',
  'shared/chart.umd.min.js',
  'shared/ga-core.js',
  'shared/ga-data.js',
  'shared/ga-import.js',
  'shared/ga-telegram.js',
  'shared/ga-smart-sync.js',
  'shared/ga-vrt-parsers.js',
  'shared/exp-seed.js'
];

for (const asset of requiredAssets) {
  if (!fs.existsSync(path.join('work', asset))) throw new Error(`Missing local mobile asset: ${asset}`);
  if (!html.includes(`${asset}?v=`)) throw new Error(`Expense page does not use a cache-busted local asset: ${asset}`);
}

const XLSX = require('../shared/xlsx.full.min.js');
if (XLSX.version !== '0.18.5') throw new Error(`Unexpected bundled SheetJS version: ${XLSX.version}`);
if (!/General Expense parser v3\.6 not loaded/.test(html)) throw new Error('Missing explicit General Expense parser check');
if (!/diagnosticText/.test(html) || !/exp-import-status/.test(html)) throw new Error('Missing persistent import diagnostics');
if (!/recognizedRows/.test(html) || !/pc\.set\('month',period\)/.test(html)) throw new Error('Import does not open the latest recognised month');
if (!/version:'v3\.6'/.test(html)) throw new Error('Expense page version was not updated');
if (!/function expRowsFromAny/.test(html) || !/function expSourceBuckets/.test(html)) throw new Error('Missing legacy expense-shape normalizer');

console.log(JSON.stringify({ localAssets: requiredAssets.length, xlsxVersion: XLSX.version, pageVersion: 'v3.6' }));
