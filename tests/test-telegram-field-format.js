const fs=require('fs'),vm=require('vm');
const base='work/';
const tg=fs.readFileSync(base+'shared/ga-telegram.js','utf8');
for(const m of [
  "<option value=\"km\">ខ្មែរ</option>",
  "<option value=\"all3\">中 / EN / ខ្មែរ</option>",
  'TG.langText = function',
  'TG.periodLabel = function',
  "branch + ' ' + label + ': ' + val",
  'TG.buildApprovalPreview = function'
]) if(!tg.includes(m)) throw new Error('Missing Telegram field-format marker: '+m);
new vm.Script(tg,{filename:'ga-telegram.js'});

const mods=['procurement.html','receiving.html','maintenance.html','fuel.html','expense.html'];
for(const f of mods){
  const html=fs.readFileSync(base+f,'utf8');
  if(!html.includes('ga-telegram.js?v=3.9.3-20260825')) throw new Error(f+' missing telegram cache bust');
  const scripts=[],re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(html)))scripts.push(m[1]);
  scripts.forEach((src,i)=>new vm.Script(src,{filename:f+':inline-'+i}));
}
const fuel=fs.readFileSync(base+'fuel.html','utf8');
for(const m of ["function genSummary(){","├ 📅 ${F('期間','Period','រយៈពេល')}","lang:(lang||'en')"]) if(!fuel.includes(m)) throw new Error('Fuel legacy summary regression: '+m);

const exp=fs.readFileSync(base+'expense.html','utf8');
for(const m of ['function doExpenseImport(files)','EXP_TG_SUMMARY_MODE','electricity','water','expenseLogicalDuplicateKey']) if(!exp.includes(m)) throw new Error('Expense regression: '+m);
if(/function\s+importFiles\s*\(/.test(exp)) throw new Error('Legacy recursive importFiles returned');

const gs=fs.readFileSync(base+'AC_GA_EXP.gs','utf8');
for(const m of [
  'function handleTgApproval(body)',
  'function buildApprovalText(d, items, total, user)',
  'function handleNewGroupCallback(query)',
  'function handleBatchCallback(cb)',
  'function generateApprovalDoc(',
  "const msgLang = b.lang || 'both'",
  "T('核可請求','Approval Request','សំណើអនុម័ត')",
  "dashboardBlockForMessage(L)",
  "function buildSummary(kind)",
  "├ 📋 月採購 PO:",
  "function stripDashboardBlock(text)"
]) if(!gs.includes(m)) throw new Error('GAS regression/missing field format: '+m);
fs.writeFileSync('/tmp/gaexp-gs-syntax.js',gs);
console.log(JSON.stringify({ok:true,modules:mods.length,fieldStyle:true,multilang:true,approvalFlowMarkers:true,singleImport:true}));
