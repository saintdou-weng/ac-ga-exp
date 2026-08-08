/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP · shared/ga-data.js   v1.0
   共用資料管理：匯出 / 匯入 / 新增 / 刪除 / 備份還原
   ─────────────────────────────────────────────────────────────────
   每個模組只要呼叫 GA.dataPanel({...}) 就有完整的資料管理面板：
     · 匯出 Excel（目前期間或全部）
     · 匯出 JSON 備份（含全部資料，可還原）
     · 匯入 JSON 備份（覆蓋或合併）
     · 刪除單筆 / 批次刪除 / 清空
     · 刪除前一律二次確認，清空需輸入確認字串
   ════════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';
var GA = global.GA; if (!GA) { console.error('ga-data.js 需先載入 ga-core.js'); return; }

GA.addDict({
  zh:{ dmTitle:'資料管理', dmExportXlsx:'匯出 Excel', dmExportJson:'匯出備份 JSON',
    dmImportJson:'匯入備份', dmClear:'清空全部資料', dmDelSel:'刪除選取',
    dmMerge:'合併（保留現有）', dmReplace:'覆蓋（清除現有）', dmRecords:'目前筆數',
    dmClearWarn:'此動作會刪除本機所有資料，無法復原。請輸入 DELETE 確認：',
    dmDone:'完成', dmCancelled:'已取消', dmBackupNote:'備份檔含全部資料，可用於還原或轉移到其他裝置。' },
  en:{ dmTitle:'Data Management', dmExportXlsx:'Export Excel', dmExportJson:'Export Backup',
    dmImportJson:'Import Backup', dmClear:'Clear All Data', dmDelSel:'Delete Selected',
    dmMerge:'Merge (keep existing)', dmReplace:'Replace (clear existing)', dmRecords:'Records',
    dmClearWarn:'This deletes ALL local data and cannot be undone. Type DELETE to confirm:',
    dmDone:'Done', dmCancelled:'Cancelled', dmBackupNote:'Backup contains all data; use to restore or move to another device.' },
  km:{ dmTitle:'គ្រប់គ្រងទិន្នន័យ', dmExportXlsx:'នាំចេញ Excel', dmExportJson:'នាំចេញបម្រុងទុក',
    dmImportJson:'នាំចូលបម្រុងទុក', dmClear:'លុបទិន្នន័យទាំងអស់', dmDelSel:'លុបអ្វីដែលបានជ្រើស',
    dmMerge:'បញ្ចូលគ្នា', dmReplace:'ជំនួស', dmRecords:'ចំនួនកំណត់ត្រា',
    dmClearWarn:'នេះនឹងលុបទិន្នន័យទាំងអស់។ វាយ DELETE ដើម្បីបញ្ជាក់៖',
    dmDone:'រួចរាល់', dmCancelled:'បានបោះបង់', dmBackupNote:'ឯកសារបម្រុងទុកមានទិន្នន័យទាំងអស់។' }
});

/* opt = {
     module:'fuel',
     data: function(){ return {DB:DB} },          // 要備份的完整資料
     restore: function(obj, mode){...},           // mode='merge'|'replace'
     clear: function(){...},                      // 清空
     count: function(){ return DB.length },
     exportXlsx: function(){...},                 // 選填：沿用模組既有匯出
     onChange: function(){...}                    // 資料變動後重繪
   } */
GA.dataPanel = function (opt) {
  opt = opt || {};
  var ov = document.createElement('div');
  ov.className = 'ga-ov on';
  var cnt = 0; try { cnt = opt.count ? opt.count() : 0; } catch (e) {}

  ov.innerHTML =
    '<div class="ga-modal" style="max-width:480px">' +
      '<div class="ga-modal-h"><b>🗂️ ' + GA.T('dmTitle') + '</b>' +
        '<span class="ga-modal-sub">' + GA.T('dmRecords') + ' ' + cnt + '</span>' +
        '<button class="ga-x" data-close>&times;</button></div>' +
      '<div class="ga-modal-b">' +
        (opt.exportXlsx ?
        '<button class="ga-btn" id="dm-xlsx" style="width:100%;margin-bottom:8px">📊 ' + GA.T('dmExportXlsx') + '</button>' : '') +
        '<button class="ga-btn" id="dm-json" style="width:100%;margin-bottom:8px">💾 ' + GA.T('dmExportJson') + '</button>' +
        '<div class="ga-fld" style="margin-top:12px">' +
          '<label>📥 ' + GA.T('dmImportJson') + '</label>' +
          '<div class="ga-seg" id="dm-mode" style="margin-bottom:8px">' +
            '<button data-m="merge" class="on">' + GA.T('dmMerge') + '</button>' +
            '<button data-m="replace">' + GA.T('dmReplace') + '</button>' +
          '</div>' +
          '<input type="file" id="dm-file" accept=".json" style="width:100%;font-size:12px">' +
        '</div>' +
        '<p class="ga-note">' + GA.T('dmBackupNote') + '</p>' +
        '<hr style="border:0;border-top:1px solid var(--ga-line);margin:14px 0">' +
        '<button class="ga-btn" id="dm-clear" style="width:100%;color:var(--ga-bad);border-color:#fecaca">🗑 ' + GA.T('dmClear') + '</button>' +
      '</div>' +
      '<div class="ga-modal-f"><button class="ga-btn" data-close>' + GA.T('close') + '</button></div>' +
    '</div>';
  document.body.appendChild(ov);

  function close(){ ov.remove(); }
  ov.querySelectorAll('[data-close]').forEach(function(b){ b.onclick = close; });
  ov.onclick = function(e){ if (e.target === ov) close(); };

  var mode = 'merge';
  ov.querySelectorAll('#dm-mode [data-m]').forEach(function (b) {
    b.onclick = function () {
      mode = b.getAttribute('data-m');
      ov.querySelectorAll('#dm-mode [data-m]').forEach(function(x){ x.classList.toggle('on', x===b); });
    };
  });

  var bx = ov.querySelector('#dm-xlsx');
  if (bx) bx.onclick = function () { try { opt.exportXlsx(); } catch (e) { GA.toast(e.message,'err'); } };

  ov.querySelector('#dm-json').onclick = function () {
    try {
      var payload = {
        _meta: { platform:'AC-GA-EXP', module:opt.module||'', version:GA.VERSION,
                 exportedAt: GA.ymd(new Date()) + ' ' + new Date().toTimeString().slice(0,8) },
        data: opt.data ? opt.data() : {}
      };
      var blob = new Blob([JSON.stringify(payload,null,1)], {type:'application/json'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'AC_GA_EXP_' + (opt.module||'backup') + '_' + GA.ymd(new Date()) + '.json';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      GA.toast('💾 ' + GA.T('dmDone'));
    } catch (e) { GA.toast(e.message, 'err'); }
  };

  ov.querySelector('#dm-file').onchange = function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function (e) {
      try {
        var obj = JSON.parse(e.target.result);
        var body = obj.data || obj;
        var mod = obj._meta && obj._meta.module;
        var msg = (mode === 'replace'
          ? '將以備份【覆蓋】目前資料，現有資料會被清除。'
          : '將把備份【合併】進目前資料。') +
          (mod && opt.module && mod !== opt.module ? '\n⚠️ 備份來自模組「' + mod + '」，與目前模組不同。' : '');
        GA.confirm(msg).then(function (ok) {
          if (!ok) { GA.toast(GA.T('dmCancelled')); return; }
          try {
            if (opt.restore) opt.restore(body, mode);
            GA.toast('📥 ' + GA.T('dmDone'));
            if (opt.onChange) opt.onChange();
            close();
          } catch (err) { GA.toast(err.message, 'err'); }
        });
      } catch (err) { GA.toast('備份檔格式錯誤：' + err.message, 'err'); }
    };
    rd.readAsText(f);
  };

  ov.querySelector('#dm-clear').onclick = function () {
    var ans = prompt(GA.T('dmClearWarn'));
    if (ans !== 'DELETE') { GA.toast(GA.T('dmCancelled')); return; }
    try {
      if (opt.clear) opt.clear();
      GA.toast('🗑 ' + GA.T('dmDone'));
      if (opt.onChange) opt.onChange();
      close();
    } catch (e) { GA.toast(e.message, 'err'); }
  };

  return { close: close };
};

})(window);
