const assert=require('assert');
const {backend,page,delay,clone}=require('./ga-browser-fixtures.cjs');
(async()=>{
 const s=backend(),p=await page('receiving.html',s);
 try{
  const w=p.w,$=id=>w.document.getElementById(id),value=x=>w.eval(x);
  w.eval("scheduleReceivingAutoUpload=function(){};items=[{id:'paper',name:'Paper',category:'Stationary',unit:'pcs',unitPrice:2,openingStock:10,stock:10,versions:[],archived:false}];records=[];filteredItems=items.slice();");
  w.showPage('receive');w.setReceiveTab('receive');
  assert.equal(value('_recvBatchLines.length'),0);w.addReceiveBatchLine();
  assert.equal(value('_recvBatchLines[0].itemId'),'','never default to first item');
  assert.equal($('receive-content').querySelector('.itemfield select').value,'');
  w.removeReceiveBatchLine(0);assert.equal(value('_recvBatchLines.length'),0);assert.equal($('receive-content').querySelectorAll('.recv-edit-card').length,0);
  for(const l of ['zh','en','km']){w.setLang(l);w.renderReceiveContent();assert.equal(value('_recvBatchLines.length'),0);assert(!/undefined/.test($('recv-catalog-intro').textContent));}w.setLang('en');
  w.addReceiveBatchLine();w.recvBatchSet(0,'qty',2);w.recvBatchSet(0,'date','2026-09-21');
  let field=$('receive-content').querySelector('.itemfield');w.recvCatalogSearch('receive',0,'Plastic dustpan',field);
  assert(field.querySelector('[data-catalog-search-status]').textContent.includes('not found'));
  w.recvNewCatalogItem('receive',0);assert.equal($('f-name').value,'Plastic dustpan');
  $('f-cat').value='Cleaning';$('f-size').value='Blue';$('f-unit').value='pcs';$('f-unit-price').value='3.20';
  const first=w.saveItem(),second=w.saveItem();assert.equal(await second,false);assert.equal(await first,true);
  const dust=value("items.find(x=>x.name==='Plastic dustpan').id");
  assert.equal(value('items.length'),2);assert.equal(value('records.length'),0,'master creation is not a receipt');assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),0);
  assert.equal(value('_recvBatchLines[0].itemId'),dust);assert.equal(value('_recvBatchLines[0].qty'),2);
  assert($('receive-content').querySelector('.recv-catalog-details').textContent.includes('3.20'));
  // Duplicate catalog entry opens the existing record and allows selecting it.
  w.recvNewCatalogItem('receive',0);$('f-name').value='Plastic dustpan';$('f-cat').value='Cleaning';$('f-size').value='Blue';$('f-unit').value='pcs';
  assert.equal(await w.saveItem(),false);assert.equal($('edit-id').value,dust);assert(!$('recv-use-existing-item').hidden);$('recv-use-existing-item').click();assert.equal(value('items.length'),2);
  w.addReceiveBatchLine();assert.equal(w.saveReceiveBatchLines(),false,'incomplete rows cannot silently disappear');assert.equal(value('records.length'),0);w.removeReceiveBatchLine(1);
  assert.equal(w.saveReceiveBatchLines(),true);assert.equal(value('records.length'),1);assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),2);assert.equal(value('records[0].amount'),6.4);assert.equal(w.saveReceiveBatchLines(),false);
  assert.equal(value('_recvBatchLines.length'),0,'save leaves no phantom next receipt');
  w.editItem(dust);$('f-name').value='Plastic dustpan - Blue';assert.equal(await w.saveItem(),true);assert.equal(value('records[0].itemName'),'Plastic dustpan','history retains original item name');
  assert(w.recvCatalogArchive(dust,false));assert.equal(value('records.length'),1);assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),2);
  w.addReceiveBatchLine();assert(!$('receive-content').querySelector('.itemfield select').innerHTML.includes(dust));
  w.showPage('items');$('filter-master-type').value='archived';w.filterItems();let row=$('row-'+dust);assert(row);assert(row.textContent.includes('Restore'));assert(w.recvCatalogArchive(dust,true));
  $('filter-master-type').value='';w.filterItems();w.showPage('receive');w.setReceiveTab('receive');
  w.eval(`Object.assign(_recvBatchLines[0],{poId:'stale',poNumber:'OLD-PO',poSourceItemId:'old',poItemIndex:2,purchaseSource:'monthly_po',sourceRef:'OLD-PO'})`);
  w.recvBatchPoChange(0,'');assert(!value('_recvBatchLines[0].poId'));assert.equal(value('_recvBatchLines[0].purchaseSource'),'other');
  w.eval("Object.assign(_recvBatchLines[0],{poId:'stale',poNumber:'OLD-PO',purchaseSource:'monthly_po'})");w.recvBatchItemChange(0,dust);assert(!value('_recvBatchLines[0].poNumber'));
  w.eval("Object.assign(_recvBatchLines[0],{poId:'stale',poNumber:'OLD-PO',purchaseSource:'monthly_po'})");w.recvBatchSet(0,'purchaseSource','other');assert(!value('_recvBatchLines[0].poId'));
  w.removeReceiveBatchLine(0);w.setReceiveTab('issue');w.addIssueBatchLine();assert.equal(value('_recvIssueLines[0].itemId'),'');w.removeIssueBatchLine(0);assert.equal(value('_recvIssueLines.length'),0);
  w.addIssueBatchLine();w.eval(`Object.assign(_recvIssueLines[0],{itemId:${JSON.stringify(dust)},date:'2026-09-21',qty:3,dept:'GA'})`);
  assert.equal(w.saveIssueBatchLines(),false);assert.equal(value('records.length'),1);
  w.eval('_recvIssueLines[0].qty=0.625');assert.equal(w.saveIssueBatchLines(),true);assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),1.375);assert.equal(value('records[1].amount'),2);
  w.setReceiveTab('receive');w.addReceiveBatchLine();w.addReceiveBatchLine();w.eval(`_recvBatchLines.forEach(r=>Object.assign(r,{itemId:${JSON.stringify(dust)},date:'2026-09-22',qty:3}))`);
  assert.equal(w.saveReceiveBatchLines(),false);assert.equal(value('records.length'),2);w.removeReceiveBatchLine(1);
  const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k==='vrt_receive_data')throw Error('quota test');return set.call(this,k,v)};
  assert.equal(w.saveReceiveBatchLines(),false);assert.equal(value('records.length'),2);assert.equal(value('_recvBatchLines.length'),1);assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),1.375);
  w.Storage.prototype.setItem=set;assert.equal(w.saveReceiveBatchLines(),true);assert.equal(value('records.length'),3);assert.equal(value(`recvItemById(${JSON.stringify(dust)}).stock`),4.375);
  // A failed item save can be retried without creating a second master ID.
  w.recvNewCatalogItem('receive',-1);$('f-name').value='QA catalog retry';$('f-unit').value='pcs';
  w.Storage.prototype.setItem=function(k,v){if(k==='vrt_receive_data')throw Error('quota test');return set.call(this,k,v)};
  assert.equal(await w.saveItem(),false);assert($('item-form').classList.contains('show'));
  assert.equal(JSON.parse(w.localStorage.getItem('vrt_receive_data')).items.filter(it=>it.name==='QA catalog retry').length,0);
  w.Storage.prototype.setItem=set;assert.equal(await w.saveItem(),true);assert.equal(value("items.filter(it=>it.name==='QA catalog retry').length"),1);
  w.removeReceiveBatchLine(0);
  // Failure of the optional legacy settings copy does not undo the complete snapshot.
  w.Storage.prototype.setItem=function(k,v){if(k==='vrt_receive_settings')throw Error('legacy mirror quota');return set.call(this,k,v)};
  w.eval("settings.dept='QA warehouse';saveLocal();settings.dept='old';loadLocal();");assert.equal(value('settings.dept'),'QA warehouse');w.Storage.prototype.setItem=set;
  // Cloud transfer and a clean reopen carry the catalog, history and stock together.
  p.online(true);assert((await w.recvCloudPush({silent:true})).ok);
  const other=await page('receiving.html',s);try{other.online(true);await other.w.recvCloudPull({silent:true});assert.equal(other.w.eval(`recvItemById(${JSON.stringify(dust)}).unit`),'pcs');assert.equal(other.w.eval('records.length'),3);assert.equal(other.w.eval(`recvItemById(${JSON.stringify(dust)}).stock`),4.375);assert.deepEqual(other.errors,[]);}finally{other.close();}
  w.recvSyncStatus('PO is no longer approved: PO-SEP / Plastic dustpan [REJECTED]','err');assert($('recv-po-conflict-help').textContent.includes('PO-SEP'));assert($('recv-po-conflict-help').textContent.includes('not accepted'));w.recvSyncStatus('OK','up');assert(!$('recv-po-conflict-help'));
  assert.deepEqual(p.errors,[]);
  console.log('PASS Receiving actual page: empty selection, last-line removal, 3 languages, search/new item/return, duplicate master, atomic batch validation, receipt/issue decimals, history-preserving edits, archive/restore, stale PO clearing, failed-save retry, cloud/reopen, readable PO conflict');
 }finally{p.close();}
 const n=backend(),line={id:'source-bleach',name:'Bleach',qty:5};n.po('approved','2026-09',[line]);const draft=n.po('draft','2026-09',[line],'DRAFT');draft[1]='';
 const ordinary={id:'ordinary',type:'receive',date:'2026-09-21',itemId:'bleach',itemName:'Bleach',qty:9,purchaseSource:'other',remarks:'Extra supplies after monthly PO'};
 assert.equal(n.c.monthlyPoReceiptMatches_(ordinary,'approved','PO-approved','2026-09',line,0),false,'an explicit other source outranks remarks');
 const imported={...ordinary,id:'historical',qty:2,purchaseSource:'monthly_po'};
 assert.equal(n.c.monthlyPoReceiptMatches_(imported,'draft','','2026-09',line,0),false,'unnumbered draft does not claim legacy monthly imports');
 n.files.set('ordinary-part',{records:[{row:ordinary},{row:imported}]});n.c.validateMonthlyPoReceiptCommit_({}, {'m:2026-09':'ordinary-part'});
 const rejected=n.po('rejected','2026-09',[line],'REJECTED');
 const linked={...ordinary,id:'linked',qty:1,poId:'rejected',poNumber:'PO-rejected',poSourceItemId:line.id,purchaseSource:'monthly_po'};
 n.files.set('bad-part',{records:[{row:linked}]});assert.throws(()=>n.c.validateMonthlyPoReceiptCommit_({}, {'m:2026-09':'bad-part'}),e=>e.code==='PO_RECEIPT_CONFLICT'&&e.message.includes('PO-rejected')&&e.message.includes('Bleach'));
 n.files.set('bad-part',{records:[{row:{...linked,poId:'approved',poNumber:'PO-approved',qty:6}}]});assert.throws(()=>n.c.validateMonthlyPoReceiptCommit_({}, {'m:2026-09':'bad-part'}),e=>e.code==='PO_RECEIPT_CONFLICT');
 console.log('PASS actual GAS: other-source notes excluded, legacy import not assigned to unnumbered drafts, named rejection and over-receipt remain blocked');
})().catch(e=>{console.error(e);process.exitCode=1});
