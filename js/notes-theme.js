/* Dark mode for the DSA Thoughts and JS Built-ins notes.
   Load in <head> (not deferred) so the theme is set before first paint, no white flash.
   Uses the tracker's own 'dsa-theme' key, so the notes match the app; default dark like the app.
   The 🌙/☀️ button flips it here and the choice carries back to the tracker. */
(function () {
  var root = document.documentElement
  var t = 'dark'
  try { t = localStorage.getItem('dsa-theme') || 'dark' } catch (e) {}
  root.dataset.theme = t === 'light' ? 'light' : 'dark'

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
