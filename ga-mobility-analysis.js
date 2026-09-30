/* v3.9.19: period analysis. A toll row is one-way; a top-up is never a trip. */
(function(g){
'use strict';
const clean=v=>String(v==null?'':v).trim().replace(/\s+/g,' ');
const key=v=>clean(v).toLocaleLowerCase();
function users(r){
  const explicit=clean(r.users),raw=explicit||clean(r.passengers);
  if(!raw)return {names:[],unresolved:raw||'(blank)'};
  const parts=raw.split(/[,，、;；/\n]+/).map(clean).filter(Boolean);
  // Legacy free text often contains multiple people without delimiters or a journey.
  // Require user correction instead of guessing identities from individual words.
  if(!explicit&&parts.some(p=>/\b(?:take|back|from|go|staff|admin)\b/i.test(p)||p.split(' ').length>1))return {names:[],unresolved:raw};
  const unique=new Map();parts.forEach(p=>{if(!unique.has(key(p)))unique.set(key(p),p);});
  return {names:[...unique.values()],unresolved:''};
}
function analyze(input,kind){
  const rows=input.filter(r=>!r._deleted&&r.cat===kind),isTrip=r=>kind==='etc'?Number(r.charge)>0:true;
  const trips=rows.filter(isTrip),drivers=new Map(),vehicles=new Map(),people=new Map(),days=new Map(),unresolved=[];
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  function add(map,name,r){const label=clean(name)||'—',k=key(label),v=map.get(k)||{name:label,trips:0,charge:0,km:0};v.trips++;v.charge+=number(r.charge);v.km+=number(r.km);map.set(k,v);}
  trips.forEach(r=>{add(drivers,r.driver,r);add(vehicles,r.plate,r);if(kind==='etc'){const u=users(r);if(u.unresolved)unresolved.push(r);u.names.forEach(n=>add(people,n,r));}});
  rows.forEach(r=>{const d=days.get(r.date)||{date:r.date,trips:0,charge:0,topup:0,km:0};d.trips+=isTrip(r)?1:0;d.charge+=number(r.charge);d.topup+=number(r.topup);d.km+=number(r.km);days.set(r.date,d);});
  const sorted=m=>[...m.values()].sort((a,b)=>b.trips-a.trips||b.charge-a.charge||a.name.localeCompare(b.name));
  const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
  return {records:rows.length,trips:trips.length,charge:rows.reduce((s,r)=>s+number(r.charge),0),topup:rows.reduce((s,r)=>s+number(r.topup),0),drivers:sorted(drivers),vehicles:sorted(vehicles),people:sorted(people),daily,unresolved};
}
function render(target,input,kind,period,periodKey,onEdit){
  const GA=g.GA,T=(z,e,k)=>GA.lang==='en'?e:GA.lang==='km'?k:z,esc=GA.esc;
  const fmt=v=>Number(v||0).toLocaleString('en-US',{maximumFractionDigits:2}),a=analyze(input,kind);
  const rank=(title,list,people)=>'<section class="analysis-panel"><h2>'+esc(title)+'</h2><div class="table-wrap"><table><thead><tr><th>#</th><th>'+T('名稱','Name','ឈ្មោះ')+'</th><th>'+T(kind==='etc'?'單程通行次數':'行程紀錄數',kind==='etc'?'One-way passages':'Journey records','ចំនួនកំណត់ត្រា')+'</th>'+(!people?'<th>'+(kind==='etc'?'USD':'KM')+'</th>':'')+'</tr></thead><tbody>'+list.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'<span class="rank-bar" style="width:'+Math.max(2,100*r.trips/(list[0]?.trips||1))+'%"></span></td><td>'+r.trips+'</td>'+(!people?'<td>'+fmt(kind==='etc'?r.charge:r.km)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>'+(!list.length?'<p>'+T('本期無可排名資料','No ranking data in this period','គ្មានទិន្នន័យ')+'</p>':'')+'</section>';
  const buckets=new Map();a.daily.forEach(d=>{const k=period==='year'?d.date.slice(0,7):d.date,v=buckets.get(k)||{date:k,trips:0,charge:0,topup:0,km:0};['trips','charge','topup','km'].forEach(f=>v[f]+=d[f]);buckets.set(k,v);});
  const trend=[...buckets.values()];
  target.innerHTML='<p class="analysis-label">'+esc(GA.periodLabel(periodKey,period))+' · '+T('依目前期間與搜尋結果分析','Analysis for the selected period and search','វិភាគតាមរយៈពេល និងការស្វែងរក')+'</p><p class="analysis-note">'+(kind==='etc'?T('通行費大於 0 的一列算一次單程通行；往返兩列算兩次，儲值不算趟數。用車人多人共乘時每人各計一次，人数合計不等於車趟；不重複分攤通行費。原表多人混寫或行程文字列為待整理，可編輯「用車人」以逗號分開。','Each positive-toll row is one one-way passage; two return-trip rows count twice. Top-ups are excluded. Each identified passenger counts once per shared passage; passenger counts are not vehicle trips. Unstructured passenger text needs review. Edit Users with comma-separated names.','មួយជួរថ្លៃផ្លូវវិជ្ជមានគឺមួយដង។ បញ្ចូលប្រាក់មិនរាប់ជាជើងទេ។ អ្នករួមដំណើរម្នាក់រាប់មួយដង។ កែឈ្មោះដោយសញ្ញាក្បៀស។'):T('每筆原表用途／行程記錄計一次；沒有出發返回時間的每日彙總不可當作精確實際車趟。','Each source purpose/journey row counts once. Daily aggregates without journey times are not exact vehicle trip counts.','រាប់តាមកំណត់ត្រាដើមនីមួយៗ។'))+'</p><div class="analysis-grid">'+(kind==='etc'?rank(T('用車人排名','User ranking','ចំណាត់ថ្នាក់អ្នកប្រើ'),a.people,true):'')+rank(T('司機排名','Driver ranking','ចំណាត់ថ្នាក់អ្នកបើកបរ'),a.drivers,false)+(kind==='etc'?rank(T('車牌排名','Vehicle ranking','ចំណាត់ថ្នាក់រថយន្ត'),a.vehicles,false):'')+'<section class="analysis-panel"><h2>'+T(period==='year'?'每月統計':'每日統計',period==='year'?'Monthly trend':'Daily trend','ស្ថិតិតាមកាលបរិច្ឆេទ')+'</h2><div class="table-wrap"><table><thead><tr><th>'+T('日期','Date','ថ្ងៃ')+'</th><th>'+T('次數','Count','ចំនួន')+'</th><th>'+(kind==='etc'?T('通行費 USD','Toll USD','ថ្លៃផ្លូវ USD'):'KM')+'</th>'+(kind==='etc'?'<th>'+T('儲值 USD','Top-up USD','បញ្ចូល USD')+'</th>':'')+'</tr></thead><tbody>'+trend.map(d=>'<tr><td>'+esc(d.date)+'</td><td>'+d.trips+'</td><td>'+fmt(kind==='etc'?d.charge:d.km)+'</td>'+(kind==='etc'?'<td>'+fmt(d.topup)+'</td>':'')+'</tr>').join('')+'</tbody></table></div></section></div>';
  if(kind==='etc'&&a.unresolved.length){const notice=document.createElement('p');notice.className='analysis-note';notice.textContent=T('個人排名尚未完整：','User ranking is incomplete: ','ចំណាត់ថ្នាក់មិនទាន់ពេញលេញ៖ ')+a.unresolved.length+' / '+a.trips+' '+T('次通行的用車人待整理。','passages need user-name review.','ត្រូវពិនិត្យឈ្មោះ។');target.prepend(notice);const section=document.createElement('section');section.className='analysis-panel';section.style.marginTop='16px';section.innerHTML='<h2>'+T('用車人待整理','Users to review','ឈ្មោះត្រូវពិនិត្យ')+' ('+a.unresolved.length+')</h2><p>'+T('以下記錄仍計入通行總次數及司機排名，尚未計入個人排名。','These passages are included in total and driver counts, but not individual user ranks.','កំណត់ត្រាទាំងនេះនៅក្នុងចំនួនសរុប។')+'</p>';a.unresolved.forEach(r=>{const p=document.createElement('p'),b=document.createElement('button');p.append(document.createTextNode(r.date+' · '+(r.passengers||'—')+' '));b.textContent=T('整理用車人','Edit users','កែឈ្មោះ');b.onclick=()=>onEdit(r.id);p.append(b);section.append(p);});target.append(section);}
  return a;
}
g.GAMobilityAnalysis={analyze,users,render};
})(typeof window!=='undefined'?window:globalThis);
