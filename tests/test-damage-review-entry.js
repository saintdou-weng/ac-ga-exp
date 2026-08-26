const fs=require('fs');
const s=fs.readFileSync('damage.html','utf8');
const req=[
  'onclick="saveReport(false)"',
  'onclick="saveReport(true)"',
  "saveSubmit:'儲存並送 Phea Review'",
  'async function submitRecord(id,silent)',
  "['draft','returned'].includes(r.status)",
  "waitingPaul:'等待 Paul 核可'",
  "GA.gasPost('damageSubmitReview'"
];
for(const x of req){ if(!s.includes(x)) throw new Error('missing: '+x); }
if(/Paul Approve[^<]*<\/button>/i.test(s)) throw new Error('web Paul Approve button must not exist');
console.log('damage review entry hotfix OK');
