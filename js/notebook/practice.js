// 📓 Notebook (index.html) · The topic Practice Session.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── PRACTICE SESSION ─────────────────────────────────────────────────────────

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Weighted shuffle: entries with fewer solve counts appear first (more likely to be practiced).
// Weight = random() / (solveCount + 1) — lower solves → higher weight → sorts earlier.
function _weightedShuffle(entries) {
  return entries
    .map(e => ({ e, w: Math.random() / (getSolveCount(e[0]) + 1) }))
    .sort((a, b) => b.w - a.w)
    .map(x => x.e)
}

// Interview-frequency weight for ranking: High > unset (Medium-ish default) > Medium > Low.
// Used by Graded so limited practice time is spent on your weakest AND highest-impact problems.
function _freqWeight(q) {
  return q && q.freq === 'High' ? 3 : q && q.freq === 'Medium' ? 2 : q && q.freq === 'Low' ? 1 : 1.5
}
// Like _weightedShuffle, but also favors higher interview-frequency questions within the tier.
function _weightedShuffleByImpact(entries) {
  return entries
    .map(e => ({ e, w: (Math.random() / (getSolveCount(e[0]) + 1)) * _freqWeight(e[1]) }))
    .sort((a, b) => b.w - a.w)
    .map(x => x.e)
}

// Order a practice pool: unsolved first (you practice what you haven't solved), then solved.
function _orderPracticePool(entries) {
  return [
    ..._weightedShuffle(entries.filter(([k]) => getStatus(k) !== 'Solved')),
    ..._weightedShuffle(entries.filter(([k]) => getStatus(k) === 'Solved')),
  ]
}

// Grade-aware ordering: serve your weakest problems first. Lower rank = served earlier.
// 0 = a "forgot" recall force-queued it · 1 = last recall was shaky · 2 = everything else.
function _weaknessRank(lcKey) {
  if (isCodeForced(lcKey)) return 0
  const r = getRevise(lcKey)
  if (r && r.grade === 'shaky') return 1
  return 2
}
// Stable sort a list of [lcKey, q] pairs by weakness (keeps the prior weighted order within a tier).
function _orderByWeakness(pairs) {
  return pairs
    .map((p, i) => [p, i])
    .sort((a, b) => (_weaknessRank(a[0][0]) - _weaknessRank(b[0][0])) || (a[1] - b[1]))
    .map(x => x[0])
}

// Dispatcher: Graded renders grade-rows (✓/~/✗ + saved-solution link, right on the row);
// anything else (Worked-on-only pool, plain generated sets) renders solve-rows.
function _qpRowsHtml() {
  if (!_qpResults) return ''
  if (_qpRevised) return _qpResults.map((entry, i) => _buildReviseItem(entry, i, 'qp')).join('')
  return _qpResults.map((entry, i) => _buildPracticeItem(entry, i, true)).join('')
}

// Fine-grained relative time: "just now" / "30 min" / "4h" / "1d" / "12d" from an ISO timestamp.
// How long ago, ready to show: 'just now', '5 min ago', '3h ago', '2d ago'.
function _agoLabel(iso) {
  if (!iso) return ''
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'just now'
  const hr = Math.floor(min / 60)
  return (min < 60 ? min + ' min' : hr < 24 ? hr + 'h' : Math.floor(hr / 24) + 'd') + ' ago'
}

// Re-grade a row in the Revised log: updates the grade (and badge, via gradeRevise) + the "ago"
// label, in place. The row stays — it's a log, not a sweep.
function _qpRevisedGrade(ev, lcKey, grade) {
  ev.stopPropagation()
  gradeRevise(lcKey, grade)
  const row = ev.currentTarget.closest('.ps-q-row')
  if (row) { const a = row.querySelector('.rev-ago'); if (a) a.textContent = 'today' }
}

// Render one REVISE row: title + difficulty + a "last grade" tag + the ✓/~/✗ recall buttons.
// No click-to-solve — only the grade buttons act (recall ≠ coding).
// Pieces every practice-list row shares (Graded, By Pattern, solve list, Recent, Pinned).
function _lcLink(q) { return '<a href="' + escHtml(q.link) + '" target="_blank" rel="noopener noreferrer" class="ps-q-link" title="Open on LeetCode" data-click="stop" data-stop>↗</a>' }
function _titleLink(q) { return '<a href="' + escHtml(q.link) + '" target="_blank" rel="noopener noreferrer" class="ps-q-title ps-q-title-link" title="Open to read: ' + escHtml(q.title) + '">' + escHtml(q.title) + '</a>' }
function _diffBadge(q) { return '<span class="badge bg-' + DIFFICULTY_BADGE[q.difficulty] + ' q-badge flex-shrink-0">' + q.difficulty + '</span>' }
function _jumpBtn(lcKey) { return '<button type="button" class="ps-q-link ps-jump-btn" title="Jump to the full question below" aria-label="Jump to question" data-click="_jumpToQuestion" data-args="' + Actions.attrArgs(['$event', lcKey]) + '">⤵</button>' }
// A forced-to-code question reads as forgot; otherwise the tint is this session's grade.
function _rowTint(forced, rv) { return forced ? ' ps-q-forgot' : rv && rv.grade === 'solid' ? ' ps-q-solid' : rv && rv.grade === 'shaky' ? ' ps-q-shaky' : '' }
function _subLink(lcKey) {
  const subs = getSubmissions(lcKey)
  return subs.length ?
    '<a href="' + escHtml(subs[subs.length - 1].url) + '" target="_blank" rel="noopener noreferrer" class="ps-q-link" title="Open your' +
    (subs.length > 1 ? ' most recent saved submission (' + subs.length + ' saved)' : ' saved submission') +
    '" data-click="stop" data-stop>🔗</a>' : ''
}
function _topicIcon(lcKey) {
  const tKey = Object.keys(TOPIC_MODULES).find(k => TOPIC_MODULES[k].questions?.[lcKey])
  const tEntry = tKey ? TOPICS.find(t => t.key === tKey) : null
  return tEntry ? '<span class="text-xxs text-secondary flex-shrink-0">' + tEntry.icon + '</span>' : ''
}

function _buildReviseItem([lcKey, q], i, ctx) {
  const fn = ctx === 'ps' ? '_psRecallGrade' : '_qpReviseGrade'   // which list this row lives in
  // Every graded row stays in place (never swept off the list) — grading just tints the row and
  // marks the chosen button, so the row itself is your record of what you graded today.
  // The tint/badge only reflect a grade thrown THIS session — a stale grade from a prior day
  // doesn't pre-mark the row, so every row starts neutral and ungraded until you click it.
  const doneThisSession = ctx === 'ps' ? _psDoneThisSession.has(lcKey) : _qpDoneThisSession.has(lcKey)
  const forced = isCodeForced(lcKey)
  const rv     = doneThisSession ? getRevise(lcKey) : null
  const rowCls = _rowTint(forced, rv)
  const topicIcon = _topicIcon(lcKey)
  const chosen = g => (rv && rv.grade === g) ? ' rev-chosen' : ''
  const subLink = _subLink(lcKey)
  // ~20% of a freshly generated Revise/By Pattern set is randomly flagged to actually CODE,
  // not just recall — a spot-check so pure mental recall can't quietly become the whole habit.
  const codePick = ctx === 'ps' && _psReviseCodeFlagged.has(lcKey)
  const codeBadge = codePick ?
    '<span class="ps-code-pick flex-shrink-0" title="Randomly picked to CODE this one — actually write and run the solution, don\'t just recall it">⌨️ Code</span>' : ''
  // Jump-to-question assumes a single "current topic" page context, which the dashboard doesn't
  // have — it doesn't work there. Only offer it in the per-topic Practice Session.
  const jumpBtn = ctx === 'ps' ? _jumpBtn(lcKey) : ''
  return (
    '<div class="ps-q-row' + rowCls + '" data-lc-key="' + lcKey + '">' +
    '<span class="ps-q-num">' + (i + 1) + '</span>' +
    topicIcon +
    _titleLink(q) +
    // Dashboard rows drop difficulty (and never had status) to match the plain generator's rows —
    // frequency stays instead. Per-topic Graded/By Pattern keep difficulty, untouched.
    (ctx === 'ps' ? _diffBadge(q) : (q.freq ? freqBadge(q, ' flex-shrink-0') : '')) +
    codeBadge +
    (doneThisSession ? _reviseGradeBadge(lcKey) : '') +
    '<span class="rev-grade-group flex-shrink-0">' +
      '<button class="rev-grade rev-solid' + chosen('solid') + '"  title="Recalled it cold — push the next review further out"   data-click="' + fn + '" data-args="' + Actions.attrArgs(['$event', lcKey, 'solid']) + '">✓</button>' +
      '<button class="rev-grade rev-shaky' + chosen('shaky') + '"  title="Shaky — needed a hint, keep it in short rotation"        data-click="' + fn + '" data-args="' + Actions.attrArgs(['$event', lcKey, 'shaky']) + '">~</button>' +
      '<button class="rev-grade rev-forgot' + chosen('forgot') + '" title="Forgot — re-queue it for a cold solve in the CODE queue" data-click="' + fn + '" data-args="' + Actions.attrArgs(['$event', lcKey, 'forgot']) + '">✗</button>' +
    '</span>' +
    jumpBtn +
    subLink +
    _lcLink(q) +
    '</div>'
  )
}

// Read-only row for the 🕘 Recent log: what you graded, in Graded/By Pattern, and when — no
// grade controls here, this is a history, not another place to grade from.
const RECENT_GRADE_BADGE = { solid: ['rg-solid', '✓'], shaky: ['rg-shaky', '~'], forgot: ['rg-forgot', '✗'] }
function _buildRecentItem([lcKey, q], i) {
  const entry = getRecentLog().find(e => e.lcKey === lcKey)
  const grade = entry ? entry.grade : null
  const ts    = entry ? entry.ts : null
  const badge = RECENT_GRADE_BADGE[grade] || ['rg-none', '']
  return (
    '<div class="ps-q-row" data-lc-key="' + lcKey + '">' +
    '<span class="ps-q-num">' + (i + 1) + '</span>' +
    _titleLink(q) +
    _diffBadge(q) +
    '<span class="revise-grade-badge ' + badge[0] + '">' + badge[1] + '</span>' +
    (ts ? '<span class="rev-ago" title="' + escHtml(new Date(ts).toLocaleString()) + '">' + _agoLabel(ts) + '</span>' : '') +
    _lcLink(q) +
    '</div>'
  )
}

// Grade a row in the Revise Session: drives the revise queue (and force-codes on "forgot"),
// then marks the row graded. Rows stay put — regrading is allowed (click a different button).
function _qpReviseGrade(ev, lcKey, grade) {
  ev.stopPropagation()
  gradeRevise(lcKey, grade)               // data + dashboard counts + (card refresh is a no-op here)
  logRecent(lcKey, grade)
  // ✓ Solid in GRADED specifically gets full "clean solve" credit — see _psCreditCleanSolve.
  if (grade === 'solid' && _qpRevised) _psCreditCleanSolve(lcKey)
  _qpDoneThisSession.add(lcKey)
  _saveQpState()
  const listEl = document.getElementById('qp-results')
  if (listEl) _regradeRow(listEl, _qpResults || [], _qpDoneThisSession, lcKey, (e, i) => _buildReviseItem(e, i, 'qp'), '🧠 Recall sweep complete')
}

// After a grade: redraw that row in place (tint + chosen button), and once every row is graded
// put the closing banner on top. Rows stay, so regrading is always possible.
function _regradeRow(listEl, items, done, lcKey, build, banner) {
  const idx = items.findIndex(([k]) => k === lcKey)
  const row = listEl.querySelector('.ps-q-row[data-lc-key="' + lcKey + '"]')
  if (row && idx !== -1) row.outerHTML = build(items[idx], idx)
  if (banner && items.every(([k]) => done.has(k))) _doneBanner(listEl, banner + ' · <span style="color:var(--green)">' + done.size + ' graded</span>')
}
// The one closing banner a list gets (never a second).
function _doneBanner(listEl, html) {
  if (listEl && !listEl.querySelector('.ps-session-done')) listEl.insertAdjacentHTML('afterbegin', '<div class="ps-session-done">' + html + '</div>')
}

// Generate a practice set for a single topic.
// Priority: Unsolved (weighted) → Solved (weighted), weakest grade first.
function _genPracticeSet(topicKey, count) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return []
  const all         = Object.entries(mod.questions)
  // Serve your weakest (forgot → shaky) first within the topic.
  return _orderByWeakness(_orderPracticePool(all)).slice(0, count)
}

// Render a single practice row. showTopic=true adds the topic icon (dashboard).
// Jump from a practice/graded/revise row straight to the full question card below (Questions
// tab) — switches tab, clears any filter that could be hiding it, expands its accordion, and
// scrolls it into view with a brief flash. Not offered in Mock (the point there is to stay cold).
// Read-only row for 📌 Pinned: open, jump to the card, or unpin. No grade buttons, so looking
// at a pinned question never changes its grade, status or review schedule.
function _buildPinnedItem([lcKey, q], i) {
  return (
    '<div class="ps-q-row" data-lc-key="' + lcKey + '">' +
    '<span class="ps-q-num">' + (i + 1) + '</span>' +
    _titleLink(q) +
    _diffBadge(q) +
    _jumpBtn(lcKey) +
    '<button type="button" class="ps-q-link" title="Unpin" aria-label="Unpin" data-click="onPinBtnClick" data-args="' + Actions.attrArgs([lcKey]) + '" data-stop>📌</button>' +
    _lcLink(q) +
    '</div>'
  )
}

function _jumpToQuestion(ev, lcKey) {
  if (ev) ev.stopPropagation()
  if (currentQFilter !== 'all' || currentFreqFilter !== 'all' || currentCompanyFilter !== null) {
    currentQFilter = 'all'; currentFreqFilter = 'all'; currentCompanyFilter = null
  }
  if (currentTab !== 'questions') {
    showTopicTab('questions')  // re-renders tab-questions with the (now-cleared) filters
  } else {
    const mod = TOPIC_MODULES[currentTopicKey]
    if (mod) renderQuestions(mod)
  }
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

function _buildPracticeItem([lcKey, q], i, showTopic) {
  const due = isDue(lcKey)
  const topicIcon = showTopic ? _topicIcon(lcKey) : ''
  // The row itself does nothing on click anymore — only the grade buttons act. Tint/chosen-button
  // only reflect a grade thrown in THIS generated set (same rule as Graded/By Pattern rows) — a
  // stale grade from before this generate doesn't pre-color the row; every row starts neutral until
  // you grade it again. The set persists across reloads (doneThisSession is saved in
  // dsa-qp-state-v1 / the practice session), so reopening the tab keeps this set's colours.
  const doneInSession = showTopic ? _qpDoneThisSession.has(lcKey) : _psDoneThisSession.has(lcKey)
  const forced   = isCodeForced(lcKey)
  const rv       = doneInSession ? getRevise(lcKey) : null
  const rowCls   = _rowTint(forced, rv)
  const dueDot   = ((due || forced) && !rv) ? '<span class="ps-due-dot" title="Due for review">●</span>' : ''
  // Jump-to-question assumes you're already inside that topic's page (currentTopicKey) — on the
  // dashboard there's no single "current topic" to jump within, so it doesn't actually work
  // there. Only offer it in the per-topic Practice Session.
  const jumpBtn = showTopic ? '' : _jumpBtn(lcKey)
  // Saved-solution link — same 🔗 to your last submission that Graded/By Pattern rows have.
  const subLink = _subLink(lcKey)
  // Solve-list rows also get the same ✓/~/✗ grade buttons Graded/By Pattern have. ✓ is the ONLY
  // way to mark a question Solved here now (see _practiceGrade / _psCreditCleanSolve).
  const chosen = g => (rv && rv.grade === g) ? ' rev-chosen' : ''
  const gradeBtns =
    '<span class="rev-grade-group flex-shrink-0">' +
      '<button class="rev-grade rev-solid' + chosen('solid') + '"  title="Recalled it cold — mark solved" data-click="_practiceGrade" data-args="' + Actions.attrArgs(['$event', lcKey, 'solid', showTopic]) + '" data-stop>✓</button>' +
      '<button class="rev-grade rev-shaky' + chosen('shaky') + '"  title="Shaky — needed a hint"          data-click="_practiceGrade" data-args="' + Actions.attrArgs(['$event', lcKey, 'shaky', showTopic]) + '" data-stop>~</button>' +
      '<button class="rev-grade rev-forgot' + chosen('forgot') + '" title="Forgot"                         data-click="_practiceGrade" data-args="' + Actions.attrArgs(['$event', lcKey, 'forgot', showTopic]) + '" data-stop>✗</button>' +
    '</span>'
  return (
    '<div class="ps-q-row' + rowCls + '" data-lc-key="' + lcKey + '">' +
    '<span class="ps-q-num">' + (i + 1) + '</span>' +
    dueDot +
    topicIcon +
    '<span class="ps-q-title" title="' + escHtml(q.title) + '">' + escHtml(q.title) + '</span>' +
    (q.freq ? freqBadge(q, ' flex-shrink-0') : '') +
    gradeBtns +
    jumpBtn +
    subLink +
    _lcLink(q) +
    '</div>'
  )
}
// Grade a solve-list row (dashboard's plain generator / Worked / Mock). This is now the ONLY way
// these rows change state — the row itself has no click handler any more. ✓ Solid gets the same
// full "clean solve" credit as Graded (_psCreditCleanSolve): ladder push + mark Solved. The ring
// bump itself lives inside gradeRevise() and is deduped off the PERSISTED revise record (not the
// UI path that called it), so grading the same question twice today — from here, Graded, or By
// Pattern, in any combination — only ever credits the ring once.
function _practiceGrade(ev, lcKey, grade, showTopic) {
  if (ev) ev.stopPropagation()
  gradeRevise(lcKey, grade)
  if (grade === 'solid') _psCreditCleanSolve(lcKey)
  if (showTopic) { _qpDoneThisSession.add(lcKey); _saveQpState() } else { _psDoneThisSession.add(lcKey); _psSaveSession() }
  const items  = showTopic ? _qpResults : _psCurrentItems
  const listEl = document.getElementById(showTopic ? 'qp-results' : 'ps-list')
  if (!listEl || !items) return
  // Only the dashboard list gets a session-complete banner.
  _regradeRow(listEl, items, showTopic ? _qpDoneThisSession : _psDoneThisSession, lcKey, (e, i) => _buildPracticeItem(e, i, showTopic), showTopic && '✅ Session complete')
}

// Build the full inner HTML for the Practice Session accordion body.
function _buildPracticePanel(topicKey, mod) {
  const total    = Object.keys(mod.questions).length
  const count    = Math.max(1, Math.min(_psQCount, total))

  // Track current topic for persistence
  const prevTopic = _psCurrentTopic
  _psCurrentTopic = topicKey

  // A saved session (any mode) is restored exactly as you left it — refresh/navigation never
  // reshuffles a set. Without one, Graded/Mock auto-generate for the topic so they're never an
  // empty "click Generate" wall (and the result is saved so it survives a refresh too).
  if (_psCurrentItems.length === 0) {
    const savedSession = _psLoadSession(topicKey)
    if (savedSession) {
      // Worked/Mock/whole-topic-Revise were removed from the UI — coerce any old saved
      // session in one of those modes to Graded so there's still a mode button to land on.
      _psMode       = ['revise-pattern', 'graded', 'recent', 'pinned'].includes(savedSession.mode)
        ? savedSession.mode : 'graded'
      if (_psMode === 'recent') {
        // Recent is a log of what you just did — it must never show a stale snapshot. A saved
        // session here only carries the restored mode/scope; the actual rows always come fresh
        // from the live log, otherwise grading something new (in Graded/By Pattern) wouldn't
        // show up here again until you happened to hit Refresh.
        // _psLoadSession (just above) already restored _psQCount from the saved session, but
        // `count` (top of this function) was computed from the OLD _psQCount before that — recompute.
        const recentCount = Math.max(1, Math.min(_psQCount, total))
        _psCurrentItems = _psModePool(topicKey, recentCount)
        _psQCount = _psCurrentItems.length || _psQCount
        _psSaveSession()
      } else if (_psMode === 'pinned') {
        _psCurrentItems = _psModePool(topicKey)   // always live: pins change on the cards below
      } else {
        // A question since removed from data.js has no link/pattern/grade controls left — drop it
        // rather than restore a broken row from the {title, difficulty} the session kept.
        _psCurrentItems = savedSession.items.filter(([lcKey]) => mod.questions[lcKey]).map(([lcKey]) => [lcKey, mod.questions[lcKey]])
        // Graded promise: ✗/~ questions ALWAYS appear. Merge in any weak graded
        // questions missing from the restored set — graded since it was saved (or saved back
        // when the old cooldown filter still hid them). They go on top, weakest first.
        if (_psMode === 'graded') {
          const have = new Set(_psCurrentItems.map(([k]) => k))
          const rank = k => ({ forgot: 0, shaky: 1 }[getRevise(k).grade] ?? 2)
          const missing = Object.entries(mod.questions)
            .filter(([k]) => getRevise(k) && !have.has(k) && rank(k) < 2)
            .sort((a, b) => rank(a[0]) - rank(b[0]))
          if (missing.length) { _psCurrentItems = [...missing, ..._psCurrentItems]; _psSaveSession() }
        }
        _psQCount = _psCurrentItems.length || _psQCount
      }
    } else if (_psMode === 'pinned') {
      _psCurrentItems = _psModePool(topicKey)
    } else if (_psMode === 'graded' || _psClearedTopics.has(topicKey)) {
      // Graded always starts empty — pick a count and hit Generate. A 🗑 Cleared topic (any mode) stays empty the same way.
    } else if (_psMode !== 'worked' || prevTopic === topicKey) {
      _psCurrentItems = _psModePool(topicKey, count)
      _psQCount = _psCurrentItems.length
      _psPickReviseCodeFlags()
      _psSaveSession()
    }
    // First visit to a topic in Worked/Graded mode: leave empty (user clicks Generate)
  }

  let html = ''
  // ── Mode toggle: Graded (solve) / By Pattern (recall, scoped to a pattern) ──
  html += '<div class="ps-mode-bar d-flex flex-wrap gap-2 mb-2">'
  html += '<button type="button" class="qp-chip' + (_psMode === 'graded' ? ' active' : '') + '" data-click="_psSetMode" data-args="' + Actions.attrArgs(['graded', topicKey]) + '" title="Graded — solve the questions you have graded on the cards; ranked ✗ forgot → ~ shaky → ✓ confident">🕒 Graded</button>'
  html += '<button type="button" class="qp-chip' + (_psMode === 'revise-pattern' ? ' active' : '') + '" data-click="_psSetMode" data-args="' + Actions.attrArgs(['revise-pattern', topicKey]) + '" title="By Pattern — active recall scoped to just the pattern(s) you pick">🧩 By Pattern</button>'
  html += '<button type="button" class="qp-chip' + (_psMode === 'recent' ? ' active' : '') + '" data-click="_psSetMode" data-args="' + Actions.attrArgs(['recent', topicKey]) + '" title="Recent — a read-only log of what you graded in Graded/By Pattern, newest first">🕘 Recent</button>'
  html += '<button type="button" class="qp-chip' + (_psMode === 'pinned' ? ' active' : '') + '" data-click="_psSetMode" data-args="' + Actions.attrArgs(['pinned', topicKey]) + '" title="Pinned — every question you pinned 📌 on the cards in this topic">📌 Pinned</button>'
  html += '</div>'
  // ── Controls bar ──────────────────────────────────────────────────────────
  html += '<div class="ps-ctrl-bar">'

  if (_psMode === 'pinned') {
    html += '<span class="text-xxs text-secondary">📌 ' + _psCurrentItems.length + ' pinned</span>'
  } else if (_psCurrentItems.length === 0) {
    if (_psMode === 'graded' || (_psMode === 'revise-pattern' && _psClearedTopics.has(topicKey))) {
      // Graded always lands empty — type a count (any number, not just +/-) and hit Generate.
      html += '<input type="number" class="ps-count-input" id="ps-gen-count-input" min="1" max="' + total + '" value="' + count + '" data-click="stop" data-stop>'
      html += '<span class="text-secondary text-xs">/ ' + total + '</span>'
      html += '<button type="button" class="ps-shuffle-btn ms-1" data-click="_psGenerateGraded" data-args="' + Actions.attrArgs([topicKey]) + '">▶ Generate</button>'
    } else {
      const modeLabel = _psMode === 'recent' ? '🕘 Recent' : '🧩 By Pattern'
      html += '<span class="text-xxs text-secondary text-muted">' + modeLabel + ' — nothing here right now</span>'
    }
  } else {
    html += '<button type="button" class="ps-count-btn" aria-label="Fewer questions" data-click="_psAdjCount" data-args="' + Actions.attrArgs([-1, topicKey]) + '">−</button>'
    html += '<span class="ps-count-val" id="ps-count-val">' + _psCurrentItems.length + '</span>'
    html += '<button type="button" class="ps-count-btn" aria-label="More questions" data-click="_psAdjCount" data-args="' + Actions.attrArgs([1, topicKey]) + '">+</button>'
    html += '<button type="button" class="ps-count-btn" title="Show all questions" data-click="_psSetAll" data-args="' + Actions.attrArgs([topicKey]) + '">All</button>'
    html += '<span class="text-secondary text-xs">/ ' + total + '</span>'
    html += '<button type="button" class="ps-shuffle-btn ms-1" id="ps-btn-reset" data-click="_psShuffle" data-args="' + Actions.attrArgs([topicKey]) + '">↺ Refresh</button>'
    if (_psMode !== 'recent') html += '<button type="button" class="ps-shuffle-btn ms-1" id="ps-btn-clear" title="Remove every question from this list and start from an empty state (your grades and progress are kept)" data-click="_psClear" data-args="' + Actions.attrArgs([topicKey]) + '">🗑 Clear</button>'
  }

  html += '</div>'
  // ── By Pattern: pick the pattern(s) that scope the active-recall due set ────
  if (_psMode === 'revise-pattern' && mod.patterns && mod.patterns.length) {
    html += '<div class="d-flex flex-wrap gap-2 mt-2">'
    html += mod.patterns.map(p =>
      '<button type="button" class="qp-chip' + (_psRevisePatterns.has(p.id) ? ' active' : '') + '" title="' + escHtml(p.name) + '" data-click="_psToggleRevisePattern" data-args="' + Actions.attrArgs([p.id, topicKey]) + '">' + p.id + '</button>'
    ).join('')
    if (_psRevisePatterns.size) html += '<button type="button" class="qp-chip" title="Deselect all patterns" data-click="_psSetRevisePatterns" data-args="' + Actions.attrArgs([[], topicKey]) + '">✕ Clear</button>'
    html += '</div>'
  }
  // ── Question list ──────────────────────────────────────────────────────────
  html += '<div id="ps-list">'
  if (_psCurrentItems.length === 0) {
    html += '<div style="text-align: center; padding: 2rem 1rem;">'
    html += '<p class="text-secondary text-xs mb-0">' + _psEmptyMsg() + '</p>'
    html += '</div>'
  } else {
    html += _psRowsHtml()
  }
  html += '</div>'
  // ── Timer bar ──────────────────────────────────────────────────────────────
  html += _timerBarHtml(psTimer, [1, 5, 10, 20], '')
  return html
}

function _fmtTimer(secs) {
  if (!secs) return 'Off'
  const m = Math.floor(secs / 60), s = secs % 60
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}
// What a timer display reads. Remaining time is 0 only when no timer is set ('Off') or once a set
// timer has run out — that must stay 00:00 on a re-render, not jump back to the full preset.
function _timerText(rem, total) {
  return total && !rem ? '00:00' : _fmtTimer(rem || total)
}


// The count control is a plain <span> in most modes, but an editable <input> in Graded
// (so you can type 1/4/5/10/15/whatever, not just step it) — write to whichever it is.
function _psSyncCountDisplay(count) {
  const el = document.getElementById('ps-count-val')
  if (!el) return
  if (el.tagName === 'INPUT') el.value = count
  else el.textContent = count
}
// Graded starts empty — read the typed count, clamp it, and generate. Full panel re-render
// (not _psShuffle's partial DOM patch) because the ctrl bar itself changes shape here: the
// "type a count → Generate" row becomes the usual −/count/+/All/Refresh row.
// 🗑 Clear: drop every question from this topic's practice list and return the panel to its
// empty "pick a count and hit Generate" state. Only the SET is discarded — grades, statuses,
// solve counts and the Recent log live elsewhere and are untouched.
// − on either list: shrink to n rows from the end, dropping ungraded rows before graded ones.
function _trimKeepDone(items, n, done) {
  const out = [...items]
  for (const drop of [k => !done.has(k), () => true])
    for (let i = out.length - 1; i >= 0 && out.length > n; i--) if (drop(out[i][0])) out.splice(i, 1)
  return out
}
// 🗑 Clear asks first only when rows were graded (the grades themselves are kept).
function _confirmClear(items, done) {
  const graded = items.filter(([k]) => done.has(k)).length
  return !graded || confirm('Clear this set? ' + graded + ' graded row' + (graded === 1 ? '' : 's') + ' will disappear from the list (your grades are kept).')
}
function _qpSolvedMsg() { return '✅ Session complete · <span style="color:var(--green)">' + _qpDoneThisSession.size + ' solved</span>' }
function _psClear(topicKey) {
  if (!TOPIC_MODULES[topicKey] || !_psCurrentItems.length) return
  if (!_confirmClear(_psCurrentItems, _psDoneThisSession)) return
  psTimer.stop()
  psTimer.rem = psTimer.total                       // back to the preset, not a half-run clock
  _psCurrentItems = []
  _psDoneThisSession.clear()
  _psReviseCodeFlagged.clear(); _psReviseShownThisSession.clear()
  _psClearedTopics.add(topicKey)                    // keep By Pattern from auto-refilling on re-render / revisit
  _psSaveSession()                                  // cleared topic → removes its saved session, so a reload stays empty too
  _renderPracticePanel()
}
function _psGenerateGraded(topicKey) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return
  const total = Object.keys(mod.questions).length
  const input = document.getElementById('ps-gen-count-input')
  const n = input ? parseInt(input.value, 10) : _psQCount
  _psQCount = Math.max(1, Math.min(total, isNaN(n) ? _psQCount : n))
  _psClearedTopics.delete(topicKey)
  _psCurrentItems = _psModePool(topicKey, _psQCount)
  _psQCount = _psCurrentItems.length || _psQCount
  _psPickReviseCodeFlags()
  _psSaveSession()
  _renderPracticePanel()
}
function _psAdjCount(delta, topicKey) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return
  if (psTimer.run) return  // locked while timer is running — use Reset to restart

  // Graded/Mock pools are mode-defined — just change the cap and regenerate.
  if (_psMode !== 'worked') {
    const tot = Object.keys(mod.questions).length
    _psQCount = Math.max(1, Math.min(tot, _psCurrentItems.length + delta))
    _psShuffle(topicKey)
    return
  }

  const total = Object.keys(mod.questions).length
  const currentCount = _psCurrentItems.length
  const newCount = Math.max(1, Math.min(total, currentCount + delta))
  if (newCount === currentCount) return

  if (newCount > currentCount) {
    // Add questions from the remaining pool (not already shown)
    const currentKeys = new Set(_psCurrentItems.map(([k]) => k))
    const pool = Object.entries(mod.questions).filter(([k]) => !currentKeys.has(k) && getStatus(k) !== 'Pending' && !_onCooldown(k))
    const toAdd = _orderPracticePool(pool).slice(0, newCount - currentCount)
    _psCurrentItems = [..._psCurrentItems, ...toAdd]
  } else {
    _psCurrentItems = _trimKeepDone(_psCurrentItems, newCount, _psDoneThisSession)
  }

  _psQCount = _psCurrentItems.length
  _psSyncCountDisplay(_psQCount)
  const listEl = document.getElementById('ps-list')
  if (listEl) {
    listEl.innerHTML = _psCurrentItems.length
      ? _psRowsHtml()
      : '<p class="text-secondary text-xs mb-0">No questions in this topic yet.</p>'
  }
  _psSaveSession()  // Persist the updated list
}

function _psSetAll(topicKey) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return
  if (psTimer.run) return  // locked while timer is running
  if (_psMode !== 'worked') {   // Graded/Mock: show the whole topic's mode pool
    _psQCount = Object.keys(mod.questions).length
    _psShuffle(topicKey)
    return
  }
  const currentKeys = new Set(_psCurrentItems.map(([k]) => k))
  const toAdd = Object.entries(mod.questions).filter(([k]) => !currentKeys.has(k))
  _psCurrentItems = [..._psCurrentItems, ...toAdd]
  _psQCount = _psCurrentItems.length
  _psSyncCountDisplay(_psQCount)
  const listEl = document.getElementById('ps-list')
  if (listEl) listEl.innerHTML = _psRowsHtml()
  _psSaveSession()  // Persist the updated list
}

// Revise + By Pattern only: after a fresh pool is generated, randomly flag ~20% of it as
// "actually code this one" — a spot-check against fooling yourself with recall alone. Re-rolled
// on every regeneration (Refresh, mode switch, pattern change); a mere restore-from-storage does
// NOT re-roll, so the flagged set stays stable across a page refresh until you actually regenerate.
function _psPickReviseCodeFlags() {
  _psReviseCodeFlagged = new Set()
  if (_psMode !== 'revise' && _psMode !== 'revise-pattern') return
  const n = Math.round(_psCurrentItems.length * 0.2)
  if (n <= 0) return
  // _shuffle() mutates its argument in place — shuffle a COPY so this pick doesn't silently
  // reorder (and destroy the weakest-first ranking of) the actual displayed list.
  _shuffle([..._psCurrentItems]).slice(0, n).forEach(([k]) => _psReviseCodeFlagged.add(k))
}
// Shared by Revise + By Pattern: weakest-first ordering over an already-filtered due set.
// ✗ forgot / ~ shaky sink to the top (weighted shuffle within each rank); ✓ solid / never-graded
// fill the rest, capped at `count`.
//
// No-repeat-within-a-cycle: when `count` is capped below the full due-set (manual −), a plain
// random slice on every Refresh could hand back overlapping subsets by chance, or leave some due
// questions unshown all day. `_psReviseShownThisSession` tracks keys already surfaced by a Refresh
// since the last full cycle; within each weakness tier, not-yet-shown keys sort before
// already-shown ones, so repeated Refreshes work through the WHOLE due-set before anything repeats.
// Once every current due key has been shown, the tracker resets so the next cycle can begin.
// (When count >= due.length nothing is capped, so this never changes what's visible.)
function _psRankedRevisePool(due, count) {
  if (due.length && due.every(([k]) => _psReviseShownThisSession.has(k))) {
    _psReviseShownThisSession.clear()
  }
  const unseen  = ([k]) => !_psReviseShownThisSession.has(k)
  const seenCmp = (a, b) => (unseen(a) === unseen(b) ? 0 : unseen(a) ? -1 : 1)
  const rank = k => ({ forgot: 0, shaky: 1 }[getRevise(k)?.grade] ?? 2)
  const weak = _weightedShuffle(due.filter(([k]) => rank(k) < 2))
    .sort((a, b) => (rank(a[0]) - rank(b[0])) || seenCmp(a, b))
  const rest = _shuffle(due.filter(([k]) => rank(k) === 2)).sort(seenCmp)
  const picked = [...weak, ...rest].slice(0, count)
  picked.forEach(([k]) => _psReviseShownThisSession.add(k))
  return picked
}
// ── Per-topic mode helpers (Graded / By Pattern / Recent / Pinned) ──────────
// Graded and By Pattern decide which of this topic's questions you practice, graded ✓/~/✗ on
// the row (see _buildReviseItem / _psRecallGrade). Recent and Pinned are read-only lists.
function _psModePool(topicKey, count) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return []
  // Pinned = every pinned question in this topic, in topic order. No count, no ranking.
  if (_psMode === 'pinned') return Object.entries(mod.questions).filter(([k]) => isQuestionPinned(k))
  if (_psMode === 'graded') {
    // Graded ignores the cooldown — your grade is the single source of truth (a clean solve
    // re-grades the question ✓ solid, and THAT is what sinks it). ✗ forgot /
    // ~ shaky ALWAYS appear; ✓ solid only rejoins once its REVISE_LADDER interval is up
    // (isReviseDue), and `count` caps how many of those due-solid rows pad the list after them.
    const graded    = Object.entries(mod.questions).filter(([k]) => getRevise(k))
    const rank      = k => ({ forgot: 0, shaky: 1 }[getRevise(k).grade] ?? 2)
    const weak      = _weightedShuffleByImpact(graded.filter(([k]) => rank(k) < 2)).sort((a, b) => rank(a[0]) - rank(b[0]))
    const solid     = _weightedShuffleByImpact(graded.filter(([k]) => rank(k) === 2 && isReviseDue(k)))
    const solidFill = Math.max(0, count - weak.length)
    return [...weak, ...solid.slice(0, solidFill)]
  }
  if (_psMode === 'revise-pattern') {
    // By Pattern = same active-recall pass as Revise, but scoped to only the pattern(s) selected
    // in _psRevisePatterns. No selection → empty pool (the UI prompts you to pick a pattern).
    if (!_psRevisePatterns.size || !mod.patterns) return []
    // Uses each pattern's own questionIds list — NOT templateRefs on the question — because some
    // modules (e.g. sliding-window) key templateRefs to a separate T1/T2 template scheme, while
    // pattern.questionIds is always the authoritative per-pattern membership list.
    const allowed = new Set()
    mod.patterns.filter(p => _psRevisePatterns.has(p.id)).forEach(p => (p.questionIds || []).forEach(k => allowed.add(k)))
    const due = Object.entries(mod.questions).filter(([k]) => allowed.has(k) && isReviseDue(k))
    return _psRankedRevisePool(due, count)
  }
  if (_psMode === 'recent') {
    // Recent = a read-only, newest-first log of what you graded in Graded/By Pattern — a place
    // to glance back at what you just practiced, not another pool to solve or grade from.
    const seen = new Set()
    const pool = []
    for (const e of getRecentLog()) {
      if (seen.has(e.lcKey)) continue
      seen.add(e.lcKey)
      const q = mod.questions[e.lcKey]
      if (q) pool.push([e.lcKey, q])
      if (pool.length >= count) break
    }
    return pool
  }
  return []   // no other mode exists (an old saved Worked/Mock/Revise session loads as Graded)
}
function _psRowsHtml() {
  if (_psMode === 'recent') return _psCurrentItems.map((item, i) => _buildRecentItem(item, i)).join('')
  if (_psMode === 'pinned') return _psCurrentItems.map((item, i) => _buildPinnedItem(item, i)).join('')
  // Graded + By Pattern both render as grade-rows: ✓/~/✗ right on the row, jump button,
  // and a 🔗 link to your saved submission if you have one.
  return _psCurrentItems.map((item, i) => _buildReviseItem(item, i, 'ps')).join('')
}
function _psEmptyMsg() {
  if (_psMode === 'pinned') return 'No pinned questions in this topic yet — tap 📌 on a question card below.'
  if (_psClearedTopics.has(currentTopicKey)) return 'Set cleared — pick a count and hit ▶ Generate to build a new one.'
  if (_psMode === 'graded') return 'You haven’t graded any questions in this topic yet — grade them with the 🧠 ✓/~/✗ chip on the cards.'
  if (_psMode === 'recent') return 'Nothing graded yet in Graded or By Pattern for this topic — practice a set to build your log.'
  return _psRevisePatterns.size ? 'Nothing due for the selected pattern(s) right now — come back later.' : 'Select one or more patterns above to build a revise set.'
}
function _renderPracticePanel() {
  const mod = TOPIC_MODULES[currentTopicKey]
  const body = document.getElementById('ps-body')
  if (mod && body) body.innerHTML = _buildPracticePanel(currentTopicKey, mod)
}
// Switch per-topic mode → regenerate for that mode and re-render the whole panel.
function _psSetMode(mode, topicKey) {
  if (psTimer.run) return  // don't switch mid-timed-run
  if (_psMode === mode) return
  _psMode = mode
  _psClearedTopics.delete(topicKey)   // a mode switch regenerates, so the topic is no longer 'cleared'
  psTimer.stop()
  _psDoneThisSession.clear()
  _psReviseShownThisSession.clear()  // fresh recall-rotation memory on every mode switch
  const total = Object.keys(TOPIC_MODULES[topicKey].questions).length
  if (mode === 'pinned') {
    _psCurrentItems = _psModePool(topicKey)   // the whole pinned list; leaves _psQCount alone
  } else if (mode === 'graded') {
    // Graded always lands empty — pick a count and hit Generate. Keeps the count you last
    // typed/set (seedCount) as the pre-filled value, it just doesn't auto-populate.
    _psCurrentItems = []
  } else {
    // Every mode — including Revise / By Pattern — seeds from the SAME count you last set: if you
    // set 10, Revise shows 10, not every due question in the topic. Use "All" to see everything due
    // at once. (Revise's own no-repeat-within-a-cycle logic in _psRankedRevisePool means repeated
    // Refreshes still work through the WHOLE due-set over time instead of the same 10 every time.)
    const seedCount = _psQCount
    _psCurrentItems = _psModePool(topicKey, Math.max(1, Math.min(seedCount, total)))
    _psQCount = _psCurrentItems.length || seedCount
  }
  _psPickReviseCodeFlags()
  // Save BEFORE rendering — with an empty pool, the panel build restores from storage,
  // which must already hold the new mode (not the old session).
  _psSaveSession()
  _renderPracticePanel()
}
// 'revise-pattern' mode only: toggle which pattern(s) (P1, P2…) scope the due-set. Regenerates
// the pool immediately, same as switching mode.
function _psToggleRevisePattern(patternId, topicKey) {
  if (psTimer.run) return  // don't reshuffle mid-timed-run
  if (_psRevisePatterns.has(patternId)) _psRevisePatterns.delete(patternId)
  else _psRevisePatterns.add(patternId)
  _psRevisePatternsShuffle(topicKey)
}
function _psSetRevisePatterns(ids, topicKey) {
  if (psTimer.run) return
  _psRevisePatterns = new Set(ids)
  _psRevisePatternsShuffle(topicKey)
}
// Shared by both: a pattern-scope change regenerates at your current count (same as any other
// Refresh) — it does NOT reset to "show everything," since the count is meant to stay exactly
// what you set it to across mode/scope changes. Use "All" to see the full due-set for the scope.
function _psRevisePatternsShuffle(topicKey) {
  _psReviseShownThisSession.clear()  // scope changed — fresh recall-rotation memory for the new due-set
  _psShuffle(topicKey)
  _renderPracticePanel()
}
// Grade a row in the per-topic Revise mode: same active-recall grading as the dashboard Revise
// Session, scoped to this topic. Rows stay in place on grade — tinted + the chosen button
// highlighted — so the list is a record of today's session, not a sweep.
function _psRecallGrade(ev, lcKey, grade) {
  ev.stopPropagation()
  gradeRevise(lcKey, grade)
  logRecent(lcKey, grade)
  // ✓ Solid in GRADED specifically (not By Pattern — that stays pure recall) gets full "clean
  // solve" credit, same as the old click-to-solve: push the code-cooldown ladder further out and
  // mark the question Solved. gradeRevise() already bumped the confidence ring for a solid grade.
  if (grade === 'solid' && _psMode === 'graded') _psCreditCleanSolve(lcKey)
  _psDoneThisSession.add(lcKey)
  _psSaveSession()
  const listEl = document.getElementById('ps-list')
  if (listEl) _regradeRow(listEl, _psCurrentItems, _psDoneThisSession, lcKey, (e, i) => _buildReviseItem(e, i, 'ps'), '🧠 Recall sweep complete')
}

function _psShuffle(topicKey) {
  const mod = TOPIC_MODULES[topicKey]
  if (!mod) return
  psTimer.stop()
  _psClearedTopics.delete(topicKey)

  // Save which keys were done this session BEFORE clearing, so we can push
  // them to the bottom of the new set — they've been practiced already today.
  const prevDone = new Set(_psDoneThisSession)
  _psDoneThisSession.clear()

  const count = Math.max(1, Math.min(_psQCount, Object.keys(mod.questions).length))
  const generated = _psModePool(topicKey, count)

  if (_psMode === 'worked') {
    // Worked: questions NOT done this session appear first, done ones at bottom.
    const fresh = generated.filter(([k]) => !prevDone.has(k))
    const done  = generated.filter(([k]) =>  prevDone.has(k))
    _psCurrentItems = [...fresh, ...done]
  } else {
    // Graded = weakest-first · Mock = random — keep _psModePool's order.
    _psCurrentItems = generated
  }

  _psQCount = _psCurrentItems.length
  _psPickReviseCodeFlags()
  _psSaveSession()  // Persist the new session

  _psSyncCountDisplay(_psQCount)
  const listEl = document.getElementById('ps-list')
  if (!listEl) return
  listEl.innerHTML = _psCurrentItems.length
    ? _psRowsHtml()
    : '<p class="text-secondary text-xs mb-0">' + _psEmptyMsg() + '</p>'
}

// ── Solve-count ring helpers ──────────────────────────────────────────────────
// 15-rung confidence ladder — one emoji per solve (1→14), GOD MODE locked at 15+.
// Plain emoji, elemental → cosmic climb.
const HERO_TIERS = [
  { name: 'Spark',       emoji: '✨' },
  { name: 'Flame',       emoji: '🔥' },
  { name: 'Bolt',        emoji: '⚡' },
  { name: 'Frost',       emoji: '❄️' },
  { name: 'Tide',        emoji: '🌊' },
  { name: 'Gale',        emoji: '🌪️' },
  { name: 'Stone',       emoji: '🪨' },
  { name: 'Storm',       emoji: '⛈️' },
  { name: 'Molten',      emoji: '🌋' },
  { name: 'Crystal',     emoji: '💎' },
  { name: 'Plasma',      emoji: '🔮' },
  { name: 'Solar',       emoji: '☀️' },
  { name: 'Nova',        emoji: '🌟' },
  { name: 'Eclipse',     emoji: '🌑' },
  { name: 'Singularity', emoji: '🌌' },   // GOD MODE — 15+, locked
]
// Solve count → tier index (1..15). One emoji per solve up to 14; 15+ stays the god tier.
function _heroTier(n) { return n <= 0 ? 0 : Math.min(n, HERO_TIERS.length) }

function _solveRingCls(n) {
  if (n >= 15) return 'solve-ring-diamond'   // god mode
  if (n >= 10) return 'solve-ring-gold'
  if (n >= 6)  return 'solve-ring-silver'
  if (n >= 3)  return 'solve-ring-bronze'
  return 'solve-ring-dim'
}

// The emoji shown in the ring for the current rank.
function _solveRingEmoji(n) {
  const t = _heroTier(n)
  if (t === 0) return '○'
  return HERO_TIERS[t - 1].emoji
}
function _solveRingTier(n) {
  const t = _heroTier(n)
  if (t === 0) return 'Not solved yet'
  const h = HERO_TIERS[t - 1]
  return (t === HERO_TIERS.length ? '🔒 GOD MODE · ' : 'Rank ' + t + ' · ') + h.name
}
// Ring tooltip: confidence rank + the exact solve count.
function _solveRingTitle(n) {
  return _solveRingTier(n) + ' · ' + n + ' solve' + (n === 1 ? '' : 's')
}

function _adjSolveCount(lcKey, delta) {
  const n = adjustSolveCount(lcKey, delta)
  const ring = document.querySelector('[data-solve-key="' + lcKey + '"]')
  if (ring) {
    ring.className   = 'solve-ring ' + _solveRingCls(n)
    ring.innerHTML   = _solveRingEmoji(n) + '<span class="solve-ring-num">' + n + '</span>'
    ring.title       = _solveRingTitle(n)
  }
}

// A solve deliberately does NOT touch the REVISE grade — you may have peeked at the answer
// while coding, so recall grades are only ever set by hand via the ✓/~/✗ buttons (gradeRevise
// is the sole writer). The solve still clears the "re-code me" force flag: that flag queued
// the question for a cold solve, and the solve is what discharges it. Live-updates the
// revise control on the question card if it happens to be on screen.
function _refreshReviseOnSolve(lcKey) {
  setCodeForced(lcKey, false)
  _refreshReviseCtrl(lcKey)
  _refreshReviseGradeBadges(lcKey)
  _refreshDueCounts()
}
