/* v3.9.35: sewing-style period bar, 月年趨勢 list (one row per period), year mode collapses details into monthly subtotals,
   報告生成 tab builds a Word report (zh+en / en+km) like the sewing weekly report. */
const assert=require('assert');const F=require('./ga-browser-fixtures.cjs');const fs=require('fs'),path=require('path'),zlib=require('zlib');
function docxText(b64){const buf=Buffer.from(b64,'base64');let i=0,out='';while((i=buf.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]),i))>=0){const m=buf.readUInt16LE(i+8),cs=buf.readUInt32LE(i+18),nl=buf.readUInt16LE(i+26),el=buf.readUInt16LE(i+28),name=buf.slice(i+30,i+30+nl).toString(),st=i+30+nl+el;if(name==='word/document.xml'){const d=buf.slice(st,st+cs);out=(m===8?zlib.inflateRawSync(d):d).toString();}i=st;}return out.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');}
(async()=>{const s=F.backend();const p=await F.page('expense.html',s);const w=p.w;await F.delay(1200);
 const U=(m,sheet,item,amt,cons)=>({date:'2026-'+m+'-01',sourceSheet:sheet,categoryLabel:sheet,item,amount:amt,consumption:cons,consUnit:sheet==='Electric'?'KW':'m3',_source:'general',recordId:'u'+m+sheet+item});
 const P=(d,item,amt,src,cat)=>({date:d,item,amount:amt,qty:1,price:amt,supplier:'Shop',_source:src,recordId:src+d+item,expenseCategory:cat});
 w.txns=[];w.EXP3.general=[];w.EXP3.purchase=[];w.EXP3.repair=[];
 [['04',3701.31,4000],['05',5001.02,5000],['06',4306.13,4300]].forEach(([m,f,k])=>{w.EXP3.general.push(U(m,'Electric','Factory',f,k),U(m,'Electric','Expat staff house',600,700),U(m,'Electric','Local staff house',150,400),U(m,'Water','Local staff house',30,60));});
 w.EXP3.purchase.push(P('2026-06-12','Steel',393,'purchase','office_admin'),P('2026-05-02','Bag',45,'purchase','purchasing_supplies'),P('2025-06-02','Old item',100,'purchase','office_admin'));
 w.EXP3.repair.push(P('2026-06-10','Generator part',1200,'repair','repair_maintenance'),P('2026-04-10','Pipe',20,'repair','repair_maintenance'));
 // period bar (sewing style)
 const bar=w.document.querySelector('#exp-period .ga-pc.nav');assert(bar,'nav layout');assert(!bar.querySelector('.ga-pc-date'),'no date input');assert(/最新|Latest/.test(bar.textContent));
 w.pc.set('month','2026-06');w.pc.refresh();const opts=[...w.document.querySelectorAll('#exp-period .ga-pc-sel option')].map(o=>o.value);assert.deepEqual(opts,['2026-06','2026-05','2026-04','2025-06'],'only periods with data: '+opts);
 w.document.querySelector('#exp-period [data-act="prev"]').click();assert.equal(w.currentState().key,'2026-05');
 w.pc.set('month','2026-04');w.document.querySelector('#exp-period [data-act="prev"]').click();assert.equal(w.currentState().key,'2025-06','skips empty months');
 w.document.querySelector('#exp-period [data-act="latest"]').click();assert.equal(w.currentState().key,'2026-06');
 // tabs: no overlap on phones (coarse pointer min-width:44px) → tabs must not shrink
 assert(/\.exp-nav>\.exp-tab\{flex:0 0 auto\}/.test(fs.readFileSync(path.join(__dirname,'..','expense.html'),'utf8')));
 // 月年趨勢
 w.expTab('trend');let v=w.document.getElementById('exp-view').innerHTML;
 assert.equal(w.document.getElementById('exp-period').style.display,'none','period bar hidden on trend');
 const trs=[...w.document.querySelectorAll('.exp-trend-table tbody tr')];assert.equal(trs.length,4,'one row per month');
 assert(/2026-06/.test(trs[0].textContent)&&/\$6,679\.13/.test(trs[0].textContent)&&/\$4,306\.13/.test(trs[0].textContent),'june row total + factory: '+trs[0].textContent);
 assert(!/Steel/.test(v),'no detail rows in trend');
 const d=w.expTrendData('month','all')[0];assert.equal(Math.round((d.elec+d.water+d.repair+d.purchase+d.general)*100),Math.round(d.total*100),'columns add up');
 w.EXP_TREND.type='year';w.renderTrend();assert.equal(w.document.querySelectorAll('.exp-trend-table tbody tr').length,2,'one row per year');
 trs[0].click&&w.expOpenPeriod('month','2026-05');assert.equal(w.activeTab,'summary');assert.equal(w.currentState().key,'2026-05');
 // year mode in source tab: monthly subtotals, details collapsed
 w.pc.set('year','2026');w.expTab('purchase');v=w.document.getElementById('exp-view').innerHTML;
 assert(/本年每月小計|Monthly subtotals/.test(v)&&!/>Steel</.test(v),'year collapsed');assert(/顯示全年 2 筆明細|Show all 2 rows/.test(v));
 w.EXP_SHOW_YEAR_DETAIL=true;w.render();assert(/Steel/.test(w.document.getElementById('exp-view').innerHTML),'expand details');
 w.pc.set('month','2026-06');assert(/Steel/.test(w.document.getElementById('exp-view').innerHTML),'month mode shows details');
 // report tab
 w.openExpenseReport();assert.equal(w.activeTab,'report');v=w.document.getElementById('exp-view').innerHTML;
 assert(/產生 Word 報告|Generate Word report/.test(v)&&/期間比較|Period comparison/.test(v));assert.equal(w.EXP_RPT.key,'2026-06');
 // Word document content
 w.eval(fs.readFileSync(path.join(__dirname,'..','shared/docx.iife.js'),'utf8'));assert(w.docx&&w.docx.Document&&w.docx.Packer,'browser docx lib loads');
 /* jsdom cannot run JSZip's async packer; build with the page's builder and pack with the same docx version in Node (npm i docx@8.5.0) */
 const D=require('docx');w.docx=D;
 for(const lang of ['zh-en','en-km']){w.EXP_RPT.lang=lang;w.EXP_RPT.notes='Check generator invoice';const doc=w.expWordDoc(w.docx,w.expRptCtx());const b64=await w.docx.Packer.toBase64String(doc);const t=docxText(b64);
  assert(/VANTAGE RIVER TEXTILES/.test(t)&&/2026-06/.test(t)&&/\$4,306\.13/.test(t)&&/Generator part/.test(t)&&/Check generator invoice/.test(t),'word '+lang);
  if(lang==='zh-en')assert(/管理摘要/.test(t)&&/Executive Summary/.test(t)&&/工廠電費/.test(t)&&/去年同期/.test(t));else assert(/Executive Summary/.test(t)&&/សេចក្តីសង្ខេប/.test(t)&&!/管理摘要/.test(t));}
 w.EXP_RPT.type='year';w.EXP_RPT.key='';w.renderReportTab();assert.equal(w.EXP_RPT.key,'2026');const t2=docxText(await w.docx.Packer.toBase64String(w.expWordDoc(w.docx,w.expRptCtx())));assert(/Annual Report|年報/.test(t2));
 assert.deepEqual(p.errors,[],'no page errors');
 console.log('PASS v3.9.35 period bar, month/year list, year collapse, Word report zh+en / en+km');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
