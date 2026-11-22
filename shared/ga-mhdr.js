/* ga-mhdr.js — 手機精簡頁首（2026-11-22 Paul：「上方的選項固定著但太佔空間且太大，要精實」）
 * 只在手機寬度（≤720px）作用；電腦版不變。
 * 頁首只留一行：🏠｜模組名稱｜雲端燈號｜語言（小）｜⋯
 * 上傳／下載／匯入／Telegram／設定等按鈕與同步文字收進「⋯」，按一下展開、再按收起；按了其中一個按鈕會自動收起。
 * 不搬動任何元素、不改原本的按鈕和函式，只加 class 控制顯示，所以各頁原功能照舊。
 */
(function () {
  'use strict';
  if (window.GAMHdr) return;
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  /* 每頁設定：h=頁首；home=回首頁鍵；tt=標題；lang=語言鍵（或其容器）；x=收進 ⋯ 的元素；small=縮小的圖示 */
  var CFG = {
    'maintenance.html': { h: '.topbar', home: '.topbar-home', tt: '.topbar>div[style*="flex"],.topbar>div:has(>#tt)', small: '#tb-icon', lang: '.lang-toggle',
      x: '.topbar>button.topbar-icon,.topbar>[id^="ga-auto-sync-state"],.topbar-sub' },
    'expense.html': { h: '.ga-hd', home: '.ga-hd-home', tt: '.ga-hd-id', lang: '.ga-lang',
      x: '.ga-hd-tools>button,.ga-hd>[id^="ga-auto-sync-state"],.ga-hd-ver' },
    'receiving.html': { h: '.topbar', home: '.topbar>button.topbar-icon:first-child', tt: '.topbar-logo', lang: '.topbar>.lang-btn',
      x: '.topbar>button.topbar-icon:not(:first-child),.topbar>[id^="ga-auto-sync-state"],.topbar>.tb-sep' },
    'damage.html': { h: '.hero', home: '.hero>a.btn', tt: '.hero>div:first-child', lang: '.hero .lang',
      x: '.hero .cloudRow,.hero h1~small,.hero h1~div' },
    'fuel.html': { h: '.header', tt: '.header>div:has(>.h-title)', small: '.header>.logo', lang: '.lang-group',
      x: '.header>div:has(>button.btn),.h-sub>.tl:first-child' },
    'procurement.html': { h: '.hdr', tt: '.hdr-l', lang: '.lang-sw',
      x: '.hdr-r>button.inv-btn,.hdr-r>.user-chip,#logout-btn,.hdr-l .dept' },
    'transportation.html': { h: 'main>header', tt: 'main>header>h1', lang: 'main>header>button',
      x: 'main>.bar:has(#upload)' },
    'etc.html': { h: 'main>header', tt: 'main>header>h1', lang: 'main>header>button',
      x: 'main>.bar:has(#upload)' }
  };
  var C = CFG[page]; if (!C) return;
  var MQ = window.matchMedia ? matchMedia('(max-width:720px)') : { matches: false };

  var css = '.gmh-more,.gmh-br{display:none}' +
    '@media(max-width:720px){' +
    'body.gmh-on .gmh-h{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:6px!important;padding:6px 10px!important;min-height:0!important;height:auto!important}' +
    'body.gmh-on:not(.gmh-open) .gmh-x{display:none!important}' +
    'body.gmh-on .gmh-home{order:1;flex:none!important;min-height:32px!important;height:32px!important;min-width:32px!important;padding:0 7px!important;font-size:15px!important;line-height:30px!important;display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box}' +
    'body.gmh-on .gmh-small{order:1;flex:none!important;font-size:17px!important;width:auto!important;height:auto!important;margin:0!important}' +
    'body.gmh-on .gmh-tt{order:2;flex:1 1 0!important;min-width:0!important;overflow:hidden;margin:0!important}' +
    'body.gmh-on .gmh-tt,body.gmh-on .gmh-tt *{white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}' +
    'body.gmh-on .gmh-tt h1,body.gmh-on .gmh-tt .h-title,body.gmh-on .gmh-tt .topbar-title,body.gmh-on .gmh-tt .ga-hd-name,body.gmh-on .gmh-tt.topbar-logo{font-size:14px!important;line-height:1.3!important;margin:0!important}' +
    'body.gmh-on .gmh-h>#ga-cloud,body.gmh-on .gmh-h #ga-cloud{order:3;flex:none}' +
    'body.gmh-on .gmh-lang{order:4;flex:none!important;display:inline-flex!important;gap:2px!important;margin:0!important;padding:0!important;width:auto!important}' +
    'body.gmh-on .gmh-lang button,body.gmh-on button.gmh-lang{min-height:28px!important;height:28px!important;min-width:0!important;padding:0 7px!important;font-size:11px!important;line-height:26px!important;border-radius:6px!important}' +
    'body.gmh-on .gmh-tools{order:4;flex:0 1 auto!important;margin-left:0!important;gap:4px!important}' +
    'body.gmh-on .gmh-more{display:inline-block;order:5;flex:none;width:32px!important;height:32px!important;min-height:32px!important;min-width:32px!important;box-sizing:border-box;border-radius:8px;border:1px solid rgba(148,163,184,.55);background:rgba(255,255,255,.14);color:inherit;font-size:17px;font-weight:800;line-height:28px;padding:0;cursor:pointer}' +
    'body.gmh-on.gmh-open .gmh-more{background:#0284c7;border-color:#0284c7;color:#fff}' +
    'body.gmh-on .gmh-br{order:6;flex-basis:100%;height:0;display:none}' +
    'body.gmh-on.gmh-open .gmh-br{display:block}' +
    'body.gmh-on.gmh-open .gmh-h .gmh-x{order:7}' +
    'body.gmh-on.gmh-open .gmh-x button,body.gmh-on.gmh-open button.gmh-x,body.gmh-on.gmh-open a.gmh-x{min-height:36px!important;height:36px!important;min-width:36px!important;padding:0 8px!important;font-size:14px!important}' +
    '}' +
    '@media(min-width:721px){.gmh-more,.gmh-br{display:none!important}}';

  function $$(s, r) { try { return Array.prototype.slice.call((r || document).querySelectorAll(s)); } catch (e) { return []; } }
  function mark(sel, cls) { if (sel) $$(sel).forEach(function (e) { e.classList.add(cls); }); }
  function L(zh, en, km) { var l = (window.GA && GA.lang) || document.documentElement.lang || 'zh'; l = String(l).slice(0, 2); return l === 'en' ? en : l === 'km' ? km : zh; }

  function apply() {
    if (!document.body) return;
    var H = document.querySelector(C.h); if (!H) return;
    if (!document.getElementById('gmh-css')) { var s = document.createElement('style'); s.id = 'gmh-css'; s.textContent = css; document.head.appendChild(s); }
    document.body.classList.add('gmh-on');
    H.classList.add('gmh-h');
    mark(C.home, 'gmh-home'); mark(C.tt, 'gmh-tt'); mark(C.small, 'gmh-small'); mark(C.lang, 'gmh-lang'); mark(C.x, 'gmh-x');
    /* expense：工具列容器只剩語言鍵露在外面 */
    $$('.ga-hd-tools', H).forEach(function (e) { e.classList.add('gmh-tools'); });
    if (!H.querySelector('.gmh-more')) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gmh-more ui-nomo'; b.textContent = '⋯';
      b.addEventListener('click', function (ev) { ev.stopPropagation(); document.body.classList.toggle('gmh-open'); b.title = document.body.classList.contains('gmh-open') ? L('收起', 'Hide', 'បិទ') : L('更多：上傳／下載／匯入／Telegram', 'More: upload / download / import / Telegram', 'បន្ថែម'); });
      b.title = L('更多：上傳／下載／匯入／Telegram', 'More: upload / download / import / Telegram', 'បន្ថែម');
      var br = document.createElement('i'); br.className = 'gmh-br';
      H.appendChild(b); H.appendChild(br);
    }
  }
  /* ⋯ 裡的按鈕按下去後自動收起（等原本的動作先執行） */
  document.addEventListener('click', function (e) {
    if (!document.body || !document.body.classList.contains('gmh-open')) return;
    var t = e.target.closest && e.target.closest('.gmh-x button,button.gmh-x,a.gmh-x');
    if (t) setTimeout(function () { document.body.classList.remove('gmh-open'); }, 250);
  }, true);

  function boot() {
    apply();
    /* 頁首有些是晚一點才畫出來的：前 15 秒內畫面有變動就再補一次（只加 class，重複執行沒關係） */
    var n = 0, t = null, mo;
    try { mo = new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; apply(); if (++n > 40) mo.disconnect(); }, 300); }); mo.observe(document.body, { childList: true, subtree: true }); setTimeout(function () { mo.disconnect(); }, 15000); } catch (e) {}
    if (window.GA && GA.on) try { GA.on('lang', function () { setTimeout(apply, 50); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.GAMHdr = { apply: apply, page: page, on: function () { return MQ.matches; } };
})();
