/* Monthly PO draft workspace v3.9.20. Existing approval and cloud APIs remain authoritative. */
(function () {
  'use strict';
  const scale = 10000;
  function qty(value) {
    const s = String(value == null ? '' : value).trim();
    if (!/^\d+(?:\.\d{1,4})?$/.test(s)) throw Error('數量須為非負數，最多 4 位小數 / Use a nonnegative quantity with at most 4 decimals');
    const n = Number(s), units = Math.round(n * scale);
    if (!Number.isSafeInteger(units)) throw Error('數量過大 / Quantity is too large');
    return units / scale;
  }
  const add = (a, b) => {const total=Math.round(qty(a)*scale)+Math.round(qty(b)*scale);if(!Number.isSafeInteger(total))throw Error('數量合計過大 / Quantity total is too large');return total/scale;};
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function match(source, catalog, unitOf) {
    const named = catalog.filter(i => norm(i.name) === norm(source.name || source.item));
    const compatible = i => (!source.unit || norm(unitOf(i.id)) === norm(source.unit)) && (!(source.size || source.spec || source.sz) || norm(i.sz || i.size || i.spec) === norm(source.size || source.spec || source.sz));
    const exact = named.filter(i => String(i.id) === String(source.id) && compatible(i));
    if (exact.length === 1) return exact[0];
    const hits = named.filter(compatible);
    return hits.length === 1 ? hits[0] : null;
  }
  window.GAPO = { qty, add, match };
  if (!document.getElementById('page-po')) return;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T = (zh, en) => lang === 'zh' ? zh : en;
  let work = [], sources = [], sourceLabel = '', sourcePeriod = null, openingState = '', newItems = [], busy = false, generation = 0;
  const eligible = () => cu && cu.role === 'applicant' && !submitInFlight && ['draft','approved'].includes(poStatus);
  const fingerprint = () => JSON.stringify([ords, poStatus, curMonth, submitAckId, customItems, hiddenItems, itemSettings]);
  const userKey = () => cu && (cu.uid || cu.id || cu.name) || 'applicant';
  const backupKey = () => 'ga_po_draft_v3920_' + userKey();
  const catalog = () => allItems().concat(newItems);
  const unitOf = id => (newItems.find(i => String(i.id) === String(id)) || {}).unit || getUnit(id);
  const message = text => { document.getElementById('po-work-message').textContent = text; };
  function changed() { document.getElementById('po-work-reviewed').checked = false; totals(); }
  function totals() {
    const units = {};
    let count = 0, invalid = 0;
    work.forEach(r => { try { const q = qty(r.qty); if(q > 0) { count++; const unit = r.id ? unitOf(r.id) : '?'; units[unit] = add(units[unit] || 0, q); } } catch (_) { invalid++; } });
    document.getElementById('po-work-total').textContent = T('草稿：','Draft: ') + count + T(' 項；',' lines; ') + Object.entries(units).map(([u,q]) => q + ' ' + u).join(' · ') + (invalid ? T(' ｜有無效數量',' | Invalid quantities') : '');
  }
  function draw() {
    const q = norm(document.getElementById('po-work-search').value);
    document.getElementById('po-work-rows').innerHTML = work.map((r,i) => {
      const item = catalog().find(c => String(c.id) === String(r.id));
      const label = item ? (item.cn ? item.cn + ' / ' : '') + item.name : r.name;
      return `<tr ${norm(label + ' ' + (r.note || '')).includes(q) ? '' : 'hidden'}><td>${esc(label)}${!item ? '<strong class="po-work-warning">'+T('請選對應品項或刪除此列','Map this item or remove the row')+'</strong><select data-map="'+i+'"><option value="">—</option>'+catalog().map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name+' · '+unitOf(c.id))+'</option>').join('')+'</select>' : ''}<small>${esc(r.original == null ? T('手動新增','Added manually') : T('上期數量：','Previous qty: ') + r.original)} · ${esc(item ? unitOf(r.id) : r.unit || '?')}</small></td><td><input aria-label="${esc(label)} quantity" type="number" min="0" step="0.0001" value="${esc(r.qty)}" data-qty="${i}"></td><td><input aria-label="${esc(label)} note" value="${esc(r.note || '')}" data-note="${i}"></td><td><button type="button" data-remove="${i}">${T('刪除此列','Remove')}</button></td></tr>`;
    }).join('') || '<tr><td colspan="4">'+T('選擇來源或新增品項開始。','Select a source or add an item.')+'</td></tr>';
    document.getElementById('po-work-add').innerHTML = '<option value="">'+T('選擇用品加入草稿','Add a catalog item')+'</option>' + catalog().filter(i=>!work.some(r=>String(r.id)===String(i.id))).map(i=>'<option value="'+esc(i.id)+'">'+esc((i.cn||i.name)+' / '+i.name+' · '+unitOf(i.id))+'</option>').join('');
    totals();
  }
  function ensure() {
    if(document.getElementById('po-work-dialog')) return;
    const d = document.createElement('dialog'); d.id='po-work-dialog';
    d.innerHTML = `<div class="po-work-head"><h2>${T('Monthly PO｜引用與編輯草稿','Monthly PO | Reuse & edit draft')}</h2><button data-close>✕</button></div>
    <p class="po-work-notice">${T('1 選擇上期 → 2 修改／新增／刪除 → 3 核對儲存。請人工確認本月需求、庫存、單位與備註。數量為 0 的列不會送審；不同單位分開加總。此表沒有單價欄，不估算金額。','1 Choose previous PO → 2 Edit / add / remove → 3 Review and save. Check current demand, stock, units and notes manually. Zero quantities are excluded. Totals are grouped by unit; this form has no unit prices or amount estimates.')}</p>
    <div class="po-work-controls"><label>${T('新申請月份','New request month')}<select id="po-work-month">${MO.map((m,i)=>'<option value="'+i+'">'+YEAR+' / '+m+'</option>').join('')}</select></label><label>${T('引用來源（已核可）','Source (approved)')}<select id="po-work-source"><option value="">${T('載入中…','Loading…')}</option></select></label><button id="po-work-copy">${T('引用到草稿','Copy into draft')}</button></div>
    <p id="po-work-message" role="status"></p><div class="po-work-controls"><input id="po-work-search" placeholder="${T('尋找品項或備註','Search items or notes')}"><select id="po-work-add"></select><button id="po-work-add-button">＋ ${T('加入','Add')}</button></div>
    <details><summary>＋ ${T('新增目錄沒有的品項（請確認名称、單位）','Create a new catalog item (check name and unit)')}</summary><div class="po-work-controls"><input id="po-work-name" placeholder="${T('品項名稱（必填）','Item name (required)')}"><input id="po-work-unit" placeholder="${T('單位（必填）','Unit (required)')}"><select id="po-work-category">${Object.entries(CATS).map(([k,c])=>'<option value="'+esc(k)+'">'+esc(c.en||c.label||k)+'</option>').join('')}</select><button id="po-work-create">${T('新增品項','Create item')}</button></div></details>
    <div class="po-work-table"><table><thead><tr><th>${T('品項／上期數量','Item / previous qty')}</th><th>${T('本期數量','New quantity')}</th><th>${T('備註','Note')}</th><th></th></tr></thead><tbody id="po-work-rows"></tbody></table></div>
    <div class="po-work-foot"><strong id="po-work-total"></strong><label><input type="checkbox" id="po-work-reviewed"> ${T('已人工核對月份、品項、單位、增刪與數量','I reviewed month, items, units, additions/removals and quantities')}</label><div><button data-close>${T('取消','Cancel')}</button> <button id="po-work-save">💾 ${T('儲存新草稿','Save draft')}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy && confirm(T('關閉編輯視窗？尚未儲存的修改會捨棄。','Close editor and discard unsaved edits?'))) {generation++;d.close();}});
    d.addEventListener('cancel',e=>{e.preventDefault();d.querySelector('[data-close]').click();});
    document.getElementById('po-work-search').oninput=draw;
    document.getElementById('po-work-month').onchange=changed;
    document.getElementById('po-work-rows').oninput=e=>{
      const el=e.target;
      if(el.dataset.qty!==undefined)work[+el.dataset.qty].qty=el.value;
      if(el.dataset.note!==undefined)work[+el.dataset.note].note=el.value;
      changed();
    };
    document.getElementById('po-work-rows').onchange=e=>{
      if(e.target.dataset.map!==undefined){work[+e.target.dataset.map].id=e.target.value;changed();draw();}
    };
    document.getElementById('po-work-rows').onclick=e=>{if(e.target.dataset.remove!==undefined){work.splice(+e.target.dataset.remove,1);changed();draw();}};
    document.getElementById('po-work-add-button').onclick=()=>{
      const id=document.getElementById('po-work-add').value, it=catalog().find(i=>String(i.id)===id);
      if(it){work.push({id:it.id,name:it.name,qty:1,note:'',original:null});changed();draw();}
    };
    document.getElementById('po-work-create').onclick=()=>{
      const name=document.getElementById('po-work-name').value.trim(), unit=document.getElementById('po-work-unit').value.trim();
      if(!name||!unit)return message(T('請填品項名稱與單位。','Enter item name and unit.'));
      // Hidden catalog entries are also checked to avoid creating another identity for an existing item.
      const all=Object.values(CATS).flatMap(c=>c.items).concat(customItems,newItems);
      if(all.some(i=>norm(i.name)===norm(name)))return message(T('已有同名品項，請使用現有品項；隱藏品項請先至品項管理啟用。','An item with this name exists. Use it, or enable it in Item Management if hidden.'));
      const item={id:GA.uid('ci'),name,cn:name,unit,catKey:document.getElementById('po-work-category').value,e:'📦',bg:'#dbeafe',sz:'',monthly:true};
      newItems.push(item);work.push({id:item.id,name,qty:1,note:'',original:null});changed();draw();
      document.getElementById('po-work-name').value='';document.getElementById('po-work-unit').value='';
    };
    document.getElementById('po-work-copy').onclick=()=>{
      const selection=document.getElementById('po-work-source').value;
      const po=selection===''?null:sources[Number(selection)];
      if(!po)return message(T('請先選擇來源。','Choose a source first.'));
      if(Number(po.year)*12+Number(po.month)>=YEAR*12+Number(document.getElementById('po-work-month').value))return message(T('來源必須早於新申請月份。','The source must precede the new request month.'));
      if(work.length&&!confirm(T('引用將取代此編輯視窗內的品項，繼續？','Replace the items in this editor with the source PO?')))return;
      sourcePeriod=Number(po.year)*12+Number(po.month);
      sourceLabel=String(po.poNumber||po.poId||'')+' ('+po.year+'-'+String(Number(po.month)+1).padStart(2,'0')+')';
      work=(po.items||[]).map(it=>{const hit=match(it,catalog(),unitOf);return {id:hit?hit.id:'',name:it.name||it.item||'',unit:it.unit||'',qty:it.qty,original:it.qty,note:it.note||''};});
      changed();draw();message(T('已引用：','Copied: ')+sourceLabel+T('。請檢查未配對品項，並調整本月數量。',' — resolve unmatched items and adjust this month’s quantities.'));
    };
    document.getElementById('po-work-save').onclick=save;
  }
  async function save() {
    if(busy)return;
    try {
      if(!eligible()||fingerprint()!==openingState)throw Error(T('原採購資料或權限已變更。請關閉並重新開啟，避免覆蓋最新資料。','The current PO or permissions changed. Close and reopen to use the latest state.'));
      if(!document.getElementById('po-work-reviewed').checked)throw Error(T('請先完成人工核對並勾選確認。','Review the draft and tick the confirmation.'));
      if(sourcePeriod!==null&&sourcePeriod>=YEAR*12+Number(document.getElementById('po-work-month').value))throw Error(T('新申請月份必須晚於引用來源。','The new request month must follow the source period.'));
      const next={}, seen=new Set();
      for(const r of work){
        const q=qty(r.qty);if(!q)continue;
        const item=catalog().find(i=>String(i.id)===String(r.id));
        if(!item)throw Error(T('尚有未配對的品項：','Unmapped item: ')+r.name);
        if(seen.has(String(item.id)))throw Error(T('重複品項，請合併數量後刪除重複列：','Duplicate item; combine quantities and remove the duplicate row: ')+item.name);
        seen.add(String(item.id));next[item.id]={qty:q,note:r.note||'',reference:sourceLabel||''};
      }
      if(!seen.size)throw Error(T('至少需要一個大於 0 的品項。','Add at least one item with a positive quantity.'));
      const added=newItems.filter(i=>seen.has(String(i.id)));
      const snapshot={schema:1,uid:userKey(),year:YEAR,curMonth:+document.getElementById('po-work-month').value,ords:next,newItems:customItems.concat(added).filter(i=>seen.has(String(i.id))),source:sourceLabel,sourcePeriod,savedAt:new Date().toISOString()};
      // Write a recoverable draft before changing the live state or calling GAS.
      localStorage.setItem(backupKey(),JSON.stringify(snapshot));
      busy=true;document.querySelectorAll('#po-work-dialog input,#po-work-dialog select,#po-work-dialog button').forEach(el=>el.disabled=true);
      clearTimeout(_saveTimer);_saveTimer=null;
      ords=next;curMonth=snapshot.curMonth;poStatus='draft';poNumber=null;submitAckId='';sigs={applicant:null,verifier:null,approver:null};
      added.forEach(i=>{customItems.push(i);itemSettings[i.id]={unit:i.unit,safetyStock:0,monthly:true};});
      document.getElementById('msel').value=curMonth;
      render();openingState=fingerprint();
      const ok=await saveStateCloud();
      if(ok===true){document.getElementById('po-work-dialog').close();GA.toast(T('✅ 草稿已儲存到雲端；請預覽後送審。','✅ Draft saved to cloud. Preview before submitting.'));}
      else message(T('雲端未確認儲存；草稿已保留本機與目前畫面。可再次儲存，或用「恢復本機草稿」找回。','Cloud save was not confirmed. Draft retained locally and in the current form. Retry saving or use Restore local draft.'));
      // Added catalog entries are now live; do not append them again on a retry.
      newItems=[];
    }catch(e){message(e.message);}finally{busy=false;document.querySelectorAll('#po-work-dialog input,#po-work-dialog select,#po-work-dialog button').forEach(el=>el.disabled=false);}
  }
  window.procDraftOpen=async function(restore){
    if(!eligible()){GA.toast(T('只有 Applicant 可建立草稿；待審中的 PO 請先完成原流程。','Only Applicant can create a draft. Finish the pending PO workflow first.'));return;}
    ensure();const token=++generation;
    openingState=fingerprint();newItems=[];sourceLabel='';sourcePeriod=null;sources=[];
    work=poStatus==='draft'?ordItems().map(i=>({id:i.id,name:i.name,qty:ords[i.id].qty,note:ords[i.id].note||'',original:null})):[];
    document.getElementById('po-work-month').value=poStatus==='approved'?new Date().getMonth():curMonth;
    if(restore){try{const s=JSON.parse(localStorage.getItem(backupKey())||'null');if(!s||s.year!==YEAR||String(s.uid)!==String(userKey()))throw Error(T('沒有本年度的本機草稿。','No local draft for this year.'));sourceLabel=s.source||'';sourcePeriod=s.sourcePeriod==null?null:s.sourcePeriod;newItems=(s.newItems||[]).filter(i=>!allItems().some(c=>String(c.id)===String(i.id)));work=Object.entries(s.ords).map(([id,r])=>Object.assign({id,name:(catalog().find(i=>String(i.id)===id)||{}).name||id},r));document.getElementById('po-work-month').value=s.curMonth;}catch(e){GA.toast(e.message);return;}}
    document.getElementById('po-work-search').value='';changed();draw();message(T('正在讀取本年度與前一年度的已核可 PO…','Loading approved POs from this and the previous year…'));document.getElementById('po-work-source').innerHTML='<option value="">…</option>';
    document.getElementById('po-work-dialog').showModal();
    const results=await Promise.allSettled([YEAR,YEAR-1].map(year=>GA.gasGet('getHistory',{year,_:Date.now()})));
    if(token!==generation||!document.getElementById('po-work-dialog').open)return;
    const seen=new Set();let failed=0;
    results.forEach(r=>{if(r.status!=='fulfilled'||!r.value||r.value.ok!==true||!Array.isArray(r.value.data)){failed++;return;}r.value.data.forEach(po=>{const key=po.poId||po.poNumber;if(!key||seen.has(key)||String(po.status).toLowerCase()!=='approved'||!Array.isArray(po.items)||!Number.isInteger(Number(po.month))||Number(po.month)<0||Number(po.month)>11||!Number.isInteger(Number(po.year)))return;seen.add(key);sources.push(po);});});
    sources.sort((a,b)=>(Number(b.year)*12+Number(b.month))-(Number(a.year)*12+Number(a.month))||String(b.poNumber||b.poId).localeCompare(String(a.poNumber||a.poId)));
    const selector=document.getElementById('po-work-source');selector.innerHTML='<option value="">'+T('選擇上期或較早 PO','Choose a previous PO')+'</option>'+sources.map((po,i)=>'<option value="'+i+'">'+esc(po.year+' / '+MO[po.month]+' · '+(po.poNumber||po.poId)+' · '+po.items.length+T(' 項',' lines'))+'</option>').join('');
    const prior=sources.findIndex(po=>Number(po.year)*12+Number(po.month)<YEAR*12+Number(document.getElementById('po-work-month').value));if(prior>=0)selector.value=prior;
    message(failed?T('部分雲端歷史讀取失敗，可重開視窗重試；不會把失敗視為沒有資料。','Some cloud history could not be loaded. Reopen to retry; failure is not treated as empty history.'):T('選擇來源後按「引用到草稿」。目前資料會在儲存時才套用。','Choose a source and click Copy into draft. The current PO changes only when you save.'));
  };
  window.doStartNewPO=function(){return window.procDraftOpen(false);};
  const baseRender=window.render;
  window.render=function(){const out=baseRender.apply(this,arguments);mount();return out;};
  function mount(){
    let bar=document.getElementById('po-draft-actions');
    if(!bar){bar=document.createElement('div');bar.id='po-draft-actions';document.getElementById('page-po').prepend(bar);}
    bar.innerHTML='<strong>Monthly PO</strong><button onclick="procDraftOpen(false)">'+T('📋 引用上期／編輯草稿','📋 Reuse previous PO / edit draft')+'</button><button onclick="procDraftOpen(true)">'+T('↩ 恢復本機草稿','↩ Restore local draft')+'</button><span>'+T('改數量、增刪品項 → 核對 → 儲存 → 預覽送審','Adjust quantities and items → Review → Save → Preview & submit')+'</span>';
    bar.querySelectorAll('button').forEach(b=>b.disabled=!eligible());
  }
  // Card edits also save decimal quantities, including notes, without integer truncation.
  window.setQ=function(id,value){if(!cu||cu.role!=='applicant'||poStatus!=='draft')return;try{const q=qty(value);ords[id]=Object.assign({},ords[id],{qty:q});saveState();render();}catch(e){GA.toast(e.message);}};
  window.chQ=function(id,d){if(!cu||cu.role!=='applicant'||poStatus!=='draft')return;const q=Math.max(0,(Math.round(qty((ords[id]||{}).qty||0)*scale)+Math.round(d*scale))/scale);ords[id]=Object.assign({},ords[id],{qty:q});saveState();render();};
  window.setN=function(id,value){if(!cu||cu.role!=='applicant'||poStatus!=='draft')return;ords[id]=Object.assign({qty:0},ords[id],{note:value});saveState();};
  mount();
})();
