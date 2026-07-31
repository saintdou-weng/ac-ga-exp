/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP Platform · shared/ga-telegram.js   v2.0
   Telegram：摘要 Summary 與 核可 Approval 完全分離
   ─────────────────────────────────────────────────────────────────
   摘要 Summary：
     · 純通知，不建立 approval batch
     · 訊息不帶任何核可按鈕
     · 不改變任何申請狀態，可重複發送
   核可 Approval：
     · 只在 GA PO / Repair / Temp PO 顯示，且只對有申請權限者顯示
     · 帶原有核可／拒絕／退回按鈕，走原有核可順序與權限
     · 每批帶 idempotencyKey，重送更新原訊息而非新增一批

   安全：Bot Token 只在 GAS，瀏覽器不保存、不直連 api.telegram.org。
   ════════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';
var GA = global.GA; if (!GA) { console.error('ga-telegram.js 需要先載入 ga-core.js'); return; }

var TG = GA.telegram = {};

GA.addDict({
  zh: {
    tgTitle: '傳送至 Telegram', tgMode: '傳送模式', tgSummary: '摘要 Summary',
    tgApproval: '核可 Approval', tgScope: '內容範圍', tgLang: '訊息語言',
    tgGroup: '目標群組', tgPreview: '訊息預覽', tgSend: '確認傳送',
    tgBoth: '中英雙語', tgNoteSum: '摘要僅為通知：不會建立核可批次、訊息不含核可按鈕、不改變任何申請狀態，可重複發送。',
    tgNoteApp: '核可請求會依原有核可順序送出，並在群組顯示核可／退回按鈕。同一批重送會更新原訊息，不會重複建立。',
    tgSending: '傳送中…', tgSent: '已傳送', tgNoPerm: '你沒有送出核可請求的權限',
    tgSelected: '已選取', tgLoadGroup: '載入群組中…'
  },
  en: {
    tgTitle: 'Send to Telegram', tgMode: 'Mode', tgSummary: 'Summary',
    tgApproval: 'Approval', tgScope: 'Scope', tgLang: 'Message language',
    tgGroup: 'Target group', tgPreview: 'Preview', tgSend: 'Send',
    tgBoth: 'Bilingual', tgNoteSum: 'Summary is notification only: no approval batch, no approval buttons, no status change. Safe to resend.',
    tgNoteApp: 'Approval request follows the existing approval sequence and shows approve/return buttons in the group. Resending the same batch updates the original message.',
    tgSending: 'Sending…', tgSent: 'Sent', tgNoPerm: 'You are not authorised to submit for approval',
    tgSelected: 'Selected', tgLoadGroup: 'Loading groups…'
  },
  km: {
    tgTitle: 'ផ្ញើទៅ Telegram', tgMode: 'របៀប', tgSummary: 'សង្ខេប',
    tgApproval: 'អនុម័ត', tgScope: 'វិសាលភាព', tgLang: 'ភាសាសារ',
    tgGroup: 'ក្រុមគោលដៅ', tgPreview: 'មើលជាមុន', tgSend: 'ផ្ញើ',
    tgBoth: 'ពីរភាសា', tgNoteSum: 'សង្ខេបគឺជាការជូនដំណឹងតែប៉ុណ្ណោះ៖ គ្មានប៊ូតុងអនុម័ត និងមិនផ្លាស់ប្តូរស្ថានភាព។',
    tgNoteApp: 'សំណើអនុម័តនឹងធ្វើតាមលំដាប់អនុម័តដើម និងបង្ហាញប៊ូតុងអនុម័តក្នុងក្រុម។',
    tgSending: 'កំពុងផ្ញើ…', tgSent: 'បានផ្ញើ', tgNoPerm: 'អ្នកគ្មានសិទ្ធិដាក់ស្នើសុំអនុម័ត',
    tgSelected: 'បានជ្រើសរើស', tgLoadGroup: 'កំពុងផ្ទុកក្រុម…'
  }
});

var groupCache = null;
TG.groups = function (force) {
  if (groupCache && !force) return Promise.resolve(groupCache);
  return GA.gasGet('getGroups').then(function (r) {
    groupCache = (r.data && r.data.groups) || r.groups || [];
    return groupCache;
  }).catch(function () { return []; });
};

/* ═══════════ 開啟視窗 ═══════════
   opt = {
     module   : 'procurement' | 'receiving' | 'maintenance' | 'fuel' | 'expense' | 'dashboard',
     scopes   : [{v:'all',zh:'全部',en:'All',km:'ទាំងអស់'}, ...],   // 選填
     periods  : function(type){ return ['2026-07', ...] },           // 有資料的期間
     summary  : function({scope,ptype,period,lang}){ return '文字' },// 本地預覽用
     canApprove : true/false,                                        // 是否顯示核可模式
     approvalItems : function({scope,ptype,period}){ return [rec,...] } // 核可模式要送的資料
   }                                                                 */
TG.open = function (opt) {
  opt = opt || {};
  var st = {
    mode: 'summary',
    scope: (opt.scopes && opt.scopes[0] && opt.scopes[0].v) || 'all',
    ptype: 'month',
    period: GA.currentPeriod('month'),
    lang: 'both',
    group: ''
  };

  var ov = document.createElement('div');
  ov.className = 'ga-ov on';
  ov.innerHTML =
    '<div class="ga-modal" style="max-width:520px">' +
      '<div class="ga-modal-h">' +
        '<b>✈️ ' + GA.T('tgTitle') + '</b>' +
        '<span class="ga-modal-sub" id="tg-kind">—</span>' +
        '<button class="ga-x" data-close>&times;</button>' +
      '</div>' +
      '<div class="ga-modal-b">' +

        '<div class="ga-fld"><label>' + GA.T('tgMode') + '</label>' +
          '<div class="ga-seg" id="tg-mode">' +
            '<button data-m="summary" class="on">📄 ' + GA.T('tgSummary') + '</button>' +
            (opt.canApprove ? '<button data-m="approval">📋 ' + GA.T('tgApproval') + '</button>' : '') +
          '</div></div>' +

        (opt.scopes && opt.scopes.length > 1 ?
        '<div class="ga-fld"><label>' + GA.T('tgScope') + '</label>' +
          '<div class="ga-seg" id="tg-scope">' +
            opt.scopes.map(function (s, i) {
              return '<button data-s="' + s.v + '"' + (i === 0 ? ' class="on"' : '') + '>' +
                     GA.esc(s[GA.lang] || s.zh || s.v) + '</button>';
            }).join('') +
          '</div></div>' : '') +

        '<div class="ga-grid2">' +
          '<div class="ga-fld"><label>' + GA.T('period') + ' ' + GA.T('tgMode') + '</label>' +
            '<select id="tg-ptype">' +
              ['day', 'week', 'month', 'year'].map(function (t) {
                return '<option value="' + t + '"' + (t === 'month' ? ' selected' : '') + '>' + GA.T(t) + '</option>';
              }).join('') +
            '</select></div>' +
          '<div class="ga-fld"><label>' + GA.T('period') + '</label>' +
            '<select id="tg-period"></select></div>' +
        '</div>' +

        '<div class="ga-grid2">' +
          '<div class="ga-fld"><label>' + GA.T('tgLang') + '</label>' +
            '<select id="tg-lang">' +
              '<option value="zh">繁體中文</option>' +
              '<option value="en">English</option>' +
              '<option value="both" selected>' + GA.T('tgBoth') + ' 中／EN</option>' +
            '</select></div>' +
          '<div class="ga-fld"><label>' + GA.T('tgGroup') + '</label>' +
            '<select id="tg-group"><option value="">' + GA.T('tgLoadGroup') + '</option></select></div>' +
        '</div>' +

        '<div class="ga-fld"><label>' + GA.T('tgPreview') + '</label>' +
          '<pre id="tg-pv" class="ga-pre"></pre></div>' +
        '<p class="ga-note" id="tg-note">' + GA.T('tgNoteSum') + '</p>' +
      '</div>' +
      '<div class="ga-modal-f">' +
        '<button class="ga-btn" data-close>' + GA.T('cancel') + '</button>' +
        '<button class="ga-btn primary" id="tg-send">✈️ ' + GA.T('tgSend') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);

  function el(id) { return ov.querySelector('#' + id); }
  function close() { ov.remove(); }
  ov.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = close; });
  ov.onclick = function (e) { if (e.target === ov) close(); };

  /* 群組清單 */
  TG.groups().then(function (gs) {
    var sel = el('tg-group');
    var usable = gs.filter(function (g) {
      if (g.enabled === false) return false;
      var m = String(g.modules || 'all');
      return m === 'all' || !opt.module || m.indexOf(opt.module) >= 0;
    });
    sel.innerHTML = usable.length
      ? usable.map(function (g) { return '<option value="' + GA.esc(g.chatId) + '">' + GA.esc(g.name || g.chatId) + '</option>'; }).join('')
      : '<option value="">' + (GA.lang === 'zh' ? '（使用預設群組）' : '(default group)') + '</option>';
    st.group = sel.value;
    sel.onchange = function () { st.group = this.value; };
  });

  /* 期間清單：只列有資料的期間，另保留「全部」 */
  function fillPeriods() {
    var list = [];
    try { list = (opt.periods ? opt.periods(st.ptype) : []) || []; } catch (e) { list = []; }
    list = Array.from(new Set(list)).filter(Boolean).sort().reverse();
    var cur = GA.currentPeriod(st.ptype);
    if (list.indexOf(cur) < 0) list.unshift(cur);
    var sel = el('tg-period');
    sel.innerHTML = '<option value="ALL">' + GA.T('all') + '</option>' +
      list.map(function (k) {
        return '<option value="' + k + '">' + GA.esc(GA.periodLabel(k, st.ptype)) + '</option>';
      }).join('');
    st.period = list.length ? list[0] : 'ALL';
    sel.value = st.period;
    sel.onchange = function () { st.period = this.value; preview(); };
  }

  el('tg-ptype').onchange = function () { st.ptype = this.value; fillPeriods(); preview(); };
  el('tg-lang').onchange = function () { st.lang = this.value; preview(); };

  ov.querySelectorAll('#tg-mode [data-m]').forEach(function (b) {
    b.onclick = function () {
      st.mode = b.getAttribute('data-m');
      ov.querySelectorAll('#tg-mode [data-m]').forEach(function (x) { x.classList.toggle('on', x === b); });
      el('tg-note').textContent = GA.T(st.mode === 'summary' ? 'tgNoteSum' : 'tgNoteApp');
      el('tg-kind').textContent = st.mode === 'summary' ? '📄 ' + GA.T('tgSummary') : '📋 ' + GA.T('tgApproval');
      preview();
    };
  });
  ov.querySelectorAll('#tg-scope [data-s]').forEach(function (b) {
    b.onclick = function () {
      st.scope = b.getAttribute('data-s');
      ov.querySelectorAll('#tg-scope [data-s]').forEach(function (x) { x.classList.toggle('on', x === b); });
      preview();
    };
  });

  function preview() {
    var pv = el('tg-pv');
    try {
      if (st.mode === 'approval') {
        var items = opt.approvalItems ? (opt.approvalItems(st) || []) : [];
        var amt = items.reduce(function (a, r) { return a + GA.num(r.amount || r.estPrice || 0); }, 0);
        pv.textContent =
          '📋 ' + (GA.lang === 'zh' ? '核可請求' : 'Approval Request') + '\n' +
          '━━━━━━━━━━━━━━━\n' +
          (GA.lang === 'zh' ? '期間：' : 'Period: ') + GA.periodLabel(st.period, st.ptype) + '\n' +
          (GA.lang === 'zh' ? '筆數：' : 'Items: ') + items.length + '\n' +
          (amt ? (GA.lang === 'zh' ? '總額：' : 'Total: ') + GA.money(amt) + '\n' : '') +
          '━━━━━━━━━━━━━━━\n' +
          items.slice(0, 8).map(function (r, i) {
            return (i + 1) + '. ' + (r.item || r.itemName || r.category || '-') +
                   (r.qty ? ' × ' + r.qty : '') + (r.dept ? ' | ' + r.dept : '');
          }).join('\n') +
          (items.length > 8 ? '\n… +' + (items.length - 8) : '') +
          '\n\n' + (GA.lang === 'zh' ? '（群組將顯示核可／退回按鈕）' : '(Approve/Return buttons will appear in group)');
        el('tg-send').disabled = !items.length;
      } else {
        pv.textContent = opt.summary ? opt.summary(st) : '(no preview)';
        el('tg-send').disabled = false;
      }
    } catch (e) { pv.textContent = '⚠️ ' + e.message; }
  }

  el('tg-send').onclick = function () {
    var btn = this, old = btn.textContent;
    btn.disabled = true; btn.textContent = GA.T('tgSending');

    var done = function (msg, ok) {
      GA.toast(msg, ok ? '' : 'err');
      btn.disabled = false; btn.textContent = old;
      if (ok) close();
    };

    if (st.mode === 'summary') {
      /* 摘要：後端只發訊息，不建 batch、不加按鈕、不改狀態 */
      GA.gasPost('tgSummary', {
        module: opt.module, scope: st.scope,
        ptype: st.ptype, period: st.period,
        lang: st.lang, chatId: st.group,
        text: el('tg-pv').textContent
      }).then(function (r) {
        done('✈️ ' + GA.T('tgSent') + ' · ' + ((r.data && r.data.sent) || 1) + ' group(s)', true);
      }).catch(function (e) { done('❌ ' + e.message, false); });

    } else {
      var items = opt.approvalItems ? (opt.approvalItems(st) || []) : [];
      if (!items.length) { done('❌ ' + GA.T('noData'), false); return; }
      /* 冪等鍵：同一模組＋期間＋範圍＋資料指紋 → 重送更新原訊息 */
      var idem = GA.fingerprint([opt.module, st.scope, st.ptype, st.period,
        items.map(function (r) { return r.recordId || r._fp; }).sort().join(',')]);
      GA.gasPost('tgApproval', {
        module: opt.module, scope: st.scope,
        ptype: st.ptype, period: st.period,
        lang: st.lang, chatId: st.group,
        idempotencyKey: idem,
        items: items
      }).then(function (r) {
        var d = r.data || {};
        done('📋 ' + (d.updated ? (GA.lang === 'zh' ? '已更新原核可訊息' : 'Updated existing request')
                                : (GA.lang === 'zh' ? '核可請求已送出' : 'Approval request sent')), true);
        if (opt.onApprovalSent) opt.onApprovalSent(d);
      }).catch(function (e) {
        done('❌ ' + (e.code === 'NO_PERM' ? GA.T('tgNoPerm') : e.message), false);
      });
    }
  };

  el('tg-kind').textContent = '📄 ' + GA.T('tgSummary');
  fillPeriods();
  preview();
  return { close: close };
};

/* ═══════════ 摘要文字產生器（各模組共用骨架）═══════════
   lang: 'zh' | 'en' | 'both'                                   */
TG.buildSummary = function (o) {
  var L = o.lang || 'both';
  var line = '━━━━━━━━━━━━━━━━';
  function t(zh, en) {
    if (L === 'zh') return zh;
    if (L === 'en') return en;
    return zh + ' ' + en;
  }
  var out = [];
  out.push((o.icon || '📊') + ' ' + t(o.titleZh || '', o.titleEn || ''));
  if (o.period) out.push(t('期間', 'Period') + '：' + o.period);
  out.push(line);
  (o.rows || []).forEach(function (r) {
    if (r === '-') { out.push(line); return; }
    out.push(t(r.zh, r.en) + '：' + r.v);
  });
  if (o.footer) { out.push(line); out.push(o.footer); }
  return out.join('\n');
};

})(window);
