/* GA Usage v1.0 (2026-11-28) — 叉車／發電機每日使用 ＋ 保養維修 ＋ 柴油核對 ＋ 證件參考
 * Paul 2026-11-27：叉車 2 台每日使用（次數／時數／錶數、哪個部門）、發電機每天哪台開多久（跟維修放一起），
 *   依耗油率推算柴油公升與金額，連同司機用油一起跟總務每月登記（燃油中心）核對，找出異常；保安那邊另放訪客證等證件參考。
 * 可在任何 AC 平台頁面掛載：GAUsage.mount(el,{tabs:['pass','fk','gen','chk','set']})
 * 資料：本機 IndexedDB ga_usage_v1；雲端＝AC 共用後端（與工務設備登記簿同一個），tool ga_equipment_usage／sec_pass_reference。
 * 只「讀」燃油中心（ga-exp-mobility-v1）、保安派車（ac_sec_data_v1）的資料，不會改它們。刪除採 tombstone(_del)。 */
(function(g){
'use strict';
if(g.GAUsage)return;
var VER='1.0';
var CLOUD='https://script.google.com/macros/s/AKfycbyxBN_t2AfxTPQ3AYdt7Jxl3pNiJV17H1T0pub4SR8GBgDH47WnDn9JF556KSxUiIU-/exec';
var BASE=(function(){var s=document.currentScript||document.querySelector('script[src*="ga-usage.js"]');var u=s&&s.src||'';return u?u.replace(/[^\/]*$/,''):'shared/'})();
var SEED_AT='2026-01-01T00:00:00.000Z';

/* ───────── 小工具 ───────── */
function LANG(){try{if(g.GA&&GA.lang)return GA.lang;if(g.SEC&&SEC.lang)return SEC.lang();return localStorage.getItem('ac_lang')||'zh'}catch(e){return 'zh'}}
function t(zh,en,km){var l=LANG();return l==='en'?(en||zh):l==='km'?(km||en||zh):zh}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function now(){return new Date().toISOString()}
function uid(p){return (p||'r')+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function p2(n){return (n<10?'0':'')+n}
function ymd(d){d=d||new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function num(v){if(typeof v==='number')return isFinite(v)?v:0;var n=parseFloat(String(v==null?'':v).replace(/,/g,'').replace(/[^\d.+-]/g,''));return isFinite(n)?n:0}
function r1(n){return Math.round(n*10)/10}
function r2(n){return Math.round(n*100)/100}
function f1(n){return (n==null||!isFinite(n))?'—':r1(n).toLocaleString('en-US',{maximumFractionDigits:1})}
function f2(n){return (n==null||!isFinite(n))?'—':r2(n).toLocaleString('en-US',{maximumFractionDigits:2})}
function f0(n){return (n==null||!isFinite(n))?'—':Math.round(n).toLocaleString('en-US')}
function money(n){return (n==null||!isFinite(n))?'—':'$'+r2(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function hash(s){s=String(s);var a=2166136261;for(var i=0;i<s.length;i++){a^=s.charCodeAt(i);a=Math.imul(a,16777619)}return (a>>>0).toString(36)}
function monthAdd(m,d){var y=+m.slice(0,4),mo=+m.slice(5,7)-1+d;var x=new Date(y,mo,1);return x.getFullYear()+'-'+p2(x.getMonth()+1)}
function monthsBack(m,n){var a=[];for(var i=n-1;i>=0;i--)a.push(monthAdd(m,-i));return a}
/* 時數：數字＝小時；"H:MM" → 小時 */
function hoursOf(v){if(typeof v==='number')return isFinite(v)?v:0;var s=String(v==null?'':v).trim();var m=s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);if(m)return +m[1]+m[2]/60+(+(m[3]||0))/3600;return num(s)}
function hm(h){if(h==null||!isFinite(h)||h<=0)return '—';var mins=Math.round(h*60);return Math.floor(mins/60)+':'+p2(mins%60)}
function tMin(s){var m=String(s||'').match(/^(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):null}
function spanHours(a,b){var x=tMin(a),y=tMin(b);if(x==null||y==null)return 0;var d=y-x;if(d<0)d+=1440;return d/60}
function unitKey(c){return String(c==null?'':c).toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^0+(?=\d)/,'')}
function genKey(m){var s=String(m==null?'':m).trim();if(/[\/,&+、，]/.test(s))return '?';return unitKey(s)||'?'}
function monthEnd(m){var d=new Date(+m.slice(0,4),+m.slice(5,7),0);return m+'-'+p2(d.getDate())}
function dayAdd(d,n){var x=new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)+n);return ymd(x)}
function plateKey(p){var s=String(p||'').toUpperCase();var m=s.match(/(\d[A-Z]{1,3})[-\s]?(\d{4})/);return m?m[1]+'-'+m[2]:s.replace(/\s+/g,'')}
function lower(s){return String(s==null?'':s).trim().toLowerCase()}

/* ───────── 本機儲存（自己的 IndexedDB） ───────── */
var dbP=null;
function db(){if(dbP)return dbP;dbP=new Promise(function(res,rej){var q=indexedDB.open('ga_usage_v1',1);q.onupgradeneeded=function(){q.result.createObjectStore('kv')};q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}});return dbP}
function idbGet(k){return db().then(function(d){return new Promise(function(res){var r=d.transaction('kv').objectStore('kv').get(k);r.onsuccess=function(){res(r.result)};r.onerror=function(){res(null)}})}).catch(function(){return null})}
function idbSet(k,v){return db().then(function(d){return new Promise(function(res){var x=d.transaction('kv','readwrite');x.objectStore('kv').put(v,k);x.oncomplete=function(){res(true)};x.onerror=function(){res(false)}})}).catch(function(){return false})}
/* 只讀別的模組的資料庫；那個資料庫不存在時「絕不建立」（否則會擋住原模組自己建表） */
function readExt(name,store,key){return new Promise(function(res){try{var made=false,q=indexedDB.open(name);
 q.onupgradeneeded=function(e){made=true;try{e.target.transaction.abort()}catch(_){}};q.onerror=function(e){try{e.preventDefault()}catch(_){}res(null)};q.onblocked=function(){res(null)};
 q.onsuccess=function(){var d=q.result;if(made||!d.objectStoreNames.contains(store)){d.close();res(null);return}
  try{var r=d.transaction(store).objectStore(store).get(key);r.onsuccess=function(){var v=r.result;d.close();res(v)};r.onerror=function(){d.close();res(null)}}catch(e){d.close();res(null)}}}catch(e){res(null)}})}
function arr(v){if(v&&v.value!==undefined&&!Array.isArray(v))v=v.value;if(typeof v==='string'){try{v=JSON.parse(v)}catch(e){v=null}}if(v&&Array.isArray(v.rows))v=v.rows;if(v&&Array.isArray(v.records))v=v.records;return Array.isArray(v)?v.filter(function(r){return r&&!r._deleted&&!r._del}):[]}
function loadScript(src,test){return new Promise(function(res,rej){if(test())return res();var s=document.createElement('script');s.src=src;s.onload=function(){test()?res():rej(new Error('load '+src))};s.onerror=function(){rej(new Error('load '+src))};document.head.appendChild(s)})}
var syncLoad=null;function needSync(){if(g.GASmartSync)return Promise.resolve();return syncLoad||(syncLoad=loadScript(BASE+'ga-smart-sync.js?v=3.9.31',function(){return !!g.GASmartSync}))}
var xlLoad=null;function needXL(){if(g.XLSX)return Promise.resolve();return xlLoad||(xlLoad=loadScript(BASE+'xlsx.full.min.js',function(){return !!g.XLSX}))}
var pdfLoad=null;function needPDF(){if(g.pdfjsLib)return Promise.resolve();return pdfLoad||(pdfLoad=loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',function(){return !!g.pdfjsLib}).then(function(){g.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'}))}

/* ───────── 資料倉（本機＋雲端同步；跟工務設備登記簿同一套做法） ───────── */
function Store(tool,key,bucketOf){this.tool=tool;this.key=key;this.bucketOf=bucketOf;this.rows=[];this.busy=false;this.timer=0;this.onStatus=function(){};this.onChange=function(){};this.loaded=false;this.dirty=false}
Store.prototype.wrap=function(r){r._syncId=r.id;r._syncBucket=this.bucketOf(r);return r};
Store.prototype.live=function(tp){return this.rows.filter(function(r){return !r._del&&(!tp||r.t===tp)})};
Store.prototype.get=function(id){for(var i=0;i<this.rows.length;i++)if(this.rows[i].id===id)return this.rows[i];return null};
Store.prototype.load=function(){var me=this;return idbGet(me.key).then(function(v){me.rows=(v&&Array.isArray(v.rows))?v.rows:[];me.dirty=!!(v&&v.dirty);me.loaded=true;return me.rows})};
Store.prototype.persist=function(){return idbSet(this.key,{rows:this.rows,at:now(),dirty:this.dirty})};
Store.prototype.save=function(){var me=this;me.dirty=true;me.persist();clearTimeout(me.timer);me.timer=setTimeout(function(){me.push(true)},2500);me.onChange()};
Store.prototype.put=function(r,keepStamp){if(!r.id)r.id=uid();if(!r.createdAt)r.createdAt=now();if(!keepStamp)r.updatedAt=now();var o=this.get(r.id);if(o){var i=this.rows.indexOf(o);this.rows[i]=r}else this.rows.push(r);return r};
Store.prototype.remove=function(id){var o=this.get(id);if(!o)return;var keep={id:o.id,t:o.t,date:o.date,kind:o.kind,_del:true,updatedAt:now(),createdAt:o.createdAt};this.rows[this.rows.indexOf(o)]=keep};
Store.prototype.mergeIn=function(rs){var m={},me=this;me.rows.forEach(function(r){m[r.id]=r});(rs||[]).forEach(function(r){if(!r||!r.id)return;var o=m[r.id];if(!o||String(r.updatedAt||'')>String(o.updatedAt||''))m[r.id]=r});me.rows=Object.keys(m).map(function(k){return m[k]})};
Store.prototype.pull=function(silent){var me=this;if(!navigator.onLine){me.onStatus('📴 '+t('離線：資料先存在這台裝置','Offline: saved on this device','គ្មានអ៊ីនធឺណិត៖ រក្សាទុកក្នុងឧបករណ៍នេះ'),'');return Promise.resolve()}
 me.onStatus('⬇ '+t('讀取雲端…','Reading cloud…','កំពុងអានពពក…'),'');
 return needSync().then(function(){return g.GASmartSync.pull({url:CLOUD,tool:me.tool,localRecords:me.rows.slice(),allowDeletes:false,apply:function(rs){me.mergeIn(rs);me.persist();me.onChange()}})})
  .then(function(r){me.onStatus(r&&r.noCloud?'☁️ '+t('雲端尚無資料（新增後會自動上傳）','No cloud data yet (uploads automatically)','មិនទាន់មានទិន្នន័យលើពពក'):'☁️ '+t('已與雲端同步','Synced with cloud','បានធ្វើសមកាលកម្ម')+' · '+new Date().toLocaleTimeString(),'ok');return r})
  .catch(function(e){me.onStatus('⚠ '+t('雲端讀取失敗（先用本機資料）：','Cloud read failed (using local data): ','អានពពកបរាជ័យ៖ ')+(e&&e.message||e),'err');if(!silent)alert(t('下載失敗：','Download failed: ','ទាញយកបរាជ័យ៖ ')+(e&&e.message||e))})};
Store.prototype.push=function(silent){var me=this;if(me.busy)return Promise.resolve();if(!navigator.onLine){me.onStatus('📴 '+t('離線：上線後自動上傳','Offline: uploads when back online','គ្មានអ៊ីនធឺណិត'),'');return Promise.resolve()}
 me.busy=true;me.onStatus('⬆ '+t('上傳變更…','Uploading changes…','កំពុងផ្ទុកឡើង…'),'');
 var mk=function(){return{url:CLOUD,tool:me.tool,records:me.rows.map(function(r){return me.wrap(r)}),allowDeletes:false,autoMerge:true,summary:{records:me.live().length}}};
 return needSync().then(function(){return g.GASmartSync.push(mk())}).then(function(r){if(r&&r.needsPull)return me.pull(true).then(function(){return g.GASmartSync.push(mk())});return r})
  .then(function(){me.dirty=false;me.persist();me.onStatus('☁️ '+t('已上傳','Uploaded','បានផ្ទុកឡើង')+' · '+new Date().toLocaleTimeString(),'ok')})
  .catch(function(e){me.onStatus('⚠ '+t('上傳失敗（資料仍在本機，稍後自動重試）：','Upload failed (data kept on this device; will retry): ','ផ្ទុកឡើងបរាជ័យ៖ ')+(e&&e.message||e),'err');if(!silent)alert(t('上傳失敗：','Upload failed: ','ផ្ទុកឡើងបរាជ័យ៖ ')+(e&&e.message||e))})
  .then(function(){me.busy=false})};

var USE=new Store('ga_equipment_usage','use',function(r){if(r.t==='unit'||r.t==='cfg')return 'master';return r.t+':'+String(r.date||'').slice(0,7)});
var PASS=new Store('sec_pass_reference','pass',function(){return 'pass'});

/* ───────── 外部資料（只讀） ───────── */
var EXT={fuel:[],transport:[],secCar:[],secProfiles:[],at:0,has:{}};
function loadExt(){return Promise.all([readExt('ga-exp-mobility-v1','state','fuel'),readExt('ga-exp-mobility-v1','state','transport'),readExt('ac_sec_data_v1','records','ac_sec_car_db'),readExt('ac_sec_data_v1','records','ac_sec_commute_driver_profiles')]).then(function(v){
 EXT.fuel=arr(v[0]);EXT.transport=arr(v[1]);EXT.secCar=arr(v[2]);EXT.secProfiles=arr(v[3]);EXT.has={fuel:!!v[0],transport:!!v[1],secCar:!!v[2]};EXT.at=Date.now();return EXT})}

/* ───────── 機台主檔與設定 ───────── */
var KINDS={fk:{ic:'🚜',zh:'叉車',en:'Forklift',km:'ឡានស្ទូច',color:'#d97706',unit:'hr'},gen:{ic:'⚡',zh:'發電機',en:'Generator',km:'ម៉ាស៊ីនភ្លើង',color:'#7c3aed',unit:'hr'},car:{ic:'🚐',zh:'司機車輛',en:'Driver vehicles',km:'រថយន្តអ្នកបើកបរ',color:'#2563eb',unit:'km'}};
function kindName(k){var x=KINDS[k];return x?t(x.zh,x.en,x.km):k}
function units(kind,all){return USE.live('unit').filter(function(u){return (!kind||u.kind===kind)&&(all||u.status!=='scrap')}).sort(function(a,b){return String(a.code).localeCompare(String(b.code),undefined,{numeric:true})})}
function unitOf(kind,code){var k=kind==='car'?plateKey(code):unitKey(code),us=USE.live('unit');for(var i=0;i<us.length;i++)if(us[i].kind===kind&&(kind==='car'?plateKey(us[i].code):unitKey(us[i].code))===k)return us[i];return null}
function cfg(){var c=USE.get('cfg');if(!c||c._del){c={id:'cfg',t:'cfg',priceDefault:0.95,price:{},ledger:{},thrY:10,thrR:25,createdAt:SEED_AT,updatedAt:SEED_AT}}c.price=c.price||{};c.ledger=c.ledger||{};if(!(c.thrY>0))c.thrY=10;if(!(c.thrR>0))c.thrR=25;return c}
function priceOf(m){var c=cfg();var p=num(c.price[m]);return p>0?p:(num(c.priceDefault)||0)}
/* 依燃油中心近 12 個月實績算建議耗油率：叉車 L／錶(小時)、發電機 L／小時、車輛 km／L */
function suggestRate(kind,code,ref){var to=ref||ymd().slice(0,7),from=monthAdd(to,-11),L=0,U=0,n=0,k=kind==='car'?plateKey(code):unitKey(code);
 EXT.fuel.forEach(function(r){var m=String(r.date||'').slice(0,7);if(m<from||m>to)return;
  if(kind==='fk'&&r.cat==='forklift'&&unitKey(r.forklift)===k){var u=num(r.totalKM),l=num(r.liters);if(u>0&&l>0){L+=l;U+=u;n++}}
  if(kind==='gen'&&r.cat==='generator'&&genKey(r.machine)===k){var h=hoursOf(r.hours),l2=num(r.liters);if(h>0&&l2>0){L+=l2;U+=h;n++}}
  if(kind==='car'&&r.cat==='driver'&&plateKey(r.plate)===k){var km=num(r.km),l3=num(r.liters);if(km>0&&l3>0){L+=l3;U+=km;n++}}});
 if(n<2||L<=0||U<=0)return null;return {rate:kind==='car'?r2(U/L):r2(L/U),n:n,liters:L,use:U}}
/* 第一次使用：用燃油中心的歷史機號建立機台；沒有歷史就建預設 2 台叉車、3 台發電機。編號固定 → 兩台裝置各自建立也會合併成同一筆 */
function seedUnits(){var have={};USE.rows.forEach(function(r){if(r.t==='unit')have[r.id]=1});var add=[],since=monthAdd(ymd().slice(0,7),-23);
 function mk(kind,code,name,extra){var id='unit-'+kind+'-'+(kind==='car'?plateKey(code):unitKey(code));if(have[id])return;have[id]=1;var s=suggestRate(kind,code);var u={id:id,t:'unit',kind:kind,code:code,name:name||'',status:'active',rate:s?s.rate:'',rateSrc:s?'history':'',createdAt:SEED_AT,updatedAt:SEED_AT};if(extra)for(var k in extra)u[k]=extra[k];add.push(u)}
 var fk={},gen={},car={};
 EXT.fuel.forEach(function(r){var m=String(r.date||'').slice(0,7);if(m<since)return;
  if(r.cat==='forklift'&&unitKey(r.forklift))fk[unitKey(r.forklift)]=String(r.forklift).trim();
  if(r.cat==='generator'&&genKey(r.machine)!=='?')gen[genKey(r.machine)]=String(r.machine).trim();
  if(r.cat==='driver'&&m>=monthAdd(ymd().slice(0,7),-5)&&plateKey(r.plate)){var pk=plateKey(r.plate);if(!car[pk]||String(r.date)>car[pk].d)car[pk]={d:String(r.date),n:String(r.driver||'').trim()}}});
 if(!Object.keys(fk).length){fk={'1':'#1','2':'#2'}}
 if(!Object.keys(gen).length){gen={'1':'01','2':'02','5':'05'}}
 Object.keys(fk).sort().forEach(function(k){mk('fk',fk[k],'')});
 Object.keys(gen).sort().forEach(function(k){mk('gen',gen[k],'')});
 Object.keys(car).sort().forEach(function(k){mk('car',k,car[k].n)});
 if(!USE.get('cfg')){var c=cfg();add.push(c)}
 if(add.length){add.forEach(function(u){USE.put(u,true)});USE.dirty=true;USE.persist();return true}return false}

/* ───────── 使用量彙總與柴油核對 ───────── */
function fkUse(r){var a=num(r.m0),b=num(r.m1);if(r.m0!==''&&r.m1!==''&&r.m0!=null&&r.m1!=null&&b>a)return b-a;var h=num(r.hours);if(h>0)return h;return spanHours(r.start,r.end)}
function genUse(r){var h=num(r.hours);if(h>0)return h;var a=num(r.m0),b=num(r.m1);if(r.m0!==''&&r.m1!==''&&r.m0!=null&&r.m1!=null&&b>a)return b-a;return spanHours(r.start,r.end)}
/* 司機短名（總務：sok／tola…）在某月開哪台車：看那個月（含）以前最近一次加油的車牌 */
function driverPlates(){var by={};EXT.fuel.forEach(function(r){if(r.cat!=='driver'||!r.driver||!r.plate)return;var k=lower(r.driver);(by[k]||(by[k]=[])).push([String(r.date||''),plateKey(r.plate)])});Object.keys(by).forEach(function(k){by[k].sort(function(a,b){return a[0]<b[0]?-1:1})});return by}
function akaPlate(name){var k=lower(name);if(!k)return '';var us=USE.live('unit');for(var i=0;i<us.length;i++){if(us[i].kind!=='car')continue;var al=lower(us[i].aka).split(/[,，;；、\/]+/).map(function(x){return x.trim()}).filter(Boolean);for(var j=0;j<al.length;j++){if(al[j]===k||(al[j].length>=3&&k.indexOf(al[j])>=0)||(k.length>=3&&al[j].indexOf(k)>=0))return plateKey(us[i].code)}}return ''}
function plateFor(map,name,month){var ak=akaPlate(name);if(ak)return ak;var k=lower(name),a=map[k];if(!a){var keys=Object.keys(map);for(var i=0;i<keys.length;i++){var s=keys[i];if(s.length>=3&&(k.indexOf(s)>=0||(k.length>=3&&s.indexOf(k)>=0))){a=map[s];break}}}if(!a||!a.length)return '';var end=month+'-31',best=a[0][1];for(var j=0;j<a.length;j++){if(a[j][0]<=end)best=a[j][1];else break}return best}
function gather(months){var set={};months.forEach(function(m){set[m]=1});var G={};
 function cell(kind,key,m){var id=kind+'|'+key,o=G[id]||(G[id]={kind:kind,key:key,m:{}});return o.m[m]||(o.m[m]={log:0,logN:0,gaUse:0,gaL:0,gaN:0,src:''})}
 USE.live('fk').forEach(function(r){var m=String(r.date||'').slice(0,7);if(!set[m])return;var c=cell('fk',unitKey(r.unit),m);c.log+=fkUse(r);c.logN+=1;c.src='log'});
 USE.live('gen').forEach(function(r){var m=String(r.date||'').slice(0,7);if(!set[m])return;var c=cell('gen',unitKey(r.unit),m);c.log+=genUse(r);c.logN+=1;c.src='log'});
 var dmap=driverPlates(),prof={};EXT.secProfiles.forEach(function(p){if(p&&p.name&&p.plate)prof[lower(p.name)]=plateKey(p.plate)});
 EXT.fuel.forEach(function(r){var m=String(r.date||'').slice(0,7);if(!set[m])return;var c;
  if(r.cat==='forklift'){c=cell('fk',unitKey(r.forklift)||'?',m);c.gaL+=num(r.liters);c.gaUse+=num(r.totalKM);c.gaN++}
  else if(r.cat==='generator'){c=cell('gen',genKey(r.machine),m);c.gaL+=num(r.liters);c.gaUse+=hoursOf(r.hours);c.gaN++}
  else if(r.cat==='driver'){c=cell('car',plateKey(r.plate)||'?',m);c.gaL+=num(r.liters);c.gaUse+=num(r.km);c.gaN++;if(r.driver)c.who=String(r.driver).trim()}});
 /* 獨立里程：先用保安派車紀錄，沒有才用交通車日報 */
 var sec={},tr={};
 EXT.secCar.forEach(function(r){var m=String(r.date||'').slice(0,7);if(!set[m]||!(num(r.km)>0))return;var pk=r.plate?plateKey(r.plate):(prof[lower(r.driver)]||plateFor(dmap,r.driver,m));if(!pk)pk='?';var k=pk+'|'+m;sec[k]=(sec[k]||0)+num(r.km)});
 EXT.transport.forEach(function(r){var m=String(r.date||'').slice(0,7);if(!set[m]||!(num(r.km)>0))return;var pk=r.plate?plateKey(r.plate):plateFor(dmap,r.driver,m);if(!pk)pk='?';var k=pk+'|'+m;tr[k]=(tr[k]||0)+num(r.km)});
 Object.keys(tr).forEach(function(k){var p=k.split('|'),c=cell('car',p[0],p[1]);c.log=tr[k];c.src='tr'});
 Object.keys(sec).forEach(function(k){var p=k.split('|'),c=cell('car',p[0],p[1]);c.sec=sec[k]});
 return G}
/* 獨立紀錄有沒有涵蓋整個月：剛開始記的那個月（或交通車日報只匯到月中）不拿來判定，避免誤報 */
function logRange(kind){var mn='',mx='';function see(d){d=String(d||'');if(!/^\d{4}-\d{2}-\d{2}/.test(d))return;d=d.slice(0,10);if(!mn||d<mn)mn=d;if(d>mx)mx=d}
 if(kind==='car')EXT.transport.forEach(function(r){if(num(r.km)>0)see(r.date)});else USE.live(kind).forEach(function(r){see(r.date)});return {min:mn,max:mx}}
function covered(kind,m,rg){if(!rg.min||rg.min>m+'-03')return false;if(kind==='car'){var end=monthEnd(m),td=ymd(),need=end<td?end:td;return rg.max>=dayAdd(need,-3)}return true}
function lightOf(pct){var c=cfg(),a=Math.abs(pct);return a<=c.thrY?'g':a<=c.thrR?'y':'r'}
function expect(kind,use,rate){if(!(rate>0)||!(use>0))return null;return kind==='car'?use/rate:use*rate}
function buildCheck(month){var win=monthsBack(month,3),G=gather(win),rows=[],seen={},RG={fk:logRange('fk'),gen:logRange('gen'),car:logRange('car')};
 function make(kind,key){var id=kind+'|'+key;if(seen[id])return;seen[id]=1;var u=null,us=USE.live('unit');for(var i=0;i<us.length;i++){var k=us[i].kind==='car'?plateKey(us[i].code):unitKey(us[i].code);if(us[i].kind===kind&&k===key){u=us[i];break}}
  var o=G[id]||{m:{}},cur=o.m[month]||{log:0,logN:0,gaUse:0,gaL:0,gaN:0,src:''},rate=u?num(u.rate):0;
  if(!u&&!(cur.log>0||cur.gaL>0||cur.gaUse>0))return;
  if(u&&u.status==='scrap'&&!(cur.log>0||cur.gaL>0))return;
  var R={kind:kind,key:key,unit:u,code:u?u.code:(key==='?'?t('未分機','Unassigned','មិនបានកំណត់'):key),name:u?(u.name||''):(cur.who||''),rate:rate,log:cur.log,logN:cur.logN,src:cur.src,gaUse:cur.gaUse,gaL:cur.gaL,gaN:cur.gaN,notes:[]};
  if(kind==='car'&&!R.name){win.forEach(function(m){if(o.m[m]&&o.m[m].who)R.name=o.m[m].who})}
  R.logOK=R.log>0&&covered(kind,month,RG[kind]);R.sec=cur.sec||0;
  if(R.log>0&&!R.logOK)R.notes.push(kind==='car'?t('交通車日報只有 ','Shuttle daily log only covers ','')+RG.car.min.slice(5)+'～'+RG.car.max+t('，這個月不完整，先不拿來判定','; this month is incomplete so it is not used for the verdict',''):t('使用紀錄從 ','Usage log starts ','')+RG[kind].min+t(' 才開始，這個月不滿一個月，先不拿來判定',', so this month is incomplete and not used for the verdict',''));
  if(R.sec>0)R.notes.push(t('保安派車登記 ','Security dispatch log ','')+f0(R.sec)+' km');
  R.estLog=R.logOK?expect(kind,R.log,rate):null;R.estSelf=expect(kind,R.gaUse,rate);
  R.est=R.estLog!=null?R.estLog:R.estSelf;R.estFrom=R.estLog!=null?'log':(R.estSelf!=null?'self':'');
  R.selfRate=(R.gaL>0&&R.gaUse>0)?(kind==='car'?R.gaUse/R.gaL:R.gaL/R.gaUse):null;
  R.diff=(R.est!=null)?R.gaL-R.est:null;R.pct=(R.est>0)?(R.gaL-R.est)/R.est*100:null;
  /* 燈號看近 3 個月累計（加油日常常剛好跨月，單月會忽高忽低） */
  var e3=0,g3=0,n3=0,from=R.estFrom;
  win.forEach(function(m){var c=o.m[m];if(!c)return;if(from==='log'&&!covered(kind,m,RG[kind]))return;var use=from==='log'?c.log:c.gaUse,e=expect(kind,use,rate);if(e!=null){e3+=e;g3+=c.gaL;n3++}});
  R.est3=n3?e3:null;R.ga3=n3?g3:null;R.pct3=(n3&&e3>0)?(g3-e3)/e3*100:null;R.n3=n3;
  var basis=R.pct3!=null?R.pct3:R.pct;
  if(key==='?'){R.light=(R.gaL>0||R.log>0)?'y':'';if(R.gaL>0||R.log>0)R.notes.push(kind==='car'?t('對不到車牌（司機名字在「機台・耗油」的別名補上就會歸到那台車）','No matching plate (add the driver’s name as an alias under Units & rates)','រកមិនឃើញស្លាកលេខ'):t('加油登記的機號沒寫清楚（例如兩台寫在一起），無法分到哪一台','Unit number in the fuel record is unclear (e.g. two units in one line)','លេខគ្រឿងមិនច្បាស់'))}
  else if(!(rate>0)){R.light=(R.gaL>0||R.log>0)?'n':'';if(R.gaL>0||R.log>0)R.notes.push(t('還沒設定標準耗油率','No standard rate set','មិនទាន់កំណត់អត្រាស្តង់ដារ'))}
  else if(!(R.gaL>0||R.log>0||R.gaUse>0)){R.light=''}
  else if(basis!=null){R.light=lightOf(basis)}
  else if(R.gaL>0){R.light='y';R.notes.push(t('有加油登記，但沒有使用量（時數／里程）','Fuel issued but no usage (hours / km) recorded','មានចាក់ប្រេង តែគ្មានកំណត់ត្រាប្រើប្រាស់'))}
  else R.light='';
  if(R.logOK&&!(R.gaL>0)&&!(R.ga3>0)){R.light='y';R.notes.push(t('有使用紀錄，近 3 個月沒有加油登記','Usage logged but no fuel issue in the last 3 months','មានការប្រើ តែគ្មានចាក់ប្រេង ៣ ខែ'))}
  if(R.logOK&&R.gaUse>0){var d=(R.gaUse-R.log)/R.log*100;R.usePct=d;if(Math.abs(d)>cfg().thrR)R.notes.push(t('總務自報用量與使用紀錄差 ','GA-reported usage differs from the log by ','ការប្រើប្រាស់ខុសគ្នា ')+(d>0?'+':'')+Math.round(d)+'%')}
  rows.push(R)}
 ['fk','gen','car'].forEach(function(kind){units(kind,true).forEach(function(u){make(kind,kind==='car'?plateKey(u.code):unitKey(u.code))});Object.keys(G).forEach(function(id){if(G[id].kind===kind)make(kind,G[id].key)})});
 var price=priceOf(month),cats={},tot={est:0,gaL:0,estN:0};
 rows.forEach(function(R){var c=cats[R.kind]||(cats[R.kind]={kind:R.kind,rows:[],est:0,gaL:0,log:0,gaUse:0});c.rows.push(R);c.gaL+=R.gaL;c.log+=R.log;c.gaUse+=R.gaUse;if(R.est!=null){c.est+=R.est;tot.est+=R.est;tot.estN++}tot.gaL+=R.gaL});
 var led=cfg().ledger[month]||{};
 return {month:month,win:win,rows:rows,cats:cats,total:tot,price:price,estCost:tot.est*price,gaCost:tot.gaL*price,ledger:{usd:num(led.usd),liters:num(led.liters)},issues:rows.filter(function(R){return R.light==='r'||R.light==='y'||R.light==='n'}).sort(function(a,b){var w={r:0,y:1,n:2};return w[a.light]-w[b.light]})}}

/* ───────── 樣式 ───────── */
var CSS='.gu{font-size:14px;color:#1a2332}.gu *{box-sizing:border-box}'+
'.gu-nav{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px}.gu-nav button{flex:1;min-width:104px;border:1px solid #d0d5e8;background:#fff;border-radius:12px;padding:9px 8px;font:inherit;font-weight:800;font-size:13px;color:#334155;cursor:pointer;white-space:nowrap}.gu-nav button.on{background:#0f2b46;border-color:#0f2b46;color:#fff}'+
'.gu-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}'+
'.gu-b{border:1px solid #d0d5e8;background:#fff;border-radius:10px;padding:7px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:#334155;white-space:nowrap}.gu-b.p{background:#0d9488;border-color:#0d9488;color:#fff}.gu-b.r{color:#b91c1c;border-color:#fecaca}.gu-b:active{transform:scale(.97)}'+
'.gu-mon{display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid #d0d5e8;border-radius:10px;padding:3px 4px}.gu-mon button{border:0;background:#f1f5f9;border-radius:7px;width:30px;height:28px;font-size:14px;cursor:pointer}.gu-mon input{border:0;font:inherit;font-weight:800;font-family:ui-monospace,monospace;width:158px;text-align:center;background:transparent}'+
'.gu-st{font-size:11.5px;color:#64748b;margin:0 0 10px}.gu-st.err{color:#b91c1c}.gu-st.ok{color:#047857}'+
'.gu-k{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}@media(min-width:720px){.gu-k{grid-template-columns:repeat(4,1fr)}}'+
'.gu-kc{background:#fff;border:1px solid #e2e6f0;border-left:4px solid var(--c,#0d9488);border-radius:12px;padding:10px 12px}.gu-kc b{display:block;font-size:21px;font-weight:800;font-family:ui-monospace,monospace;color:var(--c,#0d9488)}.gu-kc span{font-size:12px;color:#475569;font-weight:700}.gu-kc small{display:block;font-size:11px;color:#94a3b8;margin-top:2px}'+
'.gu-h{font-size:12px;font-weight:800;color:#5a6a7e;letter-spacing:.04em;margin:16px 0 8px;display:flex;align-items:center;gap:8px}.gu-h::before{content:"";width:3px;height:12px;background:#0d9488;border-radius:2px}.gu-h .sp{margin-left:auto;display:flex;gap:6px}'+
'.gu-l{background:#fff;border:1px solid #e2e6f0;border-radius:12px;overflow:hidden}'+
'.gu-r{display:grid;grid-template-columns:76px 1fr auto;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid #eef1f6;cursor:pointer}.gu-r:last-child{border-bottom:0}.gu-r:active{background:#f1f5f9}'+
'.gu-d{font-family:ui-monospace,monospace;font-weight:800;font-size:12px;color:#334155}.gu-d small{display:block;font-weight:600;color:#94a3b8;font-size:10.5px}'+
'.gu-n{font-weight:700;font-size:13.5px}.gu-s{font-size:11.5px;color:#64748b;margin-top:1px}.gu-q{font-family:ui-monospace,monospace;font-weight:800;text-align:right;white-space:nowrap}.gu-q small{display:block;font-size:10.5px;font-weight:700;color:#94a3b8}'+
'.gu-chip{display:inline-block;font-size:11px;font-weight:800;padding:1px 7px;border-radius:6px;background:var(--l,#ccfbf1);color:var(--c,#0f766e);font-family:ui-monospace,monospace}'+
'.gu-e{padding:22px;text-align:center;color:#94a3b8;background:#fff;border:1px dashed #cbd5e1;border-radius:12px;line-height:1.7}'+
'.gu-bars .br{display:grid;grid-template-columns:112px 1fr 64px;gap:8px;align-items:center;margin:6px 0;font-size:12.5px}.gu-bars .bt{height:14px;background:#e2e8f0;border-radius:7px;overflow:hidden}.gu-bars .bt i{display:block;height:100%;background:var(--c,#0d9488);border-radius:7px}.gu-bars .bv{font-family:ui-monospace,monospace;font-weight:800;text-align:right}'+
'.gu-card{background:#fff;border:1px solid #e2e6f0;border-radius:12px;padding:12px 14px;margin-bottom:10px}'+
'.gu-note{font-size:12px;color:#64748b;line-height:1.6}.gu-warn{background:#fff7ed;border:1px solid #fdba74;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.6;color:#7c2d12;margin-bottom:10px}'+
'.gu-tw{overflow-x:auto;background:#fff;border:1px solid #e2e6f0;border-radius:12px}.gu-t{width:100%;border-collapse:collapse;font-size:12.5px;min-width:720px}.gu-t th{background:#f1f5f9;color:#475569;font-size:11px;text-align:right;padding:7px 8px;white-space:nowrap;position:sticky;top:0}.gu-t th:first-child,.gu-t td:first-child{text-align:left}.gu-t td{padding:7px 8px;border-top:1px solid #eef1f6;text-align:right;font-family:ui-monospace,monospace;white-space:nowrap}.gu-t td:first-child{font-family:inherit;font-weight:700;white-space:normal}.gu-t tr.sub td{background:#f8fafc;font-weight:800}.gu-t tr.tot td{background:#0f2b46;color:#fff;font-weight:800}.gu-t td small{display:block;font-size:10.5px;color:#94a3b8;font-weight:600;font-family:inherit}.gu-t tr.tot td small{color:#cbd5e1}'+
'.gu-lt{display:inline-block;min-width:54px;text-align:center;font-size:11px;font-weight:800;border-radius:6px;padding:2px 6px;font-family:inherit}.lt-g{background:#dcfce7;color:#166534}.lt-y{background:#fef9c3;color:#854d0e}.lt-r{background:#fee2e2;color:#991b1b}.lt-n{background:#e2e8f0;color:#475569}'+
'.gu-is{display:grid;gap:8px}.gu-i{background:#fff;border:1px solid #e2e6f0;border-left:4px solid var(--c);border-radius:10px;padding:9px 12px;font-size:13px;line-height:1.55}.gu-i b{font-weight:800}'+
'.gu-tr{display:grid;grid-template-columns:repeat(12,1fr);gap:4px;align-items:end;height:120px;background:#fff;border:1px solid #e2e6f0;border-radius:12px;padding:10px 10px 22px;position:relative}.gu-tr .c{display:flex;gap:2px;align-items:flex-end;height:100%;position:relative;cursor:pointer}.gu-tr .c i{flex:1;border-radius:3px 3px 0 0;min-height:1px}.gu-tr .c span{position:absolute;bottom:-17px;left:0;right:0;text-align:center;font-size:9.5px;color:#64748b;font-family:ui-monospace,monospace}.gu-tr .c.on span{color:#0f2b46;font-weight:800}'+
'.gu-lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:#475569;margin-top:6px}.gu-lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}'+
'.gu-ov{position:fixed;inset:0;background:rgba(8,15,25,.55);z-index:2100;display:flex;align-items:flex-end;justify-content:center}@media(min-width:720px){.gu-ov{align-items:center}}'+
'.gu-sh{background:#f6f8fb;width:100%;max-width:760px;max-height:94vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden}@media(min-width:720px){.gu-sh{border-radius:18px}}.gu-sh.wide{max-width:1080px}'+
'.gu-hd{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid #e2e6f0}.gu-hd h3{flex:1;font-size:15px;margin:0}.gu-x{border:0;background:#f1f5f9;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer}'+
'.gu-bd{overflow:auto;padding:12px 14px 22px}.gu-ac{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}'+
'.gu-f label{display:block;font-size:11.5px;font-weight:700;color:#475569;margin:8px 0 3px}.gu-f input,.gu-f select,.gu-f textarea{width:100%;border:1px solid #d0d5e8;border-radius:9px;padding:8px 9px;font:inherit;background:#fff;min-height:38px}.gu-f .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gu-f .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.gu-hint{font-size:11.5px;color:#64748b;margin-top:3px;line-height:1.5}'+
'.gu-ph{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.gu-ph .pi{position:relative}.gu-ph img{width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #e2e6f0;cursor:zoom-in;background:#eef1f6}.gu-ph .pi button{position:absolute;top:-6px;right:-6px;border:0;background:#b91c1c;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer}'+
'.gu-g{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:720px){.gu-g{grid-template-columns:repeat(4,1fr)}}'+
'.gu-pc{background:#fff;border:1px solid #e2e6f0;border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column}.gu-pc:active{transform:scale(.98)}.gu-pc .im{aspect-ratio:4/3;background:#eef1f6;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;font-weight:700;border-bottom:1px dashed #cbd5e1;text-align:center;line-height:1.5}.gu-pc .im img{width:100%;height:100%;object-fit:cover}.gu-pc .tx{padding:9px 11px}.gu-pc .tx b{display:block;font-size:13.5px}.gu-pc .tx span{font-size:11.5px;color:#64748b;line-height:1.45;display:block;margin-top:2px}'+
'.gu-grid{width:100%;border-collapse:collapse;font-size:12.5px}.gu-grid th{font-size:11px;color:#475569;text-align:left;padding:4px 3px;white-space:nowrap}.gu-grid td{padding:2px}.gu-grid input,.gu-grid select{width:100%;min-width:62px;border:1px solid #d0d5e8;border-radius:7px;padding:6px 5px;font:inherit;font-size:12.5px;background:#fff}'+
'.gu-doc{max-height:42vh;overflow:auto;background:#0f172a;border-radius:10px;margin-bottom:10px;text-align:center}.gu-doc img,.gu-doc canvas{max-width:100%;display:block;margin:0 auto}'+
'.gu-dg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gu-dg div{background:#fff;border:1px solid #e2e6f0;border-radius:10px;padding:8px 10px;font-size:13px;word-break:break-word}.gu-dg b{display:block;font-size:11px;color:#64748b;margin-bottom:2px}.gu-dg .w{grid-column:1/-1}'+
'@media(max-width:560px){.gu-r{grid-template-columns:62px 1fr auto;padding:8px 10px}.gu-f .three{grid-template-columns:1fr 1fr}.gu-bars .br{grid-template-columns:86px 1fr 58px}}';

/* ───────── 共用畫面元件 ───────── */
function sheet(title,html,wide){var ov=document.createElement('div');ov.className='gu-ov gu';ov.innerHTML='<div class="gu-sh'+(wide?' wide':'')+'"><div class="gu-hd"><h3>'+title+'</h3><button class="gu-x" data-x>✕</button></div><div class="gu-bd">'+html+'</div></div>';
 ov.addEventListener('click',function(e){if(e.target===ov||e.target.closest('[data-x]'))ov.remove()});document.body.appendChild(ov);return ov}
function zoom(src){var d=document.createElement('div');d.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:12px';d.innerHTML='<img src="'+src+'" style="max-width:100%;max-height:100%;border-radius:10px">';d.onclick=function(){d.remove()};document.body.appendChild(d)}
function shrink(file,max,q){return new Promise(function(res,rej){var rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){var s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q||0.7))};im.onerror=rej;im.src=rd.result};rd.onerror=rej;rd.readAsDataURL(file)})}
function pickFiles(accept,multi,capture){return new Promise(function(res){var i=document.createElement('input');i.type='file';i.accept=accept;if(multi)i.multiple=true;if(capture)i.setAttribute('capture','environment');i.style.display='none';i.onchange=function(){res([].slice.call(i.files||[]));i.remove()};document.body.appendChild(i);i.click()})}
function toast(msg,kind){var d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:100000;background:'+(kind==='err'?'#991b1b':'#0f2b46')+';color:#fff;padding:10px 16px;border-radius:12px;font:700 13px system-ui,sans-serif;max-width:90vw;box-shadow:0 8px 24px rgba(0,0,0,.25)';document.body.appendChild(d);setTimeout(function(){d.remove()},3200)}
/* 表單：fields=[{k,label,type,opts,ph,hint,list}]；group 用 row:[...] 併排 */
function fieldHtml(f,v){var val=v[f.k]==null?'':v[f.k],a=' data-k="'+f.k+'"',h='<label>'+esc(f.label)+(f.req?' *':'')+'</label>';
 if(f.type==='select')h+='<select'+a+'>'+f.opts.map(function(o){var ov=Array.isArray(o)?o[0]:o,ol=Array.isArray(o)?o[1]:o;return '<option value="'+esc(ov)+'"'+(String(ov)===String(val)?' selected':'')+'>'+esc(ol)+'</option>'}).join('')+'</select>';
 else if(f.type==='textarea')h+='<textarea rows="2"'+a+'>'+esc(val)+'</textarea>';
 else h+='<input type="'+(f.type||'text')+'"'+(f.type==='number'?' step="any" inputmode="decimal"':'')+a+' value="'+esc(val)+'"'+(f.ph?' placeholder="'+esc(f.ph)+'"':'')+(f.list?' list="'+f.list+'"':'')+'>';
 if(f.hint)h+='<div class="gu-hint">'+f.hint+'</div>';return '<div>'+h+'</div>'}
function formHtml(fields,v){return '<div class="gu-f">'+fields.map(function(f){if(f.row)return '<div class="'+(f.row.length===3?'three':'two')+'">'+f.row.map(function(x){return fieldHtml(x,v)}).join('')+'</div>';if(f.html)return f.html;return fieldHtml(f,v)}).join('')+'</div>'}
function readForm(root,into){root.querySelectorAll('[data-k]').forEach(function(el){into[el.dataset.k]=el.type==='number'?(el.value===''?'':num(el.value)):el.value.trim()});return into}
function photosHtml(list,max){return '<div class="gu-ph" data-photos>'+(list||[]).map(function(p,i){return '<div class="pi"><img src="'+p+'" data-zoom><button data-rm="'+i+'" title="remove">✕</button></div>'}).join('')+'</div><div class="gu-ac" style="margin-top:6px">'+((list||[]).length<max?'<button class="gu-b" data-cam>📷 '+t('拍照','Take photo','ថតរូប')+'</button><button class="gu-b" data-alb>🖼 '+t('從相簿選','From album','ពីអាល់ប៊ុម')+'</button>':'')+'</div>'}
function bindPhotos(root,list,max,px,redraw){root.addEventListener('click',function(e){var z=e.target.closest('[data-zoom]');if(z){zoom(z.src);return}var rm=e.target.closest('[data-rm]');if(rm){list.splice(+rm.dataset.rm,1);redraw();return}
 var cam=e.target.closest('[data-cam]'),alb=e.target.closest('[data-alb]');if(cam||alb){pickFiles('image/*',!cam,!!cam).then(function(fs){return Promise.all(fs.slice(0,max-list.length).map(function(f){return shrink(f,px||640,0.7)}))}).then(function(imgs){imgs.forEach(function(x){list.push(x)});redraw()}).catch(function(){toast(t('照片讀取失敗','Could not read the photo','អានរូបថតបរាជ័យ'),'err')})}})}
function chip(code,kind){var k=KINDS[kind]||{};return '<span class="gu-chip" style="--c:'+(k.color||'#0f766e')+';--l:'+(kind==='fk'?'#fef3c7':kind==='gen'?'#ede9fe':'#dbeafe')+'">'+esc(code)+'</span>'}
function ltHtml(R){if(!R.light)return '';var tx={g:t('🟢 正常','🟢 OK','🟢 ធម្មតា'),y:t('🟡 留意','🟡 Check','🟡 ពិនិត្យ'),r:t('🔴 異常','🔴 Abnormal','🔴 ខុសប្រក្រតី'),n:t('⚪ 未設定','⚪ No rate','⚪ មិនទាន់កំណត់')}[R.light];return '<span class="gu-lt lt-'+R.light+'">'+tx+'</span>'}
function pctTxt(p){return p==null?'—':(p>0?'+':'')+Math.round(p)+'%'}
function wd(d){var x=new Date(d+'T00:00:00');if(isNaN(x))return '';return [t('日','Sun','អា'),t('一','Mon','ច'),t('二','Tue','អ'),t('三','Wed','ពុ'),t('四','Thu','ព្រ'),t('五','Fri','សុ'),t('六','Sat','ស')][x.getDay()]}

var DEPTS=['W/H','Cutting','Sewing','Packing','QC','Mechanic','GA','Service','Shipping'];
function deptList(){var m={};DEPTS.forEach(function(d){m[lower(d)]=d});USE.live('fk').forEach(function(r){if(r.dept&&!m[lower(r.dept)])m[lower(r.dept)]=r.dept});EXT.fuel.forEach(function(r){if(r.cat==='forklift'&&r.dept&&!m[lower(r.dept)]&&String(r.date||'')>='2025')m[lower(r.dept)]=String(r.dept).trim()});return Object.keys(m).map(function(k){return m[k]})}
var REASONS=[['cut','停電','Power cut','ដាច់ភ្លើង'],['test','測試運轉','Test run','សាកល្បង'],['maint','保養維修','Maintenance','ថែទាំ'],['other','其他','Other','ផ្សេងៗ']];
function reasonName(k){for(var i=0;i<REASONS.length;i++)if(REASONS[i][0]===k)return t(REASONS[i][1],REASONS[i][2],REASONS[i][3]);return k||''}
var MTYPES=[['service','定期保養','Routine service','ថែទាំប្រចាំ'],['oil','換機油／濾心','Oil / filter change','ប្តូរប្រេង / តម្រង'],['battery','電瓶','Battery','អាគុយ'],['repair','故障維修','Repair','ជួសជុល'],['part','換零件','Parts replaced','ប្តូរគ្រឿង'],['check','檢查','Inspection','ត្រួតពិនិត្យ'],['other','其他','Other','ផ្សេងៗ']];
function mtypeName(k){for(var i=0;i<MTYPES.length;i++)if(MTYPES[i][0]===k)return t(MTYPES[i][1],MTYPES[i][2],MTYPES[i][3]);return k||''}

/* ═════════ 掛載 ═════════ */
function mount(el,opt){opt=opt||{};
 if(!document.getElementById('gu-css')){var st=document.createElement('style');st.id='gu-css';st.textContent=CSS;document.head.appendChild(st)}
 var TABS=opt.tabs||['fk','gen','chk','set'];
 var S={tab:opt.tab&&TABS.indexOf(opt.tab)>=0?opt.tab:TABS[0],month:ymd().slice(0,7),ready:false};
 try{var sv=localStorage.getItem('gu_tab');if(!opt.tab&&sv&&TABS.indexOf(sv)>=0)S.tab=sv}catch(e){}
 var TAB_LBL={pass:function(){return '🪪 '+t('證件參考','Passes','ប័ណ្ណ')},fk:function(){return '🚜 '+t('叉車使用','Forklift use','ការប្រើឡានស្ទូច')},gen:function(){return '⚡ '+t('發電機運轉','Generator runs','ម៉ាស៊ីនភ្លើង')},chk:function(){return '⛽ '+t('柴油核對','Diesel check','ផ្ទៀងផ្ទាត់ប្រេង')},set:function(){return '⚙️ '+t('機台・耗油','Units & rates','គ្រឿង និងអត្រា')}};
 el.classList.add('gu');
 el.innerHTML='<div class="gu-nav"></div><div class="gu-st"></div><div class="gu-body"><div class="gu-e">'+t('載入中…','Loading…','កំពុងផ្ទុក…')+'</div></div>';
 var nav=el.querySelector('.gu-nav'),body=el.querySelector('.gu-body'),stEl=el.querySelector('.gu-st');
 function setSt(tx,k){stEl.textContent=tx;stEl.className='gu-st '+(k||'')}
 USE.onStatus=PASS.onStatus=setSt;
 function paintNav(){nav.innerHTML=TABS.map(function(k){return '<button data-tab="'+k+'" class="'+(S.tab===k?'on':'')+'">'+TAB_LBL[k]()+'</button>'}).join('');nav.style.display=TABS.length>1?'':'none'}
 nav.addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b)show(b.dataset.tab)});
 function show(k){if(TABS.indexOf(k)<0)return;S.tab=k;try{localStorage.setItem('gu_tab',k)}catch(e){}paintNav();render()}
 function monHtml(){return '<span class="gu-mon"><button data-mon="-1">◀</button><input type="month" value="'+S.month+'" data-monv><button data-mon="1">▶</button></span>'}
 body.addEventListener('click',function(e){var b=e.target.closest('[data-mon]');if(b){S.month=monthAdd(S.month,+b.dataset.mon);render();return}var a=e.target.closest('[data-act]');if(a){var fn=ACT[a.dataset.act];if(fn)fn(a)}});
 body.addEventListener('change',function(e){if(e.target.matches('[data-monv]')&&/^\d{4}-\d{2}$/.test(e.target.value)){S.month=e.target.value;render()}});
 var ACT={};
 function render(){if(!S.ready)return;({pass:renderPass,fk:function(){renderUse('fk')},gen:function(){renderUse('gen')},chk:renderCheck,set:renderSet})[S.tab]()}
 USE.onChange=PASS.onChange=function(){render()};

 /* ───── 使用紀錄（叉車／發電機） ───── */
 function useRows(kind){return USE.live(kind).filter(function(r){return String(r.date||'').slice(0,7)===S.month}).sort(function(a,b){return (b.date+(b.start||''))<(a.date+(a.start||''))?-1:1})}
 function useOf(kind,r){return kind==='fk'?fkUse(r):genUse(r)}
 function rowHtml(kind,r){var u=useOf(kind,r),sub=[];
  if(kind==='fk'){if(r.dept)sub.push('🏢 '+esc(r.dept));if(r.start||r.end)sub.push('🕐 '+esc(r.start||'?')+'→'+esc(r.end||'?'));if(r.m0!==''&&r.m0!=null&&r.m1!==''&&r.m1!=null)sub.push('⏲ '+f1(num(r.m0))+'→'+f1(num(r.m1)));if(r.operator)sub.push('👤 '+esc(r.operator));if(r.purpose)sub.push('📝 '+esc(r.purpose))}
  else{if(r.start||r.end)sub.push('🕐 '+esc(r.start||'?')+'→'+esc(r.end||'?'));if(r.reason)sub.push(esc(reasonName(r.reason)));if(num(r.kw)>0)sub.push(f0(num(r.kw))+' kW');if(r.note)sub.push('📝 '+esc(r.note))}
  var un=unitOf(kind,r.unit),rate=un?num(un.rate):0;
  return '<div class="gu-r" data-act="edit" data-id="'+esc(r.id)+'"><div class="gu-d">'+esc(String(r.date||'').slice(5))+'<small>'+wd(r.date)+'</small></div><div style="min-width:0"><div class="gu-n">'+chip(r.unit||'?',kind)+' '+(kind==='fk'?esc(r.dept||''):esc(reasonName(r.reason)))+(r.docId||(r.photos&&r.photos.length)?' 📎':'')+'</div><div class="gu-s">'+sub.join(' · ')+'</div></div><div class="gu-q">'+(u>0?hm(u):'—')+'<small>'+(kind==='fk'&&num(r.trips)>0?num(r.trips)+' '+t('次','trips','ដង'):'')+(rate>0&&u>0?(kind==='fk'&&num(r.trips)>0?' · ':'')+'≈'+f1(u*rate)+' L':'')+'</small></div></div>'}
 function renderUse(kind){var rows=useRows(kind),us=units(kind),K=KINDS[kind],tot=0,days={},trips=0,byU={},byD={};
  rows.forEach(function(r){var u=useOf(kind,r);tot+=u;days[r.date]=1;trips+=kind==='fk'?(num(r.trips)||1):1;var k=unitKey(r.unit);(byU[k]||(byU[k]={h:0,n:0})).h+=u;byU[k].n++;if(kind==='fk'){var d=r.dept||t('（未填部門）','(no dept)','(គ្មានផ្នែក)');byD[d]=(byD[d]||0)+u}else{var rs=reasonName(r.reason)||t('（未填原因）','(no reason)','(គ្មានមូលហេតុ)');byD[rs]=(byD[rs]||0)+u}});
  var est=0,noRate=false;us.forEach(function(u){var b=byU[unitKey(u.code)];if(b&&b.h>0){if(num(u.rate)>0)est+=b.h*num(u.rate);else noRate=true}});
  var h='<div class="gu-bar">'+monHtml()+'<button class="gu-b p" data-act="add">➕ '+t('新增','Add','បន្ថែម')+'</button><button class="gu-b" data-act="imp">📥 '+t('匯入 Excel','Import Excel','នាំចូល Excel')+'</button><button class="gu-b" data-act="doc">📷 '+t('照片／PDF 輸入','From photo / PDF','ពីរូបថត / PDF')+'</button><button class="gu-b" data-act="tpl">📄 '+t('空白表','Blank form','ទម្រង់ទទេ')+'</button><button class="gu-b" data-act="exp">📤 '+t('匯出','Export','នាំចេញ')+'</button></div>';
  h+='<div class="gu-k"><div class="gu-kc" style="--c:'+K.color+'"><b>'+hm(tot)+'</b><span>'+K.ic+' '+t('本月使用時數','Hours this month','ម៉ោងខែនេះ')+'</span><small>'+f1(tot)+' hr</small></div>'+
   '<div class="gu-kc" style="--c:#0f766e"><b>'+(kind==='fk'?trips:rows.length)+'</b><span>'+(kind==='fk'?t('使用次數','Uses','ចំនួនប្រើ'):t('開機次數','Runs','ចំនួនបើក'))+'</span><small>'+Object.keys(days).length+' '+t('天有紀錄','days with records','ថ្ងៃមានកំណត់ត្រា')+'</small></div>'+
   '<div class="gu-kc" style="--c:#b45309"><b>'+(est>0?f0(est)+' L':'—')+'</b><span>⛽ '+t('推算柴油','Estimated diesel','ប្រេងប៉ាន់ស្មាន')+'</span><small>'+(noRate?t('有機台還沒設耗油率','Some units have no rate','មានគ្រឿងមិនទាន់កំណត់អត្រា'):est>0?money(est*priceOf(S.month))+' @ $'+f2(priceOf(S.month))+'/L':t('時數 × 耗油率','hours × rate','ម៉ោង × អត្រា'))+'</small></div>'+
   '<div class="gu-kc" style="--c:#475569"><b>'+us.length+'</b><span>'+t('使用中機台','Units in use','គ្រឿងកំពុងប្រើ')+'</span><small>'+us.map(function(u){return u.code}).join(' · ')+'</small></div></div>';
  if(Object.keys(byU).length){h+='<div class="gu-h">'+t('各機台','By unit','តាមគ្រឿង')+'</div><div class="gu-card gu-bars">'+barRows(Object.keys(byU).map(function(k){var u=unitOf(kind,k);return [(u?u.code:k)+(u&&u.name?' '+u.name:''),byU[k].h,byU[k].n+' '+t('筆','rec','កំណត់ត្រា')]}),K.color)+'</div>';
   h+='<div class="gu-h">'+(kind==='fk'?t('各部門使用時數','Hours by department','ម៉ោងតាមផ្នែក'):t('依原因','By reason','តាមមូលហេតុ'))+'</div><div class="gu-card gu-bars">'+barRows(Object.keys(byD).map(function(k){return [k,byD[k]]}),'#0d9488')+'</div>'}
  h+='<div class="gu-h">'+t('每日紀錄','Daily records','កំណត់ត្រាប្រចាំថ្ងៃ')+' · '+rows.length+'</div>';
  h+=rows.length?'<div class="gu-l">'+rows.map(function(r){return rowHtml(kind,r)}).join('')+'</div>':'<div class="gu-e">'+t('這個月還沒有紀錄。','No records for this month.','ខែនេះមិនទាន់មានកំណត់ត្រា។')+'<br>'+t('按「➕ 新增」一筆一筆記，或「📥 匯入 Excel」整月一次進來；紙本表單可用「📷 照片／PDF 輸入」看著圖打。','Tap “➕ Add”, or “📥 Import Excel” for a whole month; for paper forms use “📷 From photo / PDF” and type while looking at the picture.','ចុច “➕ បន្ថែម” ឬ “📥 នាំចូល Excel”។')+'</div>';
  if(kind==='gen')h+=maintHtml('gen');
  if(kind==='fk')h+=maintHtml('fk');
  body.innerHTML=h;
  ACT.add=function(){editUse(kind,null)};ACT.edit=function(a){editUse(kind,USE.get(a.dataset.id))};ACT.imp=function(){importExcel(kind)};ACT.tpl=function(){template(kind)};ACT.exp=function(){exportUse(kind)};ACT.doc=function(){docEntry(kind)};
  ACT.madd=function(){editMaint(kind,null)};ACT.medit=function(a){editMaint(kind,USE.get(a.dataset.id))}}
 function barRows(pairs,color){pairs.sort(function(a,b){return b[1]-a[1]});var mx=pairs.length?pairs[0][1]||1:1;return pairs.map(function(p){return '<div class="br"><span>'+esc(p[0])+'</span><span class="bt"><i style="width:'+Math.max(3,p[1]/mx*100)+'%;--c:'+color+'"></i></span><span class="bv">'+hm(p[1])+'</span></div>'}).join('')}
 function unitOpts(kind,cur){var o=units(kind).map(function(u){return [u.code,u.code+(u.name?' · '+u.name:'')]});if(cur&&!o.some(function(x){return unitKey(x[0])===unitKey(cur)}))o.unshift([cur,cur]);if(!o.length)o=[['','—']];return o}
 function editUse(kind,r){var isNew=!r;r=r?JSON.parse(JSON.stringify(r)):{t:kind,date:S.month===ymd().slice(0,7)?ymd():S.month+'-01',unit:(units(kind)[0]||{}).code||'',trips:kind==='fk'?1:'',reason:kind==='gen'?'cut':''};r.photos=r.photos||[];
  var F=kind==='fk'?[
    {row:[{k:'date',label:t('日期','Date','កាលបរិច្ឆេទ'),type:'date',req:1},{k:'unit',label:t('哪一台','Forklift','ឡានស្ទូច'),type:'select',opts:unitOpts('fk',r.unit)}]},
    {row:[{k:'dept',label:t('使用部門','Department','ផ្នែក'),list:'gu-depts',ph:'W/H',req:1},{k:'operator',label:t('操作人','Operator','អ្នកបើក')}]},
    {row:[{k:'start',label:t('開始','Start','ចាប់ផ្តើម'),type:'time'},{k:'end',label:t('結束','End','បញ្ចប់'),type:'time'},{k:'hours',label:t('時數（小時）','Hours','ម៉ោង'),type:'number',ph:t('自動','auto','ស្វ័យប្រវត្តិ')}]},
    {row:[{k:'m0',label:t('錶數 起','Meter start','ម៉ែត្រចាប់ផ្តើម'),type:'number'},{k:'m1',label:t('錶數 迄','Meter end','ម៉ែត្របញ្ចប់'),type:'number'},{k:'trips',label:t('次數','Trips','ចំនួនដង'),type:'number'}]},
    {k:'purpose',label:t('用途','Purpose','គោលបំណង'),ph:t('例：卸布、搬成品','e.g. unload fabric','ឧ. ដឹកក្រណាត់')},{k:'note',label:t('備註','Note','កំណត់ចំណាំ')}]
   :[
    {row:[{k:'date',label:t('日期','Date','កាលបរិច្ឆេទ'),type:'date',req:1},{k:'unit',label:t('哪一台','Generator','ម៉ាស៊ីន'),type:'select',opts:unitOpts('gen',r.unit)}]},
    {row:[{k:'start',label:t('開機','Start','បើក'),type:'time'},{k:'end',label:t('關機','Stop','បិទ'),type:'time'},{k:'hours',label:t('時數（小時）','Hours','ម៉ោង'),type:'number',ph:t('自動','auto','ស្វ័យប្រវត្តិ')}]},
    {row:[{k:'reason',label:t('原因','Reason','មូលហេតុ'),type:'select',opts:REASONS.map(function(x){return [x[0],t(x[1],x[2],x[3])]})},{k:'kw',label:t('負載 kW','Load kW','បន្ទុក kW'),type:'number'}]},
    {row:[{k:'m0',label:t('小時錶 起','Hour meter start','ម៉ែត្រចាប់ផ្តើម'),type:'number'},{k:'m1',label:t('小時錶 迄','Hour meter end','ម៉ែត្របញ្ចប់'),type:'number'}]},
    {k:'note',label:t('備註','Note','កំណត់ចំណាំ')}];
  var ov=sheet((isNew?'➕ ':'✏️ ')+KINDS[kind].ic+' '+(kind==='fk'?t('叉車使用','Forklift use','ការប្រើឡានស្ទូច'):t('發電機運轉','Generator run','ម៉ាស៊ីនភ្លើងដំណើរការ')),
   '<datalist id="gu-depts">'+deptList().map(function(d){return '<option value="'+esc(d)+'">'}).join('')+'</datalist>'+formHtml(F,r)+'<div class="gu-hint">'+t('時數留空會用「結束−開始」算；有填錶數起迄就以錶數為準。','Leave Hours empty to use End − Start; when both meter readings are filled the meter difference is used.','ទុកម៉ោងទទេ នោះគណនាពី បញ្ចប់ − ចាប់ផ្តើម។')+'</div><div class="gu-f"><label>📷 '+t('照片（錶數、表單，最多 2 張）','Photos (meter / form, max 2)','រូបថត (អតិបរមា ២)')+'</label><div data-pw></div></div>'+(r.docId?'<div class="gu-ac"><button class="gu-b" data-doc>📎 '+t('看原始表單','View source form','មើលទម្រង់ដើម')+'</button></div>':'')+
   '<div class="gu-ac"><button class="gu-b p" data-save>💾 '+t('儲存','Save','រក្សាទុក')+'</button>'+(isNew?'<button class="gu-b" data-save2>💾➕ '+t('儲存並再記一筆','Save & add another','រក្សាទុក ហើយបន្ថែមទៀត')+'</button>':'<button class="gu-b r" data-del>🗑 '+t('刪除','Delete','លុប')+'</button>')+'</div>');
  var pw=ov.querySelector('[data-pw]');function drawP(){pw.innerHTML=photosHtml(r.photos,2)}drawP();bindPhotos(pw,r.photos,2,560,drawP);
  function doSave(again){readForm(ov,r);if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)){toast(t('請填日期','Please enter the date','សូមបញ្ចូលកាលបរិច្ឆេទ'),'err');return}
   if(kind==='fk'&&!r.dept){toast(t('請填使用部門','Please enter the department','សូមបញ្ចូលផ្នែក'),'err');return}
   if(!(useOf(kind,r)>0)&&!(kind==='fk'&&num(r.trips)>0)){toast(t('請填開始／結束時間、時數或錶數','Enter start/end time, hours or meter readings','សូមបញ្ចូលម៉ោង ឬម៉ែត្រ'),'err');return}
   if(!r.src)r.src='manual';USE.put(r);S.month=r.date.slice(0,7);USE.save();ov.remove();toast('✅ '+t('已儲存','Saved','បានរក្សាទុក'));if(again)editUse(kind,null)}
  ov.addEventListener('click',function(e){if(e.target.closest('[data-save]'))doSave(false);else if(e.target.closest('[data-save2]'))doSave(true);else if(e.target.closest('[data-del]')){if(confirm(t('刪除這筆紀錄？','Delete this record?','លុបកំណត់ត្រានេះ?'))){USE.remove(r.id);USE.save();ov.remove()}}else if(e.target.closest('[data-doc]')){var d=USE.get(r.docId);if(d&&d.photos&&d.photos[0])zoom(d.photos[0]);else toast(t('這台裝置沒有那張原始表單（下載雲端後再看）','Source form is not on this device yet','មិនមានទម្រង់ដើម'),'err')}})}

 /* ───── 保養維修（跟運轉紀錄放一起） ───── */
 function maintHtml(kind){var rows=USE.live('mt').filter(function(r){return r.kind===kind}).sort(function(a,b){return String(b.date)<String(a.date)?-1:1}),yr=S.month.slice(0,4),cost=0;rows.forEach(function(r){if(String(r.date||'').slice(0,4)===yr)cost+=num(r.cost)});
  var h='<div class="gu-h">🔧 '+t('保養維修紀錄','Maintenance log','កំណត់ត្រាថែទាំ')+' · '+rows.length+(cost>0?' · '+yr+' '+money(cost):'')+'<span class="sp"><button class="gu-b" data-act="madd">➕ '+t('新增保養／維修','Add','បន្ថែម')+'</button></span></div>';
  if(!rows.length)return h+'<div class="gu-e">'+t('還沒有保養維修紀錄。換機油、濾心、電瓶、廠商來修都記在這裡，跟每天的運轉時數一起看。','No maintenance records yet. Log oil / filter / battery changes and repairs here, next to the daily running hours.','មិនទាន់មានកំណត់ត្រាថែទាំ។')+(kind==='gen'&&opt.facilityLink?'<br><a href="'+opt.facilityLink+'">'+t('歷年重大異常與處理 → ⚡ 發電機紀錄','Major faults by year → ⚡ Generator log','ប្រវត្តិបញ្ហាធំៗ → ⚡ កំណត់ត្រាម៉ាស៊ីនភ្លើង')+'</a>':'')+'</div>';
  return h+'<div class="gu-l">'+rows.slice(0,60).map(function(r){var due=r.nextDue?(r.nextDue<ymd()?'🔴 ':'📅 ')+t('下次 ','next ','បន្ទាប់ ')+r.nextDue:'';return '<div class="gu-r" data-act="medit" data-id="'+esc(r.id)+'"><div class="gu-d">'+esc(String(r.date||'').slice(2))+'</div><div style="min-width:0"><div class="gu-n">'+chip(r.unit||'?',kind)+' '+esc(mtypeName(r.type))+(r.photos&&r.photos.length?' 📎':'')+'</div><div class="gu-s">'+esc([r.desc,r.vendor&&('🏪 '+r.vendor),r.meter!==''&&r.meter!=null&&('⏲ '+r.meter),due].filter(Boolean).join(' · '))+'</div></div><div class="gu-q">'+(num(r.cost)>0?money(num(r.cost)):'')+'</div></div>'}).join('')+'</div>'}
 function editMaint(kind,r){var isNew=!r;r=r?JSON.parse(JSON.stringify(r)):{t:'mt',kind:kind,date:ymd(),unit:(units(kind)[0]||{}).code||'',type:'service'};r.photos=r.photos||[];
  var F=[{row:[{k:'date',label:t('日期','Date','កាលបរិច្ឆេទ'),type:'date',req:1},{k:'unit',label:t('哪一台','Unit','គ្រឿង'),type:'select',opts:unitOpts(kind,r.unit)}]},
   {row:[{k:'type',label:t('類型','Type','ប្រភេទ'),type:'select',opts:MTYPES.map(function(x){return [x[0],t(x[1],x[2],x[3])]})},{k:'meter',label:t('當時小時錶','Hour meter','ម៉ែត្រម៉ោង'),type:'number'}]},
   {k:'desc',label:t('做了什麼／故障原因','What was done / fault','អ្វីដែលបានធ្វើ'),type:'textarea'},
   {row:[{k:'vendor',label:t('廠商／處理人','Vendor / by','អ្នកផ្គត់ផ្គង់'),ph:'致立機電'},{k:'cost',label:t('費用 USD','Cost USD','ថ្លៃ USD'),type:'number'}]},
   {k:'nextDue',label:t('下次保養日（可不填）','Next service date (optional)','ថ្ងៃថែទាំបន្ទាប់'),type:'date'}];
  var ov=sheet((isNew?'➕ ':'✏️ ')+'🔧 '+kindName(kind)+' '+t('保養維修','maintenance','ថែទាំ'),formHtml(F,r)+'<div class="gu-f"><label>📷 '+t('照片（最多 3 張）','Photos (max 3)','រូបថត (អតិបរមា ៣)')+'</label><div data-pw></div></div><div class="gu-ac"><button class="gu-b p" data-save>💾 '+t('儲存','Save','រក្សាទុក')+'</button>'+(isNew?'':'<button class="gu-b r" data-del>🗑 '+t('刪除','Delete','លុប')+'</button>')+'</div>');
  var pw=ov.querySelector('[data-pw]');function drawP(){pw.innerHTML=photosHtml(r.photos,3)}drawP();bindPhotos(pw,r.photos,3,640,drawP);
  ov.addEventListener('click',function(e){if(e.target.closest('[data-save]')){readForm(ov,r);if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)){toast(t('請填日期','Please enter the date','សូមបញ្ចូលកាលបរិច្ឆេទ'),'err');return}USE.put(r);USE.save();ov.remove();toast('✅ '+t('已儲存','Saved','បានរក្សាទុក'))}else if(e.target.closest('[data-del]')){if(confirm(t('刪除這筆紀錄？','Delete this record?','លុបកំណត់ត្រានេះ?'))){USE.remove(r.id);USE.save();ov.remove()}}})}

 /* ───── Excel 匯入／空白表／匯出 ───── */
 var COLS={fk:[['date','日期','Date','ថ្ងៃ'],['unit','叉車','Forklift No','ឡានស្ទូច'],['dept','部門','Dept','ផ្នែក'],['operator','操作人','Operator','អ្នកបើក'],['start','開始','Start','ចាប់ផ្តើម'],['end','結束','End','បញ្ចប់'],['hours','時數','Hours','ម៉ោង'],['m0','錶數起','Meter start','ម៉ែត្រចាប់ផ្តើម'],['m1','錶數迄','Meter end','ម៉ែត្របញ្ចប់'],['trips','次數','Trips','ដង'],['purpose','用途','Purpose','គោលបំណង'],['note','備註','Remark','កំណត់ចំណាំ']],
  gen:[['date','日期','Date','ថ្ងៃ'],['unit','發電機','Generator No','ម៉ាស៊ីនភ្លើង'],['start','開機','Start','បើក'],['end','關機','Stop','បិទ'],['hours','時數','Hours','ម៉ោង'],['kw','負載kW','Load kW','បន្ទុក kW'],['reason','原因','Reason','មូលហេតុ'],['m0','小時錶起','Hour meter start','ម៉ែត្រចាប់ផ្តើម'],['m1','小時錶迄','Hour meter end','ម៉ែត្របញ្ចប់'],['note','備註','Remark','កំណត់ចំណាំ']]};
 var ALIAS={date:['日期','date','ថ្ងៃ','កាលបរិច្ឆេទ','day'],liters:['公升','liter','litre','liters','litres','加油量','លីត្រ'],m0:['錶數起','錶起','meter start','start km','start meter','start hr','startkm','起始錶','ម៉ែត្រចាប់ផ្តើម'],m1:['錶數迄','錶迄','meter end','arrive km','end km','end meter','end hr','arrivekm','結束錶','ម៉ែត្របញ្ចប់'],hours:['時數','小時','hours','hour','duration','使用時間','運轉時間','ម៉ោង'],start:['開始','開機','start','time out','ចាប់ផ្តើម','បើក'],end:['結束','關機','stop','end','time in','finish','បញ្ចប់','បិទ'],unit:['叉車','堆高機','forklift','發電機','generator','machine','機台','機號','unit','ឡានស្ទូច','ម៉ាស៊ីន'],dept:['部門','dept','department','section','ផ្នែក'],operator:['操作','operator','driver','司機','使用人','user','អ្នកបើក'],trips:['次數','趟','trips','times','count','ដង'],purpose:['用途','purpose','工作內容','work','task','គោលបំណង'],kw:['kw','負載','load'],reason:['原因','reason','មូលហេតុ'],note:['備註','remark','remarks','note','說明','កំណត់ចំណាំ']};
 function aliasHit(s,a){if(/^[a-z]{1,5}$/.test(a))return s.split(' ').indexOf(a)>=0;return s===a||s.indexOf(a)>=0}
 function nrm(s){return String(s==null?'':s).toLowerCase().replace(/[\s_\-\/\\()（）:：.]+/g,' ').trim()}
 function cellsOf(ws){var X=g.XLSX,ref=ws['!ref'];if(!ref)return [];var R=X.utils.decode_range(ref),out=[];for(var r=R.s.r;r<=Math.min(R.e.r,R.s.r+3000);r++){var row=[];for(var c=R.s.c;c<=Math.min(R.e.c,R.s.c+40);c++){var x=ws[X.utils.encode_cell({r:r,c:c})];row.push(x?{v:x.v,w:x.w,d:x.t==='n'&&x.z&&X.SSF.is_date(x.z),t:x.t}:null)}out.push(row)}return out}
 function cDate(c){if(!c||c.v==null||c.v==='')return '';if(c.v instanceof Date)return ymd(c.v);if(typeof c.v==='number'&&c.v>20000&&c.v<80000){var d=g.XLSX.SSF.parse_date_code(Math.floor(c.v+1e-6));return d?d.y+'-'+p2(d.m)+'-'+p2(d.d):''}
  var s=String(c.v).trim(),m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);if(m)return m[1]+'-'+p2(+m[2])+'-'+p2(+m[3]);m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);if(m){var y=+m[3];if(y<100)y+=2000;return y+'-'+p2(+m[2])+'-'+p2(+m[1])}
  m=s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]*(\d{2,4})/);if(m){var mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}[m[2].toLowerCase()];var y2=+m[3];if(y2<100)y2+=2000;if(mo)return y2+'-'+p2(mo)+'-'+p2(+m[1])}return ''}
 function cTime(c){if(!c||c.v==null||c.v==='')return '';if(typeof c.v==='number'){var f=c.v;if(f>=1&&f<24&&!c.d){var mm=Math.round(f*60);return p2(Math.floor(mm/60)%24)+':'+p2(mm%60)}f=f-Math.floor(f);var mins=Math.round(f*1440);return p2(Math.floor(mins/60)%24)+':'+p2(mins%60)}
  var s=String(c.v).trim(),m=s.match(/^(\d{1,2})[:.hH](\d{2})\s*([AaPp][Mm])?/);if(m){var h=+m[1];if(m[3]){if(/p/i.test(m[3])&&h<12)h+=12;if(/a/i.test(m[3])&&h===12)h=0}return p2(h%24)+':'+m[2]}m=s.match(/^(\d{2})(\d{2})$/);if(m)return m[1]+':'+m[2];return ''}
 function cHours(c){if(!c||c.v==null||c.v==='')return '';if(typeof c.v==='number')return c.d?r2(c.v*24):r2(c.v);var s=String(c.v).trim();if(/^\d+:\d{2}/.test(s))return r2(hoursOf(s));var n=num(s);return n>0?r2(n):''}
 function cTxt(c){return c&&c.v!=null?String(c.w!=null&&c.t!=='s'?c.w:c.v).trim():''}
 function cNum(c){if(!c||c.v==null||c.v==='')return '';var n=num(c.v);return isFinite(n)?n:''}
 function reasonKey(s){s=lower(s);if(!s)return '';if(/停電|power|cut|ដាច់|outage|edc/.test(s))return 'cut';if(/測試|test|សាក/.test(s))return 'test';if(/保養|維修|maint|repair|service|ថែ/.test(s))return 'maint';return 'other'}
 function parseBook(wb,kindHint){var out=[],skip=0,log=[],dup={};wb.SheetNames.forEach(function(sn){var cs=cellsOf(wb.Sheets[sn]);if(!cs.length)return;var hi=-1,map={},best=0;
   for(var i=0;i<Math.min(cs.length,25);i++){var mp={},hit=0;cs[i].forEach(function(c,ci){var s=nrm(c&&c.v);if(!s||s.length>40)return;for(var k in ALIAS){if(mp[k]!=null)continue;if(ALIAS[k].some(function(a){return aliasHit(s,a)})){mp[k]=ci;hit++;break}}});if(mp.date!=null&&hit>best){best=hit;hi=i;map=mp}}
   if(hi<0||best<3){log.push(sn+': '+t('找不到表頭（需要「日期」和至少兩個其他欄位）','no header row found (needs Date + two more columns)','រកមិនឃើញក្បាលតារាង'));return}
   if(map.liters!=null){log.push(sn+': '+t('這是「加油登記」表（有公升欄）→ 請到燃油中心匯入；這裡只收使用紀錄','this is a fuel issue sheet (has a litres column) → import it in the Fuel Center; only usage logs go here','នេះជាតារាងចាក់ប្រេង → សូមនាំចូលនៅមជ្ឈមណ្ឌលប្រេង'));return}
   var head=nrm(cs[hi].map(function(c){return c&&c.v}).join(' ')+' '+sn),kind=/發電|generator|關機|開機|kw|ម៉ាស៊ីនភ្លើង/.test(head)?'gen':/叉車|堆高|forklift|部門|dept|ឡានស្ទូច/.test(head)?'fk':kindHint;
   var last='',n=0;for(var r=hi+1;r<cs.length;r++){var row=cs[r],d=cDate(row[map.date])||'';var any=row.some(function(c){return c&&c.v!=null&&String(c.v).trim()!==''});if(!any)continue;if(!d){if(last&&map.unit!=null&&cTxt(row[map.unit]))d=last;else{continue}}last=d;
    var o={t:kind,date:d,src:'excel',srcSheet:sn};['unit','dept','operator','purpose','note'].forEach(function(k){if(map[k]!=null)o[k]=cTxt(row[map[k]])});
    ['start','end'].forEach(function(k){if(map[k]!=null)o[k]=cTime(row[map[k]])});if(map.hours!=null)o.hours=cHours(row[map.hours]);['m0','m1','trips','kw'].forEach(function(k){if(map[k]!=null)o[k]=cNum(row[map[k]])});
    if(map.reason!=null){var rs=cTxt(row[map.reason]);o.reason=reasonKey(rs);if(o.reason==='other'&&rs)o.note=[o.note,rs].filter(Boolean).join(' · ')}
    if(kind==='gen'&&!o.reason)o.reason='cut';if(kind==='fk'&&!(num(o.trips)>0))o.trips=1;
    if(o.unit){var u=unitOf(kind,o.unit);if(u)o.unit=u.code;else if(/^\d+$/.test(unitKey(o.unit)))o.unit=kind==='fk'?'#'+unitKey(o.unit):p2(+unitKey(o.unit))}
    if(!o.unit||!((kind==='fk'?fkUse(o):genUse(o))>0||(kind==='fk'&&num(o.trips)>0&&(o.dept||o.purpose)))){skip++;continue}
    var base=[kind,o.date,unitKey(o.unit),o.start||'',lower(o.dept),o.m0===''||o.m0==null?'':o.m0,o.start?'':String(o.hours||''),lower(o.purpose)].join('|');dup[base]=(dup[base]||0)+1;o.id='x'+hash(base+'#'+dup[base]);out.push(o);n++}
   log.push(sn+': '+n+' '+t('筆','rows','ជួរ')+' ('+kindName(kind)+')')});return {rows:out,skip:skip,log:log}}
 function importExcel(kind){pickFiles('.xlsx,.xls,.xlsm,.csv',true).then(function(fs){if(!fs.length)return;return needXL().then(function(){return Promise.all(fs.map(function(f){return f.arrayBuffer().then(function(buf){var wb=g.XLSX.read(buf,{type:'array',cellDates:false});var p=parseBook(wb,kind);p.file=f.name;return p})}))}).then(function(ps){var add=0,upd=0,same=0,skip=0,log=[],months={};
   ps.forEach(function(p){skip+=p.skip;log.push('📄 '+p.file);p.log.forEach(function(x){log.push('　'+x)});p.rows.forEach(function(o){o.srcFile=p.file;var old=USE.get(o.id);months[o.date.slice(0,7)]=1;if(old&&!old._del){var chg=['unit','dept','operator','start','end','hours','m0','m1','trips','purpose','note','kw','reason'].some(function(k){return String(old[k]==null?'':old[k])!==String(o[k]==null?'':o[k])});if(!chg){same++;return}o.createdAt=old.createdAt;o.photos=old.photos;USE.put(o);upd++}else{USE.put(o);add++}})});
   if(add||upd){USE.save();var ms=Object.keys(months).sort();S.month=ms[ms.length-1]}
   sheet('📥 '+t('匯入結果','Import result','លទ្ធផលនាំចូល'),'<div class="gu-dg"><div><b>'+t('新增','Added','បន្ថែម')+'</b>'+add+'</div><div><b>'+t('更新','Updated','ធ្វើបច្ចុប្បន្នភាព')+'</b>'+upd+'</div><div><b>'+t('相同（不重複匯入）','Same (not duplicated)','ដូចគ្នា')+'</b>'+same+'</div><div><b>'+t('略過（缺機台或用量）','Skipped (no unit / usage)','រំលង')+'</b>'+skip+'</div><div class="w"><b>'+t('明細','Details','លម្អិត')+'</b>'+log.map(esc).join('<br>')+'</div></div><div class="gu-ac"><button class="gu-b p" data-x>OK</button></div>');render()})}).catch(function(e){alert(t('匯入失敗：','Import failed: ','នាំចូលបរាជ័យ៖ ')+(e&&e.message||e))})}
 function template(kind){needXL().then(function(){var X=g.XLSX,cols=COLS[kind],u=units(kind),head=cols.map(function(c){return c[1]+' '+c[2]}),ex=kind==='fk'?[[S.month+'-03',(u[0]||{code:'#1'}).code,'W/H','Sok','08:10','09:40','','','',1,'卸布 unload fabric',''],[S.month+'-03',(u[1]||u[0]||{code:'#2'}).code,'Cutting','Dara','13:00','13:45','','','',1,'',''],[S.month+'-04',(u[0]||{code:'#1'}).code,'W/H','Sok','','','',13364.7,13366.2,2,'搬成品 move FG','有錶數就填錶數 meter if available']]:[[S.month+'-03',(u[0]||{code:'05'}).code,'10:15','11:40','','110','停電 power cut','','',''],[S.month+'-10',(u[1]||u[0]||{code:'01'}).code,'','','0.3','30','測試 test','','','每週測試 weekly test']];
   var ws=X.utils.aoa_to_sheet([head].concat(ex));ws['!cols']=cols.map(function(c){return {wch:c[0]==='purpose'||c[0]==='note'?24:13}});var wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,kind==='fk'?'Forklift 叉車':'Generator 發電機');
   X.writeFile(wb,(kind==='fk'?'VRT_Forklift_Daily_Use_叉車每日使用':'VRT_Generator_Run_Log_發電機運轉')+'_'+S.month+'.xlsx')}).catch(function(e){alert(e&&e.message||e)})}
 function exportUse(kind){needXL().then(function(){var X=g.XLSX,cols=COLS[kind],rows=USE.live(kind).sort(function(a,b){return (a.date+(a.start||''))<(b.date+(b.start||''))?-1:1}),aoa=[cols.map(function(c){return c[1]+' '+c[2]}).concat([t('使用量 hr','Usage hr','ម៉ោងប្រើ'),t('推算 L','Est. L','ប៉ាន់ស្មាន L')])];
   rows.forEach(function(r){var u=useOf(kind,r),un=unitOf(kind,r.unit),rate=un?num(un.rate):0;aoa.push(cols.map(function(c){return c[0]==='reason'?reasonName(r.reason):(r[c[0]]==null?'':r[c[0]])}).concat([r2(u),rate>0?r2(u*rate):'']))});
   var wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(aoa),kind==='fk'?'Forklift':'Generator');
   var mt=USE.live('mt').filter(function(r){return r.kind===kind});if(mt.length)X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['日期 Date','機台 Unit','類型 Type','內容 Description','廠商 Vendor','費用 USD','小時錶 Meter','下次保養 Next due']].concat(mt.map(function(r){return [r.date,r.unit,mtypeName(r.type),r.desc||'',r.vendor||'',num(r.cost)||'',r.meter==null?'':r.meter,r.nextDue||'']}))),'Maintenance');
   X.writeFile(wb,(kind==='fk'?'Forklift_use_':'Generator_runs_')+ymd()+'.xlsx')}).catch(function(e){alert(e&&e.message||e)})}
 /* 照片／PDF：上面看原始表單，下面一列一列打（自動辨識等有實際表單樣本再做） */
 function docEntry(kind){pickFiles('image/*,application/pdf',false).then(function(fs){var f=fs[0];if(!f)return;var isPdf=/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name);
   var p=isPdf?needPDF().then(function(){return f.arrayBuffer()}).then(function(buf){return g.pdfjsLib.getDocument({data:buf}).promise}).then(function(pdf){return pdf.getPage(1)}).then(function(pg){var vp=pg.getViewport({scale:1}),sc=Math.min(2.2,1500/vp.width);vp=pg.getViewport({scale:sc});var c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;return pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise.then(function(){return c.toDataURL('image/jpeg',0.72)})}):shrink(f,1500,0.72);
   return p.then(function(img){var us=unitOpts(kind),N=8,day=S.month===ymd().slice(0,7)?ymd():S.month+'-01';
    var cols=kind==='fk'?[['date','date',t('日期','Date','ថ្ងៃ')],['unit','sel',t('叉車','Forklift','ឡាន')],['dept','text',t('部門','Dept','ផ្នែក')],['start','time',t('開始','Start','ចាប់')],['end','time',t('結束','End','បញ្ចប់')],['hours','number',t('時數','Hours','ម៉ោង')],['m0','number',t('錶起','Meter 1','ម៉ែត្រ១')],['m1','number',t('錶迄','Meter 2','ម៉ែត្រ២')],['trips','number',t('次數','Trips','ដង')],['purpose','text',t('用途','Purpose','គោលបំណង')]]
     :[['date','date',t('日期','Date','ថ្ងៃ')],['unit','sel',t('發電機','Generator','ម៉ាស៊ីន')],['start','time',t('開機','Start','បើក')],['end','time',t('關機','Stop','បិទ')],['hours','number',t('時數','Hours','ម៉ោង')],['kw','number','kW'],['reason','rsn',t('原因','Reason','មូលហេតុ')],['note','text',t('備註','Note','ចំណាំ')]];
    function rowH(i){return '<tr data-row="'+i+'">'+cols.map(function(c){if(c[1]==='sel')return '<td><select data-c="'+c[0]+'">'+us.map(function(o){return '<option value="'+esc(o[0])+'">'+esc(o[0])+'</option>'}).join('')+'</select></td>';if(c[1]==='rsn')return '<td><select data-c="reason">'+REASONS.map(function(x){return '<option value="'+x[0]+'">'+esc(t(x[1],x[2],x[3]))+'</option>'}).join('')+'</select></td>';return '<td><input data-c="'+c[0]+'" type="'+c[1]+'"'+(c[1]==='number'?' step="any" inputmode="decimal"':'')+(c[0]==='date'?' value="'+day+'"':'')+(c[0]==='dept'?' list="gu-depts"':'')+'></td>'}).join('')+'</tr>'}
    var ov=sheet('📷 '+t('看圖輸入','Type from the picture','វាយពីរូបភាព')+' · '+esc(f.name),'<datalist id="gu-depts">'+deptList().map(function(d){return '<option value="'+esc(d)+'">'}).join('')+'</datalist><div class="gu-doc"><img src="'+img+'" data-zoomdoc></div><div class="gu-note" style="margin-bottom:6px">'+t('上面是原始表單（點圖放大），下面一列一筆照著打；空白列不會存。原圖會跟著這些紀錄一起留存。','The source form is above (tap to enlarge); type one row per line below. Empty rows are ignored. The picture is kept with these records.','ទម្រង់ដើមនៅខាងលើ។ វាយមួយជួរមួយកំណត់ត្រា។')+'</div><div style="overflow-x:auto"><table class="gu-grid"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c[2])+'</th>'}).join('')+'</tr></thead><tbody>'+Array.apply(null,{length:N}).map(function(_,i){return rowH(i)}).join('')+'</tbody></table></div><div class="gu-ac"><button class="gu-b" data-more>➕ '+t('再加 5 列','5 more rows','បន្ថែម ៥ ជួរ')+'</button><button class="gu-b p" data-save>💾 '+t('全部儲存','Save all','រក្សាទុកទាំងអស់')+'</button></div>',true);
    var n=N;ov.addEventListener('click',function(e){if(e.target.closest('[data-zoomdoc]')){zoom(img);return}if(e.target.closest('[data-more]')){var tb=ov.querySelector('tbody'),lastD=(ov.querySelector('tbody tr:last-child [data-c="date"]')||{}).value||day;for(var i=0;i<5;i++){tb.insertAdjacentHTML('beforeend',rowH(n++));tb.lastElementChild.querySelector('[data-c="date"]').value=lastD}return}
     if(e.target.closest('[data-save]')){var docId=uid('d'),made=0;ov.querySelectorAll('tbody tr').forEach(function(tr){var o={t:kind,src:'photo',docId:docId};tr.querySelectorAll('[data-c]').forEach(function(x){o[x.dataset.c]=x.type==='number'?(x.value===''?'':num(x.value)):x.value.trim()});if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date))return;if(kind==='fk'&&!(num(o.trips)>0))o.trips=(fkUse(o)>0||o.dept)?1:'';if(!((kind==='fk'?fkUse(o):genUse(o))>0)&&!(kind==='fk'&&o.dept&&num(o.trips)>0))return;USE.put(o);made++});
      if(!made){toast(t('還沒有填任何一列（至少要日期＋時間／時數／錶數）','Nothing to save yet (need date + time / hours / meter)','មិនទាន់មានអ្វីត្រូវរក្សាទុក'),'err');return}
      USE.put({id:docId,t:'doc',kind:kind,date:(ov.querySelector('[data-c="date"]')||{}).value||day,name:f.name,photos:[img]});USE.save();ov.remove();toast('✅ '+t('已存 ','Saved ','បានរក្សាទុក ')+made+t(' 筆',' record(s)',''))}})})}).catch(function(e){alert(t('檔案讀取失敗：','Could not read the file: ','អានឯកសារបរាជ័យ៖ ')+(e&&e.message||e))})}

 /* ───── 柴油核對 ───── */
 function useLbl(R,v){if(!(v>0))return '—';return R.kind==='car'?f0(v)+' km':f1(v)+' hr'}
 function rateLbl(R){if(!(R.rate>0))return '—';return R.kind==='car'?f2(R.rate)+' km/L':f2(R.rate)+' L/hr'}
 function srcLbl(R){return {log:t('使用紀錄','usage log','កំណត់ត្រាប្រើ'),tr:t('交通車日報','shuttle daily log','របាយការណ៍ប្រចាំថ្ងៃ')}[R.src]||''}
 function issueText(R){var nm=KINDS[R.kind].ic+' '+esc(R.code)+(R.name?' '+esc(R.name):''),p=R.pct3!=null?R.pct3:R.pct,parts=[];
  if(p!=null&&R.rate>0){var who=R.estFrom==='log'?t('依'+srcLbl(R)+'推算','from the '+srcLbl(R),'តាម'+srcLbl(R)):t('依總務自報用量推算','from GA-reported usage','តាមការរាយការណ៍របស់ GA');
   var span=R.pct3!=null&&R.n3>1?t('近 '+R.n3+' 個月登記 ','Last '+R.n3+' months issued ','')+'':t('本月登記 ','This month issued ','ខែនេះ ');parts.push(span+f0(R.ga3!=null?R.ga3:R.gaL)+' L，'+who+' '+f0(R.est3!=null?R.est3:R.est)+' L → <b>'+pctTxt(p)+'</b>'+(p>0?t('（登記比推算多：多用油、漏記使用，或耗油變差）',' (issued more than expected: extra fuel, unlogged use, or worse consumption)',''):t('（登記比推算少：漏記加油，或用量記多了）',' (issued less than expected: missing fuel record, or usage over-recorded)','')))}
  R.notes.forEach(function(n){parts.push(esc(n))});return '<b>'+nm+'</b> — '+parts.join('；')}
 function renderCheck(){var C=buildCheck(S.month),c=cfg(),h='<div class="gu-bar">'+monHtml()+'<button class="gu-b" data-act="reload">🔄 '+t('重新讀取','Reload data','ផ្ទុកឡើងវិញ')+'</button><button class="gu-b" data-act="copy">📋 '+t('複製摘要','Copy summary','ចម្លងសង្ខេប')+'</button><button class="gu-b" data-act="xls">📤 '+t('匯出核對表','Export','នាំចេញ')+'</button></div>';
  if(!EXT.has.fuel)h+='<div class="gu-warn">⚠ '+t('這台裝置上沒有「燃油中心」的加油登記，所以只能看到使用紀錄的推算，沒辦法核對。請在這台裝置開一次 ','This device has no Fuel Center records, so only the usage-based estimate is shown and nothing can be compared. Open ','ឧបករណ៍នេះគ្មានទិន្នន័យមជ្ឈមណ្ឌលប្រេង។ សូមបើក ')+'<a href="https://saintdou-weng.github.io/ac-ga-exp/fuel.html">⛽ '+t('燃油中心','Fuel Center','មជ្ឈមណ្ឌលប្រេង')+'</a>'+t(' 並下載雲端，再回來按「🔄 重新讀取」。',' on this device, download from the cloud, then come back and press “🔄 Reload data”.','')+'</div>';
  var T=C.total,dT=T.estN?T.gaL-T.est:null,pT=T.est>0?(T.gaL-T.est)/T.est*100:null;
  h+='<div class="gu-k"><div class="gu-kc" style="--c:#0f766e"><b>'+f0(T.est)+' L</b><span>🧮 '+t('推算用油','Expected diesel','ប្រេងរំពឹងទុក')+'</span><small>'+money(C.estCost)+' @ $'+f2(C.price)+'/L</small></div>'+
   '<div class="gu-kc" style="--c:#2563eb"><b>'+f0(T.gaL)+' L</b><span>🧾 '+t('總務加油登記','GA fuel issued','ប្រេងដែល GA កត់ត្រា')+'</span><small>'+money(C.gaCost)+'</small></div>'+
   '<div class="gu-kc" style="--c:'+(pT==null?'#64748b':lightOf(pT)==='g'?'#16a34a':lightOf(pT)==='y'?'#ca8a04':'#dc2626')+'"><b>'+(dT==null?'—':(dT>0?'+':'')+f0(dT)+' L')+'</b><span>'+t('差異（登記 − 推算）','Difference (issued − expected)','ខុសគ្នា')+'</span><small>'+pctTxt(pT)+(dT!=null?' · '+(dT>0?'+':'')+money(dT*C.price).replace('$-','-$'):'')+'</small></div>'+
   '<div class="gu-kc" style="--c:'+(C.issues.filter(function(R){return R.light==='r'}).length?'#dc2626':C.issues.length?'#ca8a04':'#16a34a')+'"><b>'+C.issues.filter(function(R){return R.light==='r'}).length+' / '+C.issues.filter(function(R){return R.light==='y'}).length+'</b><span>🔴 '+t('異常','abnormal','ខុសប្រក្រតី')+' / 🟡 '+t('留意','check','ពិនិត្យ')+'</span><small>'+t('燈號看近 3 個月累計','lights use the last 3 months','ភ្លើងផ្អែកលើ ៣ ខែ')+'</small></div></div>';
  h+='<div class="gu-tw"><table class="gu-t"><thead><tr><th>'+t('機台／車輛','Unit / vehicle','គ្រឿង / រថយន្ត')+'</th><th>'+t('使用紀錄','Usage log','កំណត់ត្រាប្រើ')+'</th><th>'+t('總務自報用量','GA-reported use','GA រាយការណ៍')+'</th><th>'+t('標準耗油','Std rate','អត្រាស្តង់ដារ')+'</th><th>'+t('推算 L','Expected L','រំពឹង L')+'</th><th>'+t('登記 L','Issued L','ចេញ L')+'</th><th>'+t('本月差','Month diff','ខុសគ្នាខែនេះ')+'</th><th>'+t('近3月差','3-mo diff','ខុសគ្នា ៣ ខែ')+'</th><th>'+t('判定','Verdict','វិនិច្ឆ័យ')+'</th></tr></thead><tbody>';
  ['fk','gen','car'].forEach(function(kind){var cat=C.cats[kind];if(!cat)return;var K=KINDS[kind];
   cat.rows.forEach(function(R){h+='<tr><td>'+K.ic+' '+esc(R.code)+(R.name?' <span style="font-weight:600;color:#64748b">'+esc(R.name)+'</span>':'')+(R.notes.length?'<small>'+R.notes.map(esc).join('；')+'</small>':'')+'</td><td>'+useLbl(R,R.log)+(R.log>0?'<small>'+esc(srcLbl(R))+(R.logN?' · '+R.logN+t(' 筆',' rec',''):'')+'</small>':'')+'</td><td>'+useLbl(R,R.gaUse)+(R.selfRate?'<small>'+f2(R.selfRate)+(kind==='car'?' km/L':' L/hr')+'</small>':'')+'</td><td>'+rateLbl(R)+'</td><td>'+(R.est!=null?f1(R.est):'—')+(R.estFrom?'<small>'+(R.estFrom==='log'?'📝 '+t('獨立紀錄','independent','ឯករាជ្យ'):'🧾 '+t('自報','self-reported','រាយការណ៍ខ្លួនឯង'))+'</small>':'')+'</td><td>'+(R.gaL>0?f1(R.gaL):'—')+(R.gaN?'<small>'+R.gaN+t(' 次加油',' fills','')+'</small>':'')+'</td><td>'+(R.diff!=null?(R.diff>0?'+':'')+f1(R.diff)+'<small>'+pctTxt(R.pct)+'</small>':'—')+'</td><td>'+(R.pct3!=null?pctTxt(R.pct3)+'<small>'+f0(R.ga3)+' / '+f0(R.est3)+' L</small>':'—')+'</td><td>'+ltHtml(R)+'</td></tr>'});
   var p=cat.est>0?(cat.gaL-cat.est)/cat.est*100:null;h+='<tr class="sub"><td>'+K.ic+' '+kindName(kind)+' '+t('小計','subtotal','សរុបរង')+'</td><td>'+(cat.log>0?(kind==='car'?f0(cat.log)+' km':f1(cat.log)+' hr'):'—')+'</td><td>'+(cat.gaUse>0?(kind==='car'?f0(cat.gaUse)+' km':f1(cat.gaUse)+' hr'):'—')+'</td><td></td><td>'+f1(cat.est)+'</td><td>'+f1(cat.gaL)+'</td><td>'+(cat.est>0?(cat.gaL-cat.est>0?'+':'')+f1(cat.gaL-cat.est):'—')+'</td><td>'+pctTxt(p)+'</td><td></td></tr>'});
  h+='<tr class="tot"><td>'+t('合計','Total','សរុប')+' · '+S.month+'</td><td></td><td></td><td>$'+f2(C.price)+'/L</td><td>'+f1(T.est)+'<small>'+money(C.estCost)+'</small></td><td>'+f1(T.gaL)+'<small>'+money(C.gaCost)+'</small></td><td>'+(dT==null?'—':(dT>0?'+':'')+f1(dT))+'</td><td>'+pctTxt(pT)+'</td><td></td></tr></tbody></table></div>';
  h+='<div class="gu-note" style="margin-top:6px">'+t('推算 L：有獨立紀錄（保安／現場記的使用時數、派車里程）就用它 × 標準耗油；沒有時才用總務自己報的用量（🧾 自報）— 這時只能看出「耗油率」有沒有離譜，看不出用量有沒有多報。','Expected L uses the independent log (hours / km recorded on site) × standard rate when there is one; otherwise it falls back to the usage GA reported itself (🧾), which can only show an odd consumption rate, not over-reported usage.','')+'</div>';
  /* 帳上金額 */
  var led=C.ledger,ledDiffL=led.liters>0?led.liters-T.gaL:null,ledDiffU=led.usd>0?led.usd-C.gaCost:null;
  h+='<div class="gu-h">💵 '+t('單價與總務帳','Price & GA ledger','តម្លៃ និងបញ្ជី GA')+' · '+S.month+'</div><div class="gu-card gu-f"><div class="three"><div><label>'+t('本月柴油單價 USD／L','Diesel price this month USD/L','តម្លៃប្រេង USD/L')+'</label><input type="number" step="any" inputmode="decimal" data-cf="price" value="'+(num(c.price[S.month])>0?c.price[S.month]:'')+'" placeholder="'+f2(num(c.priceDefault))+' ('+t('預設','default','លំនាំដើម')+')"></div><div><label>'+t('總務帳上：柴油採購公升','GA ledger: litres bought','បញ្ជី GA៖ លីត្រទិញ')+'</label><input type="number" step="any" inputmode="decimal" data-cf="liters" value="'+(led.liters>0?led.liters:'')+'"></div><div><label>'+t('總務帳上：柴油金額 USD','GA ledger: diesel amount USD','បញ្ជី GA៖ ទឹកប្រាក់ USD')+'</label><input type="number" step="any" inputmode="decimal" data-cf="usd" value="'+(led.usd>0?led.usd:'')+'"></div></div>'+
   '<div class="gu-hint" style="margin-top:8px">'+(led.liters>0||led.usd>0?
     (led.liters>0?t('帳上採購 ','Ledger bought ','')+f0(led.liters)+' L vs '+t('加油登記 ','issued ','')+f0(T.gaL)+' L → <b>'+(ledDiffL>0?'+':'')+f0(ledDiffL)+' L</b>'+(Math.abs(ledDiffL)>Math.max(20,T.gaL*c.thrY/100)?' 🟡 '+t('差距大（油槽存量變化？漏登記？）','large gap (tank stock change? missing records?)',''):' 🟢')+'　':'')+
     (led.usd>0?t('帳上金額 ','Ledger amount ','')+money(led.usd)+' vs '+t('登記公升×單價 ','issued L × price ','')+money(C.gaCost)+' → <b>'+(ledDiffU>0?'+':'')+money(ledDiffU).replace('$-','-$')+'</b>'+(led.liters>0?'　('+t('帳上單價 ','ledger unit price ','')+'$'+f2(led.usd/led.liters)+'/L)':''):'')
     :t('系統裡沒有柴油「採購」的帳（費用中心只有零星出差加油），所以這兩格請照總務每月的帳填，填了就會跟加油登記比。','There is no diesel purchase ledger in the system (Expense Center only has a few business-trip refuels), so enter the two figures from GA’s monthly books to compare them with the fuel issue records.',''))+'</div></div>';
  if(C.issues.length){h+='<div class="gu-h">🔎 '+t('要查的項目','Items to check','ចំណុចត្រូវពិនិត្យ')+' · '+C.issues.length+'</div><div class="gu-is">'+C.issues.map(function(R){return '<div class="gu-i" style="--c:'+({r:'#dc2626',y:'#ca8a04',n:'#94a3b8'})[R.light]+'">'+({r:'🔴',y:'🟡',n:'⚪'})[R.light]+' '+issueText(R)+'</div>'}).join('')+'</div>'}
  else if(C.rows.length)h+='<div class="gu-h">🔎 '+t('要查的項目','Items to check','ចំណុចត្រូវពិនិត្យ')+'</div><div class="gu-e">🟢 '+t('這個月沒有超出範圍的項目。','Nothing outside the limits this month.','ខែនេះគ្មានអ្វីហួសកំណត់។')+'</div>';
  /* 近 12 個月 */
  var ms=monthsBack(S.month,12),tr=ms.map(function(m){var x=buildCheck(m);return {m:m,est:x.total.est,ga:x.total.gaL}}),mx=1;tr.forEach(function(x){mx=Math.max(mx,x.est,x.ga)});
  h+='<div class="gu-h">📈 '+t('近 12 個月：推算 vs 登記（公升）','Last 12 months: expected vs issued (L)','១២ ខែចុងក្រោយ')+'</div><div class="gu-tr">'+tr.map(function(x){return '<div class="c'+(x.m===S.month?' on':'')+'" data-act="gomon" data-m="'+x.m+'" title="'+x.m+' · '+f0(x.est)+' / '+f0(x.ga)+' L"><i style="height:'+(x.est/mx*100)+'%;background:#0d9488"></i><i style="height:'+(x.ga/mx*100)+'%;background:#2563eb"></i><span>'+x.m.slice(2).replace('-','/')+'</span></div>'}).join('')+'</div><div class="gu-lg"><span><i style="background:#0d9488"></i>'+t('推算','Expected','រំពឹង')+'</span><span><i style="background:#2563eb"></i>'+t('總務登記','GA issued','GA កត់ត្រា')+'</span><span>'+t('門檻：差 ','Limits: within ','')+c.thrY+'% 🟢 · '+c.thrR+'% 🟡 · '+t('以上 🔴（可在「機台・耗油」改）','above 🔴 (change under Units & rates)','')+'</span></div>';
  body.innerHTML=h;
  body.querySelectorAll('[data-cf]').forEach(function(inp){inp.addEventListener('change',function(){var c2=JSON.parse(JSON.stringify(cfg())),k=inp.dataset.cf,v=inp.value===''?'':num(inp.value);if(k==='price'){if(v==='')delete c2.price[S.month];else c2.price[S.month]=v}else{var l=c2.ledger[S.month]||{};l[k]=v;c2.ledger[S.month]=l}USE.put(c2);USE.save()})});
  ACT.reload=function(){setSt('🔄 '+t('重新讀取燃油中心／保安派車資料…','Reloading Fuel Center / dispatch data…',''),'');loadExt().then(function(){setSt('✅ '+t('已重新讀取','Reloaded','បានផ្ទុកឡើងវិញ')+' · '+new Date().toLocaleTimeString(),'ok');render()})};
  ACT.gomon=function(a){S.month=a.dataset.m;render()};
  ACT.copy=function(){var tx=summaryText(C);(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(tx):Promise.reject()).then(function(){toast('📋 '+t('已複製，可貼到 Telegram／email','Copied — paste into Telegram / email','បានចម្លង'))}).catch(function(){sheet('📋 '+t('摘要','Summary','សង្ខេប'),'<textarea style="width:100%;height:50vh;font:13px/1.5 ui-monospace,monospace;border:1px solid #d0d5e8;border-radius:10px;padding:10px">'+esc(tx)+'</textarea>')})};
  ACT.xls=function(){needXL().then(function(){var X=g.XLSX,aoa=[[t('柴油核對','Diesel check','')+' '+C.month,'','','','','','','',''],['類別 Category','機台 Unit','名稱 Name','使用紀錄 Usage log','來源 Source','總務自報用量 GA-reported use','標準耗油 Std rate','推算 L Expected','登記 L Issued','本月差 L','本月差 %','近3月差 %','判定 Verdict','備註 Notes']];
    C.rows.forEach(function(R){aoa.push([kindName(R.kind),R.code,R.name,r2(R.log)||'',srcLbl(R),r2(R.gaUse)||'',R.rate||'',R.est!=null?r2(R.est):'',r2(R.gaL)||'',R.diff!=null?r2(R.diff):'',R.pct!=null?Math.round(R.pct):'',R.pct3!=null?Math.round(R.pct3):'',{g:'OK',y:'CHECK',r:'ABNORMAL',n:'NO RATE'}[R.light]||'',R.notes.join('; ')])});
    aoa.push([]);aoa.push(['合計 Total','','','','','','$'+C.price+'/L',r2(T.est),r2(T.gaL),dT!=null?r2(dT):'',pT!=null?Math.round(pT):'']);aoa.push(['金額 Amount USD','','','','','','',r2(C.estCost),r2(C.gaCost)]);if(led.liters>0||led.usd>0)aoa.push(['總務帳 GA ledger','','','','','','','',led.liters||'','',led.usd||'']);
    var wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(aoa),C.month);X.writeFile(wb,'Diesel_check_'+C.month+'.xlsx')}).catch(function(e){alert(e&&e.message||e)})}}
 function summaryText(C){var T=C.total,L=[],dT=T.estN?T.gaL-T.est:null,pT=T.est>0?(T.gaL-T.est)/T.est*100:null;
  L.push('⛽ '+t('柴油核對','Diesel check','ផ្ទៀងផ្ទាត់ប្រេង')+' '+C.month);L.push('━━━━━━━━━━━━');
  L.push(t('推算用油 ','Expected ','រំពឹង ')+f0(T.est)+' L ('+money(C.estCost)+')');L.push(t('總務登記 ','GA issued ','GA កត់ត្រា ')+f0(T.gaL)+' L ('+money(C.gaCost)+')');
  if(dT!=null)L.push(t('差異 ','Difference ','ខុសគ្នា ')+(dT>0?'+':'')+f0(dT)+' L ('+pctTxt(pT)+') '+({g:'🟢',y:'🟡',r:'🔴'})[lightOf(pT||0)]);
  ['fk','gen','car'].forEach(function(k){var c=C.cats[k];if(!c)return;L.push('');L.push(KINDS[k].ic+' '+kindName(k)+'：'+t('推算 ','expected ','')+f0(c.est)+' L · '+t('登記 ','issued ','')+f0(c.gaL)+' L');c.rows.forEach(function(R){if(!(R.gaL>0||R.log>0))return;L.push('  '+({g:'🟢',y:'🟡',r:'🔴',n:'⚪'}[R.light]||'　')+' '+R.code+(R.name?' '+R.name:'')+'：'+(R.est!=null?f0(R.est):'—')+' / '+f0(R.gaL)+' L'+(R.pct3!=null?' ('+t('近3月 ','3-mo ','')+pctTxt(R.pct3)+')':''))})});
  if(C.issues.length){L.push('');L.push('🔎 '+t('要查','To check','ត្រូវពិនិត្យ')+'：');C.issues.forEach(function(R){L.push('- '+issueText(R).replace(/<[^>]+>/g,''))})}
  if(C.ledger.liters>0||C.ledger.usd>0){L.push('');L.push('💵 '+t('總務帳','GA ledger','បញ្ជី GA')+'：'+(C.ledger.liters>0?f0(C.ledger.liters)+' L ':'')+(C.ledger.usd>0?money(C.ledger.usd):''))}
  return L.join('\n')}

 /* ───── 機台・耗油設定 ───── */
 var STN=[['active','✅ 使用中','In use','កំពុងប្រើ'],['spare','📦 備用','Spare','បម្រុង'],['scrap','⚫ 已報廢','Scrapped','បានបោះបង់']];
 function stName(k){for(var i=0;i<STN.length;i++)if(STN[i][0]===k)return t(STN[i][1],STN[i][2],STN[i][3]);return k}
 function renderSet(){var c=cfg(),h='<div class="gu-note" style="margin-bottom:10px">'+t('這裡管「有哪幾台」和「每台標準耗油率」。報廢一台就把狀態改成已報廢（舊紀錄保留），買新的按「➕ 新增機台」。標準耗油率可以按「📐 帶入建議值」用燃油中心近 12 個月的實績算，也可以自己改成原廠數字。','Manage which units exist and each unit’s standard consumption. Mark a scrapped unit as Scrapped (old records stay) and add the new one. The standard rate can be filled from the last 12 months of Fuel Center records (“📐 Use suggested”) or typed in.','')+'</div>';
  ['fk','gen','car'].forEach(function(kind){var K=KINDS[kind],us=units(kind,true);
   h+='<div class="gu-h">'+K.ic+' '+kindName(kind)+' · '+us.filter(function(u){return u.status!=='scrap'}).length+'<span class="sp"><button class="gu-b" data-act="uadd" data-kind="'+kind+'">➕ '+t('新增機台','Add unit','បន្ថែមគ្រឿង')+'</button></span></div>';
   h+=us.length?'<div class="gu-l">'+us.map(function(u){var s=suggestRate(kind,u.code,S.month),rl=num(u.rate)>0?f2(num(u.rate))+(kind==='car'?' km/L':' L/hr'):t('未設定','not set','មិនទាន់កំណត់');
     return '<div class="gu-r" data-act="uedit" data-id="'+esc(u.id)+'"><div>'+chip(u.code,kind)+'</div><div style="min-width:0"><div class="gu-n">'+esc(u.name||(kindName(kind)+' '+u.code))+' <span class="gu-s">'+esc(stName(u.status||'active'))+'</span></div><div class="gu-s">'+esc([u.asset&&('🏷 '+u.asset),u.spec,u.from&&(t('啟用 ','from ','')+u.from),u.to&&(t('報廢 ','until ','')+u.to),s?t('實績 ','actual ','')+f2(s.rate)+(kind==='car'?' km/L':' L/hr')+' ('+s.n+t(' 次加油',' fills','')+')':t('近 12 個月沒有足夠的加油紀錄','not enough fuel records in the last 12 months','')].filter(Boolean).join(' · '))+'</div></div><div class="gu-q" style="color:'+(num(u.rate)>0?'#0f766e':'#b91c1c')+'">'+rl+'<small>'+t('標準','standard','ស្តង់ដារ')+'</small></div></div>'}).join('')+'</div>':'<div class="gu-e">'+t('還沒有機台','No units yet','មិនទាន់មានគ្រឿង')+'</div>'});
  h+='<div class="gu-ac"><button class="gu-b" data-act="sugg">📐 '+t('全部帶入建議值（只填還沒設定的）','Fill suggested rates (only where empty)','បំពេញអត្រាដែលស្នើ')+'</button></div>';
  h+='<div class="gu-h">⚙️ '+t('單價與門檻','Price & limits','តម្លៃ និងកម្រិត')+'</div><div class="gu-card gu-f"><div class="three"><div><label>'+t('預設柴油單價 USD／L','Default diesel price USD/L','តម្លៃប្រេងលំនាំដើម')+'</label><input type="number" step="any" data-cs="priceDefault" value="'+esc(c.priceDefault)+'"></div><div><label>🟢 '+t('正常：差異在 ±% 以內','OK within ±%','ធម្មតា ±%')+'</label><input type="number" step="any" data-cs="thrY" value="'+esc(c.thrY)+'"></div><div><label>🔴 '+t('異常：差異超過 ±%','Abnormal above ±%','ខុសប្រក្រតី ±%')+'</label><input type="number" step="any" data-cs="thrR" value="'+esc(c.thrR)+'"></div></div><div class="gu-hint">'+t('各月實際單價在「柴油核對」那頁填；沒填的月份用這個預設值。','Enter each month’s actual price on the Diesel check tab; months without one use this default.','')+'</div></div>';
  h+='<div class="gu-h">☁ '+t('雲端','Cloud','ពពក')+'</div><div class="gu-ac" style="margin-top:0"><button class="gu-b" data-act="up">⬆️☁ '+t('上傳','Upload','ផ្ទុកឡើង')+'</button><button class="gu-b" data-act="down">⬇️☁ '+t('下載','Download','ទាញយក')+'</button><button class="gu-b" data-act="bak">💾 '+t('備份 JSON','Backup JSON','បម្រុងទុក JSON')+'</button></div><div class="gu-note" style="margin-top:8px">'+t('資料：叉車 ','Records: forklift ','')+USE.live('fk').length+' · '+t('發電機 ','generator ','')+USE.live('gen').length+' · '+t('保養維修 ','maintenance ','')+USE.live('mt').length+' · v'+VER+'</div>';
  body.innerHTML=h;
  body.querySelectorAll('[data-cs]').forEach(function(inp){inp.addEventListener('change',function(){var c2=JSON.parse(JSON.stringify(cfg()));c2[inp.dataset.cs]=num(inp.value);USE.put(c2);USE.save()})});
  ACT.uadd=function(a){editUnit(a.dataset.kind,null)};ACT.uedit=function(a){var u=USE.get(a.dataset.id);editUnit(u.kind,u)};
  ACT.sugg=function(){var n=0;units(null,true).forEach(function(u){if(num(u.rate)>0)return;var s=suggestRate(u.kind,u.code,S.month);if(s){var x=JSON.parse(JSON.stringify(u));x.rate=s.rate;x.rateSrc='history';USE.put(x);n++}});if(n){USE.save();toast('📐 '+t('已帶入 ','Filled ','')+n+t(' 台',' unit(s)',''))}else toast(t('沒有可帶入的（都已設定，或加油紀錄不足）','Nothing to fill (already set, or not enough fuel records)',''))};
  ACT.up=function(){USE.push(false)};ACT.down=function(){USE.pull(false)};
  ACT.bak=function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({ver:VER,at:now(),use:USE.rows,pass:PASS.rows})],{type:'application/json'}));a.download='ga_usage_backup_'+ymd()+'.json';a.click()}}
 function editUnit(kind,u){var isNew=!u;u=u?JSON.parse(JSON.stringify(u)):{t:'unit',kind:kind,status:'active',from:ymd()};var s=u.code?suggestRate(kind,u.code,S.month):null;
  var F=[{row:[{k:'code',label:kind==='car'?t('車牌','Plate','ស្លាកលេខ'):t('機號（跟加油登記寫的一樣）','Unit no. (same as in fuel records)','លេខគ្រឿង'),ph:kind==='fk'?'#3':kind==='gen'?'06':'2X-5804',req:1},{k:'name',label:kind==='car'?t('司機','Driver','អ្នកបើកបរ'):t('名稱','Name','ឈ្មោះ'),ph:kind==='gen'?'A廠 Cummins':''}]},
   {row:[{k:'rate',label:kind==='car'?t('標準 km／L','Standard km/L','km/L ស្តង់ដារ'):t('標準耗油 L／小時','Standard L/hr','L/ម៉ោង ស្តង់ដារ'),type:'number',hint:s?t('近 12 個月實績：','Last 12 months actual: ','')+'<b>'+f2(s.rate)+'</b> ('+f0(s.liters)+' L ÷ '+f0(s.use)+(kind==='car'?' km':' hr')+' · '+s.n+t(' 次',' fills','')+') <a href="#" data-use="'+s.rate+'">'+t('帶入','use it','ប្រើ')+'</a>':''},{k:'status',label:t('狀態','Status','ស្ថានភាព'),type:'select',opts:STN.map(function(x){return [x[0],t(x[1],x[2],x[3])]})}]},
   {row:[{k:'from',label:t('啟用日','In use from','ចាប់ផ្តើមប្រើ'),type:'date'},{k:'to',label:t('報廢日','Scrapped on','ថ្ងៃបោះបង់'),type:'date'}]},
   {row:[{k:'asset',label:t('資產編號','Asset code','លេខទ្រព្យ'),ph:kind==='gen'?'GEQ001':''},{k:'spec',label:t('規格','Spec','លក្ខណៈ'),ph:kind==='gen'?'300 kW':kind==='fk'?'3T diesel':''}]},
   {k:'note',label:t('備註','Note','កំណត់ចំណាំ')}];
  if(kind==='car')F.splice(1,0,{k:'aka',label:t('司機別名／全名（保安派車、交通車日報上寫的名字，逗號分開）','Driver aliases / full name (as written in the dispatch or shuttle logs, comma separated)','ឈ្មោះផ្សេងទៀតរបស់អ្នកបើកបរ'),ph:'Hea Menghorng, hong'});
  var ov=sheet((isNew?'➕ ':'✏️ ')+KINDS[kind].ic+' '+kindName(kind),formHtml(F,u)+(kind==='fk'?'<div class="gu-hint">'+t('叉車的「錶數」是小時錶（燃油中心登記的 Start／Arrive KM 其實是小時錶讀數），所以耗油率是 L／小時。','The forklift “meter” is an hour meter (the Start / Arrive KM in the Fuel Center are hour-meter readings), so the rate is L per hour.','')+'</div>':'')+'<div class="gu-ac"><button class="gu-b p" data-save>💾 '+t('儲存','Save','រក្សាទុក')+'</button>'+(isNew?'':'<button class="gu-b r" data-del>🗑 '+t('刪除','Delete','លុប')+'</button>')+'</div>');
  ov.addEventListener('click',function(e){var us=e.target.closest('[data-use]');if(us){e.preventDefault();ov.querySelector('[data-k="rate"]').value=us.dataset.use;return}
   if(e.target.closest('[data-save]')){readForm(ov,u);if(!u.code){toast(t('請填機號','Please enter the unit no.','សូមបញ្ចូលលេខ'),'err');return}if(kind==='car')u.code=plateKey(u.code);var dup=unitOf(kind,u.code);if(dup&&dup.id!==u.id){toast(t('這個機號已經有了','That unit already exists','មានរួចហើយ'),'err');return}if(!u.id)u.id='unit-'+kind+'-'+(kind==='car'?plateKey(u.code):unitKey(u.code));if(u.status==='scrap'&&!u.to)u.to=ymd();USE.put(u);USE.save();ov.remove();toast('✅ '+t('已儲存','Saved','បានរក្សាទុក'))}
   else if(e.target.closest('[data-del]')){if(confirm(t('刪除這台？（使用紀錄不會刪；通常報廢請改狀態就好）','Delete this unit? (Usage records stay; for a scrapped unit just change the status.)',''))){USE.remove(u.id);USE.save();ov.remove()}}})}

 /* ───── 證件參考 ───── */
 var PASS_SEED=[['PASS-V','訪客證','Visitor pass','ប័ណ្ណភ្ញៀវ','訪客、客戶、廠商洽公','Visitors, customers, suppliers on business','進廠在警衛室登記、押證件換訪客證，離廠歸還。','Register at the guard house, leave an ID and take the pass; return it when leaving.'],
  ['PASS-C','施工證／施工許可','Contractor pass / work permit','ប័ណ្ណអ្នកម៉ៅការ / លិខិតអនុញ្ញាតការងារ','外包施工、維修廠商','Outside contractors and repair vendors','需有總務簽核的施工許可單才發；動火、高處作業另附許可。','Issued only with a work permit signed by GA; hot work and work at height need their own permit.'],
  ['PASS-S','員工識別證','Staff ID card','ប័ណ្ណបុគ្គលិក','全體員工','All employees','上班全程配戴；遺失向 HR 補辦。','Worn at all times at work; report a lost card to HR for a replacement.'],
  ['PASS-H','頭巾（顏色＝部門／職務）','Headscarf (colour = dept / role)','កន្សែងក្បាល (ពណ៌ = ផ្នែក)','車間員工','Production-floor workers','各顏色代表的部門／職務請在備註寫清楚並附照片。','Write what each colour means (department / role) in the note and add photos.'],
  ['PASS-T','臨時證','Temporary pass','ប័ណ្ណបណ្តោះអាសន្ន','忘記帶識別證、新進未發證','Staff who forgot their ID, new staff without a card yet','當日有效，下班歸還警衛室。','Valid for the day only; return it to the guard house after work.'],
  ['PASS-P','車輛／停車證','Vehicle / parking pass','ប័ណ្ណរថយន្ត / ចំណត','公司車、員工機車、常來廠商車','Company cars, staff motorbikes, regular supplier vehicles','貼／掛在明顯處，警衛依證放行。','Displayed where the guard can see it; entry is allowed by the pass.'],
  ['PASS-D','貨櫃／送貨司機證','Container / delivery driver pass','ប័ណ្ណអ្នកបើកកុងតឺន័រ','貨櫃車、送貨司機','Container-truck and delivery drivers','入廠登記車牌與櫃號後發證，出廠歸還。','Issued after the plate and container number are registered at the gate; returned on the way out.'],
  ['PASS-E','外籍幹部證','Expat staff ID','ប័ណ្ណបុគ្គលិកបរទេស','台籍／外籍幹部','Taiwanese / expatriate staff','','']];
 function seedPass(){if(PASS.rows.length)return false;PASS_SEED.forEach(function(p,i){PASS.put({id:'pass-'+p[0].toLowerCase(),t:'pass',code:p[0],name:p[1],en:p[2],km:p[3],who:p[4],who2:p[5],rule:p[6],rule2:p[7],order:i+1,seed:true,photos:[],createdAt:SEED_AT,updatedAt:SEED_AT},true)});PASS.dirty=true;PASS.persist();return true}
 function loc2(p,k){return LANG()==='zh'?(p[k]||p[k+'2']||''):(p[k+'2']||p[k]||'')}
 function passName(p){return t(p.name,p.en||p.name,p.km||p.en||p.name)}
 function renderPass(){var rows=PASS.live('pass').sort(function(a,b){return (num(a.order)||99)-(num(b.order)||99)||String(a.code).localeCompare(String(b.code))}),miss=rows.filter(function(p){return !(p.photos&&p.photos.length)}).length;
  var h='<div class="gu-bar"><button class="gu-b p" data-act="padd">➕ '+t('新增證件','Add pass type','បន្ថែមប្រភេទប័ណ្ណ')+'</button><button class="gu-b" data-act="pdown">⬇️☁ '+t('從雲端更新','Update from cloud','ធ្វើបច្ចុប្បន្នភាព')+'</button></div><div class="gu-note" style="margin-bottom:10px">'+t('各種證件長什麼樣、給誰用、怎麼發怎麼收，放在這裡給保安對照。點卡片可以改內容、拍照（正面／背面／各顏色）。','What each pass looks like, who it is for and how it is issued and returned — for the guards to check against. Tap a card to edit it and add photos (front / back / each colour).','')+(miss?' <b style="color:#b45309">📷 '+miss+t(' 種還沒有照片',' type(s) still have no photo','')+'</b>':'')+'</div>';
  h+=rows.length?'<div class="gu-g">'+rows.map(function(p){return '<div class="gu-pc" data-act="pedit" data-id="'+esc(p.id)+'"><div class="im">'+(p.photos&&p.photos[0]?'<img src="'+p.photos[0]+'">':'📷 '+t('缺照片<br>點這裡補','No photo<br>tap to add','គ្មានរូបថត'))+'</div><div class="tx"><b>'+esc(passName(p))+'</b><span>'+chip(p.code,'car')+(p.color?' 🎨 '+esc(p.color):'')+(num(p.qty)>0?' · '+num(p.qty)+t(' 張',' pcs',''):'')+'</span>'+(loc2(p,'who')?'<span>👥 '+esc(loc2(p,'who'))+'</span>':'')+(loc2(p,'rule')?'<span>📋 '+esc(loc2(p,'rule'))+'</span>':'')+'</div></div>'}).join('')+'</div>':'<div class="gu-e">'+t('還沒有證件','No passes yet','មិនទាន់មានប័ណ្ណ')+'</div>';
  body.innerHTML=h;ACT.padd=function(){editPass(null)};ACT.pedit=function(a){editPass(PASS.get(a.dataset.id))};ACT.pdown=function(){PASS.pull(false)}}
 function editPass(p){var isNew=!p;p=p?JSON.parse(JSON.stringify(p)):{t:'pass',code:'PASS-',order:PASS.live('pass').length+1};p.photos=p.photos||[];
  var F=[{row:[{k:'code',label:t('代號','Code','កូដ'),req:1},{k:'color',label:t('顏色／樣式','Colour / style','ពណ៌'),ph:t('例：紅底白字','e.g. red with white text','')}]},
   {k:'name',label:t('名稱（中文）','Name (Chinese)','ឈ្មោះ (ចិន)'),req:1},{row:[{k:'en',label:'English'},{k:'km',label:'ខ្មែរ'}]},
   {k:'who',label:t('給誰用（中文）','Who it is for (Chinese)','សម្រាប់អ្នកណា (ចិន)')},{k:'who2',label:t('給誰用（English／ខ្មែរ）','Who it is for (English / ខ្មែរ)','សម្រាប់អ្នកណា (English / ខ្មែរ)')},{k:'rule',label:t('發放／歸還規則（中文）','Issue / return rules (Chinese)','ច្បាប់ចេញ / ប្រគល់វិញ (ចិន)'),type:'textarea'},{k:'rule2',label:t('發放／歸還規則（English／ខ្មែរ）','Issue / return rules (English / ខ្មែរ)','ច្បាប់ចេញ / ប្រគល់វិញ (English / ខ្មែរ)'),type:'textarea'},
   {row:[{k:'qty',label:t('數量','Quantity','ចំនួន'),type:'number'},{k:'keeper',label:t('保管處','Kept at','រក្សាទុកនៅ'),ph:t('警衛室','Guard house','ប៉ុស្តិ៍យាម')},{k:'order',label:t('排序','Order','លំដាប់'),type:'number'}]},
   {k:'note',label:t('備註','Note','កំណត់ចំណាំ'),type:'textarea'}];
  var ov=sheet((isNew?'➕ ':'🪪 ')+esc(isNew?t('新增證件','Add pass type','បន្ថែមប្រភេទប័ណ្ណ'):passName(p)),'<div class="gu-f"><label>📷 '+t('照片（正面、背面、各顏色，最多 6 張）','Photos (front, back, each colour — max 6)','រូបថត (អតិបរមា ៦)')+'</label><div data-pw></div></div>'+formHtml(F,p)+'<div class="gu-ac"><button class="gu-b p" data-save>💾 '+t('儲存','Save','រក្សាទុក')+'</button>'+(isNew?'':'<button class="gu-b r" data-del>🗑 '+t('刪除','Delete','លុប')+'</button>')+'</div>');
  var pw=ov.querySelector('[data-pw]');function drawP(){pw.innerHTML=photosHtml(p.photos,6)}drawP();bindPhotos(pw,p.photos,6,800,drawP);
  ov.addEventListener('click',function(e){if(e.target.closest('[data-save]')){readForm(ov,p);if(!p.name||!p.code){toast(t('請填代號和名稱','Please enter the code and name','សូមបញ្ចូលកូដ និងឈ្មោះ'),'err');return}delete p.seed;PASS.put(p);PASS.save();ov.remove();toast('✅ '+t('已儲存','Saved','បានរក្សាទុក'))}else if(e.target.closest('[data-del]')){if(confirm(t('刪除這種證件？','Delete this pass type?','លុបប្រភេទប័ណ្ណនេះ?'))){PASS.remove(p.id);PASS.save();ov.remove()}}})}

 /* ───── 啟動 ───── */
 paintNav();
 var needUse=TABS.some(function(k){return k!=='pass'}),needPass=TABS.indexOf('pass')>=0;
 var ready=Promise.all([needUse?USE.load():null,needPass?PASS.load():null,needUse?loadExt():null]).then(function(){S.ready=true;if(needUse)seedUnits();if(needPass)seedPass();render();
  /* 背景跟雲端對一次；剛建立的預設值會在對完後上傳 */
  var jobs=[];if(needUse)jobs.push(USE.pull(true).then(function(){seedUnits();if(USE.dirty)return USE.push(true)}));if(needPass)jobs.push(PASS.pull(true).then(function(){if(PASS.dirty)return PASS.push(true)}));return Promise.all(jobs)}).then(function(){render()}).catch(function(e){S.ready=true;setSt('⚠ '+(e&&e.message||e),'err');render()});
 if(g.GA&&GA.on)try{GA.on('lang',function(){paintNav();render()})}catch(e){}
 return {show:show,render:function(){paintNav();render()},ready:ready,state:S,upload:function(){return Promise.all([needUse?USE.push(false):null,needPass?PASS.push(false):null])},download:function(){return Promise.all([needUse?USE.pull(false):null,needPass?PASS.pull(false):null])}}}

g.GAUsage={VER:VER,mount:mount,_:{USE:USE,PASS:PASS,EXT:EXT,buildCheck:buildCheck,gather:gather,suggestRate:suggestRate,loadExt:loadExt,unitKey:unitKey,plateKey:plateKey,hoursOf:hoursOf,fkUse:fkUse,genUse:genUse,readExt:readExt}};
})(window);
