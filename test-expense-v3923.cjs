const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..'),fixture=process.argv[2];
if(!fixture)throw Error('Pass VRT Repair-Maintainance 2026 (1)(1).xlsb');
const bytes=fs.readFileSync(fixture),XLSX=require('../shared/xlsx.full.min.js');
const html=fs.readFileSync(path.join(root,'expense.html'),'utf8').replace(/<script[^>]*src="(shared\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,s)=>'<script>'+fs.readFileSync(path.join(root,s),'utf8')+'</script>');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function page(opts={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext|navigation|scrollTo/.test(e.message))errors.push(e.message);});
 const idb=opts.idb||new IDBFactory();
 const dom=new JSDOM(html,{url:'https://qa.invalid/expense.html',storageQuota:600000,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.indexedDB=idb;w.confirm=()=>false;w.prompt=()=>null;w.alert=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.fetch=async()=>{throw Error('Test offline; no external effects');};
  w.GAAutoSync={install(){},schedule(){}};
  const seed=opts.local||{'ac_ga_exp_txns_v2':'[]','ac_ga_exp_ui_v1':JSON.stringify({tab:'general',type:'month',key:'2026-07'})};
  for(const [k,v]of Object.entries(seed))w.localStorage.setItem(k,v);
  if(opts.full)w.localStorage.setItem('unrelated-module-data','x'.repeat(595000));
 }});
 const w=dom.window;assert.equal(await w.EXP_DATA_READY,true);await sleep(350);
 w.GAAutoSync.schedule=()=>{};
 return {w,idb,errors,close:()=>w.close(),local:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}))};
}
function file(w,name=path.basename(fixture)){return new w.File([bytes],name);}
function totals(rows){return rows.reduce((s,r)=>s+Math.round(r.amount*100),0);}
async function snapshot(idb){const req=idb.open('ga-exp-expense-v1',1);return new Promise((resolve,reject)=>{req.onsuccess=()=>{const r=req.result.transaction('state').objectStore('state').get('current');r.onsuccess=()=>{req.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);};req.onerror=()=>reject(req.error);});}
const watchdog=setTimeout(()=>{console.error('FAIL test did not finish');process.exit(1);},45000);
(async()=>{
 const p=await page({full:true});let reopen;
 try{
  const w=p.w;const r=await w.doExpenseImport([file(w)]);assert(r.ok&&r.stored);assert.equal(r.added,57);
  const aug=w.EXP3.repair.filter(r=>r.date.startsWith('2026-08'));assert.equal(aug.length,7);assert.equal(totals(aug),26500);
  assert.equal(w.activeTab,'repair');assert.equal(w.currentState().key,'2026-08');assert.equal(w.document.querySelector('.ga-pc-sel').value,'2026-08');assert.equal(w.document.querySelector('.ga-pc-date').value,'2026-08');
  assert.equal(w.rowsFor('repair').length,7);assert(w.document.getElementById('exp-view').textContent.includes('$265.00'));
  const importedMonth=w.document.querySelector('[data-exp-import-period="2026-08"]');assert(importedMonth.textContent.includes('7'));assert(importedMonth.textContent.includes('265'));
  w.pc.set('month','2026-07');w.jumpExpenseLatest();assert.equal(w.currentState().type,'month');assert.equal(w.currentState().key,'2026-08');
  w.expTab('general');w.pc.set('month','2025-12');importedMonth.click();assert.equal(w.activeTab,'repair');assert.equal(w.currentState().key,'2026-08');
  assert.equal(w.localStorage.getItem('unrelated-module-data').length,595000);assert.equal(w.localStorage.getItem('ac_ga_exp_source_v3'),null);
  assert(w.expenseLocalSavedLabel().includes('57'));assert(w.EXP_PENDING);assert.equal((await snapshot(p.idb)).data.exp3.repair.length,57);
  // Browser download suffixes do not create a second source or request redundant duplicates.
  w.confirm=()=>{throw Error('Unnecessary duplicate confirmation');};
  const again=await w.doExpenseImport([file(w,'VRT Repair-Maintainance 2026 (2)(3).xlsb')]);assert(again.ok);assert.equal(again.added,0);assert.equal(again.updated,0);assert.equal(again.duplicateCandidates,0);
  // A filename without a year retains the actual Excel dates and header detection.
  const wb=XLSX.read(bytes,{type:'buffer'});const renamed=w.parseWorkbook(wb,'repair','VRT Repair-Maintainance__391176108310.xlsb');assert.equal(renamed.filter(r=>r.date.startsWith('2026-08')).length,7);
  let exported;w.XLSX.writeFile=(wb,name)=>{exported={wb,name};};w.expExport();const out=XLSX.utils.sheet_to_json(exported.wb.Sheets.Expense,{header:1});assert.equal(out.length,8);assert.equal(out.slice(1).reduce((s,r)=>s+Math.round(r[8]*100),0),26500);
  for(const type of ['day','week','month','year']){const key=w.GA.periodKey('2026-08-24',type);w.pc.set(type,key);assert(w.rowsFor('repair').length>0);const text=w.expenseTelegramText({scope:'repair',ptype:type,period:key,lang:'en'});assert(text.includes('Repair')||text.includes('repair'));}
  w.pc.set('month','2026-08');
  reopen={idb:p.idb,local:p.local()};
  assert.equal(p.errors.length,0,p.errors.join('\n'));
  console.log('PASS actual XLSB August 7/$265, UI/tab/month alignment, latest button, export, D/W/M/Y summary, repeated filename, full localStorage and atomic committed count');
 }finally{p.close();}
 const q=await page(reopen);
 try{
  const w=q.w;assert.equal(w.EXP3.repair.length,57);assert.equal(w.currentState().key,'2026-08');assert.equal(w.rowsFor('repair').length,7);assert(w.EXP_PENDING);assert(w.EXP_IMPORT_REPORT.some(r=>r.period==='2026-08'&&r.count===7));
  // Actual asynchronous persistence failure cannot be reported as a successful import or download.
  const save=w.GAExpenseStore.save;w.GAExpenseStore.save=async()=>{throw Error('QuotaExceededError test');};
  const wb=XLSX.read(bytes,{type:'buffer'});wb.Sheets.Forklift.N6.v=21;
  const reader=w.readWorkbook;w.readWorkbook=async()=>wb;
  const failed=await w.doExpenseImport([file(w)]);assert.equal(failed.ok,false);assert.equal(failed.stored,false);assert(w.EXP_STORAGE_FAILED);assert(!w.expenseLocalSavedLabel().includes('本機已保存'));
  assert.equal(totals((await snapshot(q.idb)).data.exp3.repair),171550,'previous committed snapshot remains intact');
  w.GAExpenseStore.save=save;w.readWorkbook=reader;await w.retryExpenseSave();assert(!w.EXP_STORAGE_FAILED);assert.equal(totals((await snapshot(q.idb)).data.exp3.repair),171650);
  console.log('PASS reopen retains August and pending upload; failed save is explicit; retry preserves all rows and commits changed amount');
  // A later local import/edit wins over an earlier in-flight cloud download.
  const realPull=w.GASmartSync.pull;let apply,release;w.GASmartSync.pull=opts=>new Promise((resolve,reject)=>{apply=opts.apply;release=()=>Promise.resolve().then(()=>apply([],{})).then(()=>resolve({ok:true}),reject);});
  const pulling=w.expCloudDownload({silent:true});await sleep(10);w.EXP3.repair[0].purpose+=' local edit';await w.saveExp3();release();await assert.rejects(pulling,/Local changes|本機資料已更新/);assert.equal(w.EXP3.repair.length,57);
  // Both broken GET and POST manifests preserve the actual HTML error and never invoke legacy pull/push.
  w.GASmartSync.pull=realPull;w.GA.backend.require=async()=>({version:'3.9.22'});
  const calls=[];w.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:false,status:404,text:async()=>'<html><title>找不到網頁</title></html>'};};
  await assert.rejects(w.expCloudDownload({silent:true}),e=>e.code==='CLOUD_HTML_NOT_FOUND');assert.equal(calls.length,2);assert(calls.every(c=>(c.opts&&c.opts.body?JSON.parse(c.opts.body).action:'smartManifest')==='smartManifest'));assert.equal(w.EXP3.repair.length,57);assert(w.EXP_PENDING);
  assert(w.document.getElementById('ga-backend-alert').textContent.includes('找不到網頁'));assert(!w.document.getElementById('ga-backend-alert').textContent.includes('未回報版本'));
  w.fetch=async(url,opts)=>{const action=opts&&opts.body?JSON.parse(opts.body).action:new URL(url).searchParams.get('action');const data=action==='smartManifest'?{exists:true,hashes:{broken:'x'},counts:{broken:2},recordCount:2}:{records:[{_syncId:'only-one',kind:'txn',row:{date:'2026-08-01',item:'partial',amount:1}}]};return {ok:true,text:async()=>JSON.stringify({ok:true,data})};};
  await assert.rejects(w.expCloudDownload({silent:true}),e=>e.code==='CLOUD_INCOMPLETE');assert.equal(w.EXP3.repair.length,57);
  console.log('PASS import during cloud pull protected; HTML 404 stays connection error; no legacy fallback or false download success');
  console.log('PASS truncated cloud bucket cannot overwrite complete local data');
 }finally{q.close();}
 // One bad file aborts the entire multi-file read before any live rows are changed.
 const a=await page();try{const w=a.w,read=w.readWorkbook;w.readWorkbook=f=>f.name==='bad.xlsb'?Promise.reject(Error('corrupt workbook')):read(f);const r=await w.doExpenseImport([file(w),new w.File(['bad'],'bad.xlsb')]);assert(!r.ok);assert.equal(w.EXP3.repair.length,0);console.log('PASS multiple-file parse failure leaves local data unchanged');}finally{a.close();}
 const manual=await page();try{const w=manual.w;w.openExpenseAdd('repair');const $=id=>w.document.getElementById(id);$('ee-item').value='QA manual cost';$('ee-date').value='2026-08-20';$('ee-qty').value='2.5';$('ee-price').value='12.34';$('ee-price').dispatchEvent(new w.Event('input'));assert.equal($('ee-amount').value,'30.85');const save=w.GAExpenseStore.save;w.GAExpenseStore.save=async()=>{throw Error('Disk failed');};await $('ee-save').onclick();assert.equal(w.EXP3.repair.length,1);assert($('ee-save'));w.GAExpenseStore.save=save;await $('ee-save').onclick();assert.equal(w.EXP3.repair.length,1);assert.equal(w.EXP3.repair[0].amount,30.85);assert(!$('ee-save'));w.confirm=()=>true;await w.deleteExpenseRow('repair',encodeURIComponent(w.EXP3.repair[0].recordId));assert.equal((await snapshot(manual.idb)).data.exp3.repair.length,0);console.log('PASS manual decimal calculation, failed-save retry without duplicate, and committed delete');}finally{manual.close();}
 // Existing empty legacy data must not re-seed deleted history; two tabs cannot silently overwrite one another.
 const b=await page(),c=await page({idb:b.idb,local:b.local()});try{assert.equal(b.w.txns.length,0);await b.w.doExpenseImport([file(b.w)]);const result=await c.w.doExpenseImport([file(c.w)]);assert(!result.ok);assert(c.w.EXP_LAST_ERROR.includes('Another Expense tab'));assert.equal((await snapshot(b.idb)).data.exp3.repair.length,57);console.log('PASS empty legacy list stays empty; simultaneous Expense tabs report revision conflict');}finally{b.close();c.close();}
})().then(()=>clearTimeout(watchdog)).catch(e=>{clearTimeout(watchdog);console.error(e);process.exitCode=1;});
