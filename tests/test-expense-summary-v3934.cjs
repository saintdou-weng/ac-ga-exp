/* v3.9.34: Expense summary — utilities broken out by area (Factory / staff houses), major expenses first,
   other items one line each, category subtotals; report in zh/en/km/trilingual (HTML + Excel). */
const assert=require('assert');const F=require('./ga-browser-fixtures.cjs');
(async()=>{const s=F.backend();const p=await F.page('expense.html',s);const w=p.w;await F.delay(1200);
 const U=(m,sheet,item,amt,cons,unit)=>({date:'2026-'+m+'-01',sourceSheet:sheet,categoryLabel:sheet,item,amount:amt,consumption:cons,consUnit:unit,_source:'general',sourceModule:'excel',recordId:'u'+m+sheet+item});
 const P=(d,item,amt,qty,cat)=>({date:d,item,amount:amt,qty,price:amt/qty,supplier:'Shop',purpose:'use',_source:'purchase',recordId:'p'+d+item,expenseCategory:cat});
 w.EXP3.general=[U('06','Electric','Factory',4306.13,43061,'KW'),U('06','Electric','Expat staff house',624.88,2500,'KW'),U('06','Electric','Local staff house',195.82,780,'KW'),U('06','Water','Factory',0.25,1,'m3'),U('06','Water','Local staff house',29,58,'m3'),
  U('05','Electric','Factory',5001.02,50010,'KW'),U('05','Electric','Expat staff house',715.95,2800,'KW'),U('05','Electric','Local staff house',184.33,700,'KW'),U('05','Water','Local staff house',30.5,61,'m3')];
 w.EXP3.purchase=[P('2026-06-12','Generator part',1200,1,'repair_maintenance'),P('2026-06-03','Bag',45,10,'purchasing_supplies')];
 for(let i=0;i<25;i++)w.EXP3.purchase.push(P('2026-06-'+String(10+(i%18)).padStart(2,'0'),'Item '+i,10+i,1,'office_admin'));
 w.EXP3.repair=[];
 w.EXP_TG_SUMMARY_MODE='key';
 const zh=w.expenseTelegramText({scope:'all',ptype:'month',period:'2026-06',lang:'zh'});
 console.log(zh);
 assert(/⚡ 電費：\$5,126\.83/.test(zh),'electricity total');
 assert(/🏭 工廠：\$4,306\.13 · 43,061 kWh  🟢 −13\.9%/.test(zh),'factory line with kWh + trend');
 assert(/🏠 外籍宿舍：\$624\.88/.test(zh)&&/🏘️ 本地宿舍：\$195\.82/.test(zh),'staff houses');
 assert(zh.indexOf('🏭 工廠')<zh.indexOf('🏠 外籍宿舍'),'factory first');
 assert(/🔥 重大費用 Top 5 （不含水電）\n1\) \$1,200\.00｜Generator part/.test(zh),'major expense first');
 assert(!/重大費用[\s\S]*Factory/.test(zh.split('📋')[0].split('🔥')[1]||''),'utilities not repeated in major');
 assert(/📋 其他明細（15\/22）/.test(zh),'other list 15 of 22');assert(/… 另 7 筆，合計 /.test(zh),'hidden remainder total');
 assert(/🗂️ 分類小計\n• ⚡ 電費：\$5,126\.83（/.test(zh),'category subtotal');
 assert(zh.split('\n').length<60,'compact: '+zh.split('\n').length+' lines');
 const en=w.expenseTelegramText({scope:'all',ptype:'month',period:'2026-06',lang:'en'});assert(/🏭 Factory: |🏭 Factory：/.test(en)&&/Major expenses/.test(en));
 const km=w.expenseTelegramText({scope:'all',ptype:'month',period:'2026-06',lang:'km'});assert(/រោងចក្រ/.test(km)&&/អគ្គិសនី/.test(km));
 const pur=w.expenseTelegramText({scope:'purchase',ptype:'month',period:'2026-06',lang:'zh'});assert(/選「三類整合」可看工廠與宿舍電費/.test(pur),'hint when scope has no utilities');
 w.EXP_TG_SUMMARY_MODE='all';const all=w.expenseTelegramText({scope:'all',ptype:'month',period:'2026-06',lang:'zh'});assert(/其他明細（22\/22）/.test(all)&&!/… 另/.test(all));
 w.EXP_TG_SUMMARY_MODE='large';const lg=w.expenseTelegramText({scope:'all',ptype:'month',period:'2026-06',lang:'zh'});assert(/Top 12/.test(lg)&&!/📋/.test(lg));
 const yr=w.expenseTelegramText({scope:'all',ptype:'year',period:'2026',lang:'zh'});assert(/🏭 工廠：\$9,307\.15/.test(yr),'year aggregates both months');
 // in-page summary
 w.pc.set('month','2026-06');w.activeTab='summary';w.render();const v=w.document.getElementById('exp-view').innerHTML;
 assert(/水電分區/.test(v)&&/exp-area-factory/.test(v)&&/工廠電費/.test(v)&&/openExpenseReport/.test(v),'page utilities-by-area + report button');
 // report
 for(const L of ['zh','en','km','all3']){const h=w.expenseReportHtml({lang:L,scope:'all',ptype:'month',period:'2026-06'});assert(/<tr class="fa">/.test(h)&&/\$4,306\.13/.test(h)&&/Generator part/.test(h),'report '+L);if(L==='all3')assert(/工廠 · Factory · រោងចក្រ/.test(h));}
 let saved=null;w.XLSX.writeFile=(wb,name)=>{saved={wb,name};};w.expenseReportXlsx({lang:'en',scope:'all',ptype:'month',period:'2026-06'});
 assert(saved&&/Expense_Report_2026-06_en\.xlsx/.test(saved.name)&&saved.wb.SheetNames.join()==='Summary,Items');
 const sum=w.XLSX.utils.sheet_to_json(saved.wb.Sheets.Summary,{header:1});assert(sum.some(r=>/Factory \(43061 kWh\)/.test(r[0])&&r[1]===4306.13&&r[2]===5001.02),'excel factory row');
 assert.equal(w.XLSX.utils.sheet_to_json(saved.wb.Sheets.Items,{header:1}).length,1+9-4+27,'items sheet rows');
 assert.deepEqual(p.errors,[],'no page errors');
 console.log('PASS expense summary v3.9.34');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
