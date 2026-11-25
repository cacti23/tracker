/* ──────────────────────────────────────────────────────────────────────────
   DataSync — free, dead-simple cross-device sync for the tracker apps.

   Backend: one PRIVATE GitHub gist (description "tracker-sync-v1") holding one
   JSON file per app, e.g. dsa.json / gym5day.json, each shaped:
       { "updatedAt": "<ISO>", "data": { "<localStorageKey>": "<stringValue>" } }

   Auth: a token the user pastes ONCE per device. Stored only in localStorage,
   never committed to the repo, so pushing the HTML to GitHub/Pages stays safe.
   Use a fine-grained PAT with only the "Gists" permission (read+write), or a
   classic token with the single "gist" scope.

   Mode: two-way, with a key-level MERGE whenever both sides have changes. We never
   throw one side's edits away just because the other side has a later timestamp:
   top-level entries from both sides are kept; if both changed the SAME entry, the side
   that was edited more recently wins (see mergeValue / reconcile). Before anything is
   overwritten, a local snapshot ("<appId>-presync", last 3 kept) and the previous cloud
   copy ("<appId>.prev.json" in the gist) are saved, so a bad sync is recoverable.
   Optional init() settings: autoPush (upload shortly after every local edit),
   noiseKeys (keys that change on every page load and so don't count as "edited"),
   maxKeys (counter objects where a conflict keeps the larger number),
   deepKeys ({ key: idField } — merge that key's JSON recursively, see deepMerge).
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TOKEN_KEY  = 'tracker-sync-token';
  var GISTID_KEY = 'tracker-sync-gistid';
  var GIST_DESC  = 'tracker-sync-v1';
  var API        = 'https://api.github.com';
  var DAY_MS     = 24 * 60 * 60 * 1000;

  var AUTO_PUSH_MS = 6000;
  var RELOAD_MS = 500;
  var cfg = { appId: null, keys: [], versionLabel: '', noiseKeys: [], maxKeys: [], deepKeys: {}, autoPush: false, autoPushDelay: AUTO_PUSH_MS, reloadDelay: RELOAD_MS };
  // Who may write this app's synced keys right now. One value rather than several flags:
  //   'live'           the app may; its writes count as edits
  //   'sync-writing'   sync itself is writing them, so the edit hook ignores the writes
  //   'reload-pending' sync replaced them under the app, which still holds the old copy in
  //                    memory until the page reloads. App writes are DROPPED: a save in this
  //                    window would write that stale copy back over the pulled data, and the
  //                    next sync would upload it. Losing that one save is the lesser harm,
  //                    and the reload shows the user what is now stored.
  var writeGate = 'live';

  // ── config / meta ──────────────────────────────────────────────────────
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setTokenValue(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function metaKey(appId) { return appId + '-sync-meta'; }
  function getMeta(appId) {
    try { return JSON.parse(localStorage.getItem(metaKey(appId)) || '{}'); }
    catch (e) { return {}; }
  }
  function setMeta(appId, m) { localStorage.setItem(metaKey(appId), JSON.stringify(m)); }
  function touchCheck(appId) {
    var m = getMeta(appId); m.lastCheckAt = new Date().toISOString(); setMeta(appId, m);
  }

  // ── tiny GitHub API wrapper ────────────────────────────────────────────
  function headers() {
    return {
      'Authorization': 'Bearer ' + getToken(),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = headers();
    // api.github.com answers GETs with "Cache-Control: private, max-age=60", so without
    // this a re-pull within a minute of the last one can be served from Chrome's HTTP
    // cache — i.e. stale data that looks exactly like "pull did nothing".
    opts.cache = 'no-store';
    return fetch(API + path, opts).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('GitHub API ' + res.status + ': ' + t.slice(0, 200));
        });
      }
      return res.json();
    });
  }

  // ── gist resolution (find-by-description, else create) ─────────────────
  // IMPORTANT failure mode this guards against: a token for a DIFFERENT GitHub
  // account (e.g. pasted into a new device, or regenerated against the wrong
  // "resource owner" on a fine-grained PAT) will never find the existing
  // "tracker-sync-v1" gist — /gists only lists gists owned by the token's own
  // account. Silently creating a fresh, empty gist in that case looks exactly
  // like "I synced and nothing happened": the device is now talking to a gist
  // that was never seeded with real data, and no amount of re-syncing will ever
  // surface the old data because it lives under a different account entirely.
  // So this is surfaced loudly instead of happening quietly.
  // Total bytes of the synced *.json files in a gist-list entry (list responses include
  // per-file sizes). A duplicate/empty gist — e.g. one a fresh device auto-created —
  // scores ~0, so the real data-bearing gist wins deterministically on every device.
  function gistDataSize(g) {
    var n = 0, files = (g && g.files) || {};
    Object.keys(files).forEach(function (f) {
      if (/\.json$/.test(f)) n += (files[f] && files[f].size) || (files[f] && files[f].content ? files[f].content.length : 0);
    });
    return n;
  }
  // Richest wins; ties go to the most recently updated. The old code took [0] of the
  // FIRST 100 gists only, so with duplicates (or >100 gists) a device could latch onto
  // an empty gist forever and "Pull" would find nothing.
  function pickRichest(matches) {
    var best = null;
    matches.forEach(function (g) {
      if (!best) { best = g; return; }
      var a = gistDataSize(g), b = gistDataSize(best);
      if (a > b || (a === b && Date.parse(g.updated_at || 0) > Date.parse(best.updated_at || 0))) best = g;
    });
    return best;
  }
  // All of this account's gists with our description, across up to 10 pages (1000 gists).
  function listTrackerGists() {
    var out = [];
    function page(n) {
      return api('/gists?per_page=100&page=' + n).then(function (list) {
        list = list || [];
        list.forEach(function (g) { if (g.description === GIST_DESC) out.push(g); });
        return (list.length === 100 && n < 10) ? page(n + 1) : out;
      });
    }
    return page(1);
  }
  function resolveGist() {
    var cached = localStorage.getItem(GISTID_KEY);
    if (cached) return Promise.resolve(cached);
    return listTrackerGists().then(function (matches) {
      var found = pickRichest(matches);
      if (found) { localStorage.setItem(GISTID_KEY, found.id); return found.id; }
      var body = {
        description: GIST_DESC,
        public: false,
        files: { 'README.md': { content: 'Tracker sync data — managed automatically by sync.js. Do not edit by hand.' } }
      };
      return api('/gists', { method: 'POST', body: JSON.stringify(body) }).then(function (g) {
        localStorage.setItem(GISTID_KEY, g.id);
        if (typeof alert === 'function') {
          alert('⚠️ No existing synced data was found for this GitHub token — a brand-new, EMPTY sync store was just created.\n\n' +
                'If you expected to see your existing progress here, this token almost certainly belongs to a DIFFERENT GitHub account (or a fine-grained PAT scoped to the wrong "resource owner") than the device that already has your data.\n\n' +
                'Fix: go to ⚙ Token, clear it, and paste a token generated while signed into the SAME GitHub account used on your other device.');
        }
        return g.id;
      });
    });
  }
  // Run fn(gistId). If we were using a PREVIOUSLY CACHED gist id and the call
  // fails (gist deleted, different account, otherwise invalid id), the id is
  // stale — drop it and re-resolve once. This automates the old workaround of
  // re-entering the token (which only "worked" because it cleared the cache).
  // We only retry when the id came from cache, so a genuine first-run error
  // (e.g. a bad token) still surfaces, and we never create duplicate gists.
  function withGist(fn) {
    var hadCachedId = !!localStorage.getItem(GISTID_KEY);
    return resolveGist().then(fn).catch(function (e) {
      if (hadCachedId) {
        localStorage.removeItem(GISTID_KEY);
        return resolveGist().then(fn);
      }
      throw e;
    });
  }

  // ── pull / push a single app's blob ────────────────────────────────────
  function parsePayload(text) {
    try {
      var p = JSON.parse(text);
      if (p && typeof p === 'object' && p.data && typeof p.data === 'object') return p;
    } catch (e) {}
    return null;
  }
  // null = no file. A file that exists but isn't a valid payload comes back as an empty copy
  // carrying its raw text in `unreadable`: there is nothing in it to pull or merge, and
  // pushApp keeps that text as the .prev backup before replacing it. A failed download of a
  // large file throws instead, so a network blip can never look like "the cloud is empty".
  function readPayload(text) {
    var p = parsePayload(text);
    if (p) return p;
    if (text == null || String(text).trim() === '') return null;
    return { updatedAt: null, data: {}, unreadable: String(text) };
  }
  function readAppFile(g, appId) {
    var file = g && g.files && g.files[appId + '.json'];
    if (!file) return Promise.resolve(null);
    if (file.truncated && file.raw_url) {
      // large file: gist inlines only ~1MB; fetch the full content (private
      // gists are reachable via their signed raw_url without an auth header)
      return fetch(file.raw_url).then(function (r) {
        if (!r.ok) throw new Error('could not download the cloud copy (HTTP ' + r.status + ')');
        return r.text();
      }).then(readPayload);
    }
    return Promise.resolve(readPayload(file.content));
  }
  function gistVersion(g) { return (g && g.history && g.history[0] && g.history[0].version) || null; }
  // The cloud copy plus the gist revision it was read from, so a push can tell whether
  // another push landed in between (see pushApp).
  function fetchApp(appId) {
    return withGist(function (id) {
      return api('/gists/' + id).then(function (g) {
        return readAppFile(g, appId).then(function (remote) { return { remote: remote, version: gistVersion(g) }; });
      });
    });
  }
  function pullApp(appId) {
    return fetchApp(appId).then(function (got) { return got.remote; });
  }
  function collect(keys) {
    var data = {};
    keys.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    return data;
  }
  function sameData(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return a[k] === b[k]; });
  }
  // data: what to upload. prevRemote: the cloud copy being replaced, kept as
  // "<appId>.prev.json" so one bad push is undoable; only rewritten when the upload changes
  // the content, or a run of identical pushes would replace the backup with a copy of itself.
  // base: { version, updatedAt } of the cloud as we last read it. The gist API has no
  // compare-and-swap, so a lost update is caught after the fact: the PATCH response's history
  // names the revision we replaced. If that isn't the one we read, another push landed in
  // between; if it changed this app's file, it comes back as `clobbered` for the caller to
  // merge back in (a push by another app to its own file is not a conflict).
  function pushApp(appId, updatedAt, data, prevRemote, base) {
    var payload = JSON.stringify({ updatedAt: updatedAt, data: data }, null, 2);
    return withGist(function (id) {
      var body = { files: {} };
      body.files[appId + '.json'] = { content: payload };
      if (prevRemote && prevRemote.unreadable) {
        body.files[appId + '.prev.json'] = { content: prevRemote.unreadable };
      } else if (prevRemote && prevRemote.data && Object.keys(prevRemote.data).length > 0 && !sameData(prevRemote.data, data)) {
        body.files[appId + '.prev.json'] = {
          content: JSON.stringify({ updatedAt: prevRemote.updatedAt, backedUpAt: updatedAt, data: prevRemote.data })
        };
      }
      return api('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) }).then(function (g) {
        var out = { version: gistVersion(g), clobbered: null };
        var replaced = g && g.history && g.history[1] && g.history[1].version;
        if (!base || !base.version || !replaced || replaced === base.version) return out;
        return api('/gists/' + id + '/' + replaced).then(function (old) { return readAppFile(old, appId); }).then(function (theirs) {
          if (theirs && theirs.updatedAt !== base.updatedAt) out.clobbered = theirs;
          return out;
        }, function () { return out; });   // can't tell; the next sync still compares versions
      });
    });
  }

  // ── local snapshot + apply pulled data ─────────────────────────────────
  // Keeps the last 3 snapshots ("-presync" newest, then "-presync-2", "-presync-3") so two
  // bad syncs in a row can't overwrite the only good copy.
  function snapshotLocal(appId, keys) {
    try {
      var base = appId + '-presync';
      var prev2 = localStorage.getItem(base + '-2');
      var prev1 = localStorage.getItem(base);
      if (prev2 !== null) localStorage.setItem(base + '-3', prev2);
      if (prev1 !== null) localStorage.setItem(base + '-2', prev1);
      localStorage.setItem(base, JSON.stringify({ savedAt: new Date().toISOString(), data: collect(keys) }));
    } catch (e) { /* ignore quota */ }
  }
  // Cheap content fingerprint of the synced keys — NOT a security hash, just enough
  // to answer "has anything changed here since the last successful sync?" without
  // storing (and diffing) a second full copy of potentially hundreds of KB of data.
  // noiseKeys (e.g. a streak counter rewritten on every page load) are left out, so
  // merely opening the app never makes a stale device look like it has "edits".
  function strHash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
    return h.toString(36) + ':' + s.length;
  }
  function hashOf(keys, data) {
    var picked = {};
    keys.forEach(function (k) {
      if (cfg.noiseKeys.indexOf(k) < 0 && typeof data[k] === 'string') picked[k] = data[k];
    });
    return strHash(JSON.stringify(picked));
  }
  // One fingerprint per key of the data both sides last agreed on: the common ancestor a
  // merge needs to tell "this side edited the key" from "this side's copy is just old".
  function keyHashes(keys, data) {
    var out = {};
    keys.forEach(function (k) { if (typeof data[k] === 'string') out[k] = strHash(data[k]); });
    return out;
  }
  function localHash(keys) { return hashOf(keys, collect(keys)); }
  function hasUnsyncedEdits(appId, keys) {
    var m = getMeta(appId);
    return !!m.lastLocalHash && m.lastLocalHash !== localHash(keys);
  }
  // Every path that changes this app's keys goes through here: it snapshots local data
  // before the first write and reloads the page after, so the app re-reads what is now
  // stored (a queued follow-up sync that pulled used to change data without a reload).
  function writeKeys(appId, keys, data) {
    var before = writeGate, wrote = false;
    writeGate = 'sync-writing';
    try {
      keys.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(data, k) && typeof data[k] === 'string' && localStorage.getItem(k) !== data[k]) {
          if (!wrote) snapshotLocal(appId, keys);
          localStorage.setItem(k, data[k]);
          wrote = true;
        }
      });
    } finally { writeGate = wrote ? 'reload-pending' : before; }
    if (wrote) scheduleReload();
    return wrote;
  }
  // The delay lets the status text show; the reload also waits for a sync still in flight
  // (e.g. the follow-up that uploads an edit made during a merge) so it isn't cut off. Not
  // forever: app writes are dropped until the reload, and a stalled request can hang for
  // minutes. An upload cut off here stays local and autoSync sends it after the reload.
  var RELOAD_MAX_WAIT_MS = 4000;
  var reloadTimer = null;
  function scheduleReload() {
    if (reloadTimer) return;
    var giveUpAt = Date.now() + cfg.reloadDelay + RELOAD_MAX_WAIT_MS;
    reloadTimer = setTimeout(function reloadWhenIdle() {
      if (inflight && Date.now() < giveUpAt) { setTimeout(reloadWhenIdle, 100); return; }
      location.reload();
    }, cfg.reloadDelay);
  }
  // uploaded: the data this sync put in the cloud. Its fingerprint is what counts as
  // "synced", not localStorage after the upload: an edit made while the request was in
  // flight is not in the cloud, and recording it as synced would hide it from every later
  // sync. Without uploaded (a pull), local now equals the cloud, so local is hashed.
  function markSynced(appId, keys, version, uploaded) {
    var synced = uploaded || collect(keys);
    var m = getMeta(appId);
    m.lastSyncedAt = version;                 // the cloud's updatedAt we now hold, exactly as stamped
    m.lastCheckAt  = new Date().toISOString();
    m.lastLocalHash = hashOf(keys, synced);
    m.keyHashes = keyHashes(keys, synced);
    setMeta(appId, m);
  }
  function applyPull(appId, keys, remote) {
    var wrote = writeKeys(appId, keys, remote.data);
    markSynced(appId, keys, remote.updatedAt);
    return wrote;
  }

  // ── key-level merge ────────────────────────────────────────────────────
  // Each synced key holds a JSON string. Two devices that both edited since the last
  // sync used to fight over the whole file (one side's edits were lost). Now:
  //   • object  → union of top-level entries; an entry present on both sides takes the
  //               preferred side's value (numbers in maxKeys take the larger instead)
  //   • array   → union (entries with {lcKey, ts} dedupe by lcKey, newest first)
  //   • other   → the preferred side's value
  //   • deepKeys → recursive, see deepMerge
  // Limits: there are no per-entry timestamps, so a deletion on one device can be undone
  // by the other device's older copy of that entry, and conflicting edits to the SAME
  // entry resolve to whichever side was edited most recently overall.
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function tryParse(str) { try { return { v: JSON.parse(str) }; } catch (e) { return null; } }
  function mergeArrays(pref, other) {
    var all = pref.concat(other);
    var logLike = all.length > 0 && all.every(function (e) { return isObj(e) && e.lcKey !== undefined && e.ts; });
    if (logLike) {
      var best = {};
      all.forEach(function (e) {
        if (!best[e.lcKey] || Date.parse(e.ts) > Date.parse(best[e.lcKey].ts)) best[e.lcKey] = e;
      });
      return Object.keys(best).map(function (k) { return best[k]; })
        .sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
    }
    var seen = {}, out = [];
    all.forEach(function (e) {
      var sig = JSON.stringify(e);
      if (!seen[sig]) { seen[sig] = 1; out.push(e); }
    });
    return out;
  }
  // For keys whose top-level entries are themselves collections edited one item at a time
  // (habits: {habits: [{id}], logs: {habitId: {date: true}}}; gym history:
  // {exercise: [{date, sets}]}), a top-level union still loses edits: both devices touched
  // "logs", so one side's whole "logs" won. Here objects merge by key at every level, and
  // arrays whose entries all carry idField are unioned by it; for an id on both sides the
  // preferred side's entry is kept whole (two copies of the same gym day would double its
  // sets). A list kept in id order (gym history by date) stays in id order, since the app
  // treats its last entry as the latest; any other list keeps the preferred side's order
  // with the other side's new entries after it. Anything else takes the preferred side.
  // Same deletion limit as above: an entry removed on one side comes back from the other.
  function idsIn(arr, idField) {
    return arr.every(function (e) { return isObj(e) && (typeof e[idField] === 'string' || typeof e[idField] === 'number'); });
  }
  function deepMerge(pref, other, idField) {
    var out;
    if (isObj(pref) && isObj(other)) {
      out = {};
      Object.keys(pref).forEach(function (k) { out[k] = has(other, k) ? deepMerge(pref[k], other[k], idField) : pref[k]; });
      Object.keys(other).forEach(function (k) { if (!has(out, k)) out[k] = other[k]; });
      return out;
    }
    if (Array.isArray(pref) && Array.isArray(other) && idsIn(pref, idField) && idsIn(other, idField)) {
      var seen = {}, idOf = function (e) { return String(e[idField]); };
      out = pref.slice();
      pref.forEach(function (e) { seen[idOf(e)] = 1; });
      other.forEach(function (e) { if (!seen[idOf(e)]) { seen[idOf(e)] = 1; out.push(e); } });
      var inIdOrder = pref.every(function (e, i) { return i === 0 || idOf(pref[i - 1]) <= idOf(e); });
      if (inIdOrder) out.sort(function (a, b) { return idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0; });
      return out;
    }
    return pref;
  }
  function mergeValue(key, localStr, remoteStr, preferRemote) {
    if (localStr === undefined) return remoteStr;
    if (remoteStr === undefined || localStr === remoteStr) return localStr;
    var l = tryParse(localStr), r = tryParse(remoteStr);
    var prefStr = preferRemote ? remoteStr : localStr;
    if (!l || !r) return prefStr;
    var pref = preferRemote ? r.v : l.v, other = preferRemote ? l.v : r.v;
    if (has(cfg.deepKeys, key)) return JSON.stringify(deepMerge(pref, other, cfg.deepKeys[key]));
    if (isObj(pref) && isObj(other)) {
      var out = {};
      Object.keys(pref).forEach(function (k) { out[k] = pref[k]; });
      Object.keys(other).forEach(function (k) {
        if (!(k in out)) out[k] = other[k];
        else if (cfg.maxKeys.indexOf(key) >= 0 && typeof out[k] === 'number' && typeof other[k] === 'number') out[k] = Math.max(out[k], other[k]);
      });
      return JSON.stringify(out);
    }
    if (Array.isArray(pref) && Array.isArray(other)) return JSON.stringify(mergeArrays(pref, other));
    return prefStr;
  }
  // ancestor: per-key fingerprints from the last sync (keyHashes), or null when they can't
  // be trusted. A key only ONE side changed since then takes that side's value whole, even
  // when the other side is preferred: its copy is just older, not an edit (an untouched
  // stale key on the newer side used to overwrite the other side's edit, e.g. a paper
  // marked Done in the Papers iframe). Only keys both sides changed go through mergeValue.
  function mergeData(keys, local, remote, preferRemote, ancestor) {
    var out = {};
    keys.forEach(function (k) {
      var l = has(local, k) ? local[k] : undefined;
      var r = has(remote, k) && typeof remote[k] === 'string' ? remote[k] : undefined;
      var v;
      if (ancestor && has(ancestor, k) && l !== undefined && r !== undefined && l !== r) {
        if (strHash(l) === ancestor[k]) v = r;
        else if (strHash(r) === ancestor[k]) v = l;
      }
      if (v === undefined) v = mergeValue(k, l, r, preferRemote);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  function sameOn(keys, a, b) { return keys.every(function (k) { return a[k] === b[k]; }); }
  // Local edits made while an upload was in flight, laid over the merge result: per key,
  // whichever side moved away from `before` wins; if both did, the key's entries union with
  // the newer local edit preferred.
  function threeWay(keys, before, mine, merged) {
    var out = {};
    keys.forEach(function (k) {
      var v = mine[k] === before[k] ? merged[k] : merged[k] === before[k] ? mine[k] : mergeValue(k, mine[k], merged[k], false);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  // Prefer the cloud's side of a conflict when its push is newer than our last edit. This
  // still compares two devices' clocks, so with skew a conflict on the SAME entry can go the
  // wrong way; entries edited on only one side are kept either way.
  function preferCloud(meta, remote) {
    var localEditedAt = meta.lastEditAt ? Date.parse(meta.lastEditAt) : Infinity;   // unknown = trust local
    return Date.parse(remote.updatedAt) > localEditedAt;
  }
  var RANK = { none: 0, push: 1, pull: 2, merge: 3 };
  function combine(a, b) {
    return { action: RANK[b.action] > RANK[a.action] ? b.action : a.action, followUp: !!(a.followUp || b.followUp) };
  }

  // Merge `remote` with local, upload the result unless the cloud already holds it, then
  // adopt it locally. how = { preferRemote, ancestor } (see mergeData). base = { version, updatedAt, data }: what the cloud holds right now.
  // Normally that is `remote`; when `remote` is a revision our own push just overwrote (see
  // pushApp), the cloud holds our upload instead, and the merge goes up on top of it.
  // Result: 'pull' (local changed, cloud already had it), 'merge' (local changed and the
  // cloud was updated), 'push' (only the cloud changed), 'none'. followUp: local has edits
  // the cloud doesn't have yet, so the caller should sync again.
  function mergeAndSave(appId, keys, remote, how, base, depth) {
    var local = collect(keys);
    var merged = mergeData(keys, local, remote.data, how.preferRemote, how.ancestor);
    if (sameOn(keys, merged, base.data)) {
      var wrote = writeKeys(appId, keys, merged);
      markSynced(appId, keys, base.updatedAt);
      return Promise.resolve({ action: wrote ? 'pull' : 'none' });
    }
    var now = new Date().toISOString();
    var upload = {};
    Object.keys(remote.data).forEach(function (k) { upload[k] = remote.data[k]; });   // keep keys we don't manage
    Object.keys(merged).forEach(function (k) { upload[k] = merged[k]; });
    return pushApp(appId, now, upload, remote, base).then(function (res) {
      // The app may have saved while the upload was in flight; those edits are newer than
      // anything in `merged` and must not be overwritten by it.
      var after = collect(keys);
      var target = sameOn(keys, after, local) ? merged : threeWay(keys, local, after, merged);
      var wrote = writeKeys(appId, keys, target);
      markSynced(appId, keys, now, merged);
      var r = { action: wrote ? 'merge' : 'push', followUp: !sameOn(keys, target, merged) };
      if (!res.clobbered) return r;
      return recoverClobbered(appId, keys, res, now, merged, depth).then(function (r2) { return combine(r, r2); });
    });
  }
  // Our upload replaced a revision we never read: another device pushed between our read and
  // our write. Merge its data back in and upload again on top of ours. Bounded, so devices
  // racing each other can't loop; past the bound the other revision is still in the gist's
  // history but is not merged back automatically.
  function recoverClobbered(appId, keys, res, ourAt, ourData, depth) {
    if (depth >= 2) return Promise.resolve({ action: 'none' });
    var theirs = res.clobbered;
    var base = { version: res.version, updatedAt: ourAt, data: ourData };
    // No ancestor: we just recorded our own upload as synced, but the other device started
    // from an older copy, so "unchanged since the last sync" means nothing here.
    return mergeAndSave(appId, keys, theirs, { preferRemote: preferCloud(getMeta(appId), theirs), ancestor: null }, base, depth + 1);
  }

  // ── the reconcile ──────────────────────────────────────────────────────
  // Decision order (first match wins). "Unchanged" = this device's data hasn't changed
  // since its own last successful sync, so it has no edits to lose. "Cloud changed" = the
  // cloud file's updatedAt differs from the one this device last synced, compared as a
  // string. It is never compared as a time: each device stamps updatedAt with its own
  // clock, and "newer than my last sync" missed pushes from a device whose clock is behind.
  //   1. local empty + cloud has data               → pull (adopt the cloud)
  //   2. never synced here + cloud has data         → merge, cloud wins conflicts
  //                                                   (the device may hold real offline
  //                                                   progress; it used to be replaced)
  //   3. cloud is much richer than local            → merge, cloud wins conflicts
  //   4. cloud changed + local unchanged            → pull (clean fast-forward)
  //   5. cloud changed + local ALSO edited          → merge: a key only one side changed
  //                                                   takes that side's value; for a key
  //                                                   both changed, whichever side was
  //                                                   edited most recently wins conflicts
  //                                                   on the same entry (see preferCloud)
  //   6. cloud unchanged + local unchanged          → nothing (no upload, .prev untouched)
  //   7. otherwise                                  → push local (cloud copy kept as .prev)
  // A much THINNER cloud copy is never pulled over richer local data (it is repaired by 7).
  // Every upload is checked afterwards for a push from another device that landed between
  // our read and our write (pushApp); if one did, its data is merged back in.
  function doReconcile(appId, keys) {
    return fetchApp(appId).then(function (got) {
      var remote = got.remote;
      var base = { version: got.version, updatedAt: remote ? remote.updatedAt : undefined, data: remote ? remote.data : {} };
      var meta = getMeta(appId);
      var localEmpty = Object.keys(collect(keys)).length === 0;
      var remoteHasData = !!(remote && remote.data && Object.keys(remote.data).length > 0);
      var neverSyncedHere = !meta.lastSyncedAt;
      if (localEmpty && remoteHasData) {
        return { action: applyPull(appId, keys, remote) ? 'pull' : 'none' };
      }
      if (neverSyncedHere && remoteHasData) {
        // The device's local state can look non-empty before the user touched anything
        // (e.g. a streak counter written on page load) — and it may also hold genuine
        // offline progress. Merge with the cloud preferred; writing snapshots local
        // first, so nothing is lost either way.
        return mergeAndSave(appId, keys, remote, { preferRemote: true, ancestor: null }, base, 0);
      }
      // Ignore bookkeeping and compare content: a poisoned lastSyncedAt/lastLocalHash
      // (an older bug let a thin device "catch up" without real data) must not stop a
      // substantially richer cloud copy from being recovered.
      var localSize = JSON.stringify(collect(keys)).length;
      var remoteSize = remoteHasData ? JSON.stringify(remote.data).length : 0;
      if (remoteHasData && remoteSize > localSize * 2) {
        return mergeAndSave(appId, keys, remote, { preferRemote: true, ancestor: null }, base, 0);
      }
      var localUnchangedSinceSync = !!meta.lastLocalHash && meta.lastLocalHash === localHash(keys);
      var remoteChanged = !!(remote && remote.updatedAt && remote.updatedAt !== meta.lastSyncedAt);
      var remoteMuchThinner = remoteHasData && localSize > 0 && remoteSize * 2 < localSize;
      if (remoteChanged && localUnchangedSinceSync && !remoteMuchThinner) {
        return { action: applyPull(appId, keys, remote) ? 'pull' : 'none' };
      }
      if (remoteHasData && remoteChanged && !localUnchangedSinceSync && !remoteMuchThinner) {
        return mergeAndSave(appId, keys, remote, { preferRemote: preferCloud(meta, remote), ancestor: meta.keyHashes || null }, base, 0);
      }
      if (remote && !remoteChanged && localUnchangedSinceSync) {
        touchCheck(appId);
        return { action: 'none' };
      }
      var now = new Date().toISOString();
      var data = collect(keys);
      return pushApp(appId, now, data, remote, base).then(function (res) {
        markSynced(appId, keys, now, data);
        var r = { action: 'push', followUp: localHash(keys) !== hashOf(keys, data) };
        if (!res.clobbered) return r;
        return recoverClobbered(appId, keys, res, now, data, 0).then(function (r2) { return combine(r, r2); });
      });
    });
  }
  // One reconcile at a time: a background push firing while the user taps Sync (or two
  // quick edits) must not interleave two pull/merge/push cycles. A request that arrives
  // mid-flight shares the running one and schedules a single follow-up run; so does a run
  // that ends with local edits the cloud doesn't have yet (made while it was uploading).
  var inflight = null, rerun = false;
  function reconcile(appId, keys) {
    if (inflight) { rerun = true; return inflight; }
    inflight = doReconcile(appId, keys).then(function (r) {
      inflight = null;
      if (rerun || r.followUp) { rerun = false; reconcile(appId, keys).catch(function () {}); }
      return r;
    }, function (e) {
      inflight = null; rerun = false;
      throw e;
    });
    return inflight;
  }

  // ── button status helpers (sync status button must have id="dataSyncBtn";
  // token button — the one that reflects "is a token saved on this device" —
  // must have id="dataTokenBtn") ──────────────────────────────────────────
  function getBtn() { return document.getElementById('dataSyncBtn'); }
  function getTokenBtn() { return document.getElementById('dataTokenBtn'); }
  function status(msg) {
    var b = getBtn();
    if (b) { if (!b.dataset.orig) b.dataset.orig = b.textContent; b.textContent = msg; }
  }
  function resetStatus() {
    var b = getBtn();
    if (b && b.dataset.orig) b.textContent = b.dataset.orig;
  }
  // Reflects whether a token is set directly on the TOKEN button's appearance
  // (class "ds-token-set", styled per-app in CSS) — not the Sync button, which
  // stays neutral regardless of token state. This is the at-a-glance answer to
  // "is this device already wired up, or do I still need to paste a token?"
  function refreshBtnState() {
    var b = getTokenBtn();
    if (!b) return;
    b.classList.toggle('ds-token-set', !!getToken());
  }

  // ── Sign in with GitHub ────────────────────────────────────────────────
  // api/github-oauth.js runs GitHub's OAuth flow and sends the browser back to this page
  // with the token in the URL fragment (#tracker-signin=…), or #tracker-signin-error=… if
  // the user cancelled. Read it before the app starts and wipe it from the address bar at
  // once, so the token never sits in history or gets bookmarked or shared.
  var signIn = { done: false, error: '' };
  function takeSignInFromUrl() {
    var h = (typeof location !== 'undefined' && location.hash) || '';
    var m = /^#tracker-signin(-error)?=([^&]*)$/.exec(h);
    if (!m) return;
    var value = '';
    try { value = decodeURIComponent(m[2]); } catch (e) {}
    if (typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (m[1]) { signIn.error = value || 'unknown'; return; }
    if (!value) return;
    setTokenValue(value);
    localStorage.removeItem(GISTID_KEY);   // re-resolve the gist for this account
    signIn.done = true;
  }
  takeSignInFromUrl();

  function startSignIn() {
    location.href = '/api/github-oauth?return=' + encodeURIComponent(location.pathname + location.search);
  }

  // After a sign-in, say which account this device now syncs with (same reason as the token
  // check below) and sync straight away.
  function finishSignIn() {
    if (signIn.error) {
      var err = signIn.error;
      signIn.error = '';
      if (typeof alert === 'function') alert('GitHub sign-in did not finish (' + err + '). Your data on this device is unchanged. Tap ⚙ to try again.');
      return;
    }
    if (!signIn.done) return;
    signIn.done = false;
    api('/user').then(function (u) {
      if (typeof alert === 'function') alert('Signed in with GitHub as @' + u.login + '. Syncing now.\n\nEvery device you sync on must show this same username.');
    }, function () {}).then(syncNow);
  }

  // ── token entry ────────────────────────────────────────────────────────
  // No token yet: offer Sign in with GitHub first; pasting a token stays as the fallback.
  // A token already set: paste a new one or leave blank to sign out (clear it).
  function setToken() {
    if (!getToken() && typeof confirm === 'function' &&
        confirm('Sign in with GitHub to sync this tracker across your devices?\n\nOK: sign in with GitHub\nCancel: paste a token instead')) {
      startSignIn();
      return false;
    }
    var t = prompt(
      'Paste your GitHub token.\n\n' +
      'Fine-grained PAT with "Gists" read+write (or a classic token with the "gist" scope).\n' +
      'Stored only in this browser, never in the repo. Leave blank to clear (sign out on this device).',
      ''
    );
    if (t === null) return false;          // cancelled
    t = t.trim();
    setTokenValue(t);
    localStorage.removeItem(GISTID_KEY);   // re-resolve gist for the new token/account
    refreshBtnState();
    // Surface WHICH GitHub account this token belongs to. The #1 cause of "I added
    // a token, synced, but my old data never shows up" is a token for a different
    // account than the device that already holds the data — /gists is scoped to the
    // token's own account, so a mismatch is invisible otherwise. Compare this name
    // across devices to confirm they're pointed at the same account.
    if (t && typeof alert === 'function') {
      api('/user').then(function (u) {
        alert('Token saved — connected to GitHub as @' + u.login + '.\n\nMake sure every device you sync this tracker on shows the SAME username here, or they will not share data.');
      }).catch(function (e) {
        alert('Token saved, but a test request to GitHub failed: ' + e.message + '\n\nDouble-check the token has "Gists" read+write permission.');
      });
    }
    return !!t;
  }

  // ── public actions ─────────────────────────────────────────────────────
  // A pull or merge that changes local data reloads the page by itself (writeKeys), so
  // these only report status.
  function syncNow() {
    if (!getToken() && !setToken()) return;
    status('syncing…');
    localStorage.removeItem(GISTID_KEY);   // manual action: re-resolve rather than trust a possibly-stale cached gist
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action === 'pull' || r.action === 'merge') {
        status(r.action === 'merge' ? 'synced ✓ merged' : 'synced ✓ pulled');
      } else {
        status(r.action === 'push' ? 'synced ✓ pushed' : 'synced ✓');
        setTimeout(resetStatus, 2500);
      }
    }).catch(function (e) {
      console.error('[sync]', e);
      status('sync failed ✕');
      alert('Sync failed: ' + e.message +
            '\n\nIf this looks like an auth error (401/403), re-enter your token via the ⚙ button.');
      setTimeout(resetStatus, 3000);
    });
  }

  // Unconditional pull — ignores all bookkeeping/heuristics and just takes whatever
  // the cloud currently has. The guaranteed escape hatch for "this device should
  // have newer data but reconcile() isn't pulling it for some reason." Confirms
  // first since it overwrites local state (snapshotted to "<appId>-presync" first).
  function pullLatest() {
    if (!getToken() && !setToken()) return;
    if (!confirm('This will overwrite the data on THIS device with whatever is currently in the cloud. Continue?')) return;
    status('pulling…');
    localStorage.removeItem(GISTID_KEY);   // never trust a cached gist id for a manual pull
    withGist(function () { return pullApp(cfg.appId); }).then(function (remote) {
      var gid = localStorage.getItem(GISTID_KEY) || '?';
      var gistLabel = 'gist …' + gid.slice(-6);
      if (!remote || !remote.data || Object.keys(remote.data).length === 0) {
        status('nothing to pull');
        // Loud, not a 2-second button flash: this is the symptom of pointing at the wrong/empty gist.
        alert('Nothing to pull for "' + cfg.appId + '" — ' + gistLabel + ' has no ' + cfg.appId + '.json data.\n\n' +
              'Compare this gist id with the one your other device uses (Pull there shows it too). ' +
              'If they differ, this device is reading a different gist.');
        setTimeout(resetStatus, 2000);
        return;
      }
      applyPull(cfg.appId, cfg.keys, remote);
      status('pulled ✓');
      alert('Pulled ' + Object.keys(remote.data).length + ' keys from ' + gistLabel +
            ' (cloud copy saved ' + remote.updatedAt + ').');
    }).catch(function (e) {
      console.error('[sync]', e);
      status('pull failed ✕');
      alert('Pull failed: ' + e.message);
      setTimeout(resetStatus, 3000);
    });
  }

  // Quiet sync on page load: never alerts. Runs at most once a day, unless this device
  // holds edits that never reached the cloud (its tab was closed before the debounced
  // push fired, or the device was offline), or opts.everyOpen asks for a check on every
  // open.
  function autoSync(opts) {
    if (!getToken()) return;
    var meta = getMeta(cfg.appId);
    var last = meta.lastCheckAt ? Date.parse(meta.lastCheckAt) : 0;
    var due = (opts && opts.everyOpen) || Date.now() - last >= DAY_MS || hasUnsyncedEdits(cfg.appId, cfg.keys);
    if (!due) return;
    status('auto-sync…');
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action !== 'pull' && r.action !== 'merge') { status('synced ✓'); setTimeout(resetStatus, 2000); }
    }).catch(function (e) { console.warn('[sync] auto-sync failed', e); resetStatus(); });
  }

  // Debounced background push after local edits (opt-in; call from an app's save()).
  // Same reconcile as autoSync but ignores the 24h gate. Usually this only uploads, but if
  // another device changed the cloud meanwhile it merges (and reloads). Silently does
  // nothing when no token is set.
  var pushTimer = null;
  function pushSoon(ms) {
    if (!getToken()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      status('saving…');
      reconcile(cfg.appId, cfg.keys).then(function (r) {
        if (r.action !== 'pull' && r.action !== 'merge') { status('synced ✓'); setTimeout(resetStatus, 1500); }
      }).catch(function (e) { console.warn('[sync] background push failed', e); status('offline'); setTimeout(resetStatus, 2500); });
    }, ms || 4000);
  }

  // ── edit tracking ──────────────────────────────────────────────────────
  // Without this an app only reached the cloud on a manual Sync or the once-a-day check
  // on load, so a day's edits lived on ONE device (lost if browser data was cleared, and
  // stale everywhere else). Every write to a synced key stamps lastEditAt (used to settle
  // conflicts); with init({ autoPush: true }) it also schedules an upload.
  function isSyncedKey(key) { return !!cfg.appId && cfg.keys.indexOf(key) >= 0; }
  function recordEdit(key) {
    // noiseKeys are rewritten on page load / are per-device view state: not edits, and
    // nothing worth an upload (one used to cost a PATCH and a fresh .prev on every load).
    if (cfg.noiseKeys.indexOf(key) >= 0) return;
    var m = getMeta(cfg.appId); m.lastEditAt = new Date().toISOString(); setMeta(cfg.appId, m);
    if (cfg.autoPush) pushSoon(cfg.autoPushDelay);
  }
  var hooked = false;
  function installWriteHook() {
    if (hooked) return;
    hooked = true;
    // Real localStorage must be patched on Storage.prototype (assigning localStorage.setItem
    // would store an item named "setItem"); the Node test fake is a plain object.
    var proto = (typeof Storage !== 'undefined' && localStorage instanceof Storage) ? Storage.prototype : localStorage;
    ['setItem', 'removeItem'].forEach(function (fn) {
      var orig = proto[fn];
      if (typeof orig !== 'function') return;
      proto[fn] = function (k) {
        var mine = this === localStorage && isSyncedKey(String(k));
        if (mine && writeGate === 'reload-pending') {
          console.warn('[sync] dropped a write to "' + k + '": sync replaced it and the page is about to reload');
          return undefined;
        }
        var r = orig.apply(this, arguments);
        if (mine && writeGate === 'live') recordEdit(String(k));
        return r;
      };
    });
  }
  // Pages that write synced keys without loading sync.js (papers/paper-club.html and
  // google/google-onsite-log.html, also when shown in index.html's iframes) bypass the hook
  // above. A browser fires `storage` in every OTHER same-origin document when localStorage
  // changes, including the parent of an iframe, so those writes are caught here.
  // The same event also fires for writes made by another tab's sync (a pull or merge), and
  // those are not edits: they leave local data equal to what that sync just recorded in the
  // shared "-sync-meta", so a write that matches the last synced fingerprint is ignored.
  // That keeps two open tabs of one app from answering each other's syncs with uploads.
  function onStorage(e) {
    if (!e || e.key === null || e.key === undefined || !isSyncedKey(e.key)) return;
    if (e.storageArea && e.storageArea !== localStorage) return;   // sessionStorage
    if (writeGate !== 'live') return;
    var m = getMeta(cfg.appId);
    if (m.lastLocalHash && m.lastLocalHash === localHash(cfg.keys)) return;
    recordEdit(e.key);
  }
  var listening = false;
  function listenForOtherDocuments() {
    if (listening || typeof window.addEventListener !== 'function') return;
    listening = true;
    window.addEventListener('storage', onStorage);
  }

  // deepKeys: { key: idField } (or a list of keys, idField 'id'); see deepMerge.
  function normaliseDeepKeys(d) {
    if (Array.isArray(d)) { var o = {}; d.forEach(function (k) { o[k] = 'id'; }); return o; }
    return d || {};
  }
  function init(opts) {
    cfg.appId = opts.appId;
    cfg.keys = opts.keys || [];
    cfg.versionLabel = opts.versionLabel || '';
    cfg.noiseKeys = opts.noiseKeys || [];
    cfg.maxKeys = opts.maxKeys || [];
    cfg.deepKeys = normaliseDeepKeys(opts.deepKeys);
    cfg.autoPush = !!opts.autoPush;
    cfg.autoPushDelay = opts.autoPushDelayMs || AUTO_PUSH_MS;
    cfg.reloadDelay = opts.reloadDelayMs || RELOAD_MS;
    installWriteHook();
    listenForOtherDocuments();
    refreshBtnState();
    finishSignIn();
  }

  window.DataSync = {
    init: init,
    syncNow: syncNow,
    setToken: setToken,
    signIn: startSignIn,
    autoSync: autoSync,
    pushSoon: pushSoon,
    pullLatest: pullLatest,
    // Save the synced keys as the newest "-presync" snapshot. For other ways of replacing
    // local data (a backup import), so they keep the same undo copy a sync pull keeps.
    snapshot: function () { if (cfg.appId) snapshotLocal(cfg.appId, cfg.keys); },
    isConfigured: function () { return !!getToken(); }
  };
})();
