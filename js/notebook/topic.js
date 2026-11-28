// 📓 Notebook (index.html) · Opening a topic: its tabs, the always-visible tracker and the practice panel shell.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── BUILD TOPIC TABS ─────────────────────────────────────────────────────────
// AI: renders tab nav + pane divs from TOPIC_TABS. Called once per loadTopic().
// To add a tab: update TOPIC_TABS constant — this function needs no changes.
function buildTopicTabs() {
  const nav   = document.getElementById('topic-tabs')
  const panes = document.getElementById('topic-tab-panes')
  if (!nav || !panes) return

  // Hide tab nav when there is only one tab — a single pill adds no value
  nav.style.display = TOPIC_TABS.length <= 1 ? 'none' : ''

  nav.innerHTML = TOPIC_TABS.map((t, i) =>
    `<li class="nav-item">
      <button class="nav-link${i === 0 ? ' active' : ''}" type="button"
        data-tab="${t.key}" data-click="showTopicTab" data-args="${Actions.attrArgs([t.key])}">${t.label}</button>
    </li>`
  ).join('')

  panes.innerHTML = TOPIC_TABS.map((t, i) =>
    `<div id="tab-${t.key}"${i > 0 ? ' class="d-none"' : ''}></div>`
  ).join('')
}

// ─── LOAD TOPIC ───────────────────────────────────────────────────────────────
function loadTopic(key) {
  const topic = TOPICS.find(t => t.key === key)
  if (!topic) return

  _parkNoteDraft()                // keep an unsaved note edit from the prior topic for when you come back
  setHubMode('dsa')
  currentTopicKey = key
  _saveCurrentView(key)
  currentTab = TOPIC_TABS[0].key  // always start on first tab
  _editingNoteId = (_noteDrafts()[key] || {}).id || null
  _noteQuery = ''                 // clear notes search on topic switch
  currentQFilter = 'all'          // reset filter on topic switch
  currentCompanyFilter = null     // reset company filter on topic switch
  currentFreqFilter = 'all'       // reset frequency filter on topic switch
  psTimer.stop()                    // stop any running per-topic practice timer
  qpTimer.stop()                  // stop QP timer if it was running on dashboard

  // Clear in-memory session state — the practice panel build restores this topic's saved session
  _psCurrentItems = []
  _psDoneThisSession.clear()
  _psQCount = 5
  _psRevisePatterns = new Set()
  _psReviseShownThisSession = new Set()
  // _psMode is one variable for every topic; a topic with no saved session of its own opens in the
  // default mode, not in whatever mode the last topic was left in. (A 🗑 Cleared topic has no saved
  // session on purpose and keeps its mode.)
  if (!_psAllSessions()[key] && !_psClearedTopics.has(key)) _psMode = 'graded'

  showView('view-topic')
  document.getElementById('page-title').textContent = topic.icon + ' ' + topic.label
  setActiveNav(key)
  buildTopicTabs()  // renders nav + panes from TOPIC_TABS registry

  const mod = TOPIC_MODULES[key]
  renderTopicTracker(mod)
  renderTopicAlwaysVisible(mod)
  renderCurrentTab()
}

// ─── SHOW TOPIC TAB ───────────────────────────────────────────────────────────
function showTopicTab(tab) {
  currentTab = tab
  document.querySelectorAll('#topic-tabs .nav-link').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tab)
  })
  renderCurrentTab()
}

function renderCurrentTab() {
  // AI: tab visibility is driven by TOPIC_TABS — do not hardcode tab keys here
  TOPIC_TABS.forEach(t => {
    const el = document.getElementById('tab-' + t.key)
    if (el) el.classList.toggle('d-none', t.key !== currentTab)
  })

  // Notes tab is independent of the question module — render it before the guard.
  if (currentTab === 'notes') { renderTopicNotes(); return }

  const mod = TOPIC_MODULES[currentTopicKey]
  if (!mod) {
    const el = document.getElementById('tab-' + currentTab)
    if (el) el.innerHTML = '<div class="text-center py-5 text-secondary"><span class="icon-lg">⏳</span><p class="mt-3 small">Module coming soon.</p></div>'
    return
  }

  if (currentTab === 'questions') renderQuestions(mod)
}

// ─── TOPIC TRACKER (always visible) ─────────────────────────────────────────
function renderTopicTracker(mod) {
  const el = document.getElementById('topic-tracker')
  if (!el) return
  if (!mod) { el.innerHTML = ''; return }

  const qKeys     = Object.keys(mod.questions)
  const solved    = qKeys.filter(k => getStatus(k) === 'Solved').length
  const inProg    = qKeys.filter(k => _countedStatus(k) === 'In Progress').length
  const pending   = qKeys.filter(k => _countedStatus(k) === 'Pending').length
  const pct       = qKeys.length ? Math.round(solved    / qKeys.length * 100) : 0
  const inProgPct = qKeys.length ? Math.round(inProg    / qKeys.length * 100) : 0

  el.innerHTML =
    '<div class="card mb-3">' +
    '<div class="card-body py-2 px-3">' +
    '<div class="d-flex align-items-center justify-content-between mb-1">' +
    '<span class="text-secondary text-sm-custom">' + escHtml(mod.goal) + '</span>' +
    '<span class="small text-secondary ms-3 flex-shrink-0">' + solved + ' / ' + qKeys.length + '</span>' +
    '</div>' +
    '<div class="progress progress-xs mb-1">' +
    '<div class="progress-bar bg-success" style="width:' + pct + '%"></div>' +
    '<div class="progress-bar bg-warning" style="width:' + inProgPct + '%"></div>' +
    '</div>' +
    '<div class="d-flex gap-3 small">' +
    '<span class="text-success">✅ <strong>' + solved + '</strong></span>' +
    '<span class="text-warning">🚧 <strong>' + inProg + '</strong></span>' +
    '<span class="text-secondary">📋 <strong>' + pending + '</strong></span>' +
    '<span class="ms-auto text-secondary text-xxs">' + pct + '% complete</span>' +
    '</div>' +
    '</div></div>'
}

// ─── ALWAYS-VISIBLE: PRACTICE SESSION ────────────────────────────────────────
function renderTopicAlwaysVisible(mod) {
  const el = document.getElementById('topic-always-visible')
  if (!el) return
  if (!mod) { el.innerHTML = ''; return }

  const topic = TOPICS.find(t => t.key === currentTopicKey)
  const cheatsheetBtn = topic?.cheatsheetUrl
    ? '<a href="' + topic.cheatsheetUrl + '" class="btn btn-sm btn-outline-secondary mb-3">' +
      '<span class="me-1">📄</span>Open Cheat Sheet</a>'
    : ''

  el.innerHTML = cheatsheetBtn +
    '<div class="accordion" id="accord-quick-ref">' +
    '<div class="accordion-item">' +
    '<h2 class="accordion-header">' +
    '<button class="accordion-button rounded" type="button" data-bs-toggle="collapse" data-bs-target="#' + QR_IDS.practice + '">' +
    '<span class="me-2">🎲</span>' +
    '<span class="small fw-semibold">Practice Session</span>' +
    '<span class="ms-2 text-secondary text-2xs">&#8212; drill questions now · smart-weighted by solve count</span>' +
    '</button></h2>' +
    '<div id="' + QR_IDS.practice + '" class="accordion-collapse collapse show">' +
    '<div class="accordion-body" id="ps-body">' + _buildPracticePanel(currentTopicKey, mod) + '</div>' +
    '</div></div></div>'
}
