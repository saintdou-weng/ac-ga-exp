/* v3.9.22: selected PO month, verified receipt ledger, editable batch confirmation. */
(function(){
  'use strict';
  const T=(zh,en,km)=>lang==='zh'?zh:lang==='km'?(km||en):en;
  const $=id=>document.getElementById(id);
  const num=GA.num;
  let resetInputs=false, rendering=false, saving=false, savedInputs=new Map(), ledgerStamp='', batchDate='', inspector='', ledgerReady=false, lastAttempt=0, loadError='', loadPromise=null, loadYear=0;
  const cacheKey=()=> 'ga_po_receiving_v3922_'+GA.fingerprint([GA.gasUrl()]);
  const year=()=>periodDate.getFullYear();
  const poMonth=()=>GA.ymd(periodDate).slice(0,7);
  const fixed=v=>Math.round(Number(v||0)*10000)/10000;
  const norm=v=>String(v||'').trim().toLowerCase();
  const sameHashes=(a,b)=>JSON.stringify(Object.keys(a||{}).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b||{}).sort().map(k=>[k,b[k]]));
  const sourceId=x=>{const id=String(x.item.itemId||x.item.id||'');return id&&(x.po.items||[]).filter(it=>String(it.itemId||it.id||'')===id).length===1?id:'';};
  window.recvPoSourceItemId=sourceId;
  const lineKey=x=>JSON.stringify([x.po.poId||x.po.poNumber,sourceId(x)||[x.index,x.item.name,x.item.unit||'',x.item.size||'']]);
  window.recvPoInPeriod=po=>periodMode==='year'?String(po.period||'').slice(0,4)===String(year()):String(po.period||'')===poMonth();
  function matches(r,po,it,idx){
    if(!r||r.type!=='receive')return false;
    const hasId=!!(r.poId||r.poNumber),same=(r.poId&&String(r.poId)===String(po.poId))||(r.poNumber&&String(r.poNumber)===String(po.poNumber));
    if(same){if(r.poSourceItemId&&(it.itemId||it.id))return String(r.poSourceItemId)===String(it.itemId||it.id);if(r.poItemIndex!==undefined&&r.poItemIndex!==null&&r.poItemIndex!=='')return Number(r.poItemIndex)===idx;return norm(r.itemName)===norm(it.name);}
    return !hasId&&(r.purchaseSource==='monthly_po'||/monthly\s*po/i.test(r.remarks||''))&&norm(r.itemName)===norm(it.name)&&String(r.date||'').slice(0,7)===po.period;
  }
  window.recvReconcilePoCache=function(){
    (_recvPoCache||[]).forEach(po=>(po.items||[]).forEach((it,idx)=>{
      const local=(records||[]).filter(r=>matches(r,po,it,idx)).reduce((n,r)=>fixed(n+num(r.qty)),0);
      // Before the full ledger is verified, never turn another device's receipts into zero.
      const got=ledgerReady?local:Math.max(local,num(it._cloudReceived===undefined?it.receivedQty:it._cloudReceived));
      it.receivedQty=got;it.remainingQty=Math.max(0,fixed(num(it.approvedQty)-got));
    }));
  };
  window.loadRecvPoApproved=function(force){
    const target=year(),destination=GA.gasUrl();
    if(loadPromise){if(loadYear===target)return loadPromise;return loadPromise.then(()=>window.loadRecvPoApproved(true));}
    if(!force&&_recvPoLoadedYear===target&&Date.now()-lastAttempt<60000)return Promise.resolve(_recvPoCache);
    loadYear=target;lastAttempt=Date.now();loadError='';ledgerReady=false;_recvPoLoading=true;
    loadPromise=(async()=>{
      try{
        let response=await GA.gasGet('monthlyPoApproved',{year:target});
        if(!response||response.ok!==true||!Array.isArray(response.data))throw Error(T('雲端未回傳有效 PO 清單','Cloud returned no valid PO list','Cloud មិនបានផ្តល់បញ្ជី PO ត្រឹមត្រូវ'));
        const pulled=await recvCloudPull({silent:true});
        if(pulled&&pulled.ok===true&&response.receiptHashes&&pulled.remoteHashes&&!sameHashes(response.receiptHashes,pulled.remoteHashes))response=await GA.gasGet('monthlyPoApproved',{year:target});
        if(destination!==GA.gasUrl()||target!==year())return [];
        if(!response||!Array.isArray(response.data))throw Error('Invalid PO response');
        _recvPoCache=response.data.map(po=>Object.assign({},po,{items:(po.items||[]).map(it=>Object.assign({},it,{_cloudReceived:num(it.receivedQty)}))}));
        _recvPoLoadedYear=target;
        if(pulled&&pulled.ok===true&&response.receiptHashes&&pulled.remoteHashes&&sameHashes(response.receiptHashes,pulled.remoteHashes))ledgerReady=true;
        else if(pulled&&pulled.noCloud&&response.receiptSource==='legacy'&&_recvPoCache.every(po=>po.items.every(it=>!it._cloudReceived)))ledgerReady=true;
        else loadError=T('收貨帳本尚未與 PO 對齊，請重新整理後再確認收貨。','The receipt ledger and PO snapshot are not aligned. Refresh before confirming receipts.','សូមផ្ទុកឡើងវិញ ដើម្បីផ្ទៀងផ្ទាត់ PO និងការទទួល។');
        localStorage.setItem(cacheKey(),JSON.stringify({year:target,data:_recvPoCache,at:new Date().toISOString()}));
        window.recvReconcilePoCache();return _recvPoCache;
      }catch(e){loadError=e.message;toast(T('PO 重新核對失敗：','PO refresh failed: ','បរាជ័យផ្ទៀងផ្ទាត់ PO៖ ')+e.message,'error');return [];}
      finally{loadPromise=null;_recvPoLoading=false;}
    })();return loadPromise;
  };
  window.recvPoEnsureLoaded=function(){
    if(!loadPromise&&Date.now()-lastAttempt>60000)window.loadRecvPoApproved(false).then(()=>{if(receiveTab==='po')window.renderPoReceiveTab();});
  };
  function dateValid(d){const parsed=GA.parseYMD(d);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&parsed&&GA.ymd(parsed)===d;}
  function stamp(){return JSON.stringify((records||[]).filter(r=>r.type==='receive').map(r=>[r.id,r.qty,r.date,r.updatedAt]));}
  function capture(){
    if(!$('po-receive-preview'))return;
    (_recvPoFlat||[]).forEach((x,i)=>{if($('po-qty-'+i))savedInputs.set(lineKey(x),{qty:$('po-qty-'+i).value,date:$('po-date-'+i).value,checked:$('po-check-'+i).checked});});
    batchDate=($('po-batch-date')||{}).value||batchDate;inspector=($('po-batch-inspector')||{}).value||'';
  }
  function preview(){
    const units={};let count=0,invalid=false;
    (_recvPoFlat||[]).forEach((x,i)=>{
      const input=$('po-qty-'+i),check=$('po-check-'+i);if(!input||!check)return;
      const remaining=Number((Math.round(num(x.item.approvedQty)*10000)-Math.round(num(x.item.receivedQty)*10000))/10000);
      let q=0,bad=false;try{q=GAPO.qty(input.value||'0');if(q>remaining&&check.checked)bad=true;}catch(_){bad=check.checked;}
      input.step='0.0001';input.max=Math.max(0,remaining);input.classList.toggle('po-receive-invalid',bad);invalid=invalid||bad;
      const row=input.closest('tr'),cell=row&&row.cells[6];
      if(cell)cell.textContent=bad?'⚠':String((Math.round(remaining*10000)-(check.checked?Math.round(q*10000):0))/10000);
      if(check.checked&&q>0&&!bad){count++;const unit=x.item.unit||T('單位未填','unit unspecified');units[unit]=GAPO.add(units[unit]||0,q);}
    });
    const box=$('po-receive-preview');if(box){box.dataset.invalid=String(invalid);box.replaceChildren();const title=document.createElement('strong');title.className='po-receive-steps';title.textContent=T('① 帶入待收量 → ② 調整數量／日期 → ③ 核對並儲存','① Fill outstanding qty → ② Adjust qty / date → ③ Review & save');box.append(title,document.createTextNode(T('本次勾選：','Selected: ')+count+T(' 項；',' lines; ')+Object.entries(units).map(([u,q])=>q+' '+u).join(' · ')+(invalid?T(' ｜數量無效或超過待收量，請修正。',' | Invalid quantity or quantity exceeds outstanding balance.'):'')+T('。待收量＝核可採購量－已收量。請人工確認實際到貨、日期與檢查人；儲存前不會入帳。',' Outstanding = approved − already received. Check actual arrivals, dates and inspector. Filling inputs does not post receipts.')));}
    capture();return {count,invalid,units};
  }
  const baseRender=window.renderPoReceiveTab;
  window.renderPoReceiveTab=function(){
    if(rendering)return;rendering=true;
    try{
      const current=stamp();if(resetInputs||(current!==ledgerStamp&&!saving)){resetInputs=false;savedInputs.clear();ledgerStamp=current;}else capture();
      const out=baseRender.apply(this,arguments);
      const container=$('receive-content');if(!container)return out;
      const toolbar=container.querySelector('.recv-po-toolbar, .recv-batch-toolbar');
      if(toolbar){
        const fill=toolbar.querySelector('[onclick="applyPoReceiveDefaults()"]');
        if(fill){fill.textContent=T('📋 帶入全部 PO 待收量（可修改）','📋 Fill all outstanding PO quantities (editable)');fill.classList.add('po-receive-fill');}
        const instant=toolbar.querySelector('[onclick="receiveAllPoNow()"]');if(instant)instant.remove();
        const save=toolbar.querySelector('[onclick="savePoReceiveBatch()"]');if(save)save.textContent=T('💾 核對並儲存勾選收貨','💾 Review & save selected receipts');
        const box=document.createElement('div');box.id='po-receive-preview';toolbar.after(box);
        const context=document.createElement('div');context.className='recv-po-toolbar';context.id='po-month-context';
        context.innerHTML='<label>'+T('採購月份','PO month','ខែ PO')+' <input id="po-month-filter" type="month" value="'+poMonth()+'"></label><span id="po-source-state" role="status"></span>';
        container.prepend(context);$('po-month-filter').onchange=function(){if(!/^\d{4}-\d{2}$/.test(this.value))return;capture();periodMode='month';periodDate=GA.parseYMD(this.value+'-01');updatePeriodLabel();lastAttempt=0;renderPoReceiveTab();};
        $('po-source-state').textContent=(periodMode==='year'?String(year())+' · ':poMonth()+' · ')+(_recvPoLoading?T('核對雲端中…','Checking cloud…','កំពុងពិនិត្យ Cloud…'):loadError||T('核可 PO → 累計已收 → 本次實收','Approved PO → total received → actual receipt','PO អនុម័ត → បានទទួលសរុប → ទទួលលើកនេះ'));
        const priorNote=container.querySelector('.recv-note');if(priorNote)priorNote.textContent=T('本清單依採購月份篩選，已收量包含此 PO 跨月到貨。實際收貨日期決定入庫月份；請確認日期。未核可申請不會帶入收貨。','Filtered by PO month. Received totals include this PO’s deliveries in later months. The actual receipt date determines the stock month. Only approved POs can be received.','បញ្ជីតាមខែ PO។ បរិមាណបានទទួលរាប់បញ្ចូលខែបន្ទាប់។ ថ្ងៃទទួលកំណត់ខែចូលស្តុក។ ទទួលបានតែ PO អនុម័ត។');
      }
      if(batchDate&&$('po-batch-date'))$('po-batch-date').value=batchDate;
      if($('po-batch-inspector'))$('po-batch-inspector').value=inspector;
      (_recvPoFlat||[]).forEach((x,i)=>{
        const input=$('po-qty-'+i),check=$('po-check-'+i),date=$('po-date-'+i);if(!input)return;
        const old=savedInputs.get(lineKey(x)),full=num(x.item.remainingQty)<=0;
        input.value=full?'0':old?old.qty:'0';check.checked=!full&&!!(old&&old.checked);
        if(old)date.value=old.date;
        input.oninput=()=>{if(num(input.value)>0)check.checked=true;preview();};check.onchange=preview;date.onchange=preview;
      });
      if($('po-batch-inspector'))$('po-batch-inspector').oninput=capture;
      if($('po-batch-date'))$('po-batch-date').onchange=capture;
      preview();return out;
    }finally{rendering=false;}
  };
  window.applyPoReceiveDefaults=function(){
    const hasInput=(_recvPoFlat||[]).some((x,i)=>num(($('po-qty-'+i)||{}).value)>0);
    if(hasInput&&!confirm(T('以全部待收量取代目前輸入？帶入後仍可修改，尚不會儲存。','Replace current inputs with all outstanding quantities? You can edit afterward; nothing is saved yet.')))return;
    const date=($('po-batch-date')||{}).value||localYMD();
    (_recvPoFlat||[]).forEach((x,i)=>{const q=$('po-qty-'+i),d=$('po-date-'+i),c=$('po-check-'+i);if(!q)return;const remaining=Math.max(0,(Math.round(num(x.item.approvedQty)*10000)-Math.round(num(x.item.receivedQty)*10000))/10000);q.value=remaining;d.value=date;c.checked=remaining>0;});preview();
  };
  // Preserve the old entry point for bookmarks/handlers while removing immediate posting.
  window.receiveAllPoNow=window.applyPoReceiveDefaults;
  const baseSelect=window.selectRecvPoRows;
  window.selectRecvPoRows=function(){const out=baseSelect.apply(this,arguments);preview();return out;};
  const baseFull=window.receivePoFull;
  window.receivePoFull=function(i){const out=baseFull.apply(this,arguments);preview();return out;};
  const baseSave=window.savePoReceiveBatch;
  window.savePoReceiveBatch=async function(){
    if(saving)return;
    const p=preview();if(p.invalid||!p.count){toast(T('請選擇有效的到貨數量，且不得超過待收量。','Select valid received quantities within the outstanding balance.'),'error');return;}
    const who=String(($('po-batch-inspector')||{}).value||'').trim();
    if(!who){toast(T('請填寫檢查人，再核對儲存。','Enter the inspector before saving.'),'error');return;}
    const badDate=(_recvPoFlat||[]).some((x,i)=>{
      if(!$('po-check-'+i).checked||num($('po-qty-'+i).value)<=0)return false;
      const d=$('po-date-'+i).value;return !/^\d{4}-\d{2}-\d{2}$/.test(d)||isNaN(Date.parse(d+'T12:00:00Z'));
    });
    if(badDate){toast(T('請填寫每項收貨日期。','Enter a valid date for each receipt.'),'error');return;}
    const selection=(_recvPoFlat||[]).map((x,i)=>({key:lineKey(x),qty:$('po-qty-'+i).value,date:$('po-date-'+i).value,checked:$('po-check-'+i).checked})).filter(v=>v.checked&&num(v.qty)>0);
    if(selection.some(v=>!dateValid(v.date))){toast(T('請填寫有效的收貨日期','Enter a valid receipt date','សូមបំពេញថ្ងៃទទួលត្រឹមត្រូវ'),'error');return false;}
    saving=true;
    try{
      await GA.backend.require('monthlyPoReceiptGuard',{action:'Monthly PO receiving',force:true});
      await window.loadRecvPoApproved(true);
      if(!ledgerReady||loadError)throw Error(loadError||T('尚未確認最新收貨資料','Latest receipts were not verified','មិនទាន់ផ្ទៀងផ្ទាត់ការទទួលថ្មី'));
      const fresh=[];(_recvPoCache||[]).filter(recvPoInPeriod).forEach(po=>(po.items||[]).forEach((item,index)=>fresh.push({po,item,index})));
      for(const row of selection){const hit=fresh.find(x=>lineKey(x)===row.key);if(!hit||num(row.qty)>num(hit.item.remainingQty))throw Error(T('PO 或待收量已變更，請核對表格後再儲存；本次未入帳。','PO or outstanding quantity changed. Review the refreshed table; nothing was posted.','PO ឬចំនួននៅសល់បានផ្លាស់ប្តូរ។ សូមពិនិត្យមុនរក្សាទុក។'));}
      savedInputs.clear();selection.forEach(row=>savedInputs.set(row.key,row));renderPoReceiveTab();
      const dates=[...new Set(selection.map(v=>v.date))],checked=preview();
      if(!confirm(T('確認本次實際收貨並一次儲存？\n','Confirm actual arrivals and save this batch?\n','បញ្ជាក់ការទទួល និងរក្សាទុកជាក្រុម?\n')+selection.length+T(' 項：',' lines: ',' មុខ៖ ')+Object.entries(checked.units).map(([u,q])=>q+' '+u).join(' · ')+'\n'+dates.join(', ')+'\n'+T('檢查人：','Inspector: ','អ្នកត្រួតពិនិត្យ៖ ')+who+T('\n儲存後更新已收量、待收量與收貨庫存；少到貨請取消並調整。','\nUpdates received, outstanding and receiving stock. Cancel to adjust short deliveries.','\nធ្វើបច្ចុប្បន្នភាពការទទួល និងស្តុក។ បើខ្វះ សូមបោះបង់ និងកែ។')))return false;
      const oldRecords=JSON.parse(JSON.stringify(records)),oldItems=JSON.parse(JSON.stringify(items));
      try{const out=baseSave.apply(this,arguments);if(records.length===oldRecords.length)return false;resetInputs=true;ledgerStamp=stamp();savedInputs.clear();localStorage.setItem('ga_monthly_po_receipts_changed',JSON.stringify({at:Date.now(),url:GA.gasUrl()}));renderPoReceiveTab();return out===false?false:true;}
      catch(e){records=oldRecords;items=oldItems;throw e;}
    }catch(e){toast(e.message,'error');renderPoReceiveTab();return false;}
    finally{saving=false;preview();}
  };
  function resume(){if(receiveTab==='po'&&!saving&&!loadPromise){lastAttempt=0;loadRecvPoApproved(true).then(renderPoReceiveTab);}}
  window.addEventListener('ga-backend-ready',resume);
  window.addEventListener('focus',resume);
  function init(){
    const query=new URLSearchParams(location.search),period=query.get('poPeriod');
    if(/^\d{4}-(0[1-9]|1[0-2])$/.test(period||'')){periodMode='month';periodDate=GA.parseYMD(period+'-01');updatePeriodLabel();}
    try{const saved=JSON.parse(localStorage.getItem(cacheKey())||'null');if(saved&&saved.year===year()&&Array.isArray(saved.data)){_recvPoCache=saved.data;_recvPoLoadedYear=saved.year;}}catch(_){}
    if(query.get('tab')==='po'){showPage('receive');setReceiveTab('po');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.recvPoPreview=preview;
})();
