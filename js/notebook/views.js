// 📓 Notebook (index.html) · Dashboard, Google, in-pane pages, the DSA | System Design switch, SD lesson map, study sites, Recently solved.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── CURRENT-VIEW PERSISTENCE ─────────────────────────────────────────────────
// Remember whether you're on the dashboard or a specific topic, so a page reload
// returns you to where you were instead of always dumping you on the dashboard.
// Per-device UI state (intentionally NOT synced via BACKUP_KEYS).
const CURRENT_VIEW_KEY = 'dsa-current-view-v1'
// Each notebook tab (dsa | sd | exp) also keeps its own last view, so DSA → System Design → DSA
// lands back on the topic you left, not the dashboard (Adi, 2026-11-28). Local only, like the above.
const HUB_LAST_VIEW_KEY = 'dsa-hub-last-view-v1'
function _saveCurrentView(v) {
  try {
    localStorage.setItem(CURRENT_VIEW_KEY, v)
    const last = JSON.parse(localStorage.getItem(HUB_LAST_VIEW_KEY) || '{}')
    last[document.body.dataset.hubMode] = v
    localStorage.setItem(HUB_LAST_VIEW_KEY, JSON.stringify(last))
  } catch {}
}
function _openView(saved, fallback = loadDashboard) {
  if (saved === 'google') loadGoogle()
  else if (saved === 'recent') loadRecent()
  else if (saved && Object.prototype.hasOwnProperty.call(EMBEDS, saved)) loadEmbed(saved)
  else if (saved && saved !== 'dashboard' && TOPICS.some(t => t.key === saved)) loadTopic(saved)
  else fallback()
}
function _restoreView() {
  let saved = null
  try { saved = localStorage.getItem(CURRENT_VIEW_KEY) } catch {}
  _openView(saved)
}

// ─── GOOGLE (in-pane, same layout as a topic: header title + tab pills + content) ───
// One page now: the sources live in an accordion at the top of the log. The tab row only shows with 2+ tabs.
const GOOGLE_TABS = [
  { key: 'log', label: '📓 Onsite Log', src: 'google/google-onsite-log.html' }
]
let currentGoogleTab = 'log'
function loadGoogle(tab) {
  if (tab) currentGoogleTab = tab
  setHubMode('exp')
  showView('view-google')
  psTimer.stop()
  qpTimer.stop()
  document.getElementById('page-title').textContent = '🔍 Google'
  document.getElementById('header-tabs').innerHTML = ''
  clearActiveNav()
  const nav = document.getElementById('nav-google')
  if (nav) nav.classList.add('active')
  currentTopicKey = null
  _saveCurrentView('google')
  document.getElementById('google-tabs').innerHTML = GOOGLE_TABS.length < 2 ? '' : GOOGLE_TABS.map(t =>
    `<li class="nav-item"><button class="nav-link${t.key === currentGoogleTab ? ' active' : ''}" type="button"
      data-click="loadGoogle" data-args="${Actions.attrArgs([t.key])}">${t.label}</button></li>`
  ).join('')
  const frame = document.getElementById('google-frame')
  _watchEmbedScroll(frame)
  const want = GOOGLE_TABS.find(t => t.key === currentGoogleTab).src
  if (frame.getAttribute('src') !== want) frame.setAttribute('src', want)
}

// ─── IN-PANE PAGES ───────────────────────────────────────────────────────────
// Sidebar entries that show a standalone page inside the hub (in an iframe), under the hub's
// own header, like Google. Paper Club saves to 'paper-club-v1' and Postmortems to
// 'postmortems-v1'; the rest are read-only notes.
// The key is also the saved view, so a reload returns to the same page.
const EMBEDS = {
  papers:     { view: 'view-papers',  frame: 'papers-frame',  title: '📚 Paper Club',   src: 'papers/paper-club.html' },
  visuals:    { view: 'view-visuals', frame: 'visuals-frame', title: '🖼️ DSA Visuals',  src: 'visuals/visuals.html' },
  thoughts:   { view: 'view-page',    frame: 'page-frame',    title: '🧠 DSA Thoughts', src: 'dsa/dsa-thoughts.html' },
  jsbuiltins: { view: 'view-page',    frame: 'page-frame',    title: '📋 JS Built-ins', src: 'dsa/js-builtins.html' },
  sites:      { view: 'view-page',    frame: 'page-frame',    title: '🔖 Study Sites',  src: 'dsa/study-sites.html' },
  privacy:    { view: 'view-page',    frame: 'page-frame',    title: '🔒 Privacy & data', src: 'dsa/privacy.html' },
  postmortems: { view: 'view-page',  frame: 'page-frame',    title: '🔥 Postmortems', src: 'papers/postmortems.html' },
  howto:      { view: 'view-page',    frame: 'page-frame',    title: '📖 How to use the DSA tracker', src: 'dsa/how-to-use.html' },
  sysdesign:  { view: 'view-sysdesign', frame: 'sysdesign-frame', title: '🏛️ System Design', src: 'sysdesign/system-design.html', hub: 'sd' },
}
for (const k of ['visuals', 'thoughts', 'jsbuiltins', 'howto']) EMBEDS[k].hub = 'dsa'
for (const k of ['papers', 'postmortems']) EMBEDS[k].hub = 'sd'   // sites and privacy are shared

// ─── NOTEBOOK SWITCH (DSA | System Design) ────────────────────────────────────
// One named mode, kept per device (not synced). Opening a page that belongs to one notebook
// switches to it, so a search hit or link never leaves the other notebook's sidebar showing.
const HUB_MODE_KEY = 'dsa-hub-mode'
const HUB_MODES = ['dsa', 'sd', 'exp']
function setHubMode(m) {
  if (!HUB_MODES.includes(m)) m = 'dsa'
  document.body.dataset.hubMode = m
  document.querySelectorAll('.hub-tabs button').forEach(b => {
    if (b.dataset.mode === m) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current')
  })
  // One search box: in System Design it searches the notes and glossary, elsewhere the problems.
  const search = document.getElementById('global-search-input')
  if (search) search.placeholder = m === 'sd' ? '🔍 Search notes and terms…' : '🔍 Search problems…'
  // The System Design sidebar is drawn from the notes page, so load it as soon as the notebook
  // opens (from Paper Club too), not only when the notes themselves are shown.
  if (m === 'sd') {
    const f = document.getElementById(EMBEDS.sysdesign.frame)
    if (f && !f.getAttribute('src')) f.setAttribute('src', EMBEDS.sysdesign.src)
  }
  try { localStorage.setItem(HUB_MODE_KEY, m) } catch {}
}
function switchHub(m) {
  let last = null
  try { last = JSON.parse(localStorage.getItem(HUB_LAST_VIEW_KEY) || '{}')[m] } catch {}
  // Set the mode first: a shared page (Study Sites, Privacy) opens in the tab you clicked.
  setHubMode(m)
  const home = m === 'sd' ? () => loadEmbed('sysdesign') : m === 'exp' ? loadGoogle : loadDashboard
  _openView(last, home)
}

// ─── SYSTEM DESIGN LESSON MAP ─────────────────────────────────────────────────
// The notes page (sysdesign/system-design.html, same origin) exposes SDNAV: its lesson tree, its
// current view and a way to open a card. The hub draws that tree in its own sidebar, so there is
// one map instead of tabs + chips + an index inside the page (Adi, 2026-11-27). Only what the page
// can't know lives here: which group is open, the filter text, and the card last opened.
const _sdTree = { open: null, filter: '', active: null }
function _sdNav() {
  try { return document.getElementById(EMBEDS.sysdesign.frame).contentWindow.SDNAV || null } catch { return null }
}
function renderSdTree() {
  const box = document.getElementById('nav-sd-tree')
  const nav = _sdNav()
  if (!box) return
  if (!nav) { box.innerHTML = ''; return }
  const by = nav.view() === 'courses' ? 'courses' : 'topics'
  const tree = nav.tree()
  const groups = by === 'courses' ? tree.lessons : tree.topics
  if (_sdTree.active && !groups.some(g => g.key === _sdTree.open)) {
    const g = groups.find(g => g.cards.some(c => c.id === _sdTree.active))
    if (g) _sdTree.open = g.key
  }
  let html = '<div class="sd-by" role="group" aria-label="Order the lessons">' +
    [['topics', 'By topic'], ['courses', 'By course']].map(([k, label]) =>
      '<button type="button" aria-pressed="' + (k === by) + '" data-click="sdTreeBy" data-args="' + Actions.attrArgs([k]) + '">' + label + '</button>').join('') +
    '</div>' +
    '<input type="search" class="form-control form-control-sm sd-filter" placeholder="Filter lessons" aria-label="Filter lessons" autocomplete="off" value="' + escHtml(_sdTree.filter) + '" data-input="sdTreeFilter" data-args=\'["$value"]\'>'
  for (const g of groups) {
    const open = g.key === _sdTree.open
    html += '<div class="sd-g" data-key="' + escHtml(g.key) + '">' +
      '<button type="button" class="nav-link sd-group" aria-expanded="' + open + '" data-click="sdTreeToggle" data-args="' + Actions.attrArgs([g.key]) + '">' +
        '<span><span class="sd-caret" aria-hidden="true">▸</span> ' + escHtml(g.title) + '</span><span class="sd-count">' + g.cards.length + '</span></button>' +
      g.cards.map(c => '<button type="button" class="nav-link sd-card' + (c.id === _sdTree.active ? ' active' : '') + '"' + (open ? '' : ' hidden') +
        ' data-click="sdOpenCard" data-args="' + Actions.attrArgs([by, g.key, c.id]) + '">' + escHtml(c.title) + '</button>').join('') +
    '</div>'
  }
  html += '<button type="button" class="nav-link" id="nav-sd-map" data-click="sdOpenCard" data-args="' + Actions.attrArgs(['map']) + '">' +
    '<span class="nav-topic-icon" aria-hidden="true">🗺️</span><span class="nav-topic-label">AWS map</span></button>'
  box.innerHTML = html
  _applySdFilter()
}
// Filtering hides rows instead of redrawing, so the box keeps focus while you type.
function _applySdFilter() {
  const f = _sdTree.filter.trim().toLowerCase()
  document.querySelectorAll('#nav-sd-tree .sd-g').forEach(g => {
    const open = f ? false : g.dataset.key === _sdTree.open
    let hits = 0
    g.querySelectorAll('.sd-card').forEach(c => {
      const hit = !f || c.textContent.toLowerCase().includes(f) || g.querySelector('.sd-group').textContent.toLowerCase().includes(f)
      if (hit && f) hits++
      c.hidden = f ? !hit : !open
    })
    g.hidden = !!f && !hits
    g.querySelector('.sd-group').setAttribute('aria-expanded', String(f ? hits > 0 : open))
  })
}
function sdTreeFilter(value) { _sdTree.filter = String(value || ''); _applySdFilter() }
function sdTreeToggle(key) {
  _sdTree.open = _sdTree.open === key ? null : key
  _sdTree.filter = ''
  renderSdTree()
}
function sdTreeBy(view) {
  const nav = _sdNav()
  if (!nav) return
  loadEmbed('sysdesign')
  nav.go(view === 'courses' ? 'courses' : 'topics')
  _sdTree.open = null
  renderSdTree()
}
function sdOpenCard(view, groupKey, cardId) {
  const nav = _sdNav()
  if (!nav) return
  loadEmbed('sysdesign')
  clearActiveNav()
  document.getElementById('nav-sysdesign')?.classList.remove('active')
  if (view === 'map') {
    nav.go('map')
    _sdTree.active = null
    renderSdTree()
    document.getElementById('nav-sd-map')?.classList.add('active')
    return
  }
  nav.go(view, view === 'topics' ? groupKey : null, cardId)
  // Jumping to a card scrolls the notes down, which would tuck the top bar (and its tabs) away.
  setTimeout(() => document.body.classList.remove('header-tucked'), 150)
  _sdTree.active = cardId
  _sdTree.open = groupKey
  renderSdTree()
}
// "All notes": every topic (or the whole course), from the top
function sdAllNotes() {
  loadEmbed('sysdesign')
  const nav = _sdNav()
  if (nav) nav.go(nav.view() === 'courses' ? 'courses' : 'topics', 'All')
  _sdTree.active = null
  renderSdTree()
}
document.getElementById(EMBEDS.sysdesign.frame)?.addEventListener('load', renderSdTree)

const PAPERS_SRC = EMBEDS.papers.src
const VISUALS_SRC = EMBEDS.visuals.src
function loadEmbed(key) {
  const e = EMBEDS[key]
  if (!e) return loadDashboard()
  if (e.hub) setHubMode(e.hub)
  showView(e.view)
  psTimer.stop()
  qpTimer.stop()
  document.getElementById('page-title').textContent = e.title
  document.getElementById('header-tabs').innerHTML = ''
  clearActiveNav()
  const nav = document.getElementById('nav-' + key)
  if (nav) nav.classList.add('active')
  currentTopicKey = null
  _saveCurrentView(key)
  const frame = document.getElementById(e.frame)
  _watchEmbedScroll(frame)
  // Study Sites sits in both notebooks and lists only that notebook's sites (Adi, 2026-11-26).
  // The hub goes in the hash, not a query, so the offline cache still finds the page.
  const src = key === 'sites' ? e.src + '#' + document.body.dataset.hubMode : e.src
  if (frame.getAttribute('src') !== src) frame.setAttribute('src', src)
}

// ─── STUDY SITE IN-PANE ──────────────────────────────────────────────────────
// Study Sites (dsa/study-sites.html, embedded) calls this for a tile. The site shows in the pane,
// the sidebar steps aside (☰ brings it back; not saved as a preference), and the header names the
// site with a link to open it in its own tab, for sites that refuse to be shown inside a page.
function openSite(site) {
  const url = site && String(site.url || '')
  if (!/^https?:\/\//i.test(url)) return
  showView('view-site')
  psTimer.stop()
  qpTimer.stop()
  document.getElementById('page-title').textContent = (site.icon ? site.icon + ' ' : '') + String(site.name || 'Study site')
  document.getElementById('header-tabs').innerHTML =
    '<span class="site-open"><button type="button" data-click="loadEmbed" data-args="' + Actions.attrArgs(['sites']) + '">← Study Sites</button>' +
    '<a href="' + escHtml(url) + '" target="_blank" rel="noopener">↗ Open ' + escHtml(site.name || 'site') + ' in a new tab</a></span>'
  clearActiveNav()
  const nav = document.getElementById('nav-sites')
  if (nav) nav.classList.add('active')
  if (!_isPhoneLayout()) document.getElementById('sidebar').classList.add('collapsed')
  const frame = document.getElementById('site-frame')
  if (frame.getAttribute('src') !== url) frame.setAttribute('src', url)
}

// Same-origin embedded pages: tuck the top bar away while scrolling down, bring it back on the
// way up. Re-attached on every load (a new page means a new window). Other sites can't be watched.
function _watchEmbedScroll(frame) {
  if (!frame || frame.dataset.scrollWatch) return
  frame.dataset.scrollWatch = '1'
  frame.addEventListener('load', () => {
    let win
    try { win = frame.contentWindow; void win.scrollY } catch { return }
    let last = 0
    win.addEventListener('scroll', () => {
      const y = win.scrollY
      if (Math.abs(y - last) < 8) return
      document.body.classList.toggle('header-tucked', y > last && y > 60)
      last = y
    }, { passive: true })
  })
}
function loadPapers() { loadEmbed('papers') }
function loadVisuals() { loadEmbed('visuals') }

// ─── RECENTLY SOLVED ──────────────────────────────────────────────────────────
// Every question you graded ✓ ~ ✗ (on a card, in Graded, By Pattern or the dashboard sessions),
// newest first, grouped by day, so you can see the order you worked through them (Adi, 2026-11-26).
// Read straight from the revise records (dsa-revise-v1): each keeps its latest grade and when, so
// there is nothing new to store or sync, and grades from before this view existed show up too.
function _recentlySolved() {
  const where = {}
  for (const t of TOPICS) {
    const mod = TOPIC_MODULES[t.key]
    if (mod) for (const [k, q] of Object.entries(mod.questions)) if (!where[k]) where[k] = { t, q }
  }
  return Object.entries(_reviseAll())
    .filter(([k, r]) => where[k] && r && r.last && !isNaN(new Date(r.last)))
    .map(([k, r]) => ({ lcKey: k, grade: r.grade, ts: r.last, topic: where[k].t, q: where[k].q }))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
}
function _recentDayLabel(dayKey) {
  const today = LocalDate.key()
  if (dayKey === today) return 'Today'
  if (dayKey === LocalDate.key(LocalDate.addDays(new Date(), -1))) return 'Yesterday'
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function loadRecent() {
  setHubMode('dsa')
  showView('view-recent')
  psTimer.stop()
  qpTimer.stop()
  document.getElementById('page-title').textContent = '🕘 Recently solved'
  document.getElementById('header-tabs').innerHTML = ''
  clearActiveNav()
  const nav = document.getElementById('nav-recent')
  if (nav) nav.classList.add('active')
  currentTopicKey = null
  _saveCurrentView('recent')
  const items = _recentlySolved()
  const view = document.getElementById('view-recent')
  if (!items.length) {
    view.innerHTML = '<div class="recent-empty">Nothing graded yet. Grade a question with ✓ ~ ✗ and it shows up here, newest first.</div>'
    return
  }
  const counts = { solid: 0, shaky: 0, forgot: 0 }
  items.forEach(e => { if (counts[e.grade] != null) counts[e.grade]++ })
  let html = '<p class="recent-sum">' + items.length + ' graded · <span class="rg-solid">✓ ' + counts.solid + '</span> <span class="rg-shaky">~ ' + counts.shaky + '</span> <span class="rg-forgot">✗ ' + counts.forgot + '</span></p>'
  let day = null, n = 0
  for (const e of items) {
    const d = LocalDate.key(new Date(e.ts))
    if (d !== day) { if (day) html += '</div>'; day = d; html += '<h3 class="recent-day">' + escHtml(_recentDayLabel(d)) + '</h3><div class="recent-list">' }
    const badge = RECENT_GRADE_BADGE[e.grade] || ['rg-none', '']
    const time = new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    html += '<div class="ps-q-row recent-row" data-click="goToQuestion" data-args="' + Actions.attrArgs([e.topic.key, e.lcKey]) + '" title="Open in ' + escHtml(e.topic.label) + '">' +
      '<span class="ps-q-num">' + (++n) + '</span>' +
      '<span class="revise-grade-badge ' + badge[0] + '">' + badge[1] + '</span>' +
      '<span class="ps-q-title">' + escHtml(e.q.title) + '</span>' +
      '<span class="recent-topic">' + escHtml(e.topic.icon + ' ' + e.topic.label) + '</span>' +
      '<span class="badge bg-' + DIFFICULTY_BADGE[e.q.difficulty] + ' q-badge flex-shrink-0">' + escHtml(e.q.difficulty) + '</span>' +
      '<span class="rev-ago">' + escHtml(time) + '</span>' +
      _lcLink(e.q) +
      '</div>'
  }
  view.innerHTML = html + '</div>'
}

function loadDashboard() {
  setHubMode('dsa')
  showView('view-dashboard')
  psTimer.stop()       // stop per-topic timer if navigating here from a topic page
  document.getElementById('page-title').textContent = '🏠 Dashboard'
  document.getElementById('header-tabs').innerHTML = ''
  clearActiveNav()
  const dash = document.getElementById('nav-dashboard')
  if (dash) dash.classList.add('active')
  currentTopicKey = null
  _saveCurrentView('dashboard')

  // One-pass: compute global totals + per-topic stats simultaneously
  let totalQ = 0, totalSolved = 0, totalInProg = 0, totalPending = 0
  const topicStats = TOPICS.map(t => {
    const mod = TOPIC_MODULES[t.key]
    if (!mod) return { key: t.key, icon: t.icon, label: t.label, mod: null }
    const qKeys  = Object.keys(mod.questions)
    const solved  = qKeys.filter(k => getStatus(k) === 'Solved').length
    const inProg  = qKeys.filter(k => _countedStatus(k) === 'In Progress').length
    const pending = qKeys.filter(k => _countedStatus(k) === 'Pending').length
    return {
      key: t.key, icon: t.icon, label: t.label, mod,
      total: qKeys.length, solved, inProg, pending,
      pct:       qKeys.length ? Math.round(solved / qKeys.length * 100) : 0,
      inProgPct: qKeys.length ? Math.round(inProg / qKeys.length * 100) : 0
    }
  })

  // Global totals count each question ONCE (cross-listed questions appear in several topic cards above).
  const _uniq = _uniqueQuestionKeys()
  _uniq.forEach(k => {
    totalQ++
    const st = _countedStatus(k)
    if (st === 'Solved') totalSolved++
    else if (st === 'In Progress') totalInProg++
    else totalPending++
  })
  const solvedPct  = totalQ ? Math.round(totalSolved / totalQ * 100) : 0
  const inProgPct  = totalQ ? Math.round(totalInProg / totalQ * 100) : 0

  // Count both spaced-repetition queues across all topics:
  //   reviseDue = problems due for an active-recall pass · codeDue = problems due for a cold solve
  let codeDue = 0
  const dueList = []
  _uniq.forEach(k => { if (isCodeDue(k)) codeDue++; if (isReviseDue(k)) dueList.push(k) })
  const reviseDue = dueList.length
  // A brand-new user has touched nothing yet. Derived from the data, so there is no flag to store.
  const isNewUser = ![..._uniq].some(k => _isEngaged(k))

  document.getElementById('dash-welcome').innerHTML = isNewUser ? _dashWelcomeHtml(_uniq.size, topicStats.filter(s => s.mod).length) : ''

  // ── Today: what to revise (the highlighted number), the counts, the question of the day ──
  const streak = getStreak()
  const streakText = streak.streak > 0
    ? '🔥 <strong>' + streak.streak + '</strong> day streak' + (streak.longest > streak.streak ? ' (best ' + streak.longest + ')' : '')
    : '🔥 <strong>0</strong> day streak' + (streak.longest ? ' (best ' + streak.longest + ')' : '')
  const _qTitle = k => { for (const t of TOPICS) { const m = TOPIC_MODULES[t.key]; if (m && m.questions[k]) return [t.key, m.questions[k].title] } return null }
  // Weakest first (forgot, then shaky, then the rest), oldest recall first within a tier.
  const _lastRecall = k => { const r = getRevise(k); return r && r.last ? new Date(r.last).getTime() : 0 }
  dueList.sort((x, y) => _weaknessRank(x) - _weaknessRank(y) || _lastRecall(x) - _lastRecall(y))
  const DUE_SHOWN = 5
  const dueItems = dueList.slice(0, DUE_SHOWN).map(k => {
    const t = _qTitle(k); if (!t) return ''
    const r = getRevise(k)
    const tag = isCodeForced(k) ? ' <span class="rev-weak-tag rev-weak-forgot">✗ forgot</span>' : r && r.grade === 'shaky' ? ' <span class="rev-weak-tag rev-weak-shaky">~ shaky</span>' : ''
    return '<li><button type="button" class="dash-due-item" data-click="goToQuestion" data-args="' + Actions.attrArgs([t[0], k]) + '">' + escHtml(t[1]) + '</button>' + tag + '</li>'
  }).join('')
  const dueMore = reviseDue > DUE_SHOWN ? '<p class="dash-due-more">and ' + (reviseDue - DUE_SHOWN) + ' more in the revision list below.</p>' : ''
  const dueBody = reviseDue
    ? '<p class="dash-due-sub">Recall the approach from the problem statement, then grade it ✓ solid, ~ shaky or ✗ forgot. The grade decides when it comes back.</p>' +
      '<ul class="dash-due-list">' + dueItems + '</ul>' + dueMore +
      '<div class="dash-actions"><button type="button" class="dash-btn dash-btn-primary" data-click="_dashOpenRevision">Open revision list</button></div>'
    : '<p class="dash-due-sub">' + (isNewUser
        ? 'Nothing to revise yet. Solve a question and grade it; it comes back here on the day it is due.'
        : 'You are up to date. Solve something new, or open a topic and keep going.') + '</p>'
  document.getElementById('overall-tracker').innerHTML =
    '<section class="dash-sheet dash-today" aria-label="Today">' +
      '<div>' +
        '<h2>Today</h2>' +
        '<div class="dash-due"><span class="dash-due-num' + (reviseDue ? '' : ' is-zero') + '" id="due-revise-count">' + reviseDue + '</span>' +
        '<span class="dash-due-label">' + (reviseDue === 1 ? 'question to revise' : 'questions to revise') + '</span></div>' +
        dueBody +
        '<div class="dash-facts">' +
          '<span class="text-success">✅ <strong>' + totalSolved + '</strong> Solved</span>' +
          '<span class="text-warning">🚧 <strong>' + totalInProg + '</strong> In Progress</span>' +
          '<span>📋 <strong>' + totalPending + '</strong> Pending</span>' +
          '<span title="Cold-solve queue: questions due to (re)code from scratch">⌨️ <strong id="due-code-count">' + codeDue + '</strong> to code</span>' +
          '<span>' + streakText + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="dash-daily" id="daily-question-panel"></div>' +
    '</section>'

  const dailyQ = getDailyQuestion()
  document.getElementById('daily-question-panel').innerHTML = dailyQ ? renderDailyQuestionCard(dailyQ) : ''

  // ── Topics: one quiet row each, progress as a thin line ──────────────────────
  document.getElementById('topic-cards').innerHTML =
    '<div class="dash-topics-head"><h2>Topics</h2><span>' + totalSolved + ' of ' + totalQ + ' solved (' + solvedPct + '%)</span></div>' +
    '<div class="dash-topics">' + topicStats.map(s => {
      if (!s.mod) {
        return '<button type="button" class="dash-topic" data-click="loadTopic" data-args="' + Actions.attrArgs([s.key]) + '">' +
          '<span class="dash-topic-icon" aria-hidden="true">' + s.icon + '</span>' +
          '<span class="dash-topic-name">' + escHtml(s.label) + '</span>' +
          '<span class="dash-topic-count">Coming soon</span></button>'
      }
      return '<button type="button" class="dash-topic" data-click="loadTopic" data-args="' + Actions.attrArgs([s.key]) + '">' +
        '<span class="dash-topic-icon" aria-hidden="true">' + s.icon + '</span>' +
        '<span class="dash-topic-name">' + escHtml(s.label) + '</span>' +
        '<span class="dash-topic-count">' + s.solved + ' / ' + s.total + '</span>' +
        '<span class="dash-topic-bar" aria-hidden="true"><i class="s" style="width:' + s.pct + '%"></i><i class="p" style="width:' + s.inProgPct + '%"></i></span>' +
        '<span class="dash-topic-meta">' + s.mod.patterns.length + ' patterns' + (s.inProg ? ', ' + s.inProg + ' in progress' : '') + '</span>' +
        '</button>'
    }).join('') + '</div>'
  _renderQuickPractice()
}

// First-run panel for someone who has not touched a question yet. Shown while that is true,
// so it needs no "dismissed" flag: the first solve or grade retires it.
function _dashWelcomeHtml(nQuestions, nTopics) {
  let signedIn = false
  try { signedIn = !!localStorage.getItem('tracker-sync-token') } catch (e) {}
  const first = TOPICS.find(t => TOPIC_MODULES[t.key])
  return '<section class="dash-sheet dash-welcome mb-4" aria-label="Getting started">' +
    '<h1>Prepare for coding interviews one pattern at a time</h1>' +
    '<p>' + nQuestions + ' hand-picked problems in ' + nTopics + ' topics, each grouped by the pattern that solves it. ' +
    'Your progress stays in this browser' + (signedIn ? ' and syncs to your GitHub account.' : '. Sign in with GitHub to keep it on every device.') + '</p>' +
    '<ol class="dash-steps">' +
      '<li>Open a topic and skim its patterns. ' + escHtml(first ? first.label : 'Two Pointers') + ' is a good first one.</li>' +
      '<li>Solve a problem on LeetCode, then mark it solved on its card.</li>' +
      '<li>Grade how well you remembered it: ✓ solid, ~ shaky or ✗ forgot. It comes back under Today on the day it is due.</li>' +
    '</ol>' +
    '<div class="dash-actions">' +
      (first ? '<button type="button" class="dash-btn dash-btn-primary" data-click="loadTopic" data-args="' + Actions.attrArgs([first.key]) + '">Start with ' + escHtml(first.label) + '</button>' : '') +
      (signedIn ? '' : '<button type="button" class="dash-btn" data-click="DataSync.account">Sign in with GitHub</button>') +
      '<button type="button" class="dash-btn" data-click="loadEmbed" data-args="' + Actions.attrArgs(['howto']) + '">📖 2-minute guide</button>' +
    '</div>' +
  '</section>'
}

// "Open revision list": switch Quick Practice to Graded, build the set, and bring it into view.
function _dashOpenRevision() {
  if (qpTimer.run) { document.getElementById('quick-practice-panel')?.scrollIntoView({ block: 'start' }); return }
  if (!_qpRevised) _qpToggleRevised()
  _qpGenerate()
  document.getElementById('quick-practice-panel')?.scrollIntoView({ block: 'start' })
}
