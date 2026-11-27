/* item-links.js — 跨平台「同編號」共用照片與備註  2026-11-27
   Paul 11/27：資產有的就用同一個編號（不一定照工務編），照片和備註在資產、工務／總務設備工具、
   人資配發（PPE、廠牌等）之間共用。
   做法：各平台資料還是各自存在自己的雲端，這裡只「讀」別的平台（GET，唯讀，不寫別人的資料），
   用編號對起來顯示。人資品項可另填「連結編號」對到資產或工務那一筆。
   雲端讀法：smartManifest → 只下載 hash 有變的 bucket（有更才更），舊式 pull 當備援。 */
(function (g) {
  'use strict';
  if (g.ItemLinks) return;
  var SEC = 'https://script.google.com/macros/s/AKfycbyxBN_t2AfxTPQ3AYdt7Jxl3pNiJV17H1T0pub4SR8GBgDH47WnDn9JF556KSxUiIU-/exec';
  var GCK = 'https://script.google.com/macros/s/AKfycbzRsf_DuYJu0kXxqefR8qbLWhO7uz2flCY7jkPQQ73ZMwptcHDwrtJnhBQFwxG_EM3v/exec';
  var BASE = 'https://saintdou-weng.github.io/';
  function hraUrl() { try { return (localStorage.getItem('vrt_att_cloud_v1_url') || localStorage.getItem('ac_hra_gas_url') || '').trim(); } catch (e) { return ''; } }
  function arr(v) { if (!v) return []; if (Array.isArray(v)) return v.filter(function (x) { return typeof x === 'string' && x; }); return typeof v === 'string' ? [v] : []; }
  var SRC = [
    { id: 'asset', url: function () { return GCK; }, tool: 'asset', ic: '🏷️', n: ['資產', 'Assets', 'ទ្រព្យសម្បត្តិ'], page: BASE + 'ac-gascheck/ac_gascheck_asset_v2.html',
      map: function (r) { return { code: r.code, name: r.name, loc: r.location, note: r.remark, photos: arr(r.photos), more: [r.brand, r.model, r.category].filter(Boolean).join(' · ') }; } },
    { id: 'ga_facility_equipment', url: function () { return SEC; }, tool: 'ga_facility_equipment', ic: '🔧', n: ['工務／總務設備工具', 'Facility equipment & tools', 'ឧបករណ៍ជួសជុល'], page: BASE + 'ac-ga-exp/facility.html?tab=eq',
      map: function (r) { return { code: r.code, name: r.name || r.sub, loc: r.loc, note: r.note, photos: arr(r.photos), more: [r.sub, r.brand, r.model].filter(Boolean).join(' · ') }; } },
    { id: 'ga_facility_mep', url: function () { return SEC; }, tool: 'ga_facility_mep', ic: '💡', n: ['水電設施', 'Water & electrical', 'ទឹក និងអគ្គិសនី'], page: BASE + 'ac-ga-exp/facility.html?tab=mep',
      map: function (r) { return { code: r.code, name: r.name || r.sub, loc: r.loc, note: r.note, photos: arr(r.photos), more: [r.sub, r.brand, r.model].filter(Boolean).join(' · ') }; } },
    { id: 'issue', url: hraUrl, tool: 'issue', ic: '🪪', n: ['人資配發', 'HR issuance', 'ការចែកជូន HR'], page: BASE + 'ac-hra-portal/ac_hra_issue_v1.html',
      keep: function (r) { return r._kind === 'item'; },
      local: function () { try { var d = JSON.parse(localStorage.getItem('ac_hra_issue_v1') || 'null'); return d && d.recs ? d.recs : null; } catch (e) { return null; } },
      map: function (r) { return { code: r.code, link: r.link, name: [r.zh, r.en].filter(Boolean).join(' / '), loc: '', note: r.note, photos: arr(r.photo).concat(arr(r.photos)), more: [r.spec, r.unit].filter(Boolean).join(' · ') }; } }
  ];
  var CK = 'ac_item_links_v1', TTL = 10 * 60 * 1000;
  var C = {}; try { C = JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch (e) { C = {}; }
  function persist() { try { localStorage.setItem(CK, JSON.stringify(C)); } catch (e) { /* 太大就只留在記憶體 */ } }
  function norm(c) { return String(c == null ? '' : c).toUpperCase().replace(/\s+/g, ''); }
  function lang() { try { if (g.ItemLinks && g.ItemLinks.lang) return g.ItemLinks.lang(); } catch (e) {} var l = (document.documentElement.lang || '').toLowerCase(); return /^en/.test(l) ? 'en' : /^km/.test(l) ? 'km' : 'zh'; }
  function L(a) { var l = lang(); return l === 'en' ? a[1] : l === 'km' ? (a[2] || a[1]) : a[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getJ(u) { return fetch(u, { redirect: 'follow' }).then(function (r) { return r.json(); }).then(function (j) { return j && j.data && !j.records && !j.hashes ? j.data : j; }); }
  function readSource(s) {
    var u = s.url(); if (!u) return Promise.resolve(null);
    var c = C[s.id] || (C[s.id] = { b: {}, h: {} });
    var q = u + (u.indexOf('?') < 0 ? '?' : '&');
    return getJ(q + 'action=smartManifest&tool=' + encodeURIComponent(s.tool)).then(function (m) {
      var hs = (m && m.hashes) || null;
      if (!hs) throw new Error('no manifest');
      var need = Object.keys(hs).filter(function (k) { return c.h[k] !== hs[k] || !c.b[k]; });
      Object.keys(c.b).forEach(function (k) { if (!(k in hs)) { delete c.b[k]; delete c.h[k]; } });
      return Promise.all(need.map(function (k) {
        return getJ(q + 'action=smartBucket&tool=' + encodeURIComponent(s.tool) + '&bucket=' + encodeURIComponent(k)).then(function (b) { c.b[k] = slim(s, (b && b.records) || []); c.h[k] = hs[k]; });
      }));
    }).catch(function () {
      return getJ(q + 'action=pull&tool=' + encodeURIComponent(s.tool)).then(function (j) { var R = (j && (j.records || j.list)) || []; c.b = { all: slim(s, R) }; c.h = { all: 'pull' }; });
    }).then(function () { c.at = Date.now(); });
  }
  function slim(s, R) { return R.filter(function (r) { return r && !r._deleted && !r._del && r.code && (!s.keep || s.keep(r)); }).map(function (r) { var m = s.map(r); m.code = norm(m.code); if (m.link) m.link = norm(m.link); return m; }); }
  function rows(s) {
    var out = []; var c = C[s.id];
    if (c && c.b) Object.keys(c.b).forEach(function (k) { out = out.concat(c.b[k] || []); });
    if (s.local) { var lr = s.local(); if (lr) { var seen = {}; var loc = slim(s, lr); loc.forEach(function (r) { seen[r.code] = 1; }); out = loc.concat(out.filter(function (r) { return !seen[r.code]; })); } }
    var by = {}; out.forEach(function (r) { by[r.code] = r; }); return Object.keys(by).map(function (k) { return by[k]; });
  }
  var busy = null, subs = [];
  function load(force) {
    if (busy) return busy;
    var todo = SRC.filter(function (s) { var c = C[s.id]; return force || !c || !c.at || Date.now() - c.at > TTL; });
    if (!todo.length) return Promise.resolve();
    busy = Promise.all(todo.map(function (s) { return readSource(s).catch(function () {}); })).then(function () { persist(); busy = null; subs.forEach(function (f) { try { f(); } catch (e) {} }); });
    return busy;
  }
  /* codes：這一筆的編號（和它的連結編號）；exclude：自己這個平台的 id，不列自己 */
  function find(codes, exclude) {
    var ks = [].concat(codes || []).map(norm).filter(Boolean); if (!ks.length) return [];
    var out = [];
    SRC.forEach(function (s) { if (s.id === exclude) return; rows(s).forEach(function (r) { if (ks.indexOf(r.code) >= 0 || (r.link && ks.indexOf(r.link) >= 0)) out.push(Object.assign({ src: s }, r)); }); });
    /* 對到的那筆若自己也有連結編號（人資品項 → 資產），再帶出一層 */
    out.slice().forEach(function (r) { if (r.link && ks.indexOf(r.link) < 0) SRC.forEach(function (s) { if (s.id === exclude) return; rows(s).forEach(function (x) { if (x.code === r.link && !out.some(function (o) { return o.src === s && o.code === x.code; })) out.push(Object.assign({ src: s }, x)); }); }); });
    return out;
  }
  function options(exclude) { var out = []; SRC.forEach(function (s) { if (s.id === exclude) return; rows(s).forEach(function (r) { out.push({ code: r.code, name: r.name, src: s.id, label: s.ic + ' ' + L(s.n), r: r }); }); }); return out; }
  function zoom(src) { var d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.88);display:grid;place-items:center;cursor:zoom-out'; d.innerHTML = '<img src="' + esc(src) + '" style="max-width:94vw;max-height:90vh;border-radius:12px">'; d.onclick = function () { d.remove(); }; document.body.appendChild(d); }
  function html(codes, exclude) {
    var m = find(codes, exclude);
    var head = '<div class="il-h" style="font-weight:800;font-size:13px;margin:12px 0 6px">🔗 ' + esc(L(['其他平台同編號', 'Same code on other platforms', 'លេខកូដដូចគ្នានៅវេទិកាផ្សេង'])) + '</div>';
    if (!m.length) return head + '<div style="font-size:12px;color:#94a3b8">' + esc(L(['還沒有。資產已有的物品，編號請用資產那一個，照片和備註就會兩邊一起看得到。', 'None yet. If the item is already in Assets, use the asset code here so photos and notes show on both sides.', 'មិនទាន់មាន។ ប្រើលេខកូដទ្រព្យសម្បត្តិ ដើម្បីចែករំលែករូបថត និងកំណត់ចំណាំ។'])) + '</div>';
    return head + m.map(function (r) {
      return '<div class="il-c" style="border:1px solid #e2e8f0;border-radius:12px;padding:9px 11px;margin-bottom:8px;background:#f8fafc">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div style="font-weight:800;font-size:13px">' + r.src.ic + ' ' + esc(L(r.src.n)) + ' · <span style="font-family:monospace">' + esc(r.code) + '</span></div>' +
        '<a href="' + esc(r.src.page) + '" target="_blank" rel="noopener" style="font-size:12px;font-weight:700;white-space:nowrap">' + esc(L(['打開', 'Open', 'បើក'])) + ' ↗</a></div>' +
        '<div style="font-size:12.5px;margin-top:3px">' + esc(r.name || '') + (r.loc ? ' · 📍' + esc(r.loc) : '') + '</div>' +
        (r.more ? '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + esc(r.more) + '</div>' : '') +
        (r.note ? '<div style="font-size:12px;margin-top:5px;padding:6px 8px;background:#fff;border-radius:8px;white-space:pre-wrap">📝 ' + esc(r.note) + '</div>' : '') +
        (r.photos && r.photos.length ? '<div style="display:flex;gap:6px;overflow-x:auto;margin-top:6px">' + r.photos.slice(0, 6).map(function (p) { return '<img src="' + esc(p) + '" data-il-zoom style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:zoom-in;flex:none">'; }).join('') + '</div>' : '') +
        '</div>';
    }).join('');
  }
  document.addEventListener('click', function (e) { var z = e.target && e.target.closest && e.target.closest('[data-il-zoom]'); if (z) { e.preventDefault(); e.stopPropagation(); zoom(z.src); } }, true);
  g.ItemLinks = { load: load, find: find, html: html, options: options, sources: SRC, norm: norm, onUpdate: function (f) { subs.push(f); }, lang: null, version: '1.0' };
  setTimeout(function () { load(); }, 300);
})(window);
