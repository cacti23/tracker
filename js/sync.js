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
   maxKeys (counter objects where a conflict keeps the larger number).
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TOKEN_KEY  = 'tracker-sync-token';
  var GISTID_KEY = 'tracker-sync-gistid';
  var GIST_DESC  = 'tracker-sync-v1';
  var API        = 'https://api.github.com';
  var DAY_MS     = 24 * 60 * 60 * 1000;

  var AUTO_PUSH_MS = 6000;
  var cfg = { appId: null, keys: [], versionLabel: '', noiseKeys: [], maxKeys: [], autoPush: false, autoPushDelay: AUTO_PUSH_MS };
  var syncWriting = false;   // true while sync itself writes localStorage, so the edit hook ignores it

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
  function pullApp(appId) {
    return withGist(function (id) {
      return api('/gists/' + id).then(function (g) {
        var file = g.files && g.files[appId + '.json'];
        if (!file) return null;
        if (file.truncated && file.raw_url) {
          // large file: gist inlines only ~1MB; fetch the full content (private
          // gists are reachable via their signed raw_url without an auth header)
          return fetch(file.raw_url).then(function (r) { return r.text(); }).then(parsePayload);
        }
        return parsePayload(file.content);
      });
    });
  }
  function collect(keys) {
    var data = {};
    keys.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    return data;
  }
  // data: what to upload (defaults to this device's current values). prevRemote: the cloud
  // copy we are about to replace — kept as "<appId>.prev.json" so one bad push is undoable.
  function pushApp(appId, keys, updatedAt, data, prevRemote) {
    var payload = JSON.stringify({ updatedAt: updatedAt, data: data || collect(keys) }, null, 2);
    return withGist(function (id) {
      var body = { files: {} };
      body.files[appId + '.json'] = { content: payload };
      if (prevRemote && prevRemote.data && Object.keys(prevRemote.data).length > 0) {
        body.files[appId + '.prev.json'] = {
          content: JSON.stringify({ updatedAt: prevRemote.updatedAt, backedUpAt: updatedAt, data: prevRemote.data })
        };
      }
      return api('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) });
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
  function localHash(keys) {
    var hashKeys = keys.filter(function (k) { return cfg.noiseKeys.indexOf(k) < 0; });
    var s = JSON.stringify(collect(hashKeys));
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
    return h.toString(36) + ':' + s.length;
  }
  function writeKeys(keys, data) {
    syncWriting = true;
    try {
      keys.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(data, k) && typeof data[k] === 'string' && localStorage.getItem(k) !== data[k]) {
          localStorage.setItem(k, data[k]);
        }
      });
    } finally { syncWriting = false; }
  }
  function markSynced(appId, keys, version) {
    syncWriting = true;
    try {
      var m = getMeta(appId);
      m.lastSyncedAt = version;                 // version we now hold
      m.lastCheckAt  = new Date().toISOString();
      m.lastLocalHash = localHash(keys);        // fingerprint of the data we now hold
      setMeta(appId, m);
    } finally { syncWriting = false; }
  }
  function applyPull(appId, keys, remote) {
    snapshotLocal(appId, keys);
    writeKeys(keys, remote.data);
    markSynced(appId, keys, remote.updatedAt);
  }

  // ── key-level merge ────────────────────────────────────────────────────
  // Each synced key holds a JSON string. Two devices that both edited since the last
  // sync used to fight over the whole file (one side's edits were lost). Now:
  //   • object  → union of top-level entries; an entry present on both sides takes the
  //               preferred side's value (numbers in maxKeys take the larger instead)
  //   • array   → union (entries with {lcKey, ts} dedupe by lcKey, newest first)
  //   • other   → the preferred side's value
  // Limits: there are no per-entry timestamps, so a deletion on one device can be undone
  // by the other device's older copy of that entry, and conflicting edits to the SAME
  // entry resolve to whichever side was edited most recently overall.
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
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
  function mergeValue(key, localStr, remoteStr, preferRemote) {
    if (localStr === undefined) return remoteStr;
    if (remoteStr === undefined || localStr === remoteStr) return localStr;
    var l = tryParse(localStr), r = tryParse(remoteStr);
    var prefStr = preferRemote ? remoteStr : localStr;
    if (!l || !r) return prefStr;
    var pref = preferRemote ? r.v : l.v, other = preferRemote ? l.v : r.v;
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
  function mergeData(keys, local, remote, preferRemote) {
    var out = {};
    keys.forEach(function (k) {
      var l = Object.prototype.hasOwnProperty.call(local, k) ? local[k] : undefined;
      var r = Object.prototype.hasOwnProperty.call(remote, k) && typeof remote[k] === 'string' ? remote[k] : undefined;
      var v = mergeValue(k, l, r, preferRemote);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  // Merge cloud + local, upload the merged result (keeping the old cloud copy as .prev),
  // then adopt it locally. 'pull' = the cloud already had everything; 'merge' = this
  // device's data changed (caller should reload); 'push' = only the cloud needed updating.
  function mergeAndSave(appId, keys, remote, preferRemote) {
    var local = collect(keys);
    var merged = mergeData(keys, local, remote.data, preferRemote);
    var differsFromRemote = keys.some(function (k) { return merged[k] !== undefined && merged[k] !== remote.data[k]; });
    var differsFromLocal = keys.some(function (k) { return merged[k] !== undefined && merged[k] !== local[k]; });
    if (!differsFromRemote) { applyPull(appId, keys, remote); return Promise.resolve({ action: 'pull' }); }
    var now = new Date().toISOString();
    var upload = {};
    Object.keys(remote.data).forEach(function (k) { upload[k] = remote.data[k]; });   // keep keys we don't manage
    Object.keys(merged).forEach(function (k) { upload[k] = merged[k]; });
    return pushApp(appId, keys, now, upload, remote).then(function () {
      if (differsFromLocal) { snapshotLocal(appId, keys); writeKeys(keys, merged); }
      markSynced(appId, keys, now);
      return { action: differsFromLocal ? 'merge' : 'push' };
    });
  }

  // ── the reconcile ──────────────────────────────────────────────────────
  // Decision order (first match wins). "Unchanged" = this device's data hasn't changed
  // since its own last successful sync, so it has no edits to lose.
  //   1. local empty + cloud has data               → pull (adopt the cloud)
  //   2. never synced here + cloud has data         → merge, cloud wins conflicts
  //                                                   (the device may hold real offline
  //                                                   progress; it used to be replaced)
  //   3. cloud is much richer than local            → merge, cloud wins conflicts
  //   4. cloud newer + local unchanged              → pull (clean fast-forward)
  //   5. cloud newer + local ALSO edited            → merge; whichever side was edited
  //                                                   most recently wins conflicts. This
  //                                                   used to push local over the cloud,
  //                                                   silently discarding the other
  //                                                   device's edits.
  //   6. otherwise                                  → push local (cloud copy kept as .prev)
  // A much THINNER cloud copy is never pulled over richer local data (it is repaired by 6).
  function doReconcile(appId, keys) {
    return pullApp(appId).then(function (remote) {
      var meta = getMeta(appId);
      var lastSynced = meta.lastSyncedAt ? Date.parse(meta.lastSyncedAt) : 0;
      var localEmpty = Object.keys(collect(keys)).length === 0;
      var remoteHasData = !!(remote && remote.data && Object.keys(remote.data).length > 0);
      var neverSyncedHere = !meta.lastSyncedAt;
      if (localEmpty && remoteHasData) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      if (neverSyncedHere && remoteHasData) {
        // The device's local state can look non-empty before the user touched anything
        // (e.g. a streak counter written on page load) — and it may also hold genuine
        // offline progress. Merge with the cloud preferred; applying a pull snapshots
        // local first, so nothing is lost either way.
        return mergeAndSave(appId, keys, remote, true);
      }
      // Ignore bookkeeping and compare content: a poisoned lastSyncedAt/lastLocalHash
      // (an older bug let a thin device "catch up" without real data) must not stop a
      // substantially richer cloud copy from being recovered.
      var localSize = JSON.stringify(collect(keys)).length;
      var remoteSize = remoteHasData ? JSON.stringify(remote.data).length : 0;
      if (remoteHasData && remoteSize > localSize * 2) {
        return mergeAndSave(appId, keys, remote, true);
      }
      var localUnchangedSinceSync = !!meta.lastLocalHash && meta.lastLocalHash === localHash(keys);
      var remoteNewer = !!(remote && remote.updatedAt && Date.parse(remote.updatedAt) > lastSynced);
      var remoteMuchThinner = remoteHasData && localSize > 0 && remoteSize * 2 < localSize;
      if (remoteNewer && localUnchangedSinceSync && !remoteMuchThinner) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      if (remoteHasData && remoteNewer && !localUnchangedSinceSync && !remoteMuchThinner) {
        // Both sides edited. Unknown local edit time (older bookkeeping) = trust local.
        var localEditedAt = meta.lastEditAt ? Date.parse(meta.lastEditAt) : Infinity;
        var preferRemote = Date.parse(remote.updatedAt) > localEditedAt;
        return mergeAndSave(appId, keys, remote, preferRemote);
      }
      var now = new Date().toISOString();
      return pushApp(appId, keys, now, null, remote).then(function () {
        markSynced(appId, keys, now);
        return { action: 'push' };
      });
    });
  }
  // One reconcile at a time: a background push firing while the user taps Sync (or two
  // quick edits) must not interleave two pull/merge/push cycles. A request that arrives
  // mid-flight shares the running one and schedules a single follow-up run.
  var inflight = null, rerun = false;
  function reconcile(appId, keys) {
    if (inflight) { rerun = true; return inflight; }
    inflight = doReconcile(appId, keys).then(function (r) {
      inflight = null;
      if (rerun) { rerun = false; reconcile(appId, keys).catch(function () {}); }
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

  // ── token entry ────────────────────────────────────────────────────────
  function setToken() {
    var t = prompt(
      'Paste your GitHub token.\n\n' +
      'Fine-grained PAT with "Gists" read+write (or a classic token with the "gist" scope).\n' +
      'Stored only in this browser, never in the repo. Leave blank to clear.',
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
  function syncNow() {
    if (!getToken() && !setToken()) return;
    status('syncing…');
    localStorage.removeItem(GISTID_KEY);   // manual action: re-resolve rather than trust a possibly-stale cached gist
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action === 'pull' || r.action === 'merge') {
        status(r.action === 'merge' ? 'synced ✓ merged' : 'synced ✓ pulled');
        setTimeout(function () { location.reload(); }, 600);
      } else {
        status('synced ✓ pushed');
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
      setTimeout(function () { location.reload(); }, 600);
    }).catch(function (e) {
      console.error('[sync]', e);
      status('pull failed ✕');
      alert('Pull failed: ' + e.message);
      setTimeout(resetStatus, 3000);
    });
  }

  function autoSync() {
    if (!getToken()) return;
    var meta = getMeta(cfg.appId);
    var last = meta.lastCheckAt ? Date.parse(meta.lastCheckAt) : 0;
    if (Date.now() - last < DAY_MS) return;   // already synced within 24h
    status('auto-sync…');
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action === 'pull' || r.action === 'merge') { setTimeout(function () { location.reload(); }, 300); }
      else { status('synced ✓'); setTimeout(resetStatus, 2000); }
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
        if (r.action === 'pull' || r.action === 'merge') { setTimeout(function () { location.reload(); }, 300); }
        else { status('synced ✓'); setTimeout(resetStatus, 1500); }
      }).catch(function (e) { console.warn('[sync] background push failed', e); status('offline'); setTimeout(resetStatus, 2500); });
    }, ms || 4000);
  }

  // ── auto-push after local edits ────────────────────────────────────────
  // Without this an app only reached the cloud on a manual Sync or the once-a-day check
  // on load, so a day's edits lived on ONE device (lost if browser data was cleared, and
  // stale everywhere else). Opt-in per app via init({ autoPush: true }). Hooks
  // localStorage writes to this app's synced keys; sync's own writes are ignored.
  var hooked = false;
  function onKeyWrite(key) {
    if (syncWriting || !cfg.appId || cfg.keys.indexOf(key) < 0) return;
    if (cfg.noiseKeys.indexOf(key) < 0) {
      var m = getMeta(cfg.appId); m.lastEditAt = new Date().toISOString(); setMeta(cfg.appId, m);
    }
    if (cfg.autoPush) pushSoon(cfg.autoPushDelay);
  }
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
        var r = orig.apply(this, arguments);
        if (this === localStorage) onKeyWrite(String(k));
        return r;
      };
    });
  }

  function init(opts) {
    cfg.appId = opts.appId;
    cfg.keys = opts.keys || [];
    cfg.versionLabel = opts.versionLabel || '';
    cfg.noiseKeys = opts.noiseKeys || [];
    cfg.maxKeys = opts.maxKeys || [];
    cfg.autoPush = !!opts.autoPush;
    cfg.autoPushDelay = opts.autoPushDelayMs || AUTO_PUSH_MS;
    installWriteHook();
    refreshBtnState();
  }

  window.DataSync = {
    init: init,
    syncNow: syncNow,
    setToken: setToken,
    autoSync: autoSync,
    pushSoon: pushSoon,
    pullLatest: pullLatest,
    isConfigured: function () { return !!getToken(); }
  };
})();
