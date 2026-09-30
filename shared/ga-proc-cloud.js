/* v3.9.21: durable PO/receipt state; compare the cloud state token before writing. */
(function(){
  'use strict';
  let pending=false,sequence=0,inFlight=null,token=null,initializedKey='';
  const message=(zh,en,km)=>GA.lang==='zh'?zh:(GA.lang==='km'&&km!=null&&km!==''?km:en);
  const key=()=> 'ga_proc_state_v3921_'+GA.fingerprint([GA.gasUrl(),cu&&(cu.uid||cu.id||cu.name)||'applicant']);
  const data=()=>JSON.parse(JSON.stringify({ords,poStatus,sigs,curMonth,itemSettings,poNumber,submitAckId,hiddenItems,customItems,recvLog}));
  function apply(s){ords=s.ords||{};poStatus=s.poStatus||'draft';sigs=s.sigs||{applicant:null,verifier:null,approver:null};if(s.curMonth!=null)curMonth=s.curMonth;itemSettings=s.itemSettings||itemSettings;poNumber=s.poNumber||null;submitAckId=s.submitAckId||'';hiddenItems=s.hiddenItems||{};customItems=s.customItems||[];recvLog=s.recvLog||[];}
  function persist(){localStorage.setItem(key(),JSON.stringify({data:data(),pending,token,at:new Date().toISOString()}));}
  function restore(){try{const cache=JSON.parse(localStorage.getItem(key())||'null');if(!cache||!cache.data)return false;apply(cache.data);pending=!!cache.pending;token=typeof cache.token==='string'?cache.token:null;return true;}catch(_){return false;}}
  function init(){if(initializedKey!==key()){pending=false;token=null;restore();initializedKey=key();}}
  function error(e){GA.cloud.set('err',e.message);return false;}
  async function fetchState(){
    const r=await GA.gasGet('getState');
    if(!r||r.ok!==true||!Object.prototype.hasOwnProperty.call(r,'data'))throw Error(message('雲端未回傳採購資料','Cloud returned no PO data envelope','ក្លោដមិនបានផ្ញើទិន្នន័យទិញមកវិញ'));
    if(typeof r.stateToken!=='string')throw Error(message('請更新本包後端，才能確認採購資料版本。','Update the packaged backend to verify the PO data version.','សូមធ្វើបច្ចុប្បន្នភាពផ្នែកខាងក្រោយ (backend) ដើម្បីផ្ទៀងផ្ទាត់កំណែទិន្នន័យទិញ។'));
    return r;
  }
  window.saveState=function(){
    init();pending=true;sequence++;
    try{persist();}catch(e){error(Error(message('本機保存失敗：','Local save failed: ','រក្សាទុកក្នុងឧបករណ៍មិនបាន៖')+e.message));}
    clearTimeout(_saveTimer);_saveTimer=setTimeout(function(){_saveTimer=null;window.saveStateCloud();},250);
  };
  window.saveStateCloud=function(){
    // Do not restore over a just-edited draft on the first explicit save.
    if(initializedKey!==key()){initializedKey=key();token=null;}
    pending=true;
    try{persist();}catch(e){return Promise.resolve(error(e));}
    if(inFlight)return inFlight.then(function(ok){return pending&&ok?window.saveStateCloud():ok;});
    const snapshot=data(),rev=sequence;
    inFlight=(async function(){
      try{
        GA.cloud.mount('#ga-cloud');GA.cloud.set('sync');
        if(token===null){const cloud=await fetchState();if(cloud.data){throw Error(message('雲端已有採購資料，本機尚未核對版本。請按下載核對；待傳內容會先備份。','Cloud PO data exists and has not been reconciled. Use Download to review it; pending local changes are backed up first.','ក្លោដមានទិន្នន័យទិញដែលឧបករណ៍នេះមិនទាន់ពិនិត្យ។ សូមចុចទាញយកដើម្បីប្រៀបធៀប ការផ្លាស់ប្ដូររង់ចាំនឹងបម្រុងទុកជាមុន។'));}token=cloud.stateToken;}
        const r=await GA.gasPost('saveState',snapshot,{stateToken:token});
        if(!r||r.ok!==true||typeof r.stateToken!=='string')throw Error(message('雲端未確認保存版本；待傳資料保留。','Cloud did not confirm the saved version; changes remain pending.','ក្លោដមិនបានបញ្ជាក់កំណែដែលបានរក្សាទុក ទិន្នន័យរង់ចាំនៅតែរក្សាទុក។'));
        token=r.stateToken;
        if(rev===sequence&&JSON.stringify(snapshot)===JSON.stringify(data()))pending=false;
        persist();GA.cloud.set(pending?'sync':'up',pending?message('仍有待傳變更','More changes pending','នៅមានការផ្លាស់ប្ដូររង់ចាំផ្ទុកឡើង'):message('雲端已確認保存','Cloud save confirmed','ក្លោដបានបញ្ជាក់ការរក្សាទុក'));return true;
      }catch(e){if(e.code==='STATE_CONFLICT')e.message=message('雲端採購資料已更新，已停止覆寫。請按下載核對；待傳內容會先備份。','Cloud PO data changed. Overwrite blocked. Use Download to review; pending local changes are backed up first.','ទិន្នន័យទិញក្នុងក្លោដត្រូវបានកែពីកន្លែងផ្សេង ការសរសេរជាន់ត្រូវបានបញ្ឈប់។ សូមចុចទាញយកដើម្បីប្រៀបធៀប ការផ្លាស់ប្ដូររង់ចាំនឹងបម្រុងទុកជាមុន។');return error(e);}
    })().finally(()=>{inFlight=null;});return inFlight;
  };
  window.loadStateCloud=async function(){
    init();
    if(pending||inFlight)return error(Error(message('本機有待傳資料，下載不會直接覆蓋。請用工具列下載核對。','Local changes are pending. Use the Download toolbar to review before replacing them.','ឧបករណ៍នេះមានទិន្នន័យរង់ចាំ ការទាញយកមិនសរសេរជាន់ដោយផ្ទាល់ទេ។ សូមប្រើប៊ូតុងទាញយកលើរបារឧបករណ៍ដើម្បីប្រៀបធៀប។')));
    const rev=sequence;
    try{const r=await fetchState();if(rev!==sequence||pending)return false;if(r.data)apply(r.data);token=r.stateToken;persist();return true;}catch(e){return error(e);}
  };
  window.procCloudDown=async function(){
    init();if(inFlight){GA.toast(message('請等目前上傳完成再核對。','Wait for the upload to finish before reviewing.','សូមរង់ចាំការផ្ទុកឡើងបច្ចុប្បន្នបញ្ចប់ មុននឹងពិនិត្យ។'));return;}
    try{
      // Fetch first: an unavailable cloud must never discard pending data.
      const r=await fetchState();if(!r.data){GA.toast(message('雲端目前沒有採購資料，本機資料保留。','Cloud has no PO data; local data is retained.','មិនទាន់មានទិន្នន័យទិញក្នុងក្លោដ ទិន្នន័យក្នុងឧបករណ៍នៅតែរក្សាទុក។'));return;}
      if(pending){
        if(!confirm(message('本機有待傳變更。下載本機備份並切換顯示雲端資料以便核對？取消可繼續保留本機編輯。','Local changes are pending. Download a local backup and show the cloud state for review? Cancel to keep editing locally.','ឧបករណ៍នេះមានការផ្លាស់ប្ដូរមិនទាន់ផ្ញើ។ ទាញយកច្បាប់បម្រុង ហើយប្ដូរទៅមើលទិន្នន័យក្លោដដើម្បីប្រៀបធៀប? បោះបង់ = រក្សាការកែក្នុងឧបករណ៍។')))return;
        const backup={data:data(),token,at:new Date().toISOString()};localStorage.setItem(key()+'_before_download',JSON.stringify(backup));
        const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='GA_PO_pending_backup_'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      apply(r.data);pending=false;token=r.stateToken;persist();render();GA.cloud.set('down');GA.toast(message('已下載雲端資料，請核對品項與收發紀錄。','Cloud data loaded. Review items and receipt/issue records.','បានទាញយកទិន្នន័យក្លោដ សូមពិនិត្យមុខទំនិញ និងកំណត់ត្រាទទួល/បើកចេញ។'));
    }catch(e){error(e);GA.toast(e.message);}
  };
  function retry(){if(!cu)return;if(pending)window.saveStateCloud();else procAutoPull('backend-ready');}
  window.addEventListener('ga-backend-ready',retry);
  window.addEventListener('online',function(){if(pending)setTimeout(retry,180);});
  window.procHasPendingState=()=>pending;
})();
