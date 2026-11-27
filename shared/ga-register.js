/* GA Register v1.0 — 通用設備/工具/水電登記簿
 * 編號(自動,可改) + QR + 類別/細類 + 新增/編輯/刪除 + 匯入/匯出(xlsx/csv) + 雲端上傳/下載(不重複)
 * 卡片(數量) → 清單 → 單筆詳細。可給其他平台重用：GAReg.mount(el,cfg)
 * 刪除採 tombstone(_del)，多台裝置同步時不會「刪了又回來」。 */
(function(g){
'use strict';
if(g.GAReg)return;
var VER='1.1';
var CSS='.gr{font-size:14px}.gr *{box-sizing:border-box}'+
'.gr-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}'+
'.gr-bar input{flex:1;min-width:150px;border:1px solid #d0d5e8;border-radius:10px;padding:8px 10px;font:inherit}'+
'.gr-b{border:1px solid #d0d5e8;background:#fff;border-radius:10px;padding:7px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:#334155;white-space:nowrap}'+
'.gr-b.p{background:#0d9488;border-color:#0d9488;color:#fff}.gr-b.r{color:#b91c1c;border-color:#fecaca}'+
'.gr-st{font-size:11.5px;color:#64748b;margin:-4px 0 10px}.gr-st.err{color:#b91c1c}.gr-st.ok{color:#047857}'+
'.gr-k{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}@media(min-width:720px){.gr-k{grid-template-columns:repeat(4,1fr)}}'+
'.gr-kc{background:#fff;border:1px solid #e2e6f0;border-left:4px solid var(--c);border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;font:inherit}'+
'.gr-kc:active{transform:scale(.98)}.gr-kc b{display:block;font-size:22px;font-weight:800;font-family:ui-monospace,monospace;color:var(--c)}'+
'.gr-kc span{font-size:12px;color:#475569;font-weight:700}.gr-kc small{display:block;font-size:11px;color:#94a3b8;margin-top:2px}'+
'.gr-ch{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.gr-ch button{border:1px solid #d0d5e8;background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:12px;font-weight:700;color:#5a6a7e;cursor:pointer}'+
'.gr-ch button.on{background:#0d9488;border-color:#0d9488;color:#fff}'+
'.gr-l{background:#fff;border:1px solid #e2e6f0;border-radius:12px;overflow:hidden}'+
'.gr-r{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid #eef1f6;cursor:pointer}.gr-r:last-child{border-bottom:0}.gr-r:active{background:#f1f5f9}'+
'.gr-code{font-family:ui-monospace,monospace;font-weight:800;font-size:12px;color:#0f766e;background:#ccfbf1;border-radius:6px;padding:2px 6px}'+
'.gr-n{font-weight:700;font-size:13.5px}.gr-s{font-size:11.5px;color:#64748b;margin-top:1px}.gr-q{font-family:ui-monospace,monospace;font-weight:800;text-align:right}.gr-q small{display:block;font-size:10.5px;font-weight:700}'+
'.gr-e{padding:26px;text-align:center;color:#94a3b8}'+
'.gr-ov{position:fixed;inset:0;background:rgba(8,15,25,.55);z-index:2100;display:flex;align-items:flex-end;justify-content:center}'+
'@media(min-width:720px){.gr-ov{align-items:center}}'+
'.gr-sh{background:#f6f8fb;width:100%;max-width:720px;max-height:92vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}@media(min-width:720px){.gr-sh{border-radius:18px}}'+
'.gr-hd{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid #e2e6f0}.gr-hd h3{flex:1;font-size:15px;margin:0}'+
'.gr-x{border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer}'+
'.gr-bd{overflow:auto;padding:12px 14px 22px}'+
'.gr-tb{display:flex;gap:6px;padding:8px 14px;background:#fff;border-bottom:1px solid #e2e6f0}.gr-tb button{flex:1;border:1px solid #d0d5e8;background:#fff;border-radius:9px;padding:6px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.gr-tb button.on{background:#0f2b46;color:#fff;border-color:#0f2b46}'+
'.gr-bars .br{display:grid;grid-template-columns:110px 1fr 54px;gap:8px;align-items:center;margin:6px 0;cursor:pointer;font-size:12.5px}'+
'.gr-bars .bt{height:14px;background:#e2e8f0;border-radius:7px;overflow:hidden}.gr-bars .bt i{display:block;height:100%;background:var(--c,#0d9488);border-radius:7px}'+
'.gr-bars .bv{font-family:ui-monospace,monospace;font-weight:800;text-align:right}'+
'.gr-dg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gr-dg div{background:#fff;border:1px solid #e2e6f0;border-radius:10px;padding:8px 10px;font-size:13px;word-break:break-word}.gr-dg b{display:block;font-size:11px;color:#64748b;margin-bottom:2px}.gr-dg .w{grid-column:1/-1}'+
'.gr-qr{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #e2e6f0;border-radius:12px;padding:10px;margin-bottom:10px}.gr-qr img{width:112px;height:112px;image-rendering:pixelated}'+
'.gr-qr .c{font-family:ui-monospace,monospace;font-size:20px;font-weight:800;color:#0f766e}'+
'.gr-ac{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}'+
'.gr-f label{display:block;font-size:11.5px;font-weight:700;color:#475569;margin:8px 0 3px}.gr-f input,.gr-f select,.gr-f textarea{width:100%;border:1px solid #d0d5e8;border-radius:9px;padding:8px 9px;font:inherit;background:#fff}'+
'.gr-f .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gr-warn{color:#b91c1c;font-size:12px;margin-top:4px}'+
'.gr-pill{display:inline-block;font-size:11px;font-weight:800;padding:1px 7px;border-radius:6px}.st-ok{background:#dcfce7;color:#166534}.st-repair{background:#ffedd5;color:#9a3412}.st-broken{background:#fee2e2;color:#991b1b}.st-scrap{background:#e2e8f0;color:#475569}.st-spare{background:#e0f2fe;color:#075985}'+
'.gr-sel{width:18px;height:18px}';
var STATUS=[['ok','✅ 正常','Normal'],['spare','📦 備用','Spare'],['repair','🟠 維修中','Repair'],['broken','🔴 故障','Broken'],['scrap','⚫ 報廢','Scrapped']];
var COLS=[['code','編號','Code'],['catName','類別','Category'],['sub','細類','Type'],['name','名稱','Name'],['brand','品牌','Brand'],['model','型號','Model'],['spec','規格','Spec'],['loc','地點','Location'],['qty','數量','Qty'],['unit','單位','Unit'],['status','狀態','Status'],['owner','負責人','Owner'],['buyDate','購入日期','Purchase date'],['price','金額USD','Price USD'],['note','備註','Note']];
var ALIAS={code:['編號','code','no','編碼','asset code','id'],catName:['類別','category','cat','大類'],sub:['細類','type','項目','種類','sub'],name:['名稱','name','品名','設備名稱'],brand:['品牌','brand'],model:['型號','model'],spec:['規格','spec','specification','容量'],loc:['地點','位置','location','loc','放置地點','區域'],qty:['數量','qty','quantity','數'],unit:['單位','unit'],status:['狀態','status'],owner:['負責人','owner','保管人','管理人'],buyDate:['購入日期','purchase date','buy date','日期','date'],price:['金額usd','金額','price','price usd','cost','費用'],note:['備註','note','remark','remarks','說明']};
var LANG=function(){return (g.GA&&GA.lang)||(function(){try{return localStorage.getItem('ac_lang')||'zh'}catch(e){return 'zh'}})()};
var DICT={"讀取雲端": ["Reading cloud", "កំពុងអានពពក"], "雲端尚無資料（新增後會自動上傳）": ["No cloud data yet (uploads automatically after you add)", "មិនទាន់មានទិន្នន័យលើពពក (នឹងផ្ទុកឡើងស្វ័យប្រវត្តិ)"], "已與雲端同步": ["Synced with cloud", "បានធ្វើសមកាលកម្មជាមួយពពក"], "雲端讀取失敗：": ["Cloud read failed: ", "អានពពកបរាជ័យ៖ "], "下載失敗：": ["Download failed: ", "ទាញយកបរាជ័យ៖ "], "上傳變更": ["Uploading changes", "កំពុងផ្ទុកការផ្លាស់ប្តូរ"], "已上傳": ["Uploaded", "បានផ្ទុកឡើង"], "上傳失敗（資料仍在本機，稍後自動重試）：": ["Upload failed (data kept on this device, will retry): ", "ផ្ទុកឡើងបរាជ័យ (ទិន្នន័យនៅក្នុងឧបករណ៍ នឹងព្យាយាមម្តងទៀត)៖ "], "上傳失敗：": ["Upload failed: ", "ផ្ទុកឡើងបរាជ័យ៖ "], "尚無資料": ["No items yet", "មិនទាន់មានទិន្នន័យ"], "按「": ["tap “", "ចុច “"], "新增」或「": ["Add” or “", "បន្ថែម” ឬ “"], "匯入」": ["Import”", "នាំចូល”"], "未填": ["blank", "ទទេ"], "沒有資料": ["No data", "គ្មានទិន្នន័យ"], "筆登記": ["records", "កំណត់ត្រា"], "維修中／故障": ["Under repair / broken", "កំពុងជួសជុល / ខូច"], "點開看是哪幾項": ["Tap to see which", "ចុចដើម្បីមើល"], "全部": ["All", "ទាំងអស់"], "共": ["Total", "សរុប"], "筆": ["items", "ធាតុ"], "數量合計": ["total qty", "ចំនួនសរុប"], "清單": ["List", "បញ្ជី"], "地點": ["Location", "ទីតាំង"], "細類": ["Type", "ប្រភេទរង"], "狀態": ["Status", "ស្ថានភាព"], "掃": ["Scan", "ស្កេន"], "直接打開這筆": ["to open this item", "ដើម្បីបើកធាតុនេះ"], "數量": ["Qty", "ចំនួន"], "負責人": ["Owner", "អ្នកទទួលខុសត្រូវ"], "品牌": ["Brand", "ម៉ាក"], "型號": ["Model", "ម៉ូដែល"], "規格": ["Spec", "លក្ខណៈ"], "購入日期": ["Purchase date", "ថ្ងៃទិញ"], "金額": ["Price", "តម្លៃ"], "備註": ["Note", "កំណត់ចំណាំ"], "最後更新": ["Last updated", "កែចុងក្រោយ"], "編輯": ["Edit", "កែ"], "印": ["Print", "បោះពុម្ព"], "標籤": ["label", "ស្លាក"], "複製一筆": ["Duplicate", "ចម្លង"], "刪除": ["Delete", "លុប"], "確定刪除": ["Delete", "លុប"], "會同步到雲端，其他裝置也會消失）": ["also removed from the cloud and other devices)", "ក៏នឹងលុបពីពពក និងឧបករណ៍ផ្សេងទៀត)"], "類別": ["Category", "ប្រភេទ"], "編號（自動，可自行改）": ["Code (auto, editable)", "លេខកូដ (ស្វ័យប្រវត្តិ អាចកែបាន)"], "例：": ["e.g. ", "ឧ. "], "名稱": ["Name", "ឈ្មោះ"], "單位": ["Unit", "ឯកតា"], "台": ["set", "គ្រឿង"], "支": ["pc", "ដើម"], "個": ["ea", "ក"], "儲存": ["Save", "រក្សាទុក"], "取消": ["Cancel", "បោះបង់"], "新增": ["Add", "បន្ថែម"], "編號已被「": ["Code already used by “", "លេខកូដត្រូវបានប្រើដោយ “"], "使用": ["", "”"], "請填編號": ["Please enter a code", "សូមបញ្ចូលលេខកូដ"], "請填名稱或細類": ["Please enter a name or type", "សូមបញ្ចូលឈ្មោះ ឬប្រភេទរង"], "請允許彈出視窗": ["Please allow pop-ups", "សូមអនុញ្ញាតផ្ទាំងលោត"], "登記簿": ["Register", "បញ្ជី"], "元件載入失敗": ["component failed to load", "មិនអាចផ្ទុកកម្មវិធីបាន"], "匯入完成：新增": ["Import done: added", "នាំចូលរួច៖ បន្ថែម"], "筆、更新": [", updated", " កែ"], "筆、重複略過": [", duplicates skipped", " រំលងស្ទួន"], "匯入失敗：": ["Import failed: ", "នាំចូលបរាជ័យ៖ "], "搜尋": ["Search", "ស្វែងរក"], "編號／名稱／地點／型號": ["code / name / location / model", "លេខកូដ / ឈ្មោះ / ទីតាំង / ម៉ូដែល"], "匯入": ["Import", "នាំចូល"], "匯出": ["Export", "នាំចេញ"], "同步": ["Sync", "សមកាលកម្ម"], "本機資料讀取中": ["Loading local data", "កំពុងផ្ទុកទិន្នន័យ"], "沒有可印的項目": ["Nothing to print", "គ្មានអ្វីត្រូវបោះពុម្ព"], "要印": ["Print", "បោះពុម្ព"], "張標籤？": ["labels?", "ស្លាក?"], "本機": ["On this device", "ក្នុងឧបករណ៍"], "✅ 正常": ["✅ Normal", "✅ ធម្មតា"], "📦 備用": ["📦 Spare", "📦 បម្រុង"], "🟠 維修中": ["🟠 Repair", "🟠 កំពុងជួសជុល"], "🔴 故障": ["🔴 Broken", "🔴 ខូច"], "⚫ 報廢": ["⚫ Scrapped", "⚫ ចោល"], "照片（最多 3 張，可直接拍照）": ["Photos (up to 3, camera OK)", "រូបថត (អតិបរមា 3)"], "參考照片（同一細類的其他筆）": ["Reference photos (same type)", "រូបថតយោង (ប្រភេទដូចគ្នា)"], "＋ 加照片": ["＋ Add photo", "＋ បន្ថែមរូបថត"], "點照片放大": ["Tap a photo to enlarge", "ចុចដើម្បីពង្រីក"], "照片": ["Photos", "រូបថត"], "最多 3 張": ["Up to 3 photos", "អតិបរមា 3"]};
function T(z){var l=LANG(),d=DICT[z];if(l==='zh'||!d)return z;return l==='km'?d[1]:d[0]}
 /* v1.1 細類／地點也照語言顯示（Paul 2026-11-27：切英文底下還是中文選項）：存中文原值，畫面顯示翻譯；選英文或柬文會自動換回中文原值 */
 function VT(s){if(s==null||s==='')return s;var I=g.FAC_I18N||{},d=(I.subs&&I.subs[s])||(I.locs&&I.locs[s]);if(!d){var m=String(s).match(/^(.*?)(\s*\d+F)$/);if(m&&I.locs&&I.locs[m[1]])d=[I.locs[m[1]][0]+m[2],I.locs[m[1]][1]+m[2]]}var l=LANG();if(l==='zh'||!d)return s;return l==='km'?(d[1]||d[0]):d[0]}
 function canon(v,list){v=String(v||'').trim();if(!v)return v;for(var i=0;i<list.length;i++){var z=list[i];if(v===z||v===VT(z))return z;var I=g.FAC_I18N||{},d=(I.subs&&I.subs[z])||(I.locs&&I.locs[z]);if(d&&(v.toLowerCase()===String(d[0]).toLowerCase()||v===d[1]))return z}return v}
 /* 照片：每筆最多 3 張（手機可直接拍照），縮到 640px 存在記錄裡，跟著雲端同步 */
 function shrink(file){return new Promise(function(res,rej){var rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){var s=Math.min(1,640/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.7))};im.onerror=rej;im.src=rd.result};rd.onerror=rej;rd.readAsDataURL(file)})}
 function zoom(src){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:12px';d.innerHTML='<img src="'+src+'" style="max-width:100%;max-height:100%;border-radius:10px">';d.onclick=function(){d.remove()};document.body.appendChild(d)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function now(){return new Date().toISOString()}
function uid(){return 'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function norm(s){return String(s==null?'':s).trim().toLowerCase().replace(/\s+/g,' ')}
var dbP=null;function db(){if(dbP)return dbP;dbP=new Promise(function(res,rej){var q=indexedDB.open('ga_register',1);q.onupgradeneeded=function(){q.result.createObjectStore('kv')};q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}});return dbP}
function idbGet(k){return db().then(function(d){return new Promise(function(res){var t=d.transaction('kv').objectStore('kv').get(k);t.onsuccess=function(){res(t.result)};t.onerror=function(){res(null)}})}).catch(function(){return null})}
function idbSet(k,v){return db().then(function(d){return new Promise(function(res){var t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=function(){res(true)};t.onerror=function(){res(false)}})}).catch(function(){return false})}
var qrLoad=null;function loadQR(){if(g.qrcode)return Promise.resolve();if(qrLoad)return qrLoad;qrLoad=new Promise(function(res,rej){var s=document.createElement('script');var base=(document.querySelector('script[src*="ga-register.js"]')||{}).src||'';s.src=base.replace(/ga-register\.js.*$/,'qrcode.min.js');s.onload=res;s.onerror=function(){var t=document.createElement('script');t.src='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';t.onload=res;t.onerror=rej;document.head.appendChild(t)};document.head.appendChild(s)});return qrLoad}
function qrUrl(t){try{var q=g.qrcode(0,'M');q.addData(unescape(encodeURIComponent(t)));q.make();return q.createDataURL(5,2)}catch(e){return ''}}
var xlLoad=null;function loadXL(){if(g.XLSX)return Promise.resolve();if(xlLoad)return xlLoad;xlLoad=new Promise(function(res,rej){var s=document.createElement('script');var base=(document.querySelector('script[src*="ga-register.js"]')||{}).src||'';s.src=base?base.replace(/ga-register\.js.*$/,'xlsx.full.min.js'):'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});return xlLoad}

function mount(el,cfg){
 if(!document.getElementById('gr-css')){var st=document.createElement('style');st.id='gr-css';st.textContent=CSS;document.head.appendChild(st)}
 var S={rows:[],cat:'all',q:'',cfg:cfg,busy:false,dirty:false,t:0};
 var CAT={};cfg.cats.forEach(function(c){CAT[c.k]=c});
 var KEY='reg_'+cfg.tool;
 function live(){return S.rows.filter(function(r){return !r._del})}
 function catName(k){var c=CAT[k];if(!c)return k;var l=LANG();return (l==='en'&&c.en)||(l==='km'&&c.km)||c.n}
 function stInfo(k){var x=STATUS[0];for(var i=0;i<STATUS.length;i++)if(STATUS[i][0]===k)x=STATUS[i];return [x[0],T(x[1]),x[2]]}
 function qtyOf(r){var n=parseFloat(r.qty);return isNaN(n)?1:n}
 function wrap(r){r._syncId=r.id;r._syncBucket='c:'+r.cat;return r}
 function save(){S.dirty=true;idbSet(KEY,{rows:S.rows,at:now()});clearTimeout(S.t);S.t=setTimeout(function(){push(true)},2500)}
 function maxNum(p){var m=0,re=new RegExp('^'+p+'-?(\\d+)$');S.rows.forEach(function(r){var x=String(r.code||'').match(re);if(x)m=Math.max(m,+x[1])});return m}
 function genCode(cat){var p=(CAT[cat]&&CAT[cat].k)||cat,n=maxNum(p)+1,c;do{c=p+String(n).padStart(3,'0');n++}while(S.rows.some(function(r){return r.code===c}));return c}
 function byCode(c,exceptId){c=norm(c);if(!c)return null;for(var i=0;i<S.rows.length;i++){var r=S.rows[i];if(!r._del&&norm(r.code)===c&&r.id!==exceptId)return r}return null}
 function setSt(t,k){var e=el.querySelector('.gr-st');if(e){e.textContent=t;e.className='gr-st '+(k||'')}}
 function url(){return cfg.url||(g.GA&&GA.gasUrl?GA.gasUrl():'')}
 function mergeIn(rs){var m={};S.rows.forEach(function(r){m[r.id]=r});(rs||[]).forEach(function(r){if(!r||!r.id)return;var o=m[r.id];if(!o||String(r.updatedAt||'')>String(o.updatedAt||''))m[r.id]=wrap(r)});S.rows=Object.keys(m).map(function(k){return m[k]});}
 function pull(silent){var u=url();if(!u||!g.GASmartSync)return Promise.resolve();setSt('⬇ '+T('讀取雲端')+'…');
  return GASmartSync.pull({url:u,tool:cfg.tool,localRecords:S.rows.slice(),allowDeletes:false,apply:function(rs){mergeIn(rs);idbSet(KEY,{rows:S.rows,at:now()});render();}}).then(function(r){setSt(r&&r.noCloud?'☁️ '+T('雲端尚無資料（新增後會自動上傳）')+'':'☁️ '+T('已與雲端同步')+' · '+new Date().toLocaleTimeString(),'ok');return r}).catch(function(e){setSt(''+T('雲端讀取失敗：')+''+(e&&e.message||e),'err');if(!silent)alert(''+T('下載失敗：')+''+(e&&e.message||e))})}
 function push(silent){var u=url();if(!u||!g.GASmartSync||S.busy)return Promise.resolve();S.busy=true;setSt('⬆ '+T('上傳變更')+'…');
  var mk=function(){return{url:u,tool:cfg.tool,records:S.rows.map(wrap),allowDeletes:false,autoMerge:true,summary:{records:live().length}}};
  return GASmartSync.push(mk()).then(function(r){if(r&&r.needsPull)return pull(true).then(function(){return GASmartSync.push(mk())});return r}).then(function(){S.dirty=false;setSt('☁️ '+T('已上傳')+' · '+new Date().toLocaleTimeString(),'ok')}).catch(function(e){setSt(''+T('上傳失敗（資料仍在本機，稍後自動重試）：')+''+(e&&e.message||e),'err');if(!silent)alert(''+T('上傳失敗：')+''+(e&&e.message||e))}).then(function(){S.busy=false})}
 function filtered(cat,q,extra){q=norm(q);return live().filter(function(r){if(cat&&cat!=='all'&&r.cat!==cat)return false;if(extra&&!extra(r))return false;if(!q)return true;return norm([r.code,r.name,r.sub,r.brand,r.model,r.loc,r.owner,r.note,catName(r.cat)].join(' ')).indexOf(q)>=0}).sort(function(a,b){return String(a.code).localeCompare(String(b.code))})}
 function rowHtml(r){var s=stInfo(r.status);return '<div class="gr-r" data-id="'+esc(r.id)+'"><span class="gr-code">'+esc(r.code)+'</span><div style="display:flex;gap:8px;align-items:center;min-width:0">'+(r.photos&&r.photos[0]?'<img src="'+r.photos[0]+'" style="width:38px;height:38px;object-fit:cover;border-radius:8px;flex:none">':'')+'<div style="min-width:0"><div class="gr-n">'+esc(r.name||VT(r.sub)||'-')+'</div><div class="gr-s">'+esc([VT(r.sub),r.loc&&('📍'+VT(r.loc)),r.model].filter(Boolean).join(' · '))+'</div></div></div><div class="gr-q">'+qtyOf(r)+(r.unit?' '+esc(T(r.unit)):'')+'<small class="gr-pill st-'+s[0]+'">'+s[1]+'</small></div></div>'}
 function listHtml(rs){return rs.length?'<div class="gr-l">'+rs.map(rowHtml).join('')+'</div>':'<div class="gr-e">'+T('尚無資料')+' · '+T('按「')+'➕ '+T('新增」或「')+'📥 '+T('匯入」')+'</div>'}
 function sumBy(rs,f){var m={};rs.forEach(function(r){var k=f(r)||'('+T('未填')+')';m[k]=(m[k]||0)+qtyOf(r)});return Object.keys(m).map(function(k){return[k,m[k]]}).sort(function(a,b){return b[1]-a[1]})}
 function barsHtml(pairs,kind,color){if(!pairs.length)return '<div class="gr-e">'+T('沒有資料')+'</div>';var mx=pairs[0][1]||1;return '<div class="gr-bars">'+pairs.map(function(p){return '<div class="br" data-bk="'+kind+'" data-bv="'+esc(p[0])+'"><span>'+esc(kind==='loc'||kind==='sub'?VT(p[0]):p[0])+'</span><span class="bt"><i style="width:'+Math.max(3,p[1]/mx*100)+'%;--c:'+(color||'#0d9488')+'"></i></span><span class="bv">'+p[1]+'</span></div>'}).join('')+'</div>'}
 function render(){
  var L=live(),cards=cfg.cats.map(function(c){var rs=L.filter(function(r){return r.cat===c.k});var q=rs.reduce(function(a,r){return a+qtyOf(r)},0);return '<button class="gr-kc" style="--c:'+c.color+'" data-kc="'+c.k+'"><b>'+q+'</b><span>'+c.ic+' '+esc(catName(c.k))+'</span><small>'+rs.length+' '+T('筆登記')+' · '+c.k+'xxx</small></button>'});
  var bad=L.filter(function(r){return r.status==='repair'||r.status==='broken'});
  cards.push('<button class="gr-kc" style="--c:#dc2626" data-kc="!bad"><b>'+bad.length+'</b><span>⚠️ '+T('維修中／故障')+'</span><small>'+T('點開看是哪幾項')+'</small></button>');
  el.querySelector('.gr-k').innerHTML=cards.join('');
  el.querySelector('.gr-ch').innerHTML=[['all',''+T('全部')+' '+L.length]].concat(cfg.cats.map(function(c){return[c.k,c.ic+' '+catName(c.k)]})).map(function(x){return '<button class="'+(S.cat===x[0]?'on':'')+'" data-ch="'+x[0]+'">'+esc(x[1])+'</button>'}).join('');
  el.querySelector('.gr-lw').innerHTML=listHtml(filtered(S.cat,S.q));
 }
 /* ---------- overlay ---------- */
 function sheet(title,body,tabs){var ov=document.createElement('div');ov.className='gr-ov';ov.innerHTML='<div class="gr-sh"><div class="gr-hd"><h3>'+title+'</h3><button class="gr-x">✕</button></div>'+(tabs||'')+'<div class="gr-bd">'+body+'</div></div>';ov.addEventListener('click',function(e){if(e.target===ov||e.target.closest('.gr-x'))ov.remove()});document.body.appendChild(ov);return ov}
 function openList(key){
  var title,pred=null,cat='all',color='#0d9488';
  if(key==='!bad'){title='⚠️ '+T('維修中／故障')+'';pred=function(r){return r.status==='repair'||r.status==='broken'};color='#dc2626'}
  else if(key.indexOf('loc:')===0){var lv=key.slice(4);title='📍 '+VT(lv);pred=function(r){return (r.loc||'('+T('未填')+')')===lv}}
  else if(key.indexOf('sub:')===0){var sv=key.slice(4);title='🔖 '+VT(sv);pred=function(r){return (r.sub||'('+T('未填')+')')===sv}}
  else{cat=key;var c=CAT[key];title=c.ic+' '+catName(c.k)+' · '+c.k;color=c.color}
  var rs=filtered(cat,'',pred),tot=rs.reduce(function(a,r){return a+qtyOf(r)},0);
  var head='<div style="font-size:12.5px;color:#475569;margin-bottom:8px">'+T('共')+' <b>'+rs.length+'</b> '+T('筆')+' · '+T('數量合計')+' <b>'+tot+'</b></div>';
  var panes={l:head+listHtml(rs),loc:head+barsHtml(sumBy(rs,function(r){return r.loc}),'loc',color),sub:head+barsHtml(sumBy(rs,function(r){return r.sub}),'sub',color),st:head+barsHtml(sumBy(rs,function(r){return stInfo(r.status)[1]}),'st',color)};
  var ov=sheet(esc(title),panes.l,'<div class="gr-tb"><button class="on" data-p="l">📋 '+T('清單')+'</button><button data-p="loc">📍 '+T('地點')+'</button><button data-p="sub">🔖 '+T('細類')+'</button><button data-p="st">📊 '+T('狀態')+'</button></div>');
  ov.addEventListener('click',function(e){var b=e.target.closest('[data-p]');if(b){ov.querySelectorAll('[data-p]').forEach(function(x){x.classList.toggle('on',x===b)});ov.querySelector('.gr-bd').innerHTML=panes[b.dataset.p];return}
   var br=e.target.closest('.br');if(br&&br.dataset.bk!=='st'){openList(br.dataset.bk+':'+br.dataset.bv);return}
   var r=e.target.closest('.gr-r');if(r)openDetail(r.dataset.id)});
 }
 function qrText(r){return (cfg.qrBase||location.href.split('?')[0])+'?reg='+encodeURIComponent(r.code)}
 function openDetail(id){var r=S.rows.filter(function(x){return x.id===id})[0];if(!r)return;var s=stInfo(r.status);
  var f=function(l,v,w){return '<div'+(w?' class="w"':'')+'><b>'+l+'</b>'+(v===''||v==null?'—':esc(v))+'</div>'};
  var body='<div class="gr-qr"><img alt="QR"><div><div class="c">'+esc(r.code)+'</div><div style="font-weight:800;margin-top:2px">'+esc(r.name||r.sub||'')+'</div><div style="font-size:12px;color:#64748b;margin-top:4px">'+esc(catName(r.cat))+' · <span class="gr-pill st-'+s[0]+'">'+s[1]+'</span></div><div style="font-size:11px;color:#94a3b8;margin-top:4px">'+T('掃')+' QR '+T('直接打開這筆')+'</div></div></div>'+
  (r.photos&&r.photos.length?'<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:10px">'+r.photos.map(function(p){return '<img src="'+p+'" data-zoom style="height:120px;border-radius:10px;cursor:zoom-in;flex:none">'}).join('')+'</div><div style="font-size:11px;color:#94a3b8;margin:-6px 0 8px">'+T('點照片放大')+'</div>':'')+'<div class="gr-dg">'+f(''+T('細類')+'',VT(r.sub))+f(''+T('地點')+'',VT(r.loc))+f(''+T('數量')+'',qtyOf(r)+(r.unit?' '+r.unit:''))+f(''+T('負責人')+'',r.owner)+f(''+T('品牌')+'',r.brand)+f(''+T('型號')+'',r.model)+f(''+T('規格')+'',r.spec,1)+f(''+T('購入日期')+'',r.buyDate)+f(''+T('金額')+' USD',r.price)+f(''+T('備註')+'',r.note,1)+f(''+T('最後更新')+'',r.updatedAt?new Date(r.updatedAt).toLocaleString('zh-TW',{hour12:false}):'',1)+'</div>'+
  '<div class="gr-ac"><button class="gr-b p" data-a="edit">✏️ '+T('編輯')+'</button><button class="gr-b" data-a="lbl">🏷 '+T('印')+' QR '+T('標籤')+'</button><button class="gr-b" data-a="dup">📄 '+T('複製一筆')+'</button><button class="gr-b r" data-a="del">🗑 '+T('刪除')+'</button></div>';
  var ov=sheet('📄 '+esc(r.code),body);
  loadQR().then(function(){var im=ov.querySelector('.gr-qr img');if(im)im.src=qrUrl(qrText(r))}).catch(function(){});
  ov.addEventListener('click',function(e){var z=e.target.closest('[data-zoom]');if(z){zoom(z.src);return}var a=e.target.closest('[data-a]');if(!a)return;var k=a.dataset.a;
   if(k==='edit'){ov.remove();openForm(r)}
   else if(k==='dup'){ov.remove();var c=JSON.parse(JSON.stringify(r));delete c.id;c.code='';openForm(c,true)}
   else if(k==='lbl')printLabels([r]);
   else if(k==='del'){if(!confirm(''+T('確定刪除')+' '+r.code+' '+(r.name||'')+'？\n（'+T('會同步到雲端，其他裝置也會消失）')+''))return;r._del=1;r.updatedAt=now();save();render();ov.remove()}});
 }
 function opt(list,v){return list.map(function(x){var k=Array.isArray(x)?x[0]:x,l=Array.isArray(x)?x[1]:x;return '<option value="'+esc(k)+'"'+(String(v)===String(k)?' selected':'')+'>'+esc(l)+'</option>'}).join('')}
 function openForm(r,isNew){isNew=isNew||!r||!r.id;r=r||{cat:S.cat!=='all'?S.cat:cfg.cats[0].k,status:'ok',qty:1};
  var subs=function(c){return (CAT[c]&&CAT[c].subs)||[]};
  var locs={};S.rows.forEach(function(x){if(x.loc)locs[x.loc]=1});(cfg.locs||[]).forEach(function(x){locs[x]=1});
  var body='<div class="gr-f"><div class="two"><div><label>'+T('類別')+'</label><select name="cat">'+opt(cfg.cats.map(function(c){return[c.k,c.ic+' '+catName(c.k)]}),r.cat)+'</select></div><div><label>'+T('編號（自動，可自行改）')+'</label><input name="code" value="'+esc(r.code||genCode(r.cat))+'"><div class="gr-warn" id="gr-cw"></div></div></div>'+
  '<div class="two"><div><label>'+T('細類')+'</label><input name="sub" list="gr-subs" value="'+esc(VT(r.sub)||'')+'" placeholder="'+T('例：')+''+esc(subs(r.cat).slice(0,2).map(VT).join(LANG()==='zh'?'、':', '))+'"><datalist id="gr-subs">'+subs(r.cat).map(function(s){return '<option value="'+esc(VT(s))+'">'}).join('')+'</datalist></div><div><label>'+T('名稱')+'</label><input name="name" value="'+esc(r.name||'')+'"></div></div>'+
  '<div class="two"><div><label>'+T('地點')+'</label><input name="loc" list="gr-locs" value="'+esc(VT(r.loc)||'')+'"><datalist id="gr-locs">'+Object.keys(locs).sort().map(function(s){return '<option value="'+esc(VT(s))+'">'}).join('')+'</datalist></div><div class="two"><div><label>'+T('數量')+'</label><input name="qty" type="number" min="0" step="any" value="'+esc(r.qty==null?1:r.qty)+'"></div><div><label>'+T('單位')+'</label><input name="unit" value="'+esc(r.unit||'')+'" placeholder="'+T('台')+'/'+T('支')+'/'+T('個')+'"></div></div></div>'+
  '<div class="two"><div><label>'+T('品牌')+'</label><input name="brand" value="'+esc(r.brand||'')+'"></div><div><label>'+T('型號')+'</label><input name="model" value="'+esc(r.model||'')+'"></div></div>'+
  '<label>'+T('規格')+'</label><input name="spec" value="'+esc(r.spec||'')+'">'+
  '<div class="two"><div><label>'+T('狀態')+'</label><select name="status">'+opt(STATUS.map(function(s){return[s[0],T(s[1])]}),r.status||'ok')+'</select></div><div><label>'+T('負責人')+'</label><input name="owner" value="'+esc(r.owner||'')+'"></div></div>'+
  '<div class="two"><div><label>'+T('購入日期')+'</label><input name="buyDate" type="date" value="'+esc(r.buyDate||'')+'"></div><div><label>'+T('金額')+' USD</label><input name="price" type="number" step="any" value="'+esc(r.price||'')+'"></div></div>'+
  '<label>'+T('備註')+'</label><textarea name="note" rows="2">'+esc(r.note||'')+'</textarea>'+
  '<label>'+T('照片（最多 3 張，可直接拍照）')+'</label><div id="gr-ph" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div><input type="file" id="gr-pf" accept="image/*" capture="environment" multiple hidden>'+
  '<div id="gr-ref"></div>'+
  '<div class="gr-ac"><button class="gr-b p" data-a="ok">💾 '+T('儲存')+'</button><button class="gr-b" data-a="cancel">'+T('取消')+'</button></div></div>';
  var ov=sheet(isNew?'➕ '+T('新增')+'':'✏️ '+T('編輯')+' '+esc(r.code),body),F=function(n){return ov.querySelector('[name="'+n+'"]')};
  var codeTouched=!isNew;var PH=(r.photos||[]).slice();
  function drawPh(){var box=ov.querySelector('#gr-ph');box.innerHTML=PH.map(function(p,i){return '<span style="position:relative"><img src="'+p+'" data-zoom style="width:72px;height:72px;object-fit:cover;border-radius:10px;cursor:zoom-in"><button type="button" data-rm="'+i+'" style="position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:22px;height:22px;background:#b91c1c;color:#fff;font-weight:800">×</button></span>'}).join('')+(PH.length<3?'<button type="button" class="gr-b" data-a="ph">📷 '+T('＋ 加照片')+'</button>':'');
   var sv=canon(F('sub').value,subs(F('cat').value)),ref=[];S.rows.forEach(function(x){if(!x._del&&x.id!==r.id&&x.sub&&x.sub===sv&&x.photos)x.photos.forEach(function(p){if(ref.length<4)ref.push(p)})});
   ov.querySelector('#gr-ref').innerHTML=ref.length?'<div style="font-size:11.5px;font-weight:700;color:#475569;margin:8px 0 4px">'+T('參考照片（同一細類的其他筆）')+'</div><div style="display:flex;gap:6px">'+ref.map(function(p){return '<img src="'+p+'" data-zoom style="width:56px;height:56px;object-fit:cover;border-radius:8px;opacity:.85;cursor:zoom-in">'}).join('')+'</div>':''}
  ov.querySelector('#gr-pf').addEventListener('change',function(e){var fs=[].slice.call(e.target.files||[]).slice(0,3-PH.length);Promise.all(fs.map(shrink)).then(function(a){PH=PH.concat(a).slice(0,3);drawPh()}).catch(function(){});e.target.value=''});
  F('sub').addEventListener('change',drawPh);setTimeout(drawPh,0);
  F('code').addEventListener('input',function(){codeTouched=true;chk()});
  F('cat').addEventListener('change',function(){var c=F('cat').value;if(!codeTouched)F('code').value=genCode(c);ov.querySelector('#gr-subs').innerHTML=subs(c).map(function(s){return '<option value="'+esc(VT(s))+'">'}).join('');F('sub').placeholder=''+T('例：')+''+subs(c).slice(0,2).map(VT).join(LANG()==='zh'?'、':', ');drawPh()});
  function chk(){var d=byCode(F('code').value,r.id);ov.querySelector('#gr-cw').textContent=d?'⚠️ '+T('編號已被「')+''+(d.name||d.sub)+'」'+T('使用')+'':'';return !d}
  ov.addEventListener('click',function(e){var z=e.target.closest('[data-zoom]');if(z){zoom(z.src);return}var rm=e.target.closest('[data-rm]');if(rm){PH.splice(+rm.dataset.rm,1);drawPh();return}var a=e.target.closest('[data-a]');if(!a)return;if(a.dataset.a==='ph'){ov.querySelector('#gr-pf').click();return}if(a.dataset.a==='cancel'){ov.remove();return}
   if(!F('code').value.trim()){alert(''+T('請填編號')+'');return}if(!chk())return;if(!F('name').value.trim()&&!F('sub').value.trim()){alert(''+T('請填名稱或細類')+'');return}
   var o=isNew?{id:uid(),createdAt:now()}:S.rows.filter(function(x){return x.id===r.id})[0];
   ['cat','code','sub','name','loc','unit','brand','model','spec','status','owner','buyDate','price','note'].forEach(function(k){o[k]=F(k).value.trim()});o.code=o.code.toUpperCase();o.sub=canon(o.sub,subs(o.cat));o.loc=canon(o.loc,Object.keys(locs));o.photos=PH;o.qty=F('qty').value===''?1:+F('qty').value;o.updatedAt=now();
   if(isNew)S.rows.push(wrap(o));save();render();ov.remove();openDetail(o.id)});
 }
 function printLabels(rs){loadQR().then(function(){var w=g.open('','_blank');if(!w){alert(''+T('請允許彈出視窗')+'');return}
  w.document.write('<html><head><meta charset="utf-8"><title>QR '+T('標籤')+'</title><style>body{font-family:sans-serif;margin:8mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.l{border:1px dashed #999;padding:3mm;display:flex;gap:3mm;align-items:center;page-break-inside:avoid}.l img{width:26mm;height:26mm}.c{font:800 15px monospace}.n{font-size:11px;margin-top:1mm}.s{font-size:9px;color:#555;margin-top:1mm}</style></head><body><div class="g">'+rs.map(function(r){return '<div class="l"><img src="'+qrUrl(qrText(r))+'"><div><div class="c">'+esc(r.code)+'</div><div class="n">'+esc(r.name||r.sub||'')+'</div><div class="s">'+esc(catName(r.cat))+(r.loc?' · '+esc(r.loc):'')+'</div><div class="s">VRT '+esc(cfg.short||'')+'</div></div></div>'}).join('')+'</div><script>setTimeout(function(){print()},400)<\/script></body></html>');w.document.close()})}
 /* ---------- import / export ---------- */
 function exportX(){loadXL().then(function(){var rs=filtered(S.cat,S.q);var aoa=[COLS.map(function(c){return c[1]})].concat(rs.map(function(r){return COLS.map(function(c){var k=c[0];if(k==='catName')return catName(r.cat);if(k==='status')return stInfo(r.status)[1].replace(/^\S+\s/,'');if(k==='qty')return qtyOf(r);return r[k]==null?'':r[k]})}));
  var wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(aoa);ws['!cols']=COLS.map(function(c){return{wch:c[0]==='note'||c[0]==='name'?24:12}});XLSX.utils.book_append_sheet(wb,ws,''+T('登記簿')+'');XLSX.writeFile(wb,(cfg.file||cfg.tool)+'_'+new Date().toISOString().slice(0,10)+'.xlsx')}).catch(function(){alert('Excel '+T('元件載入失敗')+'')})}
 function findCat(v){var n=norm(v);if(!n)return '';for(var i=0;i<cfg.cats.length;i++){var c=cfg.cats[i];if(norm(c.k)===n||norm(c.n)===n||norm(c.n).indexOf(n)>=0||n.indexOf(norm(c.n).replace(/類$/,''))>=0)return c.k}return ''}
 function catFromSub(v){var n=norm(v);if(!n)return '';for(var i=0;i<cfg.cats.length;i++)if((cfg.cats[i].subs||[]).some(function(s){return norm(s)===n||n.indexOf(norm(s))>=0}))return cfg.cats[i].k;return ''}
 function stFrom(v){var n=norm(v);if(!n)return 'ok';for(var i=0;i<STATUS.length;i++){var s=STATUS[i];if(n===s[0]||norm(s[1]).indexOf(n)>=0||norm(s[2])===n)return s[0]}if(/修/.test(n))return 'repair';if(/壞|故障/.test(n))return 'broken';if(/報廢/.test(n))return 'scrap';if(/備/.test(n))return 'spare';return 'ok'}
 function importX(file){loadXL().then(function(){return file.arrayBuffer()}).then(function(buf){var wb=XLSX.read(buf,{type:'array',cellDates:true}),add=0,upd=0,skip=0;
  wb.SheetNames.forEach(function(sn){var aoa=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});var hi=-1,map={};
   for(var i=0;i<Math.min(aoa.length,10)&&hi<0;i++){var m={},hit=0;aoa[i].forEach(function(h,j){var hn=norm(h);Object.keys(ALIAS).forEach(function(k){if(m[k]==null&&ALIAS[k].some(function(a){return hn===norm(a)}))m[k]=j,hit++})});if(hit>=2&&(m.name!=null||m.sub!=null||m.code!=null)){hi=i;map=m}}
   if(hi<0)return;var sheetCat=findCat(sn);
   aoa.slice(hi+1).forEach(function(row){var v=function(k){return map[k]==null?'':String(row[map[k]]==null?'':row[map[k]]).trim()};if(!v('name')&&!v('sub')&&!v('code')){return}
    var cat=findCat(v('catName'))||catFromSub(v('sub'))||catFromSub(v('name'))||sheetCat||(S.cat!=='all'?S.cat:cfg.cats[0].k);
    var o={cat:cat,code:v('code').toUpperCase(),sub:v('sub'),name:v('name'),brand:v('brand'),model:v('model'),spec:v('spec'),loc:v('loc'),qty:v('qty')===''?1:(parseFloat(v('qty'))||0),unit:v('unit'),status:stFrom(v('status')),owner:v('owner'),buyDate:v('buyDate').slice(0,10),price:v('price'),note:v('note')};
    var ex=o.code?byCode(o.code):null;
    if(!ex)ex=live().filter(function(r){return r.cat===o.cat&&norm(r.name||r.sub)===norm(o.name||o.sub)&&norm(r.loc)===norm(o.loc)&&norm(r.model)===norm(o.model)})[0];
    if(ex){var ch=false;Object.keys(o).forEach(function(k){if(k==='code'&&!o.code)return;if(o[k]!==''&&String(ex[k]==null?'':ex[k])!==String(o[k])){ex[k]=o[k];ch=true}});if(ch){ex.updatedAt=now();upd++}else skip++;return}
    if(!o.code)o.code=genCode(o.cat);o.id=uid();o.createdAt=o.updatedAt=now();S.rows.push(wrap(o));add++});
  });
  save();render();alert(''+T('匯入完成：新增')+' '+add+' '+T('筆、更新')+' '+upd+' '+T('筆、重複略過')+' '+skip+' '+T('筆')+'');}).catch(function(e){alert(''+T('匯入失敗：')+''+(e&&e.message||e))})}
 /* ---------- shell ---------- */
 el.classList.add('gr');
 var introTxt=function(){var l=LANG();return (l==='en'&&cfg.intro_en)||(l==='km'&&cfg.intro_km)||cfg.intro};
 function shell(){
 el.innerHTML=(cfg.intro?'<div style="font-size:12.5px;color:#475569;margin-bottom:10px;line-height:1.6">'+introTxt()+'</div>':'')+'<div class="gr-k"></div><div class="gr-bar"><input placeholder="🔍 '+T('搜尋')+' '+T('編號／名稱／地點／型號')+'"><button class="gr-b p" data-t="add">➕ '+T('新增')+'</button><button class="gr-b" data-t="imp">📥 '+T('匯入')+'</button><button class="gr-b" data-t="exp">📤 '+T('匯出')+'</button><button class="gr-b" data-t="lbl">🏷 '+T('印')+' QR</button><button class="gr-b" data-t="sync">🔄 '+T('同步')+'</button><input type="file" accept=".xlsx,.xls,.csv" hidden></div><div class="gr-st">'+T('本機資料讀取中')+'…</div><div class="gr-ch"></div><div class="gr-lw"></div>';
 el.querySelector('.gr-bar input:not([type=file])').addEventListener('input',function(e){S.q=e.target.value;el.querySelector('.gr-lw').innerHTML=listHtml(filtered(S.cat,S.q))});
 var fi=el.querySelector('input[type=file]');S.fi=fi;fi.addEventListener('change',function(){if(fi.files[0])importX(fi.files[0]);fi.value=''});
 }
 shell();
 el.addEventListener('click',function(e){var t=e.target.closest('[data-t]');if(t){var k=t.dataset.t;if(k==='add')openForm();else if(k==='imp')S.fi.click();else if(k==='exp')exportX();else if(k==='lbl'){var rs=filtered(S.cat,S.q);if(!rs.length)return alert(''+T('沒有可印的項目')+'');if(rs.length>60&&!confirm(''+T('要印')+' '+rs.length+' '+T('張標籤？')+''))return;printLabels(rs)}else if(k==='sync')pull(false).then(function(){return push(false)});return}
  var kc=e.target.closest('[data-kc]');if(kc){openList(kc.dataset.kc);return}
  var ch=e.target.closest('[data-ch]');if(ch){S.cat=ch.dataset.ch;render();return}
  var r=e.target.closest('.gr-r');if(r&&!r.closest('.gr-ov'))openDetail(r.dataset.id)});
 var relang=function(){var st=el.querySelector('.gr-st'),t=st?st.textContent:'',c=st?st.className:'';shell();var n=el.querySelector('.gr-st');if(n){n.textContent=t;n.className=c}render()};
 if(g.GA&&GA.on)GA.on('lang',relang);
 var api={relang:relang,rows:function(){return live()},openDetail:openDetail,openList:openList,openCode:function(c){var r=byCode(c);if(r)openDetail(r.id);return !!r},ready:null};
 api.ready=idbGet(KEY).then(function(d){S.rows=(d&&d.rows)||[];
  if(!S.rows.length&&cfg.seed){S.dirty=true;cfg.seed.forEach(function(s){var o=Object.assign({status:'ok',qty:1,createdAt:'2026-11-26T00:00:00.000Z',updatedAt:'2026-11-26T00:00:00.000Z'},s);S.rows.push(wrap(o))})}
  render();setSt(''+T('本機')+' '+live().length+' '+T('筆')+'');return pull(true)}).then(function(){if(S.dirty)push(true);render();return api});
 g.addEventListener('online',function(){if(S.dirty)push(true)});
 return api;
}
g.GAReg={version:VER,mount:mount};
})(window);
