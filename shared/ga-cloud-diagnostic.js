/* Connection diagnosis is available before login. Probes never change a data destination. */
(function(){
  'use strict';
  const T=(z,e,k)=>GA.lang==='zh'?z:GA.lang==='km'?k:e;
  const $=id=>document.getElementById(id);
  let verified=null, run=0;
  const required=['strictActionErrors','procStateToken','smartSync','smartCommitToken','monthlyPoReceiptGuard'];
  function describe(info){
    const missing=required.filter(c=>!info.capabilities.includes(c));
    return T('實際版本：','Actual version: ','កំណែ៖ ')+(info.version||T('未回報','not reported','មិនបានរាយការណ៍'))+'\n'+
      (missing.length?T('尚未通過保存功能檢查：','Save checks missing: ','ខ្វះការត្រួតពិនិត្យ៖ ')+missing.map(c=>({strictActionErrors:T('雲端版本驗證','cloud version check','កំណែ Cloud'),procStateToken:T('採購保存','PO save','រក្សាទុក PO'),smartSync:T('資料同步','data sync','Sync'),smartCommitToken:T('上傳版本比對','upload version check','កំណែផ្ទុកឡើង'),monthlyPoReceiptGuard:T('Monthly PO 收貨核對','Monthly PO receiving','ទទួល Monthly PO')}[c]||c)).join(', '):T('採購與收貨保存功能檢查通過','PO and receiving save checks passed','ការត្រួតពិនិត្យបានជោគជ័យ'))+'\n'+info.url+(missing.length?'\n'+T('請將本包 backend/AC_GA_EXP.gs 更新到此網址的原部署，並發布新版本。','Update this URL’s existing deployment with backend/AC_GA_EXP.gs and publish a new version.','សូមធ្វើបច្ចុប្បន្នភាព deployment ដើមជាមួយ backend/AC_GA_EXP.gs។'):'');
  }
  function ready(){const current=$('ga-diag-url').value.trim();$('ga-diag-apply').disabled=!verified||verified.url!==current||required.some(c=>!verified.capabilities.includes(c))||(current!==GA.gasUrl()&&!$('ga-diag-same').checked);}
  GA.openCloudDiagnostic=function(){
    let d=$('ga-cloud-diagnostic');
    if(!d){
      d=document.createElement('dialog');d.id='ga-cloud-diagnostic';d.style.cssText='width:min(640px,calc(100% - 28px));box-sizing:border-box;border:1px solid #94a3b8;border-radius:16px;padding:24px;color:#172b40;background:white;box-shadow:0 14px 60px #0f172a55;font:14px/1.6 system-ui;z-index:20000';
      d.innerHTML='<form method="dialog" style="float:right"><button aria-label="Close">✕</button></form><h2 style="margin:0 0 10px">'+T('雲端連線檢查','Cloud connection check','ពិនិត្យការតភ្ជាប់ Cloud')+'</h2><p>'+T('先確認這個瀏覽器正在連哪個部署。檢查不會上傳資料或更換網址。','Check which deployment this browser uses. A check does not upload data or change the URL.','ពិនិត្យ deployment ដែលកម្មវិធីនេះប្រើ ដោយមិនផ្ទុកទិន្នន័យឡើង។')+'</p><label>'+T('目前儲存的 Apps Script 網址','Saved Apps Script URL','តំណ Apps Script')+'<input id="ga-diag-url" type="url" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #94a3b8;border-radius:8px"></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button type="button" id="ga-diag-check">'+T('檢查上方網址','Check URL above','ពិនិត្យតំណខាងលើ')+'</button><button type="button" id="ga-diag-default">'+T('比較套件預設連線','Compare packaged connection','ប្រៀបធៀបការតភ្ជាប់ដើម')+'</button></div><pre id="ga-diag-result" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere;background:#edf3f8;padding:12px;border-radius:8px;font:13px/1.6 system-ui"></pre><label style="display:block;margin:12px 0"><input type="checkbox" id="ga-diag-same"> '+T('若更換網址，我已確認它連到原本的資料庫；本機資料會保留。','If changing the URL, I confirmed it uses the original database; local data is retained.','បើប្តូរតំណ ខ្ញុំបានបញ្ជាក់ថាវាប្រើទិន្នន័យដើម។')+'</label><button type="button" id="ga-diag-apply" disabled style="background:#17648d;color:white;padding:10px 16px;border:0;border-radius:8px">'+T('套用已驗證網址並重新載入','Apply verified URL & reload','អនុវត្តតំណ និងផ្ទុកឡើងវិញ')+'</button>';
      document.body.appendChild(d);
      $('ga-diag-url').oninput=()=>{verified=null;ready();};$('ga-diag-same').onchange=ready;
      $('ga-diag-check').onclick=async()=>{
        const thisRun=++run,url=$('ga-diag-url').value.trim();verified=null;ready();$('ga-diag-result').textContent=T('檢查中…','Checking…','កំពុងពិនិត្យ…');
        try{const info=await GA.backend.probe(url);if(thisRun!==run)return;verified=info;$('ga-diag-result').textContent=describe(info);ready();}
        catch(e){if(thisRun===run)$('ga-diag-result').textContent=e.message;}
      };
      $('ga-diag-default').onclick=async()=>{
        const thisRun=++run;$('ga-diag-result').textContent=T('比較中…','Comparing…','កំពុងប្រៀបធៀប…');
        const current=GA.gasUrl(),urls=current===GA.DEFAULT_GAS?[current]:[current,GA.DEFAULT_GAS];
        const answers=await Promise.allSettled(urls.map(url=>GA.backend.probe(url)));if(thisRun!==run)return;
        $('ga-diag-result').textContent=answers.map((a,i)=>(i===0?T('瀏覽器目前連線','Browser connection','ការតភ្ជាប់កម្មវិធី'):T('套件預設連線','Packaged connection','ការតភ្ជាប់ដើម'))+'\n'+(a.status==='fulfilled'?describe(a.value):a.reason.message)).join('\n\n')+'\n\n'+T('網址沒有變更。若目前連線沒有版本、預設連線有版本，請先確認原資料所在的部署，再將正確網址貼到上方檢查。','No URL was changed. If only the packaged connection reports a version, confirm the deployment holding your original data, then paste that URL above to check it.','តំណមិនត្រូវបានប្តូរ។ សូមបញ្ជាក់ deployment ទិន្នន័យដើម មុនអនុវត្តតំណថ្មី។');
      };
      $('ga-diag-apply').onclick=()=>{
        ready();if($('ga-diag-apply').disabled)return;
        const old=GA.gasUrl();
        if(old!==verified.url){localStorage.setItem('ga_previous_cloud_connection',JSON.stringify({url:old,at:new Date().toISOString()}));GA.saveCfg({gasUrl:verified.url,session:''});}else GA.saveCfg({gasUrl:verified.url});
        GA.backend.clear();location.reload();
      };
    }
    verified=null;++run;$('ga-diag-url').value=GA.gasUrl();$('ga-diag-same').checked=false;$('ga-diag-result').textContent=T('網頁版本：','Web version: ','កំណែគេហទំព័រ៖ ')+GA.PLATFORM_VERSION;ready();d.showModal();$('ga-diag-check').click();
  };
  function mount(){const login=document.querySelector('.login-box');if(login&&!$('ga-login-cloud-check')){const b=document.createElement('button');b.id='ga-login-cloud-check';b.type='button';b.textContent=T('☁ 檢查連線設定','☁ Check cloud connection','☁ ពិនិត្យការតភ្ជាប់');b.style.cssText='width:100%;margin-top:12px;padding:10px;border:1px solid #9caebe;border-radius:8px;background:#edf4fa;color:#23465f;font-weight:600';b.onclick=GA.openCloudDiagnostic;login.appendChild(b);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
