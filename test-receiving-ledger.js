const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('work/receiving.html', 'utf8');
const scripts = [];
const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html))) scripts.push(m[1]);
scripts.forEach((source, i) => new vm.Script(source, { filename: `receiving.html:script${i + 1}` }));

for (const marker of [
  'function recvLedgerSummary',
  'function recvLedgerHtml',
  'function renderIssueBatchTab',
  'function saveIssueBatchLines',
  'function setRecvPoView',
  'function receiveAllPoNow',
  'scheduleReceivingAutoUpload',
  'function recvItemVersionFor',
  'function recvMigrateCatalog',
  'function recvRecordCost',
  'function recvCloudPush',
  'function recvCloudPull',
  'recvItemAttachment',
  'unitPrice',
  'amount'
]) {
  if (!html.includes(marker)) throw new Error(`Missing receiving ledger/PO marker: ${marker}`);
}

console.log(JSON.stringify({ scripts: scripts.length, ledger: true, issueBatch: true, poOffsetFilters: true }));
