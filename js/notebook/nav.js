// 📓 Notebook (index.html) · Sidebar nav, global search, back-to-top, sidebar toggle and theme.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── BACK TO TOP ───────────────────────────────────────────────────────────────
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
window.addEventListener('scroll', () => {
  document.getElementById('backToTopBtn')?.classList.toggle('show', window.scrollY > 400)
}, { passive: true })

// ─── NAV BADGE COLOUR ───────────────────────────────────────────────────────
// 5-level colour ramp: grey → yellow → teal → blue → green as you fill the topic
function _navBadgeCls(solved, total) {
  if (!total)                        return 'bg-secondary'
  if (solved === total)              return 'bg-success'
  const pct = solved / total * 100
  if (pct >= 75)                     return 'bg-primary'   // 75-99 %  → blue (almost!)
  if (pct >= 50)                     return 'bg-info'      // 50-74 %  → teal
  if (pct > 0)                       return 'bg-warning'   // 1-49 %   → yellow
  return 'bg-secondary'                                    // 0 %      → grey
}

// ─── BUILD NAV ────────────────────────────────────────────────────────────────
function buildNav() {
  const container = document.getElementById('nav-topics')
  container.innerHTML = TOPICS.map(t => {
    const mod = TOPIC_MODULES[t.key]
    if (!mod) return `
      <button type="button" id="nav-${t.key}" data-click="loadTopic" data-args="${Actions.attrArgs([t.key])}" class="nav-link" title="${escHtml(t.label)}">
        <span class="nav-topic-icon">${t.icon}</span>
        <span class="nav-topic-label">${t.label}</span>
      </button>
    `
    const qKeys   = Object.keys(mod.questions)
    const solved  = qKeys.filter(k => getStatus(k) === 'Solved').length
    const total   = qKeys.length
    const badgeCls = _navBadgeCls(solved, total)
    return `
      <button type="button"
         id="nav-${t.key}"
         data-click="loadTopic" data-args="${Actions.attrArgs([t.key])}"
         class="nav-link">
        <span class="nav-topic-icon">${t.icon}</span>
        <span class="nav-topic-label">${t.label}</span>
        <span id="nav-badge-${t.key}" class="badge ${badgeCls} rounded-pill text-xxs">${solved}/${total}</span>
      </button>
    `
  }).join('')
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
function handleGlobalSearch() {
  const input = document.getElementById('global-search-input')
  if (!input) return
  
  const query = input.value.trim()
  
  if (query.length === 0 && document.body.dataset.hubMode === 'sd') {
    try { document.getElementById(EMBEDS.sysdesign.frame).contentWindow.SDNAV_search('') } catch {}
    return
  }
  if (query.length === 0) {
    // If search is empty, go back to dashboard
    document.getElementById('global-search-input').value = ''
    loadDashboard()
    return
  }
  
  // In System Design the same box searches the notes and glossary, inside the notes page.
  if (document.body.dataset.hubMode === 'sd') {
    if (document.getElementById('view-sysdesign').classList.contains('d-none')) loadEmbed('sysdesign')
    try { document.getElementById(EMBEDS.sysdesign.frame).contentWindow.SDNAV_search(query) } catch {}
    return
  }
  // Perform search
  const results = searchGlobalQuestions(query)
  renderSearchResults(results)
}

function renderSearchResults(results) {
  setHubMode('dsa')
  showView('view-search-results')
  document.getElementById('page-title').textContent = '🔍 Search Results'
  
  // Render daily question card at top
  const dailyQ = getDailyQuestion()
  if (dailyQ) {
    document.getElementById('daily-question-card').innerHTML = '<div class="dash-sheet dash-daily-solo">' + renderDailyQuestionCard(dailyQ) + '</div>'
  }
  
  // Render search results
  const resultsList = document.getElementById('search-results-list')
  if (results.length === 0) {
    resultsList.innerHTML = '<div class="alert alert-info">No questions match your search. Try different keywords!</div>'
    return
  }
  
  let html = '<div class="row g-2">'
  results.forEach(r => {
    const id = 'qr_' + r.lcKey.replace(/_/g, '')
    html += `<div class="col-md-6">
      <div class="card" style="cursor:pointer;" data-click="goToQuestion" data-args="${Actions.attrArgs([r.topicKey, r.lcKey])}">
        <div class="card-body p-3">
          <div class="d-flex gap-2 mb-1">
            <span>${r.topicIcon} <small class="text-muted">${r.topicLabel}</small></span>
            <span class="ms-auto d-flex gap-1 align-items-center"><strong class="badge" style="background:var(--${getDifficultyColor(r.question.difficulty)})">${r.question.difficulty}</strong>${freqBadge(r.question)}</span>
          </div>
          <h6 class="mb-1">${escHtml(r.question.title)}</h6>
          <div class="d-flex gap-1 mb-1">
            <span class="badge bg-secondary text-dark">${r.status}</span>
            ${r.question.tags.slice(0, 2).map(t => `<span class="badge bg-dark text-secondary">${escHtml(t)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`
  })
  html += '</div>'
  resultsList.innerHTML = html
}

function getDifficultyColor(difficulty) {
  switch(difficulty) {
    case 'Easy': return 'green'
    case 'Medium': return 'yellow'
    case 'Hard': return 'red'
    default: return 'accent'
  }
}

function goToQuestion(topicKey, lcKey) {
  // Clear search and navigate to topic/question
  document.getElementById('global-search-input').value = ''
  loadTopic(topicKey)  // lands on the Questions tab by default (TOPIC_TABS[0])
  // Expand this question's accordion item and scroll it into view, with a flash to make it
  // easy to spot. Uses the same data-lc-key lookup _jumpToQuestion relies on elsewhere — the
  // old selector here (id="q_"+lcKey) never matched anything, so this silently did nothing.
  requestAnimationFrame(() => {
    const item = document.querySelector('#tab-questions .accordion-item[data-lc-key="' + lcKey + '"]')
    if (!item) return
    const collapseEl = item.querySelector('.accordion-collapse')
    if (collapseEl && window.bootstrap) bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false }).show()
    item.scrollIntoView({ behavior: 'smooth', block: 'center' })
    item.classList.remove('ps-jump-highlight')
    void item.offsetWidth  // restart the flash animation if clicked again
    item.classList.add('ps-jump-highlight')
  })
}

function skipToDailyQuestion(currentLcKey) {
  const newQ = getRandomDailyQuestion(currentLcKey)
  if (newQ) {
    // Update the dashboard daily question card if visible
    const dailyCard = document.getElementById('daily-question-card')
    if (dailyCard) {
      dailyCard.innerHTML = '<div class="dash-sheet dash-daily-solo">' + renderDailyQuestionCard(newQ) + '</div>'
    }
    // Update dashboard panel if visible
    const dailyPanel = document.getElementById('daily-question-panel')
    if (dailyPanel) {
      dailyPanel.innerHTML = renderDailyQuestionCard(newQ)
    }
  }
}

function renderDailyQuestionCard(dailyQ) {
  const q = dailyQ.question
  const status = dailyQ.status === 'Solved' ? '✅ Solved' : dailyQ.status === 'In Progress' ? '🚧 In progress' : '📋 Not started'
  // The key insight is the answer, so it stays folded until asked for.
  const hint = q.keyInsight
    ? `<details class="dash-hint"><summary>Show the key idea</summary><p>${escHtml(q.keyInsight)}</p></details>`
    : ''
  return `<h2>Question of the day</h2>
    <h3>${escHtml(q.title)}</h3>
    <div class="dash-daily-meta">
      <span>${dailyQ.topicIcon} ${escHtml(dailyQ.topicLabel)}</span>
      <span class="badge" style="background:var(--${getDifficultyColor(q.difficulty)});color:var(--on-accent)">${escHtml(q.difficulty)}</span>
      ${freqBadge(q)}
      <span>${status}</span>
    </div>
    ${hint}
    <div class="dash-actions">
      <button type="button" class="dash-btn dash-btn-primary" data-click="goToQuestion" data-args="${Actions.attrArgs([dailyQ.topicKey, dailyQ.lcKey])}">Open question</button>
      <button type="button" class="dash-btn" data-click="skipToDailyQuestion" data-args="${Actions.attrArgs([dailyQ.lcKey])}">Pick another</button>
    </div>`
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const collapsed = document.getElementById('sidebar').classList.toggle('collapsed')
  if (_isPhoneLayout()) return  // the phone drawer always starts closed; nothing to remember
  // Per-device UI preference on purpose: not in BACKUP_KEYS, so a phone and a laptop keep their own.
  try { localStorage.setItem('dsa-sidebar-collapsed', collapsed ? '1' : '0') } catch (e) {}
}
// Same breakpoint as the drawer CSS (max-width: 768px).
function _isPhoneLayout() {
  return !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches)
}
// On a phone, picking a destination closes the drawer so the page underneath is visible.
function _closeDrawerOnPick(e) {
  // Opening a lesson group is not a destination: keep the drawer open for the pick inside it.
  if (_isPhoneLayout() && e.target.closest && e.target.closest('.nav-link') && !e.target.closest('.sd-group')) {
    document.getElementById('sidebar').classList.add('collapsed')
  }
}

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement
  const isDark = html.getAttribute('data-bs-theme') === 'dark'
  const next = isDark ? 'light' : 'dark'
  html.setAttribute('data-bs-theme', next)
  localStorage.setItem('dsa-theme', next)
  document.getElementById('theme-toggle-btn').textContent = next === 'dark' ? '🌙' : '☀️'
  _syncThemeColor()
}
// The browser bar colour follows the page background of the active theme.
function _syncThemeColor() {
  const m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', document.documentElement.getAttribute('data-bs-theme') === 'light' ? '#f3f6f8' : '#1c2723')
}

function syncThemeIcon() {
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark'
  const btn = document.getElementById('theme-toggle-btn')
  if (btn) btn.textContent = isDark ? '🌙' : '☀️'
  _syncThemeColor()
}
