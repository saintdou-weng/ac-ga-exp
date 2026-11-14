/* ga-shared-photo.js — 採購與收貨共用「標準照」2026-11-14
   同一個品項（名稱相同，英文或中文其中一個對得上即可）在採購頁、收貨頁用同一張標準照。
   存在雲端 PROFILES_DB，key＝item:<名稱正規化>（一個品項會同時寫英文名、中文名兩個 key）。
   取用時：頁面自己的標準照與共用標準照，取「較新」的那張。 */
(function (root) {
  'use strict';
  var GA = root.GA; if (!GA || GA.SharedPhoto) return;
  var PKEY = 'ga_profiles_v1', P = {}, loaded = false, waiters = [];
  try { P = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch (e) { P = {}; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[\s\-_.,:;'"()（）\[\]【】/\\|+&]+/g, '').trim(); }
  /* 一個名稱欄位可能是「A4 Paper / A4 紙」或「Mop (拖把)」→ 拆成多個名字 */
  function names(list) { var out = []; (list || []).forEach(function (v) { String(v == null ? '' : v).split(/\s*[\/｜|]\s*|\s*[(（]\s*|\s*[)）]\s*/).concat([v]).forEach(function (p) { var k = norm(p); if (k && k.length >= 2 && out.indexOf(k) < 0) out.push(k); }); }); return out; }
  function keys(list) { return names(list).map(function (k) { return 'item:' + k; }); }
  function ts(e) { var n = Date.parse(e && (e.createdAt || e.updatedAt) || ''); return isNaN(n) ? 0 : n; }
  function get(list) { var best = null; keys(list).forEach(function (k) { var p = P[k] && P[k].photo; if (p && (p.previewUrl || p.url) && (!best || ts(p) > ts(best))) best = p; }); return best; }
  /* own＝頁面自己的標準照；回傳較新的那張 */
  function pick(own, list) { var sh = get(list); if (own && (own.previewUrl || own.url) && (!sh || ts(own) >= ts(sh))) return own; return sh || own || null; }
  function save() { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} }
  async function set(list, photo) {
    var ks = keys(list); if (!ks.length || !photo) return false; var now = new Date().toISOString(), o = {};
    ks.forEach(function (k) { P[k] = Object.assign({}, P[k] || {}, { photo: photo, names: (list || []).filter(Boolean).map(String), updatedAt: now }); o[k] = P[k]; });
    save();
    try { if (GA.backend && GA.backend.require) await GA.backend.require('profiles', { action: 'profilesSave' }); var r = await GA.gasPost('profilesSave', { profiles: o }), d = r && r.data; if (d && d.profiles) { Object.keys(d.profiles).forEach(function (k) { P[k] = d.profiles[k]; }); save(); } return true; } catch (e) { return false; }
  }
  async function load() {
    try { if (GA.backend && GA.backend.require) await GA.backend.require('profiles', { action: 'profilesLoad' }); var r = await GA.gasGet('profilesLoad'), d = r && r.data; if (d && d.profiles) { Object.keys(d.profiles).forEach(function (k) { var a = P[k], b = d.profiles[k]; if (!a || Date.parse(b.updatedAt || 0) >= Date.parse(a.updatedAt || 0)) P[k] = b; }); save(); } } catch (e) {}
    loaded = true; waiters.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  }
  GA.SharedPhoto = { get: get, pick: pick, set: set, load: load, keys: keys, onLoad: function (f) { if (loaded) f(); else waiters.push(f); } };
  setTimeout(load, 1200);
})(window);
