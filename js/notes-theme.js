/* Dark mode for the DSA Thoughts and JS Built-ins notes.
   Load in <head> (not deferred) so the theme is set before first paint, no white flash.
   Uses the tracker's own 'dsa-theme' key, so the notes match the app; default dark like the app.
   The 🌙/☀️ button flips it here and the choice carries back to the tracker. */
(function () {
  var root = document.documentElement
  var t = 'dark'
  try { t = localStorage.getItem('dsa-theme') || 'dark' } catch (e) {}
  root.dataset.theme = t === 'light' ? 'light' : 'dark'

  // The hub's font, loaded without holding up the page. As a CSS @import it blocked the first
  // paint until Google answered: about 1.5 s of blank page on a first visit (Adi, 2026-11-26).
  // The text shows in the fallback font at once and switches when the font arrives.
  var font = document.createElement('link')
  font.rel = 'stylesheet'
  font.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap'
  font.media = 'print'
  font.onload = function () { font.media = 'all' }
  document.head.appendChild(font)

  // Shown inside the hub (an iframe): the hub's own button sets the theme, so follow it live
  // (a 'storage' event reaches every other same-origin document) and add no second button.
  if (window.top !== window.self) {
    window.addEventListener('storage', function (e) {
      if (e.key === 'dsa-theme') root.dataset.theme = e.newValue === 'light' ? 'light' : 'dark'
    })
    return
  }

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('button')
    b.type = 'button'
    b.id = 'notes-theme-btn'
    b.setAttribute('aria-label', 'Toggle light/dark theme')
    var icon = function () { b.textContent = root.dataset.theme === 'dark' ? '☀️' : '🌙' }
    b.onclick = function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem('dsa-theme', root.dataset.theme) } catch (e) {}
      icon()
    }
    icon()
    document.body.appendChild(b)
  })
})()
