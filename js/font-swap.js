/* Google Fonts without blocking the first paint, and without an inline load handler (the CSP refuses
   those). A font <link media="print" data-font-swap> downloads in the background because print
   styles never hold up the screen; this switches it to the screen once it has arrived.
   Load it with a plain <script src> right after the link. */
(function () {
  'use strict';
  var links = document.querySelectorAll('link[data-font-swap]');
  Array.prototype.forEach.call(links, function (l) {
    function on() { l.media = 'all'; }
    if (l.sheet) on(); else l.addEventListener('load', on);
  });
})();
