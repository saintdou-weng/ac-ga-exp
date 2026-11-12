/* ════════════════════════════════════════════════════════════════════
   AC-GA-EXP Platform · shared/ga-telegram.js   v3.9.19
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
/* v3.9.26: web UI text per platform language (Telegram message content is unchanged) */
function L3(zh, en, km) { return GA.lang === 'en' ? en : GA.lang === 'km' ? km : zh; }

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
    TG.defaultChatId=String(r.defaultChatId||(r.data&&r.data.defaultChatId)||'');
    groupCache = (r.data && r.data.groups) || r.groups || [];
    return groupCache;
  });
};
TG.matchesModule=function(list,module){var alias={fuel:'diesel',recv:'receiving',transport:'transportation'},wanted=alias[module]||module;return String(list||'all').toLowerCase().split(/[\s,;]+/).some(function(m){return m==='all'||(alias[m]||m)===wanted;});};
TG.deliveryResult=function(d){d=d||{};var errors=Array.isArray(d.errors)?d.errors:[],duplicate=!!d.skippedDuplicate,receipts=Array.isArray(d.receipts)?d.receipts:[],receiptCount=receipts.filter(function(r){return r&&r.chatId&&r.messageId;}).length,confirmed=receiptCount>0&&(Number(d.sent)>0||duplicate);return {ok:confirmed&&!errors.length,duplicate:duplicate,receipts:receipts,text:duplicate&&confirmed?L3('相同摘要先前已送達；請由下方回執開啟原訊息。若要新增一則，請勾選「重新發一則」','This summary was already sent; open the original message below. Tick “Send a new copy” to post it again','សង្ខេបនេះបានផ្ញើរួចហើយ; បើកសារដើមខាងក្រោម។ ធីក “ផ្ញើច្បាប់ថ្មី” ដើម្បីផ្ញើម្ដងទៀត'):duplicate?L3('後端表示摘要重複，但沒有原訊息回執；請更新 GAS 後再核對','Backend reports a duplicate but gave no original receipt; update GAS and check','Backend និយាយថាស្ទួន ប៉ុន្តែគ្មានបង្កាន់ដៃសារដើម; សូមធ្វើបច្ចុប្បន្នភាព GAS ហើយពិនិត្យ'):confirmed?L3('Telegram 已確認 '+receiptCount+' 則訊息、'+Number(d.sent)+' 個群組',receiptCount+' message receipt(s), '+Number(d.sent)+' group(s) confirmed','Telegram បានបញ្ជាក់ '+receiptCount+' សារ, '+Number(d.sent)+' ក្រុម'):Number(d.sent)>0?L3('伺服器回報已發送，但缺少群組 Message ID；不可視為送達，請更新 GAS','Server says sent but gave no group message ID; delivery is not confirmed, update GAS','Server និយាយថាបានផ្ញើ ប៉ុន្តែគ្មានលេខសារក្រុម; មិនទាន់បញ្ជាក់ការផ្ញើ សូមធ្វើបច្ចុប្បន្នភាព GAS'):L3('未取得群組發送確認','No group delivery confirmation','មិនទាន់មានការបញ្ជាក់ការផ្ញើទៅក្រុម'),errors:errors};};

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
  var groupsReady=false,sending=false,resendKey='';
  var st = {
    mode: 'summary',
    scope: (opt.scopes && opt.scopes[0] && opt.scopes[0].v) || 'all',
    ptype: opt.ptype || 'month',
    period: opt.period || GA.currentPeriod(opt.ptype || 'month'),
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
              '<option value="zh">' + L3('繁體中文', 'Chinese', 'ភាសាចិន') + '</option>' +
              '<option value="en">English</option>' +
              '<option value="km">English + ខ្មែរ</option>' +
              '<option value="both" selected>' + GA.T('tgBoth') + L3(' 中／EN', ' (Chinese / English)', ' (ចិន / អង់គ្លេស)') + '</option>' +
              '<option value="all3">' + L3('中 / EN / ខ្មែរ', 'Chinese / English / Khmer', 'ចិន / អង់គ្លេស / ខ្មែរ') + '</option>' +
            '</select></div>' +
          '<div class="ga-fld"><label>' + GA.T('tgGroup') + '</label>' +
            '<select id="tg-group"><option value="">' + GA.T('tgLoadGroup') + '</option></select></div>' +
        '</div>' +

        '<div class="ga-fld"><label>' + GA.T('tgPreview') + '</label>' +
          '<pre id="tg-pv" class="ga-pre"></pre></div>' +
        '<p id="tg-result" role="status" style="white-space:pre-wrap"></p>' +
        '<div id="tg-receipts"></div>' +
        '<label id="tg-resend-label"><input type="checkbox" id="tg-resend"> '+L3('重新發一則新訊息（未勾選時，相同摘要只顯示原訊息）','Send a new copy (otherwise the same summary just shows the original message)','ផ្ញើច្បាប់ថ្មី (បើមិនធីក សង្ខេបដដែលនឹងបង្ហាញសារដើម)')+'</label>' +
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
  TG.groups(true).then(function (gs) {
    var sel = el('tg-group');
    var usable = gs.filter(function (g) {
      if (g.enabled === false) return false;
      return !opt.module || TG.matchesModule(g.modules,opt.module);
    });
    sel.innerHTML = usable.length
      ? usable.map(function (g) { return '<option value="' + GA.esc(g.chatId) + '">' + GA.esc(g.name || g.chatId) + '</option>'; }).join('')
      : TG.defaultChatId?'<option value="'+GA.esc(TG.defaultChatId)+'">GA-EXP ('+GA.esc(TG.defaultChatId)+')</option>':'<option value="">'+L3('無可用群組，請檢查設定','No group available; check settings','គ្មានក្រុមដែលអាចប្រើបាន; សូមពិនិត្យការកំណត់')+'</option>';
    if(TG.defaultChatId&&usable.some(function(g){return String(g.chatId)===TG.defaultChatId;}))sel.value=TG.defaultChatId;
    st.group = sel.value;
    groupsReady=!!st.group;preview();
    sel.onchange = function () { st.group = this.value; };
  }).catch(function(e){var em=GA.errText?GA.errText(e,false):e.message;el('tg-group').innerHTML='<option value="">'+GA.esc(em)+'</option>';el('tg-result').textContent='❌ '+em;groupsReady=false;preview();});

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
    st.period = (st.period==='ALL'||list.indexOf(st.period)>=0) ? st.period : (list.length ? list[0] : 'ALL');
    sel.value = st.period;
    sel.onchange = function () { st.period = this.value; preview(); };
  }

  el('tg-ptype').onchange = function () { var old=st.ptype,k=st.period,anchor=old==='week'?(GA.weekRange(k)||{}).start:old==='month'?k+'-01':old==='year'?k+'-01-01':k;st.ptype=this.value;st.period=k==='ALL'?'ALL':GA.periodKey(anchor,st.ptype)||GA.currentPeriod(st.ptype);fillPeriods();preview(); };
  el('tg-lang').onchange = function () { st.lang = this.value; preview(); };

  ov.querySelectorAll('#tg-mode [data-m]').forEach(function (b) {
    b.onclick = function () {
      st.mode = b.getAttribute('data-m');
      el('tg-resend-label').style.display=st.mode==='summary'?'':'none';
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

  /* 2026-11-12：摘要可帶 <b> <i> <code>；預覽照樣式顯示，送出的是原文字（pvRaw）。 */
  var pvRaw = '';
  function setPv(text) { pvRaw = String(text == null ? '' : text); el('tg-pv').innerHTML = TG.styledHtml(pvRaw); }
  function preview() {
    var pv = { set textContent(v) { setPv(v); } };
    try {
      if (st.mode === 'approval') {
        var items = opt.approvalItems ? (opt.approvalItems(st) || []) : [];
        pv.textContent = TG.buildApprovalPreview({
          lang: st.lang,
          period: TG.periodLabel(st.period, st.ptype, st.lang),
          items: items
        });
        el('tg-send').disabled = sending||!groupsReady||!items.length;
      } else {
        pv.textContent = opt.summary ? opt.summary(st) : L3('(no preview)', '(no preview)', '(គ្មានការមើលជាមុន)');
        el('tg-send').disabled = sending||!groupsReady;
      }
    } catch (e) { pv.textContent = '⚠️ ' + e.message; }
  }

  el('tg-send').onclick = async function () {
    if(sending||!groupsReady)return;
    sending=true;
    var btn = this, old = btn.textContent;
    btn.disabled = true; btn.textContent = GA.T('tgSending');

    var done = function (msg, ok) {
      GA.toast(msg, ok ? '' : 'err');
      sending=false;btn.disabled = !groupsReady; btn.textContent = old;
      el('tg-result').textContent=msg;
      if (ok&&st.mode==='approval') close();
    };

    if(opt.beforeSend){try{if(await opt.beforeSend()===false){done('❌ '+L3('雲端未同步，請先處理同步狀態','Cloud not synced; fix sync first','Cloud មិនទាន់សមកាលកម្ម; សូមដោះស្រាយសមកាលកម្មជាមុន'),false);return;}}catch(e){done(GA.errText?GA.errText(e,false):e.message,false);return;}}
    if (st.mode === 'summary') {
      var latest=opt.summary?opt.summary(st):pvRaw;
      if(latest!==pvRaw){setPv(latest);done(L3('同步後資料已更新，請核對預覽再按確認傳送','Data changed after sync. Check the preview, then press Send again.','ទិន្នន័យបានផ្លាស់ប្ដូរក្រោយសមកាលកម្ម។ សូមពិនិត្យការមើលជាមុន ហើយចុចផ្ញើម្ដងទៀត។'),false);return;}
      if(el('tg-resend').checked&&!resendKey)resendKey=crypto.randomUUID();
      /* 摘要：後端只發訊息，不建 batch、不加按鈕、不改狀態 */
      try {
        /* Older GAS versions can say ok/sent without returning a Telegram
           message receipt.  Require the receipt contract before attempting
           a summary so the UI never reports a phantom delivery. */
        if (GA.backend && GA.backend.require) await GA.backend.require('tgSummaryReceipt', { action:'tgSummary' });
        var chartUrl='';
        if(opt.chart&&TG.STYLE_RE.test(pvRaw)){try{chartUrl=await TG.chartImage(opt.chart(st));}catch(ce){console.warn('[tg chart]',ce);}}
        var response = await GA.gasPost('tgSummary', {
          styled: TG.STYLE_RE.test(pvRaw) ? 1 : 0, chart: chartUrl,
          module: opt.module, scope: st.scope,
          ptype: st.ptype, period: st.period,
          lang: st.lang, chatId: st.group,
          text: pvRaw,resendKey:el('tg-resend').checked?resendKey:''
        });
        var data=response.data||response,result=TG.deliveryResult(data);showReceipts(result.receipts);done(result.text+(result.errors.length?' · '+result.errors.join(' | '):''),result.ok);
        if (result.ok&&opt.onSummarySent) opt.onSummarySent(data, st);
      } catch (e) {showReceipts(e.payload&&e.payload.data&&e.payload.data.receipts||[]);done('❌ ' + (GA.errText?GA.errText(e,false):e.message), false);}

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
        var receipt=d.receipt||{};
        if(!d.chatId||!d.messageId||!receipt.chatId||!receipt.messageId)throw new Error(L3('Telegram 未回傳群組 Message ID，核可請求不可視為已送達','Telegram returned no group message ID; the approval request is not confirmed as delivered','Telegram មិនបានផ្ញើលេខសារក្រុម; មិនទាន់បញ្ជាក់ថាសំណើអនុម័តបានផ្ញើ'));
        showReceipts([receipt]);
        done('📋 ' + (d.updated ? L3('已更新原核可訊息', 'Updated the existing approval message', 'បានធ្វើបច្ចុប្បន្នភាពសារអនុម័តដើម')
                                : L3('核可請求已送出', 'Approval request sent', 'បានផ្ញើសំណើអនុម័ត')), true);
        if (opt.onApprovalSent) opt.onApprovalSent(d, st);
      }).catch(function (e) {
        done('❌ ' + (e.code === 'NO_PERM' ? GA.T('tgNoPerm') : (GA.errText ? GA.errText(e, false) : e.message)), false);
      });
    }
  };

  function showReceipts(receipts){var box=el('tg-receipts');box.replaceChildren();(receipts||[]).forEach(function(r){var p=document.createElement('p');p.textContent=(r.title||r.chatId)+' · '+r.chatId+' · '+L3('Message #','Message #','សារ #')+r.messageId+(r.status==='previously_sent'?L3('（先前已送）',' (previously sent)',' (បានផ្ញើពីមុន)'):'');if(/^https:\/\/t\.me\//.test(r.url||'')){var a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener';a.textContent=L3(' 開啟群組訊息',' Open group message',' បើកសារក្រុម');p.appendChild(a);}box.appendChild(p);});}

  el('tg-kind').textContent = '📄 ' + GA.T('tgSummary');
  el('tg-ptype').value=st.ptype;
  fillPeriods();
  preview();
  return { close: close };
};

/* ═══════════ 摘要文字產生器（各模組共用骨架）═══════════
   lang: 'zh' | 'en' | 'both'                                   */
TG.langText = function (zh, en, km, lang) {
  var L = lang || 'both';
  zh = zh == null ? '' : String(zh);
  en = en == null ? '' : String(en);
  km = km == null ? '' : String(km);
  if (L === 'zh') return zh;
  if (L === 'en') return en || zh;
  /* 2026-10-28 Paul：選柬文發摘要一律英柬雙語；中文／英文不變。 */
  if (L === 'km') return (km && en && km !== en) ? en + ' / ' + km : (km || en || zh);
  if (L === 'all3') return [zh, en, km || en].filter(Boolean).join(' / ');
  return [zh, en].filter(Boolean).join(' / ');
};

TG.periodLabel = function (key, type, lang) {
  var L = lang || 'both';
  if (!key) return '—';
  if (key === 'ALL') return TG.langText('全部','All','ទាំងអស់',L);
  if (type === 'day') {
    var d = GA.parseYMD(key); if (!d) return key;
    var enW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    var zhW = ['日','一','二','三','四','五','六'][d.getDay()];
    var kmW = ['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'][d.getDay()];
    return key + ' ' + TG.langText('週'+zhW,enW,kmW,L);
  }
  if (type === 'week') {
    var m = String(key).match(/^(\d{4})-W(\d+)$/); if (!m) return key;
    var r = GA.weekRange(key), n = +m[2];
    var w = TG.langText('第'+n+'週','W'+n,'សប្ដាហ៍ '+n,L);
    return m[1] + ' ' + w + (r ? ' (' + r.start + ' ~ ' + r.end + ')' : '');
  }
  if (type === 'month') {
    var mm = String(key).match(/^(\d{4})-(\d{2})$/); if (!mm) return key;
    var EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return TG.langText(mm[1]+'年'+(+mm[2])+'月',EN[+mm[2]-1]+' '+mm[1],mm[1]+' ខែ'+(+mm[2]),L);
  }
  if (type === 'year') return TG.langText(key+'年',key,'ឆ្នាំ '+key,L);
  return key;
};

/* ═══════════ 2026-11-12 摘要新版排版（Paul：整齊一致、數據一眼得知、有顏色管理）═══════════
   · 不再用 ├ └ 樹狀符號。
   · 數字放最前面、用等寬字靠右對齊（<code>），後面才是項目名稱 → 中英柬混排也對得齊。
   · 標題粗體；分段用 '-'；row.head=true 是小標題；row.tone='ok'|'warn'|'bad' 顯示 🟢🟡🔴。
   · 各模組原本的 rows 內容、統計與篩選邏輯都不變。 */
TG.STYLE_RE = /<\/?(b|i|code)>/;
TG.RULE = '━━━━━━━━━━━━';
TG.esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
/* 預覽用：先整段跳脫，再只放行 b / i / code（與 GAS tgStyledHtml_ 相同規則） */
TG.styledHtml = function (text) { return TG.esc(text).replace(/&lt;(\/?)(b|i|code)&gt;/g, '<$1$2>'); };
/* 訊息內文用：把使用者資料裡的 < > & 換成全形，避免被當成樣式標籤 */
TG.safe = function (v) { return String(v == null ? '' : v).replace(/</g, '‹').replace(/>/g, '›'); };
/* 標籤：雙語用空格接（出勤摘要的寫法：出勤率 Attendance），不用斜線 */
TG.label = function (zh, en, km, lang) {
  var L = lang || 'both'; zh = zh == null ? '' : String(zh); en = en == null ? '' : String(en); km = km == null ? '' : String(km);
  var uniq = function (a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }).join(' '); };
  if (L === 'zh') return zh || en;
  if (L === 'en') return en || zh;
  if (L === 'km') return uniq([en || zh, km]);
  if (L === 'all3') return uniq([zh, en, km]);
  return uniq([zh, en]);
};
TG.light = function (tone) { return tone === 'ok' ? '🟢' : tone === 'warn' ? '🟡' : tone === 'bad' ? '🔴' : ''; };
/* 等寬數字欄：cells 靠右補空白 */
TG.mono = function (v, width) { v = String(v == null ? '' : v); while (v.length < width) v = ' ' + v; return '<code>' + TG.esc(v) + '</code>'; };
/* 比例色條：parts=[{value,mark:'🟦'}]，共 n 格（最大餘數法，非零項至少一格） */
TG.shareBar = function (parts, n) {
  n = n || 10; var live = (parts || []).filter(function (p) { return p.value > 0; }), sum = live.reduce(function (a, p) { return a + p.value; }, 0);
  if (!sum) return '';
  var cells = live.map(function (p) { var x = p.value / sum * n; return { p:p, k:Math.max(1, Math.floor(x)), r:x - Math.floor(x) }; });
  var used = cells.reduce(function (a, c) { return a + c.k; }, 0);
  cells.slice().sort(function (a, b) { return b.r - a.r; }).forEach(function (c) { if (used < n) { c.k++; used++; } });
  cells.slice().sort(function (a, b) { return b.k - a.k; }).forEach(function (c) { while (used > n && c.k > 1) { c.k--; used--; } });
  return cells.map(function (c) { return new Array(c.k + 1).join(c.p.mark); }).join('');
};
/* 進度色條：ratio 0–1，綠／黃／紅格＋白格 */
TG.bar = function (ratio, tone, n) {
  n = n || 10; var k = Math.max(0, Math.min(n, Math.round((+ratio || 0) * n))), on = tone === 'bad' ? '🟥' : tone === 'warn' ? '🟨' : '🟩';
  return new Array(k + 1).join(on) + new Array(n - k + 1).join('⬜');
};
/* 附圖：spec（ACChart.render 的設定）→ JPEG dataURL；沒有圖表元件或畫不出來回傳 '' */
TG.chartImage = function (spec) {
  if (!spec) return Promise.resolve('');
  if (typeof spec === 'string') return Promise.resolve(spec);
  var load = global.ACChart ? Promise.resolve() : new Promise(function (ok) {
    var sc = document.createElement('script'); sc.src = 'shared/ac-tg-chart.js?v=20261112a'; sc.onload = ok; sc.onerror = ok; document.head.appendChild(sc);
  });
  return load.then(function () {
    if (!global.ACChart || !global.ACChart.render) return '';
    var png = global.ACChart.render(spec); if (!png) return '';
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () { try { var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0); ok(c.toDataURL('image/jpeg', 0.9)); } catch (e) { ok(png); } };
      im.onerror = function () { ok(png); }; im.src = png;
    });
  });
};

TG.buildSummary = function (o) {
  var L = o.lang || 'both';
  function lab(r) { return TG.safe(TG.label(r.zh, r.en, r.km, L)); }
  var out = [];
  out.push((o.icon || '📊') + ' <b>' + TG.safe(TG.label(o.titleZh || '', o.titleEn || '', o.titleKm || '', L)) + '</b>');
  if (o.period) out.push('📅 ' + TG.safe(String(o.period).replace(/ \/ /g, ' ')));
  if (o.scope) out.push('🧾 ' + TG.safe(TG.label('範圍', 'Scope', 'វិសាលភាព', L)) + ': ' + TG.safe(o.scope));
  out.push(TG.RULE);
  /* 依 '-' 分段；每段內短的數值排成同寬的等寬欄 */
  var sections = [[]];
  (o.rows || []).forEach(function (r) { if (r === '-') sections.push([]); else if (r) sections[sections.length - 1].push(r); });
  function val(r) { return r.v == null || r.v === '' ? '—' : String(r.v); }
  function short(v) { return v.length <= 12 && /^[\x20-\x7e—]*$/.test(v); }
  sections.filter(function (sec) { return sec.length; }).forEach(function (sec, si) {
    if (si) out.push('────────────');
    var w = sec.reduce(function (a, r) { var v = val(r); return !r.head && short(v) ? Math.max(a, v.length) : a; }, 0);
    sec.forEach(function (r) {
      var v = val(r), dot = TG.light(r.tone);
      if (r.head) { out.push('<b>' + lab(r) + '</b>' + (r.v == null || r.v === '' ? '' : ' · ' + TG.safe(v))); return; }
      if (short(v)) out.push(TG.mono(v, w) + ' ' + (dot ? dot + ' ' : '') + lab(r));
      else { var lb = lab(r); out.push((dot ? dot + ' ' : /^[A-Za-z0-9\u3400-\u9fff\u1780-\u17ff]/.test(lb) ? '▫️ ' : '') + lb + ': ' + TG.safe(v)); }
    });
  });
  if (o.footer) { out.push(TG.RULE); out.push(TG.safe(o.footer)); }
  return out.join('\n');
};

/* 核可預覽同樣欄位式；只改呈現，不改 approvalItems / 權限 / 按鈕流程。 */
TG.buildApprovalPreview = function (o) {
  var L = o.lang || 'both';
  function t(zh, en, km) { return TG.langText(zh, en, km, L); }
  var items = o.items || [];
  var amt = items.reduce(function (a, r) { return a + GA.num(r.amount || r.lineTotal || r.estPrice || 0); }, 0);
  var out = [
    '📋 ' + t('核可請求', 'Approval Request', 'សំណើអនុម័ត'),
    '━━━━━━━━━━━━━━━━',
    '├ 📅 ' + t('期間', 'Period', 'រយៈពេល') + ': ' + (o.period || '—'),
    '├ 📦 ' + t('筆數', 'Items', 'ចំនួន') + ': ' + items.length,
    '└ 💵 ' + t('總額', 'Total', 'សរុប') + ': ' + (amt ? GA.money(amt) : '—'),
    '━━━━━━━━━━━━━━━━'
  ];
  items.slice(0, 8).forEach(function (r, i) {
    out.push('📌 #' + (i + 1) + ' ' + (r.item || r.itemName || r.category || '—'));
    if (r.spec || r.brandSpec || r.size) out.push('├ ' + t('規格', 'Spec', 'លក្ខណៈ') + ': ' + [r.spec || r.brandSpec || '', r.size || ''].filter(Boolean).join(' / '));
    out.push('├ ' + t('數量', 'Qty', 'បរិមាណ') + ': ' + (r.qty || '—') + (r.unit ? ' ' + r.unit : ''));
    if (r.dept) out.push('├ ' + t('部門', 'Dept', 'ផ្នែក') + ': ' + r.dept);
    if (r.purpose || r.note) out.push('├ ' + t('用途/備註', 'Purpose / Note', 'គោលបំណង / កំណត់ចំណាំ') + ': ' + (r.purpose || r.note));
    if (r.supplier) out.push('├ ' + t('供應商', 'Supplier', 'អ្នកផ្គត់ផ្គង់') + ': ' + r.supplier);
    if (r.amount || r.lineTotal || r.estPrice) out.push('└ ' + t('金額', 'Amount', 'ចំនួនទឹកប្រាក់') + ': ' + GA.money(r.amount || r.lineTotal || r.estPrice));
    else out.push('└ ' + t('狀態', 'Status', 'ស្ថានភាព') + ': ' + t('待核可', 'Pending approval', 'រង់ចាំអនុម័ត'));
    out.push('────────────');
  });
  if (items.length > 8) out.push('… +' + (items.length - 8) + ' ' + t('筆（送出時仍依原流程處理全部資料）', 'more (all items are still submitted)', 'បន្ថែម (ទិន្នន័យទាំងអស់នៅតែត្រូវបានដាក់ស្នើ)'));
  out.push(t('群組將顯示核可／退回按鈕', 'Approve / Return buttons will appear in the group', 'ប៊ូតុង អនុម័ត / ត្រឡប់ នឹងបង្ហាញក្នុងក្រុម'));
  return out.join('\n');
};

})(window);
