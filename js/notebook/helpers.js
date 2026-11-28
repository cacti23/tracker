// 📓 Notebook (index.html) · Small shared helpers: switching views, the active nav item, escHtml.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function showView(id) {
  const embed = id === 'view-google' || id === 'view-papers' || id === 'view-visuals' || id === 'view-page' || id === 'view-sysdesign' || id === 'view-site'
  document.body.classList.toggle('embed-view', embed)
  document.body.classList.remove('header-tucked')
  // html has smooth scrolling; a scrolled page would shift the locked frame
  if (embed) { window.scrollTo({ top: 0, behavior: 'instant' }) }
  const views = ['view-dashboard', 'view-recent', 'view-topic', 'view-search-results', 'view-google', 'view-papers', 'view-visuals', 'view-page', 'view-sysdesign', 'view-site']
  views.forEach(v => {
    const el = document.getElementById(v)
    if (v === id) {
      el.classList.remove('d-none', 'anim-fade-in')
      void el.offsetWidth // reflow to restart animation
      el.classList.add('anim-fade-in')
    } else {
      el.classList.add('d-none')
    }
  })
}

function clearActiveNav() {
  document.querySelectorAll('#nav-topics .nav-link').forEach(l => l.classList.remove('active'))
  ;['dashboard', 'recent', 'google', ...Object.keys(EMBEDS)].forEach(k => {
    const el = document.getElementById('nav-' + k)
    if (el) el.classList.remove('active')
  })
}

function setActiveNav(key) {
  clearActiveNav()
  const el = document.getElementById(`nav-${key}`)
  if (el) el.classList.add('active')
}

function escHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
