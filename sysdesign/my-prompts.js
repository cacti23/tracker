/* 🔒 My prompts: a private box at the top of the System Design notes, for the owner only.
   The prompt text is NOT in this repo (the repo and site are public). It lives in a file of the
   owner's own private sync gist ('tracker-sync-v1'), read with the token Sign in with GitHub
   stored. Anyone else, or the owner signed out, sees nothing and the text never reaches them.
   Showing the box only to OWNER is the UI rule; the privacy comes from the private gist. */
(function (root) {
  'use strict';

  var OWNER = 'cacti23';                 // Adi's GitHub login (the account he signs in with)
  var FILE = 'sd-prompts.md';            // .md, so sync.js's gist chooser (it sizes .json files) ignores it
  var API = 'https://api.github.com';

  function creds(ls) {
    try {
      return { token: ls.getItem('tracker-sync-token'), gist: ls.getItem('tracker-sync-gistid'), login: ls.getItem('tracker-sync-login') };
    } catch (e) { return {}; }
  }

  // Box states: 'hidden' (not the owner) | 'loading' | 'show' (text) | 'empty' (no file yet) | 'edit' | 'error'
  function mount(box, deps) {
    var doc = deps.document, ls = deps.localStorage, fetchFn = deps.fetch;
    var c = creds(ls);
    if (!box || !c.token || c.login !== OWNER) { if (box) box.hidden = true; return Promise.resolve('hidden'); }
    var headers = { Authorization: 'token ' + c.token, Accept: 'application/vnd.github+json' };
    var text = '';

    function el(tag, props, kids) {
      var e = doc.createElement(tag);
      Object.keys(props || {}).forEach(function (k) { e[k] = props[k]; });
      (kids || []).forEach(function (k) { e.appendChild(k); });
      return e;
    }
    function render(state, msg) {
      box.hidden = false;
      box.textContent = '';
      var sum = el('summary', { textContent: '🔒 My prompts (only you see this)' });
      box.appendChild(sum);
      if (state === 'loading') box.appendChild(el('p', { textContent: 'Loading from your private gist…' }));
      if (state === 'error') box.appendChild(el('p', { textContent: '⚠️ ' + msg }));
      if (state === 'show') {
        var pre = el('pre', { textContent: text });
        var copy = el('button', { type: 'button', textContent: '📋 Copy' });
        copy.onclick = function () {
          var done = function (t) { copy.textContent = t; setTimeout(function () { copy.textContent = '📋 Copy'; }, 2000); };
          try { deps.navigator.clipboard.writeText(text).then(function () { done('✅ Copied'); }, function () { done('Copy blocked'); }); }
          catch (e) { done('Copy blocked'); }
        };
        var edit = el('button', { type: 'button', textContent: '✏️ Edit' });
        edit.onclick = function () { render('edit'); };
        box.appendChild(el('p', { className: 'mp-btns' }, [copy, edit]));
        box.appendChild(pre);
      }
      if (state === 'empty' || state === 'edit') {
        if (state === 'empty') box.appendChild(el('p', { textContent: 'Nothing saved yet. Paste your prompt and save it to your private gist.' }));
        var ta = el('textarea', { value: text, rows: 12, className: 'mp-edit' });
        ta.setAttribute('aria-label', 'Prompt text');
        var save = el('button', { type: 'button', textContent: '💾 Save to my private gist' });
        save.onclick = function () { saveText(ta.value); };
        box.appendChild(ta);
        box.appendChild(el('p', { className: 'mp-btns' }, [save]));
      }
      return state;
    }
    function saveText(v) {
      var files = {}; files[FILE] = { content: v || ' ' };   // an empty content would delete the file
      render('loading');
      return fetchFn(API + '/gists/' + c.gist, { method: 'PATCH', headers: headers, body: JSON.stringify({ files: files }) })
        .then(function (r) { if (!r.ok) throw new Error('save failed (' + r.status + ')'); text = v; return render('show'); })
        .catch(function (e) { return render('error', e.message + '. Your text was not saved.'); });
    }

    if (!c.gist) return Promise.resolve(render('error', 'Sync has not linked your gist yet. Open the hub once while signed in, then reload.'));
    render('loading');
    return fetchFn(API + '/gists/' + c.gist, { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error('could not read your gist (' + r.status + ')'); return r.json(); })
      .then(function (g) {
        var f = g && g.files && g.files[FILE];
        if (!f) return render('empty');
        if (!f.truncated) { text = f.content || ''; return render('show'); }
        return fetchFn(f.raw_url, { headers: headers }).then(function (r) { return r.text(); }).then(function (t) { text = t; return render('show'); });
      })
      .catch(function (e) { return render('error', e.message); });
  }

  var api = { mount: mount, OWNER: OWNER, FILE: FILE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root.document) mount(root.document.getElementById('my-prompts'), { document: root.document, localStorage: root.localStorage, fetch: root.fetch.bind(root), navigator: root.navigator });
})(this);
