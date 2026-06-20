/* ──────────────────────────────────────────────────────────────────────────
   DataSync — free, dead-simple cross-device sync for the tracker apps.

   Backend: one PRIVATE GitHub gist (description "tracker-sync-v1") holding one
   JSON file per app, e.g. dsa.json / gym5day.json, each shaped:
       { "updatedAt": "<ISO>", "data": { "<localStorageKey>": "<stringValue>" } }

   Auth: a token the user pastes ONCE per device. Stored only in localStorage,
   never committed to the repo, so pushing the HTML to GitHub/Pages stays safe.
   Use a fine-grained PAT with only the "Gists" permission (read+write), or a
   classic token with the single "gist" scope.

   Mode: two-way, newest-wins. On reconcile we compare the remote version's
   timestamp against the version we last held locally; the newer side wins. A
   local pre-sync snapshot ("<appId>-presync") is kept before any overwrite.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TOKEN_KEY  = 'tracker-sync-token';
  var GISTID_KEY = 'tracker-sync-gistid';
  var GIST_DESC  = 'tracker-sync-v1';
  var API        = 'https://api.github.com';
  var DAY_MS     = 24 * 60 * 60 * 1000;

  var cfg = { appId: null, keys: [], versionLabel: '' };

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
  function resolveGist() {
    var cached = localStorage.getItem(GISTID_KEY);
    if (cached) return Promise.resolve(cached);
    return api('/gists?per_page=100').then(function (list) {
      var found = (list || []).filter(function (g) { return g.description === GIST_DESC; })[0];
      if (found) { localStorage.setItem(GISTID_KEY, found.id); return found.id; }
      var body = {
        description: GIST_DESC,
        public: false,
        files: { 'README.md': { content: 'Tracker sync data — managed automatically by sync.js. Do not edit by hand.' } }
      };
      return api('/gists', { method: 'POST', body: JSON.stringify(body) }).then(function (g) {
        localStorage.setItem(GISTID_KEY, g.id);
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
  function pushApp(appId, keys, updatedAt) {
    var payload = JSON.stringify({ updatedAt: updatedAt, data: collect(keys) }, null, 2);
    return withGist(function (id) {
      var body = { files: {} };
      body.files[appId + '.json'] = { content: payload };
      return api('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) });
    });
  }

  // ── local snapshot + apply pulled data ─────────────────────────────────
  function snapshotLocal(appId, keys) {
    try {
      localStorage.setItem(appId + '-presync',
        JSON.stringify({ savedAt: new Date().toISOString(), data: collect(keys) }));
    } catch (e) { /* ignore quota */ }
  }
  function applyPull(appId, keys, remote) {
    snapshotLocal(appId, keys);
    keys.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(remote.data, k) && typeof remote.data[k] === 'string') {
        localStorage.setItem(k, remote.data[k]);
      }
    });
    var m = getMeta(appId);
    m.lastSyncedAt = remote.updatedAt;        // version we now hold
    m.lastCheckAt  = new Date().toISOString();
    setMeta(appId, m);
  }

  // ── the newest-wins reconcile ──────────────────────────────────────────
  function reconcile(appId, keys) {
    return pullApp(appId).then(function (remote) {
      var meta = getMeta(appId);
      var lastSynced = meta.lastSyncedAt ? Date.parse(meta.lastSyncedAt) : 0;
      var localEmpty = Object.keys(collect(keys)).length === 0;
      var remoteHasData = remote && remote.data && Object.keys(remote.data).length > 0;
      // Safety net: if local is empty (e.g. localStorage was cleared) but the
      // cloud still has data, ALWAYS restore from the cloud — never let an empty
      // app overwrite a good backup, regardless of timestamps.
      if (localEmpty && remoteHasData) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      if (remote && remote.updatedAt && Date.parse(remote.updatedAt) > lastSynced) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      var now = new Date().toISOString();
      return pushApp(appId, keys, now).then(function () {
        var m = getMeta(appId);
        m.lastSyncedAt = now;
        m.lastCheckAt  = now;
        setMeta(appId, m);
        return { action: 'push' };
      });
    });
  }

  // ── button status helpers (button must have id="dataSyncBtn") ──────────
  function getBtn() { return document.getElementById('dataSyncBtn'); }
  function status(msg) {
    var b = getBtn();
    if (b) { if (!b.dataset.orig) b.dataset.orig = b.textContent; b.textContent = msg; }
  }
  function resetStatus() {
    var b = getBtn();
    if (b && b.dataset.orig) b.textContent = b.dataset.orig;
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
    return !!t;
  }

  // ── public actions ─────────────────────────────────────────────────────
  function syncNow() {
    if (!getToken() && !setToken()) return;
    status('syncing…');
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action === 'pull') {
        status('synced ✓ pulled');
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

  function autoSync() {
    if (!getToken()) return;
    var meta = getMeta(cfg.appId);
    var last = meta.lastCheckAt ? Date.parse(meta.lastCheckAt) : 0;
    if (Date.now() - last < DAY_MS) return;   // already synced within 24h
    status('auto-sync…');
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action === 'pull') { setTimeout(function () { location.reload(); }, 300); }
      else { status('synced ✓'); setTimeout(resetStatus, 2000); }
    }).catch(function (e) { console.warn('[sync] auto-sync failed', e); resetStatus(); });
  }

  function init(opts) {
    cfg.appId = opts.appId;
    cfg.keys = opts.keys || [];
    cfg.versionLabel = opts.versionLabel || '';
  }

  window.DataSync = {
    init: init,
    syncNow: syncNow,
    setToken: setToken,
    autoSync: autoSync,
    isConfigured: function () { return !!getToken(); }
  };
})();
