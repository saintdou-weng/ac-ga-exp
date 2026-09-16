/* Expense snapshots: one committed transaction, larger browser storage, revision check. */
(function (g) {
  'use strict';
  var dbPromise, revision = 0, queue = Promise.resolve(), loaded = false;
  var fallbackKey = 'ac_ga_exp_durable_v1';
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function conflict() { var e = new Error('另一個費用分頁已保存更新；請先匯出本頁備份，再重新載入 / Another Expense tab saved changes; export this page before reloading'); e.code = 'LOCAL_CONFLICT'; return e; }
  function db() {
    if (!g.indexedDB) return Promise.resolve(null);
    if (!dbPromise) dbPromise = new Promise(function (resolve, reject) {
      var done = false, r = g.indexedDB.open('ga-exp-expense-v1', 1);
      var timer = setTimeout(function () { done = true; reject(new Error('本機資料庫無法開啟，請關閉其他費用分頁後重試 / Local database is blocked')); }, 8000);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('state')) r.result.createObjectStore('state'); };
      r.onsuccess = function () { clearTimeout(timer); if (done) { r.result.close(); return; } r.result.onversionchange = function () { r.result.close(); dbPromise = null; }; resolve(r.result); };
      r.onerror = function () { clearTimeout(timer); reject(r.error); };
    }).catch(function (e) { dbPromise = null; throw e; });
    return dbPromise;
  }
  async function load() {
    var database = await db(), snapshot;
    if (database) snapshot = await new Promise(function (resolve, reject) {
      var tx = database.transaction('state', 'readonly'), r = tx.objectStore('state').get('current');
      r.onsuccess = function () { snapshot = r.result; };
      tx.oncomplete = function () { resolve(snapshot); }; tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Local read failed')); };
    });
    else snapshot = JSON.parse(localStorage.getItem(fallbackKey) || 'null');
    if (snapshot && (!snapshot.data || !Array.isArray(snapshot.data.txns) || !snapshot.data.exp3)) throw new Error('費用備份格式異常；原資料保留 / Invalid saved Expense snapshot');
    revision = snapshot ? snapshot.revision : 0; loaded = true;
    return snapshot ? copy(snapshot) : null;
  }
  function save(data) {
    var snapshot = copy(data);
    var task = queue.catch(function () {}).then(async function () {
      if (!loaded) throw new Error('費用資料尚未載入 / Expense is still loading');
      var database = await db(), next = { revision: revision + 1, savedAt: new Date().toISOString(), data: snapshot };
      if (database) await new Promise(function (resolve, reject) {
        var tx = database.transaction('state', 'readwrite'), st = tx.objectStore('state'), r = st.get('current'), failure;
        r.onsuccess = function () {
          if (((r.result || {}).revision || 0) !== revision) { failure = conflict(); tx.abort(); return; }
          st.put(next, 'current');
        };
        tx.oncomplete = resolve; tx.onerror = tx.onabort = function () { reject(failure || tx.error || new Error('Local save failed')); };
      });
      else {
        var previous = JSON.parse(localStorage.getItem(fallbackKey) || 'null');
        if (((previous || {}).revision || 0) !== revision) throw conflict();
        localStorage.setItem(fallbackKey, JSON.stringify(next));
      }
      revision = next.revision;
      return copy(next);
    });
    queue = task; return task;
  }
  async function backup(key, data) {
    var database = await db(), snapshot = copy(data);
    if (!database) { localStorage.setItem(key, JSON.stringify(snapshot)); return; }
    await new Promise(function (resolve, reject) {
      var tx = database.transaction('state', 'readwrite'); tx.objectStore('state').put(snapshot, 'backup:' + key);
      tx.oncomplete = resolve; tx.onerror = tx.onabort = function () { reject(tx.error || new Error('Backup failed')); };
    });
  }
  g.GAExpenseStore = { load: load, save: save, backup: backup, flush: function () { return queue; } };
})(window);
