const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(page){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext|navigation|scrollTo/.test(e.message))errors.push(e.message);});
 let html=fs.readFileSync(path.join(root,page),'utf8').replace(/<script[^>]*src="(shared\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,src)=>'<script>'+fs.readFileSync(path.join(root,src),'utf8')+'</script>');
 const dom=new JSDOM(html,{url:'https://qa.invalid/'+page,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 w.indexedDB=new IDBFactory();w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.HTMLCanvasElement.prototype.getContext=()=>null;w.Chart=class{destroy(){} update(){}};
 w.fetch=async()=>{throw Error('QA blocks all external requests');};
 }});await delay(600);return {w:dom.window,errors,close:()=>dom.window.close()};
}
(async()=>{
 // Syntax check every page and local shared JS, independent of browser stubs.
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){const h=fs.readFileSync(path.join(root,file),'utf8');for(const m of h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);}
 for(const file of fs.readdirSync(path.join(root,'shared')).filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,'shared',file),'utf8'));
 console.log('PASS all HTML inline scripts and shared JS syntax');
 const p=await setup('procurement.html');try{
 const w=p.w,$=id=>w.document.getElementById(id);w.eval("cu={id:'u1',uid:'qa',role:'applicant',name:'QA'};curMonth=8;poStatus='draft';render();");
 const item=w.eval('allItems()[0]'),other=w.eval('allItems()[1]'),year=w.eval('YEAR');let requests=[],saves=[];
 const source={poId:'last',poNumber:'PO-LAST',year,month:7,status:'approved',items:[{id:item.id,name:item.name,qty:30.25,note:'check stock'},{id:other.id,name:other.name,qty:2}]};
 const prior={...source,poId:'dec',poNumber:'PO-DEC',year:year-1,month:11};
 w.GA.gasGet=async(action,data)=>{requests.push([action,data]);return {ok:true,data:data.year===year?[source]:[prior]};};
 w.GA.gasPost=async(action,data)=>{saves.push(JSON.parse(JSON.stringify(data)));return {ok:true};};
 await w.procDraftOpen(false);assert.equal($('po-work-source').value,'0');$('po-work-copy').click();
 assert.equal(w.eval('ordItems().length'),0,'copy is isolated until save');
 assert.equal(w.document.querySelector('[data-qty="0"]').value,'30.25');
 const input=w.document.querySelector('[data-qty="0"]');input.value='12.125';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 $('po-work-search').value='nonexistent';$('po-work-search').dispatchEvent(new w.Event('input'));assert(w.document.querySelector('#po-work-rows tr').hidden);$('po-work-search').value='';$('po-work-search').dispatchEvent(new w.Event('input'));
 w.document.querySelector('[data-remove="1"]').click();$('po-work-name').value='QA New Item';$('po-work-unit').value='box';$('po-work-create').click();
 await $('po-work-save').onclick();assert.equal(saves.length,0,'review required');$('po-work-reviewed').checked=true;await $('po-work-save').onclick();
 assert.equal(saves.length,1);assert.equal(saves[0].ords[item.id].qty,12.125);assert.equal(saves[0].poStatus,'draft');assert.equal(saves[0].submitAckId,'');assert.equal(saves[0].poNumber,null);assert.deepEqual(saves[0].sigs,{applicant:null,verifier:null,approver:null});assert.equal(saves[0].customItems.filter(i=>i.name==='QA New Item').length,1);await w.procDraftOpen(true);assert(w.document.getElementById('po-work-rows').textContent.includes('QA New Item'),'local draft restores added catalog item');w.document.getElementById('po-work-dialog').close();assert.equal(source.items[0].qty,30.25);
 assert.equal(w.GAPO.add(.1,.2),.3);assert.throws(()=>w.GAPO.qty('1.12345'));assert.throws(()=>w.GAPO.qty('Infinity'));assert.throws(()=>w.GAPO.qty('-1'));
 assert.equal(w.GAPO.match({id:1,name:'Same'},[{id:1,name:'Different'},{id:2,name:'Same'},{id:3,name:'Same'}],()=> 'pcs'),null);
 await w.procDraftOpen(false);$('po-work-month').value=0;$('po-work-source').value='0';$('po-work-copy').click();assert($('po-work-message').textContent.includes('早於'));$('po-work-source').value='1';$('po-work-copy').click();assert.equal(w.document.querySelector('[data-qty="0"]').value,'30.25','previous December works');
 w.GA.gasPost=async()=>{throw Error('offline');};$('po-work-reviewed').checked=true;await $('po-work-save').onclick();assert($('po-work-dialog').open);assert($('po-work-message').textContent.includes('雲端未確認'));assert(w.localStorage.getItem('ga_po_draft_v3920_qa'));
 w.GA.gasPost=async(action,data)=>{saves.push(data);return {ok:true};};$('po-work-reviewed').checked=true;await $('po-work-save').onclick();assert(!$('po-work-dialog').open);
 await w.procDraftOpen(false);w.eval('poStatus="submitted"');$('po-work-reviewed').checked=true;const before=saves.length;await $('po-work-save').onclick();assert.equal(saves.length,before,'concurrent state change blocked');
 assert.equal(p.errors.length,0,p.errors.join('\n'));
 console.log('PASS prior-year copy, editable decimals, search/add/remove, manual review, fresh approvals, unit match, source unchanged, cloud failure/retry, state conflict');
 }finally{p.close();}
 const r=await setup('receiving.html');try{
 const w=r.w,$=id=>w.document.getElementById(id);w.eval(`receiveTab='po';_recvPoLoadedYear=2026;_recvPoLoading=false;_recvPoView='all';records=[{id:'prior',date:'2026-09-01',type:'receive',itemId:'master',itemName:'QA Stock',qty:10,poId:'qa-po',poNumber:'QA-PO',poItemIndex:0,purchaseSource:'monthly_po'}];items=[{id:'master',name:'QA Stock',unit:'pcs',openingStock:0,stock:10}];_recvPoCache=[{poId:'qa-po',poNumber:'QA-PO',period:'2026-09',items:[{name:'QA Stock',approvedQty:30.25,receivedQty:10,remainingQty:20.25,unit:'pcs'}]}];renderPoReceiveTab();`);
 assert.equal($('po-qty-0').value,'0');w.applyPoReceiveDefaults();assert.equal($('po-qty-0').value,'20.25');assert.equal(w.eval('records.length'),1,'fill must not post');
 $('po-qty-0').value='5.125';$('po-qty-0').dispatchEvent(new w.Event('input'));assert.equal($('po-qty-0').closest('tr').cells[6].textContent,'15.125');
 $('po-batch-inspector').value='QA Inspector';$('po-batch-inspector').dispatchEvent(new w.Event('input'));w.renderPoReceiveTab();assert.equal($('po-qty-0').value,'5.125','refresh preserves draft');assert.equal($('po-batch-inspector').value,'QA Inspector');
 $('po-qty-0').value='21';w.savePoReceiveBatch();assert.equal(w.eval('records.length'),1,'over receipt blocked');
 $('po-qty-0').value='5.125';w.confirm=()=>false;w.savePoReceiveBatch();assert.equal(w.eval('records.length'),1,'cancel does not save');w.confirm=()=>true;
 w.eval("scheduleReceivingAutoUpload=function(){};");w.savePoReceiveBatch();assert.equal(w.eval('records.length'),2,'actual legacy save is called');assert.equal(w.eval('records[1].qty'),5.125);assert.equal(w.eval('items[0].stock'),15.125);assert.equal(w.eval('_recvPoCache[0].items[0].remainingQty'),15.125);
 assert.equal($('po-qty-0').value,'0','saved input clears');w.savePoReceiveBatch();assert.equal(w.eval('records.length'),2,'repeat click does not post again');
 w.applyPoReceiveDefaults();assert.equal($('po-qty-0').value,'15.125');assert.equal(w.eval('records.length'),2);assert(!w.document.querySelector('[onclick="receiveAllPoNow()"]'));
 assert.equal(r.errors.length,0,r.errors.join('\n'));
 console.log('PASS PO remaining prefill, live decimal balance, refresh retention, validation/cancel, real ledger save, no double stock, repeat click protection');
 }finally{r.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
