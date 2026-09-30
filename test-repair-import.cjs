const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const root=path.resolve(__dirname,'..'),XLSX=require('../shared/xlsx.full.min.js');
const fixture=process.argv[2];if(!fixture)throw Error('Pass the original VRT Repair-Maintainance .xlsb path');
const bytes=fs.readFileSync(fixture),wb=XLSX.read(bytes,{type:'buffer',cellDates:false});
function pageHTML(base,name){return fs.readFileSync(path.join(base,name),'utf8').replace(/<script[^>]*src="(shared\/[^"?]+)[^"]*"[^>]*><\/script>/g,(_,src)=>'<script>'+fs.readFileSync(path.join(base,src),'utf8')+'</script>');}
async function setup(base){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/getContext|scrollTo|navigation/.test(e.message))errors.push(e.message);});const dom=new JSDOM(pageHTML(base,'expense.html'),{url:'https://qa.invalid/expense.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.indexedDB=new IDBFactory();w.confirm=()=>false;w.alert=()=>{};w.Chart=class{destroy(){} update(){}};w.HTMLCanvasElement.prototype.getContext=()=>null;w.fetch=async()=>{throw Error('External calls blocked in test');};}});await new Promise(r=>setTimeout(r,400));dom.window.eval("txns=[];EXP3={repair:[],purchase:[],general:[]};scheduleExpenseAutoCloudSync=function(){};");return {w:dom.window,errors,close:()=>dom.window.close()};}
(async()=>{
 let legacyRows=[];if(process.argv[3]){const b=await setup(path.resolve(process.argv[3]));try{const rows=b.w.parseWorkbook(wb,'repair',path.basename(fixture));legacyRows=JSON.parse(JSON.stringify(rows));console.log('BASELINE rows:',rows.length,'amount:',rows.reduce((s,r)=>s+r.amount,0));}finally{b.close();}}
 const p=await setup(root);try{
  const w=p.w,rows=w.parseWorkbook(wb,'repair',path.basename(fixture));
  const by={};for(const r of rows){const k=r.sourceSheet+' / '+r.date.slice(0,4);const g=by[k]||(by[k]={count:0,cents:0});g.count++;g.cents+=Math.round(r.amount*100);assert.equal(r.expenseCategory,'repair_maintenance');assert(r._row>=5);assert(!/^2022/.test(r.date));}
  console.log('PARSED',JSON.stringify(by));
  assert.equal(rows.length,57);assert.equal(rows.filter(r=>r.date.startsWith('2026')).reduce((s,r)=>s+Math.round(r.amount*100),0),159750);assert.equal(rows.filter(r=>r.date.startsWith('2024')).reduce((s,r)=>s+Math.round(r.amount*100),0),11800);
  assert.equal(new Set(rows.map(r=>r._sourceKey)).size,rows.length,'all equipment blocks keep distinct identities');
  assert.equal(rows.filter(r=>r.sourceSheet==='Genset & Staff house'&&r._row===6).length,2,'parallel gensets retained');
  const imported=await w.doExpenseImport([new w.File([bytes],path.basename(fixture))]);assert(imported.ok);assert.equal(imported.added,rows.length);assert.equal(imported.duplicateCandidates,0,'different rooms/equipment are not duplicates');
  const second=await w.doExpenseImport([new w.File([bytes],path.basename(fixture).replace('(1)','(2)'))]);assert.equal(second.added,0);assert.equal(second.updated,0);assert.equal(w.eval('EXP3.repair.length'),rows.length);
  // One edit to one of two parallel blocks changes only that source line.
  const changed=XLSX.read(bytes,{type:'buffer'});changed.Sheets['Forklift']['N6'].v=21;
  const readFile=w.readWorkbook;w.readWorkbook=async()=>changed;
  const third=await w.doExpenseImport([new w.File([bytes],path.basename(fixture))]);w.readWorkbook=readFile;assert.equal(third.updated,1);assert.equal(third.added,0);assert.equal(w.eval('EXP3.repair.length'),rows.length);
  const scan=await w.GA.smartImport.scan([new w.File([bytes],path.basename(fixture))]);assert.equal(scan.sheets.length,4);assert(scan.sheets.every(s=>s.detect.type==='repair'));assert.equal(scan.sheets.reduce((s,x)=>s+x.records.length,0),rows.length);
  for(const type of ['day','week','month','year'])assert(w.GA.inPeriod('2026-08-24',w.GA.periodKey('2026-08-24',type),type));
  w.eval("activeTab='repair';pc.set('year','2026');render();");assert(w.document.getElementById('exp-view').textContent.includes('1,598.50'),'period UI reflects one +$1 update');
  if(legacyRows.length){w.EXP3={repair:legacyRows,purchase:[],general:[]};const cancelled=await w.doExpenseImport([new w.File([bytes],path.basename(fixture))]);assert.equal(w.EXP3.repair.length,5,'cancel legacy correction retains original');w.confirm=()=>true;const fixed=await w.doExpenseImport([new w.File([bytes],path.basename(fixture))]);assert(fixed.ok);assert.equal(w.EXP3.repair.length,57,'legacy correction avoids keeping incorrect duplicates');assert.equal(JSON.parse(w.localStorage.getItem('ga_repair_import_backup_v3921')).records.length,5);}
  assert.equal(p.errors.length,0,p.errors.join('\n'));console.log('PASS full XLSB import, all repair sheets, date/amount/room mapping, repeated import, one-line update, smart import routing, D/W/M/Y and expense render');
 }finally{p.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
