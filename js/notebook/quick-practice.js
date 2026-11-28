// 📓 Notebook (index.html) · The dashboard Quick Practice.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── QUICK PRACTICE (Dashboard) ───────────────────────────────────────────────

// Dispatcher: Graded renders grade-rows (✓/~/✗ + saved-solution link, right on the row);
// anything else (Worked-on-only pool, plain generated sets) renders solve-rows.
function _qpRowsHtml() {
  if (!_qpResults) return ''
  if (_qpRevised) return _qpResults.map((entry, i) => _buildReviseItem(entry, i, 'qp')).join('')
  return _qpResults.map((entry, i) => _buildPracticeItem(entry, i, true)).join('')
}


function _renderQuickPractice() {
  const el = document.getElementById('quick-practice-panel')
  if (!el) return
  const validTopics = TOPICS.filter(t => TOPIC_MODULES[t.key])

  const _selKeys = _uniqueQuestionKeys(Array.from(_qpTopics))
  const totalQ = _selKeys.size
  const maxQ   = totalQ
  const count  = maxQ ? Math.max(1, Math.min(_qpCount, maxQ)) : _qpCount

  let html = '<div class="card mt-4"><div class="card-body">'
  html += '<div class="d-flex align-items-center gap-2 mb-3">'
  html += '<span class="icon-xl">🎲</span>'
  html += '<h6 class="mb-0 fw-semibold">Quick Practice</h6>'
  html += '<span class="text-secondary text-xs mt-1">— pick topics, get a random set</span>'
  html += '</div>'

  // Topic chips
  html += '<div class="d-flex flex-wrap gap-2 mb-3">'
  validTopics.forEach(t => {
    const isActive = _qpTopics.has(t.key)
    html += '<button type="button" class="qp-chip' + (isActive ? ' active' : '') + '" data-click="_qpToggleTopic" data-args="' + Actions.attrArgs([t.key]) + '">' +
      t.icon + ' ' + escHtml(t.label) + '</button>'
  })
  const allSelected = validTopics.every(t => _qpTopics.has(t.key))
  html += '<button type="button" class="qp-chip' + (allSelected ? ' active' : '') + '" data-click="_qpSelectAll">' +
    (allSelected ? '✓ All' : '+ All') + '</button>'
  html += '</div>'

  // Count + generate row
  const disabled = !_qpRevised && _qpTopics.size === 0
  const genLabel = _qpRevised ? '🕒 Generate Graded' : '🎲 Generate Set'
  html += '<div class="d-flex align-items-center gap-2 flex-wrap">'
  html += '<button type="button" class="ps-count-btn" id="qp-btn-dec" aria-label="Fewer questions" data-click="_qpAdjCount" data-args="' + Actions.attrArgs([-1]) + '">−</button>'
  html += '<span class="ps-count-val" id="qp-count-val">' + count + '</span>'
  html += '<button type="button" class="ps-count-btn" id="qp-btn-inc" aria-label="More questions" data-click="_qpAdjCount" data-args="' + Actions.attrArgs([1]) + '">+</button>'
  html += '<span class="text-secondary text-xs">questions</span>'
  if (maxQ && !_qpRevised) html += '<span class="text-faint text-xxs">(max&nbsp;' + maxQ + ' from selected)</span>'
  html += '<button type="button" class="ps-shuffle-btn ms-2"' + (disabled ? ' disabled' : '') + ' data-click="_qpGenerate">' + genLabel + '</button>'
  html += '<button type="button" class="qp-chip ms-1" id="qp-btn-clear"' + (_qpResults && _qpResults.length ? '' : ' disabled') + ' data-click="_qpClear" title="Remove every question from the list and start from an empty state (your grades and progress are kept)">🗑 Clear</button>'
  html += '<button type="button" class="qp-chip' + (_qpRevised ? ' active' : '') + ' ms-1" data-click="_qpToggleRevised" title="Graded — solve the questions you have graded on the cards; ranked ✗ forgot → ~ shaky → ✓ confident">🕒 Graded</button>'
  html += '</div>'

  if (_qpRevised) {
    html += '<div class="qp-mock-note mt-2">🕒 <strong>Graded:</strong> the questions you’ve graded on the cards, ranked ✗ forgot → ~ shaky → ✓ confident. Solve them — click a row when done. Leave topics empty to span all.</div>'
  }

  // Timer bar (mirrors per-topic timer)
  html += _timerBarHtml(qpTimer, [5, 10, 20, 30], ' mt-2')

  // Results
  html += '<div id="qp-results" class="mt-3"></div>'
  html += '</div></div>'
  el.innerHTML = html

  // Restore previous results if available (preserves solved styling via _qpDoneThisSession)
  if (_qpResults && _qpResults.length > 0) {
    document.getElementById('qp-results').innerHTML =
      _qpRowsHtml()
    // Restore session-complete banner if the full set was already finished
    if (_qpDoneThisSession.size >= _qpResults.length) _doneBanner(document.getElementById('qp-results'), _qpRevised ? '🧠 Recall sweep complete · <span style="color:var(--green)">' + _qpDoneThisSession.size + ' graded</span>' : _qpSolvedMsg())
  } else {
    // Nothing generated yet — selecting a topic or toggling Graded/Mock only sets up what
    // WILL be generated; without this, the results area just looks blank/broken.
    const resultsEl = document.getElementById('qp-results')
    if (resultsEl) {
      resultsEl.innerHTML = '<p class="text-secondary text-xs mb-0">' + (disabled
        ? 'Pick at least one topic above, then generate your set.'
        : 'Click “' + genLabel + '” above to generate your set.') + '</p>'
    }
  }
  // Re-apply +/- lock if timer was running when we navigated away
  if (qpTimer.run) qpTimer.lock(true)
}

// Keep 🗑 Clear enabled only while there is a list to clear.
function _qpSyncClearBtn() {
  const b = document.getElementById('qp-btn-clear')
  if (b) b.disabled = !(_qpResults && _qpResults.length)
}
// 🗑 Clear: drop the generated set and return the dashboard to its empty state. Topic chips, the
// count and the Graded toggle stay so one click regenerates; grades/statuses/solve counts are
// untouched (they're stored per question, not per set).
function _qpClear() {
  if (!_qpResults || !_qpResults.length) return
  if (!_confirmClear(_qpResults, _qpDoneThisSession)) return
  qpTimer.stop()
  qpTimer.rem = qpTimer.total
  _qpResults = null
  _qpDoneThisSession.clear()
  _saveQpState()
  _renderQuickPractice()
}

function _qpToggleTopic(key) {
  if (qpTimer.run) return  // don't change topic selection mid-session
  if (_qpTopics.has(key)) _qpTopics.delete(key); else _qpTopics.add(key)
  _qpResults = null  // clear stale results when topic selection changes
  _saveQpState()
  _renderQuickPractice()
}

function _qpSelectAll() {
  if (qpTimer.run) return  // don't change topic selection mid-session
  const validTopics = TOPICS.filter(t => TOPIC_MODULES[t.key])
  const allSelected = validTopics.every(t => _qpTopics.has(t.key))
  if (allSelected) {
    _qpTopics.clear()
  } else {
    validTopics.forEach(t => _qpTopics.add(t.key))
  }
  _qpResults = null
  _saveQpState()
  _renderQuickPractice()
}

function _qpAdjCount(delta) {
  if (qpTimer.run) return  // locked while timer is running
  const maxQ = _uniqueQuestionKeys(Array.from(_qpTopics)).size
  _qpCount = Math.max(1, Math.min(maxQ || 99, _qpCount + delta))
  const el = document.getElementById('qp-count-val')
  if (el) el.textContent = _qpCount

  // If results already exist, do smart add/remove instead of resetting
  if (!_qpResults || _qpResults.length === 0) return
  // Graded has its own pool the smart add/remove below doesn't understand — regenerate instead.
  if (_qpRevised) { _qpGenerate(); return }

  const currentCount = _qpResults.length
  if (_qpCount > currentCount) {
    // Add more from the remaining pool (respect dueOnly filter)
    const currentKeys = new Set(_qpResults.map(([k]) => k))
    const pool = []
    _qpTopics.forEach(key => {
      const mod = TOPIC_MODULES[key]
      if (mod) Object.entries(mod.questions).forEach(([k, q]) => {
        if (currentKeys.has(k)) return
        if (_onCooldown(k)) return   // solved & resting
        pool.push([k, q])
      })
    })
    const toAdd = _orderPracticePool(pool).slice(0, _qpCount - currentCount)
    _qpResults = [..._qpResults, ...toAdd]
  } else if (_qpCount < currentCount) {
    _qpResults = _trimKeepDone(_qpResults, _qpCount, _qpDoneThisSession)
  }

  // Sync count display to actual list length and re-render
  if (el) el.textContent = _qpResults.length
  _saveQpState()
  const resultsEl = document.getElementById('qp-results')
  if (resultsEl) {
    resultsEl.innerHTML = _qpRowsHtml()
    // Only show session-complete if every question currently in the list is done
    // (not just because count was reduced below the done count)
    const doneInCurrentResults = _qpResults.filter(([k]) => _qpDoneThisSession.has(k)).length
    if (doneInCurrentResults > 0 && doneInCurrentResults >= _qpResults.length) _doneBanner(resultsEl, _qpSolvedMsg())
  }
}

function _qpGenerate() {
  const allTopics = TOPICS.filter(t => TOPIC_MODULES[t.key]).map(t => t.key)
  // A plain set needs a topic selected; Graded can sweep all topics on its own.
  if (!_qpRevised && _qpTopics.size === 0) return
  if (qpTimer.run) return  // don't reset session while timer is running

  // Pool topics: Graded = selected (or all if none) · plain set = selected.
  const poolTopics = _qpTopics.size ? Array.from(_qpTopics) : (_qpRevised ? allTopics : [])
  const seen = new Set()
  const pool = []
  poolTopics.forEach(key => {
    const mod = TOPIC_MODULES[key]
    if (!mod) return
    Object.entries(mod.questions).forEach(([k, q]) => {
      if (seen.has(k)) return  // dedup
      seen.add(k)
      if (!_qpRevised && _onCooldown(k)) return                         // solved & resting — hidden until due again (Graded ignores it: your grade + the revise ladder decide, same as per-topic Graded)
      if (_qpRevised) {
        if (!getRevise(k)) return                                       // Graded: only problems you've graded
        if (_weaknessRank(k) === 2 && !isReviseDue(k)) return            // ✓ solid: wait for the ladder before resurfacing
      }
      pool.push([k, q])
    })
  })

  const maxQ  = pool.length
  if (maxQ === 0) {
    const el = document.getElementById('qp-results')
    if (el) el.innerHTML = '<p class="text-secondary text-xs mt-2 mb-0">' + (_qpRevised ? "You haven't graded any problems yet — grade them with the 🧠 ✓/~/✗ chip on the question cards." : 'No questions found.') + '</p>'
    _qpResults = []
    _qpSyncClearBtn()
    return
  }
  const count = Math.max(1, Math.min(_qpCount, maxQ))

  // Snapshot done-this-session BEFORE clearing, so previously solved questions
  // land at the bottom of the new set instead of back at the top.
  const prevDone = new Set(_qpDoneThisSession)
  _qpDoneThisSession.clear()

  // Graded: ✗ forgot / ~ shaky NEVER get cut by the count cap (only ✓ solid padding is capped), weighted
  // by interview frequency so limited practice time goes to your weakest AND highest-impact problems.
  // A plain set goes weakest-first (✗ forgot → ~ shaky → ✓ confident → rest).
  let generated
  if (_qpRevised) {
    generated = _weakThenSolid(pool, _weaknessRank, count)
  } else {
    generated = _orderByWeakness(_orderPracticePool(pool)).slice(0, count)
  }

  const fresh = generated.filter(([k]) => !prevDone.has(k))
  const done  = generated.filter(([k]) =>  prevDone.has(k))
  _qpResults = [...fresh, ...done]
  _saveQpState()

  // Lock +/- while timer is running
  if (qpTimer.run) qpTimer.lock(true)

  const el = document.getElementById('qp-results')
  if (el) el.innerHTML = _qpRowsHtml()
  // Sync _qpCount and display to actual result length (pool may be smaller than requested)
  _qpCount = _qpResults.length
  const countEl = document.getElementById('qp-count-val')
  if (countEl) countEl.textContent = _qpResults.length
  _qpSyncClearBtn()
}

function _qpToggleRevised() {
  if (qpTimer.run) return
  _qpRevised = !_qpRevised
  _qpResults = null
  _qpDoneThisSession.clear()
  _saveQpState()
  _renderQuickPractice()
}

// renderInterviewTips removed — now rendered inside renderTopicAlwaysVisible
