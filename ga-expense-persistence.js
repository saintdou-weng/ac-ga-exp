/* Loaded after the Expense model, before boot or cloud reconciliation. */
var EXP_STORAGE_READY=false, EXP_STORAGE_FAILED=false, EXP_SAVE_COUNT=0, EXP_LOCAL_GEN=0;
var EXP_PENDING=false, EXP_SAVED_COUNT=0, EXP_SAVED_AT='', EXP_DATA_READY, EXP_IMPORT_BUSY=false;
var EXP_IMPORT_REPORT=[], EXP_LAST_ERROR='';
function expenseSnapshot() {
  return {schema:5,txns:txns,exp3:EXP3,cats:CATMETA,budgets:budgets,pending:EXP_PENDING,
    importReport:EXP_IMPORT_REPORT,ui:pc?{tab:activeTab,type:currentState().type,key:currentState().key}:loadExpenseUI()};
}
function expenseStatusRefresh(){if(pc&&document.getElementById('exp-view'))render();}
function expenseMarkChanged(){EXP_PENDING=true;EXP_LOCAL_GEN++;}
async function persistExpense(pending) {
  if(!EXP_STORAGE_READY)return false;
  if(pending!==false)expenseMarkChanged();
  var gen=EXP_LOCAL_GEN, snapshot=expenseSnapshot();EXP_SAVE_COUNT++;EXP_LAST_ERROR='';expenseStatusRefresh();
  try {
    var committed=await GAExpenseStore.save(snapshot);
    EXP_SAVED_COUNT=['repair','purchase','general'].reduce(function(n,k){return n+(committed.data.exp3[k]||[]).length;},committed.data.txns.length);
    EXP_SAVED_AT=committed.savedAt;
    if(gen===EXP_LOCAL_GEN)EXP_STORAGE_FAILED=false;
    // Only release redundant Expense keys AFTER their complete replacement committed.
    [LS_EXP3,LS_TXN,LS_CAT,LS_BGT].forEach(function(k){try{localStorage.removeItem(k);}catch(_){}});
    try{localStorage.setItem(LS_LOCAL_TS,EXP_SAVED_AT);}catch(_){}
    return true;
  } catch(e) {
    EXP_STORAGE_FAILED=true;EXP_LAST_ERROR=e.message||String(e);
    GA.toast(GA.T('expNotStored')+' · '+EXP_LAST_ERROR,'err');return false;
  } finally {EXP_SAVE_COUNT--;expenseStatusRefresh();}
}
saveExp3=function(){return persistExpense(true);};
saveTxns=function(){return persistExpense(true);};
saveCats=function(){return persistExpense(true);};
saveBudgets=function(){return persistExpense(true);};
expenseLocalSavedLabel=function(){
  if(!EXP_STORAGE_READY)return expMsgText('正在讀取本機費用資料…','Loading saved expenses…','កំពុងអានចំណាយ…',GA.lang);
  if(EXP_STORAGE_FAILED)return '⚠️ '+GA.T('expNotStored');
  if(EXP_SAVE_COUNT)return expMsgText('正在保存，請稍候…','Saving, please wait…','កំពុងរក្សាទុក…',GA.lang);
  var tm=EXP_SAVED_AT?new Date(EXP_SAVED_AT).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}):'';
  return expMsgText('📱 本機已保存 ','📱 Local saved ','📱 បានរក្សាទុក ',GA.lang)+EXP_SAVED_COUNT+' '+GA.T('expRows')+(tm?' · '+tm:'')+(EXP_PENDING?expMsgText(' · 待雲端同步',' · Cloud sync pending',' · រង់ចាំ Cloud Sync',GA.lang):'');
};
async function retryExpenseSave(){if(await persistExpense(true))scheduleExpenseAutoCloudSync('retry-save');}
function exportExpenseBackup(){var blob=new Blob([JSON.stringify(expenseSnapshot())],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='GA_EXP_Expense_Backup_'+GA.ymd(new Date())+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}
async function initExpensePersistence(){
  try {
    var saved=await GAExpenseStore.load();
    if(saved){var d=saved.data;txns=d.txns;EXP3=d.exp3;CATMETA=d.cats||{};budgets=d.budgets||{};EXP_PENDING=!!d.pending;EXP_IMPORT_REPORT=d.importReport||[];EXP_SAVED_AT=saved.savedAt;EXP_SAVED_COUNT=allRows().length;if(d.ui&&!localStorage.getItem(LS_UI)){activeTab=d.ui.tab||'summary';try{localStorage.setItem(LS_UI,JSON.stringify(d.ui));}catch(_){}}}
    else {loadData();EXP_PENDING=allRows().length>0;}
    ensureExpenseModel(); // No writes until restoration has finished.
    EXP_STORAGE_READY=true;
    if(!saved && !(await persistExpense(false)))throw new Error(EXP_LAST_ERROR);
    return true;
  } catch(e){EXP_STORAGE_FAILED=true;EXP_LAST_ERROR=e.message||String(e);return false;}
}
window.addEventListener('beforeunload',function(e){if(EXP_SAVE_COUNT||EXP_STORAGE_FAILED||EXP_IMPORT_BUSY){e.preventDefault();e.returnValue='';}});
var originalExpenseUI=saveExpenseUI;
saveExpenseUI=function(){originalExpenseUI();};
