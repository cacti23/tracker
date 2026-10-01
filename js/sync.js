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
  // Cheap content fingerprint of the synced keys — NOT a security hash, just enough
  // to answer "has anything changed here since the last successful sync?" without
  // storing (and diffing) a second full copy of potentially hundreds of KB of data.
  function localHash(keys) {
    var s = JSON.stringify(collect(keys));
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
    return h.toString(36) + ':' + s.length;
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
    m.lastLocalHash = localHash(keys);        // fingerprint of the data we now hold, post-pull
    setMeta(appId, m);
  }

  // ── the newest-wins reconcile ──────────────────────────────────────────
  // "Newest wins" used to mean "whichever side was UPLOADED most recently wins the
  // whole file" — which silently discarded a device's own not-yet-pushed edits
  // whenever anything else (another device/browser sharing the token, or even just
  // reopening after the 24h autoSync gate) had a later upload timestamp, regardless
  // of whether that upload actually contained newer data. That's how graded
  // questions could vanish/revert: you grade a batch, nothing pushes it yet, the
  // next reconcile sees a "newer" remote timestamp and overwrites your batch with
  // an older cloud copy.
  //
  // Fix: only trust "remote is newer, so pull it" when THIS device has no unpushed
  // local edits to lose (its data hasn't changed since its own last successful
  // sync). If local HAS changed since then, local edits always win and get pushed
  // — never silently discarded by a differently-timestamped copy from elsewhere.
  function reconcile(appId, keys) {
    return pullApp(appId).then(function (remote) {
      var meta = getMeta(appId);
      var lastSynced = meta.lastSyncedAt ? Date.parse(meta.lastSyncedAt) : 0;
      var localEmpty = Object.keys(collect(keys)).length === 0;
      var remoteHasData = remote && remote.data && Object.keys(remote.data).length > 0;
      // This device has never completed a sync (no lastSyncedAt) — it has no basis
      // for claiming its local state is the one worth keeping. That local state can
      // still look non-empty (e.g. dsa-streak-v1 is written on every page load, before
      // the user has touched a single question), which used to fall through to the
      // push branch below and silently clobber a real synced backup with near-empty
      // first-run state. Treat "never synced here" the same as "local is empty":
      // adopt the cloud's data. applyPull() always snapshots local to "<appId>-presync"
      // first, so nothing on this device is lost by doing so.
      var neverSyncedHere = !meta.lastSyncedAt;
      if ((localEmpty || neverSyncedHere) && remoteHasData) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      // Belt-and-suspenders guard against the SAME failure mode once meta bookkeeping
      // has already been poisoned by a prior bad sync (e.g. this device pushed thin
      // data once under an older bug, so it now has its own lastSyncedAt/lastLocalHash
      // that make it look "caught up" even though it never actually held the real
      // data). Ignore all bookkeeping and compare content directly: if remote is
      // substantially richer than local, the cloud is almost certainly the side with
      // real data — pull it rather than trust a hash that only proves local matches
      // its OWN last (possibly bad) push.
      var localSize = JSON.stringify(collect(keys)).length;
      var remoteSize = remoteHasData ? JSON.stringify(remote.data).length : 0;
      if (remoteHasData && remoteSize > localSize * 2) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      var localUnchangedSinceSync = !!meta.lastLocalHash && meta.lastLocalHash === localHash(keys);
      // Mirror of the guard above: never let a much THINNER cloud copy overwrite richer
      // local data just because its timestamp is newer (e.g. another device pushed
      // near-empty first-run state). Fall through to push instead, which repairs the cloud.
      var remoteMuchThinner = remoteHasData && localSize > 0 && remoteSize * 2 < localSize;
      if (remote && remote.updatedAt && Date.parse(remote.updatedAt) > lastSynced && localUnchangedSinceSync && !remoteMuchThinner) {
        applyPull(appId, keys, remote);
        return { action: 'pull' };
      }
      var now = new Date().toISOString();
      return pushApp(appId, keys, now).then(function () {
        var m = getMeta(appId);
        m.lastSyncedAt = now;
        m.lastCheckAt  = now;
        m.lastLocalHash = localHash(keys);
        setMeta(appId, m);
        return { action: 'push' };
      });
    });
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
      if (r.action === 'pull') { setTimeout(function () { location.reload(); }, 300); }
      else { status('synced ✓'); setTimeout(resetStatus, 2000); }
    }).catch(function (e) { console.warn('[sync] auto-sync failed', e); resetStatus(); });
  }

  // Debounced background push after local edits (opt-in; call from an app's save()).
  // Same reconcile as autoSync but ignores the 24h gate. Local edits always win, so this
  // only ever uploads; it silently does nothing when no token is set.
  var pushTimer = null;
  function pushSoon(ms) {
    if (!getToken()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      status('saving…');
      reconcile(cfg.appId, cfg.keys).then(function (r) {
        if (r.action === 'pull') { setTimeout(function () { location.reload(); }, 300); }
        else { status('synced ✓'); setTimeout(resetStatus, 1500); }
      }).catch(function (e) { console.warn('[sync] background push failed', e); status('offline'); setTimeout(resetStatus, 2500); });
    }, ms || 4000);
  }

  function init(opts) {
    cfg.appId = opts.appId;
    cfg.keys = opts.keys || [];
    cfg.versionLabel = opts.versionLabel || '';
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
