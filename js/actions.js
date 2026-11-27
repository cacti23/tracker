/* ──────────────────────────────────────────────────────────────────────────
   Actions — event handling without inline handlers.

   Why: the Content-Security-Policy in vercel.json no longer allows 'unsafe-inline' scripts,
   so the browser ignores every inline handler attribute such as onclick (in the HTML and
   in HTML built by scripts). The sync token sits in localStorage, so this is the main guard against an
   injected script reading it. Instead of code in attributes, an element names an action:

       <button data-click="loadTopic" data-args='["trees"]'>
       <input  data-input="_onNoteSearch" data-args='["$value"]'>
       <input  data-keydown="saveSubmissionFromInput" data-key="Enter" data-args='["LC_1"]'>

   • data-<event>  the action to run: click, input, change, keydown, keyup, mouseup,
                   focusout, toggle, error, load. Only names a page REGISTERED can run
                   (Actions.register), so injected HTML can't call arbitrary globals such as
                   localStorage.clear.
   • data-args     a JSON array. Special strings: "$this" (the element), "$event",
                   "$value" (element.value), "$open" (details.open).
   • data-stop     stop the event here (the old event.stopPropagation()).
   • data-prevent  cancel the browser's default (the old event.preventDefault()).
   • data-key      keydown/keyup only: run just for this key (e.g. Enter).
   Like the old attributes, actions run from the clicked element outwards, and a stop ends it
   (and keeps the event from every other listener, as before).
   One element can carry several events; data-args is shared by all of them.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var registry = Object.create(null);
  registry.stop = function () {};   // data-click="stop" data-stop: only keep the click from going further
  var BUBBLING = ['click', 'input', 'change', 'keydown', 'keyup', 'mouseup', 'focusout'];
  var NOT_BUBBLING = ['toggle', 'error', 'load'];   // caught on the way down instead

  function register(map) {
    Object.keys(map).forEach(function (k) {
      if (typeof map[k] === 'function') registry[k] = map[k];
    });
  }
  function args(el, ev) {
    var raw = el.getAttribute('data-args');
    var list = [];
    if (raw) { try { list = JSON.parse(raw); } catch (e) { list = []; } }
    if (!Array.isArray(list)) list = [list];
    return list.map(function (a) {
      if (a === '$this') return el;
      if (a === '$event') return ev;
      if (a === '$value') return el.value;
      if (a === '$open') return el.open;
      return a;
    });
  }
  function run(el, type, ev) {
    var name = el.getAttribute('data-' + type);
    if (!name) return false;
    var key = el.getAttribute('data-key');
    if (key && (type === 'keydown' || type === 'keyup') && ev.key !== key) return false;
    if (el.hasAttribute('data-prevent')) ev.preventDefault();
    var fn = registry[name];
    if (!fn) { console.warn('[actions] "' + name + '" is not registered'); return el.hasAttribute('data-stop'); }
    fn.apply(el, args(el, ev));
    return el.hasAttribute('data-stop') || ev.cancelBubble;
  }
  // Listening on window in the capture phase runs the actions before any other listener
  // (Bootstrap's, a sidebar's), as the old attributes on the element itself did, so a stop
  // still keeps the click from those. Non-bubbling events (toggle, error, load) only ever
  // concern their own element.
  function handle(ev) {
    var type = ev.type, outward = NOT_BUBBLING.indexOf(type) < 0;
    for (var el = ev.target; el && el.nodeType === 1; el = outward ? el.parentElement : null) {
      if (el.hasAttribute('data-' + type) && run(el, type, ev)) { ev.stopPropagation(); break; }
    }
  }
  if (typeof window.addEventListener === 'function') BUBBLING.concat(NOT_BUBBLING).forEach(function (t) { window.addEventListener(t, handle, true); });

  // For attribute values built in scripts: data-args='…' safe inside an HTML attribute.
  function attrArgs(list) {
    return JSON.stringify(list).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var api = { register: register, attrArgs: attrArgs, _registry: registry };
  window.Actions = api;
  if (typeof globalThis !== 'undefined') globalThis.Actions = api;   // test sandboxes keep window apart
})();
