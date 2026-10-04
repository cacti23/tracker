/* ──────────────────────────────────────────────────────────────────────────
   Floating "← Tracker" pill for every standalone page (dsa/, apps/, google/, papers/).
   Load with:  <script src="../js/back-button.js"></script>  (before </body>)

   - The href to index.html is derived from THIS script's own URL, so it works
     from any folder depth without per-page paths.
   - It always NAVIGATES to the tracker (never history.back()): on a long page you click in-page
     anchors and links, so "back" would just undo those instead of leaving. The tracker reopens
     on the view you were last in (see _restoreView in index.html).
   - Not shown inside an iframe (the Google tabs embed these pages in-pane),
     and hidden when printing (cheatsheets are print-optimised).
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.top !== window.self) return;
  if (document.getElementById('tracker-back-btn')) return;

  var src = document.currentScript && document.currentScript.src;
  var home;
  try { home = new URL('../index.html', src || location.href); }
  catch (e) { return; }

  var style = document.createElement('style');
  style.textContent =
    '#tracker-back-btn{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;' +
    'display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;' +
    'background:rgba(20,22,32,.88);color:#fff;border:1px solid rgba(255,255,255,.22);' +
    'font:600 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-decoration:none;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent;cursor:pointer}' +
    '#tracker-back-btn:hover{background:rgba(40,44,64,.95)}' +
    '@media print{#tracker-back-btn{display:none!important}}';
  document.head.appendChild(style);

  var a = document.createElement('a');
  a.id = 'tracker-back-btn';
  a.href = home.href;
  a.setAttribute('aria-label', 'Back to tracker');
  a.textContent = '← Tracker';
  document.body.appendChild(a);
})();
