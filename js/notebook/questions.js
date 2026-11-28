// 📓 Notebook (index.html) · The Questions tab: filters, grade control, 🔗 submission and 🎬 animation links.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── QUESTIONS TAB ────────────────────────────────────────────────────────────
// AI: if adding P7, P8 etc — add to PATTERN_HEADING_CLASS here AND
// add matching .ph-p7, .ph-p8 CSS rules in section 18 of the stylesheet.
const PATTERN_HEADING_CLASS = { P1: 'ph-p1', P2: 'ph-p2', P3: 'ph-p3', P4: 'ph-p4', P5: 'ph-p5', P6: 'ph-p6', P7: 'ph-p7', P8: 'ph-p8', P9: 'ph-p9', P10: 'ph-p10', P11: 'ph-p11', P12: 'ph-p12', P13: 'ph-p13', P14: 'ph-p14', P15: 'ph-p15' }

// ─── QUESTION FILTER ──────────────────────────────────────────────────────────
function setQFilter(filter) {
  currentQFilter = filter
  document.querySelectorAll('.q-filter-btn[data-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filter)
  })
  const mod = TOPIC_MODULES[currentTopicKey]
  if (mod) _renderFilteredQuestions(mod)
}

// Frequency filter — independent dimension; composes with status + company filters.
function setFreqFilter(f) {
  currentFreqFilter = f
  document.querySelectorAll('.q-freq-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-freq') === f)
  })
  const mod = TOPIC_MODULES[currentTopicKey]
  if (mod) _renderFilteredQuestions(mod)
}

// Click a company chip to show only its questions; click the active one (or "All") to clear.
function setCompanyFilter(key) {
  currentCompanyFilter = (currentCompanyFilter === key) ? null : key
  document.querySelectorAll('.company-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-company') === (currentCompanyFilter || ''))
  })
  const mod = TOPIC_MODULES[currentTopicKey]
  if (mod) _renderFilteredQuestions(mod)
}

function renderQuestions(mod) {
  const container = document.getElementById('tab-questions')
  const allQEntries = Object.entries(mod.questions)

  if (allQEntries.length === 0) {
    container.innerHTML = '<div class="text-center py-5"><span style="font-size:2rem;" class="text-secondary">📭</span><p class="text-secondary mt-3 small">No questions yet.</p></div>'
    return
  }

  // Count per status for filter buttonslabels
  const counts = { all: allQEntries.length, Pending: 0, 'In Progress': 0, Solved: 0 }
  allQEntries.forEach(([k]) => { counts[getStatus(k)]++ })

  const filters = ['all', 'Pending', 'In Progress', 'Solved']
  const filterLabels = { all: 'All', Pending: '📋 Pending', 'In Progress': '🚧 In Progress', Solved: '✅ Solved' }
  let html = '<div class="q-filter-bar">'
  filters.forEach(f => {
    const isActive = f === currentQFilter
    html += '<button type="button" class="q-filter-btn' + (isActive ? ' active' : '') + '" data-filter="' + f + '" data-click="setQFilter" data-args="' + Actions.attrArgs([f]) + '">' +
      filterLabels[f] + ' <span style="opacity:0.6">(' + counts[f] + ')</span></button>'
  })
  html += '</div>'

  // Frequency filter (violet) — independent dimension, composes with status + company.
  const freqCounts = { all: allQEntries.length, High: 0, Medium: 0, Low: 0 }
  allQEntries.forEach(([, q]) => { if (freqCounts[q.freq] !== undefined) freqCounts[q.freq]++ })
  const freqOrder = ['all', 'High', 'Medium', 'Low']
  const freqBtnLabels = { all: 'All', High: '🔴 High', Medium: '🟡 Medium', Low: '⚪ Low' }
  html += '<div class="q-filter-bar"><span class="company-filter-label">📊 Frequency</span>'
  freqOrder.forEach(f => {
    const isActive = f === currentFreqFilter
    html += '<button type="button" class="q-filter-btn q-freq-btn' + (isActive ? ' active' : '') + '" data-freq="' + f + '" data-click="setFreqFilter" data-args="' + Actions.attrArgs([f]) + '">' +
      freqBtnLabels[f] + ' <span style="opacity:0.6">(' + freqCounts[f] + ')</span></button>'
  })
  html += '</div>'

  // Company filter chips — only companies that actually tag a question in THIS topic,
  // sorted by how many (most relevant first). Counts reflect this topic only.
  const compCounts = {}
  allQEntries.forEach(([, q]) => getCompanies(q.leetcode).forEach(c => { compCounts[c] = (compCounts[c] || 0) + 1 }))
  const presentCompanies = COMPANIES.filter(c => compCounts[c.key]).sort((a, b) => compCounts[b.key] - compCounts[a.key])
  if (presentCompanies.length) {
    html += '<div class="company-filter-bar">'
    html += '<span class="company-filter-label">🏢 Asked at</span>'
    html += '<button type="button" class="company-chip' + (currentCompanyFilter === null ? ' active' : '') + '" data-company="" data-click="setCompanyFilter" data-args="' + Actions.attrArgs([null]) + '">All</button>'
    presentCompanies.forEach(c => {
      const active = currentCompanyFilter === c.key
      html += '<button type="button" class="company-chip' + (active ? ' active' : '') + '" data-company="' + c.key + '" data-click="setCompanyFilter" data-args="' + Actions.attrArgs([c.key]) + '">' +
        c.label + ' <span style="opacity:0.6">(' + compCounts[c.key] + ')</span></button>'
    })
    html += '</div>'
  }

  html += '<div id="q-filtered-list"></div>'
  container.innerHTML = html
  _renderFilteredQuestions(mod)
}

function _renderFilteredQuestions(mod) {
  const listEl = document.getElementById('q-filtered-list')
  if (!listEl) return

  const allQEntries = Object.entries(mod.questions)
  const filtered = allQEntries
    .filter(([k]) => currentQFilter === 'all' || getStatus(k) === currentQFilter)
    .filter(([, q]) => currentFreqFilter === 'all' || q.freq === currentFreqFilter)
    .filter(([, q]) => !currentCompanyFilter || getCompanies(q.leetcode).includes(currentCompanyFilter))

  if (filtered.length === 0) {
    const parts = []
    if (currentQFilter !== 'all') parts.push(currentQFilter)
    if (currentFreqFilter !== 'all') parts.push(FREQ_LABEL[currentFreqFilter])
    if (currentCompanyFilter) parts.push('@ ' + (COMPANY_LABEL[currentCompanyFilter] || currentCompanyFilter))
    listEl.innerHTML = '<div class="text-center py-5 text-secondary"><p class="small">No ' + (parts.join(' ') || '') + ' questions.</p></div>'
    return
  }

  const byPattern = {}
  mod.patterns.forEach(p => { byPattern[p.id] = [] })
  byPattern['_other'] = []

  filtered.forEach(([k, q]) => {
    const pat = mod.patterns.find(p => p.questionIds.includes(k))
    if (pat) byPattern[pat.id].push([k, q])
    else byPattern['_other'].push([k, q])
  })

  let html = ''
  mod.patterns.forEach(p => {
    const qs = byPattern[p.id]
    if (!qs.length) return
    const phCls = 'ph ' + (PATTERN_HEADING_CLASS[p.id] || '')
    const signalPills = p.recognitionSignals.map(s => '<span class="ph-signal-pill">' + escHtml(s) + '</span>').join('')

    // ── Pattern heading + always-visible signal pills ──
    html += '<div class="ph-wrap mb-3">'
    html += '<div class="' + phCls + '">'
    html += '<span class="ph-id">' + p.id + '</span>'
    html += '<span>' + escHtml(p.name) + '</span>'
    html += '<span class="ms-auto ph-count">' + qs.length + ' question' + (qs.length !== 1 ? 's' : '') + '</span>'
    html += '</div>'
    if (signalPills) {
      html += '<div class="ph-signals"><span class="ph-spot-label">Spot it →</span>' + signalPills + '</div>'
    }
    html += '</div>'

    html += '<div class="accordion mb-3" id="acc-q-' + p.id + '">'
    qs.forEach(([k, q], i) => { html += buildQuestionAccordionItem(k, q, 'q-' + p.id, i) })
    html += '</div>'
  })

  if (byPattern['_other'].length) {
    html += '<div class="accordion mb-3" id="acc-q-other">'
    byPattern['_other'].forEach(([k, q], i) => { html += buildQuestionAccordionItem(k, q, 'q-other', i) })
    html += '</div>'
  }

  listEl.innerHTML = html
}

function buildQuestionAccordionItem(lcKey, q, groupId, index) {
  const id = 'acc-' + groupId + '-' + index
  const status   = getStatus(lcKey)
  const solveN   = getSolveCount(lcKey)
  const solveRing = '<span class="solve-ring-wrap" data-click="stop" data-stop title="' + _solveRingTitle(solveN) + '">'
    + '<button class="solve-ring-adj" aria-label="One fewer solve" data-click="_adjSolveCount" data-args="' + Actions.attrArgs([lcKey, -1]) + '">−</button>'
    + '<span class="solve-ring ' + _solveRingCls(solveN) + '" data-solve-key="' + lcKey + '">' + _solveRingEmoji(solveN) + '<span class="solve-ring-num">' + solveN + '</span></span>'
    + '<button class="solve-ring-adj" aria-label="One more solve" data-click="_adjSolveCount" data-args="' + Actions.attrArgs([lcKey, 1]) + '">+</button>'
    + '</span>'

  const reviseCtrl = _reviseControlHtml(lcKey)

  const tags = (q.tags || []).map(t => '<span class="badge badge-tag me-1">' + t + '</span>').join('')
  const companyChips = getCompanies(q.leetcode).slice()
    .sort((a, b) => (COMPANY_ORDER[a] ?? 99) - (COMPANY_ORDER[b] ?? 99))
    .map(c => companyPill(c)).join('')
  const companyRow = companyChips ? '<div class="mb-2 small d-flex flex-wrap align-items-center gap-1"><span class="q-section-label me-1">🏢 Asked at</span><span class="q-companies">' + companyChips + '</span></div>' : ''
  const altApproaches = (q.alternateApproaches || []).map(a =>
    '<span class="badge bg-secondary me-1" title="' + escHtml(a.tradeoff) + '">' + escHtml(a.technique) + '</span>'
  ).join('')

  const conditionLabel = { 'two-pointers': 'Pointer condition', 'binary-search': 'Feasibility check', 'sorting': 'Key condition', 'heap': 'Key condition', 'recursion': 'Base case', 'trees': 'Recurrence / base case', 'stack': 'Push / pop rule', 'linked-list': 'Pointer move', 'trie': 'Node step', 'design': 'Core operation', 'bit-manipulation': 'Bit trick', 'intervals': 'Sort / merge rule' }[currentTopicKey] || 'Shrink trigger'
  const existingNote = getNote(lcKey)

  // Hidden by choice (Jul 2026): shrink/complexity/gotcha/FAANG rows were never
  // read. The fields still exist in data.js — flip to true to show them again.
  const SHOW_QUESTION_EXTRAS = false

  const insightRow    = q.keyInsight    ? '<div class="insight-box mb-2 small"><strong class="text-info">💡 Insight:</strong> '  + escHtml(q.keyInsight)   + '</div>' : ''
  const shrinkRow     = q.shrinkTrigger ? '<p class="mb-2 small"><span class="text-secondary">' + conditionLabel + ':</span> <code>' + escHtml(q.shrinkTrigger) + '</code></p>' : ''
  const complexityRow = (q.timeComplexity || q.spaceComplexity) ?
    '<div class="d-flex gap-3 mb-2">' +
    (q.timeComplexity  ? '<span class="text-secondary small">⏱ ' + q.timeComplexity  + '</span>' : '') +
    (q.spaceComplexity ? '<span class="text-secondary small">💾 ' + q.spaceComplexity + '</span>' : '') +
    '</div>' : ''
  const gotchaRow  = q.gotcha    ? '<div class="gotcha-box mb-2 small"><strong class="text-danger">⚠ Gotcha:</strong> '  + escHtml(q.gotcha)    + '</div>' : ''
  const faangRow   = q.faangNote ? '<div class="faang-box mb-2 small"><strong class="text-success">★ FAANG:</strong> '  + escHtml(q.faangNote) + '</div>' : ''
  const altRow     = altApproaches ? '<div class="mb-2 small d-flex flex-wrap align-items-center gap-1"><span class="q-section-label me-1">🔀 Alt approaches</span><span>' + altApproaches + '</span></div>' : ''
  const subsRow    = '<div class="q-section" id="subs-' + lcKey + '">' + _subsRowHtml(lcKey) + '</div>'
  const noteRow    = '<div class="q-section"><p class="mb-2"><span class="q-section-label">📝 My notes</span></p>' +
    '<textarea class="note-area" placeholder="Add your attempt notes, observations, or reminders here…" id="note-' + lcKey + '"' +
    ' data-input="_queueNoteSave" data-args="' + Actions.attrArgs([lcKey]) + '" data-focusout="saveNoteFromTextarea">' + escHtml(existingNote) + '</textarea>' +
    '<span class="note-saved-flash" id="note-flash-' + lcKey + '">Saved</span>' +
    '</div>'

  return (
    '<div class="accordion-item" data-lc-key="' + lcKey + '">' +
    '<h2 class="accordion-header">' +

    // ── Status dot + LC button — outside the accordion toggle button
    '<div class="q-header-actions">' +
    '<span class="status-cycle-btn ' + (STATUS_DOT[status] || 'bg-secondary') + '"' +
    ' title="Status: ' + status + ' — click to cycle"' +
    ' aria-label="Status: ' + status + ' — click to cycle"' +
    ' data-click="cycleQuestionStatus" data-args="' + Actions.attrArgs([lcKey, '$this']) + '"' +
    ' data-lc-key="' + lcKey + '">' +
    STATUS_EMOJI[status] +
    '</span>' +
    '<span class="status-cycle-btn bg-secondary qa-ghost"' +
    ' title="Open on LeetCode"' +
    ' aria-label="Open ' + escHtml(q.title) + ' on LeetCode"' +
    ' data-click="open" data-args="' + Actions.attrArgs([q.link, '_blank']) + '">↗</span>' +
    _subBtnHtml(lcKey) +
    _animBtnHtml(lcKey) +
    _pinBtnHtml(lcKey) +
    '<span class="qa-div"></span>' +
    reviseCtrl +
    '<span class="qa-div"></span>' +
    solveRing +
    '</div>' +

    '<button class="accordion-button collapsed rounded" type="button" data-bs-toggle="collapse" data-bs-target="#' + id + '">' +
    // ── Title + sub-row (badges) — two-line layout
    '<span class="q-header-content">' +
    '<span class="q-title">' + escHtml(q.title) + '</span>' +
    '<span class="q-meta">' +
    '<span class="badge bg-' + DIFFICULTY_BADGE[q.difficulty] + ' q-badge">' + q.difficulty + '</span>' +
    (q.freq ? '<span class="q-badge-sep"></span>' + freqBadge(q) : '') +
    _reviseGradeBadge(lcKey) +
    (existingNote ? '<span class="q-badge-sep"></span><span class="badge bg-secondary q-badge" title="Has notes">📝</span>' : '') +
    '</span>' +
    companyPillsRow(q.leetcode) +
    '</span>' +

    '</button></h2>' +
    '<div id="' + id + '" class="accordion-collapse collapse">' +
    '<div class="accordion-body small">' +
    (tags ? '<div class="mb-3 d-flex flex-wrap gap-1">' + tags + '</div>' : '') +
    companyRow +
    insightRow + (SHOW_QUESTION_EXTRAS ? shrinkRow + complexityRow + gotchaRow + faangRow : '') + altRow + subsRow + noteRow +
    '</div></div></div>'
  )
}

function setQuestionStatus(lcKey, status, btnEl) {
  setStatus(lcKey, status)
  // Update the question's status dot in the main accordion (if it's rendered).
  // Scope to .status-cycle-btn: practice rows ALSO carry [data-lc-key], so a bare
  // [data-lc-key] lookup (used when no btnEl is passed — e.g. from the practice panel)
  // would grab the first practice row and corrupt it into a green ✅ blob. The status
  // dot is the only .status-cycle-btn with a data-lc-key, so this targets it exactly.
  const cycleBtn = btnEl || document.querySelector('.status-cycle-btn[data-lc-key="' + lcKey + '"]')
  if (cycleBtn) {
    cycleBtn.className  = 'status-cycle-btn ' + (STATUS_DOT[status] || 'bg-secondary')
    cycleBtn.title      = 'Status: ' + status + ' — click to cycle'
    cycleBtn.setAttribute('aria-label', 'Status: ' + status + ' — click to cycle')
    cycleBtn.textContent = STATUS_EMOJI[status] ?? '📋'
  }
  // Refresh topic tracker and the sidebar nav badges. Every topic that lists the question gets
  // its badge redone (cross-listed questions share one status), not just the open topic — a ✓
  // from the dashboard has no open topic at all.
  const mod = TOPIC_MODULES[currentTopicKey]
  if (mod) renderTopicTracker(mod)
  TOPICS.forEach(t => {
    const m = TOPIC_MODULES[t.key]
    if (!m || !m.questions[lcKey]) return
    const navBadge = document.getElementById('nav-badge-' + t.key)
    if (!navBadge) return
    const qKeys  = Object.keys(m.questions)
    const solved = qKeys.filter(k => getStatus(k) === 'Solved').length
    navBadge.textContent = solved + '/' + qKeys.length
    navBadge.className = 'badge rounded-pill text-xxs ' + _navBadgeCls(solved, qKeys.length)
  })
  // If filtered view is active, re-render filtered list to reflect new status
  if (currentQFilter !== 'all' && mod) _renderFilteredQuestions(mod)
}

function cycleQuestionStatus(lcKey, cycleBtn) {
  const current = getStatus(lcKey)
  const next    = STATUS_CYCLE[current] || 'In Progress'
  setQuestionStatus(lcKey, next, cycleBtn)
}

// ─── REVISE GRADE CONTROL (active-recall queue) ───────────────────────────────
// Replaces the old single 👀 eye. Three grades drive the REVISE ladder independently of
// the CODE/solve ladder. Crucially, grading does NOT credit a code solve (the old eye did).
function _reviseTitle(state) {
  if (state === 'none')  return 'Active recall — grade how well you re-derived this from the problem statement (not a code solve)'
  if (state === 'due')   return 'Due for a recall pass — grade ✓ Solid / ~ Shaky / ✗ Forgot'
  return 'Revised — fresh. Grade again when it next comes due to keep the spacing going'
}
function _reviseControlHtml(lcKey) {
  const state = getReviseState(lcKey)
  return '<span class="revise-ctrl revise-' + state + '" id="revise-ctrl-' + lcKey + '"' +
    ' title="' + _reviseTitle(state) + '" data-click="stop" data-stop>' +
    '<span class="revise-dot">🧠</span>' +
    '<button class="rev-grade rev-solid"  title="Recalled it cold — push the next review further out"   data-click="gradeRevise" data-args="' + Actions.attrArgs([lcKey, 'solid', '$this']) + '">✓</button>' +
    '<button class="rev-grade rev-shaky"  title="Shaky — needed a hint, keep it in short rotation"        data-click="gradeRevise" data-args="' + Actions.attrArgs([lcKey, 'shaky', '$this']) + '">~</button>' +
    '<button class="rev-grade rev-forgot" title="Forgot — re-queue it for a cold solve in the CODE queue" data-click="gradeRevise" data-args="' + Actions.attrArgs([lcKey, 'forgot', '$this']) + '">✗</button>' +
    '</span>'
}
function _refreshReviseCtrl(lcKey) {
  const c = document.getElementById('revise-ctrl-' + lcKey)
  if (!c) return
  const st = getReviseState(lcKey)
  c.className = 'revise-ctrl revise-' + st
  c.title = _reviseTitle(st)
}
// Always-present badge showing your LAST revise grade (✓/~/✗), so the rating you gave stays
// visible on cards & practice rows. Hidden (rg-none) until first graded. Display-only — reads
// the persisted grade, changes nothing.
function _reviseGradeBadge(lcKey) {
  const r = getRevise(lcKey)
  const map = { solid: ['rg-solid', '✓', 'recalled cold'], shaky: ['rg-shaky', '~', 'shaky'], forgot: ['rg-forgot', '✗', 'forgot'] }
  const m = r && r.grade && map[r.grade]
  return '<span class="revise-grade-badge ' + (m ? m[0] : 'rg-none') + '" data-rg-key="' + lcKey + '"' +
    (m ? ' title="Last revise grade: ' + m[2] + '"' : '') + '>' + (m ? m[1] : '') + '</span>'
}
// Live-update every on-screen grade badge for a question (card + any practice rows).
function _refreshReviseGradeBadges(lcKey) {
  document.querySelectorAll('.revise-grade-badge[data-rg-key="' + lcKey + '"]').forEach(el => { el.outerHTML = _reviseGradeBadge(lcKey) })
}
// Grade a recall pass. Solid/Shaky/Forgot move the revise ladder; Forgot also force-queues a
// cold re-solve. Counts toward the daily streak.
//
// One grade per question per day: a second grade the same day is a CORRECTION, not another rep.
// The first grade of the day stores what the question looked like before it (`base` on the revise
// record: revise record, code interval, last-practiced, status, must-code flag, whether the ring was
// credited); every later grade that day rewinds to that first and then applies itself. So ✓✓✓✓
// counts once, ✓ then ✗ takes the ✓'s credit back, and ✓✗✓ credits once — whichever list the
// clicks came from (the caller's _psCreditCleanSolve runs after this, from the rewound state).
function gradeRevise(lcKey, grade, el) {
  // ✓ "recalled it cold" credits ONE solve on the confidence ring — a clean recall is a real
  // successful rep. ~ shaky and ✗ forgot never credit. This is the ONLY link from recall to the
  // solve count, and only on an explicit positive grade (unlike the old eye, which bumped on every
  // passive click). Status is untouched here beyond the 📋→🚧 nudge below.
  const prev  = getRevise(lcKey)
  const today = LocalDate.key()
  const shownStatus = getStatus(lcKey)
  let base = prev && prev.base && prev.base.day === today ? Object.assign({}, prev.base) : null
  // A ✓ from today saved before records carried a `base` was already credited; don't credit again.
  const legacySolidToday = !base && prev && prev.grade === 'solid' && prev.last && LocalDate.key(new Date(prev.last)) === today
  if (base) {
    if (base.credited) _adjSolveCount(lcKey, -1)
    _restoreReviewInterval(lcKey, base.interval)
    _restoreLastPracticed(lcKey, base.practiced)
    setCodeForced(lcKey, base.forced)
    if (getStatus(lcKey) !== base.status) setStatus(lcKey, base.status)
  } else {
    const rev = prev ? Object.assign({}, prev) : null
    if (rev) delete rev.base
    base = { day: today, rev, status: shownStatus, forced: isCodeForced(lcKey),
             interval: _rawReviewInterval(lcKey), practiced: getLastPracticed(lcKey), credited: false }
  }
  base.credited = grade === 'solid' && !legacySolidToday
  markRevised(lcKey, grade, base)
  // Grades only ever SET the must-code flag. A later ~ or ✓ recall is not the cold solve the flag
  // asks for; only _refreshReviseOnSolve (a clean solve) clears it.
  if (grade === 'forgot') setCodeForced(lcKey, true)
  if (base.credited) _adjSolveCount(lcKey, 1)
  _updateStreak()
  // Engaging with recall promotes an untouched (📋 Pending) question — never downgrades, never auto-✅.
  if (getStatus(lcKey) === 'Pending') setStatus(lcKey, 'In Progress')
  if (getStatus(lcKey) !== shownStatus) setQuestionStatus(lcKey, getStatus(lcKey))
  _refreshReviseCtrl(lcKey)
  _refreshReviseGradeBadges(lcKey)
  _refreshDueCounts()
}

// ─── PER-QUESTION SUBMISSION LINKS ────────────────────────────────────────────
// Up to MAX_SUBMISSIONS LeetCode submission URLs per question, shown as pills
// above "My notes". Storage lives in data.js (SUBMISSIONS_KEY / getSubmissions …).
// Safety allowlist: https-only, known judge hosts only. Checked on save AND again
// at render time, so a tampered/synced payload can never put javascript:/data: or
// an unknown host into a pill's href. URL() lowercases and punycodes the hostname,
// so lookalike unicode domains fail the regex too.
function _isSafeSubmissionUrl(u) {
  try {
    const p = new URL(u)
    if (p.protocol !== 'https:') return false
    if (/(^|\.)leetcode\.(com|cn)$/.test(p.hostname)) return p.pathname.includes('/submissions')
    if (/(^|\.)lintcode\.com$/.test(p.hostname)) return true
    if (/(^|\.)neetcode\.io$/.test(p.hostname)) return p.pathname.includes('/history')
    return false
  } catch { return false }
}

function _subsRowHtml(lcKey) {
  const subs = getSubmissions(lcKey)
  const fmt = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  let html = '<p class="mb-2"><span class="q-section-label">🔗 My submissions</span> <span class="text-faint" style="font-size:var(--fs-xs)">(' + subs.length + '/' + MAX_SUBMISSIONS + ')</span></p>' +
    '<div class="subs-row">' +
    subs.map((s, i) => {
      const x = '<span class="sub-pill-x" title="Remove link" data-click="removeSubmission" data-args="' + Actions.attrArgs([lcKey, i]) + '" data-prevent data-stop>✕</span>'
      // Render-time guard: anything that fails the allowlist gets an inert pill
      // (no href) so it can still be seen and deleted, but never followed.
      if (!_isSafeSubmissionUrl(s.url)) {
        return '<span class="sub-pill sub-pill-blocked" title="Blocked — not a recognized LeetCode/LintCode link">🚫 #' + (i + 1) + ' · ' + fmt(s.addedAt) + x + '</span>'
      }
      return '<a class="sub-pill" href="' + escHtml(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + escHtml(s.url) + '">' +
        '↗ #' + (i + 1) + ' · ' + fmt(s.addedAt) + x + '</a>'
    }).join('')
  if (subs.length < MAX_SUBMISSIONS) {
    html += '<button class="btn-add-sub" data-click="showAddSubmission" data-args="' + Actions.attrArgs([lcKey]) + '">＋ Add link</button>'
  }
  html += '</div><div id="sub-add-' + lcKey + '"></div>'
  return html + _animRowHtml(lcKey)
}

function _refreshSubsRow(lcKey) {
  const host = document.getElementById('subs-' + lcKey)
  if (!host) return
  host.innerHTML = _subsRowHtml(lcKey)
  // Keep the 🔗 button in the question header in step without a full re-render
  _refreshSubBtn(lcKey)
}

// ─── 🔗 MY-SOLUTION BUTTON (question header) ─────────────────────────────────
// Lives next to ↗ so you can open your saved submission without expanding the card.
//   0 links → dim; click opens a small paste-a-link form
//   1 link  → click opens it in a new tab
//   2+      → click opens a small list (newest first) with an Add option while under the cap
function _subBtnTitle(n) {
  if (!n) return 'Add a link to your submission'
  return n === 1 ? 'Open my solution' : 'My solutions (' + n + ') — pick one'
}
function _subBtnHtml(lcKey) {
  const n = getSubmissions(lcKey).length
  return '<span class="status-cycle-btn sub-open-btn ' + (n ? 'has-subs' : 'qa-ghost') + '"' +
    ' data-sub-btn="' + lcKey + '" role="button" title="' + _subBtnTitle(n) + '" aria-label="' + _subBtnTitle(n) + '"' +
    ' data-click="onSubBtnClick" data-args="' + Actions.attrArgs([lcKey, '$this']) + '" data-stop>🔗' +
    (n > 1 ? '<span class="sub-btn-count">' + n + '</span>' : '') + '</span>'
}
function _refreshSubBtn(lcKey) {
  document.querySelectorAll('.sub-open-btn[data-sub-btn="' + lcKey + '"]').forEach(btn => {
    const n = getSubmissions(lcKey).length
    btn.classList.toggle('has-subs', n > 0)
    btn.classList.toggle('qa-ghost', n === 0)
    btn.title = _subBtnTitle(n)
    btn.setAttribute('aria-label', _subBtnTitle(n))
    btn.innerHTML = '🔗' + (n > 1 ? '<span class="sub-btn-count">' + n + '</span>' : '')
  })
}
function _closeSubMenu() {
  document.getElementById('sub-menu')?.remove()
  document.removeEventListener('mousedown', _subMenuOutside, true)
  document.removeEventListener('keydown', _subMenuKey, true)
  window.removeEventListener('scroll', _subMenuReflow, true)
  window.removeEventListener('resize', _subMenuReflow)
}
// Scroll/resize close the popover because it is fixed-position and would drift off its button. But
// pasting a long link scrolls the INPUT sideways (the capture listener sees that too), and a phone
// keyboard opening fires resize, so ignore scrolls inside the menu and height-only resizes.
let _subMenuW = 0
function _subMenuReflow(e) {
  if (e.type === 'scroll' && document.getElementById('sub-menu')?.contains(e.target)) return
  if (e.type === 'resize' && window.innerWidth === _subMenuW) return
  _closeSubMenu()
}
function _subMenuOutside(e) {
  const m = document.getElementById('sub-menu')
  if (m && !m.contains(e.target) && !e.target.closest('.sub-open-btn')) _closeSubMenu()
}
function _subMenuKey(e) { if (e.key === 'Escape') _closeSubMenu() }
// Opens the shared popover under `btn`. `key` identifies what it is for so a second click on the
// same button closes it; `render` fills it (it may be an add form or a list).
function _openSubMenuAt(btn, key, render) {
  const menu = document.createElement('div')
  menu.id = 'sub-menu'; menu.className = 'sub-menu'; menu.dataset.key = key
  document.body.appendChild(menu)
  render()
  const r = btn.getBoundingClientRect()
  const w = menu.offsetWidth
  menu.style.left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - w - 8)) + 'px'
  menu.style.top  = Math.min(r.bottom + 6, Math.max(8, window.innerHeight - menu.offsetHeight - 8)) + 'px'
  document.addEventListener('mousedown', _subMenuOutside, true)
  document.addEventListener('keydown', _subMenuKey, true)
  _subMenuW = window.innerWidth
  window.addEventListener('scroll', _subMenuReflow, true)
  window.addEventListener('resize', _subMenuReflow)
  menu.querySelector('input')?.focus({ preventScroll: true })
}
function onSubBtnClick(lcKey, btn) {
  const wasOpenFor = document.getElementById('sub-menu')?.dataset.key === lcKey
  _closeSubMenu()
  if (wasOpenFor) return
  const subs = getSubmissions(lcKey)
  if (subs.length === 1 && _isSafeSubmissionUrl(subs[0].url)) {
    window.open(subs[0].url, '_blank', 'noopener,noreferrer')
    return
  }
  _openSubMenuAt(btn, lcKey, () => _renderSubMenu(lcKey, !subs.length))
}
function _renderSubMenu(lcKey, adding) {
  const menu = document.getElementById('sub-menu')
  if (!menu) return
  const subs = getSubmissions(lcKey)
  const fmt = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  let html = ''
  if (adding) {
    html = '<div class="sub-menu-title">Paste a LeetCode submission, LintCode or NeetCode history link</div>' +
      '<input class="sub-input" id="sub-menu-input" placeholder="https://leetcode.com/…/submissions/…"' +
      ' data-keydown="saveSubmissionFromMenu" data-key="Enter" data-args="' + Actions.attrArgs([lcKey]) + '">' +
      '<div class="sub-err" id="sub-menu-err"></div>' +
      '<div class="sub-menu-actions"><button class="btn-note-cancel" data-click="_closeSubMenu">Cancel</button>' +
      '<button class="btn-note-save" data-click="saveSubmissionFromMenu" data-args="' + Actions.attrArgs([lcKey]) + '">Save</button></div>'
  } else {
    html = '<div class="sub-menu-title">My solutions</div>' +
      subs.map((s, i) => ({ s, i })).reverse().map(({ s, i }) =>
        _isSafeSubmissionUrl(s.url)
          ? '<a class="sub-menu-item" href="' + escHtml(s.url) + '" target="_blank" rel="noopener noreferrer" data-click="_closeSubMenu"><span>#' + (i + 1) + ' · ' + fmt(s.addedAt) + '</span><span>↗</span></a>'
          : '<span class="sub-menu-item blocked" title="Blocked — not a recognized link"><span>🚫 #' + (i + 1) + ' · ' + fmt(s.addedAt) + '</span></span>'
      ).join('') +
      (subs.length < MAX_SUBMISSIONS ? '<div class="sub-menu-item sub-menu-add" data-click="_openSubMenuAdd" data-args="' + Actions.attrArgs([lcKey]) + '">＋ Add link</div>' : '')
  }
  menu.innerHTML = html
}
function saveSubmissionFromMenu(lcKey) {
  const url = (document.getElementById('sub-menu-input')?.value || '').trim()
  const err = document.getElementById('sub-menu-err')
  if (!_isSafeSubmissionUrl(url)) {
    if (err) err.textContent = "That doesn't look like a valid link — expected a leetcode.com …/submissions/…, lintcode.com or neetcode.io …/history link."
    return
  }
  if (!addSubmission(lcKey, url)) {
    if (err) err.textContent = 'Max ' + MAX_SUBMISSIONS + ' links per question — remove one in the card first.'
    return
  }
  _refreshSubsRow(lcKey)   // updates the card's list (if rendered) and the header button
  _refreshSubBtn(lcKey)
  _closeSubMenu()
}

function showAddSubmission(lcKey) {
  const host = document.getElementById('sub-add-' + lcKey)
  if (!host) return
  host.innerHTML = '<div class="d-flex gap-2 align-items-center mt-2">' +
    '<input class="sub-input" id="sub-input-' + lcKey + '" placeholder="Paste a LeetCode submission URL (…/submissions/…), a LintCode link, or a NeetCode history link"' +
    ' data-keydown="_subInputKey" data-args="' + Actions.attrArgs([lcKey, '$event']) + '">' +
    '<button class="btn-note-save" data-click="saveSubmissionFromInput" data-args="' + Actions.attrArgs([lcKey]) + '">Save</button>' +
    '<button class="btn-note-cancel" data-click="cancelAddSubmission" data-args="' + Actions.attrArgs([lcKey]) + '">Cancel</button>' +
    '</div><div class="sub-err" id="sub-err-' + lcKey + '"></div>'
  document.getElementById('sub-input-' + lcKey)?.focus()
}

function cancelAddSubmission(lcKey) {
  const host = document.getElementById('sub-add-' + lcKey)
  if (host) host.innerHTML = ''
}

function saveSubmissionFromInput(lcKey) {
  const url = (document.getElementById('sub-input-' + lcKey)?.value || '').trim()
  const err = document.getElementById('sub-err-' + lcKey)
  if (!_isSafeSubmissionUrl(url)) {
    if (err) err.textContent = "That doesn't look like a valid link — expected https://leetcode.com/…/submissions/…, a https://lintcode.com/… link, or a https://neetcode.io/…/history link"
    return
  }
  if (!addSubmission(lcKey, url)) {
    if (err) err.textContent = 'Max ' + MAX_SUBMISSIONS + ' links per question — remove one first.'
    return
  }
  _refreshSubsRow(lcKey)
}

function removeSubmission(lcKey, i) {
  if (!confirm('Remove this submission link?')) return
  removeSubmissionAt(lcKey, i)
  _refreshSubsRow(lcKey)
}

// ─── PER-QUESTION ANIMATION LINK ──────────────────────────────────────────────
// One Claude artifact per question (an animation for the hard ones), opened from the 🎬 button in
// the row. Storage lives in data.js (ANIMATIONS_KEY). Same safety rule as submissions: https-only
// and claude.ai artifact pages only, checked on save AND at render/open time.
function _isSafeAnimationUrl(u) {
  try {
    const p = new URL(u)
    return p.protocol === 'https:' && p.hostname === 'claude.ai' &&
      (/^\/artifact\/[^/]+/.test(p.pathname) || /^\/public\/artifacts\/[^/]+/.test(p.pathname))
  } catch { return false }
}
function _animBtnTitle(has) { return has ? 'Open the animation' : 'Add a link to an animation (Claude artifact)' }
function _animBtnHtml(lcKey) {
  const has = !!getAnimation(lcKey)
  return '<span class="status-cycle-btn sub-open-btn ' + (has ? 'has-subs' : 'qa-ghost') + '"' +
    ' data-anim-btn="' + lcKey + '" role="button" title="' + _animBtnTitle(has) + '" aria-label="' + _animBtnTitle(has) + '"' +
    ' data-click="onAnimBtnClick" data-args="' + Actions.attrArgs([lcKey, '$this']) + '" data-stop>🎬</span>'
}
// 📌 Pin: a bookmark only. Toggling never touches status, grades or practice pools — it just
// adds/removes the question from this topic's 📌 Pinned practice list.
function _pinBtnTitle(on) { return on ? 'Pinned — click to unpin' : 'Pin — keep it in this topic\'s 📌 Pinned list' }
function _pinBtnHtml(lcKey) {
  const on = isQuestionPinned(lcKey)
  return '<span class="status-cycle-btn sub-open-btn ' + (on ? 'has-subs' : 'qa-ghost') + '"' +
    ' data-pin-btn="' + lcKey + '" role="button" title="' + _pinBtnTitle(on) + '" aria-label="' + _pinBtnTitle(on) + '"' +
    ' data-click="onPinBtnClick" data-args="' + Actions.attrArgs([lcKey]) + '" data-stop>📌</span>'
}
function onPinBtnClick(lcKey) {
  const on = toggleQuestionPin(lcKey)
  document.querySelectorAll('[data-pin-btn="' + lcKey + '"]').forEach(btn => {
    btn.classList.toggle('has-subs', on)
    btn.classList.toggle('qa-ghost', !on)
    btn.title = _pinBtnTitle(on)
    btn.setAttribute('aria-label', _pinBtnTitle(on))
  })
  if (_psMode === 'pinned') { _psCurrentItems = _psModePool(currentTopicKey); _renderPracticePanel() }
}

function _refreshAnimBtn(lcKey) {
  document.querySelectorAll('.sub-open-btn[data-anim-btn="' + lcKey + '"]').forEach(btn => {
    const has = !!getAnimation(lcKey)
    btn.classList.toggle('has-subs', has)
    btn.classList.toggle('qa-ghost', !has)
    btn.title = _animBtnTitle(has)
    btn.setAttribute('aria-label', _animBtnTitle(has))
  })
}
function _animRowHtml(lcKey) {
  const a = getAnimation(lcKey)
  let html = '<p class="mt-3 mb-2"><span class="q-section-label">🎬 Animation</span></p><div class="subs-row">'
  if (!a) return html + '<span class="text-faint" style="font-size:var(--fs-xs)">None yet. Use the 🎬 button on the row to add one.</span></div>'
  const x = '<span class="sub-pill-x" title="Remove animation" data-click="removeAnimation" data-args="' + Actions.attrArgs([lcKey]) + '" data-prevent data-stop>✕</span>'
  if (!_isSafeAnimationUrl(a.url)) return html + '<span class="sub-pill sub-pill-blocked" title="Blocked — not a Claude artifact link">🚫 Animation' + x + '</span></div>'
  return html + '<a class="sub-pill" href="' + escHtml(a.url) + '" target="_blank" rel="noopener noreferrer" title="' + escHtml(a.url) + '">▶ Open animation' + x + '</a></div>'
}
function onAnimBtnClick(lcKey, btn) {
  const key = lcKey + ':anim'
  const wasOpenFor = document.getElementById('sub-menu')?.dataset.key === key
  _closeSubMenu()
  if (wasOpenFor) return
  const a = getAnimation(lcKey)
  if (a && _isSafeAnimationUrl(a.url)) {
    window.open(a.url, '_blank', 'noopener,noreferrer')
    return
  }
  _openSubMenuAt(btn, key, () => _renderAnimMenu(lcKey))
}
function _renderAnimMenu(lcKey) {
  const menu = document.getElementById('sub-menu')
  if (!menu) return
  menu.innerHTML = '<div class="sub-menu-title">Paste the link to your animation (a claude.ai/artifact/… link)</div>' +
    '<input class="sub-input" id="sub-menu-input" placeholder="https://claude.ai/artifact/…"' +
    ' data-keydown="saveAnimationFromMenu" data-key="Enter" data-args="' + Actions.attrArgs([lcKey]) + '">' +
    '<div class="sub-err" id="sub-menu-err"></div>' +
    '<div class="sub-menu-actions"><button class="btn-note-cancel" data-click="_closeSubMenu">Cancel</button>' +
    '<button class="btn-note-save" data-click="saveAnimationFromMenu" data-args="' + Actions.attrArgs([lcKey]) + '">Save</button></div>'
}
function saveAnimationFromMenu(lcKey) {
  const url = (document.getElementById('sub-menu-input')?.value || '').trim()
  const err = document.getElementById('sub-menu-err')
  if (!_isSafeAnimationUrl(url)) {
    if (err) err.textContent = "That doesn't look like a Claude artifact link — expected https://claude.ai/artifact/…"
    return
  }
  setAnimation(lcKey, url)
  _refreshSubsRow(lcKey)   // updates the card's list (if rendered); also re-syncs the 🔗 button
  _refreshAnimBtn(lcKey)
  _closeSubMenu()
}
function removeAnimation(lcKey) {
  if (!confirm('Remove the animation link?')) return
  removeAnimationAt(lcKey)
  _refreshSubsRow(lcKey)
  _refreshAnimBtn(lcKey)
}
