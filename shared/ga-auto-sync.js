/* AC-GA-EXP Auto Sync v1.0 — 2026-08-26
 * Adapted from AC-HRA-PAY Auto Sync v1.2 behavior.
 *
 * Goals:
 * - local-first load + startup/network/app-resume reconcile
 * - cloud pull first, then module push
 * - pending sync survives offline/reload in localStorage
 * - import / Telegram / review / approval start almost immediately
 * - normal add/edit/delete stays debounced
 * - compact visible Pending / Syncing / Synced / Offline / Retry badge
 * - manual cloud Upload / Download buttons remain available
 */
(function(g){
  'use strict';
  if(g.GAAutoSync)return;

  var VERSION='1.0', C={}, PFX='gaexp:auto2:';
  function online(){try{return !('onLine' in navigator)||navigator.onLine;}catch(_){return true;}}
  function read(k){try{return JSON.parse(localStorage.getItem(PFX+k)||'null');}catch(_){return null;}}
  function write(k,v){try{localStorage.setItem(PFX+k,JSON.stringify(v));}catch(_){} }
  function clear(k){try{localStorage.removeItem(PFX+k);}catch(_){} }
  function mergeExtra(a,b){var o={};Object.keys(a||{}).forEach(function(k){o[k]=a[k];});Object.keys(b||{}).forEach(function(k){if(b[k]!==undefined&&b[k]!==null&&b[k]!=='')o[k]=b[k];});return o;}
  function hhmm(){try{return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});}catch(_){return '';}}
  function lang(){try{return (g.GA&&GA.lang)||localStorage.getItem('ga_lang')||'zh';}catch(_){return 'zh';}}
  function tr(zh,en,km){var l=lang();return l==='en'?en:l==='km'?km:zh;}

  function reasonDelay(reason,requested){
    var r=String(reason||'').toLowerCase(),d=(requested==null?900:Number(requested));
    if(!isFinite(d)||d<0)d=900;
    if(/^(import|telegram|telegram-summary|telegram-review|telegram-approval|approval|review|submit|submit-review|send-review|restore|file-change|file-delete)$/.test(r))return Math.min(d,60);
    if(/^(batch-save|batch-delete|batch-receive|batch-issue|po-receive|submitselected)$/.test(r))return Math.min(d,250);
    return d;
  }

  function findAnchor(s){
    if(!g.document)return null;
    var a=s.opts&&s.opts.anchor;
    if(a){try{var e=typeof a==='string'?document.querySelector(a):a;if(e)return e;}catch(_){}}
    var cloud=document.getElementById('ga-cloud');if(cloud)return cloud;
    var ids=['btn-cloud-down','btn-cloud-up','cloud-dn-btn','cloud-up-btn','mt-cloud-dn-btn','mt-cloud-up-btn'];
    for(var i=0;i<ids.length;i++){var x=document.getElementById(ids[i]);if(x)return x;}
    try{return document.querySelector('[onclick*="cloudDownload"],[onclick*="cloudDown"],[onclick*="cloudUpload"],[onclick*="cloudUp"]');}catch(_){return null;}
  }
  function ensureBadge(s){
    if(!g.document)return null;
    var id='ga-auto-sync-state-'+s.key,el=document.getElementById(id);if(el)return el;
    var anchor=findAnchor(s);if(!anchor||!anchor.parentNode)return null;
    el=document.createElement('span');el.id=id;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.style.cssText='display:inline-flex;align-items:center;white-space:nowrap;font-size:11px;line-height:1;padding:5px 8px;border-radius:999px;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;margin-left:6px;vertical-align:middle;max-width:180px;overflow:hidden;text-overflow:ellipsis;';
    try{anchor.insertAdjacentElement('afterend',el);}catch(_){anchor.parentNode.appendChild(el);}return el;
  }
  function stateText(state,detail){
    if(state==='dirty')return tr('☁ 待同步','☁ Pending','☁ រង់ចាំ Sync');
    if(state==='syncing')return tr('☁ 同步中…','☁ Syncing…','☁ កំពុង Sync…');
    if(state==='synced')return tr('✅ 雲端已同步','✅ Cloud synced','✅ Cloud បាន Sync')+(detail?' '+detail:'');
    if(state==='offline')return tr('☁ 離線待傳','☁ Offline pending','☁ Offline រង់ចាំ');
    if(state==='retry')return tr('⚠ 雲端待重試','⚠ Cloud retry','⚠ Cloud រង់ចាំសាកឡើងវិញ');
    if(state==='checked')return tr('☁ 已檢查','☁ Checked','☁ បានពិនិត្យ')+(detail?' '+detail:'');
    return tr('☁ 自動同步','☁ Auto sync','☁ Sync ស្វ័យប្រវត្តិ');
  }
  function setState(s,state,detail){
    s.state=state;s.stateDetail=detail||'';var el=ensureBadge(s);
    if(el){el.textContent=stateText(state,detail);var bg='#f1f5f9',fg='#64748b',bd='#e2e8f0';
      if(state==='syncing'){bg='#eff6ff';fg='#2563eb';bd='#bfdbfe';}
      else if(state==='synced'||state==='checked'){bg='#ecfdf5';fg='#047857';bd='#a7f3d0';}
      else if(state==='dirty'){bg='#fffbeb';fg='#b45309';bd='#fde68a';}
      else if(state==='offline'||state==='retry'){bg='#fff7ed';fg='#c2410c';bd='#fed7aa';}
      el.style.background=bg;el.style.color=fg;el.style.borderColor=bd;el.title='AC-GA-EXP Auto Sync · '+stateText(state,detail);
    }
    try{g.dispatchEvent(new CustomEvent('ga-autosync-state',{detail:{key:s.key,state:state,detail:detail||'',at:Date.now()}}));}catch(_){}
  }
  function install(opts){
    opts=opts||{};var key=String(opts.key||'').trim();if(!key)throw new Error('GAAutoSync key required');
    if(C[key]){C[key].opts=opts;ensureBadge(C[key]);return C[key];}
    var s=C[key]={key:key,opts:opts,busy:false,timer:null,queued:null,lastRun:0,state:'idle',stateDetail:''};ensureBadge(s);
    function canSync(){try{return typeof s.opts.canSync==='function'?!!s.opts.canSync():true;}catch(_){return false;}}
    async function run(reason,extra){
      reason=reason||'reconcile';extra=extra||{};
      if(s.busy){s.queued={reason:reason,extra:mergeExtra(s.queued&&s.queued.extra,extra)};return false;}
      var priorPending=read(key);
      if(!online()||!canSync()){write(key,{reason:reason,extra:extra,at:Date.now()});setState(s,online()?'retry':'offline');return false;}
      s.busy=true;s.lastRun=Date.now();setState(s,'syncing');
      try{
        if(typeof s.opts.pull==='function'){
          try{await s.opts.pull({silent:true,auto:true,reason:reason});}catch(e){if(s.opts.log!==false)console.warn('[GAAutoSync pull '+key+']',e);}
        }
        var ok=true;
        if(typeof s.opts.push==='function'){
          var po=mergeExtra({silent:true,auto:true,reason:reason},extra),ctx={key:key,reason:String(reason||''),at:Date.now()};
          g.__GA_SYNC_CONTEXT=ctx;try{var r=await s.opts.push(po);ok=(r!==false);}finally{if(g.__GA_SYNC_CONTEXT===ctx)g.__GA_SYNC_CONTEXT=null;}
        }
        if(ok){clear(key);setState(s,'synced',hhmm());}
        else if(!priorPending&&/^(startup-reconcile|reconcile|resume|pageshow|network-restored)$/.test(String(reason||''))){clear(key);setState(s,'checked',hhmm());}
        else{write(key,{reason:reason,extra:extra,at:Date.now()});setState(s,'retry');}
        return ok;
      }catch(e){write(key,{reason:reason,extra:extra,at:Date.now()});setState(s,'retry');if(s.opts.log!==false)console.warn('[GAAutoSync '+key+']',e);return false;}
      finally{s.busy=false;if(s.queued){var q=s.queued;s.queued=null;schedule(q.reason,q.extra,250);}}
    }
    function schedule(reason,extra,delay){
      reason=reason||'change';extra=extra||{};var old=read(key)||{};write(key,{reason:reason,extra:mergeExtra(old.extra,extra),at:Date.now()});setState(s,online()?'dirty':'offline');
      if(s.timer)clearTimeout(s.timer);var wait=reasonDelay(reason,delay);s.timer=setTimeout(function(){s.timer=null;var p=read(key)||{};run(p.reason||reason,mergeExtra(p.extra,extra));},wait);return true;
    }
    s.run=run;s.schedule=schedule;
    var startup=function(){var p=read(key)||{};setTimeout(function(){run(p.reason||'startup-reconcile',p.extra||{});},Number(opts.startDelay)||450);};
    if(document.readyState==='complete'||document.readyState==='interactive')startup();else window.addEventListener('load',startup,{once:true});
    window.addEventListener('online',function(){var p=read(key)||{};setTimeout(function(){run(p.reason||'network-restored',p.extra||{});},120);});
    document.addEventListener('visibilitychange',function(){if(!document.hidden&&online()){var p=read(key)||{};setTimeout(function(){run(p.reason||'resume',p.extra||{});},150);}});
    window.addEventListener('pageshow',function(e){if(e&&e.persisted&&online()){var p=read(key)||{};setTimeout(function(){run(p.reason||'pageshow',p.extra||{});},150);}});
    try{if(g.GA&&GA.on)GA.on('lang',function(){if(s.state)setState(s,s.state,s.stateDetail);});}catch(_){}
    return s;
  }
  function schedule(key,reason,extra,delay){var s=C[key];if(!s){write(key,{reason:reason||'change',extra:extra||{},at:Date.now()});return false;}return s.schedule(reason,extra,delay);}
  function run(key,reason,extra){var s=C[key];return s?s.run(reason,extra):Promise.resolve(false);}
  function pending(key){return read(key);}function state(key){var s=C[key];return s?{state:s.state,detail:s.stateDetail,lastRun:s.lastRun}:null;}
  g.GAAutoSync={version:VERSION,install:install,schedule:schedule,markDirty:schedule,run:run,flush:run,pending:pending,state:state};
})(window);
