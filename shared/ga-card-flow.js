/* ga-card-flow.js — 詳細卡「連續往下滑」（2026-11-22 Paul：卡片按出來後要可連續下滑，不用一個一個按）
 * 有些詳細卡只有 ‹ › 按鈕（工程進度、費用明細卡）：在卡片內容最下面加「⬇ 下一筆」，
 * 滑到底再往上推（手機）或滾輪繼續往下（電腦）就自動換下一筆；點那一條也可以。
 * 物品卡（收貨／採購）、司機／車牌卡、維修／損壞詳細卡本來就能連續滑，這裡不重複處理。
 * 交通車／ETC：記錄表點一列（不只司機、車牌那一格）也會打開那一列司機的資訊卡。
 * 只按原本卡片的「下一筆」按鈕，不改資料、不改原本的函式。 */
(function (root) {
  'use strict';
  if (root.GACardFlow) return;
  var GA = root.GA || {};
  function L(zh, en, km) { var l = GA.lang || 'zh'; try { if (typeof lang !== 'undefined') l = lang; } catch (e) {} return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  var CFG = [
    { ov: '#gw-detail', sc: '.gw-body', title: 'h3' },
    { ov: '.ec-ov', sc: '.ec-b', title: '.ec-h' }
  ];
  var css = '.gcf-next{margin:14px 0 4px;padding:13px 10px;border:1.5px dashed #93c5fd;border-radius:12px;background:#eff6ff;text-align:center;font-weight:800;color:#1d4ed8;cursor:pointer;font-size:13px;-webkit-tap-highlight-color:transparent}' +
    '.gcf-next small{display:block;font-weight:600;color:#64748b;margin-top:2px}.gcf-next.pull{background:#dbeafe;border-color:#3b82f6}' +
    '.gcf-end{margin:14px 0 4px;padding:10px;text-align:center;color:#94a3b8;font-size:12px}';
  function addCss() { if (document.getElementById('gcf-css')) return; var s = document.createElement('style'); s.id = 'gcf-css'; s.textContent = css; document.head.appendChild(s); }
  function nextBtn(ov) { var b = ov.querySelector('[data-a="next"]'); return b && !b.disabled && b.style.opacity !== '.35' ? b : null; }
  function scroller(ov, c) {
    var s = ov.querySelector(c.sc);
    if (s && s.scrollHeight > s.clientHeight + 2) return s;
    return ov.scrollHeight > ov.clientHeight + 2 ? ov : (s || ov);
  }
  function atEnd(el) { return el.scrollTop + el.clientHeight >= el.scrollHeight - 6; }
  function decorate(ov, c) {
    var sc = ov.querySelector(c.sc); if (!sc) return;
    var has = sc.querySelector(':scope>.gcf-next,:scope>.gcf-end'), nb = nextBtn(ov);
    if (has) { if ((has.classList.contains('gcf-next')) === !!nb) return; has.remove(); }
    var d = document.createElement('div');
    if (nb) { d.className = 'gcf-next'; d.innerHTML = '⬇ ' + L('下一筆', 'Next', 'បន្ទាប់') + '<small>' + L('滑到底再往下拉，或點這裡', 'Keep scrolling down, or tap here', 'អូសចុះ ឬចុចទីនេះ') + '</small>'; d.onclick = function () { var b = nextBtn(ov); if (b) b.click(); }; }
    else { d.className = 'gcf-end'; d.textContent = '— ' + L('已經是最後一筆', 'This is the last one', 'នេះជាចុងក្រោយ') + ' —'; }
    sc.appendChild(d);
  }
  function hook(ov, c) {
    if (ov.__gcf) { decorate(ov, c); return; }
    ov.__gcf = true; addCss(); decorate(ov, c);
    var y0 = null, wheel = 0, wt = null, busy = false;
    function go() { if (busy) return; var b = nextBtn(ov); if (!b) return; busy = true; b.click(); setTimeout(function () { busy = false; }, 600); }
    ov.addEventListener('touchstart', function (e) { var s = scroller(ov, c); y0 = e.touches.length === 1 && atEnd(s) ? e.touches[0].clientY : null; }, { passive: true });
    ov.addEventListener('touchmove', function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0, h = ov.querySelector('.gcf-next'); if (h) h.classList.toggle('pull', dy < -40); }, { passive: true });
    ov.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy < -70) go(); }, { passive: true });
    ov.addEventListener('wheel', function (e) { var s = scroller(ov, c); if (e.deltaY > 0 && atEnd(s)) { wheel += e.deltaY; if (wheel > 320) { wheel = 0; go(); } } else wheel = 0; clearTimeout(wt); wt = setTimeout(function () { wheel = 0; }, 500); }, { passive: true });
    try { new MutationObserver(function () { decorate(ov, c); }).observe(ov, { childList: true, subtree: true }); } catch (e) {}
  }
  function scan() { CFG.forEach(function (c) { Array.prototype.forEach.call(document.querySelectorAll(c.ov), function (ov) { hook(ov, c); }); }); }

  /* 交通車／ETC：點記錄列的任何地方 → 開那一列的司機卡 */
  function rowToPeople(e) {
    var tr = e.target.closest && e.target.closest('tbody tr'); if (!tr) return;
    if (e.target.closest('td.pp-link,button,a,input,select,label,textarea')) return;
    var link = tr.querySelector('td.pp-link'); if (!link) return;
    link.click();
  }
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (page === 'transportation.html' || page === 'etc.html') document.addEventListener('click', rowToPeople);

  function boot() {
    scan();
    var t = null;
    try { new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; scan(); }, 120); }).observe(document.body, { childList: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  root.GACardFlow = { scan: scan };
})(window);
