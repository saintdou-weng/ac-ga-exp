/* ga-compact.js — 由 AC SEC 的 sec-compact.js 移植（2026-11-12，GA-EXP 用；核心相同，另加 auto()／cfg.bar／相關紀錄分頁）
   原說明：sec-compact.js — 手機精簡清單（2026-11-11，仿 VRT HR／PSJHR 員工頁）
   Paul：設備清單在手機上一台就佔一整個畫面、一堆按鈕佔空間 → 改成
     ① 上面只留「搜尋＋篩選」一小條（滑動時固定在上面），其他按鈕收進「⋯」
     ② 清單一筆一行，可以一直往下滑
     ③ 點一行 → 開詳細卡（全部欄位兩欄排列），上面有 20/106、◀ ▶ ✕，也可以左右滑換上一筆／下一筆
   精簡清單只在手機寬度（≤720px）啟用；電腦表格不變，但點一列一樣會開詳細卡（置中視窗）。不改資料、不改各頁原本的函式：
   畫面照各頁自己的表格產生，按鈕也是按各頁原本那一顆。
   用法：SEC.Compact.attach({ card:'#p-list .card', table:'#p-list table', kpis:'.fire-list-kpis',
           cols:{ check:0, title:[1,2], sub:[3,4], right:[10], wide:[4,6,9], actions:11 },
           tools:'#p-list .fire-master-tools', select:{ checkbox:'.fire-select', all:'…', del:'…' } }) */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || GA.Compact) return;
  var SEC = { lang:function () { return GA.lang || 'zh'; }, viewPhoto:function (i, im) { try { root.open(im.getAttribute('src'), '_blank'); } catch (e) {} } };
  var MQ = root.matchMedia ? root.matchMedia('(max-width:720px)') : { matches:false, addEventListener:function () {} };
  function L(zh, en, km) { var l = SEC.lang ? SEC.lang() : 'zh'; return l === 'en' ? en : l === 'km' ? (km || en) : zh; }
  function $(s, r) { return typeof s === 'string' ? (r || document).querySelector(s) : s; }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
  function arr(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

  var CSS = [
    '.cmp-more,.cmp-count,.cmp-selbar{display:none}',
    '.cmp-mask,.cmp-card,.cmp-selbar,.cmp-bar{--line:var(--ga-line,#dfe6ec);--ink:#1b2b3a;--ink2:#6b8398;--n1:#1e5f8e;--n2:#2b8fbd}',
    '.cmp-rel>div{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border-bottom:1px solid var(--line);font-size:13px}.cmp-rel>div b{font-weight:600;min-width:0;overflow-wrap:anywhere}.cmp-rel>div span{flex:none;font-weight:800;color:var(--n1)}.cmp-none{padding:14px 12px;color:var(--ink2);font-size:13px;margin:0}',
    '@media(max-width:720px){.cmp-bar{display:flex!important;flex-wrap:wrap!important;gap:6px!important;align-items:center}.cmp-bar button:not(.cmp-more):not(.cmp-stay),.cmp-bar a.btn,.cmp-bar label.btn{display:none!important}',
    '.cmp-bar .cmp-more{display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--n1);font-weight:800;font-size:13px;font-family:inherit;cursor:pointer;margin-left:auto}.cmp-bar input[type=search],.cmp-bar input[type=text]{flex:1 1 120px;min-width:0}}',
    '@media(max-width:720px){',
    /* KPI：四格一排，小一點 */
    '.cmp-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:6px!important;margin-bottom:8px!important}',
    '.cmp-kpis .kpi{padding:6px 2px!important;border-radius:9px}.cmp-kpis .kpi .v{font-size:17px!important}.cmp-kpis .kpi .l{font-size:9.5px!important;line-height:1.2;margin-top:1px}',
    /* 篩選列：固定在上面，一小條 */
    '.cmp-card{padding:0!important;overflow:visible!important}',
    '.cmp-card>h3{position:sticky;z-index:30;background:#fff;margin:0!important;padding:8px 10px 7px;border-bottom:1px solid var(--line);border-radius:12px 12px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px}',
    '.cmp-card>h3 .cmp-count{display:inline-block;margin-left:auto;font-size:11px;font-weight:700;color:var(--ink2);background:#eef4f8;border-radius:20px;padding:2px 9px}',
    '.cmp-card>h3 .sp{order:5;flex:1 1 100%;margin:0!important;display:flex!important;flex-wrap:wrap!important;gap:6px!important}',
    '.cmp-card>h3 .sp>button:not(.cmp-more),.cmp-card>h3 .sp>a,.cmp-card .cmp-tools-src{display:none!important}',
    '.cmp-card>h3 .sp>input{order:-2;flex:1 1 0!important;width:auto!important;min-width:0;height:38px;font-size:14px}',
    '.cmp-card>h3 .sp>.cmp-more{display:inline-flex;order:-1;flex:none;align-items:center;gap:4px;height:38px;padding:0 12px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--n1);font-weight:800;font-size:13px;font-family:inherit;cursor:pointer}',
    '.cmp-card>h3 .sp>.cmp-brk{order:0;flex:0 0 100%;height:0}',
    '.cmp-card>h3 .sp>select{order:1;flex:1 1 0!important;width:auto!important;min-width:0;height:34px;padding:4px 6px;font-size:12.5px}',
    /* 清單：一筆一行 */
    '.cmp-card .tw{border:0!important;border-radius:0 0 12px 12px;overflow:visible!important}',
    'table.cmp-table{display:block!important;min-width:0!important;width:100%!important;font-size:13px!important}',
    'table.cmp-table thead{display:none!important}table.cmp-table tbody{display:block!important}',
    'table.cmp-table tr{display:flex!important;align-items:center;gap:8px;margin:0!important;padding:9px 10px;border:0!important;border-bottom:1px solid #edf2f6!important;border-radius:0!important;background:#fff;min-height:52px;cursor:pointer;-webkit-tap-highlight-color:rgba(30,111,142,.12)}',
    'table.cmp-table tr:active{background:#f1f7fa}table.cmp-table tr:last-child{border-bottom:0!important;border-radius:0 0 12px 12px!important}',
    'table.cmp-table td{display:none!important;padding:0!important;border:0!important;width:auto!important;text-align:left!important;min-width:0}',
    'table.cmp-table td:before{content:none!important;display:none!important}',
    'table.cmp-table td.cmp-main{display:block!important;flex:1 1 0;min-width:0}',
    'table.cmp-table td.cmp-right{display:flex!important;flex:none;flex-direction:column;align-items:flex-end;gap:3px;max-width:42%}',
    'table.cmp-table td.cmp-go{display:block!important;flex:none;color:#a9b8c6;font-size:17px;line-height:1}',
    'table.cmp-table tr.cmp-empty{display:block!important;cursor:default}table.cmp-table tr.cmp-empty td{display:block!important;width:auto!important;max-width:100%;white-space:normal!important;overflow-wrap:anywhere;text-align:center!important;color:var(--ink2);padding:14px 6px!important}',
    '.cmp-t{font-weight:800;color:var(--n1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}',
    '.cmp-t code{font-size:13px;background:#eef4f8;border-radius:5px;padding:1px 6px}.cmp-t img{width:34px;height:34px;object-fit:cover;border-radius:7px;margin:0;flex:none}',
    '.cmp-s{font-size:11.5px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
    '.cmp-s br{display:none}.cmp-s small{font-size:inherit}.cmp-s .factory-pill{padding:0 6px;font-size:10.5px}',
    'table.cmp-table td.cmp-right .tag{white-space:nowrap}',
    /* 選取模式 */
    '.cmp-card.cmp-select table.cmp-table td.cmp-check{display:block!important;flex:none}.cmp-card.cmp-select table.cmp-table td.cmp-check input{width:22px;height:22px}',
    '.cmp-card.cmp-select table.cmp-table td.cmp-go{display:none!important}',
    '.cmp-selbar.on{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:60;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);box-shadow:0 -6px 18px rgba(15,43,70,.12)}',
    '.cmp-selbar button{flex:1 1 0;min-height:44px;border-radius:10px;border:1px solid var(--line);background:#fff;font-weight:800;font-family:inherit;font-size:13.5px;color:var(--n1)}',
    '.cmp-selbar button.err{background:#c0392b;border-color:#c0392b;color:#fff}.cmp-selbar button.pri{background:var(--n1);border-color:var(--n1);color:#fff}',
    '}',
    /* 工具選單（由下往上）與詳細卡 */
    '.cmp-mask{position:fixed;inset:0;z-index:950;background:rgba(15,43,70,.5);display:flex;align-items:flex-end;justify-content:center}',
    '.cmp-sheet{background:#fff;width:100%;max-width:560px;border-radius:16px 16px 0 0;max-height:82vh;overflow:auto;padding:6px 10px calc(12px + env(safe-area-inset-bottom));animation:cmpUp .18s ease-out}',
    '@keyframes cmpUp{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}',
    '.cmp-grip{width:42px;height:4px;border-radius:4px;background:#d5dee6;margin:6px auto 8px}',
    '.cmp-sheet h4{font-size:13px;color:var(--ink2);margin:2px 6px 6px;font-weight:800}',
    '.cmp-item{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:8px 10px;border:0;border-bottom:1px solid #edf2f6;background:#fff;font-family:inherit;font-size:14.5px;font-weight:700;color:var(--n1);text-align:left;cursor:pointer;border-radius:8px}',
    '.cmp-item:active{background:#f1f7fa}.cmp-item.err{color:#c0392b}.cmp-item:last-of-type{border-bottom:0}',
    '.cmp-note{font-size:11.5px;color:var(--ink2);line-height:1.5;margin:8px 8px 2px}',
    '.cmp-drawer{background:#f4f7fb;width:100%;max-width:640px;height:94vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;animation:cmpUp .18s ease-out;overflow:hidden}',
    '.cmp-dh{background:#fff;padding:8px 12px 10px;border-bottom:1px solid var(--line);flex:none}',
    '.cmp-nav{display:flex;align-items:center;gap:6px}.cmp-nav .cnt{margin-right:auto;font-size:13px;color:var(--ink2);font-weight:700;font-family:"DM Mono",monospace}',
    '.cmp-nav button{width:42px;height:38px;border:1px solid var(--line);border-radius:9px;background:#fff;font-size:15px;color:var(--n1);cursor:pointer;font-family:inherit}.cmp-nav button:disabled{opacity:.35}',
    '.cmp-prof{display:flex;gap:10px;align-items:center;margin-top:8px;min-width:0}.cmp-prof img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);flex:none}',
    '.cmp-prof .ttl{font-size:17px;font-weight:800;color:var(--n1);line-height:1.3;display:flex;flex-wrap:wrap;gap:6px;align-items:center}.cmp-prof .ttl img{display:none}.cmp-prof .ttl code{font-size:15px;background:#eef4f8;border-radius:6px;padding:1px 7px}',
    '.cmp-prof .sub{font-size:12.5px;color:var(--ink2);margin-top:3px;line-height:1.45}.cmp-prof .sub br{display:none}.cmp-prof .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}',
    '.cmp-db{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:6px 10px 40vh;position:relative}',
    '.cmp-rec{background:#fff;border:1px solid var(--line);border-radius:14px;margin:0 0 12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,43,70,.06)}',
    '.cmp-rec .cmp-prof{margin:0;padding:12px 12px 10px;border-bottom:1px solid #edf2f6;align-items:flex-start}.cmp-rec .cmp-prof .no{flex:none;font-size:11.5px;color:var(--ink2);font-weight:700;font-family:"DM Mono",monospace;background:#eef4f8;border-radius:20px;padding:2px 8px}',
    '.cmp-rec .cmp-kv{border:0;border-radius:0}',
    '.cmp-acts{display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid #edf2f6}.cmp-acts button{flex:1 1 0;min-height:42px;border-radius:10px;border:1px solid var(--n1);background:var(--n1);color:#fff;font-weight:800;font-family:inherit;font-size:14px;cursor:pointer}',
    '.cmp-acts button.gh{background:#fff;color:var(--n1);border-color:var(--line)}.cmp-acts button.err{background:#fff;color:#c0392b;border-color:#e8b4ad}',
    '.cmp-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:8px -12px -10px;padding:0 10px;border-top:1px solid #edf2f6}.cmp-tabs::-webkit-scrollbar{display:none}',
    '.cmp-tabs button{flex:none;border:0;background:transparent;padding:9px 10px 8px;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--ink2);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}',
    '.cmp-tabs button.on{color:var(--n1);border-bottom-color:var(--n2)}.cmp-tabs button i{font-style:normal;font-size:11px;background:#e8f2f7;color:var(--n2);border-radius:20px;padding:1px 7px;margin-left:2px}.cmp-tabs button i.z{background:#eef2f6;color:#9aa9b7}',
    '.cmp-body{min-height:60px}.cmp-none{color:var(--ink2);font-size:13px;text-align:center;padding:18px 10px;margin:0}',
    '.cmp-sum{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 0}.cmp-sum .tag{font-size:11.5px}',
    '.cmp-hist{list-style:none;margin:0;padding:6px 12px 10px}.cmp-hist li{padding:9px 0;border-bottom:1px solid #edf2f6}.cmp-hist li:last-child{border-bottom:0}',
    '.cmp-hist .h1{display:flex;align-items:center;gap:8px;font-weight:800;color:var(--n1);font-size:14px}.cmp-hist .h1 .who{margin-left:auto;font-weight:600;color:var(--ink2);font-size:12px}',
    '.cmp-hist .h2{font-size:13px;color:var(--ink);margin-top:3px;line-height:1.45;overflow-wrap:anywhere}.cmp-hist .h3{font-size:11.5px;color:var(--ink2);margin-top:3px}',
    '.cmp-hist li.bad{background:#fff7f6;margin:0 -12px;padding:9px 12px}.cmp-mon{font-size:11.5px;font-weight:800;color:var(--ink2);padding:10px 12px 0;margin:0}',
    '.cmp-ph{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px}.cmp-ph img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:zoom-in}',
    '.cmp-phsec{padding:10px 12px}.cmp-phsec h5{margin:0;font-size:12.5px;color:var(--n1);font-weight:800}.cmp-phsec h5 small{font-weight:600;color:var(--ink2);margin-left:6px}',
    '.cmp-end{text-align:center;color:var(--ink2);font-size:12px;margin:10px 0}',
    '.cmp-nav .now{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:800;color:var(--n1);font-size:13.5px}.cmp-nav .cnt{margin-right:0!important;flex:none}',
    '.cmp-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}',
    '.cmp-kv>div{min-width:0}.cmp-kv>div.w{grid-column:1/-1}.cmp-kv dt{font-size:11.5px;color:var(--ink2);font-weight:600;margin-bottom:2px}.cmp-kv dd{margin:0;font-size:14.5px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;line-height:1.4}',
    '.cmp-kv dd .hint{font-weight:400}.cmp-kv dd img{max-width:100%;border-radius:8px}',
    '.cmp-df{flex:none;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line)}',
    '.cmp-df button{flex:1 1 0;min-height:44px;border-radius:10px;border:1px solid var(--n1);background:var(--n1);color:#fff;font-weight:800;font-family:inherit;font-size:14px;cursor:pointer}',
    '.cmp-df button.gh{background:#fff;color:var(--n1);border-color:var(--line)}.cmp-df button.err{background:#fff;color:#c0392b;border-color:#e8b4ad}',
    /* 2026-11-11 電腦也能點一列開詳細卡（表格本身不變）：置中視窗 */
    '@media(min-width:721px){.cmp-mask{align-items:center}.cmp-drawer{height:90vh;max-width:820px;border-radius:16px}.cmp-sheet{border-radius:16px;margin-bottom:5vh}',
    'table.cmp-click tbody tr{cursor:pointer}table.cmp-click tbody tr:hover>td{background:#f1f7fa}.cmp-ph{grid-template-columns:repeat(4,minmax(0,1fr))}}',
    '.cmp-cmp{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px 2px}.cmp-cmp figure{margin:0;min-width:0;background:#f4f7fb;border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}',
    '.cmp-cmp figcaption{font-size:11.5px;font-weight:800;color:var(--n1);padding:6px 8px;line-height:1.35}.cmp-cmp figcaption small{display:block;font-weight:600;color:var(--ink2)}',
    '.cmp-cmp img{width:100%;aspect-ratio:4/3;object-fit:cover;cursor:zoom-in;display:block}.cmp-cmp .ph0{aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;text-align:center;color:#9aa9b7;font-size:12px;padding:8px;line-height:1.4}',
    '.cmp-addph{display:inline-flex;align-items:center;gap:5px;margin-top:8px;min-height:38px;padding:0 14px;border:1px dashed var(--n2);border-radius:9px;background:#f3f9fc;color:var(--n1);font-weight:800;font-size:13px;font-family:inherit;cursor:pointer}',
    '.cmp-strip{display:flex;flex-wrap:wrap;gap:3px;padding:8px 12px 2px}.cmp-strip i{width:15px;height:15px;border-radius:4px;background:#e6edf2;display:block}.cmp-strip i.ok{background:#35a56b}.cmp-strip i.bad{background:#d9483b}.cmp-strip i.warn{background:#e9a23b}.cmp-strip i.off{background:#9aa9b7}',
    '.cmp-bars{padding:6px 12px 10px}.cmp-bars .br{display:grid;grid-template-columns:54px 1fr auto;gap:8px;align-items:center;margin-top:7px;font-size:12.5px}.cmp-bars .br b{color:var(--n1)}.cmp-bars .bar{display:flex;height:14px;border-radius:7px;overflow:hidden;background:#edf2f6}.cmp-bars .bar span{display:block;height:100%}.cmp-bars .br small{color:var(--ink2);white-space:nowrap}'
  ].join('\n');
  function injectCss() { if (document.getElementById('cmpCss')) return; var s = document.createElement('style'); s.id = 'cmpCss'; s.textContent = CSS; document.head.appendChild(s); }

  var OPEN = null; /* 目前開著的選單／詳細卡 */
  function closeOverlay() { if (OPEN) { if (OPEN.onclose) OPEN.onclose(); OPEN.el.remove(); OPEN = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (!OPEN) return; if (e.key === 'Escape') closeOverlay(); else if (OPEN.step && e.key === 'ArrowLeft') OPEN.step(-1); else if (OPEN.step && e.key === 'ArrowRight') OPEN.step(1); }
  function overlay(inner, extra) {
    closeOverlay();
    var m = document.createElement('div'); m.className = 'cmp-mask'; m.setAttribute('data-noswipe', ''); m.appendChild(inner);
    m.addEventListener('click', function (e) { if (e.target === m) closeOverlay(); });
    document.body.appendChild(m); OPEN = Object.assign({ el:m }, extra || {}); document.addEventListener('keydown', onKey);
    return m;
  }
  function label(btn) { return (btn.textContent || '').replace(/\s+/g, ' ').trim(); }

  function attach(cfg) {
    injectCss();
    var card = $(cfg.card), table = $(cfg.table); if (!card || !table) return null;
    var tbody = table.tBodies[0], h3 = card.querySelector('h3'), bar = cfg.bar ? (typeof cfg.bar === 'string' ? (card.querySelector(cfg.bar) || document.querySelector(cfg.bar)) : cfg.bar) : null, sp = bar || (h3 && h3.querySelector('.sp')), cols = cfg.cols || {};
    var kpis = cfg.kpis ? $(cfg.kpis) : null, toolsSrc = cfg.tools ? $(cfg.tools) : null, sel = cfg.select || null;
    var more = null, count = null, selbar = null, on = false, painting = false;

    function rows() { return $$('tr', tbody).filter(function (tr) { return !tr.classList.contains('cmp-empty') && !(tr.children.length === 1 && tr.children[0].colSpan > 1); }); }
    function cellHtml(tr, i) { var td = tr.children[i]; return td ? td.innerHTML : ''; }
    function headLabel(i) { var th = table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[i]; return th ? (th.textContent || '').trim() : ''; }

    /* 每次各頁重畫表格後：把每一列整理成「一行」 */
    function paint() {
      if (!on || painting) return; painting = true;
      try {
        $$('tr', tbody).forEach(function (tr) {
          if (tr.querySelector('td.cmp-main') || tr.classList.contains('cmp-empty')) return;
          if (tr.children.length === 1 && tr.children[0].colSpan > 1) { tr.classList.add('cmp-empty'); return; }
          var main = document.createElement('td'); main.className = 'cmp-main';
          main.innerHTML = '<div class="cmp-t">' + arr(cols.title).map(function (i) { return '<span>' + cellHtml(tr, i) + '</span>'; }).join('') + '</div>' +
            '<div class="cmp-s">' + arr(cols.sub).map(function (i) { return cellHtml(tr, i); }).filter(function (x) { return x && x.replace(/<[^>]+>/g, '').trim() && x.replace(/<[^>]+>/g, '').trim() !== '—'; }).join(' · ') + '</div>';
          var right = document.createElement('td'); right.className = 'cmp-right';
          right.innerHTML = arr(cols.right).map(function (i) { return cellHtml(tr, i); }).filter(function (x) { var t = x.replace(/<[^>]+>/g, '').trim(); return t && t !== '—'; }).join('');
          var go = document.createElement('td'); go.className = 'cmp-go'; go.textContent = '›';
          if (cols.check != null && tr.children[cols.check]) tr.children[cols.check].classList.add('cmp-check');
          tr.appendChild(main); tr.appendChild(right); tr.appendChild(go);
        });
        if (count) count.textContent = rows().length + ' ' + L('筆', 'items', 'ធាតុ');
      } finally { painting = false; }
    }
    function unpaint() { $$('td.cmp-main,td.cmp-right,td.cmp-go', tbody).forEach(function (td) { td.remove(); }); $$('.cmp-check', tbody).forEach(function (td) { td.classList.remove('cmp-check'); }); $$('tr.cmp-empty', tbody).forEach(function (tr) { tr.classList.remove('cmp-empty'); }); }

    /* 詳細卡（仿 VRT HR 員工卡）。2026-11-11 Paul：要能「往下滑」看下一筆，不要只能按 ◀ ▶
       → 每一筆一張卡、上下相連，手指一直往下滑就是下一筆、往上滑是上一筆；
         上面固定顯示現在看到第幾筆（3/97）與名稱；◀ ▶、鍵盤左右鍵、左右滑也都還能用。 */
    /* 2026-11-11 Paul：詳細卡要像員工資料有分頁，把「現在」跟「歷史」分開（現況／歷史紀錄／異常／照片）。
       分頁由各頁提供：cfg.tabs=[{key,label(),count(tr),render(tr)}]；第一頁固定是「現況」（表格欄位）。 */
    var TABS = [{ key:'info', label:function () { return '📋 ' + L('現況', 'Current', 'បច្ចុប្បន្ន'); } }].concat(cfg.tabs || []), tabKey = 'info';
    function curTab() { for (var i = 0; i < TABS.length; i++) if (TABS[i].key === tabKey) return TABS[i]; return TABS[0]; }
    function tabBody(tab, tr, k) { try { return tab.render(tr, k) || ''; } catch (e) { return '<p class="cmp-none">⚠ ' + esc(e.message) + '</p>'; } }
    function cardHtml(tr, k, total) {
      var tab = curTab();
      var n = $$(':scope > td:not(.cmp-main):not(.cmp-right):not(.cmp-go)', tr).length, skip = {}, wide = arr(cols.wide), kv = '';
      [cols.check, cols.actions].forEach(function (i) { if (i != null) skip[i] = 1; });
      for (var i = 0; i < n; i++) {
        if (skip[i]) continue; var lb = headLabel(i); if (!lb) continue;
        var v = cellHtml(tr, i).replace(/<img[^>]*>/g, ''); if (!v.replace(/<[^>]+>/g, '').trim()) v = '—';
        kv += '<div' + (wide.indexOf(i) >= 0 ? ' class="w"' : '') + '><dt>' + esc(lb) + '</dt><dd>' + v + '</dd></div>';
      }
      var img = tr.querySelector('img'), acts = cols.actions != null && tr.children[cols.actions] ? $$('button,a', tr.children[cols.actions]) : [];
      return '<section class="cmp-rec" data-k="' + k + '"><div class="cmp-prof">' + (img ? '<img src="' + esc(img.getAttribute('src')) + '" alt="">' : '') +
        '<div style="min-width:0;flex:1 1 0"><div class="ttl">' + arr(cols.title).map(function (i) { return '<span>' + cellHtml(tr, i) + '</span>'; }).join('') + '</div>' +
        '<div class="sub">' + arr(cols.sub).map(function (i) { return cellHtml(tr, i); }).filter(Boolean).join(' · ') + '</div>' +
        '<div class="chips">' + arr(cols.right).map(function (i) { return cellHtml(tr, i); }).join('') + '</div></div><span class="no">' + (k + 1) + '/' + total + '</span></div>' +
        '<div class="cmp-body">' + (tab && tab.render ? tabBody(tab, tr, k) : '<dl class="cmp-kv">' + kv + '</dl>') + '</div>' +
        (acts.length ? '<div class="cmp-acts">' + acts.map(function (b, j) { return '<button type="button" data-act="' + j + '" class="' + (/\berr\b/.test(b.className) ? 'err' : j ? 'gh' : '') + '">' + b.innerHTML + (label(b).replace(/[^\w㐀-鿿ក-៿]/g, '') ? '' : ' ' + esc(b.title || b.getAttribute('aria-label') || (/🗑|\berr\b|del/i.test(b.innerHTML + ' ' + b.className + ' ' + (b.getAttribute('onclick') || '')) ? L('刪除', 'Delete', 'លុប') : L('編輯', 'Edit', 'កែ')))) + '</button>'; }).join('') + '</div>' : '') +
        '</section>';
    }
    function openDetail(index) {
      var list = rows(); if (!list.length) return;
      index = Math.max(0, Math.min(list.length - 1, index));
      var total = list.length, cur = index;
      var d = document.createElement('div'); d.className = 'cmp-drawer';
      d.innerHTML = '<div class="cmp-dh"><div class="cmp-nav"><span class="cnt"></span><span class="now"></span>' +
        '<button type="button" data-step="-1" aria-label="Previous">◀</button><button type="button" data-step="1" aria-label="Next">▶</button>' +
        '<button type="button" data-x aria-label="Close">✕</button></div>' +
        (TABS.length > 1 ? '<div class="cmp-tabs" data-noswipe></div>' : '') + '</div>' +
        '<div class="cmp-db">' + list.map(function (tr, k) { return cardHtml(tr, k, total); }).join('') +
        '<p class="cmp-end">' + esc(L('— 最後一筆 —', '— End of list —', '— ចប់បញ្ជី —')) + '</p></div>';
      var body = d.querySelector('.cmp-db'), cnt = d.querySelector('.cnt'), now = d.querySelector('.now'), prev = d.querySelector('[data-step="-1"]'), next = d.querySelector('[data-step="1"]');
      var recs = $$('.cmp-rec', body), tabBar = d.querySelector('.cmp-tabs');
      function paintTabs() {
        if (!tabBar) return; var tr = list[cur];
        tabBar.innerHTML = TABS.map(function (t) { var n = t.count ? t.count(tr, cur) : null; return '<button type="button" data-tab="' + t.key + '" class="' + (t.key === tabKey ? 'on' : '') + '">' + esc(t.label()) + (n != null ? ' <i' + (n ? '' : ' class="z"') + '>' + n + '</i>' : '') + '</button>'; }).join('');
      }
      function setTab(key) {
        if (key === tabKey) return; tabKey = key; var tab = curTab();
        recs.forEach(function (rec, k) { var tr = list[k], bd = rec.querySelector('.cmp-body'); if (!bd) return; if (tab.render) bd.innerHTML = tabBody(tab, tr, k); else { var tmp = document.createElement('div'); tmp.innerHTML = cardHtml(tr, k, total); bd.innerHTML = tmp.querySelector('.cmp-body').innerHTML; } });
        paintTabs(); go(cur, false);
      }
      function head() {
        paintTabs();
        cnt.textContent = (cur + 1) + '/' + total; prev.disabled = cur <= 0; next.disabled = cur >= total - 1;
        var t = recs[cur] && recs[cur].querySelector('.ttl'); now.textContent = t ? $$(':scope > span', t).map(function (x) { return (x.textContent || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).join(' ') : '';
      }
      function go(k, smooth) { k = Math.max(0, Math.min(total - 1, k)); cur = k; head(); body.scrollTo({ top:recs[k].offsetTop - 6, behavior:smooth ? 'smooth' : 'auto' }); }
      function step(dir) { go(cur + dir, true); }
      overlay(d, { step:step, rerender:function () { var tab = curTab(); recs.forEach(function (rec, k) { var bd = rec.querySelector('.cmp-body'); if (bd && tab.render) bd.innerHTML = tabBody(tab, list[k], k); }); paintTabs(); } });
      go(index, false);
      /* 往下滑：看到哪一張，上面的 3/97 就跟著變 */
      var tick = 0;
      body.addEventListener('scroll', function () {
        if (tick) return; tick = requestAnimationFrame(function () {
          tick = 0; var line = body.scrollTop + body.clientHeight * 0.3, k = cur;
          while (k < total - 1 && recs[k + 1].offsetTop <= line) k++;
          while (k > 0 && recs[k].offsetTop > line) k--;
          if (k !== cur) { cur = k; head(); }
        });
      }, { passive:true });
      d.addEventListener('click', function (e) {
        var im = e.target.closest('.cmp-body img'); if (im && SEC.viewPhoto) return SEC.viewPhoto(0, im);
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-x')) return closeOverlay();
        if (b.dataset.step) return step(+b.dataset.step);
        if (b.dataset.tab) return setTab(b.dataset.tab);
        if (b.dataset.act != null) {
          var rec = b.closest('.cmp-rec'), tr = rows()[+rec.dataset.k], src = tr && tr.children[cols.actions] ? $$('button,a', tr.children[cols.actions])[+b.dataset.act] : null;
          closeOverlay(); if (src) src.click();
        }
      });
      /* 左右滑也可以換筆（上下捲動不受影響） */
      var sx = 0, sy = 0, st = 0;
      d.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) { st = 0; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive:true });
      d.addEventListener('touchend', function (e) {
        if (!st) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st; st = 0;
        if (dt < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) step(dx < 0 ? 1 : -1);
      }, { passive:true });
    }

    /* 「⋯」工具選單：把原本排在上面的按鈕收進來，按下去就是按原本那一顆 */
    function toolButtons() {
      var list = sp ? (bar ? $$('button:not(.cmp-more):not(.cmp-stay), a.btn, label.btn', sp) : $$(':scope > button:not(.cmp-more), :scope > a', sp)) : [];
      if (toolsSrc) list = list.concat($$('button,a', toolsSrc));
      var hide = sel ? [$(sel.all), $(sel.del)].filter(Boolean) : [];
      return list.filter(function (b) { return hide.indexOf(b) < 0; });
    }
    function openTools() {
      var btns = toolButtons(), s = document.createElement('div'); s.className = 'cmp-sheet';
      var note = toolsSrc && toolsSrc.querySelector('.hint');
      s.innerHTML = '<div class="cmp-grip"></div><h4>' + esc(L('工具', 'Tools', 'ឧបករណ៍')) + '</h4>' +
        btns.map(function (b, i) { return '<button type="button" class="cmp-item' + (/\berr\b/.test(b.className) ? ' err' : '') + '" data-i="' + i + '">' + b.innerHTML + '</button>'; }).join('') +
        (sel ? '<button type="button" class="cmp-item" data-sel>☑️ ' + esc(L('選取多筆（批次刪除）', 'Select several (batch delete)', 'ជ្រើសច្រើន (លុបជាក្រុម)')) + '</button>' : '') +
        (note ? '<p class="cmp-note">ⓘ ' + esc(note.textContent.trim()) + '</p>' : '');
      overlay(s);
      s.addEventListener('click', function (e) {
        var b = e.target.closest('.cmp-item'); if (!b) return;
        closeOverlay();
        if (b.hasAttribute('data-sel')) return selectMode(true);
        var src = btns[+b.dataset.i]; if (src) src.click();
      });
    }
    function selectMode(want) {
      card.classList.toggle('cmp-select', !!want);
      if (!selbar) {
        selbar = document.createElement('div'); selbar.className = 'cmp-selbar'; selbar.setAttribute('data-noswipe', '');
        document.body.appendChild(selbar);
        selbar.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.k === 'all') { var a = $(sel.all); if (a) a.click(); }
          else if (b.dataset.k === 'del') { var x = $(sel.del); if (x) x.click(); }
          else selectMode(false);
        });
      }
      selbar.innerHTML = '<button type="button" data-k="all">☑️ ' + esc(L('全選', 'Select all', 'ជ្រើសទាំងអស់')) + '</button><button type="button" class="err" data-k="del">🗑 ' + esc(L('刪除所選', 'Delete selected', 'លុបដែលបានជ្រើស')) + '</button><button type="button" class="pri" data-k="done">' + esc(L('完成', 'Done', 'រួចរាល់')) + '</button>';
      selbar.classList.toggle('on', !!want);
      if (!want) $$(sel.checkbox, tbody).forEach(function (cb) { cb.checked = false; });
    }

    function stickyTop() { var t = document.querySelector('.tabs'); if (!h3) return; var top = 0; if (t && getComputedStyle(t).position === 'sticky') top = t.getBoundingClientRect().height; h3.style.top = top + 'px'; }
    function enable() {
      if (on) return; on = true;
      card.classList.add('cmp-card'); table.classList.add('cmp-table'); if (kpis) kpis.classList.add('cmp-kpis'); if (toolsSrc) toolsSrc.classList.add('cmp-tools-src');
      if (sp && !more) {
        more = document.createElement('button'); more.type = 'button'; more.className = 'cmp-more'; more.onclick = openTools; sp.appendChild(more); if (bar) { bar.classList.add('cmp-bar'); $$('button', bar).forEach(function (b) { if (/^[\s◀▶‹›«»<>←→]*$/.test(b.textContent || '') || /\bon\b|\bactive\b|seg|tab|chip|pt\b/.test(b.className) || b.hasAttribute('data-pt')) b.classList.add('cmp-stay'); }); if (!toolButtons().length) more.style.display = 'none'; }
        var brk = document.createElement('span'); brk.className = 'cmp-brk'; sp.appendChild(brk);
      }
      if (h3 && !count) { count = document.createElement('span'); count.className = 'cmp-count'; h3.insertBefore(count, sp || null); }
      relabel(); stickyTop(); paint();
    }
    function disable() {
      if (!on) return; on = false; closeOverlay(); if (sel) selectMode(false);
      card.classList.remove('cmp-card', 'cmp-select'); table.classList.remove('cmp-table'); if (kpis) kpis.classList.remove('cmp-kpis'); if (toolsSrc) toolsSrc.classList.remove('cmp-tools-src');
      if (h3) h3.style.top = ''; unpaint();
    }
    function relabel() { if (more) more.innerHTML = '⋯ ' + esc(L('工具', 'Tools', 'ឧបករណ៍')); }
    function sync() { if (MQ.matches) enable(); else disable(); }

    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr'); if (!tr || tr.classList.contains('cmp-empty')) return;
      if (!on) { if (cfg.desktop === false || e.target.closest('button,a,input,select,label,img') || (tr.children.length === 1 && tr.children[0].colSpan > 1)) return; if (root.getSelection && String(root.getSelection())) return; openDetail(rows().indexOf(tr)); return; }
      if (card.classList.contains('cmp-select')) { var cb = tr.querySelector(sel.checkbox); if (cb && e.target !== cb) cb.checked = !cb.checked; return; }
      if (e.target.closest('button,a,input,select,label')) return;
      openDetail(rows().indexOf(tr));
    });
    new MutationObserver(function () { if (on && !painting) { paint(); relabel(); } }).observe(tbody, { childList:true });
    if (MQ.addEventListener) MQ.addEventListener('change', sync); else if (MQ.addListener) MQ.addListener(sync);
    root.addEventListener('resize', function () { if (on) stickyTop(); });
    if (cfg.desktop !== false) table.classList.add('cmp-click');
    sync();
    return { refresh:paint, open:openDetail, openWhere:function (fn, tab) { var list = rows(); for (var i = 0; i < list.length; i++) if (fn(list[i])) { if (tab) tabKey = tab; openDetail(i); return true; } return false; }, tab:function (k) { tabKey = k; }, tools:openTools, isOn:function () { return on; }, selectMode:selectMode };
  }
  /* ── GA-EXP 2026-11-12：各頁表格常整張重畫 → auto() 盯著容器，表格一出現就自動套用。
     欄位用表頭自動判斷：勾選欄＝含 checkbox 的欄；操作欄＝含按鈕的最後一欄；
     標題＝前兩個資料欄、副標＝接著三欄、右側＝最後一個資料欄。各頁可用 cfg.cols 覆寫。
     內建分頁「🗓 相關紀錄」＝同一張表裡標題相同的其他列（同司機／同設備／同品項）。 */
  var DONE = typeof WeakSet !== 'undefined' ? new WeakSet() : { has:function () { return false; }, add:function () {} };
  function guessCols(table) {
    var body = table.tBodies[0], tr = body && $$('tr', body).filter(function (r) { return r.children.length > 1; })[0];
    var n = table.tHead && table.tHead.rows[0] ? table.tHead.rows[0].cells.length : (tr ? tr.children.length : 0), check = null, actions = null, data = [];
    for (var i = 0; i < n; i++) {
      var td = tr && tr.children[i];
      if (td && td.querySelector('input[type=checkbox]') && check == null) { check = i; continue; }
      if (td && td.querySelector('button,a.btn,a[onclick]') && !(td.textContent || '').replace(/\s+/g, '').replace(/[✏️🗑️✕×📎👁️]/g, '').slice(8)) { actions = i; continue; }
      data.push(i);
    }
    /* 依內容判斷每一欄是「序號／日期／數字金額／文字」：標題＝內容最多樣的文字欄（品名、司機、設備），
       副標＝日期＋其他文字欄，右側＝金額或數量欄（表頭含 金額／合計／Amount／Total／L／Qty 優先，否則最後一個數字欄）。 */
    var sample = $$('tr', body).filter(function (r) { return r.children.length > 1; }).slice(0, 12), kind = {}, uniq = {};
    function head(i) { var th = table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[i]; return th ? (th.textContent || '').trim() : ''; }
    data.forEach(function (i) {
      var vals = sample.map(function (r) { return r.children[i] ? (r.children[i].textContent || '').replace(/\s+/g, ' ').trim() : ''; }).filter(function (v) { return v && v !== '—' && v !== '-'; });
      var h = head(i), d = 0, nmb = 0, seen = {};
      vals.forEach(function (v) { if (/^\d{4}[-\/]\d{1,2}([-\/]\d{1,2})?/.test(v) || /^\d{1,2}[-\/]\d{1,2}$/.test(v)) d++; else if (/^[\s$¥€៛+\-−]*[\d,]+(\.\d+)?\s*[%A-Za-z³\/]{0,6}$/.test(v)) nmb++; seen[v] = 1; });
      kind[i] = /^(#|no\.?|序|項次)$/i.test(h) ? 'idx' : !vals.length ? 'empty' : d >= vals.length * 0.6 ? 'date' : nmb >= vals.length * 0.6 ? 'num' : 'text';
      uniq[i] = Object.keys(seen).length / (vals.length || 1);
    });
    var texts = data.filter(function (i) { return kind[i] === 'text'; }), nums = data.filter(function (i) { return kind[i] === 'num'; }), dates = data.filter(function (i) { return kind[i] === 'date'; });
    var title = texts.slice(0, 4).sort(function (a, b2) { return uniq[b2] - uniq[a] || a - b2; })[0];
    if (title == null) title = data.filter(function (i) { return kind[i] !== 'idx'; })[0];
    var amt = nums.filter(function (i) { return /金額|合計|總|amount|total|cost|price|\bL\b|升|liters?|qty|數量/i.test(head(i)); });
    var right = amt.length ? amt[amt.length > 1 && /金額|合計|總|amount|total/i.test(head(amt[amt.length - 1])) ? amt.length - 1 : 0] : nums[nums.length - 1];
    var cols = { title:title == null ? [] : [title], sub:dates.slice(0, 1).concat(texts.filter(function (i) { return i !== title; }).slice(0, 3)), right:right == null ? [] : [right] };
    if (check != null) cols.check = check; if (actions != null) cols.actions = actions;
    return cols;
  }
  function titleKey(tr, cols) { var i = arr(cols.title)[0], td = tr.children[i]; return td ? (td.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() : ''; }
  function relatedTab(table, cols) {
    function same(tr) { var k = titleKey(tr, cols); if (!k || k === '—') return []; return $$('tr', table.tBodies[0]).filter(function (r) { return r !== tr && r.children.length > 1 && titleKey(r, cols) === k; }); }
    function txt(tr, list) { return arr(list).map(function (i) { return tr.children[i] ? (tr.children[i].textContent || '').replace(/\s+/g, ' ').trim() : ''; }).filter(function (v) { return v && v !== '—'; }); }
    return { key:'rel', label:function () { return '🗓 ' + L('相關紀錄', 'Related', 'ពាក់ព័ន្ធ'); }, count:function (tr) { return same(tr).length; },
      render:function (tr) { var list = same(tr); if (!list.length) return '<p class="cmp-none">' + esc(L('這張表裡沒有其他同名紀錄', 'No other records with the same name in this list', 'គ្មានកំណត់ត្រាផ្សេងទៀត')) + '</p>';
        return '<div class="cmp-rel">' + list.slice(0, 60).map(function (r) { return '<div><b>' + esc(txt(r, arr(cols.title).slice(1).concat(arr(cols.sub))).join(' · ')) + '</b><span>' + esc(txt(r, cols.right).join(' ')) + '</span></div>'; }).join('') + (list.length > 60 ? '<p class="cmp-none">+' + (list.length - 60) + '</p>' : '') + '</div>'; } };
  }
  /* 表格上方最近的一條按鈕列（同一層往前找兩個、再往上一層找兩個）；裡面不能有表格 */
  function findBar(table) {
    var node = table, depth = 0;
    while (node && node !== document.body && depth < 4) {
      var p = node.previousElementSibling, hops = 0;
      while (p && hops < 3) {
        if (!p.querySelector('table') && !p.classList.contains('cmp-bar') && p.querySelector('button') && p.offsetParent !== null && $$('button', p).length <= 14) return p;
        p = p.previousElementSibling; hops++;
      }
      node = node.parentElement; depth++;
    }
    return null;
  }
  var PAGES = {
    'fuel.html':        { table:'table:has(>#rBody),table:has(>#dBody),table:has(>#wBody),table:has(>#pBody)' },
    'expense.html':     { table:'table.exp-table:not(.exp-trend-table)' },
    'maintenance.html': { table:'table.rtable,table.htable' },
    'procurement.html': { table:'table.inv-table' },
    'receiving.html':   { table:'#items-table,.table-wrap>table' },
    'damage.html':      { table:'.tablewrap>table' }
  };
  function boot() { var f = (location.pathname.split('/').pop() || 'index.html').toLowerCase(), c = PAGES[f]; if (c && !root.GA_NO_COMPACT) { try { auto(c); } catch (e) { console.warn('[ga-compact]', e); } } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
  function auto(cfg) {
    injectCss();
    function scan() {
      $$(cfg.table).forEach(function (table) {
        if (DONE.has(table) || !table.tBodies[0] || !table.tHead) return;
        var hasRow = $$('tr', table.tBodies[0]).some(function (r) { return r.children.length > 1; });
        if (table.tBodies[0].querySelector('input:not([type=checkbox]),select,textarea')) return;   /* 列內可直接輸入的表（下單數量等）不動 */
        if (table.closest('.ga-modal,.cmp-mask,[data-nocompact]')) return;
        if (!hasRow && !cfg.cols) return;                      /* 還沒有資料列：等有資料再判斷欄位 */
        DONE.add(table);
        var cols = cfg.cols || guessCols(table), card = cfg.card ? table.closest(cfg.card) : table.parentNode;
        attach({ card:card || table.parentNode, table:table, cols:cols, bar:cfg.bar || findBar(table), kpis:cfg.kpis, desktop:cfg.desktop === true,
          tabs:(cfg.tabs || []).concat(cfg.related === false ? [] : [relatedTab(table, cols)]) });
      });
    }
    var t = 0; new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = 0; scan(); }, 120); }).observe(document.body, { childList:true, subtree:true });
    scan();
  }
  GA.Compact = { attach:attach, auto:auto, close:closeOverlay, rerender:function () { if (OPEN && OPEN.rerender) OPEN.rerender(); } };
})(typeof window !== 'undefined' ? window : this);
