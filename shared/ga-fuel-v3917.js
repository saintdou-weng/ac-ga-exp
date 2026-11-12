/* Keep v3.9.16b platform workflows; replace only Fuel import/sync/summary paths. */
(function(){'use strict';const M=GAMobility,F=(z,e,k)=>lang==='en'?e:lang==='km'?k:z;
const starting=JSON.parse(JSON.stringify(DB));let repo,initializing=true,persistChain=Promise.resolve(),importBatch=null,localError=null;
// Keep the pre-upgrade local rows available for recovery; never guess lost quantities.
try{if(!localStorage.getItem('vrt_diesel_before_3917a'))localStorage.setItem('vrt_diesel_before_3917a',JSON.stringify(starting));}catch(_){}
const status=document.createElement('div');status.id='fuel-sync-v17';status.className='al al-i';document.querySelector('#sec-upload').prepend(status);
function syncStatus(s,msg){const labels={local:F('本機已載入','Loaded locally','បានផ្ទុក'),pending:F('待同步','Pending sync','រង់ចាំ Sync'),syncing:F('同步中','Syncing','កំពុង Sync'),synced:F('雲端已同步','Cloud synced','Cloud បាន Sync'),offline:F('離線待傳','Offline; queued','ក្រៅបណ្ដាញ'),conflict:F('資料有差異，請確認下方項目','Conflicts require review below','ត្រូវពិនិត្យទិន្នន័យ'),incompatible:F('GAS 版本不相容；已停止自動重試','GAS version incompatible; automatic retry stopped','កំណែ GAS មិនត្រូវគ្នា; បានបញ្ឈប់ការសាកស្វ័យប្រវត្តិ'),error:F('同步未完成','Sync incomplete','Sync មិនទាន់រួច')};status.textContent='☁ '+(labels[s]||s)+(msg?' · '+msg:'');const settingsStatus=document.getElementById('gasStatus');if(settingsStatus){settingsStatus.textContent=status.textContent;settingsStatus.className=(s==='error'||s==='incompatible')?'al al-w':'al al-i';}try{GA.cloud.set(s==='synced'?'up':s==='syncing'?'sync':(s==='error'||s==='incompatible')?'err':'idle',status.textContent)}catch(_){} }
function refresh(){updateHeader();updateDBCard();if(typeof genSummary==='function')genSummary();const active=document.querySelector('.sec.on')?.id;if(active==='sec-records')initRecs();else if(active==='sec-daily')initDaily();else if(active==='sec-weekly')initWeekly();else if(active==='sec-monthly')renderPeriod();else if(active==='sec-compare')initCompare();}
repo=GAMobilityStore.create('fuel',{url:()=>document.getElementById('gasUrl').value.trim()||GA.gasUrl(),status:syncStatus,change:(rows,conflicts)=>{if(initializing)return;DB=rows;refresh();let box=document.getElementById('fuel-conflicts');if(!box){box=document.createElement('div');box.id='fuel-conflicts';status.after(box);}box.replaceChildren();conflicts.forEach(c=>{const line=document.createElement('p');line.textContent=(c.current?.date||c.id)+' '+F('雲端與本機不同','Cloud/local conflict','ទិន្នន័យខុសគ្នា')+' ';for(const [local,label] of [[false,F('採用雲端','Use cloud','ប្រើ Cloud')],[true,F('保留本機修改','Keep local changes','រក្សាការកែ')]]){const b=document.createElement('button');b.className='btn btn-g';b.textContent=label;b.onclick=()=>repo.resolveConflict(c.id,local);line.append(b);}box.append(line);});}});
/* v3.9.25: IndexedDB (GAMobilityStore) is the only local copy. localStorage 'vrt_diesel_db' is written only as an
   emergency fallback when IndexedDB fails, and removed again after a successful IndexedDB load. */
function lsFallback(rows){try{localStorage.setItem(LS,JSON.stringify(rows));return true;}catch(e){toast(F('本機儲存空間已滿 — 資料仍保留在本次畫面，請先雲端同步','Storage full — data kept in this session; please sync to cloud','ទំហំផ្ទុកពេញ — សូមធ្វើសមកាលកម្ម'),'err');return false;}}
window.save=function(){const snapshot=JSON.parse(JSON.stringify(DB));persistChain=persistChain.catch(()=>{}).then(()=>repo.capture(snapshot)).then(()=>{localError=null;return true;}).catch(e=>{lsFallback(snapshot);localError=e;syncStatus('error',e.message);return false;});return persistChain;};
window.scheduleFuelAutoSync=function(){persistChain.then(ok=>{if(ok!==false)repo.schedule();});};
window.fuelFlush=async()=>{await fuelReady;await persistChain;if(localError)return false;let ok=await repo.sync();if(!ok&&repo.pending()&&!repo.conflicts().length&&!(repo.incompatible&&repo.incompatible()))ok=await repo.sync();return ok;};
window.fuelCloudUploadSafe=window.cloudUpload=window.fuelFlush;
window.fuelCloudDownloadSafe=window.cloudDownload=window.fuelFlush;
// The legacy fuel-only GAS URL previously diverged from Telegram's platform URL.
window.saveCfg=function(){const url=document.getElementById('gasUrl').value.trim();localStorage.setItem('vrt_dsl_gas',url);GA.saveCfg({gasUrl:url});};
const configuredUrl=(GA.cfg().gasUrl||'').trim()||document.getElementById('gasUrl').value.trim()||GA.gasUrl();
document.getElementById('gasUrl').value=configuredUrl;localStorage.setItem('vrt_dsl_gas',configuredUrl);GA.saveCfg({gasUrl:configuredUrl});
const connectionCheck=document.createElement('button');connectionCheck.className='btn btn-g';connectionCheck.textContent=F('檢查資料同步＋摘要回執','Check sync + summary receipt','ពិនិត្យ Sync + receipt');document.getElementById('gasStatus').before(connectionCheck);
const useBuiltIn=document.createElement('button');useBuiltIn.className='btn btn-r';useBuiltIn.style.marginLeft='6px';useBuiltIn.textContent=F('改用平台內建 GAS（資料庫可能不同）','Use built-in GAS (data may differ)','ប្រើ GAS មូលដ្ឋាន (ទិន្នន័យអាចខុស)');connectionCheck.after(useBuiltIn);
function showBuiltInChoice(){useBuiltIn.style.display=document.getElementById('gasUrl').value.trim()&&document.getElementById('gasUrl').value.trim()!==GA.DEFAULT_GAS?'inline-flex':'none';}
showBuiltInChoice();document.getElementById('gasUrl').addEventListener('input',showBuiltInChoice);
useBuiltIn.onclick=async()=>{const ok=confirm(F('這會改變雲端資料目的地；目前 GAS 的資料不會自動搬移。只有確認平台內建網址就是要使用的資料庫才繼續。','This changes the cloud data destination. Data in the current GAS will not migrate automatically. Continue only if the built-in endpoint is the intended database.','វានឹងប្ដូរទីតាំងទិន្នន័យ Cloud ហើយទិន្នន័យចាស់មិនផ្ទេរស្វ័យប្រវត្តិទេ។ បន្តតែបើមូលដ្ឋាននេះត្រឹមត្រូវ។'));if(!ok)return;document.getElementById('gasUrl').value=GA.DEFAULT_GAS;saveCfg();if(GA.backend)GA.backend.clear();showBuiltInChoice();connectionCheck.click();};
connectionCheck.onclick=async()=>{connectionCheck.disabled=true;saveCfg();if(GA.backend)GA.backend.clear();try{const info=await GA.backend.require('mobilitySync',{action:'mobilitySync',force:true});await GA.backend.require('tgSummaryReceipt',{action:'tgSummary'});const alert=document.getElementById('ga-backend-alert');if(alert)alert.remove();document.getElementById('gasStatus').textContent='✅ GS '+(info.version||'')+' · '+F('資料同步與 Telegram 回執均支援','Data sync and Telegram receipts supported','គាំទ្រ Sync និង Telegram receipt');document.getElementById('gasStatus').className='al al-ok';}catch(e){syncStatus('incompatible',e.message);}finally{connectionCheck.disabled=false;}};
window.syncGAS=window.fuelFlush;
const originalOpenForm=window.openForm;
window.openForm=function(cat){originalOpenForm(cat);document.querySelectorAll('#formBody input[type="number"]').forEach(el=>{el.type='text';el.inputMode='decimal';});};
let savingManual=false;
const originalFiltered=window.getFilteredRecs;
window.getFilteredRecs=function(){return originalFiltered().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))||String(a.id).localeCompare(String(b.id)));};
let recordPage=0,lastFilter='';const recordPageSize=100;
window.renderRecs=function(){
  const recs=getFilteredRecs(),filter=['rCat','rMonth','rSearch'].map(id=>document.getElementById(id).value).join('|');
  if(filter!==lastFilter){recordPage=0;lastFilter=filter;}
  recordPage=Math.max(0,Math.min(recordPage,Math.ceil(recs.length/recordPageSize)-1));
  document.getElementById('rMeta').textContent=recs.length+' '+T('records')+' · '+recs.reduce((s,r)=>s+M.num(r.liters),0).toLocaleString()+' L';
  document.getElementById('rHead').innerHTML='<tr>'+['#',T('category'),T('date'),T('detail'),T('liters'),T('km'),T('inspector'),T('remarks'),F('操作','Actions','សកម្មភាព')].map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr>';
  const body=document.getElementById('rBody');body.replaceChildren();
  recs.slice(recordPage*recordPageSize,(recordPage+1)*recordPageSize).forEach((r,i)=>{const tr=document.createElement('tr');tr.dataset.recordId=r.id;const vals=[recordPage*recordPageSize+i+1,catLabel(r.cat),r.date,[r.driver||r.forklift||r.machine,r.plate].filter(Boolean).join(' / '),M.num(r.liters)+' L',r.km??r.totalKM??r.kw??'—',r.inspector||'—',r.remarks||''];vals.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});const td=document.createElement('td');for(const [label,fn] of [['✏️',()=>editFuelRecord(r.id)],['🗑',()=>deleteRec(r.id)]]){const b=document.createElement('button');b.className='btn btn-g';b.textContent=label;b.onclick=fn;td.append(b);}tr.append(td);body.append(tr);});
  if(!recs.length)body.innerHTML='<tr><td colspan="9">'+esc(T('noData'))+'</td></tr>';
  let nav=document.getElementById('fuel-record-pages');if(!nav){nav=document.createElement('div');nav.id='fuel-record-pages';document.getElementById('rMeta').after(nav);}nav.replaceChildren();
  for(const [label,delta] of [[F('上一頁','Previous','មុន'),-1],[F('下一頁','Next','បន្ទាប់'),1]]){const b=document.createElement('button');b.className='btn btn-g';b.textContent=label;b.disabled=delta<0?recordPage===0:(recordPage+1)*recordPageSize>=recs.length;b.onclick=()=>{recordPage+=delta;renderRecs();};nav.append(b);}const count=document.createElement('span');count.textContent=' '+(recordPage+1)+' / '+Math.max(1,Math.ceil(recs.length/recordPageSize));nav.append(count);
};
window.saveRec=async function(){
  if(savingManual)return false;
  const value=id=>(document.getElementById(id)?.value||'').trim();
  const number=id=>{const raw=value(id).replace(/,/g,'');if(raw&&!/^\d+(?:\.\d+)?$/.test(raw))throw new Error(F('請輸入有效的非負數字','Enter a valid nonnegative number','បំពេញលេខវិជ្ជមាន'));return raw?Number(raw):0;};
  let row;
  try{
    const cat=document.getElementById('formBody').dataset.cat,old=DB.find(r=>String(r.id)===String(editId||''));
    row={...old,id:editId||crypto.randomUUID(),cat,date:value('f_date'),liters:number('f_liters'),inspector:value('f_inspector'),remarks:value('f_remarks'),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(!M.valid(row.date)||!Number.isFinite(row.liters)||row.liters<=0)throw new Error(F('日期及大於零的公升數必填','Valid date and positive liters are required','បំពេញថ្ងៃ និងលីត្រលើសសូន្យ'));
    if(cat==='driver')Object.assign(row,{driver:value('f_driver'),plate:value('f_plate'),km:number('f_km'),from:old?.from||'',to:old?.to||''});
    else if(cat==='forklift'){Object.assign(row,{dept:value('f_dept'),forklift:value('f_forklift'),startKM:number('f_startKM'),arriveKM:number('f_arriveKM')});row.totalKM=row.arriveKM-row.startKM;if(row.totalKM<0)throw new Error(F('到達里程不可小於起始里程','Arrival reading must be at least the start reading','លេខចុងត្រូវធំជាងលេខដើម'));}
    else if(cat==='generator'){const h=value('f_hours');if(h&&!/^(?:\d+(?:\.\d+)?|\d+:[0-5]\d(?::[0-5]\d)?)$/.test(h))throw new Error(F('時數格式須為 05:20 或 5.33','Hours must use 05:20 or 5.33','ម៉ោង 05:20 ឬ 5.33'));Object.assign(row,{machine:value('f_machine'),kw:number('f_kw'),hours:h?M.hours(h):0});}
    else throw new Error('Invalid fuel category');
    if(!(row.driver||row.forklift||row.machine))throw new Error(F('司機／堆高機／機台名稱必填','Driver / forklift / machine is required','ត្រូវបំពេញឈ្មោះ'));
    const key=r=>[r.cat,r.date,r.driver||r.forklift||r.machine,r.plate||'',r.dept||'',Number(r.liters)].map(v=>String(v).trim().toLowerCase()).join('|');
    if(DB.some(r=>r.id!==row.id&&key(r)===key(row))&&!confirm(F('已有相同柴油記錄，仍要儲存另一筆？','An identical fuel record exists. Save another?','មានកំណត់ត្រាដូចគ្នា រក្សាទុកទៀត?')))return false;
    savingManual=true;
    await fuelReady;
    if(localError)throw localError;
    DB=[...DB.filter(r=>String(r.id)!==String(row.id)),row];
    if(await save()===false)throw localError||new Error('Local save failed');
    window.fuelSummaryPeriod=row.date.slice(0,7);
    closeForm();document.getElementById('rCat').value='';document.getElementById('rSearch').value='';document.getElementById('rMonth').value='';
    goTab('records');recordPage=Math.max(0,Math.floor(getFilteredRecs().findIndex(r=>r.id===row.id)/recordPageSize));refresh();
    toast(F('本機已儲存','Saved locally','បានរក្សាទុក')+' · '+row.liters+' L · '+F('待雲端確認','Awaiting cloud confirmation','រង់ចាំ Cloud'));
    return true;
  }catch(e){toast(e.message,'err');return false;}finally{savingManual=false;}
};
window.processFiles=async function(files){let rows=[],warnings=[],details=[];for(const file of Array.from(files||[])){try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false,raw:true});/* v3.9.25 no TZ shift */let result=M.parse(wb,file.name);if(wb.SheetNames.includes('GA_DATA')){const own=XLSX.utils.sheet_to_json(wb.Sheets.GA_DATA,{defval:''});result={rows:own.map(x=>({...x,warnings:typeof x.warnings==='string'?(x.warnings?JSON.parse(x.warnings):[]):x.warnings||[]})),warnings:[],type:'native'};}rows.push(...result.rows);warnings.push(...result.warnings);details.push(file.name+' → '+result.type+' : '+result.rows.length);}catch(e){warnings.push(file.name+': '+e.message);}}
const changes=M.plan(DB,rows.filter(r=>['driver','forklift','generator'].includes(r.cat)),{strictDate:true});/* v3.9.27 */if(changes.splits.length)warnings.push('⚠️ '+F('日期與既有紀錄不同 → 另存新紀錄、不覆蓋：','Different date from existing record → added as new, not overwritten: ','ថ្ងៃខុស → បន្ថែមថ្មី: ')+changes.splits.length);warnings.push(...changes.conflicts.map(c=>[c.before.date,c.before.driver||c.before.forklift||c.before.machine,'L',c.before.liters,'→',c.after.liters,'KM',c.before.km||c.before.totalKM,'→',c.after.km||c.after.totalKM].filter(x=>x!==undefined).join(' ')));importBatch={rows,warnings};pendingImport=rows;const pre=document.getElementById('importPreview');pre.classList.remove('hidden');const counts={};rows.forEach(r=>{const k=r.cat+' / '+r.date.slice(0,7);counts[k]=(counts[k]||0)+1;});pre.innerHTML='<div class="al al-i">'+details.map(esc).join('<br>')+'</div><div>'+Object.entries(counts).map(([k,n])=>esc(k)+': '+n).join(' · ')+'</div>'+(warnings.length?'<details><summary>⚠️ '+warnings.length+' '+F('項需確認','items to review','ចំណុចត្រូវពិនិត្យ')+'</summary><pre style="white-space:pre-wrap">'+esc(warnings.join('\n'))+'</pre></details>':'')+'<p>'+F('Transportation／ETC 將分流至各自分頁，不計入柴油。','Transportation / ETC go to separate pages and are excluded from fuel.','Transportation / ETC ទៅទំព័រផ្សេង មិនរាប់ក្នុងប្រេង។')+'</p><label><input type="checkbox" id="fuel-fix-year"> '+F('依檔案年份修正異常年份（ETC 保留歷史年份）','Correct mismatched years to workbook year (ETC keeps historical years)','កែឆ្នាំតាមឯកសារ (ETC រក្សាប្រវត្តិ)')+'</label><button class="btn btn-b" onclick="confirmImport()">'+F('確認匯入','Confirm import','បញ្ជាក់នាំចូល')+'</button> <button class="btn btn-g" onclick="cancelImport()">'+T('cancel')+'</button>';};
window.confirmImport=async function(){if(!importBatch)return;const batch={...importBatch,rows:document.getElementById('fuel-fix-year')?.checked?M.correctYears(importBatch.rows):importBatch.rows};if(batch.warnings.length&&!confirm(F('已列出日期等異常。保留原始值匯入，稍後逐筆更正？','Import original values with the listed warnings for later correction?','នាំចូលតម្លៃដើមដែលមានការព្រមាន?')))return;await persistChain;const fuel=batch.rows.filter(r=>['driver','forklift','generator'].includes(r.cat));const p=M.plan(DB,fuel,{strictDate:true});/* v3.9.27: never overwrite a record with a different date */if(p.updated&&!confirm(F('有 '+p.updated+' 筆同日期資料不同，確認更新？','Update '+p.updated+' changed same-date records?','បញ្ជាក់កែ '+p.updated+' កំណត់ត្រា (ថ្ងៃដូចគ្នា)?')))return;if(p.dateFixes.length&&confirm(F('有 '+p.dateFixes.length+' 筆舊紀錄日期比 Excel 早一天（舊版時區問題），要更正日期嗎？按取消＝保持原樣。',p.dateFixes.length+' older records are one day earlier than the Excel file (old timezone bug). Correct their dates? Cancel = leave unchanged.','កំណត់ត្រាចាស់ '+p.dateFixes.length+' មុនមួយថ្ងៃ។ កែ?')))M.applyDateFixes(p);DB=p.rows;save();await persistChain;const results=[F('柴油','Fuel','ប្រេង')+': +'+p.added+' / '+F('更新','updated','កែ')+' '+p.updated+' / '+F('略過','skipped','រំលង')+' '+p.skipped];for(const cat of ['transport','etc']){const incoming=batch.rows.filter(r=>r.cat===cat);if(!incoming.length)continue;const target=GAMobilityStore.create(cat,{status:()=>{}});await target.loaded;const q=await target.importRows(incoming);if(q){results.push(cat+': +'+q.added+' / '+q.updated+' / '+q.skipped);await target.sync();}}
const months=fuel.map(r=>r.date.slice(0,7)).sort();if(months.length)window.fuelSummaryPeriod=months[months.length-1];importBatch=null;pendingImport=null;const pre=document.getElementById('importPreview');pre.innerHTML='<div class="al al-ok">'+results.map(esc).join('<br>')+'</div><pre style="white-space:pre-wrap">'+esc(fuelSummaryText({scope:'all',ptype:'month',period:window.fuelSummaryPeriod||GA.currentPeriod('month'),lang:'both'}))+'</pre><button class="btn btn-b" onclick="fuelTelegram()">✈️ '+F('預覽並發送摘要','Preview / send summary','មើល / ផ្ញើសង្ខេប')+'</button>';refresh();await repo.sync();};
window.cancelImport=function(){importBatch=null;pendingImport=null;document.getElementById('importPreview').classList.add('hidden');};
/* 2026-11-12 柴油摘要新版（Paul：照出勤摘要的方式——整齊一致、數據一眼得知、有顏色管理）
   · 先總量＋三類比例色條；再各類清單：等寬數字在前（公升、km/L）、名稱車牌在後，位置固定。
   · 顏色：司機 km/L、發電機 L/hr 與「同類平均」比 — 🟢 在平均 ±10% 內或更省、🟡 差 10–20%、🔴 差超過 20%。
   · 結尾核對：三類加總＝合計才寫已核對正確。統計與篩選規則同舊版。 */
window.fuelSummaryData=function(s){
  const rows=DB.filter(r=>!/^Transport:/i.test(r.remarks||'')&&GA.inPeriod(r.date,s.period,s.ptype)),scope=s.scope||'all',cats={};
  for(const cat of ['driver','forklift','generator']){
    if(scope!=='all'&&scope!==cat)continue;
    const a=rows.filter(r=>r.cat===cat),groups={};
    a.forEach(r=>{const k=cat==='driver'?[r.driver,r.plate].filter(Boolean).join(' · '):cat==='forklift'?[r.dept,r.forklift].filter(Boolean).join(' · '):String(r.machine||'—');
      const v=groups[k]||(groups[k]={name:k||'—',liters:0,km:0,hours:0,n:0});v.liters+=M.num(r.liters);v.km+=M.num(r.km||r.totalKM);v.hours+=typeof r.hours==='number'?r.hours:M.hours(r.hours);v.n++;});
    const list=Object.values(groups).sort((x,y)=>y.liters-x.liters),liters=a.reduce((x,r)=>x+M.num(r.liters),0);
    const km=list.reduce((x,g)=>x+g.km,0),hours=list.reduce((x,g)=>x+g.hours,0);
    /* 平均只用「有里程／有時數」的那幾筆算，避免沒填里程的把平均拉低 */
    const lk=list.filter(g=>g.km>0&&g.liters>0),lh=list.filter(g=>g.hours>0&&g.liters>0);
    const avg=cat==='driver'&&lk.length?lk.reduce((x,g)=>x+g.km,0)/lk.reduce((x,g)=>x+g.liters,0):cat==='generator'&&lh.length?lh.reduce((x,g)=>x+g.liters,0)/lh.reduce((x,g)=>x+g.hours,0):0;
    list.forEach(g=>{g.rate=cat==='driver'&&g.km&&g.liters?g.km/g.liters:cat==='generator'&&g.hours&&g.liters?g.liters/g.hours:0;
      /* 司機：km/L 越高越好；發電機：L/hr 越低越好 */
      const gap=!g.rate||!avg?null:cat==='driver'?(avg-g.rate)/avg:(g.rate-avg)/avg;
      g.tone=gap==null?'':gap<=0.10?'ok':gap<=0.20?'warn':'bad';});
    const all=DB.filter(r=>r.cat===cat);
    cats[cat]={rows:a,list:list,liters:liters,km:km,hours:hours,avg:avg,latest:all.length?all.map(r=>r.date).sort().pop():''};
  }
  const selected=scope==='all'?rows:rows.filter(r=>r.cat===scope),total=selected.reduce((n,r)=>n+M.num(r.liters),0);
  const parts=Object.keys(cats).reduce((n,c)=>n+cats[c].liters,0);
  return {cats:cats,selected:selected,total:total,verified:Math.abs(parts-total)<0.005,inspectors:[...new Set(selected.map(r=>r.inspector).filter(Boolean))],warnings:selected.filter(r=>r.warnings?.length).length};
};
window.fuelSummaryText=function(s){
  const TG=GA.telegram,L=s.lang||'both',t=(zh,en,km)=>TG.safe(TG.label(zh,en,km,L)),D=fuelSummaryData(s),n0=v=>Math.round(v).toLocaleString('en-US');
  const META={driver:{icon:'🚗',mark:'🟦',zh:'司機',en:'Driver',km:'អ្នកបើកបរ'},forklift:{icon:'🏗️',mark:'🟧',zh:'堆高機',en:'Forklift',km:'ឡានស្ទូច'},generator:{icon:'⚡',mark:'🟨',zh:'發電機',en:'Generator',km:'ម៉ាស៊ីនភ្លើង'}};
  const keys=Object.keys(D.cats),out=[];
  out.push('🛢️ <b>'+t('柴油摘要','Diesel Summary','សង្ខេបប្រេង')+'</b>');
  out.push('📅 '+TG.safe(TG.periodLabel(s.period,s.ptype,L).replace(/ \/ /g,' ')));
  out.push(TG.RULE);
  out.push('<b>'+t('合計','Total','សរុប')+' '+n0(D.total)+' L</b> · '+D.selected.length+' '+t('筆','records','កំណត់ត្រា'));
  if(!D.selected.length)out.push('⚪ '+t('本期無資料','No records in this period','គ្មានទិន្នន័យក្នុងរយៈពេលនេះ'));
  if(keys.length>1&&D.total>0){
    out.push(TG.shareBar(keys.map(c=>({value:D.cats[c].liters,mark:META[c].mark})),10));
    const w=Math.max(...keys.map(c=>(n0(D.cats[c].liters)+' L').length));
    keys.forEach(c=>{const C=D.cats[c],pct=Math.round(C.liters/D.total*100);
      out.push(TG.mono((n0(C.liters)+' L').padStart(w)+(pct+'%').padStart(5))+' '+META[c].mark+' '+t(META[c].zh,META[c].en,META[c].km)+(C.rows.length?' · '+C.rows.length:'')+(!C.rows.length&&C.latest?' · '+t('最近','latest','ចុងក្រោយ')+' '+C.latest:''));});
  }
  keys.forEach(c=>{const C=D.cats[c],m=META[c];if(!C.list.length)return;
    out.push('');
    out.push(m.icon+' <b>'+t(m.zh,m.en,m.km)+'</b> · '+n0(C.liters)+' L'+(c==='driver'&&C.avg?' · '+t('平均','avg','មធ្យម')+' '+C.avg.toFixed(2)+' km/L':'')+(c==='generator'&&C.avg?' · '+t('平均','avg','មធ្យម')+' '+C.avg.toFixed(1)+' L/hr':''));
    const wl=Math.max(...C.list.map(g=>(n0(g.liters)+'L').length)),hasRate=C.list.some(g=>g.rate),wr=hasRate?Math.max(...C.list.map(g=>g.rate?g.rate.toFixed(c==='driver'?2:1).length:1)):0;
    C.list.forEach(g=>{const rate=g.rate?g.rate.toFixed(c==='driver'?2:1):'—';
      out.push(TG.mono((n0(g.liters)+'L').padStart(wl)+(hasRate?rate.padStart(wr+1):''))+' '+(hasRate?(TG.light(g.tone)||'⚪')+' ':'')+TG.safe(g.name)+(c==='driver'&&g.km?' · '+n0(g.km)+' km':'')+(c==='forklift'&&g.km?' · '+g.km.toFixed(1)+' km':'')+(c==='generator'&&g.hours?' · '+g.hours.toFixed(1)+' hr':'')+(c!=='driver'&&g.n>1?' · '+g.n+' '+t('筆','recs','កំណត់ត្រា'):''));});
  });
  out.push(TG.RULE);
  if(D.cats.driver&&D.cats.driver.avg||D.cats.generator&&D.cats.generator.avg)out.push('🟢🟡🔴 '+t('與平均差','vs avg','ធៀបមធ្យម')+': ≤10% / 10–20% / >20%');
  out.push('🔎 '+t('檢查人','Inspector','អ្នកត្រួតពិនិត្យ')+': '+(D.inspectors.length?TG.safe(D.inspectors.join(', ')):t('原表未填','not provided','មិនបានបំពេញ')));
  if(D.warnings)out.push('⚠️ '+t('原始日期待核對','Source dates need review','ត្រូវពិនិត្យថ្ងៃ')+': '+D.warnings);
  if(D.selected.length)out.push(D.verified?'✅ '+t('各類加總＝合計，已核對正確','Categories add up to the total — verified','ផលបូកតាមប្រភេទ = សរុប — បានផ្ទៀងផ្ទាត់'):'🔴 '+t('各類加總與合計不符，請檢查','Categories do not add up to the total — please check','ផលបូកមិនស្មើសរុប សូមពិនិត្យ'));
  return out.join('\n');
};
/* 附圖：大數字＋三類比例＋司機油耗表（格子上色）＋每日用量 */
window.fuelSummaryChart=function(s){
  const TG=GA.telegram,L=s.lang||'both',t=(zh,en,km)=>TG.label(zh,en,km,L),D=fuelSummaryData(s),n0=v=>Math.round(v).toLocaleString('en-US');
  if(!D.selected.length)return null;
  const COL={driver:'#2b8fbd',forklift:'#f2a93b',generator:'#e6c229'},NAME={driver:t('司機','Driver','អ្នកបើកបរ'),forklift:t('堆高機','Forklift','ឡានស្ទូច'),generator:t('發電機','Generator','ម៉ាស៊ីនភ្លើង')},BG={ok:'#d9f2e3',warn:'#fff1c2',bad:'#fbd5d3'};
  const keys=Object.keys(D.cats),blocks=[];
  blocks.push({type:'stats',items:[{label:t('合計','Total','សរុប'),value:n0(D.total)+' L',sub:D.selected.length+' '+t('筆','records','កំណត់ត្រា')}].concat(keys.map(c=>({label:NAME[c],value:n0(D.cats[c].liters)+' L',color:COL[c],sub:D.total?Math.round(D.cats[c].liters/D.total*100)+'%':''})))});
  if(keys.length>1)blocks.push({type:'donut',span:2,title:t('用量比例','Share by type','សមាមាត្រ'),items:keys.filter(c=>D.cats[c].liters>0).map(c=>({label:NAME[c],value:D.cats[c].liters,color:COL[c]})),center:n0(D.total),centerSub:'L'});
  const days={};D.selected.forEach(r=>{const d=String(r.date||'').slice(s.ptype==='year'?0:5,s.ptype==='year'?7:10);days[d]=(days[d]||0)+M.num(r.liters);});
  const dk=Object.keys(days).sort();if(dk.length>1)blocks.push({type:'columns',title:s.ptype==='year'?t('每月用量','Litres by month','តាមខែ'):t('每日用量','Litres by day','តាមថ្ងៃ'),unit:'L',items:dk.slice(-16).map(d=>({label:d,value:days[d],color:'#2b8fbd'}))});
  const dr=D.cats.driver;if(dr&&dr.list.length)blocks.push({type:'table',title:'🚗 '+NAME.driver+(dr.avg?' · '+t('平均','avg','មធ្យម')+' '+dr.avg.toFixed(2)+' km/L':''),head:[t('司機／車牌','Driver / plate','អ្នកបើកបរ'),'L','km','km/L'],align:['l','r','r','r'],widths:[2.6,1,1.2,1.1],rows:dr.list.map(g=>[g.name,n0(g.liters),g.km?n0(g.km):'—',{text:g.rate?g.rate.toFixed(2):'—',bg:BG[g.tone]||'',bold:true}]),total:[t('小計','Subtotal','សរុបរង'),n0(dr.liters),dr.km?n0(dr.km):'—',dr.avg?dr.avg.toFixed(2):'—'],note:t('綠＝平均 ±10% 內　黃＝差 10–20%　紅＝差超過 20%','Green = within 10% of average · Yellow = 10–20% · Red = over 20%','បៃតង = ក្នុង 10% · លឿង = 10–20% · ក្រហម = លើស 20%')});
  const fk=D.cats.forklift;if(fk&&fk.list.length)blocks.push({type:'table',title:'🏗️ '+NAME.forklift,head:[t('部門／車號','Dept / unit','ផ្នែក'),'L','km',t('筆','recs','កំណត់ត្រា')],align:['l','r','r','r'],widths:[2.6,1,1.2,1.1],rows:fk.list.map(g=>[g.name,n0(g.liters),g.km?g.km.toFixed(1):'—',g.n]),total:[t('小計','Subtotal','សរុបរង'),n0(fk.liters),fk.km?fk.km.toFixed(1):'—',fk.rows.length]});
  const gn=D.cats.generator;if(gn&&gn.list.length)blocks.push({type:'table',title:'⚡ '+NAME.generator+(gn.avg?' · '+t('平均','avg','មធ្យម')+' '+gn.avg.toFixed(1)+' L/hr':''),head:[t('機台','Machine','ម៉ាស៊ីន'),'L','hr','L/hr'],align:['l','r','r','r'],widths:[2.6,1,1.2,1.1],rows:gn.list.map(g=>[g.name,n0(g.liters),g.hours?g.hours.toFixed(1):'—',{text:g.rate?g.rate.toFixed(1):'—',bg:BG[g.tone]||'',bold:true}]),total:[t('小計','Subtotal','សរុបរង'),n0(gn.liters),gn.hours?gn.hours.toFixed(1):'—',gn.avg?gn.avg.toFixed(1):'—']});
  return {title:'🛢️ '+t('柴油摘要','Diesel Summary','សង្ខេបប្រេង'),subtitle:TG.periodLabel(s.period,s.ptype,L).replace(/ \/ /g,' '),theme:'navy',blocks:blocks,footer:'AC-GA-EXP · '+GA.ymd(new Date())};
};
window.fuelTelegram=function(){GA.telegram.open({module:'fuel',canApprove:false,beforeSend:window.fuelFlush,ptype:'month',period:window.fuelSummaryPeriod||GA.currentPeriod('month'),scopes:[{v:'all',zh:'全部',en:'All',km:'ទាំងអស់'},{v:'driver',zh:'司機',en:'Driver',km:'អ្នកបើកបរ'},{v:'forklift',zh:'堆高機',en:'Forklift',km:'ឡានស្ទូច'},{v:'generator',zh:'發電機',en:'Generator',km:'ម៉ាស៊ីនភ្លើង'}],periods:fuelPeriods,summary:fuelSummaryText,chart:fuelSummaryChart,onSummarySent:()=>repo.schedule()});};
window.genSummary=function(){const el=document.getElementById('sumBox');if(el)el.textContent=fuelSummaryText({scope:'all',ptype:'month',period:window.fuelSummaryPeriod||GA.currentPeriod('month'),lang:lang});};window.sendTgSummary=window.fuelTelegram;
window.exportAllExcel=function(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(DB.map(r=>({...r,warnings:JSON.stringify(r.warnings||[])}))),'GA_DATA');XLSX.writeFile(wb,'GA_Fuel_'+GA.ymd()+'.xlsx');};window.exportExcel=window.exportAllExcel;window.fuelMergeRecords=(a,b)=>M.plan(a,b).rows;window.fuelDataPanel=function(){GA.dataPanel({module:'fuel',count:()=>DB.length,data:()=>({DB}),restore:(obj,mode)=>{const incoming=Array.isArray(obj)?obj:obj.DB||obj.db;if(!Array.isArray(incoming)||incoming.some(r=>!M.valid(r.date)||!r.id))throw new Error('Invalid backup');const p=M.plan(DB,incoming);if(p.updated&&!confirm(F('備份含不同資料，更新？','Backup has changed records. Update?','កែទិន្នន័យខុសគ្នា?')))return;DB=mode==='replace'?incoming:p.rows;save();},clear:()=>{DB=[];save();},exportXlsx:exportAllExcel,onChange:()=>{refresh();scheduleFuelAutoSync();}});};
const fuelReady=repo.loaded.then(async()=>{initializing=false;const byId=new Map(repo.rows().map(r=>[String(r.id),r]));for(const r of starting){const old=byId.get(String(r.id));if(!old||new Date(r.updatedAt||r.createdAt||0)>new Date(old.updatedAt||old.createdAt||0))byId.set(String(r.id),r);}DB=Array.from(byId.values());await repo.capture(DB);try{localStorage.removeItem(LS);}catch(_){}/* v3.9.25 migrated into IndexedDB */refresh();}).catch(e=>{localError=e;syncStatus('error',e.message);});
fuelReady.then(async()=>{if(localError||!await repo.sync())return;const legacy=repo.rows().filter(r=>/^Transport:/i.test(r.remarks||''));if(legacy.length){const dest=GAMobilityStore.create('transport',{status:()=>{}});await dest.loaded;await dest.sync();const target=dest.rows().slice();for(const r of legacy){if(!target.some(x=>x.date===r.date&&String(x.driver).toLowerCase()===String(r.driver).toLowerCase()))target.push({...r,id:'migrated_'+r.id,_rev:undefined,cat:'transport',routeType:'legacy_daily',reason:r.remarks,sourceKind:'legacy_transport'});}await dest.capture(target);if(await dest.sync()){const ids=new Set(legacy.map(r=>r.id));DB=repo.rows().filter(r=>!ids.has(r.id));await repo.capture(DB);await repo.sync();}}}).catch(e=>syncStatus('error',e.message));
})();
