/* v3.9.20: prefill -> adjust -> preview -> confirmed ledger save. */
(function(){
  'use strict';
  const T=(zh,en)=>lang==='zh'?zh:en;
  const $=id=>document.getElementById(id);
  const num=GA.num;
  let rendering=false, saving=false, savedInputs=new Map(), ledgerStamp='', batchDate='', inspector='';
  const lineKey=x=>JSON.stringify([x.po.poId||x.po.poNumber,x.index]);
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
      const current=stamp();if(current!==ledgerStamp){savedInputs.clear();ledgerStamp=current;}else capture();
      const out=baseRender.apply(this,arguments);
      const container=$('receive-content');if(!container)return out;
      const toolbar=container.querySelector('.recv-po-toolbar, .recv-batch-toolbar');
      if(toolbar){
        const fill=toolbar.querySelector('[onclick="applyPoReceiveDefaults()"]');
        if(fill){fill.textContent=T('📋 帶入全部 PO 待收量（可修改）','📋 Fill all outstanding PO quantities (editable)');fill.classList.add('po-receive-fill');}
        const instant=toolbar.querySelector('[onclick="receiveAllPoNow()"]');if(instant)instant.remove();
        const save=toolbar.querySelector('[onclick="savePoReceiveBatch()"]');if(save)save.textContent=T('💾 核對並儲存勾選收貨','💾 Review & save selected receipts');
        const box=document.createElement('div');box.id='po-receive-preview';toolbar.after(box);
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
  window.savePoReceiveBatch=function(){
    if(saving)return;
    const p=preview();if(p.invalid||!p.count){toast(T('請選擇有效的到貨數量，且不得超過待收量。','Select valid received quantities within the outstanding balance.'),'error');return;}
    const who=String(($('po-batch-inspector')||{}).value||'').trim();
    if(!who){toast(T('請填寫檢查人，再核對儲存。','Enter the inspector before saving.'),'error');return;}
    const badDate=(_recvPoFlat||[]).some((x,i)=>{
      if(!$('po-check-'+i).checked||num($('po-qty-'+i).value)<=0)return false;
      const d=$('po-date-'+i).value;return !/^\d{4}-\d{2}-\d{2}$/.test(d)||isNaN(Date.parse(d+'T12:00:00Z'));
    });
    if(badDate){toast(T('請填寫每項收貨日期。','Enter a valid date for each receipt.'),'error');return;}
    const dates=[...new Set((_recvPoFlat||[]).filter((x,i)=>$('po-check-'+i).checked&&num($('po-qty-'+i).value)>0).map(x=>$('po-date-'+_recvPoFlat.indexOf(x)).value))];
    if(!confirm(T('確認實際收貨並儲存？\n','Confirm actual arrivals and save?\n')+p.count+T(' 項：',' lines: ')+Object.entries(p.units).map(([u,q])=>q+' '+u).join(' · ')+'\n'+dates.join(', ')+'\n'+T('檢查人：','Inspector: ')+who+T('\n儲存後更新已收量、待收量與庫存；缺貨請取消，先調整數量。','\nSaving updates received, outstanding and stock balances. Cancel and adjust quantities if anything is missing.')))return;
    saving=true;
    try{return baseSave.apply(this,arguments);}finally{saving=false;preview();}
  };
  window.recvPoPreview=preview;
})();
