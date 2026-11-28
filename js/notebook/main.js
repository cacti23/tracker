// 📓 Notebook (index.html) · Start-up, the registered actions, synced keys and cloud sync. Loaded last: it wires up what the other files define.
// Plain scripts that share one global scope, loaded in this order by index.html (see CLAUDE.md).

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  syncThemeIcon()
  document.getElementById('sidebar')?.addEventListener('click', _closeDrawerOnPick)
  _loadQpState()
  buildNav()
  try { if (localStorage.getItem('dsa-sidebar-apps-open') === '1') document.getElementById('sidebar-apps').open = true } catch (e) {}
  // Before _restoreView: a shared page (Paper Club, Study Sites) keeps the notebook it was opened in.
  try { setHubMode(localStorage.getItem(HUB_MODE_KEY)) } catch { setHubMode('dsa') }
  _restoreView()
})

// Keep a backgrounded tab from clobbering a more-recently-active one: each tab only
// loads dashboard/practice state from localStorage ONCE, into its own in-memory copy
// (_qpResults, _qpDoneThisSession, ...) — it never re-reads disk between actions. If
// you leave a tab open, grade a fresh batch in a DIFFERENT tab, then come back and
// interact with the old one, it would otherwise save ITS stale in-memory copy over
// the newer one on disk, making today's grading look like it "disappeared". Re-sync
// from disk the moment a tab regains focus/visibility, before you can act in it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { _flushNoteSaves(); return }
  _loadQpState()
  _renderQuickPractice()
  _psResyncFromDisk()
})
window.addEventListener('pagehide', () => _flushNoteSaves())
// Another tab wrote the per-topic sessions: adopt them now, before this tab can save over them.
window.addEventListener('storage', e => { if (e.key === PS_SESSION_KEY) _psResyncFromDisk() })

// Same clobber as above, for the per-topic practice panel: _psSaveSession writes THIS tab's
// in-memory set (items, graded-this-session...) for the open topic, so a tab that sat in the
// background would overwrite the grades another tab saved meanwhile. Rebuild the open topic's
// panel from disk instead (_buildPracticePanel restores a saved session whenever the in-memory
// set is empty — the same path a reload or topic switch takes).
function _psResyncFromDisk() {
  const topicKey = _psCurrentTopic
  const mod = topicKey && TOPIC_MODULES[topicKey]
  if (!mod || topicKey !== currentTopicKey) return
  _psCurrentItems = []
  _psDoneThisSession = new Set()
  const html = _buildPracticePanel(topicKey, mod)
  const body = document.getElementById('ps-body')
  if (body) body.innerHTML = html
}

// ── ACTIONS ─────────────────────────────────────────────────────────────────
// The page has no inline event handlers (the CSP in vercel.json blocks them). Elements name an
// action instead (data-click="loadTopic" data-args='["trees"]', see js/actions.js), and only the
// actions registered here can run. Add a function here when markup starts naming it.
function _rememberAppsOpen(open) { try { localStorage.setItem('dsa-sidebar-apps-open', open ? '1' : '0') } catch (e) {} }
function _clearNoteSearchOnEscape(_value, ev, input) {
  if (ev.key !== 'Escape') return
  input.value = ''
  _onNoteSearch('')
}
function _subInputKey(lcKey, ev) {
  if (ev.key === 'Enter') saveSubmissionFromInput(lcKey)
  else if (ev.key === 'Escape') cancelAddSubmission(lcKey)
}
function _openSubMenuAdd(lcKey) {
  _renderSubMenu(lcKey, true)
  document.getElementById('sub-menu-input')?.focus({ preventScroll: true })
}
Actions.register({
  timerSet: (id, mins, btn) => TIMERS[id].set(mins, btn), timerToggle: id => TIMERS[id].toggle(), timerReset: id => TIMERS[id].reset(),
  _adjSolveCount, _captureNoteDraft, _closeSubMenu, _dashOpenRevision, _jumpToQuestion, _onNoteSearch,
  _practiceGrade, _psAdjCount, _psClear, _psGenerateGraded, _psRecallGrade, _psSetAll,
  _psSetMode, _psSetRevisePatterns, _psShuffle,
  _psToggleRevisePattern, _qpAdjCount, _qpClear, _qpGenerate, _qpReviseGrade, _qpSelectAll,
  _qpToggleRevised, _qpToggleTopic, _queueNoteSave,
  _saveNoteEditorHeight, _toggleNoteEditorExpand, cancelAddSubmission, cancelNoteEditor, cycleQuestionStatus, editTopicNote,
  goToQuestion, gradeRevise, handleGlobalSearch, loadDashboard, loadEmbed, loadGoogle, loadRecent,
  loadTopic, onAnimBtnClick, onPinBtnClick, onSubBtnClick, printTopicNote, removeAnimation,
  removeSubmission, removeTopicNote, saveAnimationFromMenu, saveNoteFromTextarea, saveSubmissionFromInput, saveSubmissionFromMenu,
  saveTopicNoteFromEditor, scrollToTop, setCompanyFilter, setFreqFilter, setQFilter, showAddSubmission,
  showTopicTab, skipToDailyQuestion, startNewTopicNote, switchHub, toggleAllNotes, toggleNoteOpen,
  toggleSidebar, toggleTheme, toggleTopicNotePin, sdTreeBy, sdTreeFilter, sdTreeToggle, sdOpenCard, sdAllNotes,
  'DataSync.account': () => DataSync.account(),
  open: (url, target) => window.open(url, target),
  _rememberAppsOpen, _clearNoteSearchOnEscape, _subInputKey, _openSubMenuAdd,
})

// ── SYNCED KEYS ─────────────────────────────────────────────────────────────
// Not synced on purpose: 'dsa-theme' (light/dark is each device's own choice) and
// 'dsa-revise-migrated-v1' (a one-time migration flag every device sets for itself on load).
const BACKUP_KEYS = [
  'dsa-progress-v1',
  'dsa-notes-v1',
  'dsa-topic-notes-v1',
  'dsa-submissions-v1',
  'dsa-animations-v1',
  'dsa-pins-v1',   // legacy: pins UI was removed, kept so old pins survive sync
  'dsa-question-pins-v1',   // 📌 bookmark pins (the topic's Pinned list); no logic reads them
  'dsa-solve-counts-v1',
  'dsa-seen-v1',
  'dsa-revise-v1',
  'dsa-code-force-v1',
  'dsa-recent-log-v1',
  'dsa-last-practiced-v1',
  'dsa-review-interval-v1',
  'dsa-streak-v1',
  'dsa-qp-state-v1',
  'dsa-practice-session-v1',
  'paper-club-v1',  // written by papers/paper-club.html (same origin), synced with the rest
  'postmortems-v1', // written by papers/postmortems.html, same as above
  'google-log-reviews-v1',     // written by google/google-onsite-log.html: review count per experience
  'google-log-reviewed-at-v1'  // ...and the date of the last review
]

// Cloud sync (shared module in sync.js): reuse the BACKUP_KEYS allowlist.
if (window.DataSync) {
  DataSync.init({
    appId: 'dsa',
    keys: BACKUP_KEYS,
    versionLabel: 'DSA Notebook',
    autoPush: true,                                  // upload a few seconds after each edit
    // Rewritten on load / per-device / by every grade and page visit (the two practice-session
    // keys hold which set is on screen, not progress): still synced, but not "edits", so they
    // never make a stale device look edited and merge instead of fast-forwarding.
    noiseKeys: ['dsa-streak-v1', 'dsa-qp-state-v1', 'dsa-practice-session-v1'],
    maxKeys: ['dsa-solve-counts-v1', 'google-log-reviews-v1']   // on conflict keep the larger count
  })
  // No Sync or Pull button: check the cloud on every open and whenever the person comes back
  // to the tab, so another device's edits show up by themselves (edits upload via autoPush).
  DataSync.autoSync({ everyOpen: true, onReturn: true })
}
