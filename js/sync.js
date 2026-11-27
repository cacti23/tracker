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
   that was edited more recently wins (see mergeValue / reconcile). Inside a key, entries
   merge three-way too (mergeEntries): an entry only one side changed or deleted takes that
   side, so a delete sticks and device clocks only matter when both sides edited one entry.
   Before anything is overwritten locally, a snapshot ("<appId>-presync", last 3 kept) is
   saved; the cloud side is covered by the gist's own revision history.
   Health: every sync ends in one named state (see HEALTH) shown on the account button; a
   lost sign-in shows a banner, a GitHub rate limit pauses syncing until GitHub's reset time.
   Optional init() settings: autoPush (upload shortly after every local edit),
   noiseKeys (keys that change on every page load and so don't count as "edited"),
   maxKeys (counter objects where a conflict keeps the larger number),
   deepKeys ({ key: idField } — merge that key's JSON recursively, see deepMerge).
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var TOKEN_KEY  = 'tracker-sync-token';
  var GISTID_KEY = 'tracker-sync-gistid';
  var LOGIN_KEY  = 'tracker-sync-login';   // GitHub username, only for the account button's label
  var EXPIRES_KEY = 'tracker-sync-expires'; // ms epoch when a GitHub App token (ghu_) runs out
  var REFRESH_EARLY_MS = 5 * 60 * 1000;     // renew a little before, so no request meets a dead token
  var GIST_DESC  = 'tracker-sync-v1';
  var API        = 'https://api.github.com';
  var DAY_MS     = 24 * 60 * 60 * 1000;

  var PAUSE_KEY  = 'tracker-sync-paused-until';   // ms epoch; GitHub rate-limited us, shared by tabs
  var LOCK_NAME  = 'tracker-sync';                // one sync at a time across every tab of the origin
  var REQUEST_TIMEOUT_MS = 30000;                 // a hung request must not hold the lock forever
  var RATE_WAIT_MS = 60000;                       // GitHub's advice when a limit gives no reset time

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
  function setTokenValue(t, expiresIn) {
    whoAmI = null;   // a new token may belong to another account
    storeToken(t, expiresIn);
  }
  // expiresIn: seconds the token lives (GitHub App sign-in: 8 h); none = it never expires.
  function storeToken(t, expiresIn) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    if (t && Number(expiresIn) > 0) localStorage.setItem(EXPIRES_KEY, String(Date.now() + Number(expiresIn) * 1000));
    else localStorage.removeItem(EXPIRES_KEY);
  }

  // ── short-lived tokens ─────────────────────────────────────────────────
  // A "Sign in with GitHub" token from the GitHub App (ghu_…) works for 8 hours. The refresh
  // token that renews it never reaches this script: it sits in an HttpOnly cookie that only
  // api/github-oauth.js can read. So renewing is one same-site POST, and a script injected into
  // the page could steal at most a token that dies within hours. Older tokens (gho_…, pasted
  // ones) have no expiry and are used as they are.
  function expiresAt() { return Number(localStorage.getItem(EXPIRES_KEY)) || 0; }
  function canRenew() { return /^ghu_/.test(getToken()); }
  function needsRenew() { return canRenew() && expiresAt() > 0 && Date.now() > expiresAt() - REFRESH_EARLY_MS; }
  var renewing = null;
  // Resolves true when a usable token is stored. GitHub replaces the refresh token on every use,
  // so two tabs renewing at once would race; the Web Lock lets the second one see the first
  // one's new token and skip its own request.
  function renewToken() {
    if (renewing) return renewing;
    var before = getToken();
    function run() {
      if (getToken() !== before && !needsRenew()) return Promise.resolve(true);   // another tab renewed
      if (typeof fetch !== 'function') return Promise.resolve(false);
      return fetch('/api/github-oauth?action=refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
        if (!r || !r.ok) return false;
        return r.json().then(function (b) {
          if (!b || typeof b.access_token !== 'string' || !b.access_token) return false;
          storeToken(b.access_token, b.expires_in);
          return true;
        });
      }).catch(function () { return false; });
    }
    var locks = typeof navigator !== 'undefined' && navigator && navigator.locks;
    var p = locks && typeof locks.request === 'function' ? locks.request('tracker-token-refresh', run) : run();
    renewing = p.then(function (ok) { renewing = null; return ok; }, function () { renewing = null; return false; });
    return renewing;
  }
  function freshToken() { return needsRenew() ? renewToken() : Promise.resolve(true); }
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
  // Every failure carries a kind, so the caller can react to the cause and the person sees
  // the right message: 'auth' (token revoked/expired, sign in again), 'rate' (GitHub asked us
  // to slow down; retryAt says until when), 'network' (offline, timed out), 'http' (other).
  function header(res, name) {
    try { return res && res.headers && typeof res.headers.get === 'function' ? res.headers.get(name) : null; } catch (e) { return null; }
  }
  function httpError(res, body) {
    body = String(body || '');
    var e = new Error('GitHub API ' + res.status + ': ' + body.slice(0, 200));
    e.status = res.status;
    var retryAfter = Number(header(res, 'retry-after')) || 0;
    var reset = Number(header(res, 'x-ratelimit-reset')) || 0;
    var rate = res.status === 429 || (res.status === 403 && (retryAfter > 0 || header(res, 'x-ratelimit-remaining') === '0' || /rate limit/i.test(body)));
    if (rate) {
      e.kind = 'rate';
      e.retryAt = retryAfter > 0 ? Date.now() + retryAfter * 1000 : reset > 0 ? reset * 1000 : Date.now() + RATE_WAIT_MS;
    } else {
      e.kind = (res.status === 401 || res.status === 403) ? 'auth' : 'http';
    }
    return e;
  }
  function networkError(cause) {
    var e = new Error('Could not reach GitHub (' + ((cause && cause.message) || 'network error') + ')');
    e.kind = 'network';
    return e;
  }
  // A ghu_ token is renewed before it runs out, and once more if GitHub still says 401 (it was
  // revoked early, or this device's clock is off); a second 401 is a real lost sign-in.
  function api(path, opts, renewed) {
    opts = opts || {};
    return freshToken().then(function () { return send(path, opts); }).catch(function (e) {
      if (renewed || !e || e.status !== 401 || !canRenew()) throw e;
      return renewToken().then(function (ok) { if (!ok) throw e; return api(path, opts, true); });
    });
  }
  function send(path, opts) {
    opts.headers = headers();
    // api.github.com answers GETs with "Cache-Control: private, max-age=60", so without
    // this a re-pull within a minute of the last one can be served from Chrome's HTTP
    // cache — i.e. stale data that looks exactly like "pull did nothing".
    opts.cache = 'no-store';
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, REQUEST_TIMEOUT_MS) : null;
    if (ctl) opts.signal = ctl.signal;
    var done = function () { if (timer) clearTimeout(timer); };
    return fetch(API + path, opts).then(function (res) {
      done();
      if (!res.ok) {
        return res.text().then(function (t) { throw httpError(res, t); });
      }
      return res.json();
    }, function (err) { done(); throw networkError(err); });
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
          // A first sign-in lands here too, so this reads as a receipt, not a warning; the
          // wrong-account hint stays for someone who expected their data to be there.
          alert('☁ Sync is on. A new private gist was created in your GitHub account to hold your progress.\n\n' +
                'Already use the tracker on another device? Sign out here and sign in with the GitHub account that device uses, or your progress will not appear.');
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
      // Only a bad gist id is fixed by re-resolving. Retrying a rate limit, a lost sign-in or
      // a dropped connection would just send more requests that fail the same way.
      if (hadCachedId && !(e && (e.kind === 'auth' || e.kind === 'rate' || e.kind === 'network'))) {
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
  // carrying its raw text in `unreadable`: there is nothing in it to pull or merge, and the
  // gist's revision history keeps that text after an upload replaces it. A failed download of a
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
  // Older versions kept the replaced cloud copy as "<appId>.prev.json". The gist's revision
  // history already holds every earlier copy, so that file doubled each upload for nothing.
  // While it still exists, the next upload deletes it (a delete of a missing file would fail).
  var hasLegacyPrev = {};
  function notePrev(g, appId) { hasLegacyPrev[appId] = !!(g && g.files && g.files[appId + '.prev.json']); }
  function fetchApp(appId) {
    return withGist(function (id) {
      return api('/gists/' + id).then(function (g) {
        notePrev(g, appId);
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
  // data: what to upload. The copy it replaces stays reachable in the gist's revision history
  // (gist.github.com → Revisions), which is the cloud-side undo.
  // base: { version, updatedAt } of the cloud as we last read it. The gist API has no
  // compare-and-swap, so a lost update is caught after the fact: the PATCH response's history
  // names the revision we replaced. If that isn't the one we read, another push landed in
  // between; if it changed this app's file, it comes back as `clobbered` for the caller to
  // merge back in (a push by another app to its own file is not a conflict).
  function pushApp(appId, updatedAt, data, base) {
    // Compact JSON: indentation only made every upload bigger.
    var payload = JSON.stringify({ updatedAt: updatedAt, data: data });
    return withGist(function (id) {
      var body = { files: {} };
      body.files[appId + '.json'] = { content: payload };
      if (hasLegacyPrev[appId]) body.files[appId + '.prev.json'] = null;
      return api('/gists/' + id, { method: 'PATCH', body: JSON.stringify(body) }).then(function (g) {
        notePrev(g, appId);
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
  // The same, one level down: per key holding a JSON object, one fingerprint per entry (per
  // question, per note...). Kept in its own "<appId>-sync-base" item, not the meta, because it
  // is large and the meta is rewritten on every edit. Lets a merge tell, entry by entry,
  // "this side deleted or edited it" from "this side's copy is just old" (see mergeEntries).
  function baseKey(appId) { return appId + '-sync-base'; }
  function entryHashes(keys, data) {
    var out = {};
    keys.forEach(function (k) {
      var p = typeof data[k] === 'string' ? tryParse(data[k]) : null;
      if (!p || !isObj(p.v)) return;
      var m = out[k] = {};
      Object.keys(p.v).forEach(function (e) { m[e] = strHash(JSON.stringify(p.v[e])); });
    });
    return out;
  }
  function getBase(appId) {
    try { var b = JSON.parse(localStorage.getItem(baseKey(appId)) || 'null'); return isObj(b) ? b : null; }
    catch (e) { return null; }
  }
  // The common ancestor for a merge: per-key fingerprints (meta) plus per-entry ones (base).
  function ancestorOf(appId, meta) {
    if (!meta.keyHashes) return null;
    return { keys: meta.keyHashes, entries: getBase(appId) || {} };
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
    try { localStorage.setItem(baseKey(appId), JSON.stringify(entryHashes(keys, synced))); }
    catch (e) { localStorage.removeItem(baseKey(appId)); }   // full storage: merges fall back to key level
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
  // Both sides changed key `key`, whose value is a JSON object (question → status, question →
  // note...). Merge it entry by entry against the fingerprints from the last sync (anc):
  //   • an entry only one side changed, added or DELETED takes that side, so a delete sticks
  //     instead of coming back from the other device's older copy;
  //   • deleted on one side but edited on the other: the edit is kept (no work is lost);
  //   • edited on both: the key's usual rule on just that entry (maxKeys keep the larger
  //     number, deepKeys merge inside it, else the preferred side). Only this case still
  //     depends on which device edited last, i.e. on device clocks.
  // Returns undefined when either side isn't an object, for the key-level rules to handle.
  function mergeEntries(key, localStr, remoteStr, anc, preferRemote) {
    var l = tryParse(localStr), r = tryParse(remoteStr);
    if (!l || !r || !isObj(l.v) || !isObj(r.v)) return undefined;
    var out = {}, seen = {};
    var fp = function (s) { return s === undefined ? undefined : strHash(s); };
    Object.keys(l.v).concat(Object.keys(r.v), Object.keys(anc)).forEach(function (e) {
      if (has(seen, e)) return;
      seen[e] = 1;
      var lv = has(l.v, e) ? JSON.stringify(l.v[e]) : undefined;
      var rv = has(r.v, e) ? JSON.stringify(r.v[e]) : undefined;
      var a = has(anc, e) ? anc[e] : undefined;
      var v;
      if (lv === rv) v = lv;
      else if (fp(lv) === a) v = rv;              // only the cloud changed it
      else if (fp(rv) === a) v = lv;              // only this device changed it
      else if (lv === undefined) v = rv;          // deleted here, edited there
      else if (rv === undefined) v = lv;          // edited here, deleted there
      else v = JSON.stringify(JSON.parse(mergeValue(key, '{"e":' + lv + '}', '{"e":' + rv + '}', preferRemote)).e);
      if (v !== undefined) out[e] = JSON.parse(v);
    });
    return JSON.stringify(out);
  }
  // ancestor: { keys, entries } fingerprints from the last sync (see ancestorOf), or null when
  // they can't be trusted. A key only ONE side changed since then takes that side's value whole, even
  // when the other side is preferred: its copy is just older, not an edit (an untouched
  // stale key on the newer side used to overwrite the other side's edit, e.g. a paper
  // marked Done in the Papers iframe). Only keys both sides changed go through mergeValue.
  function mergeData(keys, local, remote, preferRemote, ancestor) {
    var out = {};
    keys.forEach(function (k) {
      var l = has(local, k) ? local[k] : undefined;
      var r = has(remote, k) && typeof remote[k] === 'string' ? remote[k] : undefined;
      var v;
      if (ancestor && has(ancestor.keys, k) && l !== undefined && r !== undefined && l !== r) {
        if (strHash(l) === ancestor.keys[k]) v = r;
        else if (strHash(r) === ancestor.keys[k]) v = l;
        else if (has(ancestor.entries, k)) v = mergeEntries(k, l, r, ancestor.entries[k], preferRemote);
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
    return pushApp(appId, now, upload, base).then(function (res) {
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
        return mergeAndSave(appId, keys, remote, { preferRemote: preferCloud(meta, remote), ancestor: ancestorOf(appId, meta) }, base, 0);
      }
      if (remote && !remoteChanged && localUnchangedSinceSync) {
        touchCheck(appId);
        return { action: 'none' };
      }
      var now = new Date().toISOString();
      var data = collect(keys);
      return pushApp(appId, now, data, base).then(function (res) {
        markSynced(appId, keys, now, data);
        var r = { action: 'push', followUp: localHash(keys) !== hashOf(keys, data) };
        if (!res.clobbered) return r;
        return recoverClobbered(appId, keys, res, now, data, 0).then(function (r2) { return combine(r, r2); });
      });
    });
  }
  // ── whose data is this? ────────────────────────────────────────────────
  // Signing out leaves this device's progress in place. If a DIFFERENT GitHub account then
  // signs in (a shared browser), a plain sync would upload that progress into the new
  // account's gist as if it were its own. So the meta remembers the account the local data
  // was last synced with (lastLogin), and a switch asks first. The token is shared by every
  // app on the origin, so each app checks on its own next sync, not only the sign-in page.
  var whoAmI = null;
  function currentLogin() {
    var l = localStorage.getItem(LOGIN_KEY);
    if (l) return Promise.resolve(l);
    if (!whoAmI) whoAmI = api('/user').then(function (u) { rememberLogin(u.login); return u.login; }, function () { whoAmI = null; return null; });
    return whoAmI;
  }
  function guardAccount(appId, keys) {
    return currentLogin().then(function (login) {
      if (!login) return;                        // unknown: the sync itself will fail or stay in-account
      var m = getMeta(appId), owner = m.lastLogin;
      if (owner === login) return;
      if (!owner) { m.lastLogin = login; setMeta(appId, m); return; }   // synced before this check existed
      var hasData = Object.keys(collect(keys)).length > 0;
      var loadTheirs = !hasData || typeof confirm !== 'function' || confirm(
        'This device holds tracker progress from @' + owner + ', and you are now signed in as @' + login + '.\n\n' +
        'OK: load @' + login + "'s own progress here (recommended). @" + owner + "'s progress is kept on this device as an undo copy and is not uploaded.\n" +
        'Cancel: keep this device\'s progress and add it to @' + login + "'s account.");
      // Fresh bookkeeping either way: the old meta describes the other account's gist. With no
      // lastSyncedAt, the reconcile pulls (local now empty) or merges with the cloud preferred.
      setMeta(appId, { lastLogin: login });
      localStorage.removeItem(baseKey(appId));
      if (!loadTheirs || !hasData) return;
      writeGate = 'sync-writing';
      try {
        snapshotLocal(appId, keys);
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } finally { writeGate = 'reload-pending'; }
      scheduleReload();   // the page still holds the old progress in memory
    });
  }

  // One reconcile at a time: a background push firing while the user taps Sync (or two
  // quick edits) must not interleave two pull/merge/push cycles. A request that arrives
  // mid-flight shares the running one and schedules a single follow-up run; so does a run
  // that ends with local edits the cloud doesn't have yet (made while it was uploading).
  // Across tabs, the Web Locks API runs one sync at a time per browser: a second tab waits,
  // then finds the first tab's result already in the shared localStorage and has nothing to
  // send. Without locks (older browsers, tests) each tab syncs alone, as before.
  function withLock(fn) {
    var locks = typeof navigator !== 'undefined' && navigator && navigator.locks;
    if (!locks || typeof locks.request !== 'function') return fn();
    return locks.request(LOCK_NAME, fn);
  }
  // GitHub rate-limited us: no request until its reset time, in any tab (the pause is stored).
  function pausedUntil() { return Number(localStorage.getItem(PAUSE_KEY)) || 0; }
  var resumeTimer = null;
  function scheduleResume() {
    var wait = pausedUntil() - Date.now();
    if (wait <= 0 || resumeTimer) return;
    resumeTimer = setTimeout(function () { resumeTimer = null; autoSync({ everyOpen: true }); }, wait + 1000);
  }
  function rateError() {
    var e = new Error('GitHub asked us to slow down. Sync resumes at ' + new Date(pausedUntil()).toLocaleTimeString() + '.');
    e.kind = 'rate'; e.retryAt = pausedUntil();
    return e;
  }
  var inflight = null, rerun = false;
  function reconcile(appId, keys) {
    if (inflight) { rerun = true; return inflight; }
    if (Date.now() < pausedUntil()) { scheduleResume(); setHealth('rate', rateError()); return Promise.reject(rateError()); }
    inflight = withLock(function () {
      return guardAccount(appId, keys).then(function () { return doReconcile(appId, keys); });
    }).then(function (r) {
      inflight = null;
      setHealth('ok');
      if (rerun || r.followUp) { rerun = false; reconcile(appId, keys).catch(function () {}); }
      return r;
    }, function (e) {
      inflight = null; rerun = false;
      if (e && e.kind === 'rate') { localStorage.setItem(PAUSE_KEY, String(e.retryAt)); scheduleResume(); }
      setHealth((e && e.kind) || 'error', e);
      throw e;
    });
    return inflight;
  }

  // ── sync health ────────────────────────────────────────────────────────
  // The apps have no Sync button any more, so a failing sync used to be invisible: a revoked
  // sign-in failed quietly on every open while the person thought they were synced. Every
  // sync now ends in one of these states, shown on the account button (a dot + its tooltip):
  //   'unknown' nothing tried yet on this page   'ok'      last sync worked
  //   'offline' no connection; retried when the browser is back online, and on every open
  //   'rate'    GitHub rate limit; paused until GitHub's reset time
  //   'auth'    the sign-in no longer works (expired, revoked, wrong permission): a banner
  //             asks the person to sign in again, since no retry can fix it
  //   'error'   anything else; retried on the next edit, open or tab return
  var HEALTH = { unknown: 1, ok: 1, offline: 1, rate: 1, auth: 1, error: 1 };
  var health = { state: 'unknown', message: '' };
  function setHealth(state, err) {
    if (state === 'network') state = 'offline';
    if (state === 'http') state = 'error';
    if (!HEALTH[state]) state = 'error';
    health = { state: state, message: (err && err.message) || '' };
    if (state === 'ok') localStorage.removeItem(PAUSE_KEY);
    refreshBtnState();
    showAuthBanner(state === 'auth');
  }
  function ago(iso) {
    var s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (!(s >= 0)) return '';
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' days ago';
  }
  function healthText() {
    var last = cfg.appId && getMeta(cfg.appId).lastCheckAt;
    var when = last ? 'Last synced ' + ago(last) + '.' : 'Not synced yet on this device.';
    switch (health.state) {
      case 'offline': return 'Offline: your edits are saved on this device and upload when you are back online. ' + when;
      case 'rate':    return 'GitHub asked us to slow down. Sync resumes at ' + new Date(pausedUntil()).toLocaleTimeString() + '. ' + when;
      case 'auth':    return 'Sync stopped: your GitHub sign-in no longer works. Sign out and sign in again. ' + when;
      case 'error':   return 'Last sync failed (' + health.message.slice(0, 120) + '). It retries on your next edit. ' + when;
      default:        return when;
    }
  }
  // Styles live here, not in each app, so all three apps show the same dot and banner.
  var styled = false;
  function injectStyles() {
    if (styled || typeof document === 'undefined' || !document.createElement || !document.head) return;
    styled = true;
    var st = document.createElement('style');
    st.textContent =
      'body[data-sync-health="offline"] #dataAccountBtn::after,body[data-sync-health="rate"] #dataAccountBtn::after,' +
      'body[data-sync-health="error"] #dataAccountBtn::after,body[data-sync-health="auth"] #dataAccountBtn::after' +
      '{content:"";display:inline-block;flex:none;width:8px;height:8px;border-radius:50%;margin-left:6px;vertical-align:middle;background:#d29922}' +
      'body[data-sync-health="auth"] #dataAccountBtn::after{background:#e5534b}' +
      '.ds-sync-banner{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 32px);' +
      'display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:10px;background:#2d1b1b;color:#ffd8d3;' +
      'border:1px solid #e5534b;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)}' +
      '.ds-sync-banner button{font:inherit;cursor:pointer;border-radius:6px;padding:4px 10px;border:1px solid #e5534b;background:#e5534b;color:#fff}' +
      '.ds-sync-banner button.ds-x{background:transparent;color:inherit;border-color:transparent}';
    document.head.appendChild(st);
  }
  var bannerDismissed = false;
  function showAuthBanner(on) {
    if (typeof document === 'undefined' || !document.createElement || !document.body) return;
    var el = document.getElementById('dsSyncBanner');
    if (!on || bannerDismissed) { if (el && el.remove) el.remove(); return; }
    if (el) return;
    injectStyles();
    el = document.createElement('div');
    el.id = 'dsSyncBanner';
    el.className = 'ds-sync-banner';
    el.setAttribute('role', 'alert');
    var msg = document.createElement('span');
    msg.textContent = '⚠ Sync stopped: your GitHub sign-in no longer works. Your edits are safe on this device.';
    var again = document.createElement('button');
    again.type = 'button';
    again.textContent = 'Sign in again';
    again.addEventListener('click', function () { setTokenValue(''); localStorage.removeItem(GISTID_KEY); startSignIn(); });
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'ds-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { bannerDismissed = true; showAuthBanner(false); });
    el.appendChild(msg); el.appendChild(again); el.appendChild(x);
    document.body.appendChild(el);
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
    if (b) b.classList.toggle('ds-token-set', !!getToken());
    // Who is signed in, for page CSS (the hub shows its owner's 🌱 Life apps only to him).
    // A UI rule, not access control: the pages themselves are public.
    var who = getToken() ? localStorage.getItem(LOGIN_KEY) || '' : '';
    if (document.body && document.body.dataset) {
      document.body.dataset.signedInAs = who;
      document.body.dataset.syncHealth = getToken() ? health.state : '';
    }
    // The account button (id="dataAccountBtn", optional .ds-account-label inside) is the
    // one place to sign in or out; its label is derived from the stored token and login.
    var a = document.getElementById('dataAccountBtn');
    if (!a) return;
    var login = localStorage.getItem(LOGIN_KEY);
    var label = !getToken() ? 'Sign in with GitHub' : login ? '@' + login : 'Signed in';
    var span = a.querySelector ? a.querySelector('.ds-account-label') : null;
    if (span) span.textContent = label; else a.textContent = label;
    a.classList.toggle('ds-token-set', !!getToken());
    a.title = getToken() ? 'Syncing with GitHub' + (login ? ' as @' + login : '') + '. ' + healthText() + '\nTap to sign out on this device.' : 'Sign in with GitHub to sync across your devices';
  }
  function rememberLogin(login) {
    if (login) localStorage.setItem(LOGIN_KEY, login);
    refreshBtnState();
  }

  // Account button: signed out → Sign in with GitHub; signed in → offer to sign out.
  // Sign-out cancels the token at GitHub (a sign-in token never expires on its own, so a copied
  // one would keep working), then offers to erase this browser's progress: on a shared or public
  // computer, the next person would otherwise be able to read it.
  function account() {
    if (!getToken()) return startSignIn();
    var login = localStorage.getItem(LOGIN_KEY);
    if (!confirm('Signed in' + (login ? ' as @' + login : '') + '.\n\nSign out on this device? Your synced copy stays in your GitHub gist.')) return;
    var erase = confirm('Also erase your progress and notes from THIS browser?\n\n' +
      'OK: erase (choose this on a shared or public computer).\nCancel: keep them here.');
    var token = getToken();
    setTokenValue('');
    localStorage.removeItem(GISTID_KEY);
    localStorage.removeItem(LOGIN_KEY);
    refreshBtnState();
    return revokeToken(token).then(function () {
      if (!erase) return;
      eraseDevice();
      if (typeof location !== 'undefined' && location.reload) location.reload();
    });
  }

  // Cancel a "Sign in with GitHub" token (gho_… or ghu_…) through api/github-oauth.js, which
  // holds the app secret GitHub requires, and drops this browser's refresh cookie. A pasted personal token is the user's own to manage, so it is
  // left alone. Never rejects: signing out must not depend on the network.
  function revokeToken(token) {
    if (!/^gh[ou]_/.test(token || '') || typeof fetch !== 'function') return Promise.resolve(false);
    return fetch('/api/github-oauth?action=revoke', { method: 'POST', keepalive: true, headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return !!r && (r.status === 204 || r.ok); }, function () { return false; });
  }

  // Every app of the hub keeps its data in this one origin's localStorage, so erasing "this
  // device" means all of it: progress, notes, snapshots and sync state of every app.
  function eraseDevice() {
    try { localStorage.clear(); } catch (e) {}
  }

  // "Delete my data" (privacy.html): deletes this account's tracker gists, cancels the token
  // and erases this browser. Resolves to a short report for the page to show.
  function deleteMyData() {
    var token = getToken();
    var typed = prompt('This deletes your synced progress from GitHub (the "' + GIST_DESC + '" gist) and erases it from this browser.\n' +
      'Other devices keep their own copy until you erase them too.\n\nType DELETE to confirm.', '');
    if (typed === null || typed.trim().toUpperCase() !== 'DELETE') return Promise.resolve('Nothing was deleted.');
    var gone = token ? listTrackerGists().then(function (list) {
      token = getToken();   // listing may have renewed an expiring token
      return Promise.all(list.map(function (g) {
        return fetch(API + '/gists/' + g.id, { method: 'DELETE', headers: headers() }).then(function (r) {
          if (!(r.status === 204 || r.status === 404)) throw new Error('GitHub API ' + r.status);
        });
      })).then(function () { return list.length; });
    }) : Promise.resolve(0);
    return gone.then(function (n) {
      return revokeToken(token).then(function () {
        eraseDevice();
        if (!token) return 'Done. This browser is erased. You were not signed in, so nothing on GitHub was touched: sign in first to delete your synced copy too.';
        return 'Done. Deleted ' + n + ' synced gist' + (n === 1 ? '' : 's') + ', signed out and erased this browser.';
      });
    }, function (e) {
      return 'Could not delete your gist (' + e.message + '). Nothing was erased; try again, or delete it at gist.github.com.';
    });
  }

  // ── Sign in with GitHub ────────────────────────────────────────────────
  // api/github-oauth.js runs GitHub's OAuth flow and sends the browser back to this page
  // with the token in the URL fragment (#tracker-signin=…), or #tracker-signin-error=… if
  // the user cancelled. Read it before the app starts and wipe it from the address bar at
  // once, so the token never sits in history or gets bookmarked or shared.
  var signIn = { done: false, error: '' };
  function takeSignInFromUrl() {
    var h = (typeof location !== 'undefined' && location.hash) || '';
    var m = /^#tracker-signin(-error)?=([^&]*)(?:&expires_in=(\d+))?$/.exec(h);
    if (!m) return;
    var value = '';
    try { value = decodeURIComponent(m[2]); } catch (e) {}
    if (typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (m[1]) { signIn.error = value || 'unknown'; return; }
    if (!value) return;
    setTokenValue(value, m[3]);
    localStorage.removeItem(GISTID_KEY);   // re-resolve the gist for this account
    localStorage.removeItem(LOGIN_KEY);
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
      rememberLogin(u.login);
      if (typeof alert === 'function') alert('Signed in with GitHub as @' + u.login + '. Syncing now.\n\nEvery device you sync on must show this same username.');
    }, function () {}).then(syncNow);
  }

  // ── token entry (the manual alternative to Sign in with GitHub) ─────────
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
    localStorage.removeItem(LOGIN_KEY);
    refreshBtnState();
    // Surface WHICH GitHub account this token belongs to. The #1 cause of "I added
    // a token, synced, but my old data never shows up" is a token for a different
    // account than the device that already holds the data — /gists is scoped to the
    // token's own account, so a mismatch is invisible otherwise. Compare this name
    // across devices to confirm they're pointed at the same account.
    if (t && typeof alert === 'function') {
      api('/user').then(function (u) {
        rememberLogin(u.login);
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
    var login = null;
    currentLogin().then(function (l) { login = l; return withGist(function () { return pullApp(cfg.appId); }); }).then(function (remote) {
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
      // Local data is now this account's, whoever's it was before (see guardAccount).
      if (login) { var m = getMeta(cfg.appId); m.lastLogin = login; setMeta(cfg.appId, m); }
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
  // onReturn: also check when the person comes back to the tab, so a page left open (an
  // installed PWA) picks up another device's edits without a Sync or Pull button.
  var returnHooked = false;
  function autoSync(opts) {
    if (opts && opts.onReturn && !returnHooked && typeof document !== 'undefined' && document.addEventListener) {
      returnHooked = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') autoSync({ everyOpen: true });
      });
    }
    if (!getToken()) return;
    var meta = getMeta(cfg.appId);
    var last = meta.lastCheckAt ? Date.parse(meta.lastCheckAt) : 0;
    var due = (opts && opts.everyOpen) || Date.now() - last >= DAY_MS || hasUnsyncedEdits(cfg.appId, cfg.keys);
    if (!due) return;
    if (isOffline()) { setHealth('offline'); return; }
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
  function isOffline() { return typeof navigator !== 'undefined' && navigator && navigator.onLine === false; }
  function pushSoon(ms) {
    if (!getToken()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, ms || 4000);
  }
  function pushNow() {
    pushTimer = null;
    // The browser knows it has no connection: don't spend a request; 'online' retries.
    if (isOffline()) { setHealth('offline'); return; }
    status('saving…');
    reconcile(cfg.appId, cfg.keys).then(function (r) {
      if (r.action !== 'pull' && r.action !== 'merge') { status('synced ✓'); setTimeout(resetStatus, 1500); }
    }).catch(function (e) { console.warn('[sync] background push failed', e); status('offline'); setTimeout(resetStatus, 2500); });
  }
  // The tab is being hidden or closed: send a waiting upload now instead of after the debounce.
  // Otherwise an edit made in the last few seconds stays on this device until it is opened
  // again, and the other devices don't see it meanwhile.
  function flushPending() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushNow();
  }
  var lifecycleHooked = false;
  function hookLifecycle() {
    if (lifecycleHooked) return;
    lifecycleHooked = true;
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushPending();
      });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', flushPending);
      // Back online: send what piled up offline and pick up other devices' edits.
      window.addEventListener('online', function () { autoSync({ everyOpen: true }); });
    }
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
    hookLifecycle();
    injectStyles();
    refreshBtnState();
    finishSignIn();
  }

  window.DataSync = {
    init: init,
    syncNow: syncNow,
    setToken: setToken,
    signIn: startSignIn,
    account: account,
    deleteMyData: deleteMyData,
    autoSync: autoSync,
    pushSoon: pushSoon,
    pullLatest: pullLatest,
    // Save the synced keys as the newest "-presync" snapshot. For other ways of replacing
    // local data (a backup import), so they keep the same undo copy a sync pull keeps.
    snapshot: function () { if (cfg.appId) snapshotLocal(cfg.appId, cfg.keys); },
    isConfigured: function () { return !!getToken(); },
    health: function () { return { state: health.state, text: healthText() }; }
  };
})();
