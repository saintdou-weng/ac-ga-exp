/* Monthly PO and Receiving share the approved PO source and one receipt ledger. */
(function(){
  'use strict';
  const T=(z,e,k)=>lang==='zh'?z:lang==='km'?k:e;
  const $=id=>document.getElementById(id);
  const esc=v=>GA.esc(String(v==null?'':v));
  let active='',busy=null,loadedAt=0,rows=[],error='';
  const period=()=>YEAR+'-'+String(curMonth+1).padStart(2,'0');
  window.procMonthlyReceiptUrl=()=> 'receiving.html?tab=po&poPeriod='+encodeURIComponent(period())+'&v=3.9.22';
  function draw(){
    if(!window.document)return;
    const page=$('page-recv');if(!page)return;
    let box=$('proc-monthly-receipts');if(!box){box=document.createElement('section');box.id='proc-monthly-receipts';box.style.cssText='padding:18px;border:1px solid #8cb4cb;border-left:5px solid #14638a;border-radius:12px;background:#f1f7fb;margin-bottom:18px';page.prepend(box);}
    const lines=rows.filter(po=>po.period===period()).flatMap(po=>(po.items||[]).map(item=>({po,item})));
    box.innerHTML='<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;font-size:18px">'+period()+' · Monthly PO '+T('收貨核對','receiving','ទទួល')+'</h2><a id="proc-monthly-receive" class="inv-btn primary" href="'+procMonthlyReceiptUrl()+'">📦 '+T('帶入當月 PO／一次確認收貨','Fill monthly PO / confirm receipt batch','បញ្ចូល PO ខែនេះ / បញ្ជាក់ការទទួល')+'</a><button id="proc-monthly-refresh" class="inv-btn">↻ '+T('更新已收量','Refresh received qty','ធ្វើបច្ចុប្បន្នភាពចំនួនទទួល')+'</button></div><p>'+T('核可採購量跟隨當月 Monthly PO；待收＝核可量－此 PO 累計實收（包含跨月到貨）。點上方按鈕可調整數量，再一次確認，收貨與庫存只記入同一份 Receiving 帳本。','Approved quantities follow this month’s Monthly PO. Outstanding = approved − all receipts against that PO, including later deliveries. Use the button to adjust and confirm a batch in the shared Receiving ledger.','ចំនួនអនុម័តតាម Monthly PO ខែនេះ។ នៅសល់ = អនុម័ត − ទទួលសរុប រួមទាំងខែបន្ទាប់។ ចុចខាងលើ ដើម្បីកែ និងបញ្ជាក់ក្នុងបញ្ជី Receiving តែមួយ។')+'</p><p role="status">'+esc(busy?T('更新中…','Refreshing…','កំពុងធ្វើបច្ចុប្បន្នភាព…'):error||T('雲端已確認的收貨進度','Cloud-confirmed receiving progress','វឌ្ឍនភាពទទួលបានបញ្ជាក់ដោយ Cloud'))+'</p><div style="overflow:auto"><table class="inv-table"><thead><tr><th>PO</th><th>'+T('品項','Item','ទំនិញ')+'</th><th>'+T('核可採購量','Approved qty','ចំនួនអនុម័ត')+'</th><th>'+T('累計已收','Received total','ទទួលសរុប')+'</th><th>'+T('待收','Outstanding','នៅសល់')+'</th><th>'+T('單位','Unit','ឯកតា')+'</th></tr></thead><tbody>'+lines.map(({po,item})=>'<tr><td>'+esc(po.poNumber||po.poId)+'</td><td>'+esc((lang==='zh'&&item.cn?item.cn+' / ':'')+item.name)+'</td><td>'+GA.num(item.approvedQty)+'</td><td>'+GA.num(item.receivedQty)+'</td><td>'+GA.num(item.remainingQty)+'</td><td>'+esc(item.unit||'')+'</td></tr>').join('')+(!lines.length?'<tr><td colspan="6">'+T('本月尚無已核可 PO；草稿與待審申請不會自動入庫。','No approved PO this month. Drafts and pending requests do not post stock.','មិនមាន PO អនុម័តខែនេះ។ សេចក្តីព្រាងមិនបញ្ចូលស្តុកទេ។')+'</td></tr>':'')+'</tbody></table></div>';
    $('proc-monthly-refresh').onclick=()=>window.procRefreshMonthlyReceipts(true);
    const add=$('recv-add-r');if(add)add.textContent=T('＋ 其他手動收貨','＋ Other manual receipt','＋ ការទទួលផ្សេង');
    const note=$('recv-note');if(note)note.textContent=T('下方保留既有手動收發紀錄。未指定 PO 的手動紀錄不會自動扣減 Monthly PO 待收量；Monthly PO 到貨請使用上方按鈕。','Existing manual movements are retained below. Unlinked records do not reduce Monthly PO balances; use the button above for PO deliveries.','កំណត់ត្រាដោយដៃនៅខាងក្រោម។ កំណត់ត្រាគ្មាន PO មិនកាត់ចំនួននៅសល់ទេ។ ប្រើប៊ូតុងខាងលើសម្រាប់ទទួល PO។');
  }
  window.procRefreshMonthlyReceipts=function(force){
    if(busy)return busy;
    const target=period(),destination=GA.gasUrl();if(!force&&active===target&&Date.now()-loadedAt<30000){draw();return Promise.resolve(rows);}
    error='';if(active!==target)rows=[];active=target;
    busy=GA.gasGet('monthlyPoApproved',{year:YEAR}).then(r=>{if(!r||!Array.isArray(r.data))throw Error('Invalid PO receiving response');if(destination===GA.gasUrl()&&target===period()){rows=r.data;loadedAt=Date.now();}return rows;}).catch(e=>{error=e.message;return [];}).finally(()=>{busy=null;draw();if(target!==period())window.procRefreshMonthlyReceipts(true);});draw();return busy;
  };
  const base=window.renderRecv;window.renderRecv=function(){const result=base.apply(this,arguments);draw();window.procRefreshMonthlyReceipts(false);return result;};
  const baseRender=window.render;window.render=function(){const r=baseRender.apply(this,arguments);if($('page-recv')&&$('page-recv').classList.contains('on'))window.renderRecv();return r;};
  function refresh(){if($('page-recv')&&$('page-recv').classList.contains('on'))window.procRefreshMonthlyReceipts(true);}
  window.addEventListener('focus',refresh);window.addEventListener('ga-backend-ready',refresh);window.addEventListener('storage',e=>{if(e.key==='ga_monthly_po_receipts_changed')refresh();});
})();
