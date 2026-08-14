/* AC-GA-EXP Smart Incremental Sync
 * 以期間／雜湊分桶上傳，保留雲端歷史；摘要或核可後可直接排程同步。
 * 與 AC-HRA-PAY 的同步原則一致：先比對 manifest，再只上傳變更桶。
 */
(function (g) {
  'use strict';
  if (g.GASmartSync) return;
  var PREFIX = 'ac_ga_smart_sync_v1_';
  function txt(v) { return String(v === null || v === undefined ? '' : v); }
  function enc(v) { return encodeURIComponent(txt(v)); }
  function now() { return new Date().toISOString(); }
  function stable(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (typeof v === 'object') return '{' + Object.keys(v).sort().filter(function (k) {
      return !/^_smart/.test(k) && !/^(updatedAt|createdAt|savedAt|timestamp|cloudUpdatedAt)$/.test(k);
    }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(txt(v));
  }
  function fnv(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); }
  function hash(s) {
    try {
      if (g.crypto && g.crypto.subtle && g.TextEncoder) return g.crypto.subtle.digest('SHA-256', new g.TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join('').slice(0, 24); });
    } catch (e) {}
    return Promise.resolve(fnv(s) + '_' + s.length.toString(36));
  }
  function dateOf(r) {
    if (!r || typeof r !== 'object') return '';
    var keys = ['_syncPeriod', 'period', 'periodKey', 'date', 'recordDate', 'timestamp', 'createdAt', 'updatedAt'];
    for (var i = 0; i < keys.length; i++) { var v = txt(r[keys[i]]), m = v.match(/(20\d{2})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + (m[3] ? '-' + ('0' + m[3]).slice(-2) : ''); }
    return '';
  }
  function keyOf(r) {
    if (!r || typeof r !== 'object') return stable(r);
    for (var i = 0, a = ['_syncId', '_k', 'recordId', 'id', 'uuid']; i < a.length; i++) if (r[a[i]] !== undefined && r[a[i]] !== null && r[a[i]] !== '') return a[i] + ':' + txt(r[a[i]]);
    var d = dateOf(r), p = []; ['kind', 'type', 'source', 'itemId', 'itemName', 'category', 'name', 'poId', 'poNumber'].forEach(function (k) { if (r[k] !== undefined && r[k] !== '') p.push(k + '=' + txt(r[k])); });
    if (d) p.unshift('date=' + d); return p.length ? p.join('|') : stable(r);
  }
  function bucketOf(r) { if (r && r._syncBucket) return txt(r._syncBucket); var d = dateOf(r); return d ? 'm:' + d.slice(0, 7) : 'h:' + fnv(keyOf(r)).slice(0, 6); }
  function stamp(r) { var n = new Date(r && (r.updatedAt || r.createdAt || r.timestamp || r.date)).getTime(); return isNaN(n) ? 0 : n; }
  function newer(a, b) { var aa = stamp(a), bb = stamp(b); return aa !== bb ? (aa > bb ? a : b) : (stable(a).length >= stable(b).length ? a : b); }
  function merge(a, b, custom) {
    if (typeof custom === 'function') return custom(a || [], b || []);
    var map = {}, order = []; (a || []).concat(b || []).forEach(function (r) { var k = keyOf(r); if (!Object.prototype.hasOwnProperty.call(map, k)) order.push(k); map[k] = map[k] ? newer(map[k], r) : r; });
    return order.map(function (k) { return map[k]; });
  }
  function buckets(rows) {
    var g0 = {}; (rows || []).forEach(function (r) { var k = bucketOf(r); (g0[k] || (g0[k] = [])).push(r); });
    var out = {}, jobs = Object.keys(g0).sort().map(function (k) { var rs = g0[k].slice().sort(function (a, b) { return keyOf(a).localeCompare(keyOf(b)); }); return hash(stable(rs)).then(function (h) { out[k] = { key: k, records: rs, count: rs.length, hash: h }; }); });
    return Promise.all(jobs).then(function () { return out; });
  }
  function readState(tool) { try { return JSON.parse(localStorage.getItem(PREFIX + tool) || 'null'); } catch (e) { return null; } }
  function writeState(tool, v) { try { localStorage.setItem(PREFIX + tool, JSON.stringify(v)); } catch (e) {} }
  function status(fn, msg, type) { try { if (fn) fn(msg, type || 'busy'); } catch (e) {} }
  function fetchJson(url, opts) { if (!g.fetch) return Promise.reject(new Error('Browser fetch unavailable')); return g.fetch(url, opts || {}).then(function (r) { return r.text().then(function (raw) { var j; try { j = JSON.parse(raw); } catch (e) { throw new Error('Cloud returned non-JSON: ' + raw.slice(0, 120)); } if (!r.ok || (j && j.ok === false)) throw new Error((j && (j.error || j.msg)) || ('HTTP ' + r.status)); return j; }); }); }
  function dataOf(j) { return j && j.data !== undefined ? j.data : j; }
  function getManifest(url, tool) { return fetchJson(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=gaSmartManifest&tool=' + enc(tool)).then(dataOf); }
  function post(url, body) { return fetchJson(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(dataOf); }
  function legacyRows(url, tool, opts) { return fetchJson(url + '?action=pull&tool=' + enc(tool)).then(function (j) { var d = dataOf(j) || {}; var rs = typeof opts.legacyToRecords === 'function' ? opts.legacyToRecords(d) : ((d.data || d).records || []); return { records: Array.isArray(rs) ? rs : [], meta: d.data || d || {} }; }); }
  function push(opts) {
    opts = opts || {}; var url = txt(opts.url).trim(), tool = txt(opts.tool).trim(); if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing')); status(opts.onStatus, '智慧同步：比對雲端差異…', 'busy');
    return getManifest(url, tool).then(function (remote) {
      remote = remote || {};
      if (!remote.exists && remote.legacy) return legacyRows(url, tool, opts).then(function (old) { return smartPush(opts, merge(opts.records, old.records, opts.mergeRecords), remote, opts.onStatus, true); });
      return smartPush(opts, opts.records || [], remote, opts.onStatus, false).then(function (r) {
        if (!r || !r.needsPull || opts.autoMerge === false) return r;
        return pull({ url: url, tool: tool, localRecords: opts.records || [], legacyToRecords: opts.legacyToRecords, mergeRecords: opts.mergeRecords, apply: opts.apply, onStatus: opts.onStatus }).then(function (p) { if (!p || !p.ok) return p; return getManifest(url, tool).then(function (fresh) { return smartPush(Object.assign({}, opts, { records: p.records }), p.records, fresh || {}, opts.onStatus, false); }); });
      });
    });
  }
  function smartPush(opts, records, remote, onStatus, migrated) {
    var tool = opts.tool, remoteH = remote.hashes || {}, previous = readState(tool) || {}, oldH = migrated ? {} : (previous.hashes || {});
    return Promise.all([buckets(records), hash(stable(opts.meta || {}))]).then(function (parts) {
      var local = parts[0], metaHash = parts[1], changed = [], remoteChanged = [], keys = {}; Object.keys(local).concat(Object.keys(remoteH)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) { var lh = local[k] && local[k].hash || '', rh = remoteH[k] || '', bh = oldH[k] || ''; if (lh && rh && lh === rh) return; if (!bh) { if (lh && !rh) changed.push(k); else if (!lh && rh) remoteChanged.push(k); else if (lh && rh && lh !== rh) remoteChanged.push(k); return; } var lc = lh !== bh, rc = rh !== bh; if (lc && !rc) changed.push(k); else if (!lc && rc) remoteChanged.push(k); else if (lc && rc && lh !== rh) remoteChanged.push(k); });
      if (!migrated && remoteChanged.length) { status(onStatus, '雲端有新資料，先自動下載合併', 'warn'); return { ok: false, needsPull: true, remoteChanged: remoteChanged }; }
      var uploadId = 'ga_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8), chain = Promise.resolve(), sent = 0;
      changed.forEach(function (k, i) { chain = chain.then(function () { var b = local[k]; status(onStatus, '上傳變更 ' + (i + 1) + '/' + changed.length + ' · ' + k, 'busy'); return post(opts.url, { action: 'gaSmartBucket', tool: tool, uploadId: uploadId, bucket: k, hash: b.hash, count: b.count, records: b.records }).then(function () { sent += b.count; }); }); });
      return chain.then(function () { var hashes = {}, counts = {}; Object.keys(local).forEach(function (k) { hashes[k] = local[k].hash; counts[k] = local[k].count; }); Object.keys(remoteH).forEach(function (k) { if (!hashes[k]) { hashes[k] = remoteH[k]; counts[k] = Number((remote.counts || {})[k]) || 0; } }); var meta = Object.assign({}, opts.meta || {}, { _smartMetaHash: metaHash }); if (!changed.length && metaHash === (remote.metaHash || '') && !migrated) { writeState(tool, { hashes: remoteH, counts: remote.counts || {}, metaHash: remote.metaHash || '', updatedAt: now() }); status(onStatus, '雲端已是最新，不需重傳', 'ok'); return { ok: true, skipped: true, unchanged: records.length }; } return post(opts.url, { action: 'gaSmartCommit', tool: tool, uploadId: uploadId, hashes: hashes, counts: counts, recordCount: Object.keys(counts).reduce(function (n, k) { return n + (Number(counts[k]) || 0); }, 0), meta: meta, summary: opts.summary || {} }).then(function (d) { writeState(tool, { hashes: hashes, counts: counts, metaHash: metaHash, updatedAt: d && d.timestamp || now() }); status(onStatus, '完成｜上傳 ' + sent + '｜保留雲端歷史', 'ok'); return { ok: true, uploaded: sent, timestamp: d && d.timestamp || now() }; }); });
    });
  }
  function pull(opts) {
    opts = opts || {}; var url = txt(opts.url).trim(), tool = txt(opts.tool).trim(); if (!url || !tool) return Promise.reject(new Error('GAS URL/tool missing')); status(opts.onStatus, '智慧下載：比對雲端差異…', 'busy');
    return getManifest(url, tool).then(function (remote) {
      remote = remote || {}; if (!remote.exists) { if (remote.legacy) return legacyRows(url, tool, opts).then(function (old) { var merged = merge(opts.localRecords || [], old.records, opts.mergeRecords); return Promise.resolve(opts.apply ? opts.apply(merged, old.meta) : null).then(function () { return { ok: true, records: merged, downloaded: old.records.length, migrated: true }; }); }); status(opts.onStatus, '雲端尚無資料', 'warn'); return { ok: false, noCloud: true, records: opts.localRecords || [] }; }
      return buckets(opts.localRecords || []).then(function (local) { var rh = remote.hashes || {}, out = {}, downloaded = 0, unchanged = 0, keys = {}; Object.keys(rh).concat(Object.keys(local)).forEach(function (k) { keys[k] = 1; }); var chain = Promise.resolve(); Object.keys(keys).sort().forEach(function (k) { chain = chain.then(function () { var lb = local[k], h = rh[k] || ''; if (lb && h && lb.hash === h) { out[k] = lb.records; unchanged += lb.count; return; } if (lb && !h) { out[k] = lb.records; return; } if (!h) return; status(opts.onStatus, '下載變更 · ' + k, 'busy'); return fetchJson(url + '?action=gaSmartBucket&tool=' + enc(tool) + '&bucket=' + enc(k)).then(function (j) { var d = dataOf(j) || {}; var rs = Array.isArray(d.records) ? d.records : []; downloaded += rs.length; out[k] = lb ? merge(lb.records, rs, opts.mergeRecords) : rs; }); }); }); return chain.then(function () { var rows = Object.keys(out).reduce(function (a, k) { return a.concat(out[k] || []); }, []); return Promise.resolve(opts.apply ? opts.apply(rows, remote.meta || {}) : null).then(function () { writeState(tool, { hashes: rh, counts: remote.counts || {}, metaHash: remote.metaHash || '', updatedAt: now() }); status(opts.onStatus, '完成｜下載 ' + downloaded + '｜未變 ' + unchanged, 'ok'); return { ok: true, records: rows, downloaded: downloaded, unchanged: unchanged, meta: remote.meta || {} }; }); }); });
    });
  }
  g.GASmartSync = { version: '1.0', push: push, pull: pull, merge: merge, keyOf: keyOf, bucketOf: bucketOf };
})(window);
