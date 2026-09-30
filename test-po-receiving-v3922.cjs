const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const {JSDOM,VirtualConsole}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x)),delay=ms=>new Promise(r=>setTimeout(r,ms));
function backend(){
 const files=new Map(),props=new Map(),poRows=[Array(17).fill('header')];
 const c={console,Date,JSON,Utilities:{formatDate:(d,t,f)=>{const iso=new Date(d).toISOString();return f==='yyyy-MM'?iso.slice(0,7):iso.slice(0,10)},getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest())},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType(){return this},getContent:()=>s})}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'backend/AC_GA_EXP.gs'),'utf8'),c);
 c.nowTimestamp=()=>new Date().toISOString();c.markMonthlyActivity=()=>{};c.activityPeriodsFromData=()=>[];
 c.getSheet=()=>({getDataRange:()=>({getValues:()=>clone(poRows)})});c.readKvObject_=()=>null;c.gaSmartLegacyExists_=()=>false;
 c.gaSmartFolder_=()=>({getFilesByName:n=>({hasNext:()=>files.has(n)})});
 c.gaSmartReadFile_=n=>files.has(n)?clone(files.get(n)):null;c.gaSmartWriteFile_=(n,d)=>{files.set(n,clone(d));return {}};
 function po(id,period,items,status='APPROVED'){const row=Array(17).fill('');row[0]=id;row[1]='PO-'+id;row[2]=+period.slice(0,4);row[3]=+period.slice(5)-1;row[4]=status;row[5]='QA';row[14]=JSON.stringify(items);poRows.push(row);return row;}
 function request(url,opt){const data=opt&&opt.body?JSON.parse(opt.body):null;return JSON.parse((data?c.doPost({postData:{contents:JSON.stringify(data)},parameter:{}}):c.doGet({parameter:Object.fromEntries(new URL(url).searchParams)})).getContent());}
 return {c,files,props,poRows,po,request};
}
async function page(name,server,stored={}){
 let online=false;const requests=[],errors=[],notices=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext|navigation|scrollTo/.test(e.message))errors.push(e.message);});
 const html=fs.readFileSync(path.join(root,name),'utf8').replace(/<script[^>]*src="(shared\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,src)=>'<script>'+fs.readFileSync(path.join(root,src),'utf8')+'</script>');
 const dom=new JSDOM(html,{url:'https://qa.invalid/'+name,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.indexedDB=new IDBFactory();w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.Chart=class{destroy(){}update(){}};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const [k,v]of Object.entries(stored))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 w.fetch=async(url,opt)=>{if(!online)throw Error('QA offline');requests.push({url,opt});const r=server.request(url,opt);return {ok:true,text:async()=>JSON.stringify(r)}};
 }});await delay(500);const w=dom.window;if(w.toast)w.toast=(s)=>notices.push(s);return {w,errors,notices,requests,online:v=>{online=v},close:()=>dom.window.close()};
}
(async()=>{
 const s=backend();s.po('sept','2026-09',[{id:'paper-source',name:'Paper',qty:30.25,unit:'pcs'},{id:'box-source',name:'Boxes',qty:2.5,unit:'box'}]);s.po('aug','2026-08',[{id:'paper-source',name:'Paper',qty:9,unit:'pcs'}]);s.po('dec','2025-12',[{id:'paper-source',name:'Paper',qty:7,unit:'pcs'}]);
 const first=await page('receiving.html',s);first.online(true);
 try{
 const w=first.w;w.eval(`items=[{id:'paper',name:'Paper',unit:'pcs',unitPrice:2,openingStock:0,stock:10},{id:'boxes',name:'Boxes',unit:'box',unitPrice:3,openingStock:0,stock:0}];records=[{id:'remote-receipt',date:'2026-09-01',type:'receive',itemId:'paper',itemName:'Paper',qty:10,unitPrice:2,amount:20,poId:'sept',poNumber:'PO-sept',poItemIndex:0,poSourceItemId:'paper-source',purchaseSource:'monthly_po'}];`);
 assert((await w.recvCloudPush({silent:true})).ok);assert.equal(s.c.readReceivingRecordsForMonthlyPo_().length,1);
 }finally{first.close();}
 const p=await page('receiving.html',s);p.online(true);try{
 const w=p.w,$=id=>w.document.getElementById(id);w.eval("periodMode='month';periodDate=new Date(2026,8,1);receiveTab='po';scheduleReceivingAutoUpload=function(){};");
 await w.loadRecvPoApproved(true);w.renderPoReceiveTab();assert.equal(w.eval('_recvPoFlat.length'),2,'September only, not August');assert.equal(w.eval('_recvPoFlat[0].item.receivedQty'),10,'fresh browser retains another device receipt');assert.equal(w.eval('records.length'),1);
 w.applyPoReceiveDefaults();assert.equal($('po-qty-0').value,'20.25');assert.equal($('po-qty-1').value,'2.5');assert.equal(w.eval('records.length'),1);
 $('po-qty-0').value='5.125';$('po-qty-0').dispatchEvent(new w.Event('input'));$('po-date-0').value='2026-10-02';$('po-date-1').value='2026-09-14';$('po-batch-inspector').value='QA Inspector';
 let confirms=0;w.confirm=()=>{confirms++;return true};assert.equal(await w.savePoReceiveBatch(),true);assert.equal(confirms,1,'one confirmation posts all selected lines');assert.equal(w.eval('records.length'),3);assert.equal(w.eval("items.find(i=>i.id==='paper').stock"),15.125);assert.equal($('po-qty-0').value,'0','batch inputs reset');await w.savePoReceiveBatch();assert.equal(w.eval('records.length'),3,'repeat save does not post twice');
 assert((await w.recvCloudPush({silent:true})).ok);const report=s.request('https://x.invalid/?action=monthlyPoApproved&year=2026');assert.equal(report.data.find(x=>x.poId==='sept').items[0].receivedQty,15.125);assert.equal(report.data.find(x=>x.poId==='sept').items[1].remainingQty,0);
 const recordId=w.eval("records.find(r=>r.date==='2026-10-02').id");w.editMonthlyPoReceipt(recordId);$('rf-qty').value='10';w.saveReceiveRecord();await delay(100);assert.equal(w.eval("records.find(r=>r.date==='2026-10-02').amount"),20,'edited amount recalculates at original price');assert.equal(w.eval("items.find(i=>i.id==='paper').stock"),20);assert((await w.recvCloudPush({silent:true})).ok);
 w.deleteRecord(recordId);await delay(100);await w.recvCloudPull({silent:true});assert.equal(w.eval("records.filter(r=>r.date==='2026-10-02').length"),0,'pull before push preserves intentional last-row deletion');assert.equal(w.eval("items.find(i=>i.id==='paper').stock"),10);assert((await w.recvCloudPush({silent:true})).ok);await w.recvCloudPull({silent:true});assert.equal(w.eval("records.filter(r=>r.date==='2026-10-02').length"),0,'last receipt in month stays deleted');assert(!Object.keys(s.files.get('ga_receiving_manifest.json').hashes).includes('m:2026-10'));
 await w.loadRecvPoApproved(true);w.renderPoReceiveTab();w.applyPoReceiveDefaults();assert.equal($('po-qty-0').value,'20.25');$('po-batch-inspector').value='QA';
 // Approved quantity changes after preview: refresh must stop the stale batch before local posting.
 s.poRows[1][14]=JSON.stringify([{id:'paper-source',name:'Paper',qty:20,unit:'pcs'},{id:'box-source',name:'Boxes',qty:2.5,unit:'box'}]);const before=w.eval('records.length');assert.equal(await w.savePoReceiveBatch(),false);assert.equal(w.eval('records.length'),before);assert(p.notices.some(n=>n.includes('待收量已變更')));
 w.eval("periodDate=new Date(2025,11,1)");await w.loadRecvPoApproved(true);w.renderPoReceiveTab();assert.equal(w.eval('_recvPoFlat.length'),1);assert.equal(w.eval('_recvPoFlat[0].po.poId'),'dec','year follows selected PO month');
 p.online(false);w.applyPoReceiveDefaults();$('po-batch-inspector').value='QA';assert.equal(await w.savePoReceiveBatch(),false);assert.equal(w.eval('records.length'),before,'offline verification does not post a new batch');
 assert.deepEqual(p.errors,[]);console.log('PASS actual frontend + GAS: selected month/year, other-device receipts, cross-month totals, decimal batch, one confirmation, repeat-click protection, edit amount/stock, delete last month row, changed PO and offline block');
 }finally{p.close();}
 // A deletion and another device's new receipt in the same month must both survive reconciliation.
 const left=await page('receiving.html',s),right=await page('receiving.html',s);left.online(true);right.online(true);
 try{
  for(const client of [left,right]){client.w.eval("scheduleReceivingAutoUpload=function(){};");await client.w.recvCloudPull({silent:true});}
  left.w.deleteRecord('remote-receipt');
  right.w.eval("recvAddRecord({date:'2026-09-15',type:'receive',itemId:'paper',itemName:'Paper',qty:1,purchaseSource:'other'});recvRebuildAllStocks();saveLocal();");
  assert((await right.w.recvCloudPush({silent:true})).ok);
  assert((await left.w.recvCloudPush({silent:true})).ok);
  await right.w.recvCloudPull({silent:true});
  assert(!s.c.readReceivingRecordsForMonthlyPo_().some(r=>r.id==='remote-receipt'));
  assert.equal(right.w.eval("records.filter(r=>r.id==='remote-receipt').length"),0);
  assert(right.w.eval("records.some(r=>r.date==='2026-09-15'&&r.qty===1)"));
  console.log('PASS two devices: deleting a receipt and adding another in the same month preserves deletion and new receipt');
  for(const tab of ['receive','issue','balance','po'])right.w.setReceiveTab(tab);
  right.w.setReceiveTab('receive');
  const workbook=right.w.XLSX.utils.book_new();right.w.XLSX.utils.book_append_sheet(workbook,right.w.XLSX.utils.aoa_to_sheet([['Date','Type','Item','Qty','Purchase Source','Department','Inspector'],['2026-08-09','Receive','QA imported supply',0.625,'Other','QA','QA']]),'Movement');
  const bytes=right.w.XLSX.write(workbook,{bookType:'xlsx',type:'array'});right.w.importExcel({files:[{name:'QA_Movement.xlsx',arrayBuffer:async()=>bytes}],value:''});await delay(100);
  assert(right.w.eval("records.some(r=>r.itemName==='QA imported supply'&&r.date==='2026-08-09'&&r.qty===0.625)"),'Receiving movement Excel preserves original date and decimal qty');
  assert.deepEqual(right.errors,[]);
  console.log('PASS Receiving receive/issue/balance/PO tabs and actual movement Excel date/decimal import');

 }finally{left.close();right.close();}
 // Directly exercise the locked manifest commit against stale and invalid candidates.
 const manifest=clone(s.files.get('ga_receiving_manifest.json')),base=clone(manifest.hashes);const bucket='m:2026-09',oldFile=manifest.bucketFiles[bucket],oldPart=s.files.get(oldFile),next=clone(oldPart.records);next.push({_syncId:'record:overflow',kind:'record',row:{id:'overflow',date:'2026-09-14',type:'receive',itemId:'paper',itemName:'Paper',qty:99,poId:'sept',poNumber:'PO-sept',poSourceItemId:'paper-source',poItemIndex:0,purchaseSource:'monthly_po'}});
 const body={action:'smartCommit',tool:'receiving',uploadId:'qa-stage',baseHashes:base,baseMetaHash:manifest.metaHash||'',hashes:{...base,[bucket]:'bad'},counts:manifest.counts,meta:{_smartMetaHash:manifest.metaHash||''}};s.files.set(s.c.gaSmartStageName_('receiving','qa-stage',bucket,'bad'),{records:next});
 let out=JSON.parse(s.c.handleGaSmartCommitPost_(body).getContent());assert.equal(out.code,'PO_RECEIPT_CONFLICT');assert.deepEqual(s.files.get('ga_receiving_manifest.json'),manifest);
 out=JSON.parse(s.c.handleGaSmartCommitPost_({...body,baseHashes:{...base,extra:'stale'}}).getContent());assert.equal(out.code,'SMART_CONFLICT');assert.deepEqual(s.files.get('ga_receiving_manifest.json'),manifest);
 out=JSON.parse(s.c.handleGaSmartCommitPost_({...body,baseHashes:undefined}).getContent());assert.equal(out.code,'CLIENT_UPDATE');
 const broken=clone(manifest);broken.bucketFiles[bucket]='missing-file';s.files.set('ga_receiving_manifest.json',broken);assert.equal(s.request('https://x.invalid/?action=monthlyPoApproved&year=2026').ok,false,'missing data never becomes zero');s.files.set('ga_receiving_manifest.json',manifest);
 // Expense uses the same concurrency check, independently from monthly PO constraints.
 s.files.set('ga_expense_manifest.json',{hashes:{'m:2026-09':'expense-current'},metaHash:'current',bucketFiles:{}});out=JSON.parse(s.c.handleGaSmartCommitPost_({...body,tool:'expense',baseHashes:{},baseMetaHash:''}).getContent());assert.equal(out.code,'SMART_CONFLICT');
 console.log('PASS locked GAS commit: stale receiving/expense writes, missing client token, over-receipt and unavailable bucket are rejected without changing cloud manifest');
 const proc=await page('procurement.html',s);proc.online(true);try{const w=proc.w;w.eval("cu={id:'qa',name:'QA',role:'applicant'};curMonth=8;renderRecv();");await w.procRefreshMonthlyReceipts(true);assert(w.procMonthlyReceiptUrl().includes('poPeriod=2026-09'));assert(w.document.getElementById('proc-monthly-receipts').textContent.includes('PO-sept'));assert(!w.document.getElementById('proc-monthly-receipts').textContent.includes('PO-aug'));w.eval("document.getElementById('page-recv').classList.add('on');curMonth=7;render();");await w.procRefreshMonthlyReceipts(true);assert(w.procMonthlyReceiptUrl().includes('poPeriod=2026-08'));assert(w.document.getElementById('proc-monthly-receipts').textContent.includes('PO-aug'));assert.deepEqual(proc.errors,[]);console.log('PASS Procurement current-month progress and batch entry use the same approved PO source');}finally{proc.close();}
 const dgServer={request(url){return url.includes('/legacy/')?{ok:true}:{ok:true,version:'3.9.22',capabilities:['strictActionErrors','procStateToken','smartSync','smartCommitToken','monthlyPoReceiptGuard'],actions:{},revision:1}}};
 const diag=await page('procurement.html',dgServer,{'ac_ga_exp_config':{gasUrl:'https://script.google.com/macros/s/legacy/exec',session:'keep'},'qa-data':'retained'});diag.online(true);try{const w=diag.w;await assert.rejects(w.GA.backend.require('strictActionErrors'));assert(w.document.getElementById('ga-backend-alert'));w.GA.openCloudDiagnostic();await delay(30);await w.document.getElementById('ga-diag-default').onclick();assert(w.GA.gasUrl().includes('/legacy/'));assert(diag.requests.every(r=>!r.opt||!r.opt.method||r.opt.method==='GET'),'diagnosis is read-only');const input=w.document.getElementById('ga-diag-url');input.value=w.GA.DEFAULT_GAS;input.dispatchEvent(new w.Event('input'));await w.document.getElementById('ga-diag-check').onclick();assert(w.document.getElementById('ga-diag-apply').disabled);w.document.getElementById('ga-diag-same').checked=true;w.document.getElementById('ga-diag-same').dispatchEvent(new w.Event('change'));assert(!w.document.getElementById('ga-diag-apply').disabled);w.document.getElementById('ga-diag-apply').click();assert.equal(w.GA.gasUrl(),w.GA.DEFAULT_GAS);assert.equal(w.GA.session(),'');assert.equal(w.localStorage.getItem('qa-data'),'retained');assert.deepEqual(diag.errors,[]);console.log('PASS login diagnostics: compare legacy/current URLs, fresh no-session probes, no automatic destination change, verified explicit apply preserves local data');}finally{diag.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
