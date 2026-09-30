/* v3.9.24: one item catalog, explicit draft rows and safe receipt selection. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = (zh, en, km) => lang === 'zh' ? zh : lang === 'km' ? km : en;
  const esc = recvEsc;
  const norm = v => String(v || '').trim().toLowerCase();
  const lines = type => type === 'issue' ? _recvIssueLines : _recvBatchLines;
  const active = () => (items || []).filter(it => !it.archived);
  let itemTarget = null, savingItem = false, savingBatch = false;
  const poFields = ['poId', 'poNumber', 'poNo', 'poPeriod', 'poItemIndex', 'poSourceItemId', 'poItemId'];
  function clearPo(row) {
    poFields.forEach(k => delete row[k]); row.poIndex = '';
    if (row.purchaseSource === 'monthly_po') { row.purchaseSource = 'other'; row.sourceRef = ''; }
  }
  function blank(type) {
    return { date: localYMD(), type, itemId: '', qty: '', purchaseSource: 'other', sourceRef: '',
      poIndex: '', dept: type === 'receive' ? settings.dept || 'GA/Admin' : '', requester: '', inspector: '', remarks: '' };
  }
  function render(type) { return type === 'issue' ? renderIssueBatchTab() : renderReceiveBatchTab(); }
  function label(it) {
    const v = recvItemVersionFor(it, recvCurrentMonth());
    return [it.name, v.size || it.size, it.unit, v.brand || it.brand].filter(Boolean).join(' · ');
  }
  function options(row) {
    const q = norm(row._itemQuery);
    return '<option value="">' + T('請選擇物品', 'Select an item', 'សូមជ្រើសទំនិញ') + '</option>' + active()
      .filter(it => String(it.id) === String(row.itemId) || !q || norm(label(it) + ' ' + it.category).includes(q))
      .map(it => '<option value="' + esc(it.id) + '"' + (String(it.id) === String(row.itemId) ? ' selected' : '') + '>' + esc(label(it)) + '</option>').join('');
  }
  function metadata(row) {
    const it = recvItemById(row.itemId); if (!it) return '';
    const v = recvItemVersionFor(it, String(row.date || localYMD()).slice(0, 7));
    return T('單位', 'Unit', 'ឯកតា') + ': ' + (it.unit || '—') + ' · ' + T('規格', 'Spec', 'លក្ខណៈ') + ': ' + (v.size || it.size || '—') +
      ' · ' + T('單價', 'Unit price', 'តម្លៃឯកតា') + ': $' + GA.num(v.unitPrice).toFixed(2) + ' · ' +
      T('目前庫存', 'Current stock', 'ស្តុកបច្ចុប្បន្ន') + ': ' + GA.num(it.stock);
  }
  window.recvCatalogSearch = function (type, index, value, field) {
    const row = lines(type)[index]; if (!row) return;
    row._itemQuery = value; const select = field.querySelector('select'); select.innerHTML = options(row); select.value = row.itemId || '';
    const found = active().filter(it => norm(label(it) + ' ' + it.category).includes(norm(value))).length;
    field.querySelector('[data-catalog-search-status]').textContent = value && !found ?
      T('找不到物品？按「新增物品」先建檔。', 'Item not found? Choose New item to create it.', 'រកមិនឃើញទំនិញ? ចុច បន្ថែមទំនិញ។') : '';
  };
  function decorate(type) {
    const root = $('receive-content'); if (!root) return;
    const actions = root.querySelector('.recv-v3912-actions');
    if (actions) {
      const add = actions.querySelector('button'), save = actions.querySelectorAll('button')[1];
      if (add) add.textContent = '＋ ' + (type === 'issue' ? T('新增發料列', 'Add issue line', 'បន្ថែមជួរចេញ') : T('新增收貨列', 'Add receipt line', 'បន្ថែមជួរទទួល'));
      if (save) { save.disabled = !lines(type).length; save.textContent = T('儲存並同步', 'Save & sync', 'រក្សាទុក និង Sync'); }
      const catalog = document.createElement('button'); catalog.className = 'nav-btn'; catalog.type = 'button';
      catalog.textContent = '📦 ' + T('物品管理', 'Item catalog', 'គ្រប់គ្រងទំនិញ'); catalog.onclick = () => recvOpenCatalog(); actions.appendChild(catalog);
      const addItem = document.createElement('button'); addItem.className = 'nav-btn'; addItem.type = 'button';
      addItem.textContent = '＋ ' + T('新增物品', 'New item', 'បន្ថែមទំនិញ'); addItem.onclick = () => recvNewCatalogItem(type, -1); actions.appendChild(addItem);
      if (type === 'receive') {
        const po = document.createElement('button'); po.className = 'nav-btn'; po.type = 'button'; po.textContent = '🧾 ' + T('Monthly PO 收貨', 'Monthly PO receiving', 'ទទួល Monthly PO');
        po.onclick = () => setReceiveTab('po'); actions.appendChild(po);
      }
    }
    const list = root.querySelector('.recv-edit-list');
    if (list && !lines(type).length) {
      list.innerHTML = '<div class="recv-catalog-empty">' + T('目前沒有待儲存的列。按「新增收貨列／新增發料列」開始；新物品請先建檔。',
        'No unsaved lines. Add a receipt or issue line to start; create missing items in the catalog.', 'មិនមានជួររង់ចាំរក្សាទុក។ បន្ថែមជួរទទួល ឬចេញ ហើយបង្កើតទំនិញដែលខ្វះ។') + '</div>';
    }
    root.querySelectorAll('.recv-edit-card').forEach((card, index) => {
      const row = lines(type)[index]; if (!row) return;
      const remove = card.querySelector('.head .del'); if (remove) {
        remove.textContent = T('移除此列', 'Remove line', 'លុបជួរនេះ'); remove.title = T('只移除未儲存列，不刪除物品或歷史', 'Remove this unsaved line only', 'លុបតែជួរមិនទាន់រក្សាទុក');
      }
      const field = card.querySelector('.itemfield'), select = field && field.querySelector('select');
      if (field && select) {
        select.innerHTML = options(row); select.value = row.itemId || '';
        field.querySelector('label').textContent = T('物品', 'Item', 'ទំនិញ');
        const search = document.createElement('input'); search.type = 'search'; search.value = row._itemQuery || '';
        search.placeholder = T('搜尋名稱／規格', 'Search name / specification', 'ស្វែងរកឈ្មោះ / លក្ខណៈ'); search.setAttribute('aria-label', search.placeholder);
        search.oninput = () => recvCatalogSearch(type, index, search.value, field); field.insertBefore(search, select);
        const info = document.createElement('div'); info.className = 'recv-catalog-details'; info.textContent = metadata(row); field.appendChild(info);
        const status = document.createElement('div'); status.dataset.catalogSearchStatus = ''; status.setAttribute('role', 'status'); field.appendChild(status);
        const create = document.createElement('button'); create.type = 'button'; create.className = 'nav-btn recv-new-item';
        create.textContent = '＋ ' + T('找不到？新增物品', 'Not listed? New item', 'មិនមាន? បន្ថែមទំនិញ'); create.onclick = () => recvNewCatalogItem(type, index); field.appendChild(create);
      }
      const qty = card.querySelector('input[type="number"]'); if (qty) { qty.step = '0.0001'; qty.min = '0.0001'; qty.value = row.qty == null ? '' : row.qty; }
      if (type === 'receive') {
        const source = card.querySelector('.sourcebar select'); if (source) {
          const monthly = source.querySelector('option[value="monthly_po"]'); if (monthly && row.purchaseSource !== 'monthly_po') monthly.remove();
          source.onchange = function () { clearPo(row); row.purchaseSource = this.value; render('receive'); };
        }
        const oldPo = card.querySelector('details select'); if (oldPo) {
          const box = oldPo.parentElement; box.replaceChildren();
          const link = document.createElement('button'); link.type = 'button'; link.className = 'nav-btn';
          link.textContent = T('月購收貨請開啟 Monthly PO', 'Receive approved purchases in Monthly PO', 'ទទួលការទិញដែលអនុម័តនៅ Monthly PO'); link.onclick = () => setReceiveTab('po'); box.appendChild(link);
        }
        const summary = card.querySelector('details summary'); if (summary) summary.textContent = T('更多：部門／經手人／檢查人／備註', 'More: department / handler / inspector / notes', 'បន្ថែម៖ ផ្នែក / អ្នកកាន់ / អ្នកត្រួតពិនិត្យ / កំណត់ចំណាំ');
      }
    });
  }
  const receiveRender = window.renderReceiveBatchTab, issueRender = window.renderIssueBatchTab;
  window.renderReceiveBatchTab = function () { const out = receiveRender.apply(this, arguments); decorate('receive'); return out; };
  window.renderIssueBatchTab = function () { const out = issueRender.apply(this, arguments); decorate('issue'); return out; };
  window.addReceiveBatchLine = function () { _recvBatchLines.push(blank('receive')); render('receive'); };
  window.addIssueBatchLine = function () { _recvIssueLines.push(blank('issue')); render('issue'); };
  window.removeReceiveBatchLine = function (i) { _recvBatchLines.splice(i, 1); render('receive'); };
  window.removeIssueBatchLine = function (i) { _recvIssueLines.splice(i, 1); render('issue'); };
  window.recvBatchItemChange = function (i, value) {
    const row = _recvBatchLines[i]; if (!row) return; clearPo(row); row.itemId = value; render('receive');
  };
  const priorSet = window.recvBatchSet;
  window.recvBatchSet = function (i, key, value) {
    const row = _recvBatchLines[i]; if (!row) return;
    if (key === 'purchaseSource' && value !== row.purchaseSource) clearPo(row);
    return priorSet(i, key, value);
  };
  const priorPoChange = window.recvBatchPoChange;
  window.recvBatchPoChange = function (i, value) {
    const row = _recvBatchLines[i]; if (!row) return;
    if (value === '') { clearPo(row); render('receive'); return; }
    priorPoChange(i, value);
    const match = _recvPoFlat[value]; if (match && row.poId === match.po.poId) row.poSourceItemId = recvPoSourceItemId(match);
  };
  function validate(type) {
    const batch = lines(type), seen = new Set(); if (!batch.length) return false;
    for (let i = 0; i < batch.length; i++) {
      const r = batch[i], it = recvItemById(r.itemId), d = GA.parseYMD(r.date); let error = '';
      if (!it || it.archived) error = T('請選擇物品，找不到時先新增物品。', 'Select an item, or create it first.', 'សូមជ្រើសទំនិញ ឬបង្កើតជាមុន។');
      else if (!d || GA.ymd(d) !== r.date) error = T('請填有效日期。', 'Enter a valid date.', 'សូមបញ្ចូលកាលបរិច្ឆេទត្រឹមត្រូវ។');
      else { try { if (GAPO.qty(r.qty) <= 0) throw Error(); } catch (_) { error = T('數量須大於零，最多四位小數。', 'Quantity must be positive, with up to four decimals.', 'បរិមាណត្រូវធំជាងសូន្យ និងមានខ្ទង់ទសភាគយ៉ាងច្រើនបួន។'); } }
      if (!error && type === 'issue' && !String(r.dept || '').trim()) error = T('請填領用部門。', 'Enter the receiving department.', 'សូមបំពេញផ្នែកទទួល។');
      if (!error && type === 'receive' && (r.purchaseSource === 'monthly_po' || r.poId || r.poNumber)) error =
        T('請到「Monthly PO 收貨」選擇核可單據；一般收貨列不代替 PO 核對。', 'Use Monthly PO receiving to select an approved order.', 'សូមជ្រើស PO ដែលបានអនុម័តនៅ ទទួល Monthly PO។');
      const key = JSON.stringify([r.itemId, r.date, Number(r.qty), norm(r.dept), r.purchaseSource || 'other', r.sourceRef || '']);
      if (!error && seen.has(key)) error = T('本批有重複的列，請移除或調整。', 'This batch contains an identical line. Remove or correct it.', 'មានជួរស្ទួនក្នុងក្រុមនេះ។ សូមលុប ឬកែ។');
      if (error) { toast(T('第 ', 'Line ', 'ជួរ ')+(i+1)+'：'+error, 'error'); return false; } seen.add(key);
    }
    return true;
  }
  function guardedSave(type, original) {
    return function () {
      if (savingBatch || !validate(type)) return false;
      savingBatch = true; window._recvStrictSave = (window._recvStrictSave || 0) + 1; /* v3.9.25: saveLocal throws here so the batch rolls back */
      const snapshot = JSON.stringify({ items, records }), draft = lines(type).slice();
      try { const result = original.apply(this, arguments); return result === false ? false : !lines(type).length; }
      catch (e) {
        const old = JSON.parse(snapshot); items = old.items; records = old.records;
        if (type === 'receive') _recvBatchLines = draft; else _recvIssueLines = draft;
        render(type); toast(T('尚未儲存，請保留此頁並重試：', 'Not saved. Keep this page open and retry: ', 'មិនទាន់រក្សាទុក។ សូមទុកទំព័រនេះ ហើយសាកម្ដងទៀត៖ ')+e.message, 'error'); return false;
      } finally { savingBatch = false; window._recvStrictSave = Math.max(0, (window._recvStrictSave || 1) - 1); }
    };
  }
  window.saveReceiveBatchLines = guardedSave('receive', window.saveReceiveBatchLines);
  window.saveIssueBatchLines = guardedSave('issue', window.saveIssueBatchLines);
  window.recvOpenCatalog = function () { showPage('items'); $('search-items').focus(); $('page-items').scrollIntoView({ block: 'start' }); };
  const priorAdd = window.showAddForm, priorClose = window.closeForm;
  window.showAddForm = function () { itemTarget = null; priorAdd.apply(this, arguments); formHelp(); };
  window.closeForm = function () { itemTarget = null; priorClose.apply(this, arguments); };
  function formHelp() {
    let help = $('recv-item-form-help'); if (!help) { help = document.createElement('p'); help.id = 'recv-item-form-help'; $('item-form').querySelector('.form-grid').before(help); }
    help.textContent = T('先填物品名稱、分類、規格和單位；建檔不增加庫存。實際收到多少，回收貨列填數量。',
      'Enter the name, category, specification and unit. Creating an item does not add stock; record actual quantities in a receipt.',
      'បំពេញឈ្មោះ ប្រភេទ លក្ខណៈ និងឯកតា។ បង្កើតទំនិញមិនបន្ថែមស្តុកទេ ត្រូវកត់បរិមាណក្នុងការទទួល។');
    let use = $('recv-use-existing-item'); if (!use) { use = document.createElement('button'); use.id = 'recv-use-existing-item'; use.type = 'button'; use.className = 'nav-btn'; use.onclick = useExisting; help.after(use); }
    use.hidden = !itemTarget || !$('edit-id').value;
    use.textContent = T('選用此既有物品，返回收貨／發料', 'Use this existing item and return', 'ប្រើទំនិញនេះ ហើយត្រឡប់');
  }
  const priorEdit = window.editItem;
  window.editItem = function () { priorEdit.apply(this, arguments); formHelp(); };
  window.recvNewCatalogItem = function (type, index) {
    const target = lines(type)[index]; priorAdd(); itemTarget = { type, row: target || null };
    if (target && target._itemQuery) $('f-name').value = target._itemQuery.trim(); formHelp(); $('f-name').focus();
  };
  function selectTarget(target, id) {
    if (!target || !recvItemById(id) || recvItemById(id).archived) return;
    let row = target.row;
    if (!row || !lines(target.type).includes(row)) { row = blank(target.type); lines(target.type).push(row); }
    clearPo(row); row.itemId = id; row._itemQuery = ''; showPage('receive'); setReceiveTab(target.type);
  }
  function useExisting() {
    const id = $('edit-id').value, it = recvItemById(id); if (!it) return;
    if (it.archived) { toast(T('請先在物品管理啟用此物品。', 'Restore this item in the catalog first.', 'សូមបើកទំនិញនេះក្នុងបញ្ជីជាមុន។'), 'error'); return; }
    const target = itemTarget; closeForm(); selectTarget(target, id);
  }
  const priorSaveItem = window.saveItem;
  window.saveItem = async function () {
    if (savingItem) return false;
    const unit = ($('f-unit').value || '').trim(), price = Number($('f-unit-price').value);
    if (!unit || !Number.isFinite(price) || price < 0) { toast(T('請填計量單位及有效的非負單價。', 'Enter a unit and a valid non-negative unit price.', 'សូមបំពេញឯកតា និងតម្លៃមិនអវិជ្ជមាន។'), 'error'); return false; }
    savingItem = true; window._recvStrictSave = (window._recvStrictSave || 0) + 1; const target = itemTarget, ids = new Set(items.map(it => it.id)), editId = $('edit-id').value;
    try {
      await priorSaveItem();
      if ($('item-form').classList.contains('show')) { formHelp(); return false; }
      const it = editId ? recvItemById(editId) : items.find(x => !ids.has(x.id));
      if (it) { filterItems(); selectTarget(target, it.id); }
      return !!it;
    } catch (e) {
      const created = items.find(x => !ids.has(x.id)); if (created) $('edit-id').value = created.id;
      itemTarget = target; $('item-form').classList.add('show');
      toast(T('物品尚未儲存，請重試：', 'Item not saved. Retry: ', 'ទំនិញមិនទាន់រក្សាទុក។ សាកម្ដងទៀត៖ ')+e.message, 'error'); return false;
    } finally { savingItem = false; window._recvStrictSave = Math.max(0, (window._recvStrictSave || 1) - 1); }
  };
  window.recvCatalogArchive = function (id, restore) {
    const it = recvItemById(id); if (!it) return false;
    if (!confirm(restore ? T('重新啟用此物品？', 'Restore this item?', 'បើកទំនិញនេះឡើងវិញ?') :
      T('停用後不再出現在新增收發的選單；歷史與庫存保留。確定停用？', 'Archive this item from new receipt/issue choices? History and stock remain.', 'បិទទំនិញនេះពីជម្រើសទទួល/ចេញថ្មី? ប្រវត្តិ និងស្តុកនៅដដែល។'))) return false;
    const old = { archived: it.archived, updatedAt: it.updatedAt }; it.archived = !restore; it.updatedAt = new Date().toISOString();
    window._recvStrictSave = (window._recvStrictSave || 0) + 1;
    try { saveLocal(); } catch (e) { Object.assign(it, old); toast(T('尚未儲存：', 'Not saved: ', 'មិនទាន់រក្សាទុក៖ ')+e.message, 'error'); return false; } finally { window._recvStrictSave = Math.max(0, (window._recvStrictSave || 1) - 1); }
    scheduleReceivingAutoUpload(restore ? 'item-restore' : 'item-archive'); filterItems(); renderReceiveContent(); return true;
  };
  window.deleteItem = id => recvCatalogArchive(id, false);
  window.recvUseCatalogItem = function (id) { selectTarget({ type: 'receive', row: null }, id); };
  function catalogTools() {
    const title = $('st-items'); if (title) title.textContent = T('物品管理', 'Item catalog', 'គ្រប់គ្រងទំនិញ');
    const tab = $('tab-items'); if (tab) tab.querySelector('span').textContent = T('物品管理', 'Item catalog', 'គ្រប់គ្រងទំនិញ');
    let help = $('recv-catalog-intro'); if (!help) { help = document.createElement('div'); help.id = 'recv-catalog-intro'; help.className = 'recv-catalog-intro'; title.after(help); }
    help.innerHTML = '<span>' + T('① 新增／編輯物品 → ② 收貨時搜尋選取 → ③ 填實收數量。已有歷史的物品可停用，舊紀錄保留。',
      'Create or edit an item → select it when receiving → enter the actual quantity. Archiving preserves history.',
      'បង្កើត ឬកែទំនិញ → ជ្រើសពេលទទួល → បំពេញបរិមាណពិត។ បិទទំនិញរក្សាប្រវត្តិ។') + '</span><button type="button" class="nav-btn success" onclick="showAddForm()">＋ ' + T('新增物品', 'New item', 'បន្ថែមទំនិញ') + '</button>';
    $('page-items').querySelectorAll('tr[id^="row-"]').forEach(tr => {
      const it = recvItemById(tr.id.slice(4)), host = tr.querySelector('.row-actions'); if (!it || !host) return;
      host.replaceChildren();
      const addButton = (text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-btn'; b.textContent = text; b.onclick = fn; host.appendChild(b); };
      addButton(T('編輯', 'Edit', 'កែប្រែ'), () => editItem(it.id));
      addButton(it.archived ? T('啟用', 'Restore', 'បើកឡើងវិញ') : T('停用', 'Archive', 'បិទ'), () => recvCatalogArchive(it.id, !!it.archived));
      if (!it.archived) addButton(T('收貨', 'Receive', 'ទទួល'), () => recvUseCatalogItem(it.id));
    });
  }
  const priorCatalogRender = window.renderItemsTable;
  window.renderItemsTable = function () { const result = priorCatalogRender.apply(this, arguments); catalogTools(); return result; };
  const priorSyncStatus = window.recvSyncStatus;
  window.recvSyncStatus = function (message, type) {
    const poConflict = type === 'err' && /PO is no longer approved|PO line could not be matched|exceeds approved/.test(String(message));
    if (!poConflict) {
      if (type === 'up') { const box = $('recv-po-conflict-help'); if (box) box.remove(); }
      return priorSyncStatus(message, type);
    }
    GA.cloud.mount('#ga-cloud'); GA.cloud.set('conflict', T('收貨與 PO 資料待核對', 'Receipts need PO review', 'ការទទួលត្រូវផ្ទៀងផ្ទាត់ PO'));
    let box = $('recv-po-conflict-help');
    if (!box) { box = document.createElement('div'); box.id = 'recv-po-conflict-help'; box.className = 'recv-catalog-conflict'; box.setAttribute('role', 'alert'); document.querySelector('.main').prepend(box); }
    box.replaceChildren(); const title = document.createElement('strong');
    title.textContent = T('收貨已留在本機，但這批資料尚未上傳成功。', 'Receipts remain local; this upload was not accepted.', 'ការទទួលនៅក្នុងម៉ាស៊ីន ប៉ុន្តែមិនទាន់ផ្ទុកឡើងបាន។');
    const text = document.createElement('p'); text.textContent = T('待傳紀錄內有 PO 狀態、品項或數量需要核對。請到 Monthly PO 收貨重新整理，查看下方指定的單據；這不表示不能新增物品。',
      'A pending receipt needs its PO status, item or quantity checked. Refresh Monthly PO receiving and review the order below. You can still create catalog items.',
      'ត្រូវផ្ទៀងផ្ទាត់ស្ថានភាព PO ទំនិញ ឬបរិមាណ។ សូមផ្ទុក Monthly PO ឡើងវិញ និងពិនិត្យឯកសារខាងក្រោម។ អ្នកនៅតែអាចបង្កើតទំនិញបាន។');
    const detail = document.createElement('p'); detail.textContent = String(message);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'nav-btn'; button.textContent = T('查看 Monthly PO 收貨', 'Open Monthly PO receiving', 'បើកទទួល Monthly PO');
    button.onclick = () => { showPage('receive'); setReceiveTab('po'); };
    box.append(title, text, detail, button);
  };
  // These arrays held only auto-created, unsaved placeholder lines during page boot.
  _recvBatchLines = []; _recvIssueLines = [];
  function boot() { catalogTools(); renderReceiveContent(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
