// 📓 Notebook (index.html) · App state: badge/status maps, topic tabs, the notebook's state, saved practice sessions, and the ⏱ timer.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── HTML GENERATION STYLE ───────────────────────────────────────────────────
// AI: all HTML generation uses string concatenation (+ operator) with escHtml()
// for any user-facing data. Template literals (backticks) are used only in
// buildNav() and buildTopicTabs() where interpolation is cleaner and no
// user data is concatenated directly. Do not mix styles within a function.
// ─────────────────────────────────────────────────────────────────────────────

// ─── BADGE / STATUS MAPS ──────────────────────────────────────────────────────
// AI: all status/difficulty display mappings live here — update here only.
const DIFFICULTY_BADGE = { Easy: 'success', Medium: 'warning', Hard: 'danger' }
const STATUS_DOT       = { Solved: 'bg-success', 'In Progress': 'bg-warning', Pending: 'bg-secondary' }
const STATUS_EMOJI      = { Solved: '✅', 'In Progress': '🚧', Pending: '📋' }
const STATUS_CYCLE      = { Pending: 'In Progress', 'In Progress': 'Solved', Solved: 'Pending' }
// The status a question is COUNTED under in the progress tallies (dashboard + topic tracker).
// 📋 Pending there means the untouched learn backlog (the same reading isCodeDue uses), so a
// question you've solved or graded but whose dot reads 📋 counts as 🚧 In Progress — where its
// next grade puts it anyway. The dot itself isn't reset: Solved → Pending → In Progress is the
// only way the cycle can step a question down, so landing on 📋 is often just passing through,
// and wiping the solve count / revise history / cooldown there would destroy real progress.
function _countedStatus(lcKey) {
  const st = getStatus(lcKey)
  return st === 'Pending' && _isEngaged(lcKey) ? 'In Progress' : st
}

// Interview frequency (how often a question is asked). Source field: q.freq in data.js.
// High = Blind 75 / FAANG-flagged "must-know"; Medium = NeetCode 150 / commonly asked;
// Low = pattern-completeness, less commonly asked directly.
// Frequency badge = traffic-light dot + word in a tinted box (🔴 red / 🟡 yellow / ⚪ grey).
// Difficulty keeps its solid green/amber/red pill (no dot); the leading dot + tinted box
// is what separates the two dimensions at a glance.
const FREQ_DOT   = { High: '🔴', Medium: '🟡', Low: '⚪' }
const FREQ_LABEL = { High: 'High', Medium: 'Medium', Low: 'Low' }
const FREQ_DESC  = { High: 'asked very often — drill first', Medium: 'commonly asked', Low: 'less common — pattern completeness' }
function freqBadge(q, extraCls) {
  const f = q && q.freq
  if (!f || !FREQ_LABEL[f]) return ''
  return '<span class="badge freq-badge freq-' + f.toLowerCase() + (extraCls || '') + '"' +
    ' title="Interview frequency: ' + FREQ_LABEL[f] + ' — ' + FREQ_DESC[f] + '">' +
    FREQ_DOT[f] + ' ' + FREQ_LABEL[f] + '</span>'
}

// ─── QUICK-REF PANEL IDs ──────────────────────────────────────────────────────
const QR_IDS = {
  practice: 'qr-practice',
}

// ─── TOPIC TABS ───────────────────────────────────────────────────────────────
// AI: single source of truth for tab definitions.
// Adding a tab here automatically renders it in the HTML nav and wires up
// the tab pane. You must also add a render function and call it in renderCurrentTab().
const TOPIC_TABS = [
  { key: 'questions',  label: 'Questions'  },
  { key: 'notes',      label: '📝 Notes'   },
]

// ─── STATE ───────────────────────────────────────────────────────────────────
let currentTopicKey = null
let currentTab = 'questions'
let currentQFilter = 'all'
let currentFreqFilter = 'all'   // 'all' | 'High' | 'Medium' | 'Low' (interview frequency)
let currentCompanyFilter = null   // null = all companies
const COMPANY_LABEL = Object.fromEntries(COMPANIES.map(c => [c.key, c.label]))

// Brand-ish accent colors for company pills (rendering layer — data.js stays data-only).
// Pills tint this color: solid text + low-alpha background + faint border.
const COMPANY_COLOR = {
  google: '#4f86f7', meta: '#8b7bf7', amazon: '#ff9f43', apple: '#b9c0c8',
  microsoft: '#34c3a0', netflix: '#f0494b', bloomberg: '#f78fb3', uber: '#9aa4b2',
  linkedin: '#4aa3e8', adobe: '#ff6b6b', nvidia: '#86c232', atlassian: '#4c9aff',
  stripe: '#a78bfa', doordash: '#ff5a5f', airbnb: '#ff6f9c', databricks: '#ff7a59',
  snowflake: '#56b8e8', coinbase: '#6b8cff',
}
// Display order = COMPANIES order (tier 1 first), so the most relevant names lead.
const COMPANY_ORDER = Object.fromEntries(COMPANIES.map((c, i) => [c.key, i]))

// One colored company pill. `cls` overrides the class (defaults to .company-pill).
function companyPill(key, cls) {
  const color = COMPANY_COLOR[key] || '#8a93a0'
  return '<span class="' + (cls || 'company-pill') + '"' +
    ' style="color:' + color + ';border-color:' + color + ';background:' + color + '14">' +
    escHtml(COMPANY_LABEL[key] || key) + '</span>'
}

// Compact colored pills for a question header — top companies by tier, capped with a +N overflow.
function companyPillsRow(lc, max) {
  const keys = getCompanies(lc).slice().sort((a, b) => (COMPANY_ORDER[a] ?? 99) - (COMPANY_ORDER[b] ?? 99))
  if (!keys.length) return ''
  const cap = max || 4
  const shown = keys.slice(0, cap).map(k => companyPill(k)).join('')
  const rest = keys.slice(cap)
  const more = rest.length
    ? '<span class="company-pill company-pill-more" title="' + escHtml(rest.map(k => COMPANY_LABEL[k] || k).join(', ')) + '">+' + rest.length + '</span>'
    : ''
  return '<span class="q-companies">' + shown + more + '</span>'
}

// ─── PRACTICE SESSION STATE ──────────────────────────────────────────────────
let _psQCount     = 5     // question count — shared across ALL modes (Worked/Graded/Mock/Revise/By Pattern) so it's exactly what you set it to, no matter which mode you're in
// ⏱ One countdown, used twice: the topic Practice Session (id 'ps') and the dashboard Quick
// Practice ('qp'). Its elements are <id>-timer-disp and <id>-timer-play; lockIds are the count
// buttons disabled while it runs. TIMERS (by id) is declared with psTimer, before either is made.
function makeTimer(id, lockIds) {
  const el = part => document.getElementById(id + '-timer-' + part)
  const t = TIMERS[id] = { id, total: 0, rem: 0, run: false, iv: null, preset: 0 }
  t.lock = on => lockIds.forEach(i => { const b = document.getElementById(i); if (b) b.disabled = on })
  t.sync = () => {
    const disp = el('disp')
    if (!disp) return
    disp.textContent = _timerText(t.rem, t.total)
    disp.className = 'ps-timer-display' + (t.run ? ' ps-running' : '') + (!t.rem && t.total > 0 ? ' ps-expired' : '')
  }
  t.stop = () => {
    if (t.iv) { clearInterval(t.iv); t.iv = null }
    t.run = false
    const btn = el('play')
    if (btn) btn.textContent = '▶'
    t.lock(false)
  }
  t.set = (mins, btn) => {
    t.stop()
    t.preset = mins
    t.rem = t.total = mins * 60
    // Only this bar's presets: the other timer's bar may be on the page too
    btn?.closest('.ps-timer-bar')?.querySelectorAll('.ps-preset-btn').forEach(b => b.classList.remove('ps-active'))
    btn?.classList.add('ps-active')
    t.sync()
  }
  t.toggle = () => {
    if (!t.total) return   // nothing set yet
    if (t.run) return t.stop()
    if (t.rem <= 0) t.rem = t.total
    t.run = true
    const btn = el('play')
    if (btn) btn.textContent = '⏸'
    t.iv = setInterval(t.tick, 1000)
    t.lock(true)
  }
  t.reset = () => { t.stop(); t.rem = t.total; t.sync() }
  t.tick = () => {
    if (t.rem <= 0) { t.stop(); t.rem = 0; return t.sync() }
    t.rem--
    t.sync()
  }
  return t
}

function _timerBarHtml(t, presets, cls) {
  return '<div class="ps-timer-bar' + cls + '">' +
    '<span class="text-secondary text-xs flex-shrink-0">⏱ Timer:</span>' +
    presets.map(m => '<button type="button" class="ps-preset-btn' + (t.preset === m ? ' ps-active' : '') + '" data-click="timerSet" data-args="' + Actions.attrArgs([t.id, m, '$this']) + '">' + m + 'm</button>').join('') +
    '<span class="ps-timer-display' + (t.run ? ' ps-running' : '') + (t.rem === 0 && t.total > 0 ? ' ps-expired' : '') + '" id="' + t.id + '-timer-disp">' + _timerText(t.rem, t.total) + '</span>' +
    '<button type="button" class="ps-timer-ctrl" id="' + t.id + '-timer-play" data-click="timerToggle" data-args="' + Actions.attrArgs([t.id]) + '" title="Start / Pause">' + (t.run ? '⏸' : '▶') + '</button>' +
    '<button type="button" class="ps-timer-ctrl" data-click="timerReset" data-args="' + Actions.attrArgs([t.id]) + '" title="Reset timer">↺</button>' +
    '</div>'
}

const TIMERS = {}           // ⏱ the two countdowns by id, for the timerSet/Toggle/Reset actions
// The topic panel's −/+/All have no ids to lock: _psAdjCount and _psSetAll refuse while it runs.
const psTimer = makeTimer('ps', [])
let _psDoneThisSession      = new Set()  // keys done in current per-topic practice batch
let _psCurrentItems         = []         // current ordered list for per-topic session
let _psCurrentTopic         = null       // currently active topic key for practice session
let _psMode                 = 'graded'   // per-topic mode: 'graded' (your graded questions, weakest first) | 'revise-pattern' (active recall scoped to selected pattern(s) — see _psRevisePatterns) | 'recent' | 'pinned'
let _psRevisePatterns       = new Set()  // 'revise-pattern' mode only: pattern IDs (P1, P2…) to scope the due-set to; empty = nothing selected yet
let _psReviseCodeFlagged    = new Set()  // Revise/By Pattern only: ~20% of the current set, randomly picked, marked "actually code this" (not just recall)
let _psClearedTopics        = new Set()  // topics whose set was emptied with 🗑 Clear — the panel stays empty (with a Generate button) instead of auto-regenerating; dropped by any real regenerate
let _psReviseShownThisSession = new Set()  // Revise/By Pattern only: keys already surfaced by a Refresh since the last full cycle — used to push them to the back so repeated manual Refreshes (with a capped count) cycle through the whole due-set before repeating anything

// ─── PRACTICE SESSION PERSISTENCE ────────────────────────────────────────────
// Store/restore practice sessions (ALL modes — Worked/Graded/Mock) so a refresh or topic
// navigation never reshuffles your set: only ↺ Reset/Refresh or a mode switch regenerates.
// Format: { [topicKey]: { mode, items: [[lcKey, {title, difficulty}]], doneInSession: [lcKeys...],
//           mockReveal, ... } } — one saved session per topic.
const PS_SESSION_KEY = 'dsa-practice-session-v1'
function _psAllSessions() {
  try {
    const raw = JSON.parse(localStorage.getItem(PS_SESSION_KEY) || 'null')
    if (!raw) return {}
    // Legacy single-session format ({ topicKey, items, ... } — Worked-only) → per-topic map
    if (raw.topicKey) return { [raw.topicKey]: Object.assign({ mode: 'worked' }, raw) }
    return raw
  } catch { return {} }
}
function _psSaveSession() {
  if (!_psCurrentTopic) return
  try {
    const all = _psAllSessions()
    // Graded's empty "pick a count and hit Generate" state must NOT be saved as a session —
    // an empty-but-truthy saved session would make _psLoadSession return it on the next visit,
    // which restores it (and its "always show weak graded questions" merge) INSTEAD of leaving
    // the panel empty, silently defeating the "Graded starts empty" behavior. No items yet means
    // no session yet: clear any stale entry instead of writing an empty one.
    if (_psCurrentItems.length === 0 && (_psMode === 'graded' || _psClearedTopics.has(_psCurrentTopic))) {
      delete all[_psCurrentTopic]
      localStorage.setItem(PS_SESSION_KEY, JSON.stringify(all))
      return
    }
    all[_psCurrentTopic] = {
      mode: _psMode,
      items: _psCurrentItems.map(([lcKey, q]) => [lcKey, { title: q.title, difficulty: q.difficulty }]),
      doneInSession: Array.from(_psDoneThisSession),
      mockReveal: false,   // Mock mode was removed (2026-11-25); field kept so the saved shape is unchanged
      revisePatterns: Array.from(_psRevisePatterns),
      codeFlagged: Array.from(_psReviseCodeFlagged),
      reviseShown: Array.from(_psReviseShownThisSession),
      qCount: _psQCount,
    }
    localStorage.setItem(PS_SESSION_KEY, JSON.stringify(all))
  } catch {}
}
function _psLoadSession(topicKey) {
  const session = _psAllSessions()[topicKey]
  if (!session || !Array.isArray(session.items)) return null
  // Restore done state from persisted session
  _psDoneThisSession      = new Set(session.doneInSession || [])
  _psRevisePatterns       = new Set(session.revisePatterns || [])
  _psReviseCodeFlagged    = new Set(session.codeFlagged || [])
  _psReviseShownThisSession = new Set(session.reviseShown || [])
  if (typeof session.qCount === 'number') _psQCount = session.qCount
  return session
}

// ─── DASHBOARD QUICK PRACTICE SESSION STATE ──────────────────────────────────
// Kept separate from per-topic state so navigating to a topic page and back
// never wipes the dashboard session progress.
let _qpDoneThisSession      = new Set()  // keys marked done on the dashboard qp panel

// Give a ✓ Solid grade in Graded the same "clean solve" credit the old click-to-solve row gave:
// push the code-cooldown ladder further out, timestamp it as practiced, clear a ✗'s must-code
// flag (this is the cold solve it asked for), and mark the question Solved if it isn't already.
// The confidence-ring bump is NOT repeated here — gradeRevise() already does that. Always called
// right after gradeRevise(), which has rewound any earlier grade from today, so a repeated ✓
// steps the ladder from the same starting point instead of climbing it once per click.
function _psCreditCleanSolve(lcKey) {
  markPracticed(lcKey)
  bumpReviewInterval(lcKey)
  _refreshReviseOnSolve(lcKey)
  if (getStatus(lcKey) !== 'Solved') setQuestionStatus(lcKey, 'Solved')
}
// A question is "due" if never practiced OR last practiced > N days ago (N = per-key review interval)
function isDue(lcKey) {
  const last = getLastPracticed(lcKey)
  if (!last) return true
  return (Date.now() - new Date(last).getTime()) > getReviewInterval(lcKey) * 24 * 60 * 60 * 1000
}

// CODE queue "due": you've engaged with it and it's overdue on the code ladder, OR a "forgot"
// recall force-queued it for a fresh cold solve. Never-touched 📋 Pending problems are the
// learn backlog (shown as the Pending count) — not counted here, to keep the number actionable.
function isCodeDue(lcKey) {
  if (isCodeForced(lcKey)) return true
  if (!_isEngaged(lcKey)) return false
  return isDue(lcKey)
}

// COOLDOWN: a question you've solved "rests" and is hidden from ALL practice generation (Worked /
// Graded / Mock, topic + dashboard) until its cooldown ladder (2→4→7→14) comes due again. A
// ✗-forgot (force-queued) question is never on cooldown — it always resurfaces. Never-solved
// questions are always "due" (isDue true), so they're never on cooldown either.
function _onCooldown(lcKey) { return !isDue(lcKey) && !isCodeForced(lcKey) }

// Unique question keys across topics. 49 questions are cross-listed in 2+ topics (same lcKey ⇒ same
// status / grade / cooldown), so summing per-topic lengths double-counts them — anything that reports a
// GLOBAL number (totals, due counts, "max N") must count each lcKey once.
function _uniqueQuestionKeys(topicKeys) {
  const set = new Set()
  ;(topicKeys || TOPICS.map(t => t.key)).forEach(k => {
    const mod = TOPIC_MODULES[k]
    if (mod) Object.keys(mod.questions).forEach(q => set.add(q))
  })
  return set
}

// Live-update the dashboard's two due-counts (no-op when not on the dashboard).
function _refreshDueCounts() {
  const rEl = document.getElementById('due-revise-count')
  const cEl = document.getElementById('due-code-count')
  if (!rEl && !cEl) return
  let codeDue = 0, reviseDue = 0
  _uniqueQuestionKeys().forEach(k => { if (isCodeDue(k)) codeDue++; if (isReviseDue(k)) reviseDue++ })
  if (rEl) rEl.textContent = reviseDue
  if (cEl) cEl.textContent = codeDue
}
// ─── QUICK PRACTICE STATE (dashboard) ────────────────────────────────────────
let _qpTopics  = new Set()  // selected topic keys
let _qpCount   = 10         // question count
let _qpResults = null       // last generated results ([lcKey, q][])
const qpTimer = makeTimer('qp', ['qp-btn-dec', 'qp-btn-inc'])
let _qpRevised     = false  // Dashboard 🕒 Graded mode: the set is your graded questions, weakest first (✗ → ~ → ✓), graded in place; a ✓ there gets clean-solve credit.

// ─── QP STATE PERSISTENCE ─────────────────────────────────────────────────────
const QP_STATE_KEY = 'dsa-qp-state-v1'
function _saveQpState() {
  try {
    const state = {
      topics:  Array.from(_qpTopics),
      count:   _qpCount,
      // Mock, Revise and Due-only were removed (2026-11-25); fields kept so the saved shape is unchanged.
      dueOnly: false,
      mock:    false,
      revise:  false,
      revised: _qpRevised,
      results: _qpResults ? _qpResults.map(([k]) => k) : null,
      // Which of THIS generated set you've graded/solved this session — without this, closing
      // and reopening the tab restores the same question list (results, above) but the tint
      // showing what you'd already graded would vanish, since that's normally in-memory only.
      // Cleared by _qpGenerate() on every real regenerate, same as the in-memory Set always was.
      doneThisSession: Array.from(_qpDoneThisSession),
    }
    localStorage.setItem(QP_STATE_KEY, JSON.stringify(state))
  } catch {}
}
// Fully replaces in-memory QP state from whatever's on disk right now — safe to call
// more than once (e.g. re-synced when the tab regains focus, see the visibilitychange
// listener below), not just once at page load. Being additive/partial here (the old
// version only ever ADDED to _qpTopics and left _qpResults alone when disk had none)
// is exactly how a background tab could re-save a stale in-memory snapshot on top of
// what a different, more-recently-active tab had just written — this makes reload
// idempotent so a re-sync always matches disk exactly, not "disk merged with whatever
// I already had in memory".
function _loadQpState() {
  _qpTopics = new Set()
  _qpResults = null
  _qpDoneThisSession = new Set()
  try {
    const raw = localStorage.getItem(QP_STATE_KEY)
    if (!raw) return
    const state = JSON.parse(raw)
    if (Array.isArray(state.topics)) state.topics.forEach(k => _qpTopics.add(k))
    if (typeof state.count   === 'number') _qpCount   = state.count
    // Graded IS restored — unlike Mock/"Worked-on only" (deliberately NOT restored below), its
    // toggle chip is still on the dashboard, so there's always a way to switch it back off; not
    // restoring it just meant a reload after finishing a Graded set silently re-rendered that
    // same set as plain rows and showed the wrong ("solved" instead of "graded") banner.
    if (typeof state.revised === 'boolean') _qpRevised = state.revised
    // Mock / "Worked-on only" are NOT restored: their dashboard toggle chips were removed, so a
    // `true` saved from before that removal would otherwise be permanently stuck on with no
    // button left to turn it back off, silently shrinking the pool or hiding everything.
    if (Array.isArray(state.results)) {
      // Re-hydrate [lcKey, q] pairs from TOPIC_MODULES
      const pairs = []
      state.results.forEach(k => {
        for (const topicKey of Object.keys(TOPIC_MODULES)) {
          const q = TOPIC_MODULES[topicKey].questions[k]
          if (q) { pairs.push([k, q]); break }
        }
      })
      if (pairs.length > 0) _qpResults = pairs
    }
    if (Array.isArray(state.doneThisSession)) _qpDoneThisSession = new Set(state.doneThisSession)
  } catch {}
}
